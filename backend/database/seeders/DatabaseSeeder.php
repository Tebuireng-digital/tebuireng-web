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

        DB::table('unit_pendidikan')->insert([
            ['kode' => 'MTS', 'nama' => 'MTs Salafiyah Syafi\'iyah'],
            ['kode' => 'SMP', 'nama' => 'SMP A. Wahid Hasyim'],
            ['kode' => 'SMA', 'nama' => 'SMA A. Wahid Hasyim'],
            ['kode' => 'SMK', 'nama' => 'SMK Khoiriyah Hasyim'],
            ['kode' => 'MA', 'nama' => 'MA Salafiyah Syafi\'iyah'],
        ]);

        DB::table('jenis_kegiatan')->insert([
            ['kode' => 'KAMAR', 'nama' => 'Kegiatan Kamar'],
            ['kode' => 'SEKOLAH', 'nama' => 'Kelas Formal'],
            ['kode' => 'PBS', 'nama' => 'Kelompok Al-Qur\'an Subuh'],
            ['kode' => 'PBM', 'nama' => 'Takhasus Maghrib'],
            ['kode' => 'DINIYAH', 'nama' => 'Kelas Madin'],
        ]);

        $kegiatanIds = DB::table('jenis_kegiatan')->pluck('jenis_kegiatan_id', 'kode');
        DB::table('jadwal_kegiatan')->insert([
            ['jenis_kegiatan_id' => $kegiatanIds['SEKOLAH'], 'nama_jadwal' => 'Absensi Kelas Formal', 'jam_mulai' => '07:00:00', 'jam_selesai' => '07:30:00'],
            ['jenis_kegiatan_id' => $kegiatanIds['KAMAR'], 'nama_jadwal' => 'Absensi Kamar Malam', 'jam_mulai' => '20:00:00', 'jam_selesai' => '20:30:00'],
            ['jenis_kegiatan_id' => $kegiatanIds['PBS'], 'nama_jadwal' => 'Belajar Al-Qur\'an Subuh', 'jam_mulai' => '05:00:00', 'jam_selesai' => '06:00:00'],
            ['jenis_kegiatan_id' => $kegiatanIds['DINIYAH'], 'nama_jadwal' => 'Absensi Kelas Madin', 'jam_mulai' => '15:30:00', 'jam_selesai' => '16:00:00'],
            ['jenis_kegiatan_id' => $kegiatanIds['PBM'], 'nama_jadwal' => 'Belajar Takhasus Maghrib', 'jam_mulai' => '18:30:00', 'jam_selesai' => '19:30:00'],
        ]);

        DB::table('jenis_izin')->insert([
            ['nama' => 'Izin Pulang'],
            ['nama' => 'Izin Sakit'],
            ['nama' => 'Izin Keluar Komplek'],
        ]);

        DB::table('aturan_sanksi')->insert([
            ['kategori' => 'Ringan', 'poin_min' => 1, 'poin_maks' => 19, 'tindakan_sanksi' => 'Teguran lisan & pembinaan', 'urutan' => 1],
            ['kategori' => 'Ringan', 'poin_min' => 20, 'poin_maks' => 29, 'tindakan_sanksi' => 'Teguran tertulis (Surat Peringatan 1) / Botak', 'urutan' => 2],
            ['kategori' => 'Sedang', 'poin_min' => 30, 'poin_maks' => 49, 'tindakan_sanksi' => 'Pemanggilan Orang Tua / Surat Peringatan 2', 'urutan' => 3],
            ['kategori' => 'Sedang', 'poin_min' => 50, 'poin_maks' => 79, 'tindakan_sanksi' => 'Surat Peringatan 3 & Skorsing', 'urutan' => 4],
            ['kategori' => 'Berat', 'poin_min' => 80, 'poin_maks' => 100, 'tindakan_sanksi' => 'Dikembalikan ke Orang Tua (Dikeluarkan)', 'urutan' => 5],
        ]);

        DB::table('pengaturan_sistem')->insert([
            ['setting_key' => 'WA_API_URL', 'setting_value' => 'http://localhost:3000/send', 'keterangan' => 'URL Endpoint Gateway WA'],
            ['setting_key' => 'WA_API_KEY', 'setting_value' => 'secret-key-123', 'keterangan' => 'Key autentikasi gateway'],
            ['setting_key' => 'CRON_OVERDUE_MENIT', 'setting_value' => '60', 'keterangan' => 'Batas terlambat sebelum dianggap overdue (menit)'],
            ['setting_key' => 'AMBANG_POIN_SP1', 'setting_value' => '20', 'keterangan' => 'Batas poin untuk SP1'],
            ['setting_key' => 'AMBANG_POIN_SP2', 'setting_value' => '30', 'keterangan' => 'Batas poin untuk SP2'],
            ['setting_key' => 'AMBANG_POIN_SP3', 'setting_value' => '50', 'keterangan' => 'Batas poin untuk SP3'],
            ['setting_key' => 'toleransi_menit_terlambat_input', 'setting_value' => '30', 'keterangan' => 'Toleransi menit sebelum input absensi dianggap terlambat'],
            ['setting_key' => 'durasi_edit_absensi_menit', 'setting_value' => '60', 'keterangan' => 'Batas waktu (menit) non-admin bisa edit absensi'],
            ['setting_key' => 'ambang_notifikasi_poin', 'setting_value' => '20', 'keterangan' => 'Ambang poin untuk mengirim notifikasi ke pengasuh'],
        ]);
    }
}
