<?php

namespace Tests\Feature;

use App\Models\Petugas;
use App\Models\Santri;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PrestasiFeatureTest extends TestCase
{
    use RefreshDatabase;

    private Petugas $admin;
    private Petugas $keamanan;
    private Santri $santri;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Petugas::create([
            'nama' => 'Admin Utama',
            'username' => 'admin_prestasi',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $this->keamanan = Petugas::create([
            'nama' => 'Petugas Keamanan',
            'username' => 'keamanan_prestasi',
            'password_hash' => Hash::make('password123'),
            'jabatan' => 'Keamanan',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $this->santri = Santri::create([
            'nama' => 'Ahmad Fauzi',
            'nis' => 'SN-1001',
            'status' => 'Aktif',
            'jenis_kelamin' => 'L',
        ]);
    }

    public function test_admin_can_create_prestasi_with_sanitization(): void
    {
        $payload = [
            'santri_id' => $this->santri->santri_id,
            'nama_prestasi' => '<script>alert("XSS")</script> Juara 1 Lomba Pidato Bahasa Arab ',
            'peringkat' => '<b>Juara 1</b>',
            'tingkat' => 'Provinsi',
            'tanggal' => '2026-08-15',
            'keterangan' => '<p>Penyelenggara Kanwil Kemenag Jawa Timur</p>',
        ];

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/prestasi', $payload);

        $response->assertCreated();
        $data = $response->json('data');

        // Verify HTML tags were stripped & whitespace normalized
        $this->assertEquals('Juara 1 Lomba Pidato Bahasa Arab', $data['nama_prestasi']);
        $this->assertEquals('Juara 1', $data['peringkat']);
        $this->assertEquals('Penyelenggara Kanwil Kemenag Jawa Timur', $data['keterangan']);

        $this->assertDatabaseHas('prestasi', [
            'prestasi_id' => $data['prestasi_id'],
            'santri_id' => $this->santri->santri_id,
            'nama_prestasi' => 'Juara 1 Lomba Pidato Bahasa Arab',
            'peringkat' => 'Juara 1',
        ]);
    }

    public function test_store_validation_rejects_empty_name_or_future_date(): void
    {
        // Name only HTML tags (which become empty string after strip_tags)
        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/prestasi', [
                'santri_id' => $this->santri->santri_id,
                'nama_prestasi' => '<b><script></script></b>',
                'tanggal' => '2026-08-15',
            ]);
        $response->assertStatus(422);

        // Future date rejected
        $futureDate = date('Y-m-d', strtotime('+5 days'));
        $responseFuture = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/prestasi', [
                'santri_id' => $this->santri->santri_id,
                'nama_prestasi' => 'Olimpiade Sains',
                'tanggal' => $futureDate,
            ]);
        $responseFuture->assertStatus(422);
    }

    public function test_non_admin_cannot_create_or_delete_prestasi(): void
    {
        $payload = [
            'santri_id' => $this->santri->santri_id,
            'nama_prestasi' => 'Juara 2 Kaligrafi',
            'tanggal' => '2026-08-10',
        ];

        $this->actingAs($this->keamanan, 'sanctum')
            ->postJson('/api/prestasi', $payload)
            ->assertForbidden();
    }

    public function test_admin_can_update_prestasi(): void
    {
        $created = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/prestasi', [
                'santri_id' => $this->santri->santri_id,
                'nama_prestasi' => 'Lomba Debat Awal',
                'tanggal' => '2026-08-01',
            ])->assertCreated();

        $id = $created->json('data.prestasi_id');

        $updateResponse = $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/prestasi/{$id}", [
                'santri_id' => $this->santri->santri_id,
                'nama_prestasi' => '<i>Lomba Debat Final Nasional</i>',
                'peringkat' => 'Juara 2',
                'tingkat' => 'Nasional',
                'tanggal' => '2026-08-05',
                'keterangan' => 'Revisi peringkat setelah final',
            ]);

        $updateResponse->assertOk();
        $this->assertEquals('Lomba Debat Final Nasional', $updateResponse->json('data.nama_prestasi'));
        $this->assertEquals('Juara 2', $updateResponse->json('data.peringkat'));

        $this->assertDatabaseHas('prestasi', [
            'prestasi_id' => $id,
            'nama_prestasi' => 'Lomba Debat Final Nasional',
            'peringkat' => 'Juara 2',
        ]);
    }

    public function test_admin_can_delete_prestasi_and_non_existent_returns_404(): void
    {
        $created = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/prestasi', [
                'santri_id' => $this->santri->santri_id,
                'nama_prestasi' => 'Lomba MQK Tingkat Desa',
                'tanggal' => '2026-08-10',
            ])->assertCreated();

        $id = $created->json('data.prestasi_id');

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/prestasi/{$id}")
            ->assertOk();

        $this->assertDatabaseMissing('prestasi', ['prestasi_id' => $id]);

        // Second deletion should return 404
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/prestasi/{$id}")
            ->assertNotFound();
    }
}
