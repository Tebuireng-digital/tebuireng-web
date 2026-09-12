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

    public function test_admin_and_assigned_pembina_can_upload_and_read_private_santri_photo(): void
    {
        Storage::fake('local');
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
        ]);

        // 1. Unassigned Pembina forbidden
        $file = UploadedFile::fake()->image('santri.jpg');
        $this->actingAs($otherPembina, 'sanctum')
            ->post("/api/santri/{$santriId}/foto", ['foto' => $file])
            ->assertStatus(403);

        // 2. Assigned Pembina can upload photo
        $response = $this->actingAs($pembina, 'sanctum')
            ->post("/api/santri/{$santriId}/foto", ['foto' => UploadedFile::fake()->image('santri.jpg')])
            ->assertOk()
            ->assertJsonPath('message', 'Foto santri berhasil diperbarui.');

        $fotoPath = (string) $response->json('foto_path');
        $fotoUrl = (string) $response->json('foto_url');
        $this->assertStringContainsString("/api/santri/{$santriId}/foto", $fotoUrl);
        Storage::disk('local')->assertExists($fotoPath);
        $this->assertDatabaseHas('santri', [
            'santri_id' => $santriId,
            'foto_path' => $fotoPath,
            'foto_disk' => 'local',
        ]);

        // 3. Assigned Pembina can read, unassigned cannot
        $this->actingAs($pembina, 'sanctum')
            ->get("/api/santri/{$santriId}/foto")
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->actingAs($otherPembina, 'sanctum')
            ->get("/api/santri/{$santriId}/foto")
            ->assertStatus(403);

        // 4. Admin can upload photo and overwrite
        $newFile = UploadedFile::fake()->image('new_santri.png');
        $responseAdmin = $this->actingAs($admin, 'sanctum')
            ->post("/api/santri/{$santriId}/foto", ['foto' => $newFile])
            ->assertOk();

        $newFotoPath = (string) $responseAdmin->json('foto_path');
        Storage::disk('local')->assertExists($newFotoPath);
        Storage::disk('local')->assertMissing($fotoPath);
        $this->actingAs($admin, 'sanctum')
            ->get("/api/santri/{$santriId}/foto")
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        // 5. Portal Santri returns protected foto_url
        DB::table('wali_accounts')->insert([
            'santri_id' => $santriId,
            'username' => '10001',
            'password_hash' => Hash::make('password123'),
            'wajib_ganti_password' => false,
            'status_aktif' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $portalLogin = $this->postJson('/api/santri-portal/login', [
            'no_id_induk' => '10001',
            'password' => 'password123',
        ])->assertOk();

        $portalFotoUrl = (string) $portalLogin->json('user.foto_url');
        $this->assertStringContainsString('/api/santri-portal/foto', $portalFotoUrl);

        $this->get('/api/santri-portal/foto')
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_legacy_public_photo_still_readable_through_private_endpoint(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs']);
        $kamarId = DB::table('kamar')->insertGetId(['nama' => 'Kamar Legacy', 'status_aktif' => 1]);

        $santriId = DB::table('santri')->insertGetId([
            'no_id_induk' => '10002',
            'nama' => 'Santri Legacy Photo',
            'unit_id' => $unitId,
            'kamar_id' => $kamarId,
            'status_aktif' => 1,
            'password_hash' => Hash::make('password123'),
        ]);

        $legacyFile = UploadedFile::fake()->image('legacy.jpg');
        $legacyPath = Storage::disk('public')->putFileAs('santri_foto', $legacyFile, 'legacy.jpg');

        DB::table('santri')->where('santri_id', $santriId)->update([
            'foto_path' => $legacyPath,
            'foto_disk' => 'public',
            'foto_original_filename' => 'legacy.jpg',
            'foto_mime_type' => 'image/jpeg',
            'foto_uploaded_at' => now(),
        ]);

        $admin = Petugas::create([
            'nama' => 'Admin Legacy',
            'username' => 'admin_legacy_photo',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->get("/api/santri/{$santriId}/foto")
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_upload_photo_rejects_non_image_and_oversize_payloads(): void
    {
        Storage::fake('local');

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs']);
        $kamarId = DB::table('kamar')->insertGetId(['nama' => 'Kamar Validasi', 'status_aktif' => 1]);

        $santriId = DB::table('santri')->insertGetId([
            'no_id_induk' => '10003',
            'nama' => 'Santri Validasi Foto',
            'unit_id' => $unitId,
            'kamar_id' => $kamarId,
            'status_aktif' => 1,
            'password_hash' => Hash::make('password123'),
        ]);

        $admin = Petugas::create([
            'nama' => 'Admin Validasi',
            'username' => 'admin_validasi_foto',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->withHeaders(['Accept' => 'application/json'])
            ->post("/api/santri/{$santriId}/foto", [
                'foto' => UploadedFile::fake()->create('catatan.pdf', 128, 'application/pdf'),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['foto']);

        $this->actingAs($admin, 'sanctum')
            ->withHeaders(['Accept' => 'application/json'])
            ->post("/api/santri/{$santriId}/foto", [
                'foto' => UploadedFile::fake()->image('terlalu-besar.jpg')->size(1025),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['foto']);
    }

    public function test_upload_photo_sanitizes_original_filename_and_uses_detected_mime_extension(): void
    {
        Storage::fake('local');

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs']);
        $kamarId = DB::table('kamar')->insertGetId(['nama' => 'Kamar Metadata', 'status_aktif' => 1]);

        $santriId = DB::table('santri')->insertGetId([
            'no_id_induk' => '10004',
            'nama' => 'Santri Metadata Foto',
            'unit_id' => $unitId,
            'kamar_id' => $kamarId,
            'status_aktif' => 1,
            'password_hash' => Hash::make('password123'),
        ]);

        $admin = Petugas::create([
            'nama' => 'Admin Metadata',
            'username' => 'admin_metadata_foto',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->post("/api/santri/{$santriId}/foto", [
                'foto' => UploadedFile::fake()->image("avatar<script>\r\n.php.JPEG"),
            ])
            ->assertOk();

        $fotoPath = (string) $response->json('foto_path');
        $record = DB::table('santri')
            ->select('foto_original_filename', 'foto_mime_type')
            ->where('santri_id', $santriId)
            ->first();

        $this->assertNotNull($record);
        $this->assertSame('image/jpeg', $record->foto_mime_type);
        $this->assertSame('avatar script php.jpg', $record->foto_original_filename);
        $this->assertTrue(str_ends_with($fotoPath, '.jpg'));
    }

    public function test_assigned_wali_kelas_and_piket_pengajian_can_read_santri_photo_and_unassigned_cannot(): void
    {
        Storage::fake('local');

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $kelasId = DB::table('kelas_formal')->insertGetId([
            'unit_id' => $unitId,
            'tingkat' => '7',
            'nama_kelas' => '7A',
            'tahun_ajaran' => '2026/2027',
        ]);
        $otherKelasId = DB::table('kelas_formal')->insertGetId([
            'unit_id' => $unitId,
            'tingkat' => '7',
            'nama_kelas' => '7B',
            'tahun_ajaran' => '2026/2027',
        ]);

        $pbsId = DB::table('kelompok_pbs')->insertGetId([
            'kategori' => 'KELOMPOK A',
            'nama_kelompok' => 'PBS Kelompok 1',
            'tahun_ajaran' => '2026/2027',
        ]);
        $otherPbsId = DB::table('kelompok_pbs')->insertGetId([
            'kategori' => 'KELOMPOK A',
            'nama_kelompok' => 'PBS Kelompok 2',
            'tahun_ajaran' => '2026/2027',
        ]);

        $file = UploadedFile::fake()->image('santri_roster.jpg');
        $photoPath = Storage::disk('local')->putFile('santri_foto', $file);

        $santriId = DB::table('santri')->insertGetId([
            'no_id_induk' => '10002',
            'nama' => 'Santri Roster Test',
            'unit_id' => $unitId,
            'kelas_formal_id' => $kelasId,
            'kelompok_pbs_id' => $pbsId,
            'foto_path' => $photoPath,
            'foto_disk' => 'local',
            'foto_original_filename' => 'santri_roster.jpg',
            'foto_mime_type' => 'image/jpeg',
            'foto_uploaded_at' => now(),
            'status_aktif' => 1,
            'password_hash' => Hash::make('password123'),
        ]);

        $waliAssigned = Petugas::create([
            'nama' => 'Wali Kelas 7A',
            'username' => 'wali_7a',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Wali Kelas',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);
        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $waliAssigned->petugas_id,
            'tipe_target' => 'KelasFormal',
            'target_id' => $kelasId,
            'tanggal_mulai' => now()->subDay()->toDateString(),
            'created_at' => now(),
        ]);

        $waliUnassigned = Petugas::create([
            'nama' => 'Wali Kelas 7B',
            'username' => 'wali_7b',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Wali Kelas',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);
        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $waliUnassigned->petugas_id,
            'tipe_target' => 'KelasFormal',
            'target_id' => $otherKelasId,
            'tanggal_mulai' => now()->subDay()->toDateString(),
            'created_at' => now(),
        ]);

        $piketAssigned = Petugas::create([
            'nama' => 'Piket PBS 1',
            'username' => 'piket_pbs_1',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Piket Pengajian',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);
        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $piketAssigned->petugas_id,
            'tipe_target' => 'KelompokPBS',
            'target_id' => $pbsId,
            'tanggal_mulai' => now()->subDay()->toDateString(),
            'created_at' => now(),
        ]);

        $piketUnassigned = Petugas::create([
            'nama' => 'Piket PBS 2',
            'username' => 'piket_pbs_2',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Piket Pengajian',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);
        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $piketUnassigned->petugas_id,
            'tipe_target' => 'KelompokPBS',
            'target_id' => $otherPbsId,
            'tanggal_mulai' => now()->subDay()->toDateString(),
            'created_at' => now(),
        ]);

        // Wali Kelas yang ditugaskan dapat melihat foto, yang tidak ditugaskan ditolak 403
        $this->actingAs($waliAssigned, 'sanctum')
            ->get("/api/santri/{$santriId}/foto")
            ->assertOk();

        $this->actingAs($waliUnassigned, 'sanctum')
            ->get("/api/santri/{$santriId}/foto")
            ->assertStatus(403);

        // Piket Pengajian yang ditugaskan dapat melihat foto, yang tidak ditugaskan ditolak 403
        $this->actingAs($piketAssigned, 'sanctum')
            ->get("/api/santri/{$santriId}/foto")
            ->assertOk();

        $this->actingAs($piketUnassigned, 'sanctum')
            ->get("/api/santri/{$santriId}/foto")
            ->assertStatus(403);
    }
}
