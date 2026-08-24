<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SantriFotoFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_and_pembina_kamar_can_upload_santri_photo(): void
    {
        Storage::fake('public');

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs']);
        $kamarId = DB::table('kamar')->insertGetId(['nama' => 'Kamar A01', 'status_aktif' => 1]);
        $otherKamarId = DB::table('kamar')->insertGetId(['nama' => 'Kamar B02', 'status_aktif' => 1]);

        $santriId = DB::table('santri')->insertGetId([
            'no_id_induk' => '10001',
            'nama' => 'Santri Photo Test',
            'unit_id' => $unitId,
            'kamar_id' => $kamarId,
            'status_aktif' => 1,
            'password_hash' => Hash::make('password123'),
        ]);

        $admin = Petugas::create([
            'nama' => 'Admin User',
            'username' => 'admin_photo',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $pembina = Petugas::create([
            'nama' => 'Pembina Kamar',
            'username' => 'pembina_photo',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        // Assign pembina to Kamar A01
        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $pembina->petugas_id,
            'tipe_target' => 'Kamar',
            'target_id' => $kamarId,
            'tanggal_mulai' => now()->subDay()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $otherPembina = Petugas::create([
            'nama' => 'Other Pembina',
            'username' => 'other_pembina',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        // Assign otherPembina to Kamar B02
        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $otherPembina->petugas_id,
            'tipe_target' => 'Kamar',
            'target_id' => $otherKamarId,
            'tanggal_mulai' => now()->subDay()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 1. Unassigned Pembina forbidden
        $file = UploadedFile::fake()->image('santri.jpg');
        $this->actingAs($otherPembina, 'sanctum')
            ->postJson("/api/santri/{$santriId}/foto", ['foto' => $file])
            ->assertStatus(403);

        // 2. Assigned Pembina can upload photo
        $response = $this->actingAs($pembina, 'sanctum')
            ->postJson("/api/santri/{$santriId}/foto", ['foto' => $file])
            ->assertOk()
            ->assertJsonPath('message', 'Foto santri berhasil diperbarui.');

        $fotoPath = $response->json('foto_path');
        Storage::disk('public')->assertExists($fotoPath);

        // 3. Admin can upload photo and overwrite
        $newFile = UploadedFile::fake()->image('new_santri.png');
        $responseAdmin = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/santri/{$santriId}/foto", ['foto' => $newFile])
            ->assertOk();

        $newFotoPath = $responseAdmin->json('foto_path');
        Storage::disk('public')->assertExists($newFotoPath);
        Storage::disk('public')->assertMissing($fotoPath);

        // 4. Portal Santri returns foto_url
        DB::table('wali_accounts')->insert([
            'santri_id' => $santriId,
            'username' => '10001',
            'password_hash' => Hash::make('password123'),
            'wajib_ganti_password' => false,
            'status_aktif' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/santri-portal/login', [
            'no_id_induk' => '10001',
            'password' => 'password123',
        ])->assertOk()
            ->assertJsonPath('user.foto_url', Storage::url($newFotoPath));
    }
}
