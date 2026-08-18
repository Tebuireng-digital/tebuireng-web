<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UbudiyahSeeder extends Seeder
{
    public function run(): void
    {
        $adminId = DB::table('petugas')->where('username', 'admin')->value('petugas_id');
        if (!$adminId) {
            $adminId = 1; // Fallback
        }

        $instruments = [
            'Sholat Tahajjud',
            'Sholat Dhuha',
            'Baca Al-Qur\'an Mandiri',
            'Bangun Sebelum Subuh',
            'Mengaji Ba\'da Shubuh',
            'Mengaji Ba\'da Maghrib',
            'Mengaji / Belajar Ba\'da Isya\'',
            'Mengikuti Kegiatan Kamar',
            'Kerapian Tempat Tidur',
            'Kerapian Pakaian & Almari',
        ];

        foreach ($instruments as $instName) {
            DB::table('master_instrumen_ubudiyah')->updateOrInsert(
                ['nama_instrumen' => $instName],
                [
                    'status_aktif' => 1,
                    'dibuat_oleh' => $adminId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
