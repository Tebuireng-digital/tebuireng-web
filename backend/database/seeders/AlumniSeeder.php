<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AlumniSeeder extends Seeder
{
    public function run(): void
    {
        $jsonPath = base_path('../docs/EXCEL BARU/data_alumni.json');

        if (!file_exists($jsonPath)) {
            $this->command->error("File tidak ditemukan: {$jsonPath}");
            return;
        }

        $json = json_decode(file_get_contents($jsonPath), true);
        $alumni = $json['daftar_alumni'] ?? [];

        if (empty($alumni)) {
            $this->command->warn('Tidak ada data alumni yang ditemukan di file JSON.');
            return;
        }

        // Truncate table first for a clean import
        DB::table('alumni')->truncate();

        $this->command->info("Mengimpor " . count($alumni) . " data alumni...");

        $chunks = array_chunk($alumni, 500);
        $imported = 0;

        foreach ($chunks as $chunk) {
            $rows = [];
            foreach ($chunk as $item) {
                $rows[] = [
                    'no_id_induk'    => $item['No ID (Induk)'] ?? null,
                    'nama'           => $item['Nama Alumni'] ?? '',
                    'jenis_kelamin'  => $item['L/P'] ?? null,
                    'tempat_lahir'   => $item['Tempat Lahir'] ?? null,
                    'tanggal_lahir'  => $item['Tanggal Lahir'] ?? null,
                    'orang_tua'      => $item['Orang Tua'] ?? null,
                    'jenjang'        => $item['Jenjang'] ?? null,
                    'kelas'          => $item['Kelas'] ?? null,
                    'no_hp'          => $item['No HP'] ?? null,
                    'saldo_spp'      => $item['Saldo SPP'] ?? null,
                    'nominal_saldo'  => $item['Nominal Saldo'] ?? 0,
                    'alamat'         => $item['Alamat'] ?? null,
                    'wilayah'        => $item['Wilayah'] ?? null,
                    'provinsi'       => $item['Provinsi'] ?? null,
                    'angkatan'       => $item['Angkatan'] ?? null,
                    'tahun_lulus'    => $item['Tahun Lulus'] ?? null,
                ];
            }
            DB::table('alumni')->insert($rows);
            $imported += count($rows);
            $this->command->info("  Progres: {$imported}/" . count($alumni));
        }

        $this->command->info("Selesai! {$imported} alumni berhasil diimpor.");
    }
}
