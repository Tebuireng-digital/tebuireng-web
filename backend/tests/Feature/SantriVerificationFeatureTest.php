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
}
