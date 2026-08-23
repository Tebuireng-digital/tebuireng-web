<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class UnitPendidikanSeeder extends Seeder
{
    public function run(): void
    {
        $sourcePath = base_path('../docs/EXCEL BARU/data_santri_semua.xls');
        if (!is_file($sourcePath)) {
            throw new RuntimeException("Sumber unit pendidikan tidak ditemukan: {$sourcePath}");
        }

        $document = new \DOMDocument();
        libxml_use_internal_errors(true);
        $document->loadHTMLFile($sourcePath);
        libxml_clear_errors();

        $codes = [];
        foreach ($document->getElementsByTagName('tr') as $row) {
            $cells = $row->getElementsByTagName('td');
            if ($cells->length <= 5) continue;
            $code = strtoupper(trim($cells->item(5)->textContent));
            if ($code !== '') $codes[$code] = true;
        }

        if ($codes === []) {
            throw new RuntimeException('Kolom Pend pada sumber unit pendidikan tidak memiliki data.');
        }

        foreach (array_keys($codes) as $code) {
            $values = ['nama' => $code, 'updated_at' => now()];
            if (DB::table('unit_pendidikan')->where('kode', $code)->exists()) {
                DB::table('unit_pendidikan')->where('kode', $code)->update($values);
            } else {
                DB::table('unit_pendidikan')->insert($values + ['kode' => $code, 'created_at' => now()]);
            }
        }

        $this->command?->info('Unit pendidikan disinkronkan dari kolom Pend: '.implode(', ', array_keys($codes)));
    }
}
