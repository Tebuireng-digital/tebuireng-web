<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use App\Models\Perizinan;
use App\Events\PerizinanDisetujui;

class PerizinanController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('perizinan')
            ->join('santri', 'perizinan.santri_id', '=', 'santri.santri_id')
            ->select('perizinan.*', 'santri.nama as nama_santri', 'santri.nis');

        if ($request->has('status')) {
            $statuses = explode(',', $request->status);
            $query->whereIn('perizinan.status', $statuses);
        }

        $query->orderBy('perizinan.created_at', 'desc');

        return response()->json($query->get());
    }

    public function jenis()
    {
        return response()->json(DB::table('jenis_izin')->orderBy('nama')->get());
    }

    public function getSantriPerizinan(Request $request, $santriId)
    {
        if (!in_array($request->user()->jabatan, ['Admin', 'Pengasuh', 'Keamanan'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json(DB::table('perizinan')
            ->join('jenis_izin', 'perizinan.jenis_izin_id', '=', 'jenis_izin.jenis_izin_id')
            ->where('perizinan.santri_id', $santriId)
            ->orderByDesc('perizinan.created_at')
            ->select('perizinan.*', 'jenis_izin.nama as jenis_izin')
            ->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'santri_id' => 'required|integer|exists:santri,santri_id',
            'jenis_izin_id' => 'required|integer',
            'keperluan' => 'required|string|max:255',
            'tanggal_mulai' => 'required|date',
            'rencana_kembali' => 'required|date|after_or_equal:tanggal_mulai',
        ]);

        $petugas = Auth::user();
        
        $model = new Perizinan();
        $model->santri_id = $data['santri_id'];
        if (Gate::forUser($petugas)->denies('create', $model)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $jenisIzin = DB::table('jenis_izin')->where('jenis_izin_id', $data['jenis_izin_id'])->first();
        if (!$jenisIzin) {
            return response()->json(['message' => 'Jenis izin tidak ditemukan'], 404);
        }

        $bentrok = DB::table('perizinan')
            ->where('santri_id', $data['santri_id'])
            ->whereIn('status', ['Disetujui', 'Sedang Berjalan'])
            ->where('tanggal_mulai', '<=', $data['rencana_kembali'])
            ->where('rencana_kembali', '>=', $data['tanggal_mulai'])
            ->exists();
        if ($bentrok) {
            return response()->json(['message' => 'Santri masih memiliki izin aktif pada rentang tersebut'], 422);
        }

        $perizinanId = DB::transaction(function () use ($data, $petugas) {
            $data['status'] = 'Disetujui';
            $data['diajukan_oleh'] = $petugas->petugas_id;
            $data['created_at'] = now();
            $data['updated_at'] = now();

            return DB::table('perizinan')->insertGetId($data);
        });

        event(new PerizinanDisetujui($perizinanId));

        return response()->json([
            'message' => 'Perizinan disetujui dan absensi izin telah dibuat',
            'perizinan_id' => $perizinanId,
        ], 201);
    }

    public function gerbang(Request $request, $id)
    {
        $data = $request->validate([
            'waktu_keluar_aktual' => 'nullable|date',
            'waktu_masuk_aktual' => 'nullable|date',
        ]);

        $petugas = Auth::user();
        if ($petugas->jabatan !== 'Keamanan' && $petugas->jabatan !== 'Admin') {
            return response()->json(['message' => 'Hanya Keamanan yang dapat mengisi data gerbang'], 403);
        }

        $perizinan = DB::table('perizinan')->where('perizinan_id', $id)->first();
        if (!$perizinan || !in_array($perizinan->status, ['Disetujui', 'Sedang Berjalan'])) {
            return response()->json(['message' => 'Perizinan belum disetujui atau sudah selesai'], 400);
        }

        $update = [];
        if (isset($data['waktu_keluar_aktual']) && !$perizinan->waktu_keluar_aktual) {
            $update['waktu_keluar_aktual'] = \Carbon\Carbon::parse($data['waktu_keluar_aktual'])->toDateTimeString();
            $update['status'] = 'Sedang Berjalan';
            $update['dicatat_keamanan_oleh'] = $petugas->petugas_id;
        }

        $isKembali = false;
        if (isset($data['waktu_masuk_aktual']) && !$perizinan->waktu_masuk_aktual) {
            $update['waktu_masuk_aktual'] = \Carbon\Carbon::parse($data['waktu_masuk_aktual'])->toDateTimeString();
            $update['status'] = 'Selesai';
            $isKembali = true;
            // Cek keterlambatan, tapi prd blm detil, cukup status = Selesai
            if (!$perizinan->dicatat_keamanan_oleh) {
                $update['dicatat_keamanan_oleh'] = $petugas->petugas_id;
            }
        }

        if (!empty($update)) {
            DB::table('perizinan')->where('perizinan_id', $id)->update($update);
            if ($isKembali) {
                $this->sendIzinBalikWaNotification($id);
            }
            return response()->json(['message' => 'Data gerbang berhasil disimpan']);
        }

        return response()->json(['message' => 'Tidak ada perubahan data gerbang'], 400);
    }

    protected function sendIzinBalikWaNotification(int $perizinanId): void
    {
        $perizinan = DB::table('perizinan')
            ->join('santri', 'perizinan.santri_id', '=', 'santri.santri_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->join('jenis_izin', 'perizinan.jenis_izin_id', '=', 'jenis_izin.jenis_izin_id')
            ->where('perizinan.perizinan_id', $perizinanId)
            ->select(
                'perizinan.*',
                'santri.nama as nama_santri',
                'santri.nis',
                'santri.nama_wali',
                'santri.no_hp_wali',
                'kamar.nama as nama_kamar',
                'jenis_izin.nama as nama_jenis_izin'
            )
            ->first();

        if (!$perizinan || empty($perizinan->no_hp_wali) || !$perizinan->waktu_masuk_aktual) {
            return;
        }

        \Carbon\Carbon::setLocale('id');
        $waktuMasuk = \Carbon\Carbon::parse($perizinan->waktu_masuk_aktual)->locale('id')->isoFormat('D MMMM YYYY, HH:mm') . ' WIB';
        $namaWali = $perizinan->nama_wali ? "Bapak/Ibu {$perizinan->nama_wali}" : "Bapak/Ibu Wali Santri";

        $message = "ASSALAMU'ALAIKUM WR. WB.\n\n"
            . "Yth. {$namaWali} dari:\n"
            . "Nama: {$perizinan->nama_santri} (NIS: {$perizinan->nis})\n"
            . "Kamar: " . ($perizinan->nama_kamar ?? '-') . "\n\n"
            . "Memberitahukan bahwa santri telah *KEMBALI / BALIK* ke Pondok Pesantren Tebuireng:\n"
            . "Jenis Izin: {$perizinan->nama_jenis_izin}\n"
            . "Waktu Kembali: {$waktuMasuk}\n\n"
            . "Terima kasih atas kerja samanya dalam memantau kedisiplinan santri.\n\n"
            . "--\nPondok Pesantren Tebuireng";

        try {
            app(\App\Services\WhatsAppService::class)->sendMessage(
                $perizinan->no_hp_wali,
                $message,
                (int) $perizinan->santri_id,
                'perizinan_kembali',
                (int) $perizinan->perizinan_id
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Gagal mengirim WA Izin Balik: " . $e->getMessage());
        }
    }

    public function koreksiGerbang(Request $request, $id)
    {
        $data = $request->validate([
            'waktu_keluar_aktual' => 'nullable|date',
            'waktu_masuk_aktual' => 'nullable|date|after_or_equal:waktu_keluar_aktual',
            'alasan_koreksi' => 'nullable|string|max:255',
        ]);

        $petugas = Auth::user();
        if (!in_array($petugas->jabatan, ['Keamanan', 'Admin'], true)) {
            return response()->json(['message' => 'Hanya Keamanan atau Admin yang dapat mengoreksi data gerbang'], 403);
        }

        $perizinan = DB::table('perizinan')->where('perizinan_id', $id)->first();
        if (!$perizinan) {
            return response()->json(['message' => 'Data perizinan tidak ditemukan'], 404);
        }

        if (!array_key_exists('waktu_keluar_aktual', $data) && !array_key_exists('waktu_masuk_aktual', $data)) {
            return response()->json(['message' => 'Isi setidaknya satu waktu yang ingin dikoreksi'], 422);
        }

        $waktuKeluar = array_key_exists('waktu_keluar_aktual', $data)
            ? ($data['waktu_keluar_aktual'] ? \Carbon\Carbon::parse($data['waktu_keluar_aktual'])->toDateTimeString() : null)
            : $perizinan->waktu_keluar_aktual;
        $waktuMasuk = array_key_exists('waktu_masuk_aktual', $data)
            ? ($data['waktu_masuk_aktual'] ? \Carbon\Carbon::parse($data['waktu_masuk_aktual'])->toDateTimeString() : null)
            : $perizinan->waktu_masuk_aktual;

        if ($waktuKeluar && $waktuMasuk && \Carbon\Carbon::parse($waktuMasuk)->lt(\Carbon\Carbon::parse($waktuKeluar))) {
            return response()->json(['message' => 'Waktu kembali tidak boleh lebih awal dari waktu keluar'], 422);
        }

        if (!$waktuKeluar && $waktuMasuk) {
            return response()->json(['message' => 'Waktu keluar harus diisi sebelum waktu kembali'], 422);
        }

        $status = $waktuMasuk ? 'Selesai' : ($waktuKeluar ? 'Sedang Berjalan' : 'Disetujui');

        DB::transaction(function () use ($perizinan, $id, $waktuKeluar, $waktuMasuk, $status, $petugas, $data) {
            DB::table('perizinan_gerbang_koreksi')->insert([
                'perizinan_id' => $id,
                'waktu_keluar_sebelum' => $perizinan->waktu_keluar_aktual,
                'waktu_masuk_sebelum' => $perizinan->waktu_masuk_aktual,
                'waktu_keluar_sesudah' => $waktuKeluar,
                'waktu_masuk_sesudah' => $waktuMasuk,
                'status_sebelum' => $perizinan->status,
                'status_sesudah' => $status,
                'dikoreksi_oleh' => $petugas->petugas_id,
                'alasan_koreksi' => $data['alasan_koreksi'] ?? null,
                'created_at' => now(),
            ]);

            DB::table('perizinan')->where('perizinan_id', $id)->update([
                'waktu_keluar_aktual' => $waktuKeluar,
                'waktu_masuk_aktual' => $waktuMasuk,
                'status' => $status,
                'dicatat_keamanan_oleh' => $petugas->petugas_id,
                'updated_at' => now(),
            ]);
        });

        return response()->json(['message' => 'Waktu gerbang berhasil dikoreksi']);
    }

    public function downloadPdf($id)
    {
        $perizinan = DB::table('perizinan')
            ->join('santri', 'perizinan.santri_id', '=', 'santri.santri_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->join('jenis_izin', 'perizinan.jenis_izin_id', '=', 'jenis_izin.jenis_izin_id')
            ->leftJoin('petugas as pengaju', 'perizinan.diajukan_oleh', '=', 'pengaju.petugas_id')
            ->leftJoin('petugas as keamanan_petugas', 'perizinan.dicatat_keamanan_oleh', '=', 'keamanan_petugas.petugas_id')
            ->select(
                'perizinan.*',
                'santri.nama as nama_santri',
                'santri.nis',
                'kamar.nama as nama_kamar',
                'jenis_izin.nama as nama_jenis_izin',
                'pengaju.nama as nama_pengaju',
                'keamanan_petugas.nama as nama_keamanan'
            )
            ->where('perizinan.perizinan_id', $id)
            ->first();

        if (!$perizinan) {
            return response()->json(['message' => 'Data perizinan tidak ditemukan'], 404);
        }

        \Carbon\Carbon::setLocale('id');

        // Dynamic Title and Labels
        $namaJenis = strtolower($perizinan->nama_jenis_izin);
        $title = 'SURAT IZIN';
        $labelKeluar = 'Waktu Keluar';
        $labelMasuk = 'Harus Kembali';

        if (str_contains($namaJenis, 'pulang')) {
            $title = 'SURAT IZIN PULANG';
            $labelKeluar = 'Waktu Pulang';
            $labelMasuk = 'Harus Kembali';
        } elseif (str_contains($namaJenis, 'sakit')) {
            $title = 'SURAT IZIN SAKIT';
            $labelKeluar = 'Mulai Izin Sakit';
            $labelMasuk = 'Harus Kembali';
        } elseif (str_contains($namaJenis, 'keluar')) {
            $title = 'SURAT IZIN KELUAR KOMPLEK';
            $labelKeluar = 'Waktu Keluar';
            $labelMasuk = 'Harus Kembali';
        }

        $waktuKeluarStr = \Carbon\Carbon::parse($perizinan->tanggal_mulai)->locale('id')->isoFormat('D MMMM YYYY, HH:mm') . ' WIB';
        $waktuMasukStr = \Carbon\Carbon::parse($perizinan->rencana_kembali)->locale('id')->isoFormat('D MMMM YYYY, HH:mm') . ' WIB';

        // QR Code Data
        $qrData = "Nama: " . $perizinan->nama_santri . "\n"
                . "Keluar: " . $waktuKeluarStr . "\n"
                . "Masuk: " . $waktuMasukStr;
        
        $qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" . urlencode($qrData);

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.surat_izin', compact(
            'perizinan', 
            'title', 
            'labelKeluar', 
            'labelMasuk', 
            'waktuKeluarStr', 
            'waktuMasukStr', 
            'qrCodeUrl'
        ));
        
        $filename = 'Surat_Izin_' . str_replace(' ', '_', $perizinan->nama_santri) . '.pdf';
        return $pdf->download($filename);
    }
}
