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
        $jenisKegiatan = $request->query('jenis_kegiatan');
        $periode = $request->query('periode'); // misal: YYYY-MM
        
        $query = DB::table('v_rekap_absensi_harian');
        
        if ($santriId) {
            $query->where('santri_id', $santriId);
        }

        if ($jenisKegiatan) {
            $query->where('jenis_kegiatan', $jenisKegiatan);
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
                'judul' => 'Laporan Kehadiran' . ($jenisKegiatan ? ' (' . $jenisKegiatan . ')' : ''),
                'dari' => $request->query('dari'),
                'sampai' => $request->query('sampai'),
                'bulan' => null,
                'tahun' => null
            ]);
            return $pdf->download('laporan-kehadiran.pdf');
        }

        return response()->json($data);
    }

    public function prestasi(Request $request)
    {
        $query = DB::table('prestasi')
            ->join('santri', 'prestasi.santri_id', '=', 'santri.santri_id')
            ->select(
                'prestasi.tanggal',
                'santri.nama as nama_santri',
                'santri.nis',
                'prestasi.nama_prestasi',
                'prestasi.peringkat',
                'prestasi.tingkat',
                'prestasi.keterangan'
            );

        if ($request->filled('dari')) {
            $query->whereDate('prestasi.tanggal', '>=', $request->query('dari'));
        }
        if ($request->filled('sampai')) {
            $query->whereDate('prestasi.tanggal', '<=', $request->query('sampai'));
        }
            
        $data = $query->orderBy('prestasi.tanggal', 'desc')->get();

        if ($request->query('format') === 'xlsx') {
            return Excel::download(new LaporanExport($data), 'laporan-prestasi.xlsx');
        }
        
        if ($request->query('format') === 'pdf') {
            $pdf = Pdf::loadView('exports.laporan', [
                'data' => $data, 
                'judul' => 'Laporan Prestasi Santri',
                'dari' => $request->query('dari'),
                'sampai' => $request->query('sampai'),
                'bulan' => null,
                'tahun' => null
            ]);
            return $pdf->download('laporan-prestasi.pdf');
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
        $dari = $request->query('dari');
        $sampai = $request->query('sampai');
        $bulan = (int) $request->query('bulan', now()->month);
        $tahun = (int) $request->query('tahun', now()->year);

        // 1. Kehadiran Rangkuman per Jenis Kegiatan
        $qAbsensi = DB::table('absensi')
            ->join('jenis_kegiatan', 'absensi.jenis_kegiatan_id', '=', 'jenis_kegiatan.jenis_kegiatan_id');

        if ($dari && $sampai) {
            $qAbsensi->whereDate('absensi.tanggal', '>=', $dari)->whereDate('absensi.tanggal', '<=', $sampai);
        } else {
            $qAbsensi->whereMonth('absensi.tanggal', $bulan)->whereYear('absensi.tanggal', $tahun);
        }

        $kehadiranBreakdown = $qAbsensi
            ->select(
                'jenis_kegiatan.kode as jenis_kegiatan',
                'jenis_kegiatan.nama as nama_kegiatan',
                DB::raw("CAST(SUM(CASE WHEN absensi.status = 'Hadir' THEN 1 ELSE 0 END) AS SIGNED) as total_hadir"),
                DB::raw("CAST(SUM(CASE WHEN absensi.status = 'Izin' THEN 1 ELSE 0 END) AS SIGNED) as total_izin"),
                DB::raw("CAST(SUM(CASE WHEN absensi.status = 'Sakit' THEN 1 ELSE 0 END) AS SIGNED) as total_sakit"),
                DB::raw("CAST(SUM(CASE WHEN absensi.status = 'Alpha' THEN 1 ELSE 0 END) AS SIGNED) as total_alpha"),
                DB::raw("CAST(SUM(CASE WHEN absensi.status = 'Terlambat' THEN 1 ELSE 0 END) AS SIGNED) as total_terlambat")
            )
            ->groupBy('jenis_kegiatan.kode', 'jenis_kegiatan.nama')
            ->get();

        if ($request->query('format') === 'xlsx' || $request->query('format') === 'pdf') {
            // 2. Perizinan Rangkuman
            $qIzin = DB::table('perizinan');
            if ($dari && $sampai) {
                $qIzin->whereDate('tanggal_mulai', '>=', $dari)->whereDate('tanggal_mulai', '<=', $sampai);
            } else {
                $qIzin->whereMonth('tanggal_mulai', $bulan)->whereYear('tanggal_mulai', $tahun);
            }
            $totalIzin = $qIzin->count();

            // 3. Pelanggaran Rangkuman
            $qPelanggaran = DB::table('pelanggaran');
            if ($dari && $sampai) {
                $qPelanggaran->whereDate('tanggal', '>=', $dari)->whereDate('tanggal', '<=', $sampai);
            } else {
                $qPelanggaran->whereMonth('tanggal', $bulan)->whereYear('tanggal', $tahun);
            }
            $totalPelanggaran = $qPelanggaran->count();
            $totalPoin = $qPelanggaran->sum('poin');

            // 4. Prestasi Rangkuman
            $qPrestasi = DB::table('prestasi');
            if ($dari && $sampai) {
                $qPrestasi->whereDate('tanggal', '>=', $dari)->whereDate('tanggal', '<=', $sampai);
            } else {
                $qPrestasi->whereMonth('tanggal', $bulan)->whereYear('tanggal', $tahun);
            }
            $totalPrestasi = $qPrestasi->count();

            // Construct complete Rangkuman Gabungan dataset for PDF/XLSX export
            $summary = [];

            if ($kehadiranBreakdown->count() > 0) {
                foreach ($kehadiranBreakdown as $row) {
                    $summary[] = [
                        'modul' => '4. KEHADIRAN',
                        'kategori_kegiatan' => $row->nama_kegiatan ?? $row->jenis_kegiatan,
                        'ringkasan_statistik' => "Hadir: {$row->total_hadir} | Izin: {$row->total_izin} | Sakit: {$row->total_sakit} | Alpha: {$row->total_alpha} | Terlambat: {$row->total_terlambat}",
                        'total_kasus_catatan' => ($row->total_hadir + $row->total_izin + $row->total_sakit + $row->total_alpha + $row->total_terlambat) . ' Record'
                    ];
                }
            } else {
                $summary[] = [
                    'modul' => '4. KEHADIRAN',
                    'kategori_kegiatan' => 'Semua Kegiatan Absensi',
                    'ringkasan_statistik' => 'Belum ada data absensi',
                    'total_kasus_catatan' => '0 Record'
                ];
            }

            $summary[] = [
                'modul' => '2. PERIZINAN',
                'kategori_kegiatan' => 'Izin Keluar / Pulang Santri',
                'ringkasan_statistik' => 'Total pengajuan perizinan santri yang tercatat',
                'total_kasus_catatan' => $totalIzin . ' Pengajuan'
            ];

            $summary[] = [
                'modul' => '3. PELANGGARAN',
                'kategori_kegiatan' => 'Pelanggaran & Disiplin',
                'ringkasan_statistik' => "Total kasus pelanggaran (Akumulasi poin: {$totalPoin} Poin)",
                'total_kasus_catatan' => $totalPelanggaran . ' Kasus'
            ];

            $summary[] = [
                'modul' => '5. PRESTASI',
                'kategori_kegiatan' => 'Prestasi & Kejuaraan',
                'ringkasan_statistik' => 'Total prestasi dan kejuaraan santri yang diraih',
                'total_kasus_catatan' => $totalPrestasi . ' Prestasi'
            ];

            $summaryData = collect($summary);

            if ($request->query('format') === 'xlsx') {
                return Excel::download(new LaporanExport($summaryData, 'Laporan Rangkuman Gabungan'), 'laporan-rangkuman-gabungan.xlsx');
            }
            
            if ($request->query('format') === 'pdf') {
                $pdf = Pdf::loadView('exports.laporan', [
                    'data' => $summaryData, 
                    'judul' => 'Laporan Rangkuman Gabungan (Kehadiran, Izin, Pelanggaran, & Prestasi)',
                    'dari' => $dari,
                    'sampai' => $sampai,
                    'bulan' => $bulan,
                    'tahun' => $tahun
                ]);
                return $pdf->download('laporan-rangkuman-gabungan.pdf');
            }
        }

        return response()->json($kehadiranBreakdown);
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
