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
            'nama' => 'Piket Pengajian Raport',
            'username' => 'ustadz_raport',
            'password_hash' => Hash::make('password'),
            'jabatan' => 'Piket Pengajian',
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

    public function test_publish_creates_immutable_versions_and_history(): void
    {
        $payload = [
            'jenis' => 'AL_QURAN', 'target_id' => $this->kelompokPbsId, 'bulan' => 8, 'tahun' => 2026,
            'tahun_pelajaran' => '2026-2027', 'semester' => 'Ganjil',
            'entries' => [[
                'santri_id' => $this->santriId,
                'nilai' => ['Fashohah' => 85, 'Tajwid' => 80, 'Kelancaran' => 90, 'Hafalan' => 78],
                'kepribadian' => ['Kelakuan' => 'A', 'Kedisiplinan' => 'A', 'Kerajinan' => 'B'],
                'keputusan' => 'Naik', 'predikat_umum' => 'Memuaskan',
            ]],
        ];
        $this->actingAs($this->ustadz)->postJson('/api/raport-pengajian/bulk', $payload)->assertOk();

        $first = $this->actingAs($this->ustadz)->postJson("/api/raport-pengajian/{$this->santriId}/publish", ['bulan' => 8, 'tahun' => 2026]);
        $first->assertCreated()->assertJsonPath('versi', 1);
        $second = $this->actingAs($this->ustadz)->postJson("/api/raport-pengajian/{$this->santriId}/publish", ['bulan' => 8, 'tahun' => 2026]);
        $second->assertCreated()->assertJsonPath('versi', 2);

        $history = $this->actingAs($this->ustadz)->getJson("/api/raport-pengajian/{$this->santriId}/history");
        $history->assertOk()->assertJsonCount(2);
        $this->assertSame(2, DB::table('report_documents')->where('santri_id', $this->santriId)->count());
    }

    public function test_pengajian_lock_and_unlock_flow(): void
    {
        $payload = [
            'jenis' => 'AL_QURAN', 'target_id' => $this->kelompokPbsId, 'bulan' => 9, 'tahun' => 2026,
            'tahun_pelajaran' => '2026-2027', 'semester' => 'Ganjil',
            'entries' => [[
                'santri_id' => $this->santriId,
                'nilai' => ['Fashohah' => 85, 'Tajwid' => 80, 'Kelancaran' => 90, 'Hafalan' => 78],
                'kepribadian' => ['Kelakuan' => 'A', 'Kedisiplinan' => 'A', 'Kerajinan' => 'B'],
                'keputusan' => 'Naik', 'predikat_umum' => 'Memuaskan',
            ]],
        ];
        $this->actingAs($this->ustadz)->postJson('/api/raport-pengajian/bulk', $payload)->assertOk();

        // Lock
        $lockRes = $this->actingAs($this->ustadz)->postJson('/api/raport-pengajian/lock', [
            'jenis' => 'AL_QURAN',
            'target_id' => $this->kelompokPbsId,
            'bulan' => 9,
            'tahun' => 2026,
        ]);
        $lockRes->assertOk()->assertJsonPath('lock_status.is_locked', true);

        // Edit blocked for non-admin
        $editRes = $this->actingAs($this->ustadz)->postJson('/api/raport-pengajian/bulk', $payload);
        $editRes->assertStatus(422);

        // Unlock
        $unlockRes = $this->actingAs($this->ustadz)->postJson('/api/raport-pengajian/unlock', [
            'jenis' => 'AL_QURAN',
            'target_id' => $this->kelompokPbsId,
            'bulan' => 9,
            'tahun' => 2026,
            'alasan' => 'Revisi nilai kelancaran',
        ]);
        $unlockRes->assertOk()->assertJsonPath('lock_status.is_locked', false);
    }
}

