<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Petugas;
use App\Models\MasterInstrumenUbudiyah;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UbudiyahFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;
    protected $pembina;
    protected $santriId;
    protected $kamarId;
    protected $instrumenIds = [];

    protected function setUp(): void
    {
        parent::setUp();

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        
        $this->kamarId = DB::table('kamar')->insertGetId([
            'nama' => 'Hadji Kalla 201',
            'kode_singkat' => 'HK 201',
            'unit_id' => $unitId,
        ]);

        $this->santriId = DB::table('santri')->insertGetId([
            'nama' => 'Santri Test Ubudiyah',
            'kamar_id' => $this->kamarId,
            'unit_id' => $unitId,
            'status_aktif' => 1
        ]);

        $this->admin = Petugas::create([
            'nama' => 'Admin Ubudiyah',
            'username' => 'admin_ubudiyah',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0
        ]);

        $this->pembina = Petugas::create([
            'nama' => 'Pembina Ubudiyah',
            'username' => 'pembina_ubudiyah',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0
        ]);

        // Assign room to pembina
        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $this->pembina->petugas_id,
            'tipe_target' => 'Kamar',
            'target_id' => $this->kamarId,
            'tanggal_mulai' => now()->toDateString(),
        ]);

        // Seed 3 criteria
        $criteria = ['Sholat Tahajjud', 'Sholat Dhuha', 'Kerapian Tempat Tidur'];
        foreach ($criteria as $name) {
            $this->instrumenIds[] = DB::table('master_instrumen_ubudiyah')->insertGetId([
                'nama_instrumen' => $name,
                'status_aktif' => 1,
                'dibuat_oleh' => $this->admin->petugas_id,
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }
    }

    public function test_options_returns_assigned_rooms()
    {
        $response = $this->actingAs($this->pembina)->getJson('/api/ubudiyah/options');

        $response->assertStatus(200)
            ->assertJsonFragment([
                'target_id' => $this->kamarId,
                'nama_target' => 'Hadji Kalla 201'
            ]);
    }

    public function test_bulk_upsert_and_show_raport_and_pdf()
    {
        $payload = [
            'target_id' => $this->kamarId,
            'bulan' => 8,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026/2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId,
                    'nilai' => [
                        $this->instrumenIds[0] => 90,
                        $this->instrumenIds[1] => 80,
                        $this->instrumenIds[2] => 85,
                    ],
                    'catatan' => [
                        $this->instrumenIds[0] => 'Pertahankan prestasimu!',
                        $this->instrumenIds[1] => 'Tingkatkan lagi.',
                        $this->instrumenIds[2] => 'Sangat rapi.',
                    ]
                ]
            ]
        ];

        // 1. Bulk Upsert
        $bulkRes = $this->actingAs($this->pembina)->postJson('/api/ubudiyah/bulk', $payload);
        $bulkRes->assertStatus(200)
            ->assertJson(['message' => 'Laporan Ubudiyah Yaumiyah berhasil disimpan', 'jumlah' => 1]);

        // 2. Show Report
        $showRes = $this->actingAs($this->pembina)->getJson("/api/ubudiyah/{$this->santriId}?bulan=8&tahun=2026");
        $showRes->assertStatus(200)
            ->assertJsonPath('total_nilai', 255)
            ->assertJsonPath('rata_rata', 85)
            ->assertJsonPath('peringkat', 1)
            ->assertJsonPath('dari', 1);

        // 3. Download PDF
        $pdfRes = $this->actingAs($this->pembina)->get("/api/ubudiyah/{$this->santriId}/pdf?bulan=8&tahun=2026");
        $pdfRes->assertStatus(200);
        $pdfRes->assertHeader('content-type', 'application/pdf');
    }

    public function test_unauthorized_room_access_rejected()
    {
        $otherPembina = Petugas::create([
            'nama' => 'Pembina Lain',
            'username' => 'pembina_lain',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Pembina Kamar',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0
        ]);

        // Try getting session for room without assignment
        $response = $this->actingAs($otherPembina)->getJson("/api/ubudiyah/session?target_id={$this->kamarId}&bulan=8&tahun=2026");
        $response->assertStatus(403);
    }
}
