<?php

namespace App\Http\Controllers;

use App\Support\KamarName;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;

class RaportPengajianController extends Controller
{
    /** Aspek penilaian fixed sesuai contoh raport (sebagai default/fallback). */
    private const ASPEK_AL_QURAN = ['Fashohah', 'Tajwid', 'Kelancaran', 'Hafalan'];
    private const ASPEK_TAKHASSUS = ['Makna', 'Pemahaman', 'Tarkib', 'Hafalan'];
    private const JENIS_KEPRIBADIAN = ['Kelakuan', 'Kedisiplinan', 'Kerajinan'];

    public function getActiveAspects(string $jenis): array
    {
        if (Schema::hasTable('master_instrumen_pengajian')) {
            $dbAspects = DB::table('master_instrumen_pengajian')
                ->where('jenis_pengajian', $jenis)
                ->where('status_aktif', 1)
                ->orderBy('urutan')
                ->orderBy('instrumen_id')
                ->pluck('nama_instrumen')
                ->toArray();

            if (!empty($dbAspects)) {
                return $dbAspects;
            }
        }

        return $jenis === 'AL_QURAN' ? self::ASPEK_AL_QURAN : self::ASPEK_TAKHASSUS;
    }

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

        $sortTargets = function ($collection) {
            return $collection->sort(function ($a, $b) {
                $catCmp = strnatcasecmp((string) $a->kategori, (string) $b->kategori);
                if ($catCmp !== 0) {
                    return $catCmp;
                }
                return strnatcasecmp((string) $a->nama_roster, (string) $b->nama_roster);
            })->values();
        };

        // PBS (Al-Qur'an)
        $pbsQuery = DB::table('kelompok_pbs as kp')
            ->leftJoin('santri as s', function ($join) {
                $join->on('kp.kelompok_pbs_id', '=', 's.kelompok_pbs_id')
                    ->where('s.status_aktif', 1);
            })
            ->select(
                'kp.kelompok_pbs_id as target_id',
                'kp.nama_kelompok as nama_target',
                'kp.kategori',
                DB::raw('count(s.santri_id) as santri_count')
            )
            ->groupBy('kp.kelompok_pbs_id', 'kp.nama_kelompok', 'kp.kategori');

        if ($petugas->jabatan !== 'Admin') {
            $assignedIds = $this->getAssignedIds($petugas, 'KelompokPBS');
            $pbsQuery->whereIn('kp.kelompok_pbs_id', $assignedIds);
        }
        $pbsTargets = $sortTargets($pbsQuery->get()->map(function ($target) {
            $category = (string) ($target->kategori ?? '');
            $cleanRoster = trim(preg_replace('/^' . preg_quote($category, '/') . '\s*-\s*/i', '', (string) $target->nama_target));
            $target->nama_roster = $cleanRoster !== '' ? $cleanRoster : $target->nama_target;
            $target->santri_count = (int) $target->santri_count;
            return $target;
        }));

        if ($pbsTargets->isNotEmpty() || $petugas->jabatan === 'Admin') {
            $result[] = [
                'jenis' => 'AL_QURAN',
                'nama' => 'Pengajian Al-Qur\'an',
                'aspek' => $this->getActiveAspects('AL_QURAN'),
                'targets' => $pbsTargets,
            ];
        }

        // PBM (Takhassus)
        $pbmQuery = DB::table('kelompok_pbm as kp')
            ->leftJoin('santri as s', function ($join) {
                $join->on('kp.kelompok_pbm_id', '=', 's.kelompok_pbm_id')
                    ->where('s.status_aktif', 1);
            })
            ->select(
                'kp.kelompok_pbm_id as target_id',
                'kp.nama_kelompok as nama_target',
                'kp.kategori',
                DB::raw('count(s.santri_id) as santri_count')
            )
            ->groupBy('kp.kelompok_pbm_id', 'kp.nama_kelompok', 'kp.kategori');

        if ($petugas->jabatan !== 'Admin') {
            $assignedIds = $this->getAssignedIds($petugas, 'KelompokPBM');
            $pbmQuery->whereIn('kp.kelompok_pbm_id', $assignedIds);
        }
        $pbmTargets = $sortTargets($pbmQuery->get()->map(function ($target) {
            $category = (string) ($target->kategori ?? '');
            $cleanRoster = trim(preg_replace('/^' . preg_quote($category, '/') . '\s*-\s*/i', '', (string) $target->nama_target));
            $target->nama_roster = $cleanRoster !== '' ? $cleanRoster : $target->nama_target;
            $target->santri_count = (int) $target->santri_count;
            return $target;
        }));

        if ($pbmTargets->isNotEmpty() || $petugas->jabatan === 'Admin') {
            $result[] = [
                'jenis' => 'TAKHASSUS',
                'nama' => 'Pengajian Takhassus',
                'aspek' => $this->getActiveAspects('TAKHASSUS'),
                'targets' => $pbmTargets,
            ];
        }

        return response()->json($result);
    }

    /**
     * Ringkasan status dan kelengkapan nilai seluruh kelompok (PBS & PBM)
     * untuk halaman landing/hub Raport Pengajian.
     */
    public function summary(Request $request)
    {
        $bulan = (int) $request->input('bulan', Carbon::now()->month);
        $tahun = (int) $request->input('tahun', Carbon::now()->year);
        $petugas = $request->user();

        $result = [];

        // 1. PBS (Pengajian Al-Qur'an)
        $pbsQuery = DB::table('kelompok_pbs as kp')
            ->leftJoin('petugas as p', 'kp.ustadz_id', '=', 'p.petugas_id')
            ->select(
                'kp.kelompok_pbs_id as target_id',
                'kp.nama_kelompok',
                'kp.kategori',
                'p.nama as pengajar_nama'
            );

        if ($petugas->jabatan !== 'Admin') {
            $assignedPbsIds = $this->getAssignedIds($petugas, 'KelompokPBS');
            $pbsQuery->whereIn('kp.kelompok_pbs_id', $assignedPbsIds);
        }

        $pbsGroups = $pbsQuery->get();
        if ($pbsGroups->isNotEmpty()) {
            $pbsIds = $pbsGroups->pluck('target_id');

            // Active santri count per PBS group
            $santriCountPbs = DB::table('santri')
                ->whereIn('kelompok_pbs_id', $pbsIds)
                ->where('status_aktif', 1)
                ->select('kelompok_pbs_id', DB::raw('count(*) as total'))
                ->groupBy('kelompok_pbs_id')
                ->pluck('total', 'kelompok_pbs_id');

            // Locked raports per PBS group
            $lockedPbs = DB::table('raport_pengajian as rp')
                ->join('santri as s', 'rp.santri_id', '=', 's.santri_id')
                ->whereIn('s.kelompok_pbs_id', $pbsIds)
                ->where('s.status_aktif', 1)
                ->where('rp.bulan', $bulan)
                ->where('rp.tahun', $tahun)
                ->where('rp.status', 'dikunci')
                ->select('s.kelompok_pbs_id', DB::raw('max(rp.dikunci_pada) as dikunci_pada'))
                ->groupBy('s.kelompok_pbs_id')
                ->pluck('dikunci_pada', 'kelompok_pbs_id');

            // Completed santri per PBS group (have all 4 AL_QURAN aspects filled)
            $pbsAspects = $this->getActiveAspects('AL_QURAN');
            $aspectsCount = count($pbsAspects);

            $completedPbs = DB::table('raport_nilai as rn')
                ->join('raport_pengajian as rp', 'rn.raport_id', '=', 'rp.raport_id')
                ->join('santri as s', 'rp.santri_id', '=', 's.santri_id')
                ->whereIn('s.kelompok_pbs_id', $pbsIds)
                ->where('s.status_aktif', 1)
                ->where('rp.bulan', $bulan)
                ->where('rp.tahun', $tahun)
                ->where('rn.jenis_pengajian', 'AL_QURAN')
                ->whereIn('rn.aspek', $pbsAspects)
                ->whereNotNull('rn.nilai_angka')
                ->select('s.kelompok_pbs_id', 's.santri_id', DB::raw('count(*) as count'))
                ->groupBy('s.kelompok_pbs_id', 's.santri_id')
                ->having('count', '>=', $aspectsCount)
                ->get()
                ->groupBy('kelompok_pbs_id')
                ->map(fn ($g) => $g->count());

            // Filled scores count per PBS group
            $filledPbs = DB::table('raport_nilai as rn')
                ->join('raport_pengajian as rp', 'rn.raport_id', '=', 'rp.raport_id')
                ->join('santri as s', 'rp.santri_id', '=', 's.santri_id')
                ->whereIn('s.kelompok_pbs_id', $pbsIds)
                ->where('s.status_aktif', 1)
                ->where('rp.bulan', $bulan)
                ->where('rp.tahun', $tahun)
                ->where('rn.jenis_pengajian', 'AL_QURAN')
                ->whereIn('rn.aspek', $pbsAspects)
                ->whereNotNull('rn.nilai_angka')
                ->select('s.kelompok_pbs_id', DB::raw('count(*) as count'))
                ->groupBy('s.kelompok_pbs_id')
                ->pluck('count', 'kelompok_pbs_id');

            foreach ($pbsGroups as $group) {
                $category = (string) ($group->kategori ?? '');
                $cleanRoster = trim(preg_replace('/^' . preg_quote($category, '/') . '\s*-\s*/i', '', (string) $group->nama_kelompok));
                $totalSantri = (int) ($santriCountPbs->get($group->target_id, 0));
                $isLocked = $lockedPbs->has($group->target_id);
                $completed = (int) ($completedPbs->get($group->target_id, 0));
                $filled = (int) ($filledPbs->get($group->target_id, 0));
                $totalExpected = $totalSantri * $aspectsCount;
                $percentage = $totalExpected > 0 ? (int) round(($filled / $totalExpected) * 100) : 0;
                if ($percentage > 100) $percentage = 100;
                $hasDraft = !$isLocked && $filled > 0;
                $status = $isLocked ? 'dikunci' : ($hasDraft ? 'draft' : 'belum_mulai');

                $result[] = [
                    'target_id' => $group->target_id,
                    'jenis' => 'AL_QURAN',
                    'nama_jenis' => 'Pengajian Al-Qur\'an',
                    'nama_kelompok' => $group->nama_kelompok,
                    'nama_roster' => $cleanRoster !== '' ? $cleanRoster : $group->nama_kelompok,
                    'kategori' => $category,
                    'pengajar_nama' => $group->pengajar_nama ?: 'Belum Ditugaskan',
                    'santri_count' => $totalSantri,
                    'aspects_count' => $aspectsCount,
                    'completed_santri_count' => $completed,
                    'total_expected_scores' => $totalExpected,
                    'filled_scores_count' => $filled,
                    'percentage' => $percentage,
                    'status' => $status,
                    'is_locked' => $isLocked,
                    'dikunci_pada' => $lockedPbs->get($group->target_id),
                ];
            }
        }

        // 2. PBM (Pengajian Takhassus)
        $pbmQuery = DB::table('kelompok_pbm as kp')
            ->leftJoin('petugas as p', 'kp.ustadz_id', '=', 'p.petugas_id')
            ->select(
                'kp.kelompok_pbm_id as target_id',
                'kp.nama_kelompok',
                'kp.kategori',
                'p.nama as pengajar_nama'
            );

        if ($petugas->jabatan !== 'Admin') {
            $assignedPbmIds = $this->getAssignedIds($petugas, 'KelompokPBM');
            $pbmQuery->whereIn('kp.kelompok_pbm_id', $assignedPbmIds);
        }

        $pbmGroups = $pbmQuery->get();
        if ($pbmGroups->isNotEmpty()) {
            $pbmIds = $pbmGroups->pluck('target_id');

            // Active santri count per PBM group
            $santriCountPbm = DB::table('santri')
                ->whereIn('kelompok_pbm_id', $pbmIds)
                ->where('status_aktif', 1)
                ->select('kelompok_pbm_id', DB::raw('count(*) as total'))
                ->groupBy('kelompok_pbm_id')
                ->pluck('total', 'kelompok_pbm_id');

            // Locked raports per PBM group
            $lockedPbm = DB::table('raport_pengajian as rp')
                ->join('santri as s', 'rp.santri_id', '=', 's.santri_id')
                ->whereIn('s.kelompok_pbm_id', $pbmIds)
                ->where('s.status_aktif', 1)
                ->where('rp.bulan', $bulan)
                ->where('rp.tahun', $tahun)
                ->where('rp.status', 'dikunci')
                ->select('s.kelompok_pbm_id', DB::raw('max(rp.dikunci_pada) as dikunci_pada'))
                ->groupBy('s.kelompok_pbm_id')
                ->pluck('dikunci_pada', 'kelompok_pbm_id');

            $pbmAspects = $this->getActiveAspects('TAKHASSUS');
            $aspectsCountPbm = count($pbmAspects);

            // Completed santri per PBM group
            $completedPbm = DB::table('raport_nilai as rn')
                ->join('raport_pengajian as rp', 'rn.raport_id', '=', 'rp.raport_id')
                ->join('santri as s', 'rp.santri_id', '=', 's.santri_id')
                ->whereIn('s.kelompok_pbm_id', $pbmIds)
                ->where('s.status_aktif', 1)
                ->where('rp.bulan', $bulan)
                ->where('rp.tahun', $tahun)
                ->where('rn.jenis_pengajian', 'TAKHASSUS')
                ->whereIn('rn.aspek', $pbmAspects)
                ->whereNotNull('rn.nilai_angka')
                ->select('s.kelompok_pbm_id', 's.santri_id', DB::raw('count(*) as count'))
                ->groupBy('s.kelompok_pbm_id', 's.santri_id')
                ->having('count', '>=', $aspectsCountPbm)
                ->get()
                ->groupBy('kelompok_pbm_id')
                ->map(fn ($g) => $g->count());

            // Filled scores count per PBM group
            $filledPbm = DB::table('raport_nilai as rn')
                ->join('raport_pengajian as rp', 'rn.raport_id', '=', 'rp.raport_id')
                ->join('santri as s', 'rp.santri_id', '=', 's.santri_id')
                ->whereIn('s.kelompok_pbm_id', $pbmIds)
                ->where('s.status_aktif', 1)
                ->where('rp.bulan', $bulan)
                ->where('rp.tahun', $tahun)
                ->where('rn.jenis_pengajian', 'TAKHASSUS')
                ->whereIn('rn.aspek', $pbmAspects)
                ->whereNotNull('rn.nilai_angka')
                ->select('s.kelompok_pbm_id', DB::raw('count(*) as count'))
                ->groupBy('s.kelompok_pbm_id')
                ->pluck('count', 'kelompok_pbm_id');

            foreach ($pbmGroups as $group) {
                $category = (string) ($group->kategori ?? '');
                $cleanRoster = trim(preg_replace('/^' . preg_quote($category, '/') . '\s*-\s*/i', '', (string) $group->nama_kelompok));
                $totalSantri = (int) ($santriCountPbm->get($group->target_id, 0));
                $isLocked = $lockedPbm->has($group->target_id);
                $completed = (int) ($completedPbm->get($group->target_id, 0));
                $filled = (int) ($filledPbm->get($group->target_id, 0));
                $totalExpected = $totalSantri * $aspectsCountPbm;
                $percentage = $totalExpected > 0 ? (int) round(($filled / $totalExpected) * 100) : 0;
                if ($percentage > 100) $percentage = 100;
                $hasDraft = !$isLocked && $filled > 0;
                $status = $isLocked ? 'dikunci' : ($hasDraft ? 'draft' : 'belum_mulai');

                $result[] = [
                    'target_id' => $group->target_id,
                    'jenis' => 'TAKHASSUS',
                    'nama_jenis' => 'Pengajian Takhassus',
                    'nama_kelompok' => $group->nama_kelompok,
                    'nama_roster' => $cleanRoster !== '' ? $cleanRoster : $group->nama_kelompok,
                    'kategori' => $category,
                    'pengajar_nama' => $group->pengajar_nama ?: 'Belum Ditugaskan',
                    'santri_count' => $totalSantri,
                    'aspects_count' => $aspectsCount,
                    'completed_santri_count' => $completed,
                    'total_expected_scores' => $totalExpected,
                    'filled_scores_count' => $filled,
                    'percentage' => $percentage,
                    'status' => $status,
                    'is_locked' => $isLocked,
                    'dikunci_pada' => $lockedPbm->get($group->target_id),
                ];
            }
        }

        // Sort results: category then roster name
        usort($result, function ($a, $b) {
            $catCmp = strnatcasecmp((string) $a['kategori'], (string) $b['kategori']);
            if ($catCmp !== 0) {
                return $catCmp;
            }
            return strnatcasecmp((string) $a['nama_roster'], (string) $b['nama_roster']);
        });

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
            $aspekList = $this->getActiveAspects('AL_QURAN');
        } else {
            $santriColumn = 'kelompok_pbm_id';
            $tipeTarget = 'KelompokPBM';
            $targetTable = 'kelompok_pbm';
            $targetPk = 'kelompok_pbm_id';
            $targetLabel = 'nama_kelompok';
            $raportFk = 'kelompok_pbm_id';
            $aspekList = $this->getActiveAspects('TAKHASSUS');
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
            ->get(['santri_id', 'nis', 'no_id_induk', 'nama']);

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

            $isLockedSantri = ($raport?->status ?? 'draft') === 'dikunci';

            return [
                'santri_id' => $santri->santri_id,
                'nis' => $santri->nis,
                'no_id_induk' => $santri->no_id_induk,
                'nama' => $santri->nama,
                'nilai' => $nilai,
                'kepribadian' => $kepribadian,
                'keputusan' => $raport?->$keputusanField ?? null,
                'predikat_umum' => $raport?->predikat_umum ?? null,
                'raport_id' => $raport?->raport_id ?? null,
                'status' => $raport?->status ?? 'draft',
                'is_locked' => $isLockedSantri,
            ];
        });

        $category = (string) ($target->kategori ?? '');
        $cleanRoster = trim(preg_replace('/^' . preg_quote($category, '/') . '\s*-\s*/i', '', (string) $target->$targetLabel));

        $lockedRaports = $existingRaports->where('status', 'dikunci');
        $totalSantriCount = $santriList->count();
        $lockedCount = $lockedRaports->count();
        $isFullyLocked = $totalSantriCount > 0 && $lockedCount === $totalSantriCount;
        $isPartiallyLocked = $lockedCount > 0 && !$isFullyLocked;

        $lastLocked = $lockedRaports->sortByDesc('dikunci_pada')->first();
        $dikunciOlehNama = null;
        if ($lastLocked && $lastLocked->dikunci_oleh) {
            $dikunciOlehNama = DB::table('petugas')->where('petugas_id', $lastLocked->dikunci_oleh)->value('nama');
        }

        $lockStatus = [
            'is_locked' => $isFullyLocked,
            'is_partially_locked' => $isPartiallyLocked,
            'status' => $isFullyLocked ? 'dikunci' : ($isPartiallyLocked ? 'sebagian_dikunci' : 'draft'),
            'locked_count' => $lockedCount,
            'total_count' => $totalSantriCount,
            'dikunci_pada' => $lastLocked?->dikunci_pada ? Carbon::parse($lastLocked->dikunci_pada)->toIso8601String() : null,
            'dikunci_oleh_nama' => $dikunciOlehNama,
            'alasan_buka_kunci' => $lastLocked?->alasan_buka_kunci,
            'can_unlock' => $petugas->jabatan === 'Admin' || ($lastLocked && $petugas->petugas_id === $lastLocked->dikunci_oleh),
        ];

        return response()->json([
            'jenis' => $jenis,
            'kategori' => $target->kategori ?? null,
            'nama_roster' => $cleanRoster !== '' ? $cleanRoster : $target->$targetLabel,
            'nama_kelompok' => $target->$targetLabel,
            'target_id' => $targetId,
            'bulan' => (int) $data['bulan'],
            'tahun' => (int) $data['tahun'],
            'aspek' => $aspekList,
            'kepribadian_jenis' => self::JENIS_KEPRIBADIAN,
            'santri' => $santriData,
            'lock_status' => $lockStatus,
        ]);
    }

    /**
     * Simpan/update nilai bulk per kelompok.
     */
    public function bulkUpsert(Request $request)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Piket Pengajian'], true)) {
            return response()->json(['message' => 'Hanya Admin dan Piket Pengajian yang dapat menginput raport'], 403);
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
            $aspekList = $this->getActiveAspects('AL_QURAN');
        } else {
            $tipeTarget = 'KelompokPBM';
            $raportFk = 'kelompok_pbm_id';
            $aspekList = $this->getActiveAspects('TAKHASSUS');
        }

        // Cek akses
        if ($petugas->jabatan !== 'Admin' && !$petugas->hasAccess($tipeTarget, $targetId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kelompok ini'], 403);
        }

        $keputusanField = $jenis === 'AL_QURAN' ? 'keputusan_pbs' : 'keputusan_pbm';
        $santriCol = $jenis === 'AL_QURAN' ? 'kelompok_pbs_id' : 'kelompok_pbm_id';

        $lockedSantriIds = DB::table('raport_pengajian')
            ->where($raportFk, $targetId)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->where('status', 'dikunci')
            ->pluck('santri_id')
            ->toArray();

        $totalSantriInGroup = DB::table('santri')
            ->where($santriCol, $targetId)
            ->where('status_aktif', 1)
            ->count();

        if ($totalSantriInGroup > 0 && count($lockedSantriIds) >= $totalSantriInGroup && $petugas->jabatan !== 'Admin') {
            return response()->json([
                'message' => 'Seluruh raport pengajian kelompok ini untuk bulan yang dipilih telah dikunci. Pembina tidak dapat mengubah nilai yang sudah final.',
            ], 422);
        }

        $now = now();
        $periode = DB::table('periode_akademik')->where('tahun_pelajaran', $data['tahun_pelajaran'])->where('semester', $data['semester'])->first();
        if ($periode?->status === 'Ditutup' && $petugas->jabatan !== 'Admin') {
            return response()->json(['message' => 'Periode raport sudah ditutup. Koreksi setelah penutupan hanya dapat dilakukan Admin.'], 422);
        }
        $periodeId = $periode?->periode_id;

        DB::transaction(function () use ($data, $jenis, $targetId, $raportFk, $aspekList, $keputusanField, $petugas, $now, $periodeId, $lockedSantriIds) {
            foreach ($data['entries'] as $entry) {
                $santriId = $entry['santri_id'];

                // Lindungi santri yang sudah dikunci dari modifikasi oleh non-Admin
                if (in_array($santriId, $lockedSantriIds, true) && $petugas->jabatan !== 'Admin') {
                    continue;
                }

                // Upsert raport_pengajian
                $existing = DB::table('raport_pengajian')
                    ->where('santri_id', $santriId)
                    ->where('bulan', $data['bulan'])
                    ->where('tahun', $data['tahun'])
                    ->first();

                $raportData = [
                    'tahun_pelajaran' => $data['tahun_pelajaran'],
                    'semester' => $data['semester'],
                    'periode_id' => $periodeId,
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
     * Lock raport pengajian per group/month.
     */
    public function lock(Request $request)
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
            $tipeTarget = 'KelompokPBS';
            $santriCol = 'kelompok_pbs_id';
            $raportFk = 'kelompok_pbs_id';
            $aspekList = $this->getActiveAspects('AL_QURAN');
        } else {
            $tipeTarget = 'KelompokPBM';
            $santriCol = 'kelompok_pbm_id';
            $raportFk = 'kelompok_pbm_id';
            $aspekList = $this->getActiveAspects('TAKHASSUS');
        }

        if ($petugas->jabatan !== 'Admin' && !$petugas->hasAccess($tipeTarget, $targetId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kelompok ini'], 403);
        }

        $santriList = DB::table('santri')
            ->where($santriCol, $targetId)
            ->where('status_aktif', 1)
            ->get(['santri_id', 'nama']);

        if ($santriList->isEmpty()) {
            return response()->json(['message' => 'Tidak ada santri aktif di kelompok ini'], 422);
        }

        $existingRaports = DB::table('raport_pengajian')
            ->whereIn('santri_id', $santriList->pluck('santri_id'))
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->get();

        $raportIds = $existingRaports->pluck('raport_id');
        $nilaiCounts = DB::table('raport_nilai')
            ->whereIn('raport_id', $raportIds)
            ->where('jenis_pengajian', $jenis)
            ->whereIn('aspek', $aspekList)
            ->whereNotNull('nilai_angka')
            ->select('raport_id', DB::raw('count(*) as count'))
            ->groupBy('raport_id')
            ->pluck('count', 'raport_id');

        $requiredCount = count($aspekList);
        $completedRaportIds = [];
        $incompleteSantri = [];
        $alreadyLockedCount = 0;

        foreach ($santriList as $santri) {
            $raport = $existingRaports->firstWhere('santri_id', $santri->santri_id);
            if (!$raport) {
                $incompleteSantri[] = $santri->nama;
                continue;
            }
            if ($raport->status === 'dikunci') {
                $alreadyLockedCount++;
                continue;
            }
            $count = $nilaiCounts->get($raport->raport_id, 0);
            if ($count >= $requiredCount) {
                $completedRaportIds[] = $raport->raport_id;
            } else {
                $incompleteSantri[] = $santri->nama;
            }
        }

        if (empty($completedRaportIds)) {
            if ($alreadyLockedCount > 0 && empty($incompleteSantri)) {
                return response()->json([
                    'message' => 'Seluruh santri dalam kelompok ini sudah dikunci sebelumnya.',
                ], 422);
            }
            $sample = !empty($incompleteSantri) ? implode(', ', array_slice($incompleteSantri, 0, 3)) : '';
            return response()->json([
                'message' => 'Belum ada santri baru dengan nilai lengkap untuk dikunci. Pastikan minimal 1 santri telah memiliki nilai lengkap di seluruh aspek.' . ($sample ? " (Belum lengkap: {$sample})" : ''),
            ], 422);
        }

        $now = now();
        DB::table('raport_pengajian')
            ->whereIn('raport_id', $completedRaportIds)
            ->update([
                'status' => 'dikunci',
                'dikunci_oleh' => $petugas->petugas_id,
                'dikunci_pada' => $now,
                'updated_at' => $now,
            ]);

        $newlyLockedCount = count($completedRaportIds);
        $totalLocked = $alreadyLockedCount + $newlyLockedCount;
        $draftCount = count($incompleteSantri);
        $isFullyLocked = $draftCount === 0;

        $msg = $isFullyLocked
            ? "Seluruh raport ({$totalLocked} santri) berhasil dikunci sebagai dokumen final."
            : "Berhasil mengunci {$newlyLockedCount} santri yang lengkap. {$draftCount} santri lainnya tetap berstatus draft/susulan.";

        return response()->json([
            'message' => $msg,
            'locked_count' => $totalLocked,
            'newly_locked_count' => $newlyLockedCount,
            'draft_count' => $draftCount,
            'incomplete_santri' => $incompleteSantri,
            'is_fully_locked' => $isFullyLocked,
            'lock_status' => [
                'is_locked' => $isFullyLocked,
                'is_partially_locked' => !$isFullyLocked && $totalLocked > 0,
                'status' => $isFullyLocked ? 'dikunci' : 'sebagian_dikunci',
                'locked_count' => $totalLocked,
                'total_count' => $santriList->count(),
                'dikunci_pada' => $now->toIso8601String(),
                'dikunci_oleh_nama' => $petugas->nama,
            ],
        ]);
    }

    /**
     * Unlock raport pengajian per group/month.
     */
    public function unlock(Request $request)
    {
        $data = $request->validate([
            'jenis' => 'required|in:AL_QURAN,TAKHASSUS',
            'target_id' => 'required|integer',
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
            'alasan' => 'required|string|min:5|max:500',
        ]);

        $petugas = $request->user();
        $jenis = $data['jenis'];
        $targetId = $data['target_id'];

        if ($jenis === 'AL_QURAN') {
            $tipeTarget = 'KelompokPBS';
            $santriCol = 'kelompok_pbs_id';
        } else {
            $tipeTarget = 'KelompokPBM';
            $santriCol = 'kelompok_pbm_id';
        }

        if (!in_array($petugas->jabatan, ['Admin', 'Piket Pengajian'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        if ($petugas->jabatan !== 'Admin' && !$petugas->hasAccess($tipeTarget, $targetId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kelompok ini.'], 403);
        }

        $santriIds = DB::table('santri')->where($santriCol, $targetId)->pluck('santri_id');
        $existingRaports = DB::table('raport_pengajian')
            ->whereIn('santri_id', $santriIds)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->where('status', 'dikunci')
            ->get();

        if ($existingRaports->isEmpty()) {
            return response()->json(['message' => 'Raport kelompok belum dikunci atau tidak ditemukan.'], 422);
        }

        $now = now();
        $raportIds = $existingRaports->pluck('raport_id');
        DB::table('raport_pengajian')
            ->whereIn('raport_id', $raportIds)
            ->update([
                'status' => 'draft',
                'alasan_buka_kunci' => $data['alasan'],
                'dibuka_oleh' => $petugas->petugas_id,
                'dibuka_pada' => $now,
                'updated_at' => $now,
            ]);

        return response()->json([
            'message' => 'Kunci raport berhasil dibuka. Anda dapat mengoreksi nilai kembali.',
            'lock_status' => [
                'is_locked' => false,
                'status' => 'draft',
                'dikunci_pada' => null,
                'dikunci_oleh_nama' => null,
            ],
        ]);
    }

    /**
     * Lihat raport individual santri.
     */
    public function portalSemester(Request $request)
    {
        $data = $request->validate([
            'tahun_pelajaran' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'in:Gasal,Genap'],
        ]);

        $santri = $request->user('wali');
        $semesterDb = $data['semester'] === 'Gasal' ? 'Ganjil' : 'Genap';
        $profile = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->where('santri.santri_id', $santri->santri_id)
            ->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')
            ->first();

        $raports = DB::table('raport_pengajian')
            ->where('santri_id', $santri->santri_id)
            ->where('tahun_pelajaran', $data['tahun_pelajaran'])
            ->where('semester', $semesterDb)
            ->where('status', 'dikunci')
            ->orderBy('tahun')
            ->orderBy('bulan')
            ->get();

        return response()->json([
            'tahun_pelajaran' => $data['tahun_pelajaran'],
            'semester' => $data['semester'],
            'reports' => $raports->map(fn ($raport) => $this->buildRaportData($raport, $profile))->values(),
        ]);
    }

    public function portalSemesterPdf(Request $request)
    {
        $data = $request->validate([
            'tahun_pelajaran' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'in:Gasal,Genap'],
        ]);

        $santri = $request->user('wali');
        $semesterDb = $data['semester'] === 'Gasal' ? 'Ganjil' : 'Genap';
        $profile = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->where('santri.santri_id', $santri->santri_id)
            ->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')
            ->first();
        $raports = DB::table('raport_pengajian')
            ->where('santri_id', $santri->santri_id)
            ->where('tahun_pelajaran', $data['tahun_pelajaran'])
            ->where('semester', $semesterDb)
            ->where('status', 'dikunci')
            ->orderBy('tahun')
            ->orderBy('bulan')
            ->get();

        if ($raports->isEmpty()) {
            return response()->json(['message' => 'Rapor pengajian belum diterbitkan untuk periode ini.'], 404);
        }

        Carbon::setLocale('id');
        $pdf = Pdf::loadView('pdf.raport_pengajian_bulk', [
            'allPages' => $raports->map(fn ($raport) => $this->buildRaportData($raport, $profile))->values()->all(),
            'predikatMap' => self::PREDIKAT_MAP,
            'kepribadianMap' => self::KEPRIBADIAN_MAP,
        ]);
        $pdf->setPaper('A4', 'portrait');

        return $pdf->download('Rapor_Pengajian_' . str_replace(' ', '_', $profile->nama) . '_' . $data['tahun_pelajaran'] . '_' . $data['semester'] . '.pdf');
    }

    public function portalHistory(Request $request)
    {
        $santri = $request->user('wali');
        return response()->json(DB::table('report_documents')->where('jenis', 'raport_pengajian')->where('santri_id', $santri->santri_id)->orderByDesc('diterbitkan_pada')->get(['document_id', 'tahun_pelajaran', 'semester', 'versi', 'diterbitkan_pada']));
    }

    public function portalDocumentPdf(Request $request, int $documentId)
    {
        $santri = $request->user('wali');
        $document = DB::table('report_documents')->where('document_id', $documentId)->where('jenis', 'raport_pengajian')->where('santri_id', $santri->santri_id)->first();
        abort_unless($document, 404, 'Arsip raport tidak ditemukan.');
        abort_unless(Storage::disk('local')->exists($document->file_path), 404, 'Berkas arsip raport tidak ditemukan.');
        return Storage::disk('local')->download($document->file_path, "Raport-{$santri->santri_id}-v{$document->versi}.pdf");
    }

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

        $petugas = $request->user();
        if ($petugas && $petugas->jabatan !== 'Admin' && !$petugas->hasAccess('KelompokPBS', (int) ($raport->kelompok_pbs_id ?? 0)) && !$petugas->hasAccess('KelompokPBM', (int) ($raport->kelompok_pbm_id ?? 0))) {
            return response()->json(['message' => 'Raport berada di luar penugasan Anda.'], 403);
        }

        $result = $this->buildRaportData($raport, $santri);

        return response()->json($result);
    }

    public function publish(Request $request, int $santriId)
    {
        $data = $request->validate(['bulan' => 'required|integer|between:1,12', 'tahun' => 'required|integer|between:2020,2100']);
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Piket Pengajian'], true)) return response()->json(['message' => 'Role ini tidak dapat menerbitkan raport.'], 403);
        $santri = DB::table('santri')->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')->where('santri.santri_id', $santriId)->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')->first();
        $raport = DB::table('raport_pengajian')->where('santri_id', $santriId)->where('bulan', $data['bulan'])->where('tahun', $data['tahun'])->first();
        if (!$santri || !$raport) return response()->json(['message' => 'Raport belum diisi untuk periode ini.'], 404);
        $periodStatus = $raport->periode_id ? DB::table('periode_akademik')->where('periode_id', $raport->periode_id)->value('status') : null;
        if ($periodStatus === 'Ditutup' && $petugas->jabatan !== 'Admin') return response()->json(['message' => 'Periode raport sudah ditutup. Penerbitan ulang setelah penutupan hanya dapat dilakukan Admin.'], 422);
        if ($petugas->jabatan !== 'Admin' && !$petugas->hasAccess('KelompokPBS', (int) ($raport->kelompok_pbs_id ?? 0)) && !$petugas->hasAccess('KelompokPBM', (int) ($raport->kelompok_pbm_id ?? 0))) return response()->json(['message' => 'Raport berada di luar penugasan Anda.'], 403);
        $snapshot = $this->buildRaportData($raport, $santri);
        $version = ((int) DB::table('report_documents')->where(['jenis' => 'raport_pengajian', 'santri_id' => $santriId, 'tahun_pelajaran' => $raport->tahun_pelajaran, 'semester' => $raport->semester])->max('versi')) + 1;
        $path = "report-documents/raport-pengajian/{$santriId}/{$raport->tahun_pelajaran}-{$raport->semester}-v{$version}.pdf";
        $pdf = Pdf::loadView('pdf.raport_pengajian', ['data' => $snapshot, 'predikatMap' => self::PREDIKAT_MAP, 'kepribadianMap' => self::KEPRIBADIAN_MAP])->setPaper('A4', 'portrait');
        Storage::disk('local')->put($path, $pdf->output());
        $id = DB::table('report_documents')->insertGetId(['jenis' => 'raport_pengajian', 'santri_id' => $santriId, 'periode_id' => $raport->periode_id, 'tahun_pelajaran' => $raport->tahun_pelajaran, 'semester' => $raport->semester, 'versi' => $version, 'file_path' => $path, 'snapshot_data' => json_encode($snapshot), 'diterbitkan_oleh' => $petugas->petugas_id, 'diterbitkan_pada' => now(), 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'Raport diterbitkan sebagai arsip.', 'document_id' => $id, 'versi' => $version], 201);
    }

    public function history(Request $request, int $santriId)
    {
        return response()->json(DB::table('report_documents')->where('jenis', 'raport_pengajian')->where('santri_id', $santriId)->orderByDesc('diterbitkan_pada')->get(['document_id', 'tahun_pelajaran', 'semester', 'versi', 'diterbitkan_oleh', 'diterbitkan_pada']));
    }

    public function documentPdf(Request $request, int $santriId, int $documentId)
    {
        $document = DB::table('report_documents')->where('document_id', $documentId)->where('jenis', 'raport_pengajian')->where('santri_id', $santriId)->first();
        abort_unless($document, 404, 'Arsip raport tidak ditemukan.');
        abort_unless(Storage::disk('local')->exists($document->file_path), 404, 'Berkas arsip raport tidak ditemukan.');
        return Storage::disk('local')->download($document->file_path, "Raport-{$santriId}-v{$document->versi}.pdf");
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

        $petugas = $request->user();
        if ($petugas && $petugas->jabatan !== 'Admin' && !$petugas->hasAccess('KelompokPBS', (int) ($raport->kelompok_pbs_id ?? 0)) && !$petugas->hasAccess('KelompokPBM', (int) ($raport->kelompok_pbm_id ?? 0))) {
            return response()->json(['message' => 'Raport berada di luar penugasan Anda.'], 403);
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
        $activePbsAspects = $this->getActiveAspects('AL_QURAN');
        foreach ($activePbsAspects as $aspek) {
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
        $activePbmAspects = $this->getActiveAspects('TAKHASSUS');
        foreach ($activePbmAspects as $aspek) {
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
                'nis' => $santri->no_id_induk ?? $santri->nis,
                'no_id_induk' => $santri->no_id_induk,
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
        if (Schema::hasTable('master_rentang_nilai')) {
            $ranges = DB::table('master_rentang_nilai')
                ->where('kategori', 'pengajian')
                ->orderBy('urutan')
                ->get();

            foreach ($ranges as $r) {
                if ($nilai >= $r->min_nilai && $nilai <= $r->max_nilai) {
                    return $r->predikat;
                }
            }
        }

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

    // =========================================================
    // CMS MASTER INSTRUMEN PENGAJIAN & RENTANG NILAI (ADMIN)
    // =========================================================

    public function masterIndex(Request $request)
    {
        $jenis = $request->query('jenis');

        $query = DB::table('master_instrumen_pengajian as mip')
            ->leftJoin('petugas as p', 'mip.dibuat_oleh', '=', 'p.petugas_id')
            ->select('mip.*', 'p.nama as pembuat_nama')
            ->orderBy('mip.jenis_pengajian')
            ->orderBy('mip.urutan')
            ->orderBy('mip.instrumen_id');

        if ($jenis && in_array($jenis, ['AL_QURAN', 'TAKHASSUS'], true)) {
            $query->where('mip.jenis_pengajian', $jenis);
        }

        $items = $query->get()->map(function ($item) {
            return [
                'instrumen_id' => $item->instrumen_id,
                'jenis_pengajian' => $item->jenis_pengajian,
                'nama_instrumen' => $item->nama_instrumen,
                'urutan' => (int) $item->urutan,
                'status_aktif' => (bool) $item->status_aktif,
                'pembuat' => $item->pembuat_nama ? ['nama' => $item->pembuat_nama] : null,
                'created_at' => $item->created_at,
            ];
        });

        return response()->json($items);
    }

    public function masterStore(Request $request)
    {
        $cleanNama = trim(strip_tags((string) $request->input('nama_instrumen', '')));
        $request->merge(['nama_instrumen' => $cleanNama]);

        $data = $request->validate([
            'jenis_pengajian' => 'required|in:AL_QURAN,TAKHASSUS',
            'nama_instrumen' => [
                'required',
                'string',
                'min:2',
                'max:150',
                \Illuminate\Validation\Rule::unique('master_instrumen_pengajian', 'nama_instrumen')
                    ->where('jenis_pengajian', $request->input('jenis_pengajian')),
            ],
        ]);

        $maxUrutan = DB::table('master_instrumen_pengajian')
            ->where('jenis_pengajian', $data['jenis_pengajian'])
            ->max('urutan') ?? 0;

        $now = now();
        $id = DB::table('master_instrumen_pengajian')->insertGetId([
            'jenis_pengajian' => $data['jenis_pengajian'],
            'nama_instrumen' => $data['nama_instrumen'],
            'urutan' => $maxUrutan + 1,
            'status_aktif' => 1,
            'dibuat_oleh' => $request->user()->petugas_id,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'message' => 'Kriteria pengajian berhasil ditambahkan',
            'instrumen_id' => $id,
        ], 201);
    }

    public function masterUpdate(Request $request, int $id)
    {
        $item = DB::table('master_instrumen_pengajian')->where('instrumen_id', $id)->first();
        if (!$item) {
            return response()->json(['message' => 'Kriteria tidak ditemukan'], 404);
        }

        $cleanNama = trim(strip_tags((string) $request->input('nama_instrumen', '')));
        $request->merge(['nama_instrumen' => $cleanNama]);

        $data = $request->validate([
            'nama_instrumen' => [
                'required',
                'string',
                'min:2',
                'max:150',
                \Illuminate\Validation\Rule::unique('master_instrumen_pengajian', 'nama_instrumen')
                    ->where('jenis_pengajian', $item->jenis_pengajian)
                    ->ignore($id, 'instrumen_id'),
            ],
        ]);

        $oldName = $item->nama_instrumen;
        $newName = $data['nama_instrumen'];

        DB::transaction(function () use ($id, $item, $oldName, $newName) {
            DB::table('master_instrumen_pengajian')->where('instrumen_id', $id)->update([
                'nama_instrumen' => $newName,
                'updated_at' => now(),
            ]);

            // Sinkronkan ke raport_nilai yang memakai nama lama
            if ($oldName !== $newName) {
                DB::table('raport_nilai')
                    ->where('jenis_pengajian', $item->jenis_pengajian)
                    ->where('aspek', $oldName)
                    ->update(['aspek' => $newName]);
            }
        });

        return response()->json(['message' => 'Nama kriteria berhasil diperbarui']);
    }

    public function masterToggle(Request $request, int $id)
    {
        $item = DB::table('master_instrumen_pengajian')->where('instrumen_id', $id)->first();
        if (!$item) {
            return response()->json(['message' => 'Kriteria tidak ditemukan'], 404);
        }

        $newStatus = $item->status_aktif ? 0 : 1;
        DB::table('master_instrumen_pengajian')->where('instrumen_id', $id)->update([
            'status_aktif' => $newStatus,
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => $newStatus ? 'Kriteria berhasil diaktifkan' : 'Kriteria berhasil dinonaktifkan',
            'status_aktif' => (bool) $newStatus,
        ]);
    }

    public function masterDestroy(Request $request, int $id)
    {
        $item = DB::table('master_instrumen_pengajian')->where('instrumen_id', $id)->first();
        if (!$item) {
            return response()->json(['message' => 'Kriteria tidak ditemukan'], 404);
        }

        $hasNilai = DB::table('raport_nilai')
            ->where('jenis_pengajian', $item->jenis_pengajian)
            ->where('aspek', $item->nama_instrumen)
            ->exists();

        if ($hasNilai) {
            return response()->json([
                'message' => 'Kriteria ini sudah memiliki histori nilai dan tidak dapat dihapus. Silakan nonaktifkan statusnya.',
            ], 422);
        }

        DB::table('master_instrumen_pengajian')->where('instrumen_id', $id)->delete();
        return response()->json(['message' => 'Kriteria berhasil dihapus']);
    }

    public function getRentangNilai(Request $request, string $kategori)
    {
        if (!in_array($kategori, ['pembinaan', 'pengajian'], true)) {
            return response()->json(['message' => 'Kategori rentang nilai tidak valid'], 422);
        }

        $ranges = DB::table('master_rentang_nilai')
            ->where('kategori', $kategori)
            ->orderBy('urutan')
            ->get();

        return response()->json($ranges);
    }

    public function saveRentangNilai(Request $request, string $kategori)
    {
        if (!in_array($kategori, ['pembinaan', 'pengajian'], true)) {
            return response()->json(['message' => 'Kategori rentang nilai tidak valid'], 422);
        }

        $data = $request->validate([
            'ranges' => 'required|array|min:1',
            'ranges.*.huruf' => 'required|string|max:10',
            'ranges.*.min_nilai' => 'required|integer|between:0,100',
            'ranges.*.max_nilai' => 'required|integer|between:0,100',
            'ranges.*.predikat' => 'required|string|max:60',
        ]);

        // 1. Validasi integritas min <= max per baris
        foreach ($data['ranges'] as $r) {
            if ($r['min_nilai'] > $r['max_nilai']) {
                return response()->json([
                    'message' => "Batas nilai untuk {$r['huruf']} tidak valid (min: {$r['min_nilai']} > max: {$r['max_nilai']})",
                ], 422);
            }
        }

        // 2. Validasi tidak ada tabrakan (overlap) antar rentang nilai
        $sorted = collect($data['ranges'])->sortBy('min_nilai')->values()->all();
        for ($i = 0; $i < count($sorted) - 1; $i++) {
            if ($sorted[$i]['max_nilai'] >= $sorted[$i + 1]['min_nilai']) {
                return response()->json([
                    'message' => "Rentang nilai saling bertabrakan (overlap) antara {$sorted[$i]['huruf']} ({$sorted[$i]['min_nilai']}-{$sorted[$i]['max_nilai']}) dan {$sorted[$i + 1]['huruf']} ({$sorted[$i + 1]['min_nilai']}-{$sorted[$i + 1]['max_nilai']}).",
                ], 422);
            }
        }

        DB::transaction(function () use ($kategori, $data) {
            DB::table('master_rentang_nilai')->where('kategori', $kategori)->delete();

            $now = now();
            foreach ($data['ranges'] as $idx => $r) {
                DB::table('master_rentang_nilai')->insert([
                    'kategori' => $kategori,
                    'huruf' => trim($r['huruf']),
                    'min_nilai' => (int) $r['min_nilai'],
                    'max_nilai' => (int) $r['max_nilai'],
                    'predikat' => trim($r['predikat']),
                    'urutan' => $idx + 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });

        $updated = DB::table('master_rentang_nilai')
            ->where('kategori', $kategori)
            ->orderBy('urutan')
            ->get();

        return response()->json([
            'message' => 'Rentang nilai berhasil disimpan',
            'data' => $updated,
        ]);
    }
}
