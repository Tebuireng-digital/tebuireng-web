<?php

namespace App\Http\Controllers;

use App\Models\MasterInstrumenUbudiyah;
use App\Models\RaportUbudiyah;
use App\Models\NilaiUbudiyah;
use App\Models\Santri;
use App\Support\KamarName;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;

class UbudiyahController extends Controller
{
    private const PREDIKAT_MAP = [
        [85, 100, 'A', 'Sangat Baik'],
        [80, 84, 'B+', 'Baik'],
        [75, 79, 'B', 'Baik'],
        [70, 74, 'C+', 'Cukup'],
        [60, 69, 'C', 'Cukup'],
        [50, 59, 'D', 'Kurang'],
        [0, 49, 'E', 'Sangat Kurang'],
    ];

    public function status()
    {
        $tables = ['master_instrumen_ubudiyah', 'raport_ubudiyah', 'nilai_ubudiyah'];
        $ready = collect($tables)->every(fn (string $table) => Schema::hasTable($table));

        return response()->json([
            'ready' => $ready,
            'instrument_count' => $ready ? MasterInstrumenUbudiyah::where('status_aktif', 1)->count() : 0,
        ], $ready ? 200 : 503);
    }

    /**
     * Get room options assigned to the petugas (or all for Admin).
     */
    public function options(Request $request)
    {
        $petugas = $request->user();
        $query = DB::table('kamar')
            ->select('kamar_id as target_id', 'nama as nama_target');

        if (!in_array($petugas->jabatan, ['Admin'], true)) {
            $query->whereIn('kamar_id', $this->assignedRoomIds($petugas->petugas_id));
        }

        $rooms = $query->orderBy('nama')->get();

        return response()->json($rooms);
    }

    /**
     * Summary of rooms assigned to the user (or all rooms for Admin)
     * including completion progress and lock status for a given month/year.
     */
    public function kamarSummary(Request $request)
    {
        $bulan = (int) $request->input('bulan', Carbon::now()->month);
        $tahun = (int) $request->input('tahun', Carbon::now()->year);

        $petugas = $request->user();
        $query = DB::table('kamar')
            ->select('kamar.kamar_id', 'kamar.nama as nama_kamar', 'kamar.pembina_id');

        if (!in_array($petugas->jabatan, ['Admin'], true)) {
            $query->whereIn('kamar.kamar_id', $this->assignedRoomIds($petugas->petugas_id));
        }

        $rooms = $query->orderBy('kamar.nama')->get();
        if ($rooms->isEmpty()) {
            return response()->json([]);
        }

        $pembinaIds = $rooms->pluck('pembina_id')->filter()->unique();
        $pembinaMap = DB::table('petugas')->whereIn('petugas_id', $pembinaIds)->pluck('nama', 'petugas_id');

        $activeInstrumentsCount = MasterInstrumenUbudiyah::where('status_aktif', 1)->count();
        $roomIds = $rooms->pluck('kamar_id');

        // 1. Santri count per room
        $santriCountPerRoom = DB::table('santri')
            ->whereIn('kamar_id', $roomIds)
            ->where('status_aktif', 1)
            ->select('kamar_id', DB::raw('count(*) as total'))
            ->groupBy('kamar_id')
            ->pluck('total', 'kamar_id');

        // 2. Locked status per room
        $lockedRooms = DB::table('raport_ubudiyah')
            ->join('santri', 'raport_ubudiyah.santri_id', '=', 'santri.santri_id')
            ->whereIn('santri.kamar_id', $roomIds)
            ->where('raport_ubudiyah.bulan', $bulan)
            ->where('raport_ubudiyah.tahun', $tahun)
            ->where('raport_ubudiyah.status', 'dikunci')
            ->select('santri.kamar_id', DB::raw('max(raport_ubudiyah.dikunci_pada) as dikunci_pada'))
            ->groupBy('santri.kamar_id')
            ->pluck('dikunci_pada', 'kamar_id');

        // 3. Draft existence per room
        $draftRooms = DB::table('raport_ubudiyah')
            ->join('santri', 'raport_ubudiyah.santri_id', '=', 'santri.santri_id')
            ->whereIn('santri.kamar_id', $roomIds)
            ->where('raport_ubudiyah.bulan', $bulan)
            ->where('raport_ubudiyah.tahun', $tahun)
            ->select('santri.kamar_id')
            ->groupBy('santri.kamar_id')
            ->pluck('kamar_id')
            ->flip();

        // 4. Completed santri per room (santri who have >= activeInstrumentsCount filled scores)
        $completedSantriPerRoom = DB::table('nilai_ubudiyah')
            ->join('raport_ubudiyah', 'nilai_ubudiyah.raport_ubudiyah_id', '=', 'raport_ubudiyah.raport_ubudiyah_id')
            ->join('santri', 'raport_ubudiyah.santri_id', '=', 'santri.santri_id')
            ->whereIn('santri.kamar_id', $roomIds)
            ->where('raport_ubudiyah.bulan', $bulan)
            ->where('raport_ubudiyah.tahun', $tahun)
            ->whereNotNull('nilai_ubudiyah.nilai_angka')
            ->select('santri.kamar_id', 'santri.santri_id', DB::raw('count(*) as count'))
            ->groupBy('santri.kamar_id', 'santri.santri_id')
            ->having('count', '>=', max(1, $activeInstrumentsCount))
            ->get()
            ->groupBy('kamar_id')
            ->map(fn ($group) => $group->count());

        // 5. Total filled scores per room
        $filledScoresPerRoom = DB::table('nilai_ubudiyah')
            ->join('raport_ubudiyah', 'nilai_ubudiyah.raport_ubudiyah_id', '=', 'raport_ubudiyah.raport_ubudiyah_id')
            ->join('santri', 'raport_ubudiyah.santri_id', '=', 'santri.santri_id')
            ->whereIn('santri.kamar_id', $roomIds)
            ->where('raport_ubudiyah.bulan', $bulan)
            ->where('raport_ubudiyah.tahun', $tahun)
            ->whereNotNull('nilai_ubudiyah.nilai_angka')
            ->select('santri.kamar_id', DB::raw('count(*) as count'))
            ->groupBy('santri.kamar_id')
            ->pluck('count', 'kamar_id');

        $result = $rooms->map(function ($room) use (
            $santriCountPerRoom,
            $pembinaMap,
            $activeInstrumentsCount,
            $lockedRooms,
            $draftRooms,
            $completedSantriPerRoom,
            $filledScoresPerRoom
        ) {
            $totalSantri = (int) ($santriCountPerRoom->get($room->kamar_id, 0));
            $isLocked = $lockedRooms->has($room->kamar_id);
            $completedSantri = (int) ($completedSantriPerRoom->get($room->kamar_id, 0));
            $filledScores = (int) ($filledScoresPerRoom->get($room->kamar_id, 0));
            $hasDraft = !$isLocked && $filledScores > 0;

            $totalExpected = $totalSantri * $activeInstrumentsCount;
            $percentage = $totalExpected > 0 ? (int) round(($filledScores / $totalExpected) * 100) : 0;
            if ($percentage > 100) $percentage = 100;

            $status = $isLocked ? 'dikunci' : ($hasDraft ? 'draft' : 'belum_mulai');

            return [
                'kamar_id' => $room->kamar_id,
                'nama_kamar' => $room->nama_kamar,
                'pembina_nama' => $pembinaMap->get($room->pembina_id) ?? 'Belum Ditugaskan',
                'santri_count' => $totalSantri,
                'active_instruments_count' => $activeInstrumentsCount,
                'completed_santri_count' => $completedSantri,
                'total_expected_scores' => $totalExpected,
                'filled_scores_count' => $filledScores,
                'percentage' => $percentage,
                'status' => $status,
                'is_locked' => $isLocked,
                'dikunci_pada' => $lockedRooms->get($room->kamar_id),
            ];
        });

        return response()->json($result);
    }

    /**
     * Load santri list + active instruments + existing scores.
     */
    public function session(Request $request)
    {
        $data = $request->validate([
            'target_id' => 'required|integer',
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        $petugas = $request->user();
        $kamarId = $data['target_id'];

        // Access check
        if (!$this->hasRoomAccess($petugas, $kamarId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kamar ini'], 403);
        }

        $kamar = DB::table('kamar')->where('kamar_id', $kamarId)->first();
        if (!$kamar) {
            return response()->json(['message' => 'Kamar tidak ditemukan'], 404);
        }

        // Active instruments
        $instruments = MasterInstrumenUbudiyah::where('status_aktif', 1)
            ->orderBy('instrumen_id')
            ->get(['instrumen_id', 'nama_instrumen']);

        // Active santri in the room
        $santriList = Santri::where('kamar_id', $kamarId)
            ->where('status_aktif', 1)
            ->orderBy('nama')
            ->get(['santri_id', 'nis', 'no_id_induk', 'nama']);

        // Existing reports for the month
        $existingRaports = RaportUbudiyah::whereIn('santri_id', $santriList->pluck('santri_id'))
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->get()
            ->keyBy('santri_id');

        $raportIds = $existingRaports->pluck('raport_ubudiyah_id');

        $existingNilai = DB::table('nilai_ubudiyah')
            ->whereIn('raport_ubudiyah_id', $raportIds)
            ->get()
            ->groupBy('raport_ubudiyah_id');

        // Compile santri data
        $santriData = $santriList->map(function ($santri) use ($existingRaports, $existingNilai) {
            $raport = $existingRaports->get($santri->santri_id);
            $nilai = [];
            $catatan = [];

            if ($raport) {
                $nilaiRows = $existingNilai->get($raport->raport_ubudiyah_id, collect());
                foreach ($nilaiRows as $row) {
                    $nilai[$row->instrumen_id] = $row->nilai_angka;
                    $catatan[$row->instrumen_id] = $row->catatan;
                }
            }

            $isLockedSantri = ($raport?->status ?? 'draft') === 'dikunci';

            return [
                'santri_id' => $santri->santri_id,
                'nis' => $santri->nis,
                'no_id_induk' => $santri->no_id_induk,
                'nama' => $santri->nama,
                'nilai' => $nilai,
                'catatan' => $catatan,
                'raport_ubudiyah_id' => $raport?->raport_ubudiyah_id ?? null,
                'status' => $raport?->status ?? 'draft',
                'is_locked' => $isLockedSantri,
            ];
        });

        // Lock status
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
            'nama_kamar' => $kamar->nama,
            'target_id' => $kamarId,
            'bulan' => (int) $data['bulan'],
            'tahun' => (int) $data['tahun'],
            'aspek' => $instruments,
            'santri' => $santriData,
            'lock_status' => $lockStatus,
        ]);
    }

    /**
     * Save / update raport pembinaan in bulk.
     */
    public function bulkUpsert(Request $request)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Pembina Kamar'], true)) {
            return response()->json(['message' => 'Hanya Admin dan Pembina Kamar yang dapat menginput raport'], 403);
        }

        $data = $request->validate([
            'target_id' => 'required|integer',
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
            'tahun_pelajaran' => 'required|string|max:20',
            'semester' => 'required|in:Ganjil,Genap',
            'entries' => 'required|array|min:1',
            'entries.*.santri_id' => 'required|integer|exists:santri,santri_id',
            'entries.*.nilai' => 'required|array',
            'entries.*.nilai.*' => 'nullable|integer|between:0,100',
            'entries.*.catatan' => 'nullable|array',
            'entries.*.catatan.*' => 'nullable|string|max:255',
        ]);

        $kamarId = $data['target_id'];

        if (!$this->hasRoomAccess($petugas, $kamarId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kamar ini'], 403);
        }

        $santriIds = collect($data['entries'])->pluck('santri_id');
        $validSantriCount = Santri::where('kamar_id', $kamarId)
            ->where('status_aktif', 1)
            ->whereIn('santri_id', $santriIds)
            ->count();

        if ($validSantriCount !== $santriIds->count()) {
            return response()->json([
                'message' => 'Semua santri yang diinput harus berasal dari kamar yang dipilih dan masih aktif',
            ], 422);
        }

        $lockedSantriIds = RaportUbudiyah::where('kamar_id', $kamarId)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->where('status', 'dikunci')
            ->pluck('santri_id')
            ->toArray();

        $totalSantriInRoom = Santri::where('kamar_id', $kamarId)
            ->where('status_aktif', 1)
            ->count();

        if ($totalSantriInRoom > 0 && count($lockedSantriIds) >= $totalSantriInRoom && $petugas->jabatan !== 'Admin') {
            return response()->json([
                'message' => 'Seluruh raport pembinaan kamar ini untuk bulan yang dipilih telah dikunci. Pembina tidak dapat mengubah nilai yang sudah final.',
            ], 422);
        }

        $now = now();
        $periode = DB::table('periode_akademik')->where('tahun_pelajaran', $data['tahun_pelajaran'])->where('semester', $data['semester'])->first();
        if ($periode?->status === 'Ditutup' && $petugas->jabatan !== 'Admin') {
            return response()->json(['message' => 'Periode raport pembinaan sudah ditutup. Koreksi setelah penutupan hanya dapat dilakukan Admin.'], 422);
        }
        $periodeId = $periode?->periode_id;

        DB::transaction(function () use ($data, $kamarId, $petugas, $now, $periodeId, $lockedSantriIds) {
            foreach ($data['entries'] as $entry) {
                $santriId = $entry['santri_id'];

                // Lindungi santri yang sudah dikunci dari modifikasi oleh non-Admin
                if (in_array($santriId, $lockedSantriIds, true) && $petugas->jabatan !== 'Admin') {
                    continue;
                }

                // 1. Upsert Header
                $existing = RaportUbudiyah::where('santri_id', $santriId)
                    ->where('bulan', $data['bulan'])
                    ->where('tahun', $data['tahun'])
                    ->first();

                $raportData = [
                    'kamar_id' => $kamarId,
                    'tahun_pelajaran' => $data['tahun_pelajaran'],
                    'semester' => $data['semester'],
                    'periode_id' => $periodeId,
                    'diisi_oleh' => $petugas->petugas_id,
                    'updated_at' => $now,
                ];

                if ($existing) {
                    $existing->update($raportData);
                    $raportId = $existing->raport_ubudiyah_id;
                } else {
                    $raportData['santri_id'] = $santriId;
                    $raportData['bulan'] = $data['bulan'];
                    $raportData['tahun'] = $data['tahun'];
                    $raportData['created_at'] = $now;
                    $raportId = DB::table('raport_ubudiyah')->insertGetId($raportData);
                }

                // 2. Upsert Details
                foreach ($entry['nilai'] as $instId => $nilaiVal) {
                    $catatanVal = $entry['catatan'][$instId] ?? null;

                    if ($nilaiVal !== null) {
                        DB::table('nilai_ubudiyah')->updateOrInsert(
                            [
                                'raport_ubudiyah_id' => $raportId,
                                'instrumen_id' => $instId,
                            ],
                            [
                                'nilai_angka' => $nilaiVal,
                                'catatan' => $catatanVal,
                                'updated_at' => $now,
                            ]
                        );
                    } else {
                        // If score is null, remove existing entry if any
                        DB::table('nilai_ubudiyah')
                            ->where('raport_ubudiyah_id', $raportId)
                            ->where('instrumen_id', $instId)
                            ->delete();
                    }
                }

                // If all scores for this santri were deleted and raport is not locked, clean up empty header
                $hasScoresLeft = DB::table('nilai_ubudiyah')->where('raport_ubudiyah_id', $raportId)->exists();
                if (!$hasScoresLeft) {
                    DB::table('raport_ubudiyah')
                        ->where('raport_ubudiyah_id', $raportId)
                        ->where('status', '!=', 'dikunci')
                        ->delete();
                }
            }
        });

        return response()->json([
            'message' => 'Laporan Ubudiyah Yaumiyah berhasil disimpan',
            'jumlah' => count($data['entries']),
        ]);
    }

    /**
     * Lock raport pembinaan per room/month.
     */
    public function lock(Request $request)
    {
        $data = $request->validate([
            'target_id' => 'required|integer',
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        $petugas = $request->user();
        $kamarId = $data['target_id'];

        if (!$this->hasRoomAccess($petugas, $kamarId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kamar ini'], 403);
        }

        $santriList = Santri::where('kamar_id', $kamarId)
            ->where('status_aktif', 1)
            ->get(['santri_id', 'nama']);

        if ($santriList->isEmpty()) {
            return response()->json(['message' => 'Tidak ada santri aktif di kamar ini'], 422);
        }

        $activeInstruments = MasterInstrumenUbudiyah::where('status_aktif', 1)->pluck('instrumen_id');
        if ($activeInstruments->isEmpty()) {
            return response()->json(['message' => 'Tidak ada instrumen penilaian aktif'], 422);
        }

        $existingRaports = RaportUbudiyah::whereIn('santri_id', $santriList->pluck('santri_id'))
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->get();

        $raportIds = $existingRaports->pluck('raport_ubudiyah_id');
        $nilaiCounts = DB::table('nilai_ubudiyah')
            ->whereIn('raport_ubudiyah_id', $raportIds)
            ->whereIn('instrumen_id', $activeInstruments)
            ->whereNotNull('nilai_angka')
            ->select('raport_ubudiyah_id', DB::raw('count(*) as count'))
            ->groupBy('raport_ubudiyah_id')
            ->pluck('count', 'raport_ubudiyah_id');

        $requiredCount = $activeInstruments->count();
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
            $count = $nilaiCounts->get($raport->raport_ubudiyah_id, 0);
            if ($count >= $requiredCount) {
                $completedRaportIds[] = $raport->raport_ubudiyah_id;
            } else {
                $incompleteSantri[] = $santri->nama;
            }
        }

        if (empty($completedRaportIds)) {
            if ($alreadyLockedCount > 0 && empty($incompleteSantri)) {
                return response()->json([
                    'message' => 'Seluruh santri dalam kamar ini sudah dikunci sebelumnya.',
                ], 422);
            }
            $sample = !empty($incompleteSantri) ? implode(', ', array_slice($incompleteSantri, 0, 3)) : '';
            return response()->json([
                'message' => 'Belum ada santri baru dengan nilai lengkap untuk dikunci. Pastikan minimal 1 santri telah memiliki nilai lengkap di seluruh instrumen.' . ($sample ? " (Belum lengkap: {$sample})" : ''),
            ], 422);
        }

        $now = now();
        DB::transaction(function () use ($completedRaportIds, $petugas, $now) {
            DB::table('raport_ubudiyah')
                ->whereIn('raport_ubudiyah_id', $completedRaportIds)
                ->update([
                    'status' => 'dikunci',
                    'dikunci_oleh' => $petugas->petugas_id,
                    'dikunci_pada' => $now,
                    'updated_at' => $now,
                ]);
        });

        $newlyLockedCount = count($completedRaportIds);
        $totalLocked = $alreadyLockedCount + $newlyLockedCount;
        $draftCount = count($incompleteSantri);
        $isFullyLocked = $draftCount === 0;

        $msg = $isFullyLocked
            ? "Seluruh raport pembinaan ({$totalLocked} santri) berhasil dikunci sebagai dokumen final."
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
     * Unlock raport pembinaan per room/month.
     */
    public function unlock(Request $request)
    {
        $data = $request->validate([
            'target_id' => 'required|integer',
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
            'alasan' => 'required|string|min:5|max:500',
        ]);

        $petugas = $request->user();
        $kamarId = $data['target_id'];

        if (!in_array($petugas->jabatan, ['Admin', 'Pembina Kamar'], true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        if (!$this->hasRoomAccess($petugas, $kamarId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kamar ini.'], 403);
        }

        $santriIds = Santri::where('kamar_id', $kamarId)->pluck('santri_id');
        $existingRaports = RaportUbudiyah::whereIn('santri_id', $santriIds)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->where('status', 'dikunci')
            ->get();

        if ($existingRaports->isEmpty()) {
            return response()->json(['message' => 'Raport kamar belum dikunci atau tidak ditemukan.'], 422);
        }

        $now = now();
        $raportIds = $existingRaports->pluck('raport_ubudiyah_id');
        DB::transaction(function () use ($raportIds, $petugas, $now, $data) {
            DB::table('raport_ubudiyah')
                ->whereIn('raport_ubudiyah_id', $raportIds)
                ->update([
                    'status' => 'draft',
                    'alasan_buka_kunci' => $data['alasan'],
                    'dibuka_oleh' => $petugas->petugas_id,
                    'dibuka_pada' => $now,
                    'updated_at' => $now,
                ]);
        });

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
     * Get list of all instruments.
     */
    public function masterIndex(Request $request)
    {
        $instruments = MasterInstrumenUbudiyah::with('pembuat:petugas_id,nama')
            ->orderBy('status_aktif', 'desc')
            ->orderBy('instrumen_id', 'asc')
            ->get();

        return response()->json($instruments);
    }

    /**
     * Create new instrument.
     */
    public function masterStore(Request $request)
    {
        $petugas = $request->user();
        if ($petugas->jabatan !== 'Admin') {
            return response()->json(['message' => 'Hanya Admin yang dapat menambah kriteria pembinaan.'], 403);
        }

        $cleanNama = trim(strip_tags((string) $request->input('nama_instrumen', '')));
        $request->merge(['nama_instrumen' => $cleanNama]);

        $data = $request->validate([
            'nama_instrumen' => 'required|string|min:2|max:150|unique:master_instrumen_ubudiyah,nama_instrumen',
        ]);

        $inst = MasterInstrumenUbudiyah::create([
            'nama_instrumen' => $data['nama_instrumen'],
            'status_aktif' => 1,
            'dibuat_oleh' => $petugas->petugas_id,
        ]);

        return response()->json([
            'message' => 'Kriteria penilaian berhasil ditambahkan',
            'data' => $inst,
        ], 201);
    }

    /**
     * Toggle active/inactive status of instrument.
     */
    public function masterToggle(Request $request, $id)
    {
        $petugas = $request->user();
        if ($petugas->jabatan !== 'Admin') {
            return response()->json(['message' => 'Hanya Admin yang dapat mengubah status kriteria pembinaan.'], 403);
        }

        $inst = MasterInstrumenUbudiyah::findOrFail($id);
        $inst->status_aktif = !$inst->status_aktif;
        $inst->save();

        return response()->json([
            'message' => 'Status kriteria berhasil diperbarui',
            'data' => $inst,
        ]);
    }

    /**
     * Update metric name.
     */
    public function masterUpdate(Request $request, $id)
    {
        $petugas = $request->user();
        if ($petugas->jabatan !== 'Admin') {
            return response()->json(['message' => 'Hanya Admin yang dapat mengubah nama kriteria pembinaan.'], 403);
        }

        $inst = MasterInstrumenUbudiyah::findOrFail($id);

        $cleanNama = trim(strip_tags((string) $request->input('nama_instrumen', '')));
        $request->merge(['nama_instrumen' => $cleanNama]);

        $data = $request->validate([
            'nama_instrumen' => [
                'required',
                'string',
                'min:2',
                'max:150',
                \Illuminate\Validation\Rule::unique('master_instrumen_ubudiyah', 'nama_instrumen')->ignore($inst->instrumen_id, 'instrumen_id'),
            ],
        ]);

        $inst->nama_instrumen = $data['nama_instrumen'];
        $inst->save();

        return response()->json([
            'message' => 'Nama kriteria berhasil diperbarui',
            'data' => $inst,
        ]);
    }

    /**
     * Delete metric.
     */
    public function masterDestroy(Request $request, $id)
    {
        $petugas = $request->user();
        if ($petugas->jabatan !== 'Admin') {
            return response()->json(['message' => 'Hanya Admin yang dapat menghapus kriteria pembinaan.'], 403);
        }

        $inst = MasterInstrumenUbudiyah::findOrFail($id);

        $usedCount = DB::table('nilai_ubudiyah')->where('instrumen_id', $id)->count();

        if ($usedCount > 0) {
            return response()->json([
                'message' => "Kriteria ini telah digunakan pada {$usedCount} data nilai santri dan tidak dapat dihapus untuk menjaga keutuhan data histori. Silakan nonaktifkan statusnya.",
                'used_count' => $usedCount,
            ], 422);
        }

        $inst->delete();

        return response()->json([
            'message' => 'Kriteria berhasil dihapus',
        ]);
    }

    /**
     * Get single santri's Ubudiyah report card.
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

        if (!$this->hasRoomAccess($request->user(), (int) $santri->kamar_id)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kamar santri ini'], 403);
        }

        $raport = RaportUbudiyah::where('santri_id', $santriId)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->first();

        if (!$raport) {
            return response()->json(['message' => 'Laporan Ubudiyah belum diisi untuk periode ini'], 404);
        }

        $raportData = $this->buildReportCardData($raport, $santri);

        return response()->json($raportData);
    }

    /**
     * Download PDF for a single student.
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

        if (!$this->hasRoomAccess($request->user(), (int) $santri->kamar_id)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kamar santri ini'], 403);
        }

        $raport = RaportUbudiyah::where('santri_id', $santriId)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->first();

        if (!$raport) {
            return response()->json(['message' => 'Laporan Ubudiyah belum diisi untuk periode ini'], 404);
        }

        $raportData = $this->buildReportCardData($raport, $santri);

        Carbon::setLocale('id');

        $pdf = Pdf::loadView('pdf.raport_ubudiyah', [
            'data' => $raportData,
        ]);

        $pdf->setPaper('A4', 'portrait');

        $filename = 'Laporan_Ubudiyah_' . str_replace(' ', '_', $santri->nama) . '_' . $data['bulan'] . '_' . $data['tahun'] . '.pdf';
        return $pdf->download($filename);
    }

    public function publish(Request $request, int $santriId)
    {
        $data = $request->validate(['bulan' => 'required|integer|between:1,12', 'tahun' => 'required|integer|between:2020,2100']);
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Pembina Kamar'], true)) return response()->json(['message' => 'Role ini tidak dapat menerbitkan raport pembinaan.'], 403);
        $santri = DB::table('santri')->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')->where('santri.santri_id', $santriId)->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')->first();
        if (!$santri || !$this->hasRoomAccess($petugas, (int) $santri->kamar_id)) return response()->json(['message' => 'Santri berada di luar penugasan Anda.'], 403);
        $raport = RaportUbudiyah::where('santri_id', $santriId)->where('bulan', $data['bulan'])->where('tahun', $data['tahun'])->first();
        if (!$raport) return response()->json(['message' => 'Raport pembinaan belum diisi untuk periode ini.'], 404);
        $periodStatus = $raport->periode_id ? DB::table('periode_akademik')->where('periode_id', $raport->periode_id)->value('status') : null;
        if ($periodStatus === 'Ditutup' && $petugas->jabatan !== 'Admin') return response()->json(['message' => 'Periode raport pembinaan sudah ditutup. Penerbitan ulang setelah penutupan hanya dapat dilakukan Admin.'], 422);
        $snapshot = $this->buildReportCardData($raport, $santri);
        $version = ((int) DB::table('report_documents')->where(['jenis' => 'raport_pembinaan', 'santri_id' => $santriId, 'tahun_pelajaran' => $raport->tahun_pelajaran, 'semester' => $raport->semester])->max('versi')) + 1;
        $path = "report-documents/raport-pembinaan/{$santriId}/{$raport->tahun_pelajaran}-{$raport->semester}-v{$version}.pdf";
        $pdf = Pdf::loadView('pdf.raport_ubudiyah', ['data' => $snapshot])->setPaper('A4', 'portrait');
        Storage::disk('local')->put($path, $pdf->output());
        $id = DB::table('report_documents')->insertGetId(['jenis' => 'raport_pembinaan', 'santri_id' => $santriId, 'periode_id' => $raport->periode_id, 'tahun_pelajaran' => $raport->tahun_pelajaran, 'semester' => $raport->semester, 'versi' => $version, 'file_path' => $path, 'snapshot_data' => json_encode($snapshot), 'diterbitkan_oleh' => $petugas->petugas_id, 'diterbitkan_pada' => now(), 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'Raport pembinaan diterbitkan sebagai arsip.', 'document_id' => $id, 'versi' => $version], 201);
    }

    public function history(Request $request, int $santriId)
    {
        return response()->json(DB::table('report_documents')->where('jenis', 'raport_pembinaan')->where('santri_id', $santriId)->orderByDesc('diterbitkan_pada')->get(['document_id', 'tahun_pelajaran', 'semester', 'versi', 'diterbitkan_oleh', 'diterbitkan_pada']));
    }

    public function documentPdf(Request $request, int $santriId, int $documentId)
    {
        $document = DB::table('report_documents')->where('document_id', $documentId)->where('jenis', 'raport_pembinaan')->where('santri_id', $santriId)->first();
        abort_unless($document, 404, 'Arsip raport pembinaan tidak ditemukan.');
        abort_unless(Storage::disk('local')->exists($document->file_path), 404, 'Berkas arsip raport tidak ditemukan.');
        return Storage::disk('local')->download($document->file_path, "Raport-Pembinaan-{$santriId}-v{$document->versi}.pdf");
    }

    /**
     * Download bulk PDF for all students in a room.
     */
    public function downloadPdfBulk(Request $request, $kamarId)
    {
        $data = $request->validate([
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        if (!$this->hasRoomAccess($request->user(), (int) $kamarId)) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kamar ini'], 403);
        }

        $santriList = Santri::leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->where('santri.kamar_id', $kamarId)
            ->where('santri.status_aktif', 1)
            ->orderBy('santri.nama')
            ->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')
            ->get();

        if ($santriList->isEmpty()) {
            return response()->json(['message' => 'Tidak ada santri dalam kamar ini'], 404);
        }

        Carbon::setLocale('id');
        $allPages = [];

        foreach ($santriList as $santri) {
            $raport = RaportUbudiyah::where('santri_id', $santri->santri_id)
                ->where('bulan', $data['bulan'])
                ->where('tahun', $data['tahun'])
                ->first();

            if ($raport) {
                $allPages[] = $this->buildReportCardData($raport, $santri);
            }
        }

        if (empty($allPages)) {
            return response()->json(['message' => 'Belum ada laporan Ubudiyah yang diisi untuk periode ini'], 404);
        }

        $pdf = Pdf::loadView('pdf.raport_ubudiyah_bulk', [
            'allPages' => $allPages,
        ]);

        $pdf->setPaper('A4', 'portrait');

        $filename = 'Laporan_Ubudiyah_Bulk_Kamar_' . $kamarId . '_' . $data['bulan'] . '_' . $data['tahun'] . '.pdf';
        return $pdf->download($filename);
    }

    /**
     * Aggregate report for a semester.
     */
    public function rekapSemester(Request $request)
    {
        $data = $request->validate([
            'tahun_pelajaran' => 'required|string|max:20',
            'semester' => 'required|in:Ganjil,Genap',
            'kamar_id' => 'required|integer',
        ]);

        $kamarId = $data['kamar_id'];

        $raports = RaportUbudiyah::join('santri', 'raport_ubudiyah.santri_id', '=', 'santri.santri_id')
            ->where('raport_ubudiyah.kamar_id', $kamarId)
            ->where('raport_ubudiyah.tahun_pelajaran', $data['tahun_pelajaran'])
            ->where('raport_ubudiyah.semester', $data['semester'])
            ->select('raport_ubudiyah.*', 'santri.nama as nama_santri', 'santri.no_id_induk', 'santri.nis')
            ->orderBy('santri.nama')
            ->orderBy('raport_ubudiyah.bulan')
            ->get();

        $raportIds = $raports->pluck('raport_ubudiyah_id');
        $nilaiAll = DB::table('nilai_ubudiyah')
            ->whereIn('raport_ubudiyah_id', $raportIds)
            ->get()
            ->groupBy('raport_ubudiyah_id');

        $result = $raports->map(function ($r) use ($nilaiAll) {
            $nilaiRows = $nilaiAll->get($r->raport_ubudiyah_id, collect());
            $avg = $nilaiRows->avg('nilai_angka');

            return [
                'santri_id' => $r->santri_id,
                'nama_santri' => $r->nama_santri,
                'no_id_induk' => $r->no_id_induk,
                'nis' => $r->no_id_induk,
                'bulan' => $r->bulan,
                'tahun' => $r->tahun,
                'rata_rata' => $avg ? round($avg, 1) : null,
            ];
        });

        return response()->json($result);
    }

    // ─── Helper Methods ─────────────────────────────────────────────

    private function assignedRoomIds(int $petugasId)
    {
        $fromPenugasan = DB::table('petugas_penugasan')
            ->where('petugas_id', $petugasId)
            ->where('tipe_target', 'Kamar')
            ->where('tanggal_mulai', '<=', now()->toDateString())
            ->where(function ($query) {
                $query->whereNull('tanggal_selesai')
                    ->orWhere('tanggal_selesai', '>=', now()->toDateString());
            })
            ->pluck('target_id');

        $fromKamar = DB::table('kamar')
            ->where('pembina_id', $petugasId)
            ->pluck('kamar_id');

        return $fromPenugasan->merge($fromKamar)->unique()->values();
    }

    private function hasRoomAccess($petugas, int $kamarId): bool
    {
        if (in_array($petugas->jabatan, ['Admin'], true)) {
            return true;
        }

        return $this->assignedRoomIds($petugas->petugas_id)->contains($kamarId);
    }

    private function getLetterGrade(int $score): string
    {
        if (Schema::hasTable('master_rentang_nilai')) {
            $ranges = DB::table('master_rentang_nilai')
                ->where('kategori', 'pembinaan')
                ->orderBy('urutan')
                ->get();
            foreach ($ranges as $r) {
                if ($score >= $r->min_nilai && $score <= $r->max_nilai) {
                    return $r->huruf;
                }
            }
        }

        foreach (self::PREDIKAT_MAP as [$min, $max, $letter, $label]) {
            if ($score >= $min && $score <= $max) {
                return $letter;
            }
        }
        return 'E';
    }

    private function getLetterLabel(int $score): string
    {
        if (Schema::hasTable('master_rentang_nilai')) {
            $ranges = DB::table('master_rentang_nilai')
                ->where('kategori', 'pembinaan')
                ->orderBy('urutan')
                ->get();
            foreach ($ranges as $r) {
                if ($score >= $r->min_nilai && $score <= $r->max_nilai) {
                    return $r->predikat;
                }
            }
        }

        foreach (self::PREDIKAT_MAP as [$min, $max, $letter, $label]) {
            if ($score >= $min && $score <= $max) {
                return $label;
            }
        }
        return 'Sangat Kurang';
    }

    private function getPeringkat(int $kamarId, int $bulan, int $tahun, int $santriId): array
    {
        $averages = DB::table('nilai_ubudiyah')
            ->join('raport_ubudiyah', 'nilai_ubudiyah.raport_ubudiyah_id', '=', 'raport_ubudiyah.raport_ubudiyah_id')
            ->where('raport_ubudiyah.kamar_id', $kamarId)
            ->where('raport_ubudiyah.bulan', $bulan)
            ->where('raport_ubudiyah.tahun', $tahun)
            ->groupBy('raport_ubudiyah.santri_id')
            ->select('raport_ubudiyah.santri_id', DB::raw('AVG(nilai_ubudiyah.nilai_angka) as avg_nilai'))
            ->orderByDesc('avg_nilai')
            ->get();

        $dari = $averages->count();
        $peringkat = 0;

        foreach ($averages->values() as $index => $row) {
            if ((int) $row->santri_id === $santriId) {
                $peringkat = $index + 1;
                break;
            }
        }

        return [$peringkat, $dari];
    }

    private function buildReportCardData($raport, $santri): array
    {
        $activeInstruments = MasterInstrumenUbudiyah::where('status_aktif', 1)
            ->orderBy('instrumen_id')
            ->get();

        $nilaiMap = DB::table('nilai_ubudiyah')
            ->where('raport_ubudiyah_id', $raport->raport_ubudiyah_id)
            ->get()
            ->keyBy('instrumen_id');

        $totalScore = 0;
        $countScores = 0;

        $nilaiData = $activeInstruments->map(function ($inst) use ($nilaiMap, &$totalScore, &$countScores) {
            $row = $nilaiMap->get($inst->instrumen_id);
            $nilaiAngka = $row?->nilai_angka;

            if ($nilaiAngka !== null) {
                $totalScore += $nilaiAngka;
                $countScores++;
            }

            return [
                'aspek' => $inst->nama_instrumen,
                'nilai_angka' => $nilaiAngka,
                'nilai_huruf' => $nilaiAngka !== null ? $this->getLetterGrade($nilaiAngka) : '—',
                'predikat' => $nilaiAngka !== null ? $this->getLetterLabel($nilaiAngka) : '—',
                'catatan' => $row?->catatan ?? null,
            ];
        });

        $avgScore = $countScores > 0 ? round($totalScore / $countScores, 1) : 0;

        [$peringkat, $dari] = $this->getPeringkat(
            $raport->kamar_id,
            $raport->bulan,
            $raport->tahun,
            $raport->santri_id
        );

        $namaKamar = $santri->nama_kamar ?? null;
        if ($namaKamar) {
            $namaKamar = KamarName::parse($namaKamar)['standar'];
        }

        $namaPetugas = DB::table('petugas')
            ->where('petugas_id', $raport->diisi_oleh)
            ->value('nama') ?? 'Pembina Kamar';

        return [
            'raport_ubudiyah_id' => $raport->raport_ubudiyah_id,
            'santri' => [
                'santri_id' => $santri->santri_id,
                'no_id_induk' => $santri->no_id_induk,
                'nis' => $santri->no_id_induk,
                'nama' => $santri->nama,
                'nama_kamar' => $namaKamar,
                'nama_kelas' => $santri->nama_kelas ?? null,
                'tingkat' => $santri->tingkat ?? null,
            ],
            'bulan' => $raport->bulan,
            'tahun' => $raport->tahun,
            'tahun_pelajaran' => $raport->tahun_pelajaran,
            'semester' => $raport->semester,
            'nama_pembina' => $namaPetugas,
            'nilai' => $nilaiData,
            'total_nilai' => $totalScore,
            'rata_rata' => $avgScore,
            'peringkat' => $peringkat,
            'dari' => $dari,
            'predikat_umum' => $this->getLetterLabel($avgScore),
        ];
    }

    /**
     * Endpoint Portal Wali Santri: List raport pembinaan semester aktif (hanya yang dikunci).
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

        $raports = RaportUbudiyah::where('santri_id', $santri->santri_id)
            ->where('tahun_pelajaran', $data['tahun_pelajaran'])
            ->where('semester', $semesterDb)
            ->where('status', 'dikunci')
            ->orderBy('tahun')
            ->orderBy('bulan')
            ->get();

        return response()->json([
            'tahun_pelajaran' => $data['tahun_pelajaran'],
            'semester' => $data['semester'],
            'reports' => $raports->map(fn ($raport) => $this->buildReportCardData($raport, $profile))->values(),
        ]);
    }

    /**
     * Endpoint Portal Wali Santri: Cetak PDF raport pembinaan semester aktif (hanya yang dikunci).
     */
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

        $raports = RaportUbudiyah::where('santri_id', $santri->santri_id)
            ->where('tahun_pelajaran', $data['tahun_pelajaran'])
            ->where('semester', $semesterDb)
            ->where('status', 'dikunci')
            ->orderBy('tahun')
            ->orderBy('bulan')
            ->get();

        if ($raports->isEmpty()) {
            return response()->json(['message' => 'Rapor pembinaan belum diterbitkan untuk periode ini.'], 404);
        }

        Carbon::setLocale('id');
        $pdf = Pdf::loadView('pdf.raport_ubudiyah_bulk', [
            'allPages' => $raports->map(fn ($raport) => $this->buildReportCardData($raport, $profile))->values()->all(),
        ]);

        $pdf->setPaper('A4', 'portrait');
        $filename = 'Raport_Pembinaan_' . str_replace(' ', '_', $profile->nama) . '_' . $data['tahun_pelajaran'] . '_' . $data['semester'] . '.pdf';
        return $pdf->download($filename);
    }
}
