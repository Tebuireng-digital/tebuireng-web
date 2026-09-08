<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use OpenSpout\Reader\XLSX\Reader;

class ImportMasterPelanggaranCommand extends Command
{
    protected $signature = 'import:master-pelanggaran {--file= : Path workbook master pelanggaran}';

    protected $description = 'Import master pelanggaran dan aturan sanksi secara idempoten';

    public function handle(): int
    {
        $path = $this->option('file') ?: base_path('../data/Database_Pelanggaran_Santri_Tebuireng.xlsx');
        if (!is_file($path)) {
            $this->error("Workbook master pelanggaran tidak ditemukan: {$path}");
            return self::FAILURE;
        }

        $reader = new Reader();
        $reader->open($path);
        $imported = ['Master Pelanggaran' => 0, 'Tabel Sanksi' => 0];

        foreach ($reader->getSheetIterator() as $sheet) {
            $rows = $sheet->getName() === 'Tabel Sanksi'
                ? $this->rows($sheet->getRowIterator(), 'kategori pelanggaran')
                : $this->rows($sheet->getRowIterator(), 'kode pasal');
            if ($sheet->getName() === 'Master Pelanggaran') {
                foreach ($rows as $row) {
                    $code = trim($row['kode pasal'] ?? '');
                    if ($code === '') continue;
                    DB::table('kategori_pelanggaran')->updateOrInsert(['kode_pasal' => $code], [
                        'kategori' => $this->enumValue($row['kategori'] ?? '', ['Ringan', 'Sedang', 'Berat', 'Kewajiban'], 'Sedang'),
                        'uraian_pelanggaran' => trim($row['uraian pelanggaran'] ?? ''),
                        'poin_maks' => max(0, (int) ($row['poin maks.'] ?? 0)),
                        'jenis' => $this->enumValue($row['jenis'] ?? '', ['Pelanggaran', 'Meninggalkan Kewajiban'], 'Pelanggaran'),
                        'status_aktif' => $this->enumValue($row['status aktif'] ?? '', ['Aktif', 'Tidak Aktif'], 'Aktif'),
                        'updated_at' => now(),
                    ]);
                    $imported['Master Pelanggaran']++;
                }
            }
            if ($sheet->getName() === 'Tabel Sanksi') {
                foreach ($rows as $row) {
                    $min = $this->number($row['poin minimal'] ?? $row['poin min'] ?? '');
                    $max = $this->number($row['poin maksimal'] ?? $row['poin maks'] ?? '');
                    $action = trim($row['tindakan'] ?? $row['tindakan sanksi'] ?? '');
                    if ($min === null || $max === null || $action === '') continue;
                    DB::table('aturan_sanksi')->updateOrInsert(['urutan' => ++$imported['Tabel Sanksi']], [
                        'kategori' => $this->enumValue($row['kategori'] ?? '', ['Ringan', 'Sedang', 'Berat'], 'Sedang'),
                        'poin_min' => $min,
                        'poin_maks' => $max,
                        'tindakan_sanksi' => $action,
                    ]);
                }
            }
        }
        $reader->close();

        $this->info(sprintf('Master pelanggaran selesai: %d kategori, %d aturan sanksi.', $imported['Master Pelanggaran'], $imported['Tabel Sanksi']));
        return self::SUCCESS;
    }

    private function rows(iterable $iterator, string $headerMarker): array
    {
        $header = null;
        $result = [];
        foreach ($iterator as $row) {
            $values = array_map(static fn ($value): string => trim((string) $value), $row->toArray());
            if ($header === null) {
                $candidate = array_map(static fn (string $value): string => strtolower(trim($value)), $values);
                if (!in_array($headerMarker, $candidate, true)) {
                    continue;
                }
                $header = $candidate;
                continue;
            }
            if ($header === [] || count(array_filter($values)) === 0) continue;
            $result[] = array_combine($header, array_pad($values, count($header), '')) ?: [];
        }
        return $result;
    }

    private function enumValue(string $value, array $allowed, string $fallback): string
    {
        return in_array(trim($value), $allowed, true) ? trim($value) : $fallback;
    }

    private function number(string $value): ?int
    {
        $value = preg_replace('/[^0-9]/', '', $value ?? '');
        return $value === '' ? null : (int) $value;
    }
}
