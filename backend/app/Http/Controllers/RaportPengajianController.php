<?php

namespace App\Http\Controllers;

use App\Support\KamarName;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;

class RaportPengajianController extends Controller
{
    /** Aspek penilaian fixed sesuai contoh raport. */
    private const ASPEK_AL_QURAN = ['Fashohah', 'Tajwid', 'Kelancaran', 'Hafalan'];
    private const ASPEK_TAKHASSUS = ['Ujian Tulis', 'Ujian Lisan', 'Nahwu', 'Shorof', 'Murod'];
    private const JENIS_KEPRIBADIAN = ['Kelakuan', 'Kedisiplinan', 'Kerajinan'];

    private const PREDIKAT_MAP = [
        [90, 100, 'Sangat Memuaskan'],
        [80, 89, 'Memuaskan'],
        [70, 79, 'Baik'],
        [60, 69, 'Cukup'],
        [50, 59, 'Kurang'],
        [0, 49, 'Sangat Kurang'],
    ];

    private const KEPRIBADIAN_MAP = [
        'A' => 'Sangat Baik',
        'B' => 'Baik',
        'C' => 'Cukup',
        'D' => 'Kurang',
        'E' => 'Sangat Kurang',
    ];

    /**
     * Daftar kelompok PBS/PBM yang bisa diakses petugas.
     */
    public function options(Request $request)
    {
        $petugas = $request->user();
        $result = [];

        // PBS (Al-Qur'an)
        $pbsQuery = DB::table('kelompok_pbs')
            ->select('kelompok_pbs_id as target_id', 'nama_kelompok as nama_target', 'kategori');
        if ($petugas->jabatan !== 'Admin') {
            $assignedIds = $this->getAssignedIds($petugas, 'KelompokPBS');
            $pbsQuery->whereIn('kelompok_pbs_id', $assignedIds);
        }
        $pbsTargets = $pbsQuery->orderBy('kategori')->orderBy('nama_kelompok')->get();

        if ($pbsTargets->isNotEmpty() || $petugas->jabatan === 'Admin') {
            $result[] = [
                'jenis' => 'AL_QURAN',
                'nama' => 'Pengajian Al-Qur\'an',
                'aspek' => self::ASPEK_AL_QURAN,
                'targets' => $pbsTargets,
            ];
        }

        // PBM (Takhassus)
        $pbmQuery = DB::table('kelompok_pbm')
            ->select('kelompok_pbm_id as target_id', 'nama_kelompok as nama_target');
        if ($petugas->jabatan !== 'Admin') {
            $assignedIds = $this->getAssignedIds($petugas, 'KelompokPBM');
            $pbmQuery->whereIn('kelompok_pbm_id', $assignedIds);
        }
        $pbmTargets = $pbmQuery->orderBy('nama_kelompok')->get();

        if ($pbmTargets->isNotEmpty() || $petugas->jabatan === 'Admin') {
            $result[] = [
                'jenis' => 'TAKHASSUS',
                'nama' => 'Pengajian Takhassus',
                'aspek' => self::ASPEK_TAKHASSUS,
                'targets' => $pbmTargets,
            ];
        }

        return response()->json($result);
    }

    /**
     * Load data santri + nilai existing untuk satu kelompok + bulan/tahun.
     */
    public function session(Request $request)
    {
        $data = $request->validate([
            'jenis' => 'required|in:AL_QURAN,TAKHASSUS',
            'target_id' => 'required|integer',
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        $petugas = $request->user();
        $jenis = $data['jenis'];
        $targetId = $data['target_id'];

        if ($jenis === 'AL_QURAN') {
            $santriColumn = 'kelompok_pbs_id';
            $tipeTarget = 'KelompokPBS';
            $targetTable = 'kelompok_pbs';
            $targetPk = 'kelompok_pbs_id';
            $targetLabel = 'nama_kelompok';
            $raportFk = 'kelompok_pbs_id';
            $aspekList = self::ASPEK_AL_QURAN;
        } else {
            $santriColumn = 'kelompok_pbm_id';
            $tipeTarget = 'KelompokPBM';
            $targetTable = 'kelompok_pbm';
            $targetPk = 'kelompok_pbm_id';
            $targetLabel = 'nama_kelompok';
            $raportFk = 'kelompok_pbm_id';
            $aspekList = self::ASPEK_TAKHASSUS;
        }

        // Cek akses
        if ($petugas->jabatan !== 'Admin' && !$petugas->hasAccess($tipeTarget, $targetId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kelompok ini'], 403);
        }

        $target = DB::table($targetTable)->where($targetPk, $targetId)->first();
        if (!$target) {
            return response()->json(['message' => 'Kelompok tidak ditemukan'], 404);
        }

        // Dapatkan santri dalam kelompok
        $santriList = DB::table('santri')
            ->where($santriColumn, $targetId)
            ->where('status_aktif', 1)
            ->orderBy('nama')
            ->get(['santri_id', 'nis', 'nama']);

        // Load existing raport & nilai untuk bulan/tahun ini
        $existingRaports = DB::table('raport_pengajian')
            ->whereIn('santri_id', $santriList->pluck('santri_id'))
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->get()
            ->keyBy('santri_id');

        $raportIds = $existingRaports->pluck('raport_id');

        $existingNilai = DB::table('raport_nilai')
            ->whereIn('raport_id', $raportIds)
            ->where('jenis_pengajian', $jenis)
            ->get()
            ->groupBy('raport_id');

        $existingKepribadian = DB::table('raport_kepribadian')
            ->whereIn('raport_id', $raportIds)
            ->get()
            ->groupBy('raport_id');

        // Susun data per santri
        $santriData = $santriList->map(function ($santri) use ($existingRaports, $existingNilai, $existingKepribadian, $aspekList, $jenis) {
            $raport = $existingRaports->get($santri->santri_id);
            $nilai = [];
            $kepribadian = [];

            if ($raport) {
                $nilaiRows = $existingNilai->get($raport->raport_id, collect());
                foreach ($nilaiRows as $row) {
                    $nilai[$row->aspek] = $row->nilai_angka;
                }

                $kepribadianRows = $existingKepribadian->get($raport->raport_id, collect());
                foreach ($kepribadianRows as $row) {
                    $kepribadian[$row->jenis] = $row->nilai;
                }
            }

            $keputusanField = $jenis === 'AL_QURAN' ? 'keputusan_pbs' : 'keputusan_pbm';

            return [
                'santri_id' => $santri->santri_id,
                'nis' => $santri->nis,
                'nama' => $santri->nama,
                'nilai' => $nilai,
                'kepribadian' => $kepribadian,
                'keputusan' => $raport?->$keputusanField ?? null,
                'predikat_umum' => $raport?->predikat_umum ?? null,
                'raport_id' => $raport?->raport_id ?? null,
            ];
        });

        return response()->json([
            'jenis' => $jenis,
            'nama_kelompok' => $target->$targetLabel,
            'target_id' => $targetId,
            'bulan' => (int) $data['bulan'],
            'tahun' => (int) $data['tahun'],
            'aspek' => $aspekList,
            'kepribadian_jenis' => self::JENIS_KEPRIBADIAN,
            'santri' => $santriData,
        ]);
    }

    /**
     * Simpan/update nilai bulk per kelompok.
     */
    public function bulkUpsert(Request $request)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Ustadz'], true)) {
            return response()->json(['message' => 'Hanya Admin dan Ustadz yang dapat menginput raport'], 403);
        }

        $data = $request->validate([
            'jenis' => 'required|in:AL_QURAN,TAKHASSUS',
            'target_id' => 'required|integer',
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
            'tahun_pelajaran' => 'required|string|max:20',
            'semester' => 'required|in:Ganjil,Genap',
            'entries' => 'required|array|min:1',
            'entries.*.santri_id' => 'required|integer|exists:santri,santri_id',
            'entries.*.nilai' => 'required|array',
            'entries.*.nilai.*' => 'nullable|integer|between:0,100',
            'entries.*.kepribadian' => 'nullable|array',
            'entries.*.kepribadian.*' => 'nullable|in:A,B,C,D,E',
            'entries.*.keputusan' => 'nullable|in:Naik,Tidak Naik',
            'entries.*.predikat_umum' => 'nullable|string|max:50',
        ]);

        $jenis = $data['jenis'];
        $targetId = $data['target_id'];

        if ($jenis === 'AL_QURAN') {
            $tipeTarget = 'KelompokPBS';
            $raportFk = 'kelompok_pbs_id';
            $aspekList = self::ASPEK_AL_QURAN;
        } else {
            $tipeTarget = 'KelompokPBM';
            $raportFk = 'kelompok_pbm_id';
            $aspekList = self::ASPEK_TAKHASSUS;
        }

        // Cek akses
        if ($petugas->jabatan !== 'Admin' && !$petugas->hasAccess($tipeTarget, $targetId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kelompok ini'], 403);
        }

        $keputusanField = $jenis === 'AL_QURAN' ? 'keputusan_pbs' : 'keputusan_pbm';
        $now = now();

        DB::transaction(function () use ($data, $jenis, $targetId, $raportFk, $aspekList, $keputusanField, $petugas, $now) {
            foreach ($data['entries'] as $entry) {
                $santriId = $entry['santri_id'];

                // Upsert raport_pengajian
                $existing = DB::table('raport_pengajian')
                    ->where('santri_id', $santriId)
                    ->where('bulan', $data['bulan'])
                    ->where('tahun', $data['tahun'])
                    ->first();

                $raportData = [
                    'tahun_pelajaran' => $data['tahun_pelajaran'],
                    'semester' => $data['semester'],
                    $raportFk => $targetId,
                    $keputusanField => $entry['keputusan'] ?? null,
                    'predikat_umum' => $entry['predikat_umum'] ?? null,
                    'diisi_oleh' => $petugas->petugas_id,
                    'updated_at' => $now,
                ];

                if ($existing) {
                    DB::table('raport_pengajian')
                        ->where('raport_id', $existing->raport_id)
                        ->update($raportData);
                    $raportId = $existing->raport_id;
                } else {
                    $raportData['santri_id'] = $santriId;
                    $raportData['bulan'] = $data['bulan'];
                    $raportData['tahun'] = $data['tahun'];
                    $raportData['created_at'] = $now;
                    $raportId = DB::table('raport_pengajian')->insertGetId($raportData);
                }

                // Upsert raport_nilai
                foreach ($aspekList as $aspek) {
                    $nilaiAngka = $entry['nilai'][$aspek] ?? null;
                    if ($nilaiAngka !== null) {
                        DB::table('raport_nilai')->updateOrInsert(
                            [
                                'raport_id' => $raportId,
                                'jenis_pengajian' => $jenis,
                                'aspek' => $aspek,
                            ],
                            ['nilai_angka' => $nilaiAngka]
                        );
                    }
                }

                // Upsert raport_kepribadian
                foreach (self::JENIS_KEPRIBADIAN as $jenisK) {
                    $nilaiK = $entry['kepribadian'][$jenisK] ?? null;
                    if ($nilaiK !== null) {
                        DB::table('raport_kepribadian')->updateOrInsert(
                            [
                                'raport_id' => $raportId,
                                'jenis' => $jenisK,
                            ],
                            ['nilai' => $nilaiK]
                        );
                    }
                }
            }
        });

        return response()->json([
            'message' => 'Raport pengajian berhasil disimpan',
            'jumlah' => count($data['entries']),
        ]);
    }

    /**
     * Lihat raport individual santri.
     */
    public function show(Request $request, $santriId)
    {
        $data = $request->validate([
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        $santri = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->where('santri.santri_id', $santriId)
            ->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')
            ->first();

        if (!$santri) {
            return response()->json(['message' => 'Santri tidak ditemukan'], 404);
        }

        $raport = DB::table('raport_pengajian')
            ->where('santri_id', $santriId)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->first();

        if (!$raport) {
            return response()->json(['message' => 'Raport belum diisi untuk periode ini'], 404);
        }

        $result = $this->buildRaportData($raport, $santri);

        return response()->json($result);
    }

    /**
     * Download PDF raport individual.
     */
    public function downloadPdf(Request $request, $santriId)
    {
        $data = $request->validate([
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        $santri = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->where('santri.santri_id', $santriId)
            ->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')
            ->first();

        if (!$santri) {
            return response()->json(['message' => 'Santri tidak ditemukan'], 404);
        }

        $raport = DB::table('raport_pengajian')
            ->where('santri_id', $santriId)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->first();

        if (!$raport) {
            return response()->json(['message' => 'Raport belum diisi untuk periode ini'], 404);
        }

        $raportData = $this->buildRaportData($raport, $santri);

        Carbon::setLocale('id');

        $pdf = Pdf::loadView('pdf.raport_pengajian', [
            'data' => $raportData,
            'predikatMap' => self::PREDIKAT_MAP,
            'kepribadianMap' => self::KEPRIBADIAN_MAP,
        ]);

        $pdf->setPaper('A4', 'portrait');

        $filename = 'Raport_Pengajian_' . str_replace(' ', '_', $santri->nama) . '_' . $data['bulan'] . '_' . $data['tahun'] . '.pdf';
        return $pdf->download($filename);
    }

    /**
     * Download PDF bulk seluruh kelompok.
     */
    public function downloadPdfBulk(Request $request, $jenis, $kelompokId)
    {
        $data = $request->validate([
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        if (!in_array($jenis, ['AL_QURAN', 'TAKHASSUS'], true)) {
            return response()->json(['message' => 'Jenis pengajian tidak valid'], 422);
        }

        $santriColumn = $jenis === 'AL_QURAN' ? 'kelompok_pbs_id' : 'kelompok_pbm_id';

        $santriList = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->where('santri.' . $santriColumn, $kelompokId)
            ->where('santri.status_aktif', 1)
            ->orderBy('santri.nama')
            ->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')
            ->get();

        if ($santriList->isEmpty()) {
            return response()->json(['message' => 'Tidak ada santri dalam kelompok ini'], 404);
        }

        Carbon::setLocale('id');
        $allPages = [];

        foreach ($santriList as $santri) {
            $raport = DB::table('raport_pengajian')
                ->where('santri_id', $santri->santri_id)
                ->where('bulan', $data['bulan'])
                ->where('tahun', $data['tahun'])
                ->first();

            if ($raport) {
                $allPages[] = $this->buildRaportData($raport, $santri);
            }
        }

        if (empty($allPages)) {
            return response()->json(['message' => 'Belum ada raport yang diisi untuk periode ini'], 404);
        }

        $pdf = Pdf::loadView('pdf.raport_pengajian_bulk', [
            'allPages' => $allPages,
            'predikatMap' => self::PREDIKAT_MAP,
            'kepribadianMap' => self::KEPRIBADIAN_MAP,
        ]);

        $pdf->setPaper('A4', 'portrait');

        $filename = 'Raport_Pengajian_Bulk_' . $jenis . '_' . $data['bulan'] . '_' . $data['tahun'] . '.pdf';
        return $pdf->download($filename);
    }

    /**
     * Rekap semester (agregasi dari data bulanan).
     */
    public function rekapSemester(Request $request)
    {
        $data = $request->validate([
            'tahun_pelajaran' => 'required|string|max:20',
            'semester' => 'required|in:Ganjil,Genap',
        ]);

        $raports = DB::table('raport_pengajian')
            ->join('santri', 'raport_pengajian.santri_id', '=', 'santri.santri_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->where('raport_pengajian.tahun_pelajaran', $data['tahun_pelajaran'])
            ->where('raport_pengajian.semester', $data['semester'])
            ->select(
                'raport_pengajian.raport_id',
                'raport_pengajian.santri_id',
                'raport_pengajian.bulan',
                'raport_pengajian.tahun',
                'santri.nama as nama_santri',
                'santri.nis',
                'kamar.nama as nama_kamar',
                'raport_pengajian.keputusan_pbs',
                'raport_pengajian.keputusan_pbm'
            )
            ->orderBy('santri.nama')
            ->orderBy('raport_pengajian.bulan')
            ->get();

        // Hitung rata-rata per santri per jenis
        $raportIds = $raports->pluck('raport_id');
        $nilaiAll = DB::table('raport_nilai')
            ->whereIn('raport_id', $raportIds)
            ->get()
            ->groupBy('raport_id');

        $result = $raports->map(function ($r) use ($nilaiAll) {
            $nilaiRows = $nilaiAll->get($r->raport_id, collect());
            $avgPbs = $nilaiRows->where('jenis_pengajian', 'AL_QURAN')->avg('nilai_angka');
            $avgPbm = $nilaiRows->where('jenis_pengajian', 'TAKHASSUS')->avg('nilai_angka');

            return [
                'santri_id' => $r->santri_id,
                'nama_santri' => $r->nama_santri,
                'nis' => $r->nis,
                'nama_kamar' => $r->nama_kamar,
                'bulan' => $r->bulan,
                'tahun' => $r->tahun,
                'rata_rata_al_quran' => $avgPbs ? round($avgPbs, 1) : null,
                'rata_rata_takhassus' => $avgPbm ? round($avgPbm, 1) : null,
                'keputusan_pbs' => $r->keputusan_pbs,
                'keputusan_pbm' => $r->keputusan_pbm,
            ];
        });

        return response()->json($result);
    }

    // ─── Helper Methods ─────────────────────────────────────────────

    private function getAssignedIds($petugas, string $tipeTarget): \Illuminate\Support\Collection
    {
        return DB::table('petugas_penugasan')
            ->where('petugas_id', $petugas->petugas_id)
            ->where('tipe_target', $tipeTarget)
            ->where('tanggal_mulai', '<=', now()->toDateString())
            ->where(function ($q) {
                $q->whereNull('tanggal_selesai')
                    ->orWhere('tanggal_selesai', '>=', now()->toDateString());
            })
            ->pluck('target_id');
    }

    private function buildRaportData($raport, $santri): array
    {
        $nilai = DB::table('raport_nilai')
            ->where('raport_id', $raport->raport_id)
            ->get();

        $kepribadian = DB::table('raport_kepribadian')
            ->where('raport_id', $raport->raport_id)
            ->get();

        // --- Al-Qur'an ---
        $nilaiPbs = $nilai->where('jenis_pengajian', 'AL_QURAN');
        $pbsData = [];
        foreach (self::ASPEK_AL_QURAN as $aspek) {
            $row = $nilaiPbs->firstWhere('aspek', $aspek);
            $angka = $row ? $row->nilai_angka : null;
            $rataKelompok = null;

            if ($raport->kelompok_pbs_id && $angka !== null) {
                $rataKelompok = $this->getRataKelompok(
                    'AL_QURAN', $aspek, $raport->kelompok_pbs_id,
                    'kelompok_pbs_id', $raport->bulan, $raport->tahun
                );
            }

            $pbsData[] = [
                'aspek' => $aspek,
                'nilai_angka' => $angka,
                'predikat' => $angka !== null ? $this->getPredikat($angka) : null,
                'rata_rata_kelompok' => $rataKelompok,
            ];
        }

        $totalPbs = $nilaiPbs->sum('nilai_angka');
        $countPbs = $nilaiPbs->count();
        $rataRataPbs = $countPbs > 0 ? round($totalPbs / $countPbs, 1) : null;

        $peringkatPbs = null;
        $dariPbs = null;
        if ($raport->kelompok_pbs_id && $rataRataPbs !== null) {
            [$peringkatPbs, $dariPbs] = $this->getPeringkat(
                'AL_QURAN', $raport->kelompok_pbs_id,
                'kelompok_pbs_id', $raport->bulan, $raport->tahun, $raport->santri_id
            );
        }

        // --- Takhassus ---
        $nilaiPbm = $nilai->where('jenis_pengajian', 'TAKHASSUS');
        $pbmData = [];
        foreach (self::ASPEK_TAKHASSUS as $aspek) {
            $row = $nilaiPbm->firstWhere('aspek', $aspek);
            $angka = $row ? $row->nilai_angka : null;
            $rataKelompok = null;

            if ($raport->kelompok_pbm_id && $angka !== null) {
                $rataKelompok = $this->getRataKelompok(
                    'TAKHASSUS', $aspek, $raport->kelompok_pbm_id,
                    'kelompok_pbm_id', $raport->bulan, $raport->tahun
                );
            }

            $pbmData[] = [
                'aspek' => $aspek,
                'nilai_angka' => $angka,
                'predikat' => $angka !== null ? $this->getPredikat($angka) : null,
                'rata_rata_kelompok' => $rataKelompok,
            ];
        }

        $totalPbm = $nilaiPbm->sum('nilai_angka');
        $countPbm = $nilaiPbm->count();
        $rataRataPbm = $countPbm > 0 ? round($totalPbm / $countPbm, 1) : null;

        $peringkatPbm = null;
        $dariPbm = null;
        if ($raport->kelompok_pbm_id && $rataRataPbm !== null) {
            [$peringkatPbm, $dariPbm] = $this->getPeringkat(
                'TAKHASSUS', $raport->kelompok_pbm_id,
                'kelompok_pbm_id', $raport->bulan, $raport->tahun, $raport->santri_id
            );
        }

        // --- Kepribadian ---
        $kepribadianData = [];
        foreach (self::JENIS_KEPRIBADIAN as $jenis) {
            $row = $kepribadian->firstWhere('jenis', $jenis);
            $kepribadianData[] = [
                'jenis' => $jenis,
                'nilai' => $row?->nilai ?? null,
                'keterangan' => $row ? (self::KEPRIBADIAN_MAP[$row->nilai] ?? null) : null,
            ];
        }

        // Nama kamar standar
        $namaKamar = $santri->nama_kamar ?? null;
        if ($namaKamar) {
            $namaKamar = KamarName::parse($namaKamar)['standar'];
        }

        // Nama kelompok PBS
        $namaKelompokPbs = null;
        if ($raport->kelompok_pbs_id) {
            $namaKelompokPbs = DB::table('kelompok_pbs')
                ->where('kelompok_pbs_id', $raport->kelompok_pbs_id)
                ->value('nama_kelompok');
        }

        // Nama kelompok PBM
        $namaKelompokPbm = null;
        if ($raport->kelompok_pbm_id) {
            $namaKelompokPbm = DB::table('kelompok_pbm')
                ->where('kelompok_pbm_id', $raport->kelompok_pbm_id)
                ->value('nama_kelompok');
        }

        return [
            'raport_id' => $raport->raport_id,
            'santri' => [
                'santri_id' => $santri->santri_id,
                'nis' => $santri->nis,
                'nama' => $santri->nama,
                'nama_kamar' => $namaKamar,
                'nama_kelas' => $santri->nama_kelas ?? null,
                'tingkat' => $santri->tingkat ?? null,
            ],
            'bulan' => $raport->bulan,
            'tahun' => $raport->tahun,
            'tahun_pelajaran' => $raport->tahun_pelajaran,
            'semester' => $raport->semester,
            'al_quran' => [
                'kelompok' => $namaKelompokPbs,
                'nilai' => $pbsData,
                'total_nilai' => $totalPbs,
                'rata_rata' => $rataRataPbs,
                'peringkat' => $peringkatPbs,
                'dari' => $dariPbs,
                'keputusan' => $raport->keputusan_pbs,
            ],
            'takhassus' => [
                'kelompok' => $namaKelompokPbm,
                'nilai' => $pbmData,
                'total_nilai' => $totalPbm,
                'rata_rata' => $rataRataPbm,
                'peringkat' => $peringkatPbm,
                'dari' => $dariPbm,
                'keputusan' => $raport->keputusan_pbm,
            ],
            'kepribadian' => $kepribadianData,
            'predikat_umum' => $raport->predikat_umum,
        ];
    }

    private function getPredikat(int $nilai): string
    {
        foreach (self::PREDIKAT_MAP as [$min, $max, $label]) {
            if ($nilai >= $min && $nilai <= $max) {
                return $label;
            }
        }
        return 'Sangat Kurang';
    }

    /**
     * Rata-rata nilai satu aspek di satu kelompok pada bulan/tahun tertentu.
     */
    private function getRataKelompok(string $jenisPengajian, string $aspek, int $kelompokId, string $fkColumn, int $bulan, int $tahun): ?float
    {
        $avg = DB::table('raport_nilai')
            ->join('raport_pengajian', 'raport_nilai.raport_id', '=', 'raport_pengajian.raport_id')
            ->where('raport_pengajian.' . $fkColumn, $kelompokId)
            ->where('raport_pengajian.bulan', $bulan)
            ->where('raport_pengajian.tahun', $tahun)
            ->where('raport_nilai.jenis_pengajian', $jenisPengajian)
            ->where('raport_nilai.aspek', $aspek)
            ->avg('raport_nilai.nilai_angka');

        return $avg !== null ? round($avg, 1) : null;
    }

    /**
     * Peringkat santri dalam kelompok berdasarkan rata-rata nilai.
     * Returns [peringkat, dari].
     */
    private function getPeringkat(string $jenisPengajian, int $kelompokId, string $fkColumn, int $bulan, int $tahun, int $santriId): array
    {
        // Hitung rata-rata semua santri di kelompok untuk jenis_pengajian ini
        $averages = DB::table('raport_nilai')
            ->join('raport_pengajian', 'raport_nilai.raport_id', '=', 'raport_pengajian.raport_id')
            ->where('raport_pengajian.' . $fkColumn, $kelompokId)
            ->where('raport_pengajian.bulan', $bulan)
            ->where('raport_pengajian.tahun', $tahun)
            ->where('raport_nilai.jenis_pengajian', $jenisPengajian)
            ->groupBy('raport_pengajian.santri_id')
            ->select('raport_pengajian.santri_id', DB::raw('AVG(raport_nilai.nilai_angka) as avg_nilai'))
            ->orderByDesc('avg_nilai')
            ->get();

        $dari = $averages->count();
        $peringkat = null;

        foreach ($averages->values() as $index => $row) {
            if ((int) $row->santri_id === $santriId) {
                $peringkat = $index + 1;
                break;
            }
        }

        return [$peringkat, $dari];
    }
}
