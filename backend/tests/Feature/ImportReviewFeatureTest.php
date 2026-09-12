<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ImportReviewFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_candidate_options_only_returns_active_canonical_students(): void
    {
        $admin = $this->createAdmin('review-candidates');
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs']);

        $canonicalId = $this->createSantri($unitId, 'Santri Canonical', [
            'no_id_induk' => '1001',
            'catatan_import' => 'MASTER_PUTRA',
            'status_siswa_sumber' => 'aktif',
            'status_verifikasi' => 'siap_operasional',
        ]);
        $verifiedNewId = $this->createSantri($unitId, 'Santri Baru Terverifikasi', [
            'no_id_induk' => null,
            'catatan_import' => 'SANTRI_BARU_2026',
            'status_siswa_sumber' => 'santri_baru_2026',
            'status_verifikasi' => 'terverifikasi_aktif',
        ]);
        $this->createSantri($unitId, 'Santri Legacy', [
            'no_id_induk' => '9001',
            'catatan_import' => 'LEGACY',
            'status_siswa_sumber' => 'legacy_noncanonical',
        ]);
        $this->createSantri($unitId, 'Santri Baru Belum Verifikasi', [
            'no_id_induk' => null,
            'catatan_import' => 'SANTRI_BARU_2026',
            'status_siswa_sumber' => 'santri_baru_2026',
            'status_verifikasi' => 'perlu_verifikasi',
        ]);

        $this->actingAs($admin, 'sanctum');

        $response = $this->getJson('/api/master/import-reviews/candidates')->assertOk();

        $this->assertEqualsCanonicalizing(
            [$canonicalId, $verifiedNewId],
            collect($response->json())->pluck('santri_id')->all()
        );
    }

    public function test_candidate_only_review_is_confirmed_without_moving_transactions(): void
    {
        $admin = $this->createAdmin('review-confirm');
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs']);
        $targetId = $this->createSantri($unitId, 'Master Canonical', [
            'no_id_induk' => '2001',
            'catatan_import' => 'MASTER_PUTRA',
            'status_siswa_sumber' => 'aktif',
            'status_verifikasi' => 'siap_operasional',
        ]);
        $reviewId = DB::table('santri_import_reviews')->insertGetId([
            'sumber_sheet' => 'ABSENSI_KAMAR',
            'baris_sumber' => 7,
            'nama_sumber' => 'MASTER CANONICAL',
            'kandidat_santri_id' => $targetId,
            'status' => 'perlu_tinjau',
            'status_sumber_review' => 'REVIEW',
            'tipe_review' => 'kandidat_workbook',
            'keputusan_admin' => 'belum_diputuskan',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin, 'sanctum');

        $this->postJson("/api/master/import-reviews/{$reviewId}/confirm", [
            'catatan' => '<b>ID</b> dan konteks kamar sesuai.',
        ])->assertOk();

        $this->assertDatabaseHas('santri_import_reviews', [
            'review_id' => $reviewId,
            'status' => 'digabung',
            'keputusan_admin' => 'terkonfirmasi',
            'status_tindak_lanjut' => 'tertaut_ke_master',
            'catatan_keputusan' => 'ID dan konteks kamar sesuai.',
        ]);
        $this->assertDatabaseHas('log_aktivitas', [
            'nama_tabel' => 'santri_import_reviews',
            'record_id' => $reviewId,
            'aksi' => 'UPDATE',
        ]);

        $this->postJson("/api/master/import-reviews/{$reviewId}/confirm", [
            'kandidat_santri_id' => $targetId,
        ])->assertStatus(422);
    }

    public function test_separate_persists_follow_up_and_cannot_be_overwritten(): void
    {
        $admin = $this->createAdmin('review-separate');
        $reviewId = DB::table('santri_import_reviews')->insertGetId([
            'sumber_sheet' => 'PBS',
            'baris_sumber' => 8,
            'nama_sumber' => 'SANTRI BERBEDA',
            'status' => 'perlu_tinjau',
            'status_sumber_review' => 'UNMATCHED',
            'tipe_review' => 'verifikasi_manual',
            'keputusan_admin' => 'belum_diputuskan',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin, 'sanctum');

        $this->postJson("/api/master/import-reviews/{$reviewId}/separate", [
            'catatan' => 'Dipastikan berbeda berdasarkan kamar dan kelas.',
            'sudah_ada_di_master' => false,
        ])->assertOk();

        $this->assertDatabaseHas('santri_import_reviews', [
            'review_id' => $reviewId,
            'status' => 'terpisah',
            'keputusan_admin' => 'terpisah',
            'status_tindak_lanjut' => 'terpisah_belum_ada_di_master',
        ]);

        $this->postJson("/api/master/import-reviews/{$reviewId}/separate", [
            'sudah_ada_di_master' => true,
        ])->assertStatus(422);
    }

    public function test_merge_rejects_noncanonical_target_and_archives_valid_source(): void
    {
        $admin = $this->createAdmin('review-merge');
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMA', 'nama' => 'SMA']);
        $sourceId = $this->createSantri($unitId, 'Santri Auto Create', [
            'no_id_induk' => null,
            'catatan_import' => 'AUTO_REVIEW',
            'status_siswa_sumber' => 'santri_baru_2026',
            'status_verifikasi' => 'perlu_verifikasi',
        ]);
        $targetId = $this->createSantri($unitId, 'Master Canonical', [
            'no_id_induk' => '3001',
            'catatan_import' => 'MASTER_PUTRA',
            'status_siswa_sumber' => 'aktif',
            'status_verifikasi' => 'siap_operasional',
        ]);
        $legacyId = $this->createSantri($unitId, 'Master Legacy', [
            'no_id_induk' => '3002',
            'catatan_import' => 'LEGACY',
            'status_siswa_sumber' => 'legacy_noncanonical',
        ]);
        $reviewId = DB::table('santri_import_reviews')->insertGetId([
            'sumber_sheet' => 'MADIN',
            'baris_sumber' => 9,
            'nama_sumber' => 'SANTRI AUTO CREATE',
            'santri_otomatis_id' => $sourceId,
            'kandidat_santri_id' => $targetId,
            'status' => 'perlu_tinjau',
            'status_sumber_review' => 'REVIEW',
            'tipe_review' => 'santri_auto_create',
            'keputusan_admin' => 'belum_diputuskan',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin, 'sanctum');

        $this->postJson("/api/master/import-reviews/{$reviewId}/merge", [
            'kandidat_santri_id' => $legacyId,
        ])->assertStatus(422);

        $this->postJson("/api/master/import-reviews/{$reviewId}/merge", [
            'kandidat_santri_id' => $targetId,
        ])->assertOk();

        $this->assertDatabaseHas('santri', [
            'santri_id' => $sourceId,
            'status_aktif' => 0,
            'status_siswa_sumber' => 'merged_archived',
        ]);
        $this->assertDatabaseHas('santri_import_reviews', [
            'review_id' => $reviewId,
            'status' => 'digabung',
            'keputusan_admin' => 'digabung',
            'santri_otomatis_id' => null,
        ]);
    }

    public function test_canonical_sync_preserves_final_decision_and_flags_changed_source_context(): void
    {
        $workbook = base_path('../data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx');
        if (!is_file($workbook)) {
            $this->markTestSkipped('Workbook canonical tidak tersedia di environment test.');
        }

        $this->assertSame(0, Artisan::call('import:master-putra', ['--file' => $workbook]));
        $review = DB::table('santri_import_reviews')->orderBy('review_id')->first();
        $this->assertNotNull($review);
        $this->assertSame('xlsx/Database_Kelas_Madin_2026_2027.xlsx', $review->sumber_file_excel);
        $this->assertSame('Database Siswa Madin', $review->sumber_sheet_excel);
        $this->assertSame(110, (int) $review->sumber_baris_excel);
        $this->assertSame('data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx', $review->review_file_excel);
        $this->assertSame('REVIEW_MATCH', $review->review_sheet_excel);
        $this->assertSame(2, (int) $review->review_baris_excel);
        $this->assertSame('TERVERIFIKASI', $review->status_provenance);
        $this->assertSame(516, DB::table('santri_import_reviews')->count());
        $this->assertSame(163, DB::table('santri_import_reviews')->where('sumber_sheet', 'ABSENSI_KAMAR')->count());

        DB::table('santri_import_reviews')->where('review_id', $review->review_id)->update([
            'status' => 'digabung',
            'keputusan_admin' => 'digabung',
            'status_sumber_review' => 'MANUAL_TEST_SNAPSHOT',
            'perlu_review_ulang' => false,
        ]);

        $this->assertSame(0, Artisan::call('import:master-putra', ['--file' => $workbook]));

        $fresh = DB::table('santri_import_reviews')->where('review_id', $review->review_id)->first();
        $this->assertSame('digabung', $fresh->status);
        $this->assertSame('digabung', $fresh->keputusan_admin);
        $this->assertTrue((bool) $fresh->perlu_review_ulang);
        $this->assertContains($fresh->status_sumber_review, ['EXACT', 'REVIEW', 'UNMATCHED']);
        $this->assertSame(516, DB::table('santri_import_reviews')->count());
    }

    public function test_review_index_does_not_expose_zero_for_missing_score_or_false_flag(): void
    {
        $admin = $this->createAdmin('review-display');
        $reviewId = DB::table('santri_import_reviews')->insertGetId([
            'sumber_sheet' => 'PBS',
            'baris_sumber' => 8,
            'nama_sumber' => 'TANPA KANDIDAT',
            'skor_kemiripan' => null,
            'status' => 'perlu_tinjau',
            'status_sumber_review' => 'UNMATCHED',
            'tipe_review' => 'verifikasi_manual',
            'keputusan_admin' => 'belum_diputuskan',
            'perlu_review_ulang' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin, 'sanctum');

        $item = collect($this->getJson('/api/master/import-reviews')->assertOk()->json())
            ->firstWhere('review_id', $reviewId);

        $this->assertNotNull($item);
        $this->assertNull($item['skor_kemiripan']);
        $this->assertFalse($item['perlu_review_ulang']);
    }

    private function createAdmin(string $suffix): Petugas
    {
        return Petugas::create([
            'nama' => 'Admin '.$suffix,
            'username' => 'admin-'.$suffix,
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
        ]);
    }

    private function createSantri(int $unitId, string $name, array $overrides = []): int
    {
        return DB::table('santri')->insertGetId(array_merge([
            'nama' => $name,
            'unit_id' => $unitId,
            'status_aktif' => 1,
            'status_verifikasi' => 'perlu_verifikasi',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }
}
