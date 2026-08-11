<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AlumniFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Petugas::create([
            'nama' => 'Admin Alumni',
            'username' => 'admin_alumni',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0,
        ]);

        Alumni::create([
            'no_id_induk' => '1001',
            'nama' => 'Ahmad Fulan',
            'jenis_kelamin' => 'L',
            'jenjang' => 'SMA',
            'kelas' => 'SMA-3',
            'angkatan' => '2022',
            'tahun_lulus' => '2025',
        ]);

        Alumni::create([
            'no_id_induk' => '1002',
            'nama' => 'Siti Khadijah',
            'jenis_kelamin' => 'P',
            'jenjang' => 'MA',
            'kelas' => 'MA-3',
            'angkatan' => '2021',
            'tahun_lulus' => '2024',
        ]);
    }

    public function test_admin_can_list_and_search_alumni()
    {
        $response = $this->actingAs($this->admin)->getJson('/api/master/alumni?q=Ahmad');

        $response->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonFragment(['nama' => 'Ahmad Fulan']);
    }

    public function test_admin_can_filter_alumni_by_jenjang()
    {
        $response = $this->actingAs($this->admin)->getJson('/api/master/alumni?jenjang=MA');

        $response->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonFragment(['nama' => 'Siti Khadijah']);
    }

    public function test_admin_can_get_alumni_stats()
    {
        $response = $this->actingAs($this->admin)->getJson('/api/master/alumni/stats');

        $response->assertStatus(200)
            ->assertJson([
                'total' => 2,
            ])
            ->assertJsonFragment(['jenjang' => 'SMA', 'jumlah' => 1])
            ->assertJsonFragment(['jenjang' => 'MA', 'jumlah' => 1]);
    }
}
