<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class OrganisasiDaerahSeeder extends Seeder
{
    public function run(): void
    {
        $ordaList = [
            ['kode_singkat' => 'HISPA', 'nama_organisasi' => 'Himpunan Santri Pasundan', 'deskripsi_wilayah' => 'Jawa Barat & Banten'],
            ['kode_singkat' => 'OPIM', 'nama_organisasi' => 'Organisasi Pelajar Islam Malang / Tapal Kuda', 'deskripsi_wilayah' => 'Malang Raya & Tapal Kuda'],
            ['kode_singkat' => 'HISMA', 'nama_organisasi' => 'Himpunan Santri Majapahit', 'deskripsi_wilayah' => 'Mojokerto & sekitarnya'],
            ['kode_singkat' => 'IKSMA', 'nama_organisasi' => 'Ikatan Santri Madura', 'deskripsi_wilayah' => 'Madura (Bangkalan, Sampang, Pamekasan, Sumenep)'],
            ['kode_singkat' => 'Putra Delta', 'nama_organisasi' => 'Santri Sidoarjo', 'deskripsi_wilayah' => 'Sidoarjo'],
            ['kode_singkat' => 'HISWITA', 'nama_organisasi' => 'Himpunan Santri Wilayah Tengah dan Timur', 'deskripsi_wilayah' => 'Jawa Tengah & Jawa Timur'],
            ['kode_singkat' => 'RIM', 'nama_organisasi' => 'Raudlatul Islamiyah Al-Mardiyah Brebes & Tegal', 'deskripsi_wilayah' => 'Brebes & Tegal'],
            ['kode_singkat' => 'OPI-DKI', 'nama_organisasi' => 'Organisasi Pelajar Islam Daerah Khusus Ibu Kota', 'deskripsi_wilayah' => 'DKI Jakarta'],
            ['kode_singkat' => 'KSHC', 'nama_organisasi' => 'Keluarga Santri Syarief Hidayatullah Cirebon', 'deskripsi_wilayah' => 'Cirebon & sekitarnya'],
            ['kode_singkat' => 'OPIA', 'nama_organisasi' => 'Organisasi Pelajar Islam Andalas', 'deskripsi_wilayah' => 'Sumatera / Andalas'],
            ['kode_singkat' => 'OPI-TH', 'nama_organisasi' => 'Organisasi Pelajar Islam Thariqul Huda', 'deskripsi_wilayah' => 'Wilayah Thariqul Huda'],
            ['kode_singkat' => 'KSPI', 'nama_organisasi' => 'Keluarga Santri Pemalang Indonesia', 'deskripsi_wilayah' => 'Pemalang'],
            ['kode_singkat' => 'KESIS', 'nama_organisasi' => 'Keluarga Santri Indonesia Semarang', 'deskripsi_wilayah' => 'Semarang & sekitarnya'],
            ['kode_singkat' => 'CPISA', 'nama_organisasi' => 'Correlatie Pelajar Islam Sunan Ampel', 'deskripsi_wilayah' => 'Surabaya & sekitarnya'],
            ['kode_singkat' => 'HISLA', 'nama_organisasi' => 'Himpunan Santri Lamongan', 'deskripsi_wilayah' => 'Lamongan'],
        ];

        foreach ($ordaList as $orda) {
            DB::table('organisasi_daerah')->updateOrInsert(
                ['kode_singkat' => $orda['kode_singkat']],
                [
                    'nama_organisasi' => $orda['nama_organisasi'],
                    'deskripsi_wilayah' => $orda['deskripsi_wilayah'],
                    'status_aktif' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
