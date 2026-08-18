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
        
        if ($request->filled('dari')) {
            $query->whereDate('tanggal', '>=', $request->query('dari'));
        }
        if ($request->filled('sampai')) {
            $query->whereDate('tanggal', '<=', $request->query('sampai'));
        }
        
        if ($periode && !$request->filled('dari') && !$request->filled('sampai')) {
            $query->where('tanggal', 'like', $periode . '%');
        }

        $data = $query->get();

        if ($request->query('format') === 'xlsx') {
            return Excel::download(new LaporanExport($data), 'laporan-kehadiran.xlsx');
        }
        
        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('exports.laporan', [
                'data' => $data, 
                'judul' => 'Laporan Kehadiran',
                'dari' => $request->query('dari'),
                'sampai' => $request->query('sampai'),
                'bulan' => null,
                'tahun' => null
            ]);
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
                'pelanggaran.tanggal',
                'santri.nama as nama_santri',
                'kategori_pelanggaran.uraian_pelanggaran',
                'kategori_pelanggaran.kategori',
                'pelanggaran.poin'
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
            $pdf = Pdf::loadView('exports.laporan', [
                'data' => $data, 
                'judul' => 'Laporan Pelanggaran',
                'dari' => $request->query('dari'),
                'sampai' => $request->query('sampai'),
                'bulan' => null,
                'tahun' => null
            ]);
            return $pdf->download('laporan-pelanggaran.pdf');
        }

        return response()->json($data);
    }
    
    public function perizinan(Request $request)
    {
        $query = DB::table('perizinan')
            ->join('santri', 'perizinan.santri_id', '=', 'santri.santri_id')
            ->select(
                'perizinan.tanggal_mulai',
                'perizinan.tanggal_kembali',
                'santri.nama as nama_santri',
                'perizinan.alasan',
                'perizinan.status'
            );

        if ($request->filled('dari')) {
            $query->whereDate('perizinan.tanggal_mulai', '>=', $request->query('dari'));
        }
        if ($request->filled('sampai')) {
            $query->whereDate('perizinan.tanggal_mulai', '<=', $request->query('sampai'));
        }
            
        $data = $query->get();

        if ($request->query('format') === 'xlsx') {
            return Excel::download(new LaporanExport($data), 'laporan-perizinan.xlsx');
        }
        
        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('exports.laporan', [
                'data' => $data, 
                'judul' => 'Laporan Perizinan',
                'dari' => $request->query('dari'),
                'sampai' => $request->query('sampai'),
                'bulan' => null,
                'tahun' => null
            ]);
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
                'jenis_kegiatan.nama as nama_kegiatan',
                DB::raw("SUM(CASE WHEN absensi.status = 'Hadir' THEN 1 ELSE 0 END) as total_hadir"),
                DB::raw("SUM(CASE WHEN absensi.status = 'Izin' THEN 1 ELSE 0 END) as total_izin"),
                DB::raw("SUM(CASE WHEN absensi.status = 'Sakit' THEN 1 ELSE 0 END) as total_sakit"),
                DB::raw("SUM(CASE WHEN absensi.status = 'Alpha' THEN 1 ELSE 0 END) as total_alpha"),
                DB::raw("SUM(CASE WHEN absensi.status = 'Terlambat' THEN 1 ELSE 0 END) as total_terlambat")
            )
            ->groupBy('jenis_kegiatan.kode', 'jenis_kegiatan.nama')
            ->orderBy('jenis_kegiatan.kode')
            ->get();
        
        if ($request->query('format') === 'xlsx') {
            return Excel::download(new LaporanExport($data), 'laporan-bulanan.xlsx');
        }
        
        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('exports.laporan', [
                'data' => $data, 
                'judul' => 'Laporan Bulanan',
                'dari' => null,
                'sampai' => null,
                'bulan' => $bulan,
                'tahun' => $tahun
            ]);
            return $pdf->download('laporan-bulanan.pdf');
        }

        return response()->json($data);
    }

    public function organisasiDaerah(Request $request)
    {
        $query = DB::table('santri')
            ->leftJoin('organisasi_daerah', 'santri.organisasi_daerah_id', '=', 'organisasi_daerah.organisasi_daerah_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->select(
                'santri.santri_id',
                'santri.nis',
                'santri.nama as nama_santri',
                'unit_pendidikan.kode as unit',
                'kamar.nama as kamar',
                'organisasi_daerah.kode_singkat as kode_orda',
                'organisasi_daerah.nama_organisasi as organisasi_daerah'
            )
            ->where('santri.status_aktif', 1);

        if ($request->filled('organisasi_daerah_id')) {
            $query->where('santri.organisasi_daerah_id', $request->integer('organisasi_daerah_id'));
        }

        $data = $query->orderBy('organisasi_daerah.kode_singkat')->orderBy('santri.nama')->get();

        if ($request->query('format') === 'xlsx') {
            return Excel::download(new LaporanExport($data), 'laporan-organisasi-daerah.xlsx');
        }

        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('exports.laporan', ['data' => $data, 'judul' => 'Laporan Santri per Organisasi Daerah']);
            return $pdf->download('laporan-organisasi-daerah.pdf');
        }

        return response()->json($data);
    }
}
