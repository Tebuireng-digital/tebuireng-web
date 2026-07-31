<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenSpout\Reader\XLSX\Reader;

class ImportReviewController extends Controller
{
    private const SOURCE_FILES = [
        'Database Siswa' => ['file' => 'Database_Siswa_Kelas_7_8_9_2026_2027.xlsx', 'sheet' => 'Database Siswa', 'name' => 2, 'room' => null],
        'Database Siswa Madin' => ['file' => 'Database_Kelas_Madin_2026_2027.xlsx', 'sheet' => 'Database Siswa Madin', 'name' => 1, 'room' => 2],
        "Database Al-Qur'an" => ['file' => 'Database_Kelompok_AlQuran (belajar habis subuh)_2026_2027.xlsx', 'sheet' => "Database Al-Qur'an", 'name' => 1, 'room' => 2],
        'Database Takhassus' => ['file' => 'Database_Takhassus (belajar habis maghrib)_2026_2027.xlsx', 'sheet' => 'Database Takhassus', 'name' => 1, 'room' => 2],
    ];

    /** Menyalin daftar 971 baris review dan mapping CSV lama ke tabel yang dapat dikelola Admin. */
    public function sync(Request $request)
    {
        $this->syncMappingsFromCsv();
        $rows = $this->readReviewRows();
        $sourceRows = $this->sourceRowLookup();
        $canonical = DB::table('santri')
            ->where(function ($query) {
                $query->whereNull('catatan_import')
                    ->orWhere('catatan_import', 'not like', 'Baru otomatis%');
            })
            ->select('santri_id', 'nama')
            ->get();

        $created = 0;
        foreach ($rows as $row) {
            $key = $this->lookupKey($row['nama_sumber'], $row['kode_kamar_sumber']);
            $sourceRow = array_shift($sourceRows[$row['sumber_sheet']][$key]);
            $sourceRowNumber = $sourceRow['baris'] ?? $row['baris_review'];

            $auto = DB::table('santri')
                ->where('nama', $row['nama_sumber'])
                ->where('catatan_import', 'like', 'Baru otomatis dari '.$row['sumber_sheet'].'%')
                ->orderBy('santri_id')
                ->first();

            [$candidateId, $score] = $this->bestCandidate($row['nama_sumber'], $canonical);
            $hasMapping = !$row['kode_kamar_sumber'] || DB::table('kamar_kode_mappings')
                ->where('kode_sumber', $row['kode_kamar_sumber'])->exists();
            $status = ($row['kode_kamar_sumber'] && !$hasMapping && (!$auto || !$auto->kamar_id))
                ? 'perlu_mapping_kamar'
                : 'perlu_tinjau';

            $existing = DB::table('santri_import_reviews')
                ->where('sumber_sheet', $row['sumber_sheet'])
                ->where('baris_sumber', $sourceRowNumber)
                ->first();
            $payload = [
                'nama_sumber' => $row['nama_sumber'],
                'kode_kamar_sumber' => $row['kode_kamar_sumber'] ?: null,
                'data_tambahan' => $row['data_tambahan'] ?: null,
                'santri_otomatis_id' => $auto?->santri_id,
                'kandidat_santri_id' => $candidateId,
                'skor_kemiripan' => $score,
                'updated_at' => now(),
            ];

            if ($existing) {
                // Keputusan Admin bersifat final; sinkronisasi hanya menyegarkan data sumbernya.
                if (in_array($existing->status, ['perlu_tinjau', 'perlu_mapping_kamar'], true)) {
                    $payload['status'] = $status;
                }
                DB::table('santri_import_reviews')->where('review_id', $existing->review_id)->update($payload);
            } else {
                DB::table('santri_import_reviews')->insert($payload + [
                    'sumber_sheet' => $row['sumber_sheet'],
                    'baris_sumber' => $sourceRowNumber,
                    'status' => $status,
                    'created_at' => now(),
                ]);
                $created++;
            }
        }

        return response()->json([
            'message' => 'Review impor berhasil disinkronkan.',
            'total_sumber' => count($rows),
            'baru_ditambahkan' => $created,
        ]);
    }

    public function index(Request $request)
    {
        $status = $request->query('status');
        $query = DB::table('santri_import_reviews as r')
            ->leftJoin('santri as otomatis', 'r.santri_otomatis_id', '=', 'otomatis.santri_id')
            ->leftJoin('kamar as kamar_otomatis', 'otomatis.kamar_id', '=', 'kamar_otomatis.kamar_id')
            ->leftJoin('santri as kandidat', 'r.kandidat_santri_id', '=', 'kandidat.santri_id')
            ->leftJoin('kamar as kamar_kandidat', 'kandidat.kamar_id', '=', 'kamar_kandidat.kamar_id')
            ->select(
                'r.*',
                'otomatis.nama as nama_santri_otomatis', 'kamar_otomatis.nama as kamar_santri_otomatis',
                'kandidat.nama as nama_kandidat', 'kamar_kandidat.nama as kamar_kandidat'
            )
            ->orderByRaw("FIELD(r.status, 'perlu_tinjau', 'perlu_mapping_kamar', 'terpisah', 'digabung')")
            ->orderByDesc('r.skor_kemiripan')
            ->orderBy('r.sumber_sheet')->orderBy('r.baris_sumber');
        if ($status && in_array($status, ['perlu_tinjau', 'perlu_mapping_kamar', 'terpisah', 'digabung'], true)) {
            $query->where('r.status', $status);
        }

        return response()->json($query->get());
    }

    public function markSeparate(Request $request, int $id)
    {
        $review = DB::table('santri_import_reviews')->where('review_id', $id)->first();
        if (!$review) return response()->json(['message' => 'Review tidak ditemukan.'], 404);

        DB::table('santri_import_reviews')->where('review_id', $id)->update([
            'status' => 'terpisah',
            'diputuskan_oleh' => $request->user()->petugas_id,
            'diputuskan_pada' => now(),
            'catatan_keputusan' => $request->input('catatan'),
            'updated_at' => now(),
        ]);
        return response()->json(['message' => 'Santri ditandai sebagai dua orang yang berbeda.']);
    }

    public function merge(Request $request, int $id)
    {
        $data = $request->validate(['kandidat_santri_id' => 'nullable|integer|exists:santri,santri_id']);
        $review = DB::table('santri_import_reviews')->where('review_id', $id)->first();
        if (!$review || !$review->santri_otomatis_id) return response()->json(['message' => 'Santri otomatis untuk review ini tidak ditemukan.'], 422);
        $targetId = $data['kandidat_santri_id'] ?? $review->kandidat_santri_id;
        if (!$targetId || (int) $targetId === (int) $review->santri_otomatis_id) {
            return response()->json(['message' => 'Pilih kandidat santri yang berbeda untuk digabungkan.'], 422);
        }

        try {
            DB::transaction(function () use ($review, $targetId, $request) {
                $source = DB::table('santri')->lockForUpdate()->where('santri_id', $review->santri_otomatis_id)->first();
                $target = DB::table('santri')->lockForUpdate()->where('santri_id', $targetId)->first();
                if (!$source || !$target) throw new \RuntimeException('Data santri tidak lagi tersedia.');

                $conflict = DB::table('absensi as source')
                    ->join('absensi as target', function ($join) use ($source, $target) {
                        $join->on('source.jenis_kegiatan_id', '=', 'target.jenis_kegiatan_id')
                            ->on('source.jadwal_id', '=', 'target.jadwal_id')
                            ->on('source.tanggal', '=', 'target.tanggal')
                            ->where('source.santri_id', $source->santri_id)
                            ->where('target.santri_id', $target->santri_id);
                    })->exists();
                if ($conflict) throw new \RuntimeException('Tidak dapat digabung: kedua data sudah memiliki absensi pada sesi yang sama.');

                $fillable = ['nis', 'unit_id', 'kamar_id', 'kelas_formal_id', 'kelompok_madin_id', 'kelompok_pbs_id', 'kelompok_pbm_id', 'nama_wali', 'no_hp_wali'];
                $enrichment = [];
                foreach ($fillable as $field) {
                    if (empty($target->$field) && !empty($source->$field)) $enrichment[$field] = $source->$field;
                }
                if ($enrichment) DB::table('santri')->where('santri_id', $target->santri_id)->update($enrichment);
                DB::table('absensi')->where('santri_id', $source->santri_id)->update(['santri_id' => $target->santri_id]);
                DB::table('pelanggaran')->where('santri_id', $source->santri_id)->update(['santri_id' => $target->santri_id]);
                DB::table('perizinan')->where('santri_id', $source->santri_id)->update(['santri_id' => $target->santri_id]);
                DB::table('santri_import_reviews')->where('santri_otomatis_id', $source->santri_id)->update([
                    'kandidat_santri_id' => $target->santri_id,
                    'santri_otomatis_id' => null,
                    'status' => 'digabung',
                    'diputuskan_oleh' => $request->user()->petugas_id,
                    'diputuskan_pada' => now(),
                    'updated_at' => now(),
                ]);
                DB::table('santri')->where('santri_id', $source->santri_id)->delete();
            });
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['message' => 'Data santri berhasil digabung. Data induk dipertahankan dan data kelas/kelompok yang kosong telah dilengkapi.']);
    }

    public function mappings()
    {
        $mappings = DB::table('kamar_kode_mappings as m')
            ->join('kamar as k', 'm.kamar_id', '=', 'k.kamar_id')
            ->select('m.mapping_id', 'm.kode_sumber', 'm.kamar_id', 'k.nama as nama_kamar')
            ->get()->keyBy('kode_sumber');
        $codes = DB::table('santri_import_reviews')
            ->whereNotNull('kode_kamar_sumber')->where('kode_kamar_sumber', '!=', '')
            ->select('kode_kamar_sumber', DB::raw('COUNT(*) as jumlah_review'))
            ->groupBy('kode_kamar_sumber')->orderBy('kode_kamar_sumber')->get();

        return response()->json($codes->map(function ($code) use ($mappings) {
            $mapping = $mappings->get($code->kode_kamar_sumber);
            return [
                'kode_sumber' => $code->kode_kamar_sumber,
                'jumlah_review' => $code->jumlah_review,
                'kamar_id' => $mapping->kamar_id ?? null,
                'nama_kamar' => $mapping->nama_kamar ?? null,
            ];
        })->values());
    }

    public function saveMapping(Request $request)
    {
        $data = $request->validate([
            'kode_sumber' => 'required|string|max:100',
            'kamar_id' => 'required|integer|exists:kamar,kamar_id',
        ]);
        $code = strtoupper(trim($data['kode_sumber']));
        DB::table('kamar_kode_mappings')->updateOrInsert(['kode_sumber' => $code], [
            'kamar_id' => $data['kamar_id'], 'updated_at' => now(), 'created_at' => now(),
        ]);
        $santriIds = DB::table('santri_import_reviews')->where('kode_kamar_sumber', $code)
            ->whereNotNull('santri_otomatis_id')->pluck('santri_otomatis_id')->unique();
        $updated = DB::table('santri')->whereIn('santri_id', $santriIds)->whereNull('kamar_id')
            ->update(['kamar_id' => $data['kamar_id']]);
        DB::table('santri_import_reviews')->where('kode_kamar_sumber', $code)
            ->where('status', 'perlu_mapping_kamar')->update(['status' => 'perlu_tinjau', 'updated_at' => now()]);

        return response()->json(['message' => 'Mapping kamar disimpan.', 'santri_diperbarui' => $updated]);
    }

    private function readReviewRows(): array
    {
        $path = storage_path('app/santri-review-baru.xlsx');
        if (!file_exists($path)) return [];
        $reader = new Reader(); $reader->open($path); $rows = []; $number = 0;
        foreach ($reader->getSheetIterator() as $sheet) foreach ($sheet->getRowIterator() as $row) {
            $number++; if ($number === 1) continue;
            $cells = array_map(fn ($cell) => trim((string) $cell), $row->toArray());
            if (!($cells[0] ?? '') || !($cells[1] ?? '')) continue;
            $rows[] = ['sumber_sheet' => $cells[0], 'nama_sumber' => strtoupper($cells[1]), 'kode_kamar_sumber' => $this->normalizeRoomCode($cells[2] ?? ''), 'data_tambahan' => $cells[3] ?? '', 'baris_review' => $number];
        }
        $reader->close(); return $rows;
    }

    private function sourceRowLookup(): array
    {
        $result = [];
        foreach (self::SOURCE_FILES as $source => $config) {
            $path = base_path('../xlsx/'.$config['file']);
            if (!file_exists($path)) continue;
            $reader = new Reader(); $reader->open($path); $number = 0;
            foreach ($reader->getSheetIterator() as $sheet) {
                if ($sheet->getName() !== $config['sheet']) continue;
                foreach ($sheet->getRowIterator() as $row) {
                    $number++; if ($number === 1) continue;
                    $cells = array_map(fn ($cell) => trim((string) $cell), $row->toArray());
                    $name = strtoupper($cells[$config['name']] ?? '');
                    if (!$name) continue;
                    $room = $config['room'] === null ? '' : $this->normalizeRoomCode($cells[$config['room']] ?? '');
                    $result[$source][$this->lookupKey($name, $room)][] = ['baris' => $number];
                }
            }
            $reader->close();
        }
        return $result;
    }

    private function bestCandidate(string $name, $candidates): array
    {
        $normalized = $this->normalize($name); $bestId = null; $bestScore = 0.0;
        foreach ($candidates as $candidate) {
            $other = $this->normalize($candidate->nama);
            if (!$other) continue;
            $distance = levenshtein($normalized, $other);
            $score = 100 * (1 - $distance / max(strlen($normalized), strlen($other), 1));
            if ($score > $bestScore) { $bestScore = $score; $bestId = $candidate->santri_id; }
        }
        return $bestScore >= 80 ? [$bestId, round($bestScore, 2)] : [null, round($bestScore, 2)];
    }

    private function normalize(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        return preg_replace('/[^A-Z0-9]/', '', strtoupper($ascii));
    }

    private function normalizeRoomCode(string $value): string
    {
        $value = strtoupper(trim($value));
        return preg_match('/^(\d+)\.0+$/', $value, $matches) ? $matches[1] : $value;
    }

    private function lookupKey(string $name, string $room): string { return strtoupper(trim($name)).'|'.strtoupper(trim($room)); }

    private function syncMappingsFromCsv(): void
    {
        $path = storage_path('app/mapping-kamar-draft.csv');
        if (!file_exists($path) || !($handle = fopen($path, 'r'))) return;
        while (($row = fgetcsv($handle, 1000, ',')) !== false) {
            if (($row[0] ?? '') === 'kode_singkat' || empty($row[0]) || empty($row[1])) continue;
            $roomId = DB::table('kamar')->where('nama', trim($row[1]))->value('kamar_id');
            if ($roomId) DB::table('kamar_kode_mappings')->updateOrInsert(['kode_sumber' => strtoupper(trim($row[0]))], ['kamar_id' => $roomId, 'updated_at' => now(), 'created_at' => now()]);
        }
        fclose($handle);
    }
}
