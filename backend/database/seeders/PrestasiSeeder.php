<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use OpenSpout\Reader\XLSX\Reader;

class PrestasiSeeder extends Seeder
{
    /**
     * Seed prestasi santri dari data rekam santri (data/data_rekam_santri.xlsx).
     */
    public function run(): void
    {
        $filePath = base_path('../data/data_rekam_santri.xlsx');
        if (!file_exists($filePath)) {
            $filePath = base_path('../new data/data_rekam_santri.xlsx');
        }
        if (!file_exists($filePath)) {
            $filePath = base_path('../xlsx/data_rekam_santri.xlsx');
        }

        if (!file_exists($filePath)) {
            $this->command?->error("File data_rekam_santri.xlsx tidak ditemukan.");
            return;
        }

        $adminPetugasId = DB::table('petugas')->where('jabatan', 'Admin')->value('petugas_id') ?: 1;

        $reader = new Reader();
        $reader->open($filePath);

        $insertedCount = 0;
        $updatedCount = 0;
        $skippedCount = 0;

        foreach ($reader->getSheetIterator() as $sheet) {
            if ($sheet->getName() !== 'Detail Rekam Jejak') {
                continue;
            }

            $isFirstRow = true;
            foreach ($sheet->getRowIterator() as $row) {
                if ($isFirstRow) {
                    $isFirstRow = false;
                    continue;
                }

                $vals = $row->toArray();
                $noId = trim((string)($vals[0] ?? ''));
                $nama = strtoupper(trim((string)($vals[1] ?? '')));
                $tglRaw = trim((string)($vals[5] ?? ''));
                $desc = trim((string)($vals[6] ?? ''));
                $poin = (int)trim((string)($vals[7] ?? 0));
                $ket = trim((string)($vals[8] ?? ''));

                if (!$nama && !$noId) {
                    continue;
                }

                $combined = strtolower($desc . ' ' . $ket);

                // Filter out explicit violations
                $isViolation = $poin > 0 || preg_match('/(rokok|atribut|tralis|subuh|terlambat|kabur|keluar tanpa|hp|vape|berkelahi|mencuri|merugikan)/i', $combined);
                if ($isViolation) {
                    continue;
                }

                // Match Santri
                $santri = null;
                if ($noId) {
                    $santri = DB::table('santri')->where('no_id_induk', $noId)->first();
                }
                if (!$santri && $nama) {
                    $santri = DB::table('santri')->where('nama', $nama)->first();
                }

                if (!$santri) {
                    $skippedCount++;
                    continue;
                }

                // Parse Tanggal
                $tanggal = $this->parseTanggal($tglRaw);

                // Parse Tingkat
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

                // Parse Peringkat
                $peringkat = 'Penghargaan';
                if (preg_match('/(Juara\s+[1-3](?:\s+Putri)?)/i', $desc . ' ' . $ket, $mJuara)) {
                    $peringkat = ucwords(strtolower($mJuara[1]));
                } elseif (str_contains($combined, 'lolos babak penyisihan')) {
                    $peringkat = 'Lolos Babak Penyisihan';
                } elseif (str_contains($combined, 'semifinal')) {
                    $peringkat = 'Semifinal 10 Besar';
                } elseif (str_contains($combined, 'babak final')) {
                    $peringkat = 'Babak Final';
                } elseif (str_contains($combined, 'delegasi')) {
                    $peringkat = 'Delegasi';
                } elseif ($ket) {
                    $peringkat = $ket;
                }

                // Clean Nama Prestasi
                $namaPrestasi = $desc;
                if (str_contains(strtolower($desc), 'lolos babak penyisihan') && str_contains(strtoupper($ket), 'KSNR')) {
                    $namaPrestasi = 'Kompetisi Sains Nalaria Realistik (' . $ket . ')';
                } elseif (strcasecmp($desc, 'prestasi') === 0 && $ket) {
                    $namaPrestasi = $ket;
                }

                $keteranganLengkap = implode(' - ', array_filter([$desc, $ket]));

                $existing = DB::table('prestasi')
                    ->where('santri_id', $santri->santri_id)
                    ->where('tanggal', $tanggal)
                    ->where('nama_prestasi', $namaPrestasi)
                    ->first();

                if ($existing) {
                    DB::table('prestasi')
                        ->where('prestasi_id', $existing->prestasi_id)
                        ->update([
                            'peringkat' => $peringkat,
                            'tingkat' => $tingkat,
                            'keterangan' => $keteranganLengkap,
                            'petugas_pencatat_id' => $adminPetugasId,
                            'updated_at' => now(),
                        ]);
                    $updatedCount++;
                } else {
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
                    $insertedCount++;
                }
            }
        }

        $reader->close();

        $this->command?->info("PrestasiSeeder selesai: {$insertedCount} baru diinsert, {$updatedCount} diupdate, {$skippedCount} santri tidak cocok.");
    }

    private function parseTanggal(string $tgl): string
    {
        $tgl = trim($tgl);
        if (!$tgl) {
            return now()->toDateString();
        }

        // Format DD-MM-YYYY atau DD/MM/YYYY
        if (preg_match('/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/', $tgl, $m)) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
        }

        // Format YYYY-MM-DD
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $tgl)) {
            return $tgl;
        }

        $ts = strtotime($tgl);
        return $ts ? date('Y-m-d', $ts) : now()->toDateString();
    }
}
