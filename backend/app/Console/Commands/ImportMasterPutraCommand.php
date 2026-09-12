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

    private const REVIEW_SHEET = 'REVIEW_MATCH';

    private const FIXED_REVIEW_PROVENANCE = [
        'MADIN' => [
            'file' => 'xlsx/Database_Kelas_Madin_2026_2027.xlsx',
            'sheet' => 'Database Siswa Madin',
        ],
        'PBM' => [
            'file' => 'xlsx/Database_Takhassus (belajar habis maghrib)_2026_2027.xlsx',
            'sheet' => 'Database Takhassus',
        ],
        'PBS' => [
            'file' => "xlsx/Database_Kelompok_AlQuran (belajar habis subuh)_2026_2027.xlsx",
            'sheet' => "Database Al-Qur'an",
        ],
    ];

    /**
     * Attendance files are split by unit and room. The map is explicit so a
     * REVIEW_MATCH row can be traced to one concrete workbook and sheet.
     *
     * @var array<string, array{file: string, sheet: string}>
     */
    private const ABSENSI_KAMAR_PROVENANCE = [
        'AB 201' => ['file' => 'data/26-ABSENSI MTS .xlsx', 'sheet' => 'AB 201'],
        'AB 202' => ['file' => 'data/26-ABSENSI SMP.xlsx', 'sheet' => 'AB 202'],
        'AB 204' => ['file' => 'data/26-ABSENSI SMP.xlsx', 'sheet' => 'AB 204'],
        'AB 307' => ['file' => 'data/26-ABSENSI MTS .xlsx', 'sheet' => 'AB 307'],
        'AB 308' => ['file' => 'data/26-ABSENSI MTS .xlsx', 'sheet' => 'AB 308'],
        'K BAWAH' => ['file' => 'data/26-ABSENSI SMA .xlsx', 'sheet' => 'K BAWAH'],
        'KI 102' => ['file' => 'data/26-ABSENSI SMA .xlsx', 'sheet' => 'KI 102'],
        'KI 307' => ['file' => 'data/26-ABSENSI SMA .xlsx', 'sheet' => 'KI 307'],
        'KI 309' => ['file' => 'data/26-ABSENSI SMA .xlsx', 'sheet' => 'KI 309'],
        'MA 101' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => 'MA 101'],
        'MA 102' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => 'MA 102'],
        'MA 103' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => 'MA 103'],
        'MA 204' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => 'MA 204'],
        'MA 205' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => 'MA 205'],
        'MA 206' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => 'MA 206'],
        'MA 207' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => 'MA 207'],
        'MA 208' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => 'MA 208'],
        'MA 209' => ['file' => 'data/26-ABSENSI MASS.xlsx', 'sheet' => 'MA 209'],
        'MA 316' => ['file' => 'data/26-ABSENSI MASS.xlsx', 'sheet' => 'MA 316'],
        'MA 317' => ['file' => 'data/26-ABSENSI MASS.xlsx', 'sheet' => 'MA 317'],
        'MA 318' => ['file' => 'data/26-ABSENSI MASS.xlsx', 'sheet' => 'MA 318'],
        'MU 201' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => '201'],
        'MU 202' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => '202'],
        'MU 203' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => '203'],
        'MU 301' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => '301'],
        'MU 302' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => '302'],
        'MU 303' => ['file' => 'data/26 - ABSENSI MMHA.xlsx', 'sheet' => '303'],
        'RD 101' => ['file' => 'data/26-ABSENSI SMA .xlsx', 'sheet' => 'RD 101'],
        'RD 203' => ['file' => 'data/26-ABSENSI SMA .xlsx', 'sheet' => 'RD 203'],
        'RD 204' => ['file' => 'data/26-ABSENSI SMA .xlsx', 'sheet' => 'RD 204'],
        'SH 306' => ['file' => 'data/26-ABSENSI SMP.xlsx', 'sheet' => 'SH 306'],
        'SK 103' => ['file' => 'data/26-ABSENSI MTS .xlsx', 'sheet' => 'SK 103'],
        'SMK 102' => ['file' => 'data/26-ABSENSI SMK.xlsx', 'sheet' => 'SMK 102'],
        'SMK 104' => ['file' => 'data/26-ABSENSI SMK.xlsx', 'sheet' => 'SMK 104'],
        'SMK 201' => ['file' => 'data/26-ABSENSI SMK.xlsx', 'sheet' => 'SMK 201'],
        'SMK 202' => ['file' => 'data/26-ABSENSI SMK.xlsx', 'sheet' => 'SMK 202'],
        'SZ 305' => ['file' => 'data/26-ABSENSI SMP.xlsx', 'sheet' => 'SZ 305'],
        'Y BAWAH' => ['file' => 'data/26-ABSENSI SMA .xlsx', 'sheet' => 'Y BAWAHh'],
    ];

    private string $reviewWorkbookReference = 'data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx';

    public function handle(): int
    {
        $path = $this->option('file') ?: base_path('../data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx');
        if (!is_file($path)) {
            $this->error("Workbook master putra tidak ditemukan: {$path}");
            return self::FAILURE;
        }

        $this->reviewWorkbookReference = $this->relativeWorkbookPath($path);

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

        $pbsRaw = $row['pbs'] ?? '';
        $pbsCat = 'LAINNYA';
        if (preg_match('/^(KELOMPOK [A-Z]|BANDONGAN|TAHSIN|TAHFIDZ|SOROGAN|PASCA WISUDA(?: MA)?)/i', $pbsRaw, $pbsMatches)) {
            $pbsCat = strtoupper(trim($pbsMatches[1]));
        }

        $pbmRaw = $row['pbm'] ?? '';
        $pbmCat = 'LAINNYA';
        if (preg_match('/^([^-]+)\s*-\s*/', $pbmRaw, $pbmMatches)) {
            $pbmCat = strtoupper(trim($pbmMatches[1]));
        }

        $groupIds = [
            'madin' => $this->upsertGroup($maps, 'madin', 'kelompok_madin', 'nama_kelas_madin', $row['madin'] ?? '', ['jenjang' => $unitCode], 'kelompok_madin_id'),
            'pbs' => $this->upsertGroup($maps, 'pbs', 'kelompok_pbs', 'nama_kelompok', $pbsRaw, ['kategori' => $pbsCat], 'kelompok_pbs_id'),
            'pbm' => $this->upsertGroup($maps, 'pbm', 'kelompok_pbm', 'nama_kelompok', $pbmRaw, ['kategori' => $pbmCat], 'kelompok_pbm_id'),
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
        $sourceRowNumber = (int) ($row['baris_sumber'] ?? $sourceRow);
        $sourceStatus = strtoupper(trim($row['status'] ?? ''));
        if (!in_array($sourceStatus, ['EXACT', 'REVIEW', 'UNMATCHED'], true)) {
            $sourceStatus = 'REVIEW';
        }

        $candidateNoId = trim($row['no_id_induk_kandidat'] ?? '');
        $candidateId = $candidateNoId === ''
            ? null
            : DB::table('santri')->where('no_id_induk', $candidateNoId)->value('santri_id');
        $sourceName = $this->clean($row['nama_sumber'] ?? '');
        $sourceRoom = $this->clean($row['kamar_sumber'] ?? '') ?: null;
        $candidateName = $this->clean($row['nama_kandidat'] ?? '') ?: null;
        $candidateRoom = $this->clean($row['kamar_kandidat'] ?? '') ?: null;
        $score = is_numeric($row['similarity_percent'] ?? null) ? (float) $row['similarity_percent'] : null;
        $provenance = $this->resolveReviewProvenance($sheet, $sourceRoom);
        $provenanceStatus = $provenance ? 'TERVERIFIKASI' : 'PERLU_VERIFIKASI';
        $sourceIdentity = $this->buildSourceIdentity($sheet, $sourceRoom, $sourceRowNumber, $provenance);

        $existing = DB::table('santri_import_reviews')
            ->where('identitas_sumber', $sourceIdentity)
            ->first();
        if (!$existing) {
            // Reuse a legacy row only when its source content is the same.
            // This preserves an existing decision without reintroducing the
            // old collision between repeated row numbers across room sheets.
            $existing = DB::table('santri_import_reviews')
                ->where('sumber_sheet', $sheet)
                ->where('baris_sumber', $sourceRowNumber)
                ->where('nama_sumber', $sourceName)
                ->where(function ($query) use ($sourceRoom): void {
                    $sourceRoom === null
                        ? $query->whereNull('kode_kamar_sumber')
                        : $query->where('kode_kamar_sumber', $sourceRoom);
                })
                ->where('identitas_sumber', 'like', 'LEGACY|%')
                ->first();
        }
        $isFinalDecision = $existing && in_array($existing->status, ['digabung', 'terpisah'], true);
        $sourceChangedAfterDecision = $isFinalDecision && (
            (string) ($existing->no_id_induk_kandidat_sumber ?? '') !== $candidateNoId
            || (string) ($existing->nama_kandidat_sumber ?? '') !== (string) ($candidateName ?? '')
            || (string) ($existing->kamar_kandidat_sumber ?? '') !== (string) ($candidateRoom ?? '')
            || (string) ($existing->status_sumber_review ?? '') !== $sourceStatus
            || (float) ($existing->skor_kemiripan ?? 0) !== (float) ($score ?? 0)
            || (string) ($existing->sumber_file_excel ?? '') !== (string) ($provenance['file'] ?? '')
            || (string) ($existing->sumber_sheet_excel ?? '') !== (string) ($provenance['sheet'] ?? '')
            || (int) ($existing->sumber_baris_excel ?? 0) !== $sourceRowNumber
            || (string) ($existing->status_provenance ?? '') !== $provenanceStatus
        );

        $reviewType = $existing?->santri_otomatis_id
            ? 'santri_auto_create'
            : ($candidateId ? 'kandidat_workbook' : 'verifikasi_manual');

        $payload = [
            'nama_sumber' => $sourceName,
            'kode_kamar_sumber' => $sourceRoom,
            'data_tambahan' => $this->clean($row['kelompok_atau_kelas'] ?? '') ?: null,
            'skor_kemiripan' => $score,
            'status_sumber_review' => $sourceStatus,
            'tipe_review' => $reviewType,
            'no_id_induk_kandidat_sumber' => $candidateNoId ?: null,
            'nama_kandidat_sumber' => $candidateName,
            'kamar_kandidat_sumber' => $candidateRoom,
            'sumber_file_excel' => $provenance['file'] ?? null,
            'sumber_sheet_excel' => $provenance['sheet'] ?? null,
            'sumber_baris_excel' => $sourceRowNumber,
            'review_file_excel' => $this->reviewWorkbookReference,
            'review_sheet_excel' => self::REVIEW_SHEET,
            'review_baris_excel' => $sourceRow,
            'status_provenance' => $provenanceStatus,
            'identitas_sumber' => $sourceIdentity,
            'perlu_review_ulang' => (bool) ($existing?->perlu_review_ulang || $sourceChangedAfterDecision),
            'updated_at' => now(),
        ];

        if (!$existing) {
            $payload += [
                'kandidat_santri_id' => $candidateId,
                'status' => 'perlu_tinjau',
                'keputusan_admin' => 'belum_diputuskan',
                'created_at' => now(),
            ];
            DB::table('santri_import_reviews')->insert([
                'sumber_sheet' => $sheet,
                'baris_sumber' => $sourceRowNumber,
                ...$payload,
            ]);
            return;
        }

        // Sync hanya memperbarui konteks sumber. Keputusan final dan kandidat
        // yang dipilih Admin tetap dipertahankan agar tidak tertimpa workbook.
        if (!$isFinalDecision) {
            $payload['kandidat_santri_id'] = $candidateId;
            $payload['status'] = $existing->status === 'perlu_mapping_kamar'
                ? 'perlu_mapping_kamar'
                : 'perlu_tinjau';
        }

        DB::table('santri_import_reviews')
            ->where('review_id', $existing->review_id)
            ->update($payload);
    }

    /** @return array{file: string, sheet: string}|null */
    private function resolveReviewProvenance(string $sourceType, ?string $sourceRoom): ?array
    {
        if ($sourceType !== 'ABSENSI_KAMAR') {
            return self::FIXED_REVIEW_PROVENANCE[$sourceType] ?? null;
        }

        $room = strtoupper(trim(preg_replace('/\s+/', ' ', (string) $sourceRoom) ?? ''));
        return self::ABSENSI_KAMAR_PROVENANCE[$room] ?? null;
    }

    private function buildSourceIdentity(string $sourceType, ?string $sourceRoom, int $sourceRow, ?array $provenance): string
    {
        if ($provenance) {
            return implode('|', [$provenance['file'], $provenance['sheet'], $sourceRow]);
        }

        return implode('|', ['UNRESOLVED', $sourceType, $sourceRoom ?: '-', $sourceRow]);
    }

    private function relativeWorkbookPath(string $path): string
    {
        $absolutePath = realpath($path) ?: $path;
        $projectRoot = realpath(base_path('..')) ?: dirname(base_path());
        $absolutePath = str_replace('\\', '/', $absolutePath);
        $projectRoot = rtrim(str_replace('\\', '/', $projectRoot), '/');

        if (str_starts_with($absolutePath, $projectRoot.'/')) {
            return ltrim(substr($absolutePath, strlen($projectRoot)), '/');
        }

        return basename($absolutePath);
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
