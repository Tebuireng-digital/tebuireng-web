<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SantriVerificationFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_store_profile_no_id_orda_and_view_verification_queue(): void
    {
        $admin = Petugas::create([
            'nama' => 'Admin Verifikasi',
            'username' => 'admin-verifikasi',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
        ]);
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs']);
        $ordaId = DB::table('organisasi_daerah')->where('kode', 'HISLA')->value('organisasi_daerah_id');

        $this->actingAs($admin, 'sanctum');

        $response = $this->postJson('/api/master/santri', [
            'no_id_induk' => '7206032',
            'nik_siswa' => '3217062006080001',
            'nama' => 'Santri Uji',
            'jenis_kelamin' => 'L',
            'tempat_lahir' => 'Jombang',
            'tanggal_lahir' => '2008-06-20',
            'provinsi' => 'Jawa Timur',
            'kabupaten_kota' => 'Kab. Lamongan',
            'unit_id' => $unitId,
            'organisasi_daerah_id' => $ordaId,
            'status_verifikasi' => 'perlu_mapping_kegiatan',
            'no_kk' => '3515082601093314',
            'nama_ayah' => 'Ayah Uji',
            'pend_sumber' => 'MTS',
            'kelas_sumber' => '1A',
        ])->assertCreated();

        $santriId = $response->json('santri_id');
        $this->assertDatabaseHas('santri', [
            'santri_id' => $santriId,
            'no_id_induk' => '7206032',
            'nik_siswa' => '3217062006080001',
            'status_verifikasi' => 'perlu_mapping_kegiatan',
        ]);
        $this->assertDatabaseHas('santri_keluarga', ['santri_id' => $santriId, 'nama_ayah' => 'Ayah Uji']);
        $this->assertDatabaseHas('santri_pendidikan', ['santri_id' => $santriId, 'kelas_sumber' => '1A']);
        $this->assertDatabaseHas('santri_organisasi_daerah', ['santri_id' => $santriId, 'organisasi_daerah_id' => $ordaId, 'status' => 'aktif']);

        $this->getJson('/api/master/santri/verifikasi')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonFragment(['santri_id' => $santriId]);

        $this->getJson('/api/master/santri/verifikasi-orda')
            ->assertOk()
            ->assertJsonPath('total', 0);
    }

    public function test_verification_queue_filters_by_search_and_missing_type(): void
    {
        $admin = Petugas::create([
            'nama' => 'Admin Test Filter',
            'username' => 'admin-filter',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
        ]);
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs']);

        // Santri 1: Profil Blank & No ID
        $santri1Id = DB::table('santri')->insertGetId([
            'no_id_induk' => null,
            'nama' => 'Ahmad Syauqi',
            'unit_id' => $unitId,
            'status_aktif' => 1,
            'status_verifikasi' => 'perlu_verifikasi',
        ]);

        // Santri 2: Punya ID tapi Kamar Blank
        $santri2Id = DB::table('santri')->insertGetId([
            'no_id_induk' => '11223344',
            'nama' => 'Badrul Kamal',
            'unit_id' => $unitId,
            'status_aktif' => 1,
            'status_verifikasi' => 'perlu_verifikasi',
        ]);

        $this->actingAs($admin, 'sanctum');

        // Test search name
        $this->getJson('/api/master/santri/verifikasi?search=Syauqi')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonFragment(['santri_id' => $santri1Id]);

        // Test search ID
        $this->getJson('/api/master/santri/verifikasi?search=11223344')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonFragment(['santri_id' => $santri2Id]);

        // Test missing tanpa_no_id
        $this->getJson('/api/master/santri/verifikasi?missing=tanpa_no_id')
            ->assertOk()
            ->assertJsonFragment(['santri_id' => $santri1Id]);

        // Test missing profil_blank
        $this->getJson('/api/master/santri/verifikasi?missing=profil_blank')
            ->assertOk()
            ->assertJsonFragment(['santri_id' => $santri1Id]);
    }
}
