<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AbsensiJadwalFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_get_jadwal_absensi_list(): void
    {
        $admin = Petugas::where('jabatan', 'Admin')->first();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/absensi/jadwal');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            '*' => [
                'jadwal_id',
                'jenis_kegiatan_id',
                'kode_kegiatan',
                'nama_jadwal',
                'nama_kegiatan_modul',
                'jam_mulai',
                'jam_selesai',
                'waktu_pelaksanaan',
                'penanggung_jawab',
                'toleransi_menit',
                'status_aktif',
            ]
        ]);
    }

    public function test_admin_can_update_jadwal_absensi(): void
    {
        $admin = Petugas::where('jabatan', 'Admin')->first();
        $jadwal = DB::table('jadwal_kegiatan')->first();

        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/absensi/jadwal/' . $jadwal->jadwal_id, [
            'nama_jadwal' => 'Absensi Kamar malam',
            'jam_mulai' => '20:15',
            'jam_selesai' => '20:45',
            'toleransi_menit' => 20,
            'status_aktif' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJson(['message' => 'Waktu pelaksanaan absensi berhasil diperbarui']);

        $this->assertDatabaseHas('jadwal_kegiatan', [
            'jadwal_id' => $jadwal->jadwal_id,
            'nama_jadwal' => 'Absensi Kamar malam',
            'jam_mulai' => '20:15:00',
            'jam_selesai' => '20:45:00',
            'toleransi_menit' => 20,
        ]);
    }

    public function test_non_admin_cannot_update_jadwal_absensi(): void
    {
        $pembina = Petugas::where('jabatan', 'Pembina Kamar')->first();
        $jadwal = DB::table('jadwal_kegiatan')->first();

        $response = $this->actingAs($pembina, 'sanctum')->putJson('/api/absensi/jadwal/' . $jadwal->jadwal_id, [
            'nama_jadwal' => 'Ubah Jam',
            'jam_mulai' => '19:00',
            'jam_selesai' => '20:00',
        ]);

        $response->assertStatus(403);
    }
}

