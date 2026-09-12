<?php

namespace Tests\Feature;

use App\Models\Petugas;
use App\Models\Santri;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RaportLockFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected Petugas $admin;
    protected Petugas $pembina;
    protected Petugas $pembinaLain;
    protected int $kamarId;
    protected int $santriId1;
    protected int $santriId2;
    protected int $instrumenId1;
    protected int $instrumenId2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->kamarId = DB::table('kamar')->insertGetId([
            'nama' => 'Kamar AB 101',
        ]);

        $unitId = DB::table('unit_pendidikan')->insertGetId([
            'kode' => 'SMP',
            'nama' => 'SMP',
        ]);

        $this->santriId1 = DB::table('santri')->insertGetId([
            'nama' => 'Santri Satu',
            'kamar_id' => $this->kamarId,
            'unit_id' => $unitId,
            'status_aktif' => 1,
        ]);

        $this->santriId2 = DB::table('santri')->insertGetId([
            'nama' => 'Santri Dua',
            'kamar_id' => $this->kamarId,
            'unit_id' => $unitId,
            'status_aktif' => 1,
        ]);

        $this->admin = Petugas::create([
            'nama' => 'Admin Utama',
            'username' => 'admin_test',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $this->pembina = Petugas::create([
            'nama' => 'Pembina Kamar 1',
            'username' => 'pembina_test',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $this->pembinaLain = Petugas::create([
            'nama' => 'Pembina Lain',
            'username' => 'pembina_lain',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $this->pembina->petugas_id,
            'tipe_target' => 'Kamar',
            'target_id' => $this->kamarId,
            'tanggal_mulai' => now()->toDateString(),
        ]);

        $this->instrumenId1 = DB::table('master_instrumen_ubudiyah')->insertGetId([
            'nama_instrumen' => 'Sholat Berjamaah',
            'status_aktif' => 1,
            'dibuat_oleh' => $this->admin->petugas_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->instrumenId2 = DB::table('master_instrumen_ubudiyah')->insertGetId([
            'nama_instrumen' => 'Kebersihan Kamar',
            'status_aktif' => 1,
            'dibuat_oleh' => $this->admin->petugas_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_session_returns_lock_status_as_draft_by_default(): void
    {
        $response = $this->actingAs($this->pembina)->getJson("/api/ubudiyah/session?target_id={$this->kamarId}&bulan=9&tahun=2026");

        $response->assertStatus(200)
            ->assertJsonPath('lock_status.is_locked', false)
            ->assertJsonPath('lock_status.status', 'draft');
    }

    public function test_bulk_upsert_allows_saving_in_draft_state(): void
    {
        $payload = [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026/2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId1,
                    'nilai' => [$this->instrumenId1 => 80],
                    'catatan' => [$this->instrumenId1 => 'Bagus'],
                ],
                [
                    'santri_id' => $this->santriId2,
                    'nilai' => [$this->instrumenId1 => 75],
                    'catatan' => [$this->instrumenId1 => 'Perlu ditingkatkan'],
                ],
            ],
        ];

        $response = $this->actingAs($this->pembina)->postJson('/api/ubudiyah/bulk', $payload);
        $response->assertStatus(200);

        $this->assertDatabaseHas('raport_ubudiyah', [
            'santri_id' => $this->santriId1,
            'status' => 'draft',
        ]);
    }

    public function test_lock_fails_if_scores_are_incomplete(): void
    {
        // Only save instrumenId1, leaving instrumenId2 empty
        $this->actingAs($this->pembina)->postJson('/api/ubudiyah/bulk', [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026/2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId1,
                    'nilai' => [$this->instrumenId1 => 80],
                    'catatan' => [],
                ],
                [
                    'santri_id' => $this->santriId2,
                    'nilai' => [$this->instrumenId1 => 85],
                    'catatan' => [],
                ],
            ],
        ]);

        $response = $this->actingAs($this->pembina)->postJson('/api/ubudiyah/lock', [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', fn ($msg) => str_contains((string) $msg, 'Belum ada santri baru dengan nilai lengkap untuk dikunci'));
    }

    public function test_hybrid_lock_locks_completed_santri_and_leaves_incomplete_as_draft(): void
    {
        // Santri 1 has full scores; Santri 2 has partial scores
        $this->actingAs($this->pembina)->postJson('/api/ubudiyah/bulk', [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026/2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId1,
                    'nilai' => [
                        $this->instrumenId1 => 85,
                        $this->instrumenId2 => 90,
                    ],
                    'catatan' => [],
                ],
                [
                    'santri_id' => $this->santriId2,
                    'nilai' => [
                        $this->instrumenId1 => 80,
                        // instrumenId2 left empty
                    ],
                    'catatan' => [],
                ],
            ],
        ]);

        // Hybrid lock: Santri 1 locks, Santri 2 stays draft
        $response = $this->actingAs($this->pembina)->postJson('/api/ubudiyah/lock', [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('lock_status.is_partially_locked', true)
            ->assertJsonPath('lock_status.locked_count', 1)
            ->assertJsonPath('lock_status.total_count', 2);

        $this->assertDatabaseHas('raport_ubudiyah', [
            'santri_id' => $this->santriId1,
            'status' => 'dikunci',
        ]);

        $this->assertDatabaseHas('raport_ubudiyah', [
            'santri_id' => $this->santriId2,
            'status' => 'draft',
        ]);

        // Santri 2 can still be updated by pembina
        $updateRes = $this->actingAs($this->pembina)->postJson('/api/ubudiyah/bulk', [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026/2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId2,
                    'nilai' => [
                        $this->instrumenId1 => 80,
                        $this->instrumenId2 => 88,
                    ],
                    'catatan' => [],
                ],
            ],
        ]);
        $updateRes->assertStatus(200);
    }

    public function test_lock_succeeds_when_all_scores_are_filled(): void
    {
        // Fill all instruments for all santri
        $this->actingAs($this->pembina)->postJson('/api/ubudiyah/bulk', [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026/2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId1,
                    'nilai' => [
                        $this->instrumenId1 => 80,
                        $this->instrumenId2 => 85,
                    ],
                    'catatan' => [],
                ],
                [
                    'santri_id' => $this->santriId2,
                    'nilai' => [
                        $this->instrumenId1 => 90,
                        $this->instrumenId2 => 92,
                    ],
                    'catatan' => [],
                ],
            ],
        ]);

        $response = $this->actingAs($this->pembina)->postJson('/api/ubudiyah/lock', [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('lock_status.is_locked', true)
            ->assertJsonPath('lock_status.status', 'dikunci');

        $this->assertDatabaseHas('raport_ubudiyah', [
            'santri_id' => $this->santriId1,
            'status' => 'dikunci',
            'dikunci_oleh' => $this->pembina->petugas_id,
        ]);

        // Verify session returns is_locked true
        $sessionRes = $this->actingAs($this->pembina)->getJson("/api/ubudiyah/session?target_id={$this->kamarId}&bulan=9&tahun=2026");
        $sessionRes->assertStatus(200)
            ->assertJsonPath('lock_status.is_locked', true);
    }

    public function test_editing_locked_raport_is_forbidden_for_non_admin(): void
    {
        $this->test_lock_succeeds_when_all_scores_are_filled();

        $updatePayload = [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026/2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId1,
                    'nilai' => [
                        $this->instrumenId1 => 99,
                        $this->instrumenId2 => 99,
                    ],
                    'catatan' => [],
                ],
                [
                    'santri_id' => $this->santriId2,
                    'nilai' => [
                        $this->instrumenId1 => 99,
                        $this->instrumenId2 => 99,
                    ],
                    'catatan' => [],
                ],
            ],
        ];

        // Non-admin attempt should be blocked when all are locked
        $res = $this->actingAs($this->pembina)->postJson('/api/ubudiyah/bulk', $updatePayload);
        $res->assertStatus(422)
            ->assertJsonPath('message', fn ($msg) => str_contains((string) $msg, 'telah dikunci. Pembina tidak dapat mengubah nilai'));
    }

    public function test_admin_can_update_even_when_locked(): void
    {
        $this->test_lock_succeeds_when_all_scores_are_filled();

        $updatePayload = [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026/2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId1,
                    'nilai' => [
                        $this->instrumenId1 => 95,
                        $this->instrumenId2 => 95,
                    ],
                    'catatan' => [],
                ],
                [
                    'santri_id' => $this->santriId2,
                    'nilai' => [
                        $this->instrumenId1 => 95,
                        $this->instrumenId2 => 95,
                    ],
                    'catatan' => [],
                ],
            ],
        ];

        $adminRes = $this->actingAs($this->admin)->postJson('/api/ubudiyah/bulk', $updatePayload);
        $adminRes->assertStatus(200);
    }

    public function test_unlock_reverts_status_to_draft_and_allows_editing(): void
    {
        $this->test_lock_succeeds_when_all_scores_are_filled();

        // Unlock with reason
        $unlockRes = $this->actingAs($this->pembina)->postJson('/api/ubudiyah/unlock', [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
            'alasan' => 'Ada koreksi nilai sholat dhuha santri satu',
        ]);

        $unlockRes->assertStatus(200)
            ->assertJsonPath('lock_status.is_locked', false)
            ->assertJsonPath('lock_status.status', 'draft');

        $this->assertDatabaseHas('raport_ubudiyah', [
            'santri_id' => $this->santriId1,
            'status' => 'draft',
            'alasan_buka_kunci' => 'Ada koreksi nilai sholat dhuha santri satu',
        ]);

        // Pembina can now edit again
        $editRes = $this->actingAs($this->pembina)->postJson('/api/ubudiyah/bulk', [
            'target_id' => $this->kamarId,
            'bulan' => 9,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026/2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId1,
                    'nilai' => [
                        $this->instrumenId1 => 88,
                        $this->instrumenId2 => 85,
                    ],
                    'catatan' => [],
                ],
                [
                    'santri_id' => $this->santriId2,
                    'nilai' => [
                        $this->instrumenId1 => 90,
                        $this->instrumenId2 => 92,
                    ],
                    'catatan' => [],
                ],
            ],
        ]);
        $editRes->assertStatus(200);
    }

    public function test_kamar_summary_returns_progress_and_lock_status(): void
    {
        $response = $this->actingAs($this->pembina)->getJson('/api/ubudiyah/kamar-summary?bulan=9&tahun=2026');
        $response->assertStatus(200)
            ->assertJsonIsArray();

        $item = collect($response->json())->firstWhere('kamar_id', $this->kamarId);
        $this->assertNotNull($item);
        $this->assertEquals('Kamar AB 101', $item['nama_kamar']);
        $this->assertEquals(2, $item['santri_count']);
        $this->assertArrayHasKey('percentage', $item);
        $this->assertArrayHasKey('status', $item);
        $this->assertArrayHasKey('is_locked', $item);
    }
}
