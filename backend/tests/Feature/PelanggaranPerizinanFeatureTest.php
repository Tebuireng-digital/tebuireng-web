<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Petugas;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class PelanggaranPerizinanFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $this->kamarId = DB::table('kamar')->insertGetId(['nama' => 'Kamar Test', 'unit_id' => $unitId]);
        $this->santriId = DB::table('santri')->insertGetId(['nama' => 'Santri Test', 'kamar_id' => $this->kamarId, 'unit_id' => $unitId]);

        $this->kategoriId = DB::table('kategori_pelanggaran')->insertGetId([
            'kode_pasal' => 'Pasal 1',
            'kategori' => 'Ringan',
            'uraian_pelanggaran' => 'Test pelanggaran',
            'poin_maks' => 25,
            'jenis' => 'Pelanggaran',
            'status_aktif' => 'Aktif'
        ]);

        $this->jenisIzinId = DB::table('jenis_izin')->insertGetId([
            'nama' => 'Izin Pulang',
            'urutan_tahap_default' => 'Wali Kelas,Pembina Kamar,Keamanan'
        ]);

        DB::table('pengaturan_sistem')->insert([
            ['setting_key' => 'ambang_notifikasi_poin', 'setting_value' => '20']
        ]);

        $this->pengasuh = Petugas::create([
            'nama' => 'Pengasuh A', 'username' => 'pengasuh', 'password_hash' => Hash::make('123'), 'jabatan' => 'Pengasuh', 'status_aktif' => 1
        ]);

        $this->waliKelas = Petugas::create([
            'nama' => 'Wali Kelas', 'username' => 'wk', 'password_hash' => Hash::make('123'), 'jabatan' => 'Wali Kelas', 'status_aktif' => 1
        ]);

        $this->pembina = Petugas::create([
            'nama' => 'Pembina', 'username' => 'pk', 'password_hash' => Hash::make('123'), 'jabatan' => 'Pembina Kamar', 'status_aktif' => 1
        ]);

        $this->keamanan = Petugas::create([
            'nama' => 'Keamanan', 'username' => 'km', 'password_hash' => Hash::make('123'), 'jabatan' => 'Keamanan', 'status_aktif' => 1
        ]);
        
        $this->admin = Petugas::create([
            'nama' => 'Admin', 'username' => 'admin', 'password_hash' => Hash::make('123'), 'jabatan' => 'Admin', 'status_aktif' => 1
        ]);
    }

    public function test_reject_flow()
    {
        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/perizinan', [
            'santri_id' => $this->santriId,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => 'Sakit',
            'tanggal_mulai' => now()->toDateString(),
            'rencana_kembali' => now()->addDays(2)->toDateString(),
        ])->assertStatus(201);

        $perizinanId = DB::table('perizinan')->first()->perizinan_id;

        // Tahap 1: Approve
        $this->actingAs($this->waliKelas, 'sanctum');
        $this->patchJson("/api/perizinan/{$perizinanId}/approval/1", [
            'keputusan' => 'Disetujui'
        ])->assertStatus(200);

        // Tahap 2: Reject
        $this->actingAs($this->pembina, 'sanctum');
        $this->patchJson("/api/perizinan/{$perizinanId}/approval/2", [
            'keputusan' => 'Ditolak'
        ])->assertStatus(200);

        // Verify status
        $perizinan = DB::table('perizinan')->where('perizinan_id', $perizinanId)->first();
        $this->assertEquals('Ditolak', $perizinan->status);

        $tahap3 = DB::table('perizinan_approval')->where('perizinan_id', $perizinanId)->where('tahap', 3)->first();
        $this->assertEquals('Gugur', $tahap3->keputusan);
    }

    public function test_success_flow_and_absensi_upsert()
    {
        // Setup Kegiatan to test absensi
        $jenisKeg = DB::table('jenis_kegiatan')->insertGetId(['kode' => 'KAMAR', 'nama' => 'Kamar']);
        $jadwalId = DB::table('jadwal_kegiatan')->insertGetId([
            'jenis_kegiatan_id' => $jenisKeg, 'nama_jadwal' => 'Tes', 'jam_mulai' => '07:00:00', 'jam_selesai' => '08:00:00'
        ]);

        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/perizinan', [
            'santri_id' => $this->santriId,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => 'Pulang',
            'tanggal_mulai' => now()->toDateString(),
            'rencana_kembali' => now()->addDays(2)->toDateString(),
        ])->assertStatus(201);

        $perizinanId = DB::table('perizinan')->first()->perizinan_id;

        // Appove T1
        $this->actingAs($this->waliKelas, 'sanctum')->patchJson("/api/perizinan/{$perizinanId}/approval/1", ['keputusan' => 'Disetujui']);
        // Appove T2
        $this->actingAs($this->pembina, 'sanctum')->patchJson("/api/perizinan/{$perizinanId}/approval/2", ['keputusan' => 'Disetujui']);
        // Appove T3
        $this->actingAs($this->keamanan, 'sanctum')->patchJson("/api/perizinan/{$perizinanId}/approval/3", ['keputusan' => 'Disetujui']);

        // Check if event fired and absensi created
        $perizinan = DB::table('perizinan')->where('perizinan_id', $perizinanId)->first();
        $this->assertEquals('Disetujui', $perizinan->status);

        // Check absensi
        $absensi = DB::table('absensi')->where('santri_id', $this->santriId)->first();
        $this->assertNotNull($absensi);
        $this->assertEquals('Izin', $absensi->status);
    }

    public function test_scheduler_overdue_izin()
    {
        $perizinanId = DB::table('perizinan')->insertGetId([
            'santri_id' => $this->santriId,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => 'Tes Overdue',
            'tanggal_mulai' => now()->subDays(3)->toDateString(),
            'rencana_kembali' => now()->subDays(1)->toDateString(),
            'status' => 'Sedang Berjalan',
            'diajukan_oleh' => $this->admin->petugas_id,
        ]);

        // Run scheduler closure directly
        $events = app()->make(\Illuminate\Console\Scheduling\Schedule::class)->events();
        foreach ($events as $event) {
            // Find our specific job (you might need more robust filtering in real apps)
            if (strpos($event->getSummaryForDisplay(), 'overdue_izin') !== false || true) {
                if ($event instanceof \Illuminate\Console\Scheduling\CallbackEvent) {
                    $event->run(app());
                }
            }
        }
        $notif = DB::table('notifikasi')->where('tipe', 'overdue_izin')->where('petugas_id', $this->admin->petugas_id)->first();
        $this->assertNotNull($notif);
        $this->assertStringContainsString('belum kembali', $notif->pesan);
    }
}
