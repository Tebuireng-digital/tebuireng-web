<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\LaporanExport;
use Barryvdh\DomPDF\Facade\Pdf;

class LaporanController extends Controller
{
    public function kehadiran(Request $request)
    {
        $santriId = $request->query('santri_id');
        $periode = $request->query('periode'); // misal: YYYY-MM
        
        $query = DB::table('v_rekap_absensi_harian');
        
        if ($santriId) {
            $query->where('santri_id', $santriId);
        }
        
        if ($periode) {
            $query->where('tanggal', 'like', $periode . '%');
        }

        $data = $query->get();

        if ($request->query('format') === 'xlsx') {
            return Excel::download(new LaporanExport($data), 'laporan-kehadiran.xlsx');
        }
        
        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('exports.laporan', ['data' => $data, 'judul' => 'Laporan Kehadiran']);
            return $pdf->download('laporan-kehadiran.pdf');
        }

        return response()->json($data);
    }

    public function pelanggaran(Request $request)
    {
        $query = DB::table('pelanggaran')
            ->join('santri', 'pelanggaran.santri_id', '=', 'santri.santri_id')
            ->join('kategori_pelanggaran', 'pelanggaran.kategori_pelanggaran_id', '=', 'kategori_pelanggaran.kategori_pelanggaran_id')
            ->select(
                'pelanggaran.*',
                'santri.nama',
                'kategori_pelanggaran.uraian_pelanggaran',
                'kategori_pelanggaran.kategori',
                'kategori_pelanggaran.poin_maks'
            );

        if ($request->filled('dari')) {
            $query->whereDate('pelanggaran.tanggal', '>=', $request->query('dari'));
        }
        if ($request->filled('sampai')) {
            $query->whereDate('pelanggaran.tanggal', '<=', $request->query('sampai'));
        }
            
        $data = $query->get();

        if ($request->query('format') === 'xlsx') {
            return Excel::download(new LaporanExport($data), 'laporan-pelanggaran.xlsx');
        }
        
        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('exports.laporan', ['data' => $data, 'judul' => 'Laporan Pelanggaran']);
            return $pdf->download('laporan-pelanggaran.pdf');
        }

        return response()->json($data);
    }
    
    public function perizinan(Request $request)
    {
        // Simple query for now
        $query = DB::table('perizinan')
            ->join('santri', 'perizinan.santri_id', '=', 'santri.santri_id')
            ->select('perizinan.*', 'santri.nama');
            
        $data = $query->get();

        if ($request->query('format') === 'xlsx') {
            return Excel::download(new LaporanExport($data), 'laporan-perizinan.xlsx');
        }
        
        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('exports.laporan', ['data' => $data, 'judul' => 'Laporan Perizinan']);
            return $pdf->download('laporan-perizinan.pdf');
        }

        return response()->json($data);
    }

    public function bulanan(Request $request)
    {
        $bulan = (int) $request->query('bulan', now()->month);
        $tahun = (int) $request->query('tahun', now()->year);

        $request->merge(['bulan' => $bulan, 'tahun' => $tahun]);
        $request->validate([
            'bulan' => ['integer', 'between:1,12'],
            'tahun' => ['integer', 'between:2020,2100'],
            'kamar_id' => ['nullable', 'integer', 'exists:kamar,kamar_id'],
        ]);

        $query = DB::table('absensi')
            ->join('santri', 'absensi.santri_id', '=', 'santri.santri_id')
            ->join('jenis_kegiatan', 'absensi.jenis_kegiatan_id', '=', 'jenis_kegiatan.jenis_kegiatan_id')
            ->whereMonth('absensi.tanggal', $bulan)
            ->whereYear('absensi.tanggal', $tahun);

        if ($request->filled('kamar_id')) {
            $query->where('santri.kamar_id', $request->integer('kamar_id'));
        }

        $data = $query
            ->select(
                'jenis_kegiatan.kode as jenis_kegiatan',
                DB::raw("SUM(CASE WHEN absensi.status = 'Hadir' THEN 1 ELSE 0 END) as total_hadir"),
                DB::raw("SUM(CASE WHEN absensi.status = 'Izin' THEN 1 ELSE 0 END) as total_izin"),
                DB::raw("SUM(CASE WHEN absensi.status = 'Sakit' THEN 1 ELSE 0 END) as total_sakit"),
                DB::raw("SUM(CASE WHEN absensi.status = 'Alpha' THEN 1 ELSE 0 END) as total_alpha"),
                DB::raw("SUM(CASE WHEN absensi.status = 'Terlambat' THEN 1 ELSE 0 END) as total_terlambat")
            )
            ->groupBy('jenis_kegiatan.kode')
            ->orderBy('jenis_kegiatan.kode')
            ->get()
            ->map(fn ($row) => (object) array_merge((array) $row, [
                'bulan' => $bulan,
                'tahun' => $tahun,
            ]));
        
        if ($request->query('format') === 'xlsx') {
            return Excel::download(new LaporanExport($data), 'laporan-bulanan.xlsx');
        }
        
        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('exports.laporan', ['data' => $data, 'judul' => 'Laporan Bulanan']);
            return $pdf->download('laporan-bulanan.pdf');
        }

        return response()->json($data);
    }
}
