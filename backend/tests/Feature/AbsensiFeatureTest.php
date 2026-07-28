<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Petugas;
use App\Models\Absensi;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class AbsensiFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Setup master data
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $this->kegiatanKamarId = DB::table('jenis_kegiatan')->insertGetId(['kode' => 'KAMAR', 'nama' => 'Absensi Kamar']);
        
        $this->kamarId = DB::table('kamar')->insertGetId(['nama' => 'Kamar Test', 'unit_id' => $unitId]);
        $this->santriId = DB::table('santri')->insertGetId(['nama' => 'Santri Test', 'kamar_id' => $this->kamarId, 'unit_id' => $unitId]);

        $this->jadwalId = DB::table('jadwal_kegiatan')->insertGetId([
            'jenis_kegiatan_id' => $this->kegiatanKamarId,
            'nama_jadwal' => 'Subuh',
            'jam_mulai' => Carbon::now()->addMinutes(10)->format('H:i:00'),
            'jam_selesai' => '05:30:00',
        ]);

        DB::table('pengaturan_sistem')->insert([
            ['setting_key' => 'toleransi_menit_terlambat_input', 'setting_value' => '30'],
            ['setting_key' => 'durasi_edit_absensi_menit', 'setting_value' => '60']
        ]);

        $this->petugas = Petugas::create([
            'nama' => 'Petugas',
            'username' => 'petugas',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1
        ]);
        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $this->petugas->petugas_id,
            'tipe_target' => 'Kamar',
            'target_id' => $this->kamarId,
            'tanggal_mulai' => now()->toDateString(),
        ]);

        $this->admin = Petugas::create([
            'nama' => 'Admin',
            'username' => 'admin',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1
        ]);
    }

    public function test_bulk_upsert_idempotency()
    {
        $this->actingAs($this->petugas, 'sanctum');

        $payload = [
            'jadwal_id' => $this->jadwalId,
            'tanggal' => now()->toDateString(),
            'absensi' => [
                [
                    'santri_id' => $this->santriId,
                    'status' => 'Sakit'
                ]
            ]
        ];

        // 1st request
        $response1 = $this->postJson('/api/absensi/kamar/bulk', $payload);
        $response1->assertStatus(200);

        // 2nd request
        $response2 = $this->postJson('/api/absensi/kamar/bulk', $payload);
        $response2->assertStatus(200);

        // Check DB, should only be 1 record
        $count = DB::table('absensi')->count();
        $this->assertEquals(1, $count);
    }

    public function test_patch_time_gate()
    {
        // Insert absensi that was inputted 2 hours ago
        $absensiId = DB::table('absensi')->insertGetId([
            'santri_id' => $this->santriId,
            'jenis_kegiatan_id' => $this->kegiatanKamarId,
            'jadwal_id' => $this->jadwalId,
            'tanggal' => now()->toDateString(),
            'status' => 'Hadir',
            'diinput_oleh' => $this->petugas->petugas_id,
            'waktu_input' => now()->subHours(2)->toDateTimeString()
        ]);

        // Non-admin should be blocked
        $this->actingAs($this->petugas, 'sanctum');
        $this->patchJson('/api/absensi/' . $absensiId, ['status' => 'Sakit'])
             ->assertStatus(403)
             ->assertJson(['message' => 'Batas waktu edit absensi telah habis']);

        // Admin should succeed
        $this->actingAs($this->admin, 'sanctum');
        $this->patchJson('/api/absensi/' . $absensiId, ['status' => 'Sakit'])
             ->assertStatus(200);

        // Check log_aktivitas
        $log = DB::table('log_aktivitas')->where('record_id', $absensiId)->first();
        $this->assertNotNull($log);
        $this->assertEquals('UPDATE', $log->aksi);
    }

    public function test_job_scheduler_reminder()
    {
        // Schedule callback runs logic to find jadwal starting in 10 minutes.
        // We set up jadwal to start at now() + 10 mins in setUp().
        // We just invoke the console command by simulating the closure.
        
        // Let's explicitly trigger the closure registered in console.php
        // Instead of parsing routes/console.php, we can just run the schedule command.
        $this->artisan('schedule:run');

        // Check if notification is inserted
        $notif = DB::table('notifikasi')
            ->where('petugas_id', $this->petugas->petugas_id)
            ->where('tipe', 'reminder_absensi')
            ->first();
            
        $this->assertNotNull($notif);
        $this->assertStringContainsString('akan dimulai', $notif->pesan);
    }
}
