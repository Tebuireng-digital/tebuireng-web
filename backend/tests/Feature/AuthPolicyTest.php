<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Petugas;
use App\Models\Absensi;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthPolicyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Seed some basic data required for test
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $kegiatanId = DB::table('jenis_kegiatan')->insertGetId(['kode' => 'KAMAR', 'nama' => 'Absensi Kamar']);
        
        $this->kamarA = DB::table('kamar')->insertGetId(['nama' => 'Kamar A', 'unit_id' => $unitId]);
        $this->kamarB = DB::table('kamar')->insertGetId(['nama' => 'Kamar B', 'unit_id' => $unitId]);

        $this->santriA = DB::table('santri')->insertGetId(['nama' => 'Santri A', 'kamar_id' => $this->kamarA, 'unit_id' => $unitId]);
        $this->santriB = DB::table('santri')->insertGetId(['nama' => 'Santri B', 'kamar_id' => $this->kamarB, 'unit_id' => $unitId]);

        $petugasInput = DB::table('petugas')->insertGetId([
            'nama' => 'Pencatat', 'username' => 'pencatat', 'password_hash' => 'x', 'jabatan' => 'Admin'
        ]);

        $jadwalId = DB::table('jadwal_kegiatan')->insertGetId([
            'jenis_kegiatan_id' => $kegiatanId,
            'nama_jadwal' => 'Tes',
            'jam_mulai' => '07:00:00',
            'jam_selesai' => '08:00:00',
        ]);

        // Create Absensi
        $this->absensiA = DB::table('absensi')->insertGetId([
            'santri_id' => $this->santriA,
            'jenis_kegiatan_id' => $kegiatanId,
            'jadwal_id' => $jadwalId,
            'tanggal' => now()->toDateString(),
            'status' => 'Hadir',
            'diinput_oleh' => $petugasInput,
            'waktu_input' => now()->toDateTimeString(),
        ]);

        $this->absensiB = DB::table('absensi')->insertGetId([
            'santri_id' => $this->santriB,
            'jenis_kegiatan_id' => $kegiatanId,
            'jadwal_id' => $jadwalId,
            'tanggal' => now()->toDateString(),
            'status' => 'Hadir',
            'diinput_oleh' => $petugasInput,
            'waktu_input' => now()->toDateTimeString(),
        ]);
    }

    public function test_auth_login()
    {
        $password = 'secret123';
        $petugas = Petugas::create([
            'nama' => 'Test',
            'username' => 'test-user',
            'password_hash' => Hash::make($password),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1
        ]);

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/'])
            ->postJson('/api/login', [
            'username' => 'test-user',
            'password' => 'wrong',
        ])->assertStatus(401);

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/'])
            ->postJson('/api/login', [
            'username' => 'test-user',
            'password' => $password,
        ])->assertStatus(200);
    }

    public function test_login_without_stateful_frontend_context_is_rejected_cleanly(): void
    {
        Petugas::create([
            'nama' => 'Test Stateless',
            'username' => 'test-stateless',
            'password_hash' => Hash::make('secret123'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
        ]);

        $this->postJson('/api/login', [
            'username' => 'test-stateless',
            'password' => 'secret123',
        ])->assertStatus(419)
            ->assertJsonPath('code', 'STATEFUL_REQUEST_REQUIRED');
    }

    public function test_temporary_password_blocks_features_until_changed(): void
    {
        $oldPassword = 'PasswordLama123';
        $newPassword = 'PasswordBaru456';
        $petugas = Petugas::create([
            'nama' => 'Petugas Sementara',
            'username' => 'petugas-sementara',
            'password_hash' => Hash::make($oldPassword),
            'wajib_ganti_password' => true,
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1,
        ]);

        $this->actingAs($petugas, 'sanctum');

        $this->getJson('/api/me')->assertOk();
        $this->getJson('/api/santri')
            ->assertStatus(423)
            ->assertJsonPath('code', 'PASSWORD_CHANGE_REQUIRED');

        $this->postJson('/api/ganti-password', [
            'old_password' => $oldPassword,
            'new_password' => $newPassword,
            'new_password_confirmation' => $newPassword,
        ])->assertOk();

        $petugas->refresh();
        $this->assertFalse((bool) $petugas->wajib_ganti_password);
        $this->assertTrue(Hash::check($newPassword, $petugas->password_hash));
        $this->getJson('/api/santri')->assertOk();
    }

    public function test_development_can_bypass_password_gate_without_changing_database_flag(): void
    {
        config()->set('auth.force_password_change', false);

        $petugas = Petugas::create([
            'nama' => 'Admin Development',
            'username' => 'admin-development',
            'password_hash' => Hash::make('PasswordLama123'),
            'wajib_ganti_password' => true,
            'jabatan' => 'Admin',
            'status_aktif' => 1,
        ]);

        $this->actingAs($petugas, 'sanctum');

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.wajib_ganti_password', false);
        $this->getJson('/api/santri')->assertOk();

        $this->assertDatabaseHas('petugas', [
            'petugas_id' => $petugas->petugas_id,
            'wajib_ganti_password' => true,
        ]);
    }

    public function test_password_change_requires_confirmation_and_strong_password(): void
    {
        $oldPassword = 'PasswordLama123';
        $petugas = Petugas::create([
            'nama' => 'Petugas Validasi',
            'username' => 'petugas-validasi',
            'password_hash' => Hash::make($oldPassword),
            'wajib_ganti_password' => true,
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1,
        ]);

        $this->actingAs($petugas, 'sanctum');

        $this->postJson('/api/ganti-password', [
            'old_password' => $oldPassword,
            'new_password' => 'pendek123',
            'new_password_confirmation' => 'tidak-sama123',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('new_password');
    }

    public function test_admin_reset_creates_one_time_password_and_forces_change(): void
    {
        $admin = Petugas::create([
            'nama' => 'Admin Reset',
            'username' => 'admin-reset',
            'password_hash' => Hash::make('PasswordAdmin123'),
            'wajib_ganti_password' => false,
            'jabatan' => 'Admin',
            'status_aktif' => 1,
        ]);
        $target = Petugas::create([
            'nama' => 'Target Reset',
            'username' => 'target-reset',
            'password_hash' => Hash::make('PasswordTarget123'),
            'wajib_ganti_password' => false,
            'jabatan' => 'Ustadz',
            'status_aktif' => 1,
        ]);

        $this->actingAs($admin, 'sanctum');
        $response = $this->postJson('/api/petugas/'.$target->petugas_id.'/reset-password')
            ->assertOk()
            ->assertJsonPath('note', 'Simpan kata sandi ini sekarang, tidak akan ditampilkan lagi.');

        $temporaryPassword = $response->json('new_password');
        $target->refresh();

        $this->assertGreaterThanOrEqual(16, strlen($temporaryPassword));
        $this->assertTrue((bool) $target->wajib_ganti_password);
        $this->assertTrue(Hash::check($temporaryPassword, $target->password_hash));
    }

    public function test_policy_petugas_can_only_access_their_kamar()
    {
        $petugas = Petugas::create([
            'nama' => 'Pembina A',
            'username' => 'pembina-a',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1
        ]);

        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $petugas->petugas_id,
            'tipe_target' => 'Kamar',
            'target_id' => $this->kamarA,
            'tanggal_mulai' => now()->toDateString(),
        ]);

        $this->actingAs($petugas, 'sanctum');

        // Should succeed for Kamar A
        $this->patchJson('/api/absensi/' . $this->absensiA, ['status' => 'Sakit'])->assertStatus(200);

        // Should fail for Kamar B
        $this->patchJson('/api/absensi/' . $this->absensiB, ['status' => 'Sakit'])->assertStatus(403);
    }

    public function test_policy_admin_can_access_any_kamar()
    {
        $admin = Petugas::create([
            'nama' => 'Admin',
            'username' => 'admin-user',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1
        ]);

        $this->actingAs($admin, 'sanctum');

        $this->patchJson('/api/absensi/' . $this->absensiA, ['status' => 'Sakit'])->assertStatus(200);
        $this->patchJson('/api/absensi/' . $this->absensiB, ['status' => 'Sakit'])->assertStatus(200);
    }
}
