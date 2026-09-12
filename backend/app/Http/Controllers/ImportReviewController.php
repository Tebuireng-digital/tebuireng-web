<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;

class ImportReviewController extends Controller
{
    /** Sinkronkan master putra dan antrean REVIEW_MATCH dari workbook canonical. */
    public function sync(Request $request)
    {
        $before = DB::table('santri_import_reviews')->count();
        $exitCode = Artisan::call('import:master-putra', [
            '--file' => base_path('../data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx'),
        ]);
        $after = DB::table('santri_import_reviews')->count();

        return response()->json([
            'message' => $exitCode === 0
                ? 'Data master dan review berhasil disinkronkan dari workbook canonical terbaru.'
                : 'Sinkronisasi workbook canonical gagal.',
            'status' => $exitCode === 0 ? 'ok' : 'gagal',
            'baru_ditambahkan' => max(0, $after - $before),
        ], $exitCode === 0 ? 200 : 422);
    }

    public function index(Request $request)
    {
        $status = trim((string) $request->query('status', ''));
        $sourceStatus = strtoupper(trim((string) $request->query('source_status', '')));
        $search = trim((string) $request->query('search', ''));
        $sheet = trim((string) $request->query('sheet', ''));

        $query = DB::table('santri_import_reviews as r')
            ->leftJoin('santri as otomatis', 'r.santri_otomatis_id', '=', 'otomatis.santri_id')
            ->leftJoin('kamar as kamar_otomatis', 'otomatis.kamar_id', '=', 'kamar_otomatis.kamar_id')
            ->leftJoin('santri as kandidat', 'r.kandidat_santri_id', '=', 'kandidat.santri_id')
            ->leftJoin('kamar as kamar_kandidat', 'kandidat.kamar_id', '=', 'kamar_kandidat.kamar_id')
            ->select(
                'r.*',
                'otomatis.nama as nama_santri_otomatis', 'kamar_otomatis.nama as kamar_santri_otomatis',
                'kandidat.nama as nama_kandidat', 'kamar_kandidat.nama as kamar_kandidat'
            )
            ->where(function ($query) {
                $query->whereNull('otomatis.santri_id')
                    ->orWhere(function ($canonical) {
                        $canonical->where('otomatis.status_aktif', 1)
                            ->where(function ($source) {
                                $source->whereNull('otomatis.status_siswa_sumber')
                                    ->orWhere('otomatis.status_siswa_sumber', '!=', 'legacy_noncanonical');
                            });
                    });
            })
            ->where(function ($query) {
                $query->whereNull('kandidat.santri_id')
                    ->orWhere(function ($canonical) {
                        $canonical->where('kandidat.status_aktif', 1)
                            ->where(function ($source) {
                                $source->where('kandidat.catatan_import', 'MASTER_PUTRA')
                                    ->orWhere(function ($newStudent) {
                                        $newStudent->where('kandidat.catatan_import', 'SANTRI_BARU_2026')
                                            ->where('kandidat.status_verifikasi', 'terverifikasi_aktif');
                                    });
                            });
                    });
            })
            ->orderByRaw("CASE WHEN r.perlu_review_ulang = 1 THEN 0 ELSE 1 END")
            ->orderByRaw("CASE r.status WHEN 'perlu_tinjau' THEN 0 WHEN 'perlu_mapping_kamar' THEN 1 WHEN 'terpisah' THEN 2 WHEN 'digabung' THEN 3 ELSE 4 END")
            ->orderByDesc('r.skor_kemiripan')
            ->orderBy('r.sumber_sheet')->orderBy('r.baris_sumber');

        if ($status && in_array($status, ['perlu_tinjau', 'perlu_mapping_kamar', 'terpisah', 'digabung'], true)) {
            $query->where('r.status', $status);
        }

        if ($sourceStatus && in_array($sourceStatus, ['EXACT', 'REVIEW', 'UNMATCHED'], true)) {
            $query->where('r.status_sumber_review', $sourceStatus);
        }

        if ($sheet) {
            $query->where('r.sumber_sheet', $sheet);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('r.nama_sumber', 'like', "%{$search}%")
                  ->orWhere('r.kode_kamar_sumber', 'like', "%{$search}%")
                  ->orWhere('otomatis.nama', 'like', "%{$search}%")
                  ->orWhere('kandidat.nama', 'like', "%{$search}%");
            });
        }

        $items = $query->get()->map(function ($row) {
            // A missing candidate is not a similarity score of zero. Keep the
            // workbook value nullable so the UI can distinguish both states.
            $row->skor_kemiripan = $row->skor_kemiripan === null
                ? null
                : (float) $row->skor_kemiripan;
            $row->perlu_review_ulang = (bool) $row->perlu_review_ulang;
            $row->can_merge = (bool) $row->santri_otomatis_id && !in_array($row->status, ['digabung', 'terpisah'], true);
            $row->can_confirm_candidate = !$row->santri_otomatis_id && !in_array($row->status, ['digabung', 'terpisah'], true);
            return $row;
        });

        return response()->json($items);
    }

    public function candidateOptions(Request $request)
    {
        $search = trim((string) $request->query('search', ''));

        $query = $this->canonicalCandidateQuery()
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->select(
                'santri.santri_id',
                'santri.no_id_induk',
                'santri.nis',
                'santri.nama',
                'santri.kamar_id',
                'santri.status_verifikasi',
                'unit_pendidikan.kode as kode_unit',
                'kamar.nama as nama_kamar'
            )
            ->orderBy('santri.nama');

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder->where('santri.nama', 'like', "%{$search}%")
                    ->orWhere('santri.no_id_induk', 'like', "%{$search}%")
                    ->orWhere('santri.nis', 'like', "%{$search}%");
            });
        }

        return response()->json($query->get());
    }

    public function markSeparate(Request $request, int $id)
    {
        $data = $request->validate([
            'catatan' => 'nullable|string|max:255',
            'sudah_ada_di_master' => 'sometimes|boolean',
        ]);
        $review = DB::table('santri_import_reviews')->where('review_id', $id)->first();
        if (!$review) {
            return response()->json(['message' => 'Review tidak ditemukan.'], 404);
        }
        if ($this->hasFinalDecision($review)) {
            return response()->json(['message' => 'Review ini sudah memiliki keputusan final dan tidak dapat diputuskan ulang.'], 422);
        }

        $before = (array) $review;
        $followUp = filter_var($data['sudah_ada_di_master'] ?? false, FILTER_VALIDATE_BOOLEAN)
            ? 'terpisah_sudah_ada_di_master'
            : 'terpisah_belum_ada_di_master';
        $note = $this->cleanDecisionNote($data['catatan'] ?? null);
        $changes = [
            'status' => 'terpisah',
            'keputusan_admin' => 'terpisah',
            'status_tindak_lanjut' => $followUp,
            'diputuskan_oleh' => $request->user()->petugas_id,
            'diputuskan_pada' => now(),
            'catatan_keputusan' => $note !== '' ? $note : null,
            'perlu_review_ulang' => false,
            'updated_at' => now(),
        ];

        DB::transaction(function () use ($id, $before, $changes, $request): void {
            DB::table('santri_import_reviews')->where('review_id', $id)->update($changes);
            $after = (array) DB::table('santri_import_reviews')->where('review_id', $id)->first();
            $this->writeDecisionAudit($request, $id, 'TERPISAH', $before, $after);
        });

        return response()->json(['message' => 'Santri ditandai sebagai dua orang yang berbeda. Tindak lanjut: '.$followUp.'.']);
    }

    public function confirmCandidate(Request $request, int $id)
    {
        $data = $request->validate([
            'kandidat_santri_id' => 'nullable|integer',
            'catatan' => 'nullable|string|max:255',
        ]);
        $review = DB::table('santri_import_reviews')->where('review_id', $id)->first();
        if (!$review) {
            return response()->json(['message' => 'Review tidak ditemukan.'], 404);
        }
        if ($this->hasFinalDecision($review)) {
            return response()->json(['message' => 'Review ini sudah memiliki keputusan final.'], 422);
        }
        if ($review->santri_otomatis_id) {
            return response()->json(['message' => 'Row ini memiliki source santri auto-create. Gunakan aksi Gabungkan.'], 422);
        }

        $targetId = $data['kandidat_santri_id'] ?? $review->kandidat_santri_id;
        if (!$targetId || !$this->isCanonicalCandidate((int) $targetId)) {
            return response()->json(['message' => 'Pilih kandidat master canonical aktif sebelum mengonfirmasi.'], 422);
        }

        $before = (array) $review;
        $note = $this->cleanDecisionNote($data['catatan'] ?? null);
        $changes = [
            'kandidat_santri_id' => $targetId,
            'tipe_review' => 'kandidat_workbook',
            'status' => 'digabung',
            'keputusan_admin' => 'terkonfirmasi',
            'status_tindak_lanjut' => 'tertaut_ke_master',
            'diputuskan_oleh' => $request->user()->petugas_id,
            'diputuskan_pada' => now(),
            'catatan_keputusan' => $note !== '' ? $note : null,
            'perlu_review_ulang' => false,
            'updated_at' => now(),
        ];

        DB::transaction(function () use ($id, $before, $changes, $request): void {
            DB::table('santri_import_reviews')->where('review_id', $id)->update($changes);
            $after = (array) DB::table('santri_import_reviews')->where('review_id', $id)->first();
            $this->writeDecisionAudit($request, $id, 'TERKONFIRMASI_KE_MASTER', $before, $after);
        });

        return response()->json(['message' => 'Kandidat workbook berhasil dikonfirmasi ke santri master.']);
    }

    public function merge(Request $request, int $id)
    {
        $data = $request->validate([
            'kandidat_santri_id' => 'nullable|integer',
            'catatan' => 'nullable|string|max:255',
        ]);
        $review = DB::table('santri_import_reviews')->where('review_id', $id)->first();
        if (!$review) {
            return response()->json(['message' => 'Review tidak ditemukan.'], 404);
        }
        if (!$review->santri_otomatis_id) {
            return response()->json(['message' => 'Row ini hanya memiliki kandidat workbook. Gunakan aksi Konfirmasi Kandidat, bukan merge transaksi.'], 422);
        }
        if ($this->hasFinalDecision($review)) {
            return response()->json(['message' => 'Review ini sudah memiliki keputusan final.'], 422);
        }

        $targetId = $data['kandidat_santri_id'] ?? $review->kandidat_santri_id;
        if (!$targetId || !$this->isCanonicalCandidate((int) $targetId)) {
            return response()->json(['message' => 'Target merge harus santri canonical aktif.'], 422);
        }
        if ((int) $targetId === (int) $review->santri_otomatis_id) {
            return response()->json(['message' => 'Pilih kandidat santri yang berbeda untuk digabungkan.'], 422);
        }

        try {
            DB::transaction(function () use ($review, $targetId, $request, $data): void {
                $source = DB::table('santri')->lockForUpdate()->where('santri_id', $review->santri_otomatis_id)->first();
                $target = DB::table('santri')->lockForUpdate()->where('santri_id', $targetId)->first();
                if (!$source || !$target) throw new \RuntimeException('Data santri tidak lagi tersedia.');
                if (!$source->status_aktif || ($source->status_siswa_sumber ?? null) === 'legacy_noncanonical') {
                    throw new \RuntimeException('Source santri tidak aktif atau sudah noncanonical.');
                }
                if (!$this->isCanonicalCandidate((int) $target->santri_id)) {
                    throw new \RuntimeException('Target merge tidak memenuhi aturan santri canonical aktif.');
                }

                $this->assertRelationConflictsAreSafe((int) $source->santri_id, (int) $target->santri_id);

                $fillable = ['nis', 'unit_id', 'kamar_id', 'kelas_formal_id', 'kelompok_madin_id', 'kelompok_pbs_id', 'kelompok_pbm_id', 'nama_wali', 'no_hp_wali'];
                $enrichment = [];
                foreach ($fillable as $field) {
                    if (empty($target->$field) && !empty($source->$field)) $enrichment[$field] = $source->$field;
                }
                if ($enrichment) DB::table('santri')->where('santri_id', $target->santri_id)->update($enrichment);
                DB::table('absensi')->where('santri_id', $source->santri_id)->update(['santri_id' => $target->santri_id]);
                DB::table('pelanggaran')->where('santri_id', $source->santri_id)->update(['santri_id' => $target->santri_id]);
                DB::table('perizinan')->where('santri_id', $source->santri_id)->update(['santri_id' => $target->santri_id]);
                foreach ([
                    'prestasi',
                    'santri_kegiatan_partisipasi',
                    'santri_organisasi_daerah',
                    'santri_pendidikan',
                    'raport_pengajian',
                    'raport_ubudiyah',
                    'report_documents',
                ] as $relationTable) {
                    if (Schema::hasTable($relationTable)) {
                        DB::table($relationTable)->where('santri_id', $source->santri_id)->update(['santri_id' => $target->santri_id]);
                    }
                }
                if (Schema::hasTable('wali_accounts')) {
                    DB::table('wali_accounts')->where('santri_id', $source->santri_id)->update(['santri_id' => $target->santri_id]);
                }
                DB::table('santri_import_reviews')->where('santri_otomatis_id', $source->santri_id)->update([
                    'kandidat_santri_id' => $target->santri_id,
                    'santri_otomatis_id' => null,
                    'status' => 'digabung',
                    'keputusan_admin' => 'digabung',
                    'status_tindak_lanjut' => 'tergabung_ke_master',
                    'diputuskan_oleh' => $request->user()->petugas_id,
                    'diputuskan_pada' => now(),
                    'catatan_keputusan' => $this->cleanDecisionNote($data['catatan'] ?? null),
                    'perlu_review_ulang' => false,
                    'updated_at' => now(),
                ]);
                DB::table('santri')->where('santri_id', $source->santri_id)->update([
                    'status_aktif' => false,
                    'status_verifikasi' => 'nonaktif',
                    'status_siswa_sumber' => 'merged_archived',
                    'catatan_import' => 'Diarsipkan setelah merge ke santri_id '.$target->santri_id,
                    'updated_at' => now(),
                ]);
                $after = (array) DB::table('santri_import_reviews')->where('review_id', $review->review_id)->first();
                $this->writeDecisionAudit($request, $review->review_id, 'DIGABUNG', (array) $review, $after, (int) $target->santri_id);
            });
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['message' => 'Data santri berhasil digabung. Data induk dipertahankan dan data kelas/kelompok yang kosong telah dilengkapi.']);
    }

    public function mappings()
    {
        $mappings = DB::table('kamar_kode_mappings as m')
            ->join('kamar as k', 'm.kamar_id', '=', 'k.kamar_id')
            ->select('m.mapping_id', 'm.kode_sumber', 'm.kamar_id', 'k.nama as nama_kamar')
            ->get()->keyBy('kode_sumber');
        $codes = DB::table('santri_import_reviews')
            ->whereNotNull('kode_kamar_sumber')->where('kode_kamar_sumber', '!=', '')
            ->select('kode_kamar_sumber', DB::raw('COUNT(*) as jumlah_review'))
            ->groupBy('kode_kamar_sumber')->orderBy('kode_kamar_sumber')->get();

        return response()->json($codes->map(function ($code) use ($mappings) {
            $mapping = $mappings->get($code->kode_kamar_sumber);
            return [
                'kode_sumber' => $code->kode_kamar_sumber,
                'jumlah_review' => $code->jumlah_review,
                'kamar_id' => $mapping->kamar_id ?? null,
                'nama_kamar' => $mapping->nama_kamar ?? null,
            ];
        })->values());
    }

    public function saveMapping(Request $request)
    {
        $data = $request->validate([
            'kode_sumber' => 'required|string|max:100',
            'kamar_id' => 'required|integer|exists:kamar,kamar_id',
        ]);
        $code = strtoupper(trim($data['kode_sumber']));
        DB::table('kamar_kode_mappings')->updateOrInsert(['kode_sumber' => $code], [
            'kamar_id' => $data['kamar_id'], 'updated_at' => now(), 'created_at' => now(),
        ]);
        $santriIds = DB::table('santri_import_reviews')->where('kode_kamar_sumber', $code)
            ->whereNotNull('santri_otomatis_id')->pluck('santri_otomatis_id')->unique();
        $updated = DB::table('santri')->whereIn('santri_id', $santriIds)->whereNull('kamar_id')
            ->update(['kamar_id' => $data['kamar_id']]);
        DB::table('santri_import_reviews')->where('kode_kamar_sumber', $code)
            ->where('status', 'perlu_mapping_kamar')->update(['status' => 'perlu_tinjau', 'updated_at' => now()]);

        return response()->json(['message' => 'Mapping kamar disimpan.', 'santri_diperbarui' => $updated]);
    }

    private function canonicalCandidateQuery()
    {
        return DB::table('santri')
            ->where('santri.status_aktif', 1)
            ->where(function ($query): void {
                $query->where('santri.catatan_import', 'MASTER_PUTRA')
                    ->orWhere(function ($newStudent): void {
                        $newStudent->where('santri.catatan_import', 'SANTRI_BARU_2026')
                            ->where('santri.status_verifikasi', 'terverifikasi_aktif');
                    });
            });
    }

    private function isCanonicalCandidate(int $santriId): bool
    {
        return $this->canonicalCandidateQuery()->where('santri.santri_id', $santriId)->exists();
    }

    private function assertRelationConflictsAreSafe(int $sourceId, int $targetId): void
    {
        $uniqueRelations = [
            'absensi' => ['jenis_kegiatan_id', 'jadwal_id', 'tanggal'],
            'santri_kegiatan_partisipasi' => ['jenis_kegiatan_id'],
            'santri_pendidikan' => ['tahun_ajaran'],
            'raport_pengajian' => ['bulan', 'tahun'],
            'raport_ubudiyah' => ['bulan', 'tahun'],
            'report_documents' => ['jenis', 'tahun_pelajaran', 'semester', 'versi'],
        ];

        foreach ($uniqueRelations as $table => $columns) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $sourceRows = DB::table($table)->where('santri_id', $sourceId)->get($columns);
            foreach ($sourceRows as $sourceRow) {
                $targetQuery = DB::table($table)->where('santri_id', $targetId);
                foreach ($columns as $column) {
                    $value = $sourceRow->{$column};
                    $value === null ? $targetQuery->whereNull($column) : $targetQuery->where($column, $value);
                }
                if ($targetQuery->exists()) {
                    throw new \RuntimeException('Tidak dapat digabung: ditemukan konflik record unik pada '.$table.'. Selesaikan konflik tersebut terlebih dahulu.');
                }
            }
        }

        if (Schema::hasTable('wali_accounts')) {
            $sourceHasAccount = DB::table('wali_accounts')->where('santri_id', $sourceId)->exists();
            $targetHasAccount = DB::table('wali_accounts')->where('santri_id', $targetId)->exists();
            if ($sourceHasAccount && $targetHasAccount) {
                throw new \RuntimeException('Tidak dapat digabung: kedua data sudah memiliki akun wali santri.');
            }
        }
    }

    private function hasFinalDecision(object $review): bool
    {
        return in_array($review->status, ['digabung', 'terpisah'], true)
            || in_array($review->keputusan_admin ?? null, ['terkonfirmasi', 'digabung', 'terpisah'], true);
    }

    private function cleanDecisionNote(?string $value): ?string
    {
        $clean = preg_replace('/\s+/u', ' ', strip_tags(trim((string) $value))) ?? '';
        return $clean !== '' ? $clean : null;
    }

    private function writeDecisionAudit(
        Request $request,
        int $reviewId,
        string $businessAction,
        array $before,
        array $after,
        ?int $targetSantriId = null
    ): void {
        DB::table('log_aktivitas')->insert([
            'petugas_id' => $request->user()->petugas_id,
            'aksi' => 'UPDATE',
            'nama_tabel' => 'santri_import_reviews',
            'record_id' => $reviewId,
            'data_sebelum' => json_encode([
                'aksi_bisnis' => $businessAction,
                'target_santri_id' => $targetSantriId,
                'review' => $before,
            ], JSON_UNESCAPED_UNICODE),
            'data_sesudah' => json_encode([
                'aksi_bisnis' => $businessAction,
                'target_santri_id' => $targetSantriId,
                'review' => $after,
            ], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
        ]);
    }

}
