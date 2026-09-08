<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PeriodeAkademikFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_rollover_closes_previous_assignment_and_creates_period_assignment(): void
    {
        $admin = Petugas::create([
            'nama' => 'Admin Periode',
            'username' => 'admin_periode',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);
        $santriId = DB::table('santri')->insertGetId(['nama' => 'Santri Periode', 'status_aktif' => 1]);
        $oldPeriodId = DB::table('periode_akademik')->insertGetId([
            'tahun_pelajaran' => '2025/2026', 'semester' => 'Genap',
            'tanggal_mulai' => '2026-01-01', 'tanggal_selesai' => '2026-06-30',
            'status' => 'Ditutup', 'dibuat_oleh' => $admin->petugas_id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $newPeriodId = DB::table('periode_akademik')->insertGetId([
            'tahun_pelajaran' => '2026/2027', 'semester' => 'Ganjil',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2026-12-31',
            'status' => 'Aktif', 'dibuat_oleh' => $admin->petugas_id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('assignment_periode')->insert([
            'periode_id' => $oldPeriodId, 'santri_id' => $santriId, 'jenis' => 'kamar',
            'target_id' => 10, 'effective_from' => '2026-01-01',
            'status_transisi' => 'Naik Kelas', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $response = $this->actingAs($admin)->postJson('/api/kenaikan-kelas/terapkan', [
            'periode_id' => $newPeriodId,
            'items' => [[
                'santri_id' => $santriId, 'kamar_id' => 20, 'status_transisi' => 'Naik Kelas',
            ]],
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('assignment_periode', [
            'periode_id' => $oldPeriodId, 'santri_id' => $santriId,
            'effective_until' => '2026-06-30',
        ]);
        $this->assertDatabaseHas('assignment_periode', [
            'periode_id' => $newPeriodId, 'santri_id' => $santriId,
            'target_id' => 20, 'effective_from' => '2026-07-01',
            'effective_until' => null,
        ]);
    }
}
