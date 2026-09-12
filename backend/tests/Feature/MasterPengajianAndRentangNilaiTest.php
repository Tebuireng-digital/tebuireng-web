<?php

namespace Tests\Feature;

use App\Models\MasterInstrumenUbudiyah;
use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MasterPengajianAndRentangNilaiTest extends TestCase
{
    use RefreshDatabase;

    protected Petugas $admin;
    protected Petugas $nonAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Petugas::create([
            'nama' => 'Admin Test',
            'username' => 'admin_test',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $this->nonAdmin = Petugas::create([
            'nama' => 'Pembina Test',
            'username' => 'pembina_test',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);
    }

    public function test_admin_can_list_and_create_master_pengajian_instrument(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/raport-pengajian/master?jenis=AL_QURAN');

        $response->assertOk();

        // Create new instrument
        $createRes = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/raport-pengajian/master', [
                'jenis_pengajian' => 'AL_QURAN',
                'nama_instrumen' => 'Gharib Musykilat',
            ]);

        $createRes->assertStatus(201)
            ->assertJsonFragment(['message' => 'Kriteria pengajian berhasil ditambahkan']);

        $this->assertDatabaseHas('master_instrumen_pengajian', [
            'jenis_pengajian' => 'AL_QURAN',
            'nama_instrumen' => 'Gharib Musykilat',
            'status_aktif' => 1,
        ]);

        // Duplicate name under same jenis is rejected
        $dupRes = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/raport-pengajian/master', [
                'jenis_pengajian' => 'AL_QURAN',
                'nama_instrumen' => 'Gharib Musykilat',
            ]);

        $dupRes->assertStatus(422);
    }

    public function test_admin_can_update_and_toggle_instrument(): void
    {
        $id = DB::table('master_instrumen_pengajian')->insertGetId([
            'jenis_pengajian' => 'TAKHASSUS',
            'nama_instrumen' => 'Balaqhah',
            'urutan' => 1,
            'status_aktif' => 1,
            'dibuat_oleh' => $this->admin->petugas_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Update name
        $updateRes = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/raport-pengajian/master/{$id}", [
                'nama_instrumen' => 'Balaghah',
            ]);

        $updateRes->assertOk();
        $this->assertDatabaseHas('master_instrumen_pengajian', [
            'instrumen_id' => $id,
            'nama_instrumen' => 'Balaghah',
        ]);

        // Toggle status
        $toggleRes = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/raport-pengajian/master/{$id}/toggle");

        $toggleRes->assertOk();
        $this->assertDatabaseHas('master_instrumen_pengajian', [
            'instrumen_id' => $id,
            'status_aktif' => 0,
        ]);
    }

    public function test_destroy_instrument_blocked_when_historical_scores_exist(): void
    {
        $id = DB::table('master_instrumen_pengajian')->insertGetId([
            'jenis_pengajian' => 'AL_QURAN',
            'nama_instrumen' => 'Tajwid Lanjutan',
            'urutan' => 10,
            'status_aktif' => 1,
            'dibuat_oleh' => $this->admin->petugas_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Create santri and parent raport_pengajian
        $santriId = DB::table('santri')->insertGetId([
            'nama' => 'Santri Test',
            'nis' => 'SN001',
            'status_aktif' => 1,
        ]);

        $raportId = DB::table('raport_pengajian')->insertGetId([
            'santri_id' => $santriId,
            'tahun_pelajaran' => '2025/2026',
            'semester' => 'Ganjil',
            'bulan' => 9,
            'tahun' => 2026,
            'diisi_oleh' => $this->admin->petugas_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Record exists in raport_nilai
        DB::table('raport_nilai')->insert([
            'raport_id' => $raportId,
            'jenis_pengajian' => 'AL_QURAN',
            'aspek' => 'Tajwid Lanjutan',
            'nilai_angka' => 88,
        ]);

        $destroyRes = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/raport-pengajian/master/{$id}");

        $destroyRes->assertStatus(422)
            ->assertJsonFragment(['message' => 'Kriteria ini sudah memiliki histori nilai dan tidak dapat dihapus. Silakan nonaktifkan statusnya.']);

        $this->assertDatabaseHas('master_instrumen_pengajian', ['instrumen_id' => $id]);
    }

    public function test_admin_can_get_and_save_rentang_nilai(): void
    {
        $getRes = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/rentang-nilai/pengajian');

        $getRes->assertOk();

        // Save customized ranges
        $saveRes = $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/rentang-nilai/pengajian', [
                'ranges' => [
                    ['huruf' => 'A', 'min_nilai' => 90, 'max_nilai' => 100, 'predikat' => 'Mumtaz'],
                    ['huruf' => 'B', 'min_nilai' => 75, 'max_nilai' => 89, 'predikat' => 'Jayyid'],
                    ['huruf' => 'C', 'min_nilai' => 60, 'max_nilai' => 74, 'predikat' => 'Maqbul'],
                    ['huruf' => 'D', 'min_nilai' => 0, 'max_nilai' => 59, 'predikat' => 'Rasib'],
                ],
            ]);

        $saveRes->assertOk()
            ->assertJsonFragment(['message' => 'Rentang nilai berhasil disimpan']);

        $this->assertDatabaseHas('master_rentang_nilai', [
            'kategori' => 'pengajian',
            'huruf' => 'A',
            'min_nilai' => 90,
            'max_nilai' => 100,
            'predikat' => 'Mumtaz',
        ]);
    }

    public function test_rentang_nilai_rejects_overlapping_ranges(): void
    {
        $res = $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/rentang-nilai/pengajian', [
                'ranges' => [
                    ['huruf' => 'A', 'min_nilai' => 85, 'max_nilai' => 100, 'predikat' => 'Mumtaz'],
                    ['huruf' => 'B', 'min_nilai' => 80, 'max_nilai' => 90, 'predikat' => 'Jayyid'], // Overlaps with 85-100!
                ],
            ]);

        $res->assertStatus(422);
    }

    public function test_admin_can_crud_master_ubudiyah_and_deletion_is_protected(): void
    {
        // 1. Admin creates ubudiyah criteria
        $createRes = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/ubudiyah/master', [
                'nama_instrumen' => 'Shalat Dhuha Berjamaah',
            ]);

        $createRes->assertStatus(201);
        $instId = $createRes->json('data.instrumen_id');

        // 2. Duplicate name rejected
        $dupRes = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/ubudiyah/master', [
                'nama_instrumen' => 'Shalat Dhuha Berjamaah',
            ]);
        $dupRes->assertStatus(422);

        // 3. Update name
        $updateRes = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/ubudiyah/master/{$instId}", [
                'nama_instrumen' => 'Shalat Dhuha Mandiri / Jamaah',
            ]);
        $updateRes->assertOk();

        // 4. Toggle status
        $toggleRes = $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/ubudiyah/master/{$instId}/toggle");
        $toggleRes->assertOk();
        $this->assertDatabaseHas('master_instrumen_ubudiyah', [
            'instrumen_id' => $instId,
            'status_aktif' => 0,
        ]);

        // 5. Deletion blocked if historical scores exist in nilai_ubudiyah
        $kamarId = DB::table('kamar')->insertGetId([
            'nama' => 'Kamar Test 101',
            'status_aktif' => 1,
        ]);

        $santriId = DB::table('santri')->insertGetId([
            'nama' => 'Santri Ubudiyah Test',
            'nis' => 'SN002',
            'status_aktif' => 1,
        ]);

        $raportUbudiyahId = DB::table('raport_ubudiyah')->insertGetId([
            'santri_id' => $santriId,
            'kamar_id' => $kamarId,
            'tahun_pelajaran' => '2025/2026',
            'semester' => 'Ganjil',
            'bulan' => 9,
            'tahun' => 2026,
            'diisi_oleh' => $this->admin->petugas_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('nilai_ubudiyah')->insert([
            'raport_ubudiyah_id' => $raportUbudiyahId,
            'instrumen_id' => $instId,
            'nilai_angka' => 95,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $deleteRes = $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/ubudiyah/master/{$instId}");

        $deleteRes->assertStatus(422)
            ->assertJsonPath('used_count', 1);

        $this->assertDatabaseHas('master_instrumen_ubudiyah', ['instrumen_id' => $instId]);

        // Clean up mock grade to test actual deletion
        DB::table('nilai_ubudiyah')->where('instrumen_id', $instId)->delete();
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/ubudiyah/master/{$instId}")
            ->assertOk();

        $this->assertDatabaseMissing('master_instrumen_ubudiyah', ['instrumen_id' => $instId]);
    }

    public function test_non_admin_cannot_access_cms_endpoints(): void
    {
        // Pengajian CMS
        $this->actingAs($this->nonAdmin, 'sanctum')
            ->getJson('/api/raport-pengajian/master')
            ->assertForbidden();

        $this->actingAs($this->nonAdmin, 'sanctum')
            ->postJson('/api/raport-pengajian/master', [
                'jenis_pengajian' => 'AL_QURAN',
                'nama_instrumen' => 'Test',
            ])
            ->assertForbidden();

        $this->actingAs($this->nonAdmin, 'sanctum')
            ->putJson('/api/rentang-nilai/pengajian', [
                'ranges' => [],
            ])
            ->assertForbidden();

        // Ubudiyah CMS
        $this->actingAs($this->nonAdmin, 'sanctum')
            ->getJson('/api/ubudiyah/master')
            ->assertForbidden();

        $this->actingAs($this->nonAdmin, 'sanctum')
            ->postJson('/api/ubudiyah/master', [
                'nama_instrumen' => 'Forbidden Criteria',
            ])
            ->assertForbidden();

        $this->actingAs($this->nonAdmin, 'sanctum')
            ->patchJson('/api/ubudiyah/master/1/toggle')
            ->assertForbidden();

        $this->actingAs($this->nonAdmin, 'sanctum')
            ->deleteJson('/api/ubudiyah/master/1')
            ->assertForbidden();
    }
}
