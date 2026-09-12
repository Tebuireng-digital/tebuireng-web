<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(PetugasSeeder::class);
        $this->call(OrganisasiDaerahSeeder::class);
        $this->call(UbudiyahSeeder::class);
        $this->call(UnitPendidikanSeeder::class);
        $this->call(PrestasiSeeder::class);
        $this->command?->call('import:master-putra');

        $adminId = DB::table('petugas')->where('username', 'admin')->value('petugas_id');
        if ($adminId) {
            DB::table('periode_akademik')->updateOrInsert(
                ['tahun_pelajaran' => '2026/2027', 'semester' => 'Ganjil'],
                [
                    'tanggal_mulai' => '2026-07-01',
                    'tanggal_selesai' => '2026-12-31',
                    'status' => 'Aktif',
                    'dibuat_oleh' => $adminId,
                    'updated_at' => now(),
                ]
            );
        }

        foreach ([
            ['kode' => 'KAMAR', 'nama' => 'Kegiatan Kamar'],
            ['kode' => 'SEKOLAH', 'nama' => 'Kelas Formal'],
            ['kode' => 'PBS', 'nama' => 'Kelompok Al-Qur\'an Subuh'],
            ['kode' => 'PBM', 'nama' => 'Takhasus Maghrib'],
            ['kode' => 'DINIYAH', 'nama' => 'Kelas Madin'],
        ] as $jk) {
            DB::table('jenis_kegiatan')->updateOrInsert(['kode' => $jk['kode']], $jk);
        }

        $kegiatanIds = DB::table('jenis_kegiatan')->pluck('jenis_kegiatan_id', 'kode');
        foreach ([
            ['jenis_kegiatan_id' => $kegiatanIds['SEKOLAH'], 'nama_jadwal' => 'Absensi Sekolah', 'jam_mulai' => '07:30:00', 'jam_selesai' => '13:00:00'],
            ['jenis_kegiatan_id' => $kegiatanIds['KAMAR'], 'nama_jadwal' => 'Absensi Kamar Pagi (keberangkatan kelas)', 'konteks_operasional' => 'keberangkatan_kelas', 'jam_mulai' => '06:00:00', 'jam_selesai' => '07:30:00'],
            ['jenis_kegiatan_id' => $kegiatanIds['KAMAR'], 'nama_jadwal' => 'Absensi Kamar malam', 'konteks_operasional' => 'kamar', 'jam_mulai' => '20:00:00', 'jam_selesai' => '20:30:00'],
            ['jenis_kegiatan_id' => $kegiatanIds['PBS'], 'nama_jadwal' => 'Absensi PBSubuh', 'jam_mulai' => '05:00:00', 'jam_selesai' => '06:00:00'],
            ['jenis_kegiatan_id' => $kegiatanIds['DINIYAH'], 'nama_jadwal' => 'Absensi Diniyah', 'jam_mulai' => '15:30:00', 'jam_selesai' => '16:00:00'],
            ['jenis_kegiatan_id' => $kegiatanIds['PBM'], 'nama_jadwal' => 'Absensi PBMmaghrib', 'jam_mulai' => '18:30:00', 'jam_selesai' => '19:30:00'],
        ] as $jadwal) {
            DB::table('jadwal_kegiatan')->updateOrInsert(
                ['jenis_kegiatan_id' => $jadwal['jenis_kegiatan_id'], 'konteks_operasional' => $jadwal['konteks_operasional'] ?? 'utama'],
                $jadwal
            );
        }

        $this->seedOperationalAssignments();

        foreach ([
            ['nama' => 'Izin Pulang'],
            ['nama' => 'Izin Sakit'],
            ['nama' => 'Izin Keluar Komplek'],
        ] as $izin) {
            DB::table('jenis_izin')->updateOrInsert(['nama' => $izin['nama']], $izin);
        }

        foreach ([
            ['kategori' => 'Ringan', 'poin_min' => 1, 'poin_maks' => 19, 'tindakan_sanksi' => 'Teguran lisan & pembinaan', 'urutan' => 1],
            ['kategori' => 'Ringan', 'poin_min' => 20, 'poin_maks' => 29, 'tindakan_sanksi' => 'Teguran tertulis (Surat Peringatan 1) / Botak', 'urutan' => 2],
            ['kategori' => 'Sedang', 'poin_min' => 30, 'poin_maks' => 49, 'tindakan_sanksi' => 'Pemanggilan Orang Tua / Surat Peringatan 2', 'urutan' => 3],
            ['kategori' => 'Sedang', 'poin_min' => 50, 'poin_maks' => 79, 'tindakan_sanksi' => 'Surat Peringatan 3 & Skorsing', 'urutan' => 4],
            ['kategori' => 'Berat', 'poin_min' => 80, 'poin_maks' => 100, 'tindakan_sanksi' => 'Dikembalikan ke Orang Tua (Dikeluarkan)', 'urutan' => 5],
        ] as $sanksi) {
            DB::table('aturan_sanksi')->updateOrInsert(['urutan' => $sanksi['urutan']], $sanksi);
        }

        foreach ([
            ['setting_key' => 'WA_API_URL', 'setting_value' => 'http://localhost:3000/send', 'keterangan' => 'URL Endpoint Gateway WA'],
            ['setting_key' => 'WA_API_KEY', 'setting_value' => 'secret-key-123', 'keterangan' => 'Key autentikasi gateway'],
            ['setting_key' => 'CRON_OVERDUE_MENIT', 'setting_value' => '60', 'keterangan' => 'Batas terlambat sebelum dianggap overdue (menit)'],
            ['setting_key' => 'AMBANG_POIN_SP1', 'setting_value' => '20', 'keterangan' => 'Batas poin untuk SP1'],
            ['setting_key' => 'AMBANG_POIN_SP2', 'setting_value' => '30', 'keterangan' => 'Batas poin untuk SP2'],
            ['setting_key' => 'AMBANG_POIN_SP3', 'setting_value' => '50', 'keterangan' => 'Batas poin untuk SP3'],
            ['setting_key' => 'toleransi_menit_terlambat_input', 'setting_value' => '30', 'keterangan' => 'Toleransi menit sebelum input absensi dianggap terlambat'],
            ['setting_key' => 'durasi_edit_absensi_menit', 'setting_value' => '60', 'keterangan' => 'Batas waktu (menit) non-admin bisa edit absensi'],
            ['setting_key' => 'ambang_notifikasi_poin', 'setting_value' => '20', 'keterangan' => 'Ambang poin untuk mengirim notifikasi ke Admin'],
        ] as $setting) {
            DB::table('pengaturan_sistem')->updateOrInsert(['setting_key' => $setting['setting_key']], $setting);
        }
    }

    private function seedOperationalAssignments(): void
    {
        $today = now()->toDateString();
        $petugas = DB::table('petugas')->pluck('petugas_id', 'username');
        $assignments = [
            ['username' => 'walikelas', 'tipe_target' => 'KelasFormal', 'targets' => DB::table('kelas_formal')->orderBy('kelas_formal_id')->pluck('kelas_formal_id')],
            ['username' => 'pembinakamar', 'tipe_target' => 'Kamar', 'targets' => DB::table('kamar')->where('status_aktif', 1)->orderBy('kamar_id')->pluck('kamar_id')],
            ['username' => 'piketpengajian', 'tipe_target' => 'KelompokPBS', 'targets' => DB::table('kelompok_pbs')->orderBy('kelompok_pbs_id')->pluck('kelompok_pbs_id')],
            ['username' => 'piketpengajian', 'tipe_target' => 'KelompokPBM', 'targets' => DB::table('kelompok_pbm')->orderBy('kelompok_pbm_id')->pluck('kelompok_pbm_id')],
            ['username' => 'piketpengajian', 'tipe_target' => 'KelompokMadin', 'targets' => DB::table('kelompok_madin')->orderBy('kelompok_madin_id')->pluck('kelompok_madin_id')],
        ];

        foreach ($assignments as $assignment) {
            $petugasId = $petugas[$assignment['username']] ?? null;
            if (!$petugasId) continue;
            foreach ($assignment['targets'] as $targetId) {
                $exists = DB::table('petugas_penugasan')
                    ->where('petugas_id', $petugasId)
                    ->where('tipe_target', $assignment['tipe_target'])
                    ->where('target_id', $targetId)
                    ->whereNull('tanggal_selesai')
                    ->exists();
                if (!$exists) {
                    DB::table('petugas_penugasan')->insert([
                        'petugas_id' => $petugasId,
                        'tipe_target' => $assignment['tipe_target'],
                        'target_id' => $targetId,
                        'tanggal_mulai' => $today,
                    ]);
                }
            }
        }
    }
}
