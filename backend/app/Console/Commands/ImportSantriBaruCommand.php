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
        $filePath = $customFile ?: base_path('../new data/data_santri_semua.xls');

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

        // Nama bukan identitas unik. Fallback nama hanya aman bila nama itu muncul sekali
        // pada seluruh workbook sumber; sisanya dibuat sebagai profil terpisah untuk review.
        $sourceNameCounts = [];
        foreach ($rows as $index => $row) {
            if ($index === 0) continue;
            $cells = [];
            foreach ($row->getElementsByTagName('td') as $td) {
                $cells[] = trim($td->nodeValue);
            }
            $nama = strtoupper(trim($cells[2] ?? ''));
            if ($nama) $sourceNameCounts[$nama] = ($sourceNameCounts[$nama] ?? 0) + 1;
        }

        $units = DB::table('unit_pendidikan')->pluck('unit_id', 'kode')->toArray();
        $jenisKegiatan = DB::table('jenis_kegiatan')->pluck('jenis_kegiatan_id', 'kode')->toArray();
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
                $nik = $cells[1] ?? '';
                $nama = strtoupper(trim($cells[2] ?? ''));
                $pend = $cells[5] ?? '';
                $kelas = $cells[6] ?? '';
                $ayah = trim($cells[37] ?? '');
                $ibu = trim($cells[41] ?? '');
                $hp = trim($cells[49] ?? '');
                $kamarCode = trim($cells[50] ?? '');

                if (!$nama) {
                    $this->output->progressAdvance();
                    continue;
                }

                $unitId = $this->resolveUnitId($pend, $units);
                $kelasFormalId = $this->resolveKelasFormalId($unitId, $kelas);
                $kamarId = $this->resolveKamarId($kamarCode, $kamarSingkatanMap, $kamarByName);
                if ($kamarId) $matchedKamarCount++;

                $wali = $ayah ?: ($ibu ?: null);

                $existing = null;
                if (!$existing && $noId) {
                    $existing = DB::table('santri')->where('no_id_induk', $noId)->first();
                }
                if (!$existing && $noId) {
                    // Kompatibilitas untuk hasil impor lama yang pernah menyimpan No. ID di kolom nis.
                    $existing = DB::table('santri')->where('nis', $noId)->first();
                }
                if (!$existing && ($sourceNameCounts[$nama] ?? 0) === 1) {
                    $kandidatNama = DB::table('santri')->where('nama', $nama)->limit(2)->get();
                    if ($kandidatNama->count() === 1) {
                        $existing = $kandidatNama->first();
                    }
                }

                $profil = [
                    'no_id_induk' => $noId ?: null,
                    'nik_siswa' => $nik ?: null,
                    'nama' => $nama,
                    'jenis_kelamin' => trim($cells[7] ?? '') ?: null,
                    'tempat_lahir' => trim($cells[3] ?? '') ?: null,
                    'tanggal_lahir' => trim($cells[4] ?? '') ?: null,
                    'no_hp_santri' => $hp ?: null,
                    'alamat_jalan' => trim($cells[20] ?? '') ?: null,
                    'provinsi' => trim($cells[21] ?? '') ?: null,
                    'kabupaten_kota' => trim($cells[22] ?? '') ?: null,
                    'kecamatan' => trim($cells[23] ?? '') ?: null,
                    'desa_kelurahan' => trim($cells[24] ?? '') ?: null,
                    'kode_pos' => trim($cells[25] ?? '') ?: null,
                    'unit_id' => $unitId,
                    'kelas_formal_id' => $kelasFormalId,
                    'kamar_id' => $kamarId,
                    'nama_wali' => $wali,
                    'no_hp_wali' => $hp ?: null,
                    'status_aktif' => 1,
                    'status_verifikasi' => 'perlu_verifikasi',
                    'status_siswa_sumber' => trim($cells[11] ?? '') ?: null,
                    'catatan_import' => 'Terupdate via data_santri_semua.xls',
                    'updated_at' => now(),
                ];

                if ($existing) {
                    // Kamar kosong dari sumber tidak boleh menghapus penetapan kamar yang sudah ada.
                    if (!$kamarId) unset($profil['kamar_id']);
                    DB::table('santri')->where('santri_id', $existing->santri_id)->update($profil);
                    $santriId = $existing->santri_id;
                    $updatedCount++;
                } else {
                    $santriId = DB::table('santri')->insertGetId($profil + ['created_at' => now()]);
                    $createdCount++;
                }

                DB::table('santri_keluarga')->updateOrInsert(['santri_id' => $santriId], [
                    'no_kk' => trim($cells[36] ?? '') ?: null,
                    'nama_ayah' => $ayah ?: null,
                    'nik_ayah' => trim($cells[38] ?? '') ?: null,
                    'pendidikan_ayah' => trim($cells[39] ?? '') ?: null,
                    'pekerjaan_ayah' => trim($cells[40] ?? '') ?: null,
                    'nama_ibu' => $ibu ?: null,
                    'nik_ibu' => trim($cells[42] ?? '') ?: null,
                    'pendidikan_ibu' => trim($cells[43] ?? '') ?: null,
                    'pekerjaan_ibu' => trim($cells[44] ?? '') ?: null,
                    'rata_rata_penghasilan' => trim($cells[45] ?? '') ?: null,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('santri_pendidikan')->updateOrInsert(['santri_id' => $santriId, 'tahun_ajaran' => '2026/2027'], [
                    'pend_sumber' => $pend ?: null,
                    'kelas_sumber' => $kelas ?: null,
                    'jurusan' => trim($cells[8] ?? '') ?: null,
                    'kelas_paralel' => trim($cells[9] ?? '') ?: null,
                    'ranking' => trim($cells[10] ?? '') ?: null,
                    'status_siswa_sumber' => trim($cells[11] ?? '') ?: null,
                    'asal_sekolah' => trim($cells[12] ?? '') ?: null,
                    'jenis_sekolah' => trim($cells[16] ?? '') ?: null,
                    'status_sekolah' => trim($cells[17] ?? '') ?: null,
                    'lokasi_sekolah' => trim($cells[18] ?? '') ?: null,
                    'no_un' => trim($cells[19] ?? '') ?: null,
                    'kip' => trim($cells[47] ?? '') ?: null,
                    'saldo_spp' => trim($cells[48] ?? '') ?: null,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                foreach (['SEKOLAH', 'KAMAR', 'PBS', 'DINIYAH', 'PBM'] as $kodeKegiatan) {
                    if (!isset($jenisKegiatan[$kodeKegiatan])) continue;
                    DB::table('santri_kegiatan_partisipasi')->updateOrInsert([
                        'santri_id' => $santriId,
                        'jenis_kegiatan_id' => $jenisKegiatan[$kodeKegiatan],
                    ], [
                        'status' => $kodeKegiatan === 'SEKOLAH' && $kelasFormalId ? 'terdaftar' : 'perlu_verifikasi',
                        'alasan' => $kodeKegiatan === 'SEKOLAH' && !$kelasFormalId ? 'Kelas formal belum dapat dibentuk dari Pend dan Kls' : null,
                        'updated_at' => now(), 'created_at' => now(),
                    ]);
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
        throw new \RuntimeException("Kode Pend tidak dikenal: {$pend}");
    }

    private function resolveKelasFormalId(int $unitId, string $kelas): ?int
    {
        $kelas = strtoupper(trim($kelas));
        if (!$kelas) return null;

        $tahunAjaran = '2026/2027';
        $existing = DB::table('kelas_formal')
            ->where('unit_id', $unitId)
            ->where('nama_kelas', $kelas)
            ->where('tahun_ajaran', $tahunAjaran)
            ->value('kelas_formal_id');
        if ($existing) return (int) $existing;

        preg_match('/^\d+/', $kelas, $matches);
        try {
            return DB::table('kelas_formal')->insertGetId([
                'unit_id' => $unitId,
                'tingkat' => $matches[0] ?? null,
                'nama_kelas' => $kelas,
                'tahun_ajaran' => $tahunAjaran,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Illuminate\Database\QueryException $exception) {
            $existing = DB::table('kelas_formal')
                ->where('unit_id', $unitId)
                ->where('nama_kelas', $kelas)
                ->where('tahun_ajaran', $tahunAjaran)
                ->value('kelas_formal_id');
            if ($existing) return (int) $existing;
            throw $exception;
        }
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
