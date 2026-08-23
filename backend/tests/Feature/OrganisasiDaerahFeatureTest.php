<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Petugas;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class OrganisasiDaerahFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;
    protected $santriId1;
    protected $santriId2;
    protected $ordaId;

    protected function setUp(): void
    {
        parent::setUp();

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);

        $this->santriId1 = DB::table('santri')->insertGetId([
            'nama' => 'Santri Orda 1',
            'unit_id' => $unitId,
            'status_aktif' => 1,
        ]);

        $this->santriId2 = DB::table('santri')->insertGetId([
            'nama' => 'Santri Orda 2',
            'unit_id' => $unitId,
            'status_aktif' => 1,
        ]);

        $this->admin = Petugas::create([
            'nama' => 'Admin Orda',
            'username' => 'admin_orda',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        $this->ordaId = DB::table('organisasi_daerah')->insertGetId([
            'kode_singkat' => 'HISPA',
            'nama_organisasi' => 'Himpunan Santri Pasundan',
            'deskripsi_wilayah' => 'Jawa Barat & Banten',
            'status_aktif' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_admin_can_list_organisasi_daerah()
    {
        $response = $this->actingAs($this->admin)->getJson('/api/master/organisasi-daerah');

        $response->assertStatus(200)
            ->assertJsonFragment(['kode_singkat' => 'HISPA', 'nama_organisasi' => 'Himpunan Santri Pasundan']);
    }

    public function test_admin_can_create_organisasi_daerah()
    {
        $payload = [
            'kode_singkat' => 'OPIM',
            'nama_organisasi' => 'Organisasi Pelajar Islam Malang',
            'deskripsi_wilayah' => 'Malang Raya',
            'status_aktif' => true,
        ];

        $response = $this->actingAs($this->admin)->postJson('/api/master/organisasi-daerah', $payload);

        $response->assertStatus(201)
            ->assertJson(['message' => 'Organisasi daerah baru berhasil ditambahkan']);

        $this->assertDatabaseHas('organisasi_daerah', ['kode_singkat' => 'OPIM']);
    }

    public function test_admin_can_update_organisasi_daerah()
    {
        $response = $this->actingAs($this->admin)->putJson("/api/master/organisasi-daerah/{$this->ordaId}", [
            'kode_singkat' => 'HISPA-2',
            'nama_organisasi' => 'Himpunan Santri Pasundan Baru',
            'deskripsi_wilayah' => 'Jawa Barat',
            'status_aktif' => true,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('organisasi_daerah', [
            'organisasi_daerah_id' => $this->ordaId,
            'kode_singkat' => 'HISPA-2',
            'nama_organisasi' => 'Himpunan Santri Pasundan Baru',
        ]);
    }

    public function test_admin_can_deactivate_organisasi_daerah_without_deleting_history()
    {
        DB::table('santri')->where('santri_id', $this->santriId1)->update(['organisasi_daerah_id' => $this->ordaId]);

        $response = $this->actingAs($this->admin)->deleteJson("/api/master/organisasi-daerah/{$this->ordaId}");

        $response->assertStatus(200)
            ->assertJson(['message' => 'Organisasi daerah berhasil dinonaktifkan.']);
        $this->assertDatabaseHas('organisasi_daerah', [
            'organisasi_daerah_id' => $this->ordaId,
            'status_aktif' => 0,
        ]);
        $this->assertDatabaseHas('santri', [
            'santri_id' => $this->santriId1,
            'organisasi_daerah_id' => $this->ordaId,
        ]);
    }

    public function test_admin_can_bulk_map_santri_to_orda()
    {
        $payload = [
            'organisasi_daerah_id' => $this->ordaId,
            'santri_ids' => [$this->santriId1, $this->santriId2],
        ];

        $response = $this->actingAs($this->admin)->postJson('/api/master/santri/bulk-orda', $payload);

        $response->assertStatus(200)
            ->assertJson(['jumlah_santri' => 2]);

        $this->assertDatabaseHas('santri', [
            'santri_id' => $this->santriId1,
            'organisasi_daerah_id' => $this->ordaId,
        ]);
        $this->assertDatabaseHas('santri', [
            'santri_id' => $this->santriId2,
            'organisasi_daerah_id' => $this->ordaId,
        ]);
    }

    public function test_admin_can_get_orda_report()
    {
        // Map santri first
        DB::table('santri')->where('santri_id', $this->santriId1)->update(['organisasi_daerah_id' => $this->ordaId]);

        $response = $this->actingAs($this->admin)->getJson('/api/laporan/organisasi-daerah');

        $response->assertStatus(200)
            ->assertJsonFragment(['nama_santri' => 'Santri Orda 1', 'kode_orda' => 'HISPA']);
    }
}
