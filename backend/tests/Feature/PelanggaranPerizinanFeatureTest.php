<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Petugas;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;
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

        $this->admin = Petugas::create([
            'nama' => 'Admin A', 'username' => 'admin', 'password_hash' => Hash::make('123'), 'jabatan' => 'Admin', 'status_aktif' => 1
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
    }

    public function test_only_security_or_admin_can_create_permission()
    {
        $payload = [
            'santri_id' => $this->santriId,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => 'Sakit',
            'tanggal_mulai' => now()->toDateString(),
            'rencana_kembali' => now()->addDays(2)->toDateString(),
        ];

        $this->actingAs($this->pembina, 'sanctum');
        $this->postJson('/api/perizinan', $payload)->assertStatus(403);

        $this->actingAs($this->keamanan, 'sanctum');
        $this->postJson('/api/perizinan', $payload)->assertStatus(201);

        $perizinanId = DB::table('perizinan')->value('perizinan_id');
        $perizinan = DB::table('perizinan')->where('perizinan_id', $perizinanId)->first();
        $this->assertEquals('Disetujui', $perizinan->status);
        $this->assertEquals($this->keamanan->petugas_id, $perizinan->diajukan_oleh);
    }

    public function test_violation_returns_id_and_accepts_attachment()
    {
        Storage::fake('local');
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'tanggal' => now()->toDateString(),
            'keterangan' => 'Pelanggaran uji',
        ])->assertCreated()->assertJsonStructure(['message', 'pelanggaran_id']);

        $this->assertDatabaseCount('lampiran_pelanggaran', 0);

        $pelanggaranId = $response->json('pelanggaran_id');
        $uploadResponse = $this->post('/api/pelanggaran/'.$pelanggaranId.'/lampiran', [
            'file' => UploadedFile::fake()->image('bukti.jpg'),
        ])->assertOk()
            ->assertJsonPath('message', 'Lampiran berhasil diunggah.');

        $lampiran = DB::table('lampiran_pelanggaran')
            ->where('pelanggaran_id', $pelanggaranId)
            ->first();

        $this->assertNotNull($lampiran);
        $this->assertSame('local', $lampiran->disk);
        $this->assertSame('bukti.jpg', $lampiran->original_filename);
        $this->assertSame('image/jpeg', $lampiran->mime_type);
        $this->assertNotEmpty($lampiran->sha256);
        Storage::disk('local')->assertExists($lampiran->path_file);

        $this->getJson('/api/pelanggaran/'.$pelanggaranId.'/lampiran')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.lampiran_id', $lampiran->lampiran_id)
            ->assertJsonPath('0.preview_url', $uploadResponse->json('lampiran.preview_url'))
            ->assertJsonPath('0.download_url', $uploadResponse->json('lampiran.download_url'));

        $this->get('/api/pelanggaran/'.$pelanggaranId.'/lampiran/'.$lampiran->lampiran_id)
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->actingAs($this->pembina, 'sanctum')
            ->getJson('/api/pelanggaran/'.$pelanggaranId.'/lampiran')
            ->assertStatus(403);
    }

    public function test_violation_attachment_rejects_pdf_for_consistent_image_only_contract(): void
    {
        Storage::fake('local');
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'tanggal' => now()->toDateString(),
            'keterangan' => 'Pelanggaran uji',
        ])->assertCreated();

        $pelanggaranId = $response->json('pelanggaran_id');

        $this->withHeaders(['Accept' => 'application/json'])
            ->post('/api/pelanggaran/'.$pelanggaranId.'/lampiran', [
                'file' => UploadedFile::fake()->create('bukti.pdf', 10, 'application/pdf'),
            ])->assertStatus(422);
    }

    public function test_violation_create_endpoint_accepts_attachment_on_initial_submit(): void
    {
        Storage::fake('local');
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->post('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'tanggal' => now()->toDateString(),
            'keterangan' => 'Pelanggaran dengan bukti awal',
            'file' => UploadedFile::fake()->image('bukti-awal.jpg'),
        ])->assertCreated();

        $pelanggaranId = $response->json('pelanggaran_id');
        $lampiran = DB::table('lampiran_pelanggaran')
            ->where('pelanggaran_id', $pelanggaranId)
            ->first();

        $this->assertNotNull($lampiran);
        $this->assertSame('image/jpeg', $lampiran->mime_type);
        $this->assertSame('bukti-awal.jpg', $lampiran->original_filename);
        Storage::disk('local')->assertExists($lampiran->path_file);
    }

    public function test_violation_create_endpoint_rejects_invalid_attachment_contract(): void
    {
        Storage::fake('local');
        $this->actingAs($this->admin, 'sanctum');

        $this->withHeaders(['Accept' => 'application/json'])
            ->post('/api/pelanggaran', [
                'santri_id' => $this->santriId,
                'kategori_pelanggaran_id' => $this->kategoriId,
                'tanggal' => now()->toDateString(),
                'keterangan' => 'Pelanggaran dengan file tidak valid',
                'file' => UploadedFile::fake()->create('bukti.pdf', 10, 'application/pdf'),
            ])->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_violation_can_be_created_without_attachment_because_proof_is_optional(): void
    {
        Storage::fake('local');
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'tanggal' => now()->toDateString(),
            'keterangan' => 'Pelanggaran tanpa bukti foto',
        ])->assertCreated();

        $this->assertDatabaseHas('pelanggaran', [
            'pelanggaran_id' => $response->json('pelanggaran_id'),
            'santri_id' => $this->santriId,
        ]);
        $this->assertDatabaseCount('lampiran_pelanggaran', 0);
    }

    public function test_violation_attachment_rejects_file_above_one_megabyte(): void
    {
        Storage::fake('local');
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'tanggal' => now()->toDateString(),
            'keterangan' => 'Pelanggaran uji',
        ])->assertCreated();

        $pelanggaranId = $response->json('pelanggaran_id');

        $this->withHeaders(['Accept' => 'application/json'])
            ->post('/api/pelanggaran/'.$pelanggaranId.'/lampiran', [
                'file' => UploadedFile::fake()->image('bukti-besar.jpg')->size(1025),
            ])->assertStatus(422);
    }

    public function test_violation_store_sanitizes_keterangan_before_saving(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'tanggal' => now()->toDateString(),
            'keterangan' => "  <script>alert('x')</script><b>Tidak ikut apel</b>\n\n  ",
        ])->assertCreated();

        $this->assertDatabaseHas('pelanggaran', [
            'pelanggaran_id' => $response->json('pelanggaran_id'),
            'keterangan' => 'Tidak ikut apel',
        ]);
    }

    public function test_violation_store_sanitizes_custom_category_description_before_creating_master_record(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => 0,
            'uraian_pelanggaran_custom' => " <div>Keluar kamar tanpa izin</div><script>alert('x')</script> ",
            'kategori_custom' => 'Ringan',
            'poin' => 5,
            'tanggal' => now()->toDateString(),
        ])->assertCreated();

        $pelanggaran = DB::table('pelanggaran')
            ->where('pelanggaran_id', $response->json('pelanggaran_id'))
            ->first();

        $this->assertNotNull($pelanggaran);
        $this->assertDatabaseHas('kategori_pelanggaran', [
            'kategori_pelanggaran_id' => $pelanggaran->kategori_pelanggaran_id,
            'uraian_pelanggaran' => 'Keluar kamar tanpa izin',
        ]);
    }

    public function test_violation_store_rejects_custom_description_that_becomes_empty_after_sanitization(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => 0,
            'uraian_pelanggaran_custom' => "<script>alert('x')</script><div>   </div>",
            'kategori_custom' => 'Ringan',
            'poin' => 5,
            'tanggal' => now()->toDateString(),
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['uraian_pelanggaran_custom']);
    }

    public function test_master_violation_category_payload_is_sanitized_on_store_and_update(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $created = $this->postJson('/api/pelanggaran/kategori', [
            'kode_pasal' => ' <b>Pasal X</b> ',
            'kategori' => 'Ringan',
            'uraian_pelanggaran' => " <p>Tidak piket</p><script>alert('x')</script> ",
            'poin_maks' => 3,
            'jenis' => 'Pelanggaran',
        ])->assertCreated();

        $kategoriId = $created->json('kategori_pelanggaran_id');

        $this->assertDatabaseHas('kategori_pelanggaran', [
            'kategori_pelanggaran_id' => $kategoriId,
            'kode_pasal' => 'Pasal X',
            'uraian_pelanggaran' => 'Tidak piket',
        ]);

        $this->patchJson('/api/pelanggaran/kategori/'.$kategoriId, [
            'kode_pasal' => " <span>Pasal Y</span> ",
            'uraian_pelanggaran' => " <strong>Tidak ikut kegiatan</strong><style>body{display:none}</style> ",
        ])->assertOk();

        $this->assertDatabaseHas('kategori_pelanggaran', [
            'kategori_pelanggaran_id' => $kategoriId,
            'kode_pasal' => 'Pasal Y',
            'uraian_pelanggaran' => 'Tidak ikut kegiatan',
        ]);
    }

    public function test_violation_accepts_actual_points_up_to_category_maximum(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'poin' => 1,
            'tanggal' => now()->toDateString(),
        ])->assertCreated();

        $this->assertDatabaseHas('pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'poin' => 1,
        ]);

        $this->postJson('/api/pelanggaran', [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId,
            'poin' => 26,
            'tanggal' => now()->toDateString(),
        ])->assertStatus(422);
    }

    public function test_success_flow_and_absensi_upsert()
    {
        // Setup Kegiatan to test absensi
        $jenisKeg = DB::table('jenis_kegiatan')->insertGetId(['kode' => 'KAMAR', 'nama' => 'Kamar']);
        $jadwalId = DB::table('jadwal_kegiatan')->insertGetId([
            'jenis_kegiatan_id' => $jenisKeg, 'nama_jadwal' => 'Tes', 'jam_mulai' => '07:00:00', 'jam_selesai' => '08:00:00'
        ]);

        $this->actingAs($this->keamanan, 'sanctum');

        $this->postJson('/api/perizinan', [
            'santri_id' => $this->santriId,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => 'Pulang',
            'tanggal_mulai' => now()->toDateString(),
            'rencana_kembali' => now()->addDays(2)->toDateString(),
        ])->assertStatus(201);

        $perizinanId = DB::table('perizinan')->first()->perizinan_id;

        // Izin langsung disetujui dan event membuat absensi Izin.
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

    public function test_download_pdf_success()
    {
        $perizinanId = DB::table('perizinan')->insertGetId([
            'santri_id' => $this->santriId,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => 'Tes PDF',
            'tanggal_mulai' => now()->toDateString(),
            'rencana_kembali' => now()->addDays(2)->toDateString(),
            'status' => 'Disetujui',
            'diajukan_oleh' => $this->admin->petugas_id,
        ]);

        $this->actingAs($this->keamanan, 'sanctum');

        $response = $this->get('/api/perizinan/' . $perizinanId . '/pdf');
        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_security_can_correct_gate_times_and_status(): void
    {
        $perizinanId = DB::table('perizinan')->insertGetId([
            'santri_id' => $this->santriId,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => 'Koreksi waktu gerbang',
            'tanggal_mulai' => '2026-08-08 08:00:00',
            'rencana_kembali' => '2026-08-09 18:00:00',
            'status' => 'Selesai',
            'waktu_keluar_aktual' => '2026-08-08 09:00:00',
            'waktu_masuk_aktual' => '2026-08-09 17:00:00',
            'diajukan_oleh' => $this->admin->petugas_id,
        ]);

        $this->actingAs($this->keamanan, 'sanctum');

        $this->patchJson('/api/perizinan/' . $perizinanId . '/gerbang/koreksi', [
            'waktu_keluar_aktual' => '2026-08-08 10:00:00',
            'waktu_masuk_aktual' => null,
        ])->assertOk();

        $this->assertDatabaseHas('perizinan', [
            'perizinan_id' => $perizinanId,
            'status' => 'Sedang Berjalan',
            'waktu_keluar_aktual' => '2026-08-08 10:00:00',
            'waktu_masuk_aktual' => null,
            'dicatat_keamanan_oleh' => $this->keamanan->petugas_id,
        ]);

        $this->assertDatabaseHas('perizinan_gerbang_koreksi', [
            'perizinan_id' => $perizinanId,
            'waktu_keluar_sebelum' => '2026-08-08 09:00:00',
            'waktu_masuk_sebelum' => '2026-08-09 17:00:00',
            'waktu_keluar_sesudah' => '2026-08-08 10:00:00',
            'waktu_masuk_sesudah' => null,
            'dikoreksi_oleh' => $this->keamanan->petugas_id,
        ]);
    }

    public function test_security_can_set_initial_gate_times_from_an_active_permission(): void
    {
        $perizinanId = DB::table('perizinan')->insertGetId([
            'santri_id' => $this->santriId,
            'jenis_izin_id' => $this->jenisIzinId,
            'keperluan' => 'Validasi koreksi waktu',
            'tanggal_mulai' => '2026-08-08 08:00:00',
            'rencana_kembali' => '2026-08-09 18:00:00',
            'status' => 'Disetujui',
            'diajukan_oleh' => $this->admin->petugas_id,
        ]);

        $this->actingAs($this->keamanan, 'sanctum');

        $this->patchJson('/api/perizinan/' . $perizinanId . '/gerbang/koreksi', [
            'waktu_keluar_aktual' => '2026-08-08 08:00:00',
            'waktu_masuk_aktual' => '2026-08-09 17:00:00',
        ])->assertOk();

        $this->assertDatabaseHas('perizinan', [
            'perizinan_id' => $perizinanId,
            'status' => 'Selesai',
            'waktu_keluar_aktual' => '2026-08-08 08:00:00',
            'waktu_masuk_aktual' => '2026-08-09 17:00:00',
        ]);
    }
}
