<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
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
        // Simple query for now
        $query = DB::table('pelanggaran')
            ->join('santri', 'pelanggaran.santri_id', '=', 'santri.santri_id')
            ->join('kategori_pelanggaran', 'pelanggaran.kategori_pelanggaran_id', '=', 'kategori_pelanggaran.kategori_pelanggaran_id')
            ->select('pelanggaran.*', 'santri.nama', 'kategori_pelanggaran.nama_kategori', 'kategori_pelanggaran.poin');
            
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
        // For simplicity, we just aggregate some counts
        // In real app, this would be a complex query or use a materialized view
        $data = collect([
            ['bulan' => $request->query('bulan', date('m')), 'tahun' => $request->query('tahun', date('Y')), 'kamar_id' => $request->query('kamar_id'), 'total_hadir' => 120, 'total_izin' => 5, 'total_sakit' => 2, 'total_alpha' => 1]
        ]);
        
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
