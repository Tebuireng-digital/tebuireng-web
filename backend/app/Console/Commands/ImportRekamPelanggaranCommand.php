<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use ZipArchive;

class ImportRekamPelanggaranCommand extends Command
{
    protected $signature = 'import:rekam-pelanggaran {--file= : Path opsional file json/xlsx rekam santri}';
    protected $description = 'Import rekam data pelanggaran & prestasi santri dari XLSX / JSON';

    public function handle()
    {
        $customFile = $this->option('file');
        $filePath = $customFile ?: base_path('../data/data_rekam_santri.xlsx');

        if (!file_exists($filePath)) {
            $filePath = base_path('../new data/data_rekam_santri.xlsx');
        }
        if (!file_exists($filePath)) {
            $filePath = base_path('../xlsx/data_rekam_santri.xlsx');
        }
        if (!file_exists($filePath)) {
            $filePath = base_path('../docs/EXCEL BARU/data_rekam_santri.json');
        }

        if (!file_exists($filePath)) {
            $this->error("File tidak ditemukan di: $filePath");
            return 1;
        }

        $this->info("Memulai impor rekam santri dari: $filePath");

        $rekamList = [];
        if (str_ends_with(strtolower($filePath), '.xlsx')) {
            $rekamList = $this->parseXlsx($filePath);
        } else {
            $json = json_decode(file_get_contents($filePath), true);
            $rekamList = $json['data_rekam'] ?? [];
        }

        if (empty($rekamList)) {
            $this->error("Tidak ada data rekam yang ditemukan.");
            return 1;
        }

        $kategoriAll = DB::table('kategori_pelanggaran')->get();
        $adminPetugasId = DB::table('petugas')->where('jabatan', 'Admin')->value('petugas_id') ?: 1;

        $matchedCount = 0;
        $pelanggaranInserted = 0;
        $prestasiInserted = 0;
        $skippedCount = 0;
        $totalRows = count($rekamList);

        $this->output->progressStart($totalRows);

        DB::beginTransaction();
        try {
            foreach ($rekamList as $r) {
                $noId = trim($r['No ID (Induk)'] ?? '');
                $nama = strtoupper(trim($r['Nama Siswa'] ?? ''));
                $deskripsi = trim($r['Deskripsi Pelanggaran / Prestasi'] ?? '');
                $poin = (int) ($r['Poin'] ?? 0);
                $keterangan = trim($r['Keterangan'] ?? '');
                $tanggal = $this->parseTanggal($r['Tanggal'] ?? '');

                if (!$nama) {
                    $skippedCount++;
                    $this->output->progressAdvance();
                    continue;
                }

                $santri = null;
                if ($noId) {
                    $santri = DB::table('santri')->where('no_id_induk', $noId)->first();
                }
                if (!$santri) {
                    $santri = DB::table('santri')->where('nama', $nama)->first();
                }

                if (!$santri) {
                    $skippedCount++;
                    $this->output->progressAdvance();
                    continue;
                }

                $matchedCount++;
                $combined = strtolower($deskripsi . ' ' . $keterangan);
                $isViolation = $poin > 0 || preg_match('/(rokok|atribut|tralis|subuh|terlambat|kabur|keluar tanpa|hp|vape|berkelahi|mencuri|merugikan)/i', $combined);

                if (!$isViolation) {
                    // Impor ke tabel Prestasi
                    $tingkat = 'Pesantren';
                    if (str_contains($combined, 'nasional') || str_contains($combined, 'ksnr')) {
                        $tingkat = 'Nasional';
                    } elseif (str_contains($combined, 'provinsi') || str_contains($combined, 'jawa timur')) {
                        $tingkat = 'Provinsi';
                    } elseif (str_contains($combined, 'jombang') || str_contains($combined, 'kabupaten') || str_contains($combined, 'genza') || str_contains($combined, 'unhasy') || str_contains($combined, 'obor langit')) {
                        $tingkat = 'Kabupaten';
                    } elseif (str_contains($combined, 'kecamatan') || str_contains($combined, 'kec.ngoro') || str_contains($combined, 'kec. ngoro') || str_contains($combined, 'kec.')) {
                        $tingkat = 'Kecamatan';
                    }

                    $peringkat = 'Penghargaan';
                    if (preg_match('/(Juara\s+[1-3](?:\s+Putri)?)/i', $deskripsi . ' ' . $keterangan, $mJuara)) {
                        $peringkat = ucwords(strtolower($mJuara[1]));
                    } elseif (str_contains($combined, 'lolos babak penyisihan')) {
                        $peringkat = 'Lolos Babak Penyisihan';
                    } elseif (str_contains($combined, 'semifinal')) {
                        $peringkat = 'Semifinal 10 Besar';
                    } elseif (str_contains($combined, 'babak final')) {
                        $peringkat = 'Babak Final';
                    } elseif (str_contains($combined, 'delegasi')) {
                        $peringkat = 'Delegasi';
                    } elseif ($keterangan) {
                        $peringkat = $keterangan;
                    }

                    $namaPrestasi = $deskripsi ?: 'Prestasi Santri';
                    if (str_contains(strtolower($deskripsi), 'lolos babak penyisihan') && str_contains(strtoupper($keterangan), 'KSNR')) {
                        $namaPrestasi = 'Kompetisi Sains Nalaria Realistik (' . $keterangan . ')';
                    } elseif (strcasecmp($deskripsi, 'prestasi') === 0 && $keterangan) {
                        $namaPrestasi = $keterangan;
                    }

                    $keteranganLengkap = implode(' - ', array_filter([$deskripsi, $keterangan]));

                    $existingPrestasi = DB::table('prestasi')
                        ->where('santri_id', $santri->santri_id)
                        ->where('tanggal', $tanggal)
                        ->where('nama_prestasi', $namaPrestasi)
                        ->first();

                    if (!$existingPrestasi) {
                        DB::table('prestasi')->insert([
                            'santri_id' => $santri->santri_id,
                            'nama_prestasi' => $namaPrestasi,
                            'peringkat' => $peringkat,
                            'tingkat' => $tingkat,
                            'tanggal' => $tanggal,
                            'keterangan' => $keteranganLengkap,
                            'petugas_pencatat_id' => $adminPetugasId,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                        $prestasiInserted++;
                    }
                } else {
                    // Impor ke tabel Pelanggaran
                    $kategoriId = $this->findKategoriId($deskripsi, $poin, $kategoriAll);
                    $catatanText = array_filter([$deskripsi, $keterangan]);
                    $catatan = implode(' - ', $catatanText) ?: 'Pelanggaran dari rekam santri';

                    $existingPelanggaran = DB::table('pelanggaran')
                        ->where('santri_id', $santri->santri_id)
                        ->where('tanggal', $tanggal)
                        ->where('keterangan', $catatan)
                        ->first();

                    if (!$existingPelanggaran) {
                        DB::table('pelanggaran')->insert([
                            'santri_id' => $santri->santri_id,
                            'kategori_pelanggaran_id' => $kategoriId,
                            'poin' => $poin,
                            'tanggal' => $tanggal,
                            'keterangan' => $catatan,
                            'petugas_pencatat_id' => $adminPetugasId,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                        $pelanggaranInserted++;
                    }
                }

                $this->output->progressAdvance();
            }

            DB::commit();
            $this->output->progressFinish();

            $this->info("\n--- HASIL IMPOR REKAM SANTRI (PELANGGARAN & PRESTASI) ---");
            $this->line("• Total Baris Diproses: {$totalRows}");
            $this->line("• Santri Cocok       : {$matchedCount}");
            $this->line("• Pelanggaran Diimpor: {$pelanggaranInserted}");
            $this->line("• Prestasi Diimpor   : {$prestasiInserted}");
            $this->line("• Baris Dilewati     : {$skippedCount}");
            $this->info("• Total Pelanggaran di DB: " . DB::table('pelanggaran')->count());
            $this->info("• Total Prestasi di DB   : " . DB::table('prestasi')->count());

            return 0;
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("\nTerjadi kesalahan: " . $e->getMessage());
            return 1;
        }
    }

    private function parseXlsx(string $path): array
    {
        try {
            $reader = new \OpenSpout\Reader\XLSX\Reader();
            $reader->open($path);

            $list = [];
            foreach ($reader->getSheetIterator() as $sheet) {
                if ($sheet->getName() !== 'Detail Rekam Jejak') {
                    continue;
                }

                $headers = [];
                $isFirst = true;
                foreach ($sheet->getRowIterator() as $row) {
                    $vals = $row->toArray();
                    if ($isFirst) {
                        $headers = array_map(fn($h) => trim((string)$h), $vals);
                        $isFirst = false;
                        continue;
                    }

                    $item = [];
                    foreach ($headers as $idx => $hName) {
                        $item[$hName] = trim((string)($vals[$idx] ?? ''));
                    }
                    $list[] = $item;
                }
                break;
            }

            $reader->close();
            return $list;
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function findKategoriId(string $deskripsi, int $poin, $kategoriAll): int
    {
        $desk = strtolower(trim($deskripsi));

        foreach ($kategoriAll as $kat) {
            if (strtolower(trim($kat->uraian_pelanggaran)) === $desk) {
                return $kat->kategori_pelanggaran_id;
            }
        }

        foreach ($kategoriAll as $kat) {
            $u = strtolower(trim($kat->uraian_pelanggaran));
            if ($desk && (strpos($u, $desk) !== false || strpos($desk, $u) !== false)) {
                return $kat->kategori_pelanggaran_id;
            }
        }

        foreach ($kategoriAll as $kat) {
            if ($kat->poin_maks == $poin && $poin > 0) {
                return $kat->kategori_pelanggaran_id;
            }
        }

        return $kategoriAll->first()->kategori_pelanggaran_id ?? 1;
    }

    private function parseTanggal(string $tglStr): string
    {
        $tglStr = trim($tglStr);
        if (!$tglStr || $tglStr === '0000-00-00' || $tglStr === '00-00-0000') {
            return now()->toDateString();
        }

        if (is_numeric($tglStr) && (float)$tglStr > 30000) {
            $unixTimestamp = ((float)$tglStr - 25569) * 86400;
            $res = date('Y-m-d', (int)$unixTimestamp);
            if ($res && $res !== '1970-01-01') return $res;
        }

        if (preg_match('/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/', $tglStr, $m)) {
            $d = str_pad($m[1], 2, '0', STR_PAD_LEFT);
            $month = str_pad($m[2], 2, '0', STR_PAD_LEFT);
            $y = $m[3];
            if (checkdate((int)$month, (int)$d, (int)$y)) {
                return "{$y}-{$month}-{$d}";
            }
        }

        if (preg_match('/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/', $tglStr, $m)) {
            $y = $m[1];
            $month = str_pad($m[2], 2, '0', STR_PAD_LEFT);
            $d = str_pad($m[3], 2, '0', STR_PAD_LEFT);
            if (checkdate((int)$month, (int)$d, (int)$y)) {
                return "{$y}-{$month}-{$d}";
            }
        }

        return now()->toDateString();
    }
}
