<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use App\Models\Absensi;

class AbsensiController extends Controller
{
    private $jenisMap = [
        'kamar' => 'KAMAR',
        'sekolah' => 'SEKOLAH',
        'pbs' => 'PBS',
        'pbm' => 'PBM',
        'diniyah' => 'DINIYAH'
    ];

    public function index(Request $request)
    {
        $query = DB::table('v_rekap_absensi_harian');

        if ($request->has('jenis')) {
            $query->where('jenis_kegiatan', $request->jenis);
        }
        if ($request->has('tanggal')) {
            $query->where('tanggal', $request->tanggal);
        }
        if ($request->has('kamar_id')) {
            $query->whereExists(function($q) use ($request) {
                $q->select(DB::raw(1))
                  ->from('santri')
                  ->whereColumn('santri.santri_id', 'v_rekap_absensi_harian.santri_id')
                  ->where('santri.kamar_id', $request->kamar_id);
            });
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->get());
    }

    public function bulkUpsert(Request $request, $jenis)
    {
        if (!isset($this->jenisMap[$jenis])) {
            return response()->json(['message' => 'Jenis kegiatan tidak valid'], 400);
        }

        $kodeKegiatan = $this->jenisMap[$jenis];
        $kegiatan = DB::table('jenis_kegiatan')->where('kode', $kodeKegiatan)->first();
        if (!$kegiatan) {
            return response()->json(['message' => 'Kegiatan tidak ditemukan'], 404);
        }

        $data = $request->validate([
            'jadwal_id' => 'required|integer',
            'tanggal' => 'required|date',
            'absensi' => 'required|array',
            'absensi.*.santri_id' => 'required|integer',
            'absensi.*.status' => 'required|in:Hadir,Sakit,Izin,Alpha,Terlambat',
            'absensi.*.menit_terlambat' => 'nullable|integer',
            'absensi.*.keterangan' => 'nullable|string',
        ]);

        $jadwal = DB::table('jadwal_kegiatan')->where('jadwal_id', $data['jadwal_id'])->first();
        if (!$jadwal) {
            return response()->json(['message' => 'Jadwal tidak ditemukan'], 404);
        }

        $toleransiInput = (int) (DB::table('pengaturan_sistem')->where('setting_key', 'toleransi_menit_terlambat_input')->value('setting_value') ?? 30);
        
        $jamSelesai = \Carbon\Carbon::parse($data['tanggal'] . ' ' . $jadwal->jam_selesai);
        $batasWaktuInput = $jamSelesai->addMinutes($toleransiInput);

        $now = now();
        $petugas = Auth::user() ?? \App\Models\Petugas::where('jabatan', 'Admin')->first();

        $upsertData = [];
        $warnings = [];

        foreach ($data['absensi'] as $item) {
            // Check if Santri is currently on 'Izin'
            $sedangIzin = DB::table('v_santri_sedang_izin')
                ->where('santri_id', $item['santri_id'])
                ->where('tanggal_mulai', '<=', $data['tanggal'])
                ->where('rencana_kembali', '>=', $data['tanggal'])
                ->exists();

            if ($sedangIzin && $item['status'] !== 'Izin') {
                $warnings[] = "Santri ID {$item['santri_id']} sedang izin, namun Anda mengubah statusnya.";
            }

            if (Gate::forUser($petugas)->denies('create', [Absensi::class, $item['santri_id'], $kegiatan->jenis_kegiatan_id])) {
                return response()->json(['message' => "Anda tidak memiliki akses untuk Santri ID {$item['santri_id']}"], 403);
            }

            // check existing to preserve waktu_input
            $existing = DB::table('absensi')
                ->where('santri_id', $item['santri_id'])
                ->where('jenis_kegiatan_id', $kegiatan->jenis_kegiatan_id)
                ->where('jadwal_id', $data['jadwal_id'])
                ->where('tanggal', $data['tanggal'])
                ->first();

            $waktuInput = $existing ? $existing->waktu_input : $now->toDateTimeString();
            $diinputOleh = $existing ? $existing->diinput_oleh : $petugas->petugas_id;
            $diubahOleh = $existing ? $petugas->petugas_id : null;

            $upsertData[] = [
                'santri_id' => $item['santri_id'],
                'jenis_kegiatan_id' => $kegiatan->jenis_kegiatan_id,
                'jadwal_id' => $data['jadwal_id'],
                'tanggal' => $data['tanggal'],
                'status' => $item['status'],
                'menit_terlambat' => $item['menit_terlambat'] ?? null,
                'keterangan' => $item['keterangan'] ?? null,
                'waktu_input' => $waktuInput,
                'diinput_oleh' => $diinputOleh,
                'diubah_oleh' => $diubahOleh,
                'updated_at' => $now->toDateTimeString()
            ];
        }

        DB::table('absensi')->upsert($upsertData, ['santri_id', 'jenis_kegiatan_id', 'jadwal_id', 'tanggal'], [
            'status', 'menit_terlambat', 'keterangan', 'diubah_oleh', 'updated_at'
        ]);

        // Hitung input_terlambat untuk response (berlaku untuk batch ini)
        $inputTerlambat = $now->greaterThan($batasWaktuInput);

        return response()->json([
            'message' => 'Absensi berhasil disimpan',
            'input_terlambat' => $inputTerlambat,
            'warnings' => $warnings
        ]);
    }

    public function update(Request $request, $id)
    {
        $absensi = DB::table('absensi')->where('absensi_id', $id)->first();
        if (!$absensi) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $petugas = Auth::user();
        $absensiModel = new Absensi((array)$absensi); // Mock for policy
        $absensiModel->santri_id = $absensi->santri_id;
        $absensiModel->jenis_kegiatan_id = $absensi->jenis_kegiatan_id;

        if (Gate::forUser($petugas)->denies('update', $absensiModel)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($petugas->jabatan !== 'Admin') {
            $durasiEdit = (int) (DB::table('pengaturan_sistem')->where('setting_key', 'durasi_edit_absensi_menit')->value('setting_value') ?? 60);
            $waktuInput = \Carbon\Carbon::parse($absensi->waktu_input);
            $diff = (int) abs(now()->diffInMinutes($waktuInput));
            
            if ($diff > $durasiEdit) {
                return response()->json(['message' => 'Batas waktu edit absensi telah habis'], 403);
            }
        }

        $data = $request->validate([
            'status' => 'required|in:Hadir,Sakit,Izin,Alpha,Terlambat',
            'menit_terlambat' => 'nullable|integer',
            'keterangan' => 'nullable|string',
        ]);

        $data['diubah_oleh'] = $petugas->petugas_id;
        $data['updated_at'] = now()->toDateTimeString();

        DB::transaction(function() use ($absensi, $data, $petugas, $id) {
            DB::table('absensi')->where('absensi_id', $id)->update($data);

            DB::table('log_aktivitas')->insert([
                'petugas_id' => $petugas->petugas_id,
                'aksi' => 'UPDATE',
                'nama_tabel' => 'absensi',
                'record_id' => $id,
                'data_sebelum' => json_encode($absensi),
                'data_sesudah' => json_encode(array_merge((array)$absensi, $data)),
                'created_at' => now()
            ]);
        });

        return response()->json(['message' => 'Absensi berhasil diupdate']);
    }
}
