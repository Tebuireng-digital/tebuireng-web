<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PelanggaranKoreksiTest extends TestCase
{
    use RefreshDatabase;

    private Petugas $admin;
    private Petugas $keamanan1;
    private Petugas $keamanan2;
    private int $santriId;
    private int $kategoriId1;
    private int $kategoriId2;

    protected function setUp(): void
    {
        parent::setUp();

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'SMP', 'nama' => 'SMP']);
        $kamarId = DB::table('kamar')->insertGetId(['nama' => 'Kamar Test', 'unit_id' => $unitId]);
        $this->santriId = DB::table('santri')->insertGetId(['nama' => 'Santri Test', 'kamar_id' => $kamarId, 'unit_id' => $unitId]);

        $this->kategoriId1 = DB::table('kategori_pelanggaran')->insertGetId([
            'kode_pasal' => 'Pasal 1',
            'kategori' => 'Sedang',
            'uraian_pelanggaran' => 'Pelanggaran Sedang 1',
            'poin_maks' => 10,
            'jenis' => 'Pelanggaran',
            'status_aktif' => 'Aktif',
        ]);

        $this->kategoriId2 = DB::table('kategori_pelanggaran')->insertGetId([
            'kode_pasal' => 'Pasal 2',
            'kategori' => 'Berat',
            'uraian_pelanggaran' => 'Pelanggaran Berat 2',
            'poin_maks' => 25,
            'jenis' => 'Pelanggaran',
            'status_aktif' => 'Aktif',
        ]);

        $this->admin = Petugas::create([
            'nama' => 'Admin Utama',
            'username' => 'admin_test',
            'password_hash' => Hash::make('123'),
            'jabatan' => 'Admin',
            'status_aktif' => 1,
        ]);

        $this->keamanan1 = Petugas::create([
            'nama' => 'Petugas Keamanan 1',
            'username' => 'km1_test',
            'password_hash' => Hash::make('123'),
            'jabatan' => 'Keamanan',
            'status_aktif' => 1,
        ]);

        $this->keamanan2 = Petugas::create([
            'nama' => 'Petugas Keamanan 2',
            'username' => 'km2_test',
            'password_hash' => Hash::make('123'),
            'jabatan' => 'Keamanan',
            'status_aktif' => 1,
        ]);
    }

    public function test_keamanan_can_correct_own_violation_within_24_hours(): void
    {
        $pelanggaranId = DB::table('pelanggaran')->insertGetId([
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId1,
            'tanggal' => Carbon::today()->toDateString(),
            'keterangan' => 'Keterangan awal',
            'poin' => 10,
            'petugas_pencatat_id' => $this->keamanan1->petugas_id,
            'created_at' => Carbon::now()->subHours(2),
            'updated_at' => Carbon::now()->subHours(2),
        ]);

        $response = $this->actingAs($this->keamanan1)->patchJson("/api/pelanggaran/{$pelanggaranId}", [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId2,
            'tanggal' => Carbon::today()->toDateString(),
            'keterangan' => 'Keterangan setelah dikoreksi',
            'alasan_koreksi' => 'Salah pilih kategori pasal saat input malam',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.poin', 25);
        $response->assertJsonPath('data.keterangan', 'Keterangan setelah dikoreksi');
        $response->assertJsonPath('data.alasan_koreksi', 'Salah pilih kategori pasal saat input malam');
        $response->assertJsonPath('data.diubah_oleh_petugas_id', $this->keamanan1->petugas_id);

        $dbRecord = DB::table('pelanggaran')->where('pelanggaran_id', $pelanggaranId)->first();
        $this->assertEquals(25, $dbRecord->poin);
        $this->assertEquals(1, $dbRecord->jumlah_koreksi);
        $this->assertEquals($this->keamanan1->petugas_id, $dbRecord->diubah_oleh_petugas_id);
    }

    public function test_keamanan_cannot_correct_other_officer_violation(): void
    {
        $pelanggaranId = DB::table('pelanggaran')->insertGetId([
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId1,
            'tanggal' => Carbon::today()->toDateString(),
            'keterangan' => 'Dicatat keamanan 1',
            'poin' => 10,
            'petugas_pencatat_id' => $this->keamanan1->petugas_id,
            'created_at' => Carbon::now()->subHours(1),
            'updated_at' => Carbon::now()->subHours(1),
        ]);

        // Petugas Keamanan 2 mencoba mengedit catatan Keamanan 1
        $response = $this->actingAs($this->keamanan2)->patchJson("/api/pelanggaran/{$pelanggaranId}", [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId2,
            'tanggal' => Carbon::today()->toDateString(),
            'keterangan' => 'Mencoba ubah',
            'alasan_koreksi' => 'Mencoba koreksi milik orang lain',
        ]);

        $response->assertStatus(403);
    }

    public function test_keamanan_cannot_correct_violation_older_than_24_hours(): void
    {
        $pelanggaranId = DB::table('pelanggaran')->insertGetId([
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId1,
            'tanggal' => Carbon::now()->subDays(2)->toDateString(),
            'keterangan' => 'Dicatat 2 hari lalu',
            'poin' => 10,
            'petugas_pencatat_id' => $this->keamanan1->petugas_id,
            'created_at' => Carbon::now()->subHours(26),
            'updated_at' => Carbon::now()->subHours(26),
        ]);

        $response = $this->actingAs($this->keamanan1)->patchJson("/api/pelanggaran/{$pelanggaranId}", [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId2,
            'tanggal' => Carbon::now()->subDays(2)->toDateString(),
            'keterangan' => 'Mencoba ubah data lama',
            'alasan_koreksi' => 'Koreksi yang terlambat',
        ]);

        $response->assertStatus(403);
        $response->assertJsonFragment([
            'message' => 'Batas waktu koreksi (24 jam) telah berakhir. Data telah dikunci.',
        ]);
    }

    public function test_admin_can_correct_any_violation_at_any_time(): void
    {
        $pelanggaranId = DB::table('pelanggaran')->insertGetId([
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId1,
            'tanggal' => Carbon::now()->subDays(7)->toDateString(),
            'keterangan' => 'Dicatat minggu lalu',
            'poin' => 10,
            'petugas_pencatat_id' => $this->keamanan1->petugas_id,
            'created_at' => Carbon::now()->subDays(7),
            'updated_at' => Carbon::now()->subDays(7),
        ]);

        $response = $this->actingAs($this->admin)->patchJson("/api/pelanggaran/{$pelanggaranId}", [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId2,
            'tanggal' => Carbon::now()->subDays(7)->toDateString(),
            'keterangan' => 'Dikoreksi oleh admin',
            'alasan_koreksi' => 'Putusan sidang pengasuhan santri',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.poin', 25);
        $response->assertJsonPath('data.diubah_oleh_petugas_id', $this->admin->petugas_id);
    }

    public function test_correction_requires_valid_reason(): void
    {
        $pelanggaranId = DB::table('pelanggaran')->insertGetId([
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId1,
            'tanggal' => Carbon::today()->toDateString(),
            'keterangan' => 'Awal',
            'poin' => 10,
            'petugas_pencatat_id' => $this->keamanan1->petugas_id,
            'created_at' => Carbon::now()->subHour(),
            'updated_at' => Carbon::now()->subHour(),
        ]);

        $response = $this->actingAs($this->keamanan1)->patchJson("/api/pelanggaran/{$pelanggaranId}", [
            'santri_id' => $this->santriId,
            'kategori_pelanggaran_id' => $this->kategoriId1,
            'tanggal' => Carbon::today()->toDateString(),
            'keterangan' => 'Awal',
            'alasan_koreksi' => 'tes', // kurang dari 5 karakter
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['alasan_koreksi']);
    }
}
