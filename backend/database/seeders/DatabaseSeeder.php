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

        DB::table('unit_pendidikan')->insert([
            ['kode' => 'MTS', 'nama' => 'MTs Salafiyah Syafi\'iyah'],
            ['kode' => 'SMP', 'nama' => 'SMP A. Wahid Hasyim'],
            ['kode' => 'SMA', 'nama' => 'SMA A. Wahid Hasyim'],
            ['kode' => 'SMK', 'nama' => 'SMK Khoiriyah Hasyim'],
            ['kode' => 'MA', 'nama' => 'MA Salafiyah Syafi\'iyah'],
        ]);

        DB::table('jenis_kegiatan')->insert([
            ['kode' => 'KAMAR', 'nama' => 'Kegiatan Kamar'],
            ['kode' => 'SEKOLAH', 'nama' => 'Kegiatan Sekolah (Formal)'],
            ['kode' => 'PBS', 'nama' => 'Pembinaan Bacaan Shalat (PBS)'],
            ['kode' => 'PBM', 'nama' => 'Pembinaan Bacaan Al-Quran (PBM)'],
            ['kode' => 'DINIYAH', 'nama' => 'Madrasah Diniyah'],
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
