<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Petugas;
use App\Services\WhatsAppService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;

class WhatsAppNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $kamarId = DB::table('kamar')->insertGetId(['nama' => 'A-01', 'unit_id' => $unitId]);

        $this->santriId = DB::table('santri')->insertGetId([
            'nama' => 'Ahmad Santri',
            'nis' => '12345',
            'kamar_id' => $kamarId,
            'unit_id' => $unitId,
            'nama_wali' => 'Bapak Wali',
            'no_hp_wali' => '081234567890',
        ]);

        $this->kategoriId = DB::table('kategori_pelanggaran')->insertGetId([
            'kode_pasal' => 'P1',
            'kategori' => 'Ringan',
            'uraian_pelanggaran' => 'Terlambat Berada di Kamar',
            'poin_maks' => 10,
            'jenis' => 'Pelanggaran',
            'status_aktif' => 'Aktif'
        ]);

        $this->jenisIzinId = DB::table('jenis_izin')->insertGetId([
            'nama' => 'Izin Pulang',
            'urutan_tahap_default' => 'Keamanan'
        ]);

        $this->keamanan = Petugas::create([
            'nama' => 'Petugas Keamanan',
            'username' => 'keamanan',
            'password_hash' => Hash::make('123'),
            'jabatan' => 'Keamanan',
            'status_aktif' => 1
        ]);

        $this->admin = Petugas::create([
            'nama' => 'Admin System',
            'username' => 'admin',
            'password_hash' => Hash::make('123'),
            'jabatan' => 'Admin',
            'status_aktif' => 1
        ]);
    }

    public function test_phone_number_formatting(): void
    {
        $service = new WhatsAppService();

        $this->assertEquals('628123456789', $service->formatPhoneNumber('08123456789'));
        $this->assertEquals('628123456789', $service->formatPhoneNumber('+628123456789'));
        $this->assertEquals('628123456789', $service->formatPhoneNumber('628123456789'));
        $this->assertEquals('628123456789', $service->formatPhoneNumber('0812-3456-789'));
        $this->assertNull($service->formatPhoneNumber(''));
        $this->assertNull($service->formatPhoneNumber(null));
    }

    public function test_perizinan_triggers_wa_notification(): void
    {
        Http::fake([
            '*/send-message' => Http::response(['status' => 'success', 'message_id' => 'MSG123'], 200),
        ]);

        $this->actingAs($this->keamanan, 'sanctum');

        $response = $this->postJson('/api/perizinan', [
            'santri_id' => $this->santriId,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => 'Keperluan keluarga',
            'tanggal_mulai' => now()->toDateString(),
            'rencana_kembali' => now()->addDays(2)->toDateString(),
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('wa_notifications', [
            'santri_id' => $this->santriId,
            'no_hp' => '6281234567890',
            'tipe_pesan' => 'perizinan',
            'status' => 'sent',
        ]);
    }

    public function test_pelanggaran_triggers_wa_notification(): void
    {
        Http::fake([
            '*/send-message' => Http::response(['status' => 'success', 'message_id' => 'MSG456'], 200),
        ]);

        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'tanggal' => now()->toDateString(),
            'keterangan' => 'Terlambat masuk 15 menit',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('wa_notifications', [
            'santri_id' => $this->santriId,
            'no_hp' => '6281234567890',
            'tipe_pesan' => 'pelanggaran',
            'status' => 'sent',
        ]);
    }
}
