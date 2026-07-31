<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReadAccessFeatureTest extends TestCase
{
    use RefreshDatabase;

    private Petugas $admin;
    private Petugas $pengasuh;
    private Petugas $keamanan;
    private Petugas $pembinaA;
    private Petugas $pembinaB;
    private Petugas $wali;
    private Petugas $ustadz;
    private int $santriA;
    private int $santriB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->petugas('Admin', 'admin-baca');
        $this->pengasuh = $this->petugas('Pengasuh', 'pengasuh-baca');
        $this->keamanan = $this->petugas('Keamanan', 'keamanan-baca');
        $this->pembinaA = $this->petugas('Pembina Kamar', 'pembina-a-baca');
        $this->pembinaB = $this->petugas('Pembina Kamar', 'pembina-b-baca');
        $this->wali = $this->petugas('Wali Kelas', 'wali-baca');
        $this->ustadz = $this->petugas('Ustadz', 'ustadz-baca');

        $unitId = DB::table('unit_pendidikan')->insertGetId(['kode' => 'MTS', 'nama' => 'MTs']);
        $kamarA = DB::table('kamar')->insertGetId([
            'nama' => 'Kamar A', 'unit_id' => $unitId, 'pembina_id' => $this->pembinaA->petugas_id,
        ]);
        $kamarB = DB::table('kamar')->insertGetId([
            'nama' => 'Kamar B', 'unit_id' => $unitId, 'pembina_id' => $this->pembinaB->petugas_id,
        ]);
        DB::table('petugas_penugasan')->insert([
            [
                'petugas_id' => $this->pembinaA->petugas_id,
                'tipe_target' => 'Kamar',
                'target_id' => $kamarA,
                'tanggal_mulai' => now()->toDateString(),
            ],
            [
                'petugas_id' => $this->pembinaB->petugas_id,
                'tipe_target' => 'Kamar',
                'target_id' => $kamarB,
                'tanggal_mulai' => now()->toDateString(),
            ],
        ]);
        $this->santriA = DB::table('santri')->insertGetId([
            'nama' => 'Santri A', 'nis' => 'A001', 'unit_id' => $unitId, 'kamar_id' => $kamarA,
            'nama_wali' => 'Wali Santri A', 'no_hp_wali' => '081111111111',
        ]);
        $this->santriB = DB::table('santri')->insertGetId([
            'nama' => 'Santri B', 'nis' => 'B001', 'unit_id' => $unitId, 'kamar_id' => $kamarB,
            'nama_wali' => 'Wali Santri B', 'no_hp_wali' => '082222222222',
        ]);

        $kategoriId = DB::table('kategori_pelanggaran')->insertGetId([
            'kode_pasal' => 'R-01', 'kategori' => 'Ringan', 'uraian_pelanggaran' => 'Pelanggaran ringan',
            'poin_maks' => 5, 'jenis' => 'Pelanggaran', 'status_aktif' => 'Aktif',
        ]);
        foreach ([$this->santriA, $this->santriB] as $santriId) {
            DB::table('pelanggaran')->insert([
                'santri_id' => $santriId,
                'kategori_pelanggaran_id' => $kategoriId,
                'tanggal' => now()->toDateString(),
                'petugas_pencatat_id' => $this->admin->petugas_id,
            ]);
        }

        $jenisIzinId = DB::table('jenis_izin')->insertGetId(['nama' => 'Izin Tes']);
        DB::table('perizinan')->insert([
            'santri_id' => $this->santriB,
            'jenis_izin_id' => $jenisIzinId,
            'keperluan' => 'Tes',
            'tanggal_mulai' => now(),
            'rencana_kembali' => now()->addDay(),
            'status' => 'Disetujui',
            'diajukan_oleh' => $this->keamanan->petugas_id,
        ]);
    }

    public function test_room_supervisor_only_reads_assigned_students_without_guardian_pii(): void
    {
        $this->actingAs($this->pembinaA, 'sanctum');

        $response = $this->getJson('/api/santri')->assertOk();
        $response->assertJsonCount(1)
            ->assertJsonPath('0.santri_id', $this->santriA)
            ->assertJsonMissingPath('0.nama_wali')
            ->assertJsonMissingPath('0.no_hp_wali');
    }

    public function test_room_supervisor_only_reads_violations_for_assigned_students(): void
    {
        $this->actingAs($this->pembinaA, 'sanctum');

        $this->getJson('/api/pelanggaran')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.santri_id', $this->santriA);

        $this->getJson('/api/pelanggaran?santri_id='.$this->santriB)
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_security_and_caregiver_can_read_global_operational_data(): void
    {
        $this->actingAs($this->keamanan, 'sanctum');
        $this->getJson('/api/santri')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/pelanggaran')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/santri/'.$this->santriB.'/perizinan')->assertOk()->assertJsonCount(1);

        $this->actingAs($this->pengasuh, 'sanctum');
        $this->getJson('/api/pelanggaran')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/santri/'.$this->santriB.'/perizinan')->assertOk()->assertJsonCount(1);
    }

    public function test_unrelated_roles_cannot_use_violation_or_student_directory_endpoints(): void
    {
        foreach ([$this->wali, $this->ustadz] as $petugas) {
            $this->actingAs($petugas, 'sanctum');
            $this->getJson('/api/santri')->assertForbidden();
            $this->getJson('/api/pelanggaran')->assertForbidden();
            $this->getJson('/api/pelanggaran/kategori')->assertForbidden();
            $this->getJson('/api/santri/'.$this->santriA.'/poin')->assertForbidden();
            $this->getJson('/api/santri/'.$this->santriA.'/perizinan')->assertForbidden();
            $this->postJson('/api/pelanggaran', [
                'santri_id' => $this->santriA,
                'kategori_pelanggaran_id' => 1,
                'tanggal' => now()->toDateString(),
            ])->assertForbidden();
        }
    }

    private function petugas(string $jabatan, string $username): Petugas
    {
        return Petugas::create([
            'nama' => $jabatan,
            'username' => $username,
            'password_hash' => Hash::make('PasswordTes123'),
            'wajib_ganti_password' => false,
            'jabatan' => $jabatan,
            'status_aktif' => true,
        ]);
    }
}
