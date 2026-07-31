<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MasterController extends Controller
{
    private const PENUGASAN = [
        'sekolah' => ['tipe' => 'KelasFormal', 'table' => 'kelas_formal', 'pk' => 'kelas_formal_id', 'label' => 'nama_kelas', 'jabatan' => 'Wali Kelas'],
        'kamar' => ['tipe' => 'Kamar', 'table' => 'kamar', 'pk' => 'kamar_id', 'label' => 'nama', 'jabatan' => 'Pembina Kamar'],
        'pbs' => ['tipe' => 'KelompokPBS', 'table' => 'kelompok_pbs', 'pk' => 'kelompok_pbs_id', 'label' => 'nama_kelompok', 'jabatan' => 'Ustadz'],
        'diniyah' => ['tipe' => 'KelompokMadin', 'table' => 'kelompok_madin', 'pk' => 'kelompok_madin_id', 'label' => 'nama_kelas_madin', 'jabatan' => 'Ustadz'],
        'pbm' => ['tipe' => 'KelompokPBM', 'table' => 'kelompok_pbm', 'pk' => 'kelompok_pbm_id', 'label' => 'nama_kelompok', 'jabatan' => 'Ustadz'],
    ];

    public function getPetugas()
    {
        return response()->json(DB::table('petugas')
            ->select('petugas_id', 'nama', 'username', 'no_hp', 'jabatan', 'status_aktif', 'wajib_ganti_password')
            ->get());
    }

    public function getKamar()
    {
        return response()->json(DB::table('kamar')->get());
    }

    public function getSantri()
    {
        return response()->json(DB::table('santri')->get());
    }

    public function getPenugasan()
    {
        $rows = DB::table('petugas_penugasan')
            ->join('petugas', 'petugas_penugasan.petugas_id', '=', 'petugas.petugas_id')
            ->orderBy('petugas.nama')
            ->select('petugas_penugasan.*', 'petugas.nama as nama_petugas', 'petugas.jabatan')
            ->get();

        foreach ($rows as $row) {
            $config = collect(self::PENUGASAN)->firstWhere('tipe', $row->tipe_target);
            $row->nama_target = $config
                ? DB::table($config['table'])->where($config['pk'], $row->target_id)->value($config['label'])
                : null;
        }

        return response()->json($rows);
    }

    public function storePenugasan(Request $request)
    {
        $data = $request->validate([
            'petugas_id' => 'required|integer|exists:petugas,petugas_id',
            'jenis' => 'required|in:sekolah,kamar,pbs,diniyah,pbm',
            'target_id' => 'required|integer',
        ]);
        $config = self::PENUGASAN[$data['jenis']];
        $petugas = DB::table('petugas')->where('petugas_id', $data['petugas_id'])->where('status_aktif', 1)->first();

        if (!$petugas || $petugas->jabatan !== $config['jabatan']) {
            return response()->json([
                'message' => "Kegiatan ini hanya dapat ditugaskan kepada petugas berjabatan {$config['jabatan']}",
            ], 422);
        }
        if (!DB::table($config['table'])->where($config['pk'], $data['target_id'])->exists()) {
            return response()->json(['message' => 'Kelompok tujuan tidak ditemukan'], 422);
        }

        $existing = DB::table('petugas_penugasan')
            ->where('petugas_id', $data['petugas_id'])
            ->where('tipe_target', $config['tipe'])
            ->where('target_id', $data['target_id'])
            ->first();

        if ($existing) {
            DB::table('petugas_penugasan')->where('penugasan_id', $existing->penugasan_id)->update([
                'tanggal_mulai' => now()->toDateString(),
                'tanggal_selesai' => null,
            ]);
            $id = $existing->penugasan_id;
        } else {
            $id = DB::table('petugas_penugasan')->insertGetId([
                'petugas_id' => $data['petugas_id'],
                'tipe_target' => $config['tipe'],
                'target_id' => $data['target_id'],
                'tanggal_mulai' => now()->toDateString(),
                'created_at' => now(),
            ]);
        }

        return response()->json(['message' => 'Penugasan berhasil disimpan', 'penugasan_id' => $id], 201);
    }

    public function deletePenugasan($id)
    {
        $deleted = DB::table('petugas_penugasan')->where('penugasan_id', $id)->delete();
        return $deleted
            ? response()->json(['message' => 'Penugasan dihapus'])
            : response()->json(['message' => 'Penugasan tidak ditemukan'], 404);
    }
}
