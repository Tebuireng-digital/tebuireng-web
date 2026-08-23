<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SantriPortalFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_santri_can_login_with_nomor_induk_pondok(): void
    {
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $santriId = DB::table('santri')->insertGetId([
            'no_id_induk' => '7206032',
            'nama' => 'Santri Portal',
            'unit_id' => $unitId,
            'status_aktif' => 1,
            'password_hash' => Hash::make('masuk123'),
            'wajib_ganti_password' => true,
        ]);
        $madinId = DB::table('kelompok_madin')->insertGetId(['jenjang' => 'SMP', 'nama_kelas_madin' => 'Madin A']);
        $pbsId = DB::table('kelompok_pbs')->insertGetId(['kategori' => 'SUBUH', 'nama_kelompok' => 'Al-Quran Subuh A']);
        $pbmId = DB::table('kelompok_pbm')->insertGetId(['kategori' => 'TAKHASUS', 'nama_kelompok' => 'Takhasus A']);
        DB::table('santri')->where('santri_id', $santriId)->update([
            'kelompok_madin_id' => $madinId,
            'kelompok_pbs_id' => $pbsId,
            'kelompok_pbm_id' => $pbmId,
        ]);
        DB::table('wali_accounts')->insert([
            'santri_id' => $santriId,
            'username' => '7206032',
            'password_hash' => Hash::make('masuk123'),
            'wajib_ganti_password' => true,
            'status_aktif' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/santri-portal/login', [
            'no_id_induk' => '7206032',
            'password' => 'masuk123',
        ])->assertOk()
            ->assertJsonPath('user.no_id_induk', '7206032')
            ->assertJsonPath('user.nama_madin', 'Madin A')
            ->assertJsonPath('user.nama_al_quran_subuh', 'Al-Quran Subuh A')
            ->assertJsonPath('user.nama_takhasus', 'Takhasus A')
            ->assertJsonPath('user.wajib_ganti_password', true);

        $this->getJson('/api/santri-portal/kehadiran')->assertOk();
        $this->getJson('/api/santri-portal/prestasi')->assertOk();
    }

    public function test_santri_can_change_initial_password_and_access_portal(): void
    {
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $santriId = DB::table('santri')->insertGetId([
            'no_id_induk' => '7206033',
            'nama' => 'Santri Portal Dua',
            'unit_id' => $unitId,
            'status_aktif' => 1,
            'password_hash' => Hash::make('masuk123'),
            'wajib_ganti_password' => true,
        ]);
        DB::table('wali_accounts')->insert([
            'santri_id' => $santriId,
            'username' => '7206033',
            'password_hash' => Hash::make('masuk123'),
            'wajib_ganti_password' => true,
            'status_aktif' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/santri-portal/login', [
            'no_id_induk' => '7206033',
            'password' => 'masuk123',
        ])->assertOk();

        $this->postJson('/api/santri-portal/ganti-password', [
            'old_password' => 'masuk123',
            'new_password' => 'PortalSantri123',
            'new_password_confirmation' => 'PortalSantri123',
        ])->assertOk();

        $this->getJson('/api/santri-portal/kehadiran')->assertOk();
    }
}
