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
            'diinput_oleh' => $petugasInput
        ]);

        $this->absensiB = DB::table('absensi')->insertGetId([
            'santri_id' => $this->santriB,
            'jenis_kegiatan_id' => $kegiatanId,
            'jadwal_id' => $jadwalId,
            'tanggal' => now()->toDateString(),
            'status' => 'Hadir',
            'diinput_oleh' => $petugasInput
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

        $this->postJson('/api/login', [
            'username' => 'test-user',
            'password' => 'wrong',
        ])->assertStatus(401);

        $this->postJson('/api/login', [
            'username' => 'test-user',
            'password' => $password,
        ])->assertStatus(200);
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
        $this->putJson('/api/absensi/' . $this->absensiA)->assertStatus(200);

        // Should fail for Kamar B
        $this->putJson('/api/absensi/' . $this->absensiB)->assertStatus(403);
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

        $this->putJson('/api/absensi/' . $this->absensiA)->assertStatus(200);
        $this->putJson('/api/absensi/' . $this->absensiB)->assertStatus(200);
    }
}
