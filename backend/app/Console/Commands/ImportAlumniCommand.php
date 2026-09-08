<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use OpenSpout\Reader\XLSX\Reader;

class ImportAlumniCommand extends Command
{
    protected $signature = 'import:alumni {--file= : Path workbook alumni}';

    protected $description = 'Upsert alumni dari workbook canonical tanpa menghapus data aplikasi';

    public function handle(): int
    {
        $path = $this->option('file') ?: base_path('../data/data_alumni.xlsx');
        if (!is_file($path)) {
            $this->error("Workbook alumni tidak ditemukan: {$path}");
            return self::FAILURE;
        }

        $reader = new Reader();
        $reader->open($path);
        $count = 0;
        foreach ($reader->getSheetIterator() as $sheet) {
            $header = null;
            foreach ($sheet->getRowIterator() as $row) {
                $values = array_map(static fn ($value): string => trim((string) $value), $row->toArray());
                if ($header === null) {
                    $header = array_map(static fn (string $value): string => strtolower(trim($value)), $values);
                    continue;
                }
                $data = array_combine($header, array_pad($values, count($header), '')) ?: [];
                $id = trim($data['no id (induk)'] ?? '');
                $name = trim($data['nama alumni'] ?? '');
                if ($id === '' && $name === '') continue;

                $lookup = $id !== '' ? ['no_id_induk' => $id] : ['nama' => $name];
                DB::table('alumni')->updateOrInsert($lookup, [
                    'nama' => $name,
                    'no_id_induk' => $id ?: null,
                    'jenis_kelamin' => $data['l/p'] ?? null,
                    'tempat_lahir' => $data['tempat lahir'] ?? null,
                    'tanggal_lahir' => $data['tanggal lahir'] ?? null,
                    'orang_tua' => $data['orang tua'] ?? null,
                    'jenjang' => $data['jenjang'] ?? null,
                    'kelas' => $data['kelas'] ?? null,
                    'no_hp' => $data['no hp'] ?? null,
                    'saldo_spp' => $data['saldo spp'] ?? null,
                    'nominal_saldo' => (int) preg_replace('/[^0-9-]/', '', $data['nominal saldo'] ?? '0'),
                    'alamat' => $data['alamat'] ?? null,
                    'wilayah' => $data['wilayah'] ?? null,
                    'provinsi' => $data['provinsi'] ?? null,
                    'angkatan' => $data['angkatan'] ?? null,
                    'tahun_lulus' => $data['tahun lulus'] ?? null,
                    'updated_at' => now(),
                ]);
                $count++;
            }
            break;
        }
        $reader->close();
        $this->info("Import alumni selesai: {$count} baris diproses secara upsert.");
        return self::SUCCESS;
    }
}
