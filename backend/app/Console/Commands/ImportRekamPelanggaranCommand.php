<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportRekamPelanggaranCommand extends Command
{
    protected $signature = 'import:rekam-pelanggaran {--file= : Path opsional file json/xlsx rekam santri}';
    protected $description = 'Import rekam data pelanggaran santri dari data_rekam_santri.json / data_rekam_santri.xlsx (EXCEL BARU)';

    public function handle()
    {
        $customFile = $this->option('file');
        $filePath = $customFile ?: base_path('../docs/EXCEL BARU/data_rekam_santri.json');

        if (!file_exists($filePath)) {
            $filePath = base_path('../xlsx/data_rekam_santri.json');
        }

        if (!file_exists($filePath)) {
            $this->error("File tidak ditemukan di: $filePath");
            return 1;
        }

        $this->info("Memulai impor rekam pelanggaran dari: $filePath");

        $data = json_decode(file_get_contents($filePath), true);
        $rekamList = $data['data_rekam'] ?? [];

        if (empty($rekamList)) {
            $this->error("Tidak ada data rekam yang ditemukan.");
            return 1;
        }

        $kategoriAll = DB::table('kategori_pelanggaran')->get();
        $adminPetugasId = DB::table('petugas')->where('jabatan', 'Admin')->value('petugas_id') ?: 1;

        $matchedCount = 0;
        $insertedCount = 0;
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
                    $this->output->progressAdvance();
                    continue;
                }

                $santri = null;
                if ($noId) {
                    $santri = DB::table('santri')->where('nis', $noId)->first();
                }
                if (!$santri) {
                    $santri = DB::table('santri')->where('nama', $nama)->first();
                }

                if (!$santri) {
                    $this->output->progressAdvance();
                    continue;
                }

                $matchedCount++;
                $kategoriId = $this->findKategoriId($deskripsi, $poin, $kategoriAll);

                $catatanText = array_filter([$deskripsi, $keterangan]);
                $catatan = implode(' - ', $catatanText);

                DB::table('pelanggaran')->insert([
                    'santri_id' => $santri->santri_id,
                    'kategori_pelanggaran_id' => $kategoriId,
                    'tanggal' => $tanggal,
                    'keterangan' => $catatan ?: 'Pelanggaran dari rekam santri',
                    'petugas_pencatat_id' => $adminPetugasId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $insertedCount++;

                $this->output->progressAdvance();
            }

            DB::commit();
            $this->output->progressFinish();

            $this->info("\n--- HASIL IMPOR REKAM PELANGGARAN SANTRI ---");
            $this->line("• Total Baris Diproses: {$totalRows}");
            $this->line("• Santri Cocok       : {$matchedCount}");
            $this->line("• Pelanggaran Diimpor: {$insertedCount}");
            $this->info("• Total Pelanggaran di DB Sekarang: " . DB::table('pelanggaran')->count());

            return 0;
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("\nTerjadi kesalahan: " . $e->getMessage());
            return 1;
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
        if (!$tglStr) return now()->toDateString();
        if (preg_match('/^(\d{2})-(\d{2})-(\d{4})$/', $tglStr, $m)) {
            return "{$m[3]}-{$m[2]}-{$m[1]}";
        }
        return $tglStr;
    }
}
