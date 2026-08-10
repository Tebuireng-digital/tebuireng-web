<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Petugas;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RaportPengajianFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;
    protected $ustadz;
    protected $santriId;
    protected $kelompokPbsId;

    protected function setUp(): void
    {
        parent::setUp();

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $this->kelompokPbsId = DB::table('kelompok_pbs')->insertGetId([
            'kategori' => 'KELOMPOK A',
            'nama_kelompok' => 'Kelompok A1',
            'tahun_ajaran' => '2026/2027'
        ]);

        $this->santriId = DB::table('santri')->insertGetId([
            'nama' => 'Santri Test Raport',
            'kelompok_pbs_id' => $this->kelompokPbsId,
            'unit_id' => $unitId,
            'status_aktif' => 1
        ]);

        $this->admin = Petugas::create([
            'nama' => 'Admin Raport',
            'username' => 'admin_raport',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0
        ]);

        $this->ustadz = Petugas::create([
            'nama' => 'Ustadz Raport',
            'username' => 'ustadz_raport',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Ustadz',
            'status_aktif' => 1,
            'wajib_ganti_password' => 0
        ]);

        DB::table('petugas_penugasan')->insert([
            'petugas_id' => $this->ustadz->petugas_id,
            'tipe_target' => 'KelompokPBS',
            'target_id' => $this->kelompokPbsId,
            'tanggal_mulai' => now()->toDateString(),
        ]);
    }

    public function test_options_returns_available_groups()
    {
        $response = $this->actingAs($this->ustadz)->getJson('/api/raport-pengajian/options');

        $response->assertStatus(200)
            ->assertJsonStructure([
                '*' => ['jenis', 'nama', 'aspek', 'targets']
            ]);
    }

    public function test_bulk_upsert_and_show_raport()
    {
        $payload = [
            'jenis' => 'AL_QURAN',
            'target_id' => $this->kelompokPbsId,
            'bulan' => 8,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026-2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId,
                    'nilai' => [
                        'Fashohah' => 85,
                        'Tajwid' => 80,
                        'Kelancaran' => 90,
                        'Hafalan' => 78,
                    ],
                    'kepribadian' => [
                        'Kelakuan' => 'A',
                        'Kedisiplinan' => 'A',
                        'Kerajinan' => 'B',
                    ],
                    'keputusan' => 'Naik',
                    'predikat_umum' => 'Memuaskan',
                ]
            ]
        ];

        $bulkRes = $this->actingAs($this->ustadz)->postJson('/api/raport-pengajian/bulk', $payload);
        $bulkRes->assertStatus(200)
            ->assertJson(['message' => 'Raport pengajian berhasil disimpan', 'jumlah' => 1]);

        $showRes = $this->actingAs($this->ustadz)->getJson("/api/raport-pengajian/{$this->santriId}?bulan=8&tahun=2026");
        $showRes->assertStatus(200)
            ->assertJsonPath('al_quran.total_nilai', 333)
            ->assertJsonPath('al_quran.keputusan', 'Naik')
            ->assertJsonPath('predikat_umum', 'Memuaskan');
    }

    public function test_pdf_download()
    {
        // First insert a record
        $payload = [
            'jenis' => 'AL_QURAN',
            'target_id' => $this->kelompokPbsId,
            'bulan' => 8,
            'tahun' => 2026,
            'tahun_pelajaran' => '2026-2027',
            'semester' => 'Ganjil',
            'entries' => [
                [
                    'santri_id' => $this->santriId,
                    'nilai' => ['Fashohah' => 85, 'Tajwid' => 80, 'Kelancaran' => 90, 'Hafalan' => 78],
                    'kepribadian' => ['Kelakuan' => 'A', 'Kedisiplinan' => 'A', 'Kerajinan' => 'B'],
                    'keputusan' => 'Naik',
                    'predikat_umum' => 'Memuaskan',
                ]
            ]
        ];

        $this->actingAs($this->ustadz)->postJson('/api/raport-pengajian/bulk', $payload);

        $pdfRes = $this->actingAs($this->ustadz)->get("/api/raport-pengajian/{$this->santriId}/pdf?bulan=8&tahun=2026");
        $pdfRes->assertStatus(200);
        $pdfRes->assertHeader('content-type', 'application/pdf');
    }
}
