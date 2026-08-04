<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use DOMDocument;

class ImportSantriBaruCommand extends Command
{
    protected $signature = 'import:santri-baru {--file= : Path opsional file excel santri baru}';
    protected $description = 'Import dan perbarui data santri dari file data_santri_semua.xls (EXCEL BARU)';

    public function handle()
    {
        $customFile = $this->option('file');
        $filePath = $customFile ?: base_path('../docs/EXCEL BARU/data_santri_semua.xls');

        if (!file_exists($filePath)) {
            $filePath = base_path('../xlsx/data_santri_semua.xls');
        }

        if (!file_exists($filePath)) {
            $this->error("File tidak ditemukan di: $filePath");
            return 1;
        }

        $this->info("Memulai impor data santri terupdate dari: $filePath");

        $content = file_get_contents($filePath);
        $dom = new DOMDocument();
        @$dom->loadHTML($content);
        $rows = $dom->getElementsByTagName('tr');

        if ($rows->length <= 1) {
            $this->error("Tidak ada baris data dalam file.");
            return 1;
        }

        $units = DB::table('unit_pendidikan')->pluck('unit_id', 'kode')->toArray();
        $kamarByName = DB::table('kamar')->pluck('kamar_id', 'nama')->toArray();

        $kamarSingkatanMap = [];
        $csvPath = storage_path('app/mapping-kamar-draft.csv');
        if (file_exists($csvPath)) {
            if (($handle = fopen($csvPath, "r")) !== FALSE) {
                while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                    if ($data[0] !== 'kode_singkat' && !empty($data[1])) {
                        $kamarSingkatanMap[strtoupper(trim($data[0]))] = $data[1];
                    }
                }
                fclose($handle);
            }
        }

        if (\Illuminate\Support\Facades\Schema::hasTable('kamar_kode_mappings')) {
            foreach (DB::table('kamar_kode_mappings as mapping')
                ->join('kamar', 'mapping.kamar_id', '=', 'kamar.kamar_id')
                ->select('mapping.kode_sumber', 'kamar.nama')->get() as $m) {
                $kamarSingkatanMap[strtoupper(trim($m->kode_sumber))] = $m->nama;
            }
        }

        $updatedCount = 0;
        $createdCount = 0;
        $matchedKamarCount = 0;
        $totalRows = $rows->length - 1;

        $this->output->progressStart($totalRows);

        DB::beginTransaction();
        try {
            foreach ($rows as $index => $row) {
                if ($index === 0) continue;
                $cells = [];
                foreach ($row->getElementsByTagName('td') as $td) {
                    $cells[] = trim($td->nodeValue);
                }
                if (count($cells) < 10) {
                    $this->output->progressAdvance();
                    continue;
                }

                $noId = $cells[0] ?? '';
                $nis = $cells[1] ?? '';
                $nama = strtoupper(trim($cells[2] ?? ''));
                $pend = $cells[5] ?? '';
                $ayah = trim($cells[37] ?? '');
                $ibu = trim($cells[41] ?? '');
                $hp = trim($cells[49] ?? '');
                $kamarCode = trim($cells[50] ?? '');

                if (!$nama) {
                    $this->output->progressAdvance();
                    continue;
                }

                $unitId = $this->resolveUnitId($pend, $units);
                $kamarId = $this->resolveKamarId($kamarCode, $kamarSingkatanMap, $kamarByName);
                if ($kamarId) $matchedKamarCount++;

                $wali = $ayah ?: ($ibu ?: null);

                $existing = null;
                if ($nis) {
                    $existing = DB::table('santri')->where('nis', $nis)->first();
                }
                if (!$existing && $noId) {
                    $existing = DB::table('santri')->where('nis', $noId)->first();
                }
                if (!$existing) {
                    $existing = DB::table('santri')->where('nama', $nama)->first();
                }

                if ($existing) {
                    DB::table('santri')->where('santri_id', $existing->santri_id)->update([
                        'nis' => $nis ?: ($noId ?: $existing->nis),
                        'nama' => $nama,
                        'unit_id' => $unitId ?: $existing->unit_id,
                        'kamar_id' => $kamarId ?: $existing->kamar_id,
                        'nama_wali' => $wali ?: $existing->nama_wali,
                        'no_hp_wali' => $hp ?: $existing->no_hp_wali,
                        'catatan_import' => 'Terupdate via data_santri_semua.xls',
                        'status_aktif' => 1,
                        'updated_at' => now(),
                    ]);
                    $updatedCount++;
                } else {
                    DB::table('santri')->insert([
                        'nis' => $nis ?: ($noId ?: null),
                        'nama' => $nama,
                        'unit_id' => $unitId,
                        'kamar_id' => $kamarId,
                        'nama_wali' => $wali,
                        'no_hp_wali' => $hp,
                        'catatan_import' => 'Impor Baru: data_santri_semua.xls',
                        'status_aktif' => 1,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $createdCount++;
                }

                $this->output->progressAdvance();
            }

            DB::commit();
            $this->output->progressFinish();

            $this->info("\n--- HASIL IMPOR DATA SANTRI TERUPDATE ---");
            $this->line("• Santri Diperbarui : {$updatedCount}");
            $this->line("• Santri Baru Dibuat: {$createdCount}");
            $this->line("• Kamar Terkoneksi : {$matchedKamarCount}");
            $this->info("• Total Santri Sekarang: " . DB::table('santri')->count());

            return 0;
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("\nTerjadi kesalahan: " . $e->getMessage());
            return 1;
        }
    }

    private function resolveUnitId(string $pend, array $units): int
    {
        $pend = strtoupper(trim($pend));
        if (isset($units[$pend])) return $units[$pend];
        if (in_array($pend, ['MTS', 'MTSS'])) return $units['MTS'] ?? 1;
        if (in_array($pend, ['SMP', 'SMPT'])) return $units['SMP'] ?? 2;
        if (in_array($pend, ['SMA', 'SMAT'])) return $units['SMA'] ?? 3;
        if ($pend === 'SMK') return $units['SMK'] ?? 4;
        if (in_array($pend, ['MA', 'MAS', 'MU', 'THS'])) return $units['MA'] ?? 5;
        return $units['MTS'] ?? 1;
    }

    private function resolveKamarId(string $kamarCode, array $kamarSingkatanMap, array $kamarByName): ?int
    {
        $kamarCode = strtoupper(trim($kamarCode));
        if (!$kamarCode) return null;

        if (isset($kamarByName[$kamarCode])) return $kamarByName[$kamarCode];

        if (isset($kamarSingkatanMap[$kamarCode])) {
            $mappedName = $kamarSingkatanMap[$kamarCode];
            if (isset($kamarByName[$mappedName])) return $kamarByName[$mappedName];
        }

        foreach ($kamarByName as $name => $id) {
            if (strtoupper($name) === $kamarCode) return $id;
        }

        return null;
    }
}
