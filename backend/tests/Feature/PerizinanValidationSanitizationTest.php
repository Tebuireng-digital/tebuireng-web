<?php

namespace Tests\Feature;

use App\Models\Petugas;
use App\Models\Santri;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PerizinanValidationSanitizationTest extends TestCase
{
    use RefreshDatabase;

    private Petugas $keamanan;
    private Santri $santri;
    private int $jenisIzinId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->keamanan = Petugas::create([
            'nama' => 'Petugas Keamanan',
            'username' => 'keamanan_uji',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Keamanan',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $this->santri = Santri::create([
            'nama' => 'Muhammad Badrut',
            'nis' => 'SN-2002',
            'status' => 'Aktif',
            'jenis_kelamin' => 'L',
        ]);

        $this->jenisIzinId = DB::table('jenis_izin')->insertGetId([
            'nama' => 'Izin Pulang Sakit',
            'urutan_tahap_default' => 'Keamanan',
        ]);
    }

    public function test_perizinan_input_is_properly_sanitized(): void
    {
        $payload = [
            'santri_id' => $this->santri->santri_id,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => '<script>alert("XSS")</script> <b>Pulang berobat ke rumah sakit</b> ',
            'tanggal_mulai' => '2026-09-10 08:00:00',
            'rencana_kembali' => '2026-09-12 17:00:00',
        ];

        $response = $this->actingAs($this->keamanan, 'sanctum')
            ->postJson('/api/perizinan', $payload);

        $response->assertStatus(201);
        $perizinanId = $response->json('perizinan_id');

        $record = DB::table('perizinan')->where('perizinan_id', $perizinanId)->first();
        $this->assertEquals('Pulang berobat ke rumah sakit', $record->keperluan);
        $this->assertEquals('2026-09-10 08:00:00', $record->tanggal_mulai);
        $this->assertEquals('2026-09-12 17:00:00', $record->rencana_kembali);
    }

    public function test_validation_rejects_empty_or_html_only_keperluan(): void
    {
        $response = $this->actingAs($this->keamanan, 'sanctum')
            ->postJson('/api/perizinan', [
                'santri_id' => $this->santri->santri_id,
                'jenis_izin_id' => $this->jenisIzinId,
                'keperluan' => '<script>console.log(1)</script>',
                'tanggal_mulai' => '2026-09-10 08:00:00',
                'rencana_kembali' => '2026-09-12 17:00:00',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['keperluan']);
    }

    public function test_validation_rejects_invalid_jenis_izin_or_santri(): void
    {
        $response = $this->actingAs($this->keamanan, 'sanctum')
            ->postJson('/api/perizinan', [
                'santri_id' => 99999,
                'jenis_izin_id' => 99999,
                'keperluan' => 'Pulang karena acara keluarga',
                'tanggal_mulai' => '2026-09-10 08:00:00',
                'rencana_kembali' => '2026-09-12 17:00:00',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['santri_id', 'jenis_izin_id']);
    }

    public function test_validation_rejects_return_date_before_start_or_excessive_duration(): void
    {
        // Return date earlier than start date
        $responseEarly = $this->actingAs($this->keamanan, 'sanctum')
            ->postJson('/api/perizinan', [
                'santri_id' => $this->santri->santri_id,
                'jenis_izin_id' => $this->jenisIzinId,
                'keperluan' => 'Acara keluarga',
                'tanggal_mulai' => '2026-09-10 08:00:00',
                'rencana_kembali' => '2026-09-09 08:00:00',
            ]);

        $responseEarly->assertStatus(422);

        // Duration more than 90 days
        $responseTooLong = $this->actingAs($this->keamanan, 'sanctum')
            ->postJson('/api/perizinan', [
                'santri_id' => $this->santri->santri_id,
                'jenis_izin_id' => $this->jenisIzinId,
                'keperluan' => 'Izin belajar di luar',
                'tanggal_mulai' => '2026-09-10 08:00:00',
                'rencana_kembali' => '2027-09-10 08:00:00',
            ]);

        $responseTooLong->assertStatus(422);
    }
}
