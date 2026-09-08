<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenSpout\Reader\XLSX\Reader;

class ImportMasterPutraCommand extends Command
{
    protected $signature = 'import:master-putra {--file= : Path workbook canonical master putra} {--keep-legacy : Jangan menonaktifkan santri yang tidak ada di workbook canonical}';

    protected $description = 'Import master santri putra, roster, dan antrean REVIEW_MATCH secara idempoten';

    public function handle(): int
    {
        $path = $this->option('file') ?: base_path('../data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx');
        if (!is_file($path)) {
            $this->error("Workbook master putra tidak ditemukan: {$path}");
            return self::FAILURE;
        }

        $sheets = $this->readSheets($path);
        $master = $sheets['MASTER_PUTRA'] ?? [];
        if ($master === []) {
            $this->error('Sheet MASTER_PUTRA kosong atau tidak ditemukan.');
            return self::FAILURE;
        }

        $canonicalIds = array_values(array_unique(array_filter(array_map(
            static fn (array $row): string => trim($row['no_id_induk'] ?? ''),
            $master
        ))));

        DB::transaction(function () use ($master, $sheets, $canonicalIds): void {
            $maps = [
                'units' => [],
                'rooms' => [],
                'classes' => [],
                'madin' => [],
                'pbs' => [],
                'pbm' => [],
            ];

            foreach ($master as $row) {
                $this->importMasterRow($row, $maps);
            }

            foreach ($sheets['REVIEW_MATCH'] ?? [] as $index => $row) {
                $this->upsertReview($row, $index + 2);
            }

            // Hapus/kosongkan ID sementara (made up 2699...) untuk santri baru agar tidak ada ID palsu
            DB::table('santri')
                ->where('no_id_induk', 'like', '2699%')
                ->update([
                    'no_id_induk' => null,
                    'updated_at' => now(),
                ]);

            if (!$this->option('keep-legacy')) {
                DB::table('santri')
                    ->where(function ($query) use ($canonicalIds): void {
                        $query->where(function ($q) use ($canonicalIds) {
                            $q->whereNotNull('no_id_induk')->whereNotIn('no_id_induk', $canonicalIds);
                        })->whereNotIn('catatan_import', ['SANTRI_BARU_2026', 'MASTER_PUTRA'])
                          ->where(function ($q) {
                              $q->whereNull('status_siswa_sumber')->orWhere('status_siswa_sumber', '!=', 'santri_baru_2026');
                          });
                    })
                    ->update([
                        'status_aktif' => false,
                        'status_siswa_sumber' => 'legacy_noncanonical',
                        'updated_at' => now(),
                    ]);

                $this->closeLegacyAttendanceAssignments();
            }
        });

        $this->info(sprintf(
            'Master putra selesai: %d baris master, %d baris REVIEW_MATCH; %d ID canonical%s.',
            count($master),
            count($sheets['REVIEW_MATCH'] ?? []),
            count($canonicalIds),
            $this->option('keep-legacy') ? '' : '; data noncanonical dinonaktifkan'
        ));

        return self::SUCCESS;
    }

    /** @return array<string, list<array<string, string>>> */
    private function readSheets(string $path): array
    {
        $reader = new Reader();
        $reader->open($path);
        $result = [];

        foreach ($reader->getSheetIterator() as $sheet) {
            $header = null;
            $rows = [];
            foreach ($sheet->getRowIterator() as $row) {
                $values = array_map(static fn ($value): string => trim((string) $value), $row->toArray());
                if ($header === null) {
                    $header = array_map(static fn (string $value): string => Str::lower(trim($value)), $values);
                    continue;
                }
                if (count(array_filter($values, static fn (string $value): bool => $value !== '')) === 0) {
                    continue;
                }
                $rows[] = array_combine($header, array_pad($values, count($header), '')) ?: [];
            }
            $result[$sheet->getName()] = $rows;
        }

        $reader->close();
        return $result;
    }

    /** @param array<string, array<string, int>> $maps */
    private function importMasterRow(array $row, array &$maps): void
    {
        $noId = trim($row['no_id_induk'] ?? '');
        $name = $this->clean($row['nama'] ?? '');
        $unitCode = strtoupper(trim($row['pendidikan'] ?? ''));
        if ($noId === '' || $name === '' || $unitCode === '') {
            return;
        }

        $unitId = $maps['units'][$unitCode] ??= $this->upsertId('unit_pendidikan', ['kode' => $unitCode], [
            'nama' => $unitCode,
            'updated_at' => now(),
        ], 'unit_id');

        $roomName = $this->clean($row['kamar'] ?? '');
        $roomId = null;
        if ($roomName !== '') {
            $roomId = $maps['rooms'][$roomName] ??= $this->upsertId('kamar', ['nama' => $roomName], [
                'unit_id' => $unitId,
                'kode_singkat' => $this->clean($row['komplek'] ?? '') ?: null,
                'status_aktif' => true,
                'updated_at' => now(),
            ], 'kamar_id');
        }

        $className = $this->clean($row['kelas_formal'] ?? '');
        $classId = null;
        if ($className !== '') {
            $classKey = $unitId.':'.$className;
            $classId = $maps['classes'][$classKey] ??= $this->upsertId('kelas_formal', [
                'unit_id' => $unitId,
                'nama_kelas' => $className,
                'tahun_ajaran' => '2026/2027',
            ], [
                'tingkat' => $this->classLevel($className),
                'updated_at' => now(),
            ], 'kelas_formal_id');
        }

        $groupIds = [
            'madin' => $this->upsertGroup($maps, 'madin', 'kelompok_madin', 'nama_kelas_madin', $row['madin'] ?? '', ['jenjang' => $unitCode], 'kelompok_madin_id'),
            'pbs' => $this->upsertGroup($maps, 'pbs', 'kelompok_pbs', 'nama_kelompok', $row['pbs'] ?? '', ['kategori' => 'MASTER_PUTRA'], 'kelompok_pbs_id'),
            'pbm' => $this->upsertGroup($maps, 'pbm', 'kelompok_pbm', 'nama_kelompok', $row['pbm'] ?? '', ['kategori' => 'MASTER_PUTRA'], 'kelompok_pbm_id'),
        ];

        $isBaru = strtoupper(trim($row['status_santri'] ?? '')) === 'BARU' || str_starts_with($noId, '2699');
        $finalNoId = str_starts_with($noId, '2699') ? null : ($noId !== '' ? $noId : null);

        $existingId = null;
        if ($finalNoId !== null) {
            $existingId = DB::table('santri')->where('no_id_induk', $finalNoId)->value('santri_id');
        }
        if (!$existingId) {
            $existingId = DB::table('santri')
                ->where('nama', $name)
                ->where('unit_id', $unitId)
                ->value('santri_id');
        }

        $payload = [
            'no_id_induk' => $finalNoId,
            'nama' => $name,
            'jenis_kelamin' => strtoupper(trim($row['jenis_kelamin'] ?? 'L')) ?: 'L',
            'unit_id' => $unitId,
            'kamar_id' => $roomId,
            'kelas_formal_id' => $classId,
            'kelompok_madin_id' => $groupIds['madin'],
            'kelompok_pbs_id' => $groupIds['pbs'],
            'kelompok_pbm_id' => $groupIds['pbm'],
            'no_hp_wali' => $this->clean($row['telepon'] ?? '') ?: null,
            'status_aktif' => true,
            'status_verifikasi' => $isBaru ? 'perlu_verifikasi' : 'siap_operasional',
            'status_siswa_sumber' => $isBaru ? 'santri_baru_2026' : 'aktif',
            'catatan_import' => $isBaru ? 'SANTRI_BARU_2026' : 'MASTER_PUTRA',
            'updated_at' => now(),
        ];

        if ($existingId) {
            DB::table('santri')->where('santri_id', $existingId)->update($payload);
        } else {
            DB::table('santri')->insert($payload + ['created_at' => now()]);
        }
    }

    /** @param array<string, array<string, int>> $maps */
    private function upsertGroup(array &$maps, string $map, string $table, string $nameColumn, string $value, array $extra, string $idColumn): ?int
    {
        $name = $this->clean($value);
        if ($name === '') {
            return null;
        }
        $key = implode('|', array_merge([$name], array_values($extra)));
        return $maps[$map][$key] ??= $this->upsertId($table, array_merge([$nameColumn => $name], $extra, ['tahun_ajaran' => '2026/2027']), [
            'updated_at' => now(),
        ], $idColumn);
    }

    private function upsertId(string $table, array $lookup, array $values, string $idColumn): int
    {
        $existing = DB::table($table)->where($lookup)->value($idColumn);
        if ($existing) {
            DB::table($table)->where($idColumn, $existing)->update($values);
            return (int) $existing;
        }
        return (int) DB::table($table)->insertGetId(array_merge($lookup, $values, ['created_at' => now()]));
    }

    private function upsertReview(array $row, int $sourceRow): void
    {
        $sheet = strtoupper(trim($row['jenis_data'] ?? 'REVIEW_MATCH'));
        DB::table('santri_import_reviews')->updateOrInsert(
            ['sumber_sheet' => $sheet, 'baris_sumber' => (int) ($row['baris_sumber'] ?? $sourceRow)],
            [
                'nama_sumber' => $this->clean($row['nama_sumber'] ?? ''),
                'kode_kamar_sumber' => $this->clean($row['kamar_sumber'] ?? '') ?: null,
                'data_tambahan' => $this->clean($row['kelompok_atau_kelas'] ?? '') ?: null,
                'kandidat_santri_id' => DB::table('santri')->where('no_id_induk', trim($row['no_id_induk_kandidat'] ?? ''))->value('santri_id'),
                'skor_kemiripan' => is_numeric($row['similarity_percent'] ?? null) ? (float) $row['similarity_percent'] : null,
                'status' => in_array(strtoupper(trim($row['status'] ?? '')), ['UNMATCHED', 'REVIEW'], true) ? 'perlu_tinjau' : 'perlu_tinjau',
                'updated_at' => now(),
            ]
        );
    }

    private function closeLegacyAttendanceAssignments(): void
    {
        foreach ([
            'KelasFormal' => 'kelas_formal_id',
            'Kamar' => 'kamar_id',
            'KelompokPBS' => 'kelompok_pbs_id',
            'KelompokPBM' => 'kelompok_pbm_id',
            'KelompokMadin' => 'kelompok_madin_id',
        ] as $assignmentType => $studentColumn) {
            $validTargetIds = DB::table('santri')
                ->where('status_aktif', 1)
                ->where(function ($query) {
                    $query->whereNull('status_siswa_sumber')->orWhere('status_siswa_sumber', '!=', 'legacy_noncanonical');
                })
                ->whereNotNull($studentColumn)
                ->distinct()
                ->pluck($studentColumn);

            $query = DB::table('petugas_penugasan')
                ->where('tipe_target', $assignmentType)
                ->whereNull('tanggal_selesai');
            if ($validTargetIds->isEmpty()) {
                $query->update(['tanggal_selesai' => now()->subDay()->toDateString()]);
            } else {
                $query->whereNotIn('target_id', $validTargetIds)->update(['tanggal_selesai' => now()->subDay()->toDateString()]);
            }
        }
    }

    private function clean(string $value): string
    {
        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
    }

    private function classLevel(string $name): ?string
    {
        return preg_match('/^[A-Za-z -]*(\d+|[IVX]+)/i', $name, $matches) ? strtoupper($matches[1]) : null;
    }
}
