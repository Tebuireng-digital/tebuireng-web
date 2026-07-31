<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MasterPenugasanFeatureTest extends TestCase
{
    use RefreshDatabase;

    private Petugas $admin;
    private Petugas $waliPertama;
    private Petugas $waliKedua;
    private int $kelasId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->petugas('Admin', 'admin-penugasan');
        $this->waliPertama = $this->petugas('Wali Kelas', 'wali-pertama');
        $this->waliKedua = $this->petugas('Wali Kelas', 'wali-kedua');

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $this->kelasId = DB::table('kelas_formal')->insertGetId([
            'unit_id' => $unitId,
            'tingkat' => '7',
            'nama_kelas' => '7A',
            'tahun_ajaran' => '2026/2027',
        ]);
    }

    public function test_admin_cannot_assign_two_active_staff_to_the_same_formal_class(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/master/penugasan', [
            'petugas_id' => $this->waliPertama->petugas_id,
            'jenis' => 'sekolah',
            'target_id' => $this->kelasId,
        ])->assertCreated();

        $this->postJson('/api/master/penugasan', [
            'petugas_id' => $this->waliKedua->petugas_id,
            'jenis' => 'sekolah',
            'target_id' => $this->kelasId,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Kelas 7A sudah memiliki penugasan aktif untuk Wali Kelas.');

        $this->assertDatabaseCount('petugas_penugasan', 1);
    }

    public function test_admin_cannot_assign_staff_different_from_the_class_owner(): void
    {
        DB::table('kelas_formal')->where('kelas_formal_id', $this->kelasId)->update([
            'wali_kelas_id' => $this->waliPertama->petugas_id,
        ]);
        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/master/penugasan', [
            'petugas_id' => $this->waliKedua->petugas_id,
            'jenis' => 'sekolah',
            'target_id' => $this->kelasId,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Kelas 7A sudah dikelola oleh Wali Kelas sebagai wali kelas.');
    }

    public function test_madin_source_class_cannot_be_assigned_as_formal_school_class(): void
    {
        $mtsUnitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs Lain']);
        $madinSourceClassId = DB::table('kelas_formal')->insertGetId([
            'unit_id' => $mtsUnitId,
            'tingkat' => null,
            'nama_kelas' => 'VIII A',
            'tahun_ajaran' => '2026/2027',
        ]);
        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/master/penugasan', [
            'petugas_id' => $this->waliPertama->petugas_id,
            'jenis' => 'sekolah',
            'target_id' => $madinSourceClassId,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Kelompok tujuan tidak ditemukan');
    }

    public function test_staff_list_shows_active_attendance_responsibility_or_dash(): void
    {
        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $this->waliPertama->petugas_id,
            'tipe_target' => 'KelasFormal',
            'target_id' => $this->kelasId,
            'sumber' => 'manual',
            'tanggal_mulai' => now()->toDateString(),
        ]);
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->getJson('/api/master/petugas')->assertOk();
        $rows = collect($response->json());

        $this->assertSame(
            'Kelas 7A',
            $rows->firstWhere('petugas_id', $this->waliPertama->petugas_id)['tanggung_jawab_absensi']
        );
        $this->assertSame(
            '-',
            $rows->firstWhere('petugas_id', $this->waliKedua->petugas_id)['tanggung_jawab_absensi']
        );
        $this->assertSame(
            '-',
            $rows->firstWhere('petugas_id', $this->admin->petugas_id)['tanggung_jawab_absensi']
        );
    }

    private function petugas(string $jabatan, string $username): Petugas
    {
        return Petugas::create([
            'nama' => $jabatan,
            'username' => $username,
            'password_hash' => Hash::make('password'),
            'jabatan' => $jabatan,
            'status_aktif' => 1,
        ]);
    }
}
