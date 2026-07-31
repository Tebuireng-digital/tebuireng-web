<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use OpenSpout\Reader\XLSX\Reader;
use OpenSpout\Writer\XLSX\Writer;
use OpenSpout\Common\Entity\Row;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class ImportExcelCommand extends Command
{
    protected $signature = 'import:excel';
    protected $description = 'Import data from 6 Excel files based on PRD rules';

    private $units = [];
    private $kamarMap = []; // 'Nama Lengkap' => kamar_id
    private $kelasMap = []; // 'UnitId_NamaKelas' => kelas_id
    private $madinMap = [];
    private $pbsMap = [];
    private $pbmMap = [];

    private $stats = [
        'sumber' => [],
        'santri_a' => 0,
        'santri_b' => 0,
        'santri_c' => 0
    ];

    private $groupB = [];
    private $groupC = [];
    private $newPetugasCredentials = [];

    public function handle()
    {
        $this->info("Memulai proses ETL Import Excel...");
        $docsPath = base_path('../xlsx/');

        $fileKamar = $docsPath . 'Database_Santri_Kamar_MTS_SMP_SMA_SMK.xlsx';
        $fileSiswa = $docsPath . 'Database_Siswa_Kelas_7_8_9_2026_2027.xlsx';
        $fileMadin = $docsPath . 'Database_Kelas_Madin_2026_2027.xlsx';
        $fileQuran = $docsPath . 'Database_Kelompok_AlQuran (belajar habis subuh)_2026_2027.xlsx';
        $fileTakhassus = $docsPath . 'Database_Takhassus (belajar habis maghrib)_2026_2027.xlsx';
        $filePelanggaran = $docsPath . 'Database_Pelanggaran_Santri_Tebuireng.xlsx';

        // Load units
        $this->units = DB::table('unit_pendidikan')->pluck('unit_id', 'kode')->toArray();

        // 1. Petugas
        $this->info("1. Import Petugas...");
        $this->importPetugas($fileKamar, $fileSiswa, $filePelanggaran);

        // 2. Kamar & Mapping CSV
        $this->info("2. Import Kamar & Generate Mapping Draft...");
        $this->importKamar($fileKamar, $fileMadin, $fileQuran, $fileTakhassus);

        // 3. Kelas Formal
        $this->info("3. Import Kelas Formal...");
        $this->importKelasFormal($fileSiswa, $fileMadin);

        // 4. Kelompok
        $this->info("4. Import Kelompok Madin, PBS, PBM...");
        $this->importKelompok($fileMadin, $fileQuran, $fileTakhassus);

        // 5. Kategori Pelanggaran
        $this->info("5. Import Kategori Pelanggaran...");
        $this->importKategoriPelanggaran($filePelanggaran);

        // 6. Santri
        $this->info("6. Import Santri & Matching...");
        $this->importSantri($fileKamar, $fileSiswa, $fileMadin, $fileQuran, $fileTakhassus);
        $this->writePetugasCredentials();

        // Output results
        $this->info("\n--- RINGKASAN ETL ---");
        foreach ($this->stats['sumber'] as $sheet => $count) {
            $this->line("Sumber [{$sheet}]: {$count} baris");
        }
        $this->info("Total Santri Kelompok A (Match Otomatis) : " . $this->stats['santri_a']);
        $this->info("Total Santri Kelompok B (Kandidat Review): " . $this->stats['santri_b']);
        $this->info("Total Santri Kelompok C (Santri Baru)    : " . $this->stats['santri_c']);

        // Spot check
        $this->info("\n--- SPOT CHECK (10 Santri Acak) ---");
        $spotChecks = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->select('santri.nama', 'santri.kamar_id', 'kamar.nama as nama_kamar')
            ->whereNotNull('santri.kamar_id')
            ->inRandomOrder()
            ->limit(10)
            ->get();
        foreach ($spotChecks as $sc) {
            $this->line("- {$sc->nama} | Kamar ID: {$sc->kamar_id} ({$sc->nama_kamar})");
        }
        
        $this->info("\nSELESAI. File mapping dan review santri ada di /storage/app/");
    }

    private function readSheet($filePath, $sheetName)
    {
        if (!file_exists($filePath)) return [];
        $reader = new Reader();
        $reader->open($filePath);
        $data = [];
        foreach ($reader->getSheetIterator() as $sheet) {
            if ($sheet->getName() === $sheetName) {
                $rowIdx = 0;
                foreach ($sheet->getRowIterator() as $row) {
                    $rowIdx++;
                    if ($rowIdx === 1) continue;
                    $cells = $row->toArray();
                    // Ensure cells are strings
                    $data[] = array_map(function($c) { return trim((string)$c); }, $cells);
                }
                break;
            }
        }
        $reader->close();
        if ($sheetName !== 'Lokasi Kelas' && $sheetName !== 'Daftar Kelas') {
            $this->stats['sumber'][$sheetName] = count($data);
        }
        return $data;
    }

    private function importPetugas($fKamar, $fSiswa, $fPelanggaran)
    {
        $petugasMap = []; // name => jabatan
        
        $kamarData = $this->readSheet($fKamar, 'Database Santri Kamar');
        foreach ($kamarData as $row) {
            $nama = strtoupper(trim($row[5] ?? ''));
            if ($nama) $petugasMap[$nama] = 'Pembina Kamar';
        }

        $siswaData = $this->readSheet($fSiswa, 'Database Siswa');
        foreach ($siswaData as $row) {
            $nama = strtoupper(trim($row[5] ?? ''));
            if ($nama && !isset($petugasMap[$nama])) $petugasMap[$nama] = 'Wali Kelas';
        }

        // Pelanggaran doesn't have data, just form
        $pelanggaranData = $this->readSheet($fPelanggaran, 'Input Pelanggaran Santri');
        foreach ($pelanggaranData as $row) {
            if ($row[0] === 'No') continue; // header
            $nama = strtoupper(trim($row[12] ?? '')); // Petugas Pencatat
            if ($nama && !isset($petugasMap[$nama])) $petugasMap[$nama] = 'Admin';
        }

        foreach ($petugasMap as $nama => $jabatan) {
            $exists = DB::table('petugas')->where('nama', $nama)->exists();
            if (!$exists) {
                do {
                    $username = Str::slug($nama) . '-' . random_int(100, 999);
                } while (DB::table('petugas')->where('username', $username)->exists());
                $temporaryPassword = Str::password(12);

                DB::table('petugas')->insert([
                    'nama' => $nama,
                    'username' => $username,
                    'password_hash' => Hash::make($temporaryPassword),
                    'wajib_ganti_password' => true,
                    'jabatan' => $jabatan,
                    'status_aktif' => 1
                ]);

                $this->newPetugasCredentials[] = [$nama, $jabatan, $username, $temporaryPassword];
            }
        }
    }

    private function writePetugasCredentials(): void
    {
        if (empty($this->newPetugasCredentials)) {
            return;
        }

        $path = storage_path('app/akun-petugas-baru.csv');
        $handle = fopen($path, 'w');
        fputcsv($handle, ['nama', 'jabatan', 'username', 'password_sementara']);
        foreach ($this->newPetugasCredentials as $credential) {
            fputcsv($handle, $credential);
        }
        fclose($handle);

        $this->warn('Akun petugas baru: '.$path.' (bagikan secara aman lalu hapus file).');
    }

    private function importKamar($fKamar, $fMadin, $fQuran, $fTakhassus)
    {
        $kamarData = $this->readSheet($fKamar, 'Database Santri Kamar');
        foreach ($kamarData as $row) {
            $namaKamar = trim($row[4] ?? '');
            if (!$namaKamar) continue;
            
            if (!isset($this->kamarMap[$namaKamar])) {
                $pembinaName = strtoupper(trim($row[5] ?? ''));
                $pembinaId = null;
                if ($pembinaName) {
                    $pembinaId = DB::table('petugas')->where('nama', $pembinaName)->value('petugas_id');
                }
                $unitKode = trim($row[3] ?? '');
                $unitId = $this->units[$unitKode] ?? null;

                $exists = DB::table('kamar')->where('nama', $namaKamar)->first();
                if (!$exists) {
                    $kamarId = DB::table('kamar')->insertGetId([
                        'nama' => $namaKamar,
                        'unit_id' => $unitId,
                        'pembina_id' => $pembinaId,
                    ]);
                } else {
                    $kamarId = $exists->kamar_id;
                }
                $this->kamarMap[$namaKamar] = $kamarId;
            }
        }

        // Generate mapping CSV
        $uniqueKode = [];
        $d1 = $this->readSheet($fMadin, 'Database Siswa Madin');
        foreach ($d1 as $r) { if (!empty($r[2])) $uniqueKode[trim($r[2])] = 1; }
        $d2 = $this->readSheet($fQuran, 'Database Al-Qur\'an');
        foreach ($d2 as $r) { if (!empty($r[2])) $uniqueKode[trim($r[2])] = 1; }
        $d3 = $this->readSheet($fTakhassus, 'Database Takhassus');
        foreach ($d3 as $r) { if (!empty($r[2])) $uniqueKode[trim($r[2])] = 1; }

        $csvPath = storage_path('app/mapping-kamar-draft.csv');
        $existingMapping = [];
        if (file_exists($csvPath)) {
            if (($handle = fopen($csvPath, "r")) !== FALSE) {
                while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                    if ($data[0] !== 'kode_singkat') {
                        $existingMapping[$data[0]] = $data[1] ?? '';
                    }
                }
                fclose($handle);
            }
        }

        $f = fopen($csvPath, 'w');
        fputcsv($f, ['kode_singkat', 'nama_kamar_lengkap']);
        foreach (array_keys($uniqueKode) as $kode) {
            $mapped = !empty($existingMapping[$kode])
                ? $existingMapping[$kode]
                : $this->guessKamarName($kode);
            if ($mapped && isset($this->kamarMap[$mapped])) {
                DB::table('kamar')
                    ->where('kamar_id', $this->kamarMap[$mapped])
                    ->update(['kode_singkat' => $kode]);
            } else {
                $mapped = '';
            }
            fputcsv($f, [$kode, $mapped]);
        }
        fclose($f);
    }

    private function guessKamarName(string $kode): string
    {
        if ($kode === 'K-BAWAH') {
            return 'K BAWAH';
        }

        $prefixes = [
            'GD' => 'Gus Dur',
            'HK' => 'Hadji Kalla',
            'AB' => 'KH. A. Baidlowi',
            'KI' => 'KH. Ilyas',
            'RD' => 'Roudloh',
            'SZ' => 'Saifuddin Zuhri',
            'SH' => 'Sholihah',
            'SK' => 'Suryo Kusumo',
            'KK' => 'Kiyai Karim',
        ];

        foreach ($prefixes as $prefix => $nama) {
            if (str_starts_with($kode, $prefix.' ')) {
                return $nama.' '.substr($kode, strlen($prefix) + 1);
            }
        }

        return '';
    }

    private function importKelasFormal($fSiswa, $fMadin)
    {
        $siswaData = $this->readSheet($fSiswa, 'Database Siswa');
        $smpUnitId = $this->units['SMP'] ?? null;
        
        foreach ($siswaData as $row) {
            $tingkat = trim($row[3] ?? '');
            $kelas = trim($row[4] ?? '');
            $wali = strtoupper(trim($row[5] ?? ''));
            if (!$kelas || !$smpUnitId) continue;

            $key = $smpUnitId . '_' . $kelas;
            if (!isset($this->kelasMap[$key])) {
                $waliId = $wali ? DB::table('petugas')->where('nama', $wali)->value('petugas_id') : null;
                $exists = DB::table('kelas_formal')->where('unit_id', $smpUnitId)->where('nama_kelas', $kelas)->first();
                if (!$exists) {
                    $id = DB::table('kelas_formal')->insertGetId([
                        'unit_id' => $smpUnitId,
                        'tingkat' => $tingkat,
                        'nama_kelas' => $kelas,
                        'wali_kelas_id' => $waliId
                    ]);
                } else {
                    $id = $exists->kelas_formal_id;
                }
                $this->kelasMap[$key] = $id;
            }
        }

        // Madin Unit (Formal Class)
        $madinData = $this->readSheet($fMadin, 'Database Siswa Madin');
        foreach ($madinData as $row) {
            $kelas = trim($row[3] ?? '');
            $jenjang = trim($row[4] ?? ''); // MTS, SMA, etc
            $unitId = $this->units[$jenjang] ?? null;
            if (!$kelas || !$unitId) continue;
            
            $key = $unitId . '_' . $kelas;
            if (!isset($this->kelasMap[$key])) {
                $exists = DB::table('kelas_formal')->where('unit_id', $unitId)->where('nama_kelas', $kelas)->first();
                if (!$exists) {
                    $id = DB::table('kelas_formal')->insertGetId([
                        'unit_id' => $unitId,
                        'nama_kelas' => $kelas,
                    ]);
                } else {
                    $id = $exists->kelas_formal_id;
                }
                $this->kelasMap[$key] = $id;
            }
        }
    }

    private function importKelompok($fMadin, $fQuran, $fTakhassus)
    {
        $rMadin = $this->readSheet($fMadin, 'Rekap Kelas Madin');
        foreach ($rMadin as $row) {
            $jenjang = trim($row[0] ?? '');
            $nama = trim($row[1] ?? '');
            if (!$nama) continue;
            
            $exists = DB::table('kelompok_madin')->where('jenjang', $jenjang)->where('nama_kelas_madin', $nama)->first();
            if (!$exists) {
                $id = DB::table('kelompok_madin')->insertGetId([
                    'jenjang' => $jenjang,
                    'nama_kelas_madin' => $nama
                ]);
            } else {
                $id = $exists->kelompok_madin_id;
            }
            $this->madinMap[$jenjang.'_'.$nama] = $id;
        }

        $rQuran = $this->readSheet($fQuran, 'Rekap Kelompok');
        foreach ($rQuran as $row) {
            $kategori = trim($row[0] ?? '');
            $nama = trim($row[1] ?? '');
            if (!$nama) continue;
            $exists = DB::table('kelompok_pbs')->where('kategori', $kategori)->where('nama_kelompok', $nama)->first();
            if (!$exists) {
                $id = DB::table('kelompok_pbs')->insertGetId([
                    'kategori' => $kategori,
                    'nama_kelompok' => $nama
                ]);
            } else { $id = $exists->kelompok_pbs_id; }
            $this->pbsMap[$kategori.'_'.$nama] = $id;
        }

        $rTak = $this->readSheet($fTakhassus, 'Rekap Kelompok');
        foreach ($rTak as $row) {
            $kategori = trim($row[0] ?? '');
            $nama = trim($row[1] ?? '');
            if (!$nama) continue;
            $exists = DB::table('kelompok_pbm')->where('kategori', $kategori)->where('nama_kelompok', $nama)->first();
            if (!$exists) {
                $id = DB::table('kelompok_pbm')->insertGetId([
                    'kategori' => $kategori,
                    'nama_kelompok' => $nama
                ]);
            } else { $id = $exists->kelompok_pbm_id; }
            $this->pbmMap[$kategori.'_'.$nama] = $id;
        }
    }

    private function importKategoriPelanggaran($fPelanggaran)
    {
        $data = $this->readSheet($fPelanggaran, 'Master Pelanggaran');
        foreach ($data as $row) {
            $kode = trim($row[1] ?? '');
            if (!$kode) continue;
            $exists = DB::table('kategori_pelanggaran')->where('kode_pasal', $kode)->exists();
            if (!$exists) {
                DB::table('kategori_pelanggaran')->insert([
                    'kode_pasal' => $kode,
                    'kategori' => trim($row[2] ?? ''),
                    'uraian_pelanggaran' => trim($row[3] ?? ''),
                    'poin_maks' => (int)trim($row[4] ?? 0),
                    'jenis' => trim($row[5] ?? ''),
                    'status_aktif' => trim($row[6] ?? '') === 'Tidak Aktif' ? 'Tidak Aktif' : 'Aktif',
                ]);
            }
        }
    }

    private function loadKamarMapping()
    {
        $csvPath = storage_path('app/mapping-kamar-draft.csv');
        $this->kamarSingkatanMap = [];
        if (file_exists($csvPath)) {
            if (($handle = fopen($csvPath, "r")) !== FALSE) {
                while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
                    if ($data[0] !== 'kode_singkat' && !empty($data[1])) {
                        $this->kamarSingkatanMap[$data[0]] = $data[1];
                    }
                }
                fclose($handle);
            }
        }
    }

    private function importSantri($fKamar, $fSiswa, $fMadin, $fQuran, $fTakhassus)
    {
        $this->loadKamarMapping();

        // 1. BASE: Database Santri Kamar
        $kamarData = $this->readSheet($fKamar, 'Database Santri Kamar');
        foreach ($kamarData as $row) {
            $nama = strtoupper(trim($row[1] ?? ''));
            $unitKode = trim($row[3] ?? '');
            $kamarStr = trim($row[4] ?? '');
            if (!$nama) continue;

            $unitId = $this->units[$unitKode] ?? null;
            $kamarId = $this->kamarMap[$kamarStr] ?? null;

            if ($unitId) {
                $exists = DB::table('santri')->where('nama', $nama)->where('kamar_id', $kamarId)->exists();
                if (!$exists) {
                    DB::table('santri')->insert([
                        'nama' => $nama,
                        'unit_id' => $unitId,
                        'kamar_id' => $kamarId,
                        'status_aktif' => 1
                    ]);
                    $this->stats['santri_a']++;
                }
            }
        }

        // Process other sheets
        $this->processOtherSheet('Database Siswa', $fSiswa, function($row) {
            $nis = trim($row[1] ?? '');
            $nama = strtoupper(trim($row[2] ?? ''));
            $kelas = trim($row[4] ?? '');
            $kamarStr = ''; // missing in Siswa
            $unitId = $this->units['SMP'] ?? null;
            $kfId = $this->kelasMap[$unitId.'_'.$kelas] ?? null;
            return [$nama, $kamarStr, ['nis' => $nis, 'unit_id' => $unitId, 'kelas_formal_id' => $kfId], "NIS: $nis, Kelas: $kelas"];
        });

        $this->processOtherSheet('Database Siswa Madin', $fMadin, function($row) {
            $nama = strtoupper(trim($row[1] ?? ''));
            $kamarStr = trim($row[2] ?? '');
            $kelas = trim($row[3] ?? '');
            $jenjang = trim($row[4] ?? '');
            $madin = trim($row[5] ?? '');
            $unitId = $this->units[$jenjang] ?? null;
            $kfId = $this->kelasMap[$unitId.'_'.$kelas] ?? null;
            $mId = $this->madinMap[$jenjang.'_'.$madin] ?? null;
            return [$nama, $kamarStr, ['unit_id' => $unitId, 'kelas_formal_id' => $kfId, 'kelompok_madin_id' => $mId], "Formal: $kelas, Madin: $madin"];
        });

        $this->processOtherSheet('Database Al-Qur\'an', $fQuran, function($row) {
            $nama = strtoupper(trim($row[1] ?? ''));
            $kamarStr = trim($row[2] ?? '');
            $kat = trim($row[4] ?? '');
            $kel = trim($row[5] ?? '');
            $pbsId = $this->pbsMap[$kat.'_'.$kel] ?? null;
            $unitId = $this->resolveUnitId(trim($row[3] ?? ''));
            return [$nama, $kamarStr, ['unit_id' => $unitId, 'kelompok_pbs_id' => $pbsId], "Kategori: $kat, Al-Qur'an: $kel"];
        });

        $this->processOtherSheet('Database Takhassus', $fTakhassus, function($row) {
            $nama = strtoupper(trim($row[1] ?? ''));
            $kamarStr = trim($row[2] ?? '');
            $kat = trim($row[5] ?? '');
            $kel = trim($row[6] ?? '');
            $pbmId = $this->pbmMap[$kat.'_'.$kel] ?? null;
            $unitId = $this->resolveUnitId(trim($row[3] ?? ''));
            return [$nama, $kamarStr, ['unit_id' => $unitId, 'kelompok_pbm_id' => $pbmId], "Kategori: $kat, Takhasus: $kel"];
        });

        // Write Group B and C to excel
        $this->writeExcelReview(storage_path('app/santri-review-kandidat.xlsx'), $this->groupB, ['Sheet Asal', 'Nama di Sheet', 'Kamar di Sheet', 'Kandidat di DB (Nama - Kamar)', 'Data Tambahan']);
        $this->writeExcelReview(storage_path('app/santri-review-baru.xlsx'), $this->groupC, ['Sheet Asal', 'Nama di Sheet', 'Kamar di Sheet', 'Data Tambahan']);
    }

    private function processOtherSheet($sheetName, $file, $callback)
    {
        $data = $this->readSheet($file, $sheetName);
        foreach ($data as $row) {
            list($nama, $kamarStr, $updates, $info) = $callback($row);
            if (!$nama) continue;

            $updates = array_filter($updates, fn ($value) => $value !== null && $value !== '');

            $mappedKamar = $this->kamarSingkatanMap[$kamarStr] ?? $kamarStr;
            $mappedKamarId = $this->kamarMap[$mappedKamar] ?? null;

            $candidates = DB::table('santri')
                ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
                ->select('santri.santri_id', 'santri.nama', 'santri.unit_id', 'santri.kamar_id', 'kamar.nama as nama_kamar')
                ->where('santri.nama', $nama)
                ->get();

            if ($candidates->isEmpty()) {
                if (!empty($updates['unit_id'])) {
                    DB::table('santri')->insert(array_merge($updates, [
                        'nama' => $nama,
                        'kamar_id' => $mappedKamarId,
                        'status_aktif' => 1,
                        'catatan_import' => "Baru otomatis dari {$sheetName}; perlu verifikasi",
                    ]));
                }
                $this->groupC[] = [$sheetName, $nama, $kamarStr, $info];
                $this->stats['santri_c']++;
            } else {
                // Check if any candidate has identical Kamar string
                $matchedId = null;
                $kandidatInfo = [];
                foreach ($candidates as $c) {
                    $kandidatInfo[] = $c->nama . ' - ' . ($c->nama_kamar ?? 'Kosong');
                    if ($c->nama_kamar === $mappedKamar) {
                        $matchedId = $c->santri_id;
                    }
                }

                // Keputusan bisnis: satu kandidat dengan nama persis adalah orang yang sama.
                // Pertahankan unit/kamar dari database induk bila sudah terisi; sumber
                // kelas/kelompok hanya memperkaya NIS dan keanggotaan roster.
                if (!$matchedId && $candidates->count() === 1) {
                    $candidate = $candidates->first();

                    $matchedId = $candidate->santri_id;
                    if ($candidate->unit_id) {
                        unset($updates['unit_id']);
                    }
                    if (!$candidate->kamar_id && $mappedKamarId) {
                        $updates['kamar_id'] = $mappedKamarId;
                    }
                }

                if ($matchedId) {
                    // Group A -> Update directly
                    DB::table('santri')->where('santri_id', $matchedId)->update($updates);
                    $this->stats['santri_a']++;
                } else {
                    // Group B
                    $this->groupB[] = [$sheetName, $nama, $kamarStr, implode(', ', $kandidatInfo), $info];
                    $this->stats['santri_b']++;
                }
            }
        }
    }

    private function resolveUnitId(string $unitText): ?int
    {
        foreach (array_keys($this->units) as $kode) {
            if (preg_match('/(?:^|\s)'.preg_quote($kode, '/').'$/i', trim($unitText))) {
                return (int) $this->units[$kode];
            }
        }

        return null;
    }

    private function writeExcelReview($path, $rows, $headers)
    {
        $writer = new Writer();
        $writer->openToFile($path);
        $writer->addRow(Row::fromValues($headers));
        foreach ($rows as $r) {
            $writer->addRow(Row::fromValues($r));
        }
        $writer->close();
    }
}
