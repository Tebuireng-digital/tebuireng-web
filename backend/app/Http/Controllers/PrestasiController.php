<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Prestasi;

class PrestasiController extends Controller
{
    /**
     * Sanitasi string input: menghapus HTML/script tag, kontrol karakter, dan normalisasi spasi.
     */
    private function sanitizeInput(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        // Hapus script dan style block beserta isinya
        $clean = preg_replace('/<script\b[^>]*>(.*?)<\/script>/is', '', $value);
        $clean = preg_replace('/<style\b[^>]*>(.*?)<\/style>/is', '', $clean);
        // Hapus sisa tag HTML untuk mencegah stored XSS
        $clean = strip_tags($clean);
        // Hapus karakter null byte
        $clean = str_replace(chr(0), '', $clean);
        // Normalisasi multiple whitespace
        $clean = trim(preg_replace('/\s+/u', ' ', $clean));

        return $clean === '' ? null : $clean;
    }

    public function index(Request $request)
    {
        $query = DB::table('prestasi')
            ->join('santri', 'prestasi.santri_id', '=', 'santri.santri_id')
            ->select('prestasi.*', 'santri.nama as nama_santri', 'santri.nis');

        if ($request->filled('santri_id')) {
            $santriId = filter_var($request->santri_id, FILTER_VALIDATE_INT);
            if ($santriId) {
                $query->where('prestasi.santri_id', $santriId);
            }
        }

        if ($request->filled('search')) {
            $cleanSearch = substr(trim(strip_tags($request->search)), 0, 100);
            if ($cleanSearch !== '') {
                $searchWildcard = '%' . $cleanSearch . '%';
                $query->where(function ($q) use ($searchWildcard) {
                    $q->where('santri.nama', 'like', $searchWildcard)
                      ->orWhere('prestasi.nama_prestasi', 'like', $searchWildcard)
                      ->orWhere('prestasi.peringkat', 'like', $searchWildcard)
                      ->orWhere('prestasi.tingkat', 'like', $searchWildcard)
                      ->orWhere('prestasi.keterangan', 'like', $searchWildcard);
                });
            }
        }

        if ($request->filled('dari_tanggal')) {
            $query->whereDate('prestasi.tanggal', '>=', $request->dari_tanggal);
        }

        if ($request->filled('sampai_tanggal')) {
            $query->whereDate('prestasi.tanggal', '<=', $request->sampai_tanggal);
        }

        $records = $query->orderBy('prestasi.tanggal', 'desc')
            ->orderBy('prestasi.prestasi_id', 'desc')
            ->get();

        return response()->json($records);
    }

    public function store(Request $request)
    {
        $petugas = $request->user();

        $validated = $request->validate([
            'santri_id' => 'required|integer|exists:santri,santri_id',
            'nama_prestasi' => 'required|string|min:3|max:255',
            'peringkat' => 'nullable|string|max:100',
            'tingkat' => 'nullable|string|max:100',
            'tanggal' => 'required|date_format:Y-m-d|before_or_equal:today|after:2000-01-01',
            'keterangan' => 'nullable|string|max:2000',
        ], [
            'santri_id.required' => 'Pilih santri penerima prestasi.',
            'santri_id.exists' => 'Data santri yang dipilih tidak valid di sistem.',
            'nama_prestasi.required' => 'Nama atau judul prestasi wajib diisi.',
            'nama_prestasi.min' => 'Nama prestasi minimal 3 karakter.',
            'nama_prestasi.max' => 'Nama prestasi maksimal 255 karakter.',
            'tanggal.required' => 'Tanggal kejadian atau perlombaan wajib diisi.',
            'tanggal.date_format' => 'Format tanggal harus YYYY-MM-DD.',
            'tanggal.before_or_equal' => 'Tanggal prestasi tidak boleh di masa depan.',
            'tanggal.after' => 'Tanggal prestasi harus setelah tahun 2000.',
            'keterangan.max' => 'Keterangan tambahan maksimal 2000 karakter.',
        ]);

        $cleanNamaPrestasi = $this->sanitizeInput($validated['nama_prestasi']);
        if (!$cleanNamaPrestasi) {
            return response()->json([
                'message' => 'Nama / judul prestasi tidak boleh kosong atau hanya berisi tag HTML.',
                'errors' => ['nama_prestasi' => ['Nama prestasi tidak valid.']],
            ], 422);
        }

        $cleanPeringkat = $this->sanitizeInput($validated['peringkat'] ?? null);
        $cleanTingkat = $this->sanitizeInput($validated['tingkat'] ?? null);
        $cleanKeterangan = $this->sanitizeInput($validated['keterangan'] ?? null);

        $id = DB::table('prestasi')->insertGetId([
            'santri_id' => (int) $validated['santri_id'],
            'nama_prestasi' => $cleanNamaPrestasi,
            'peringkat' => $cleanPeringkat,
            'tingkat' => $cleanTingkat,
            'tanggal' => $validated['tanggal'],
            'keterangan' => $cleanKeterangan,
            'petugas_pencatat_id' => $petugas->petugas_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $record = DB::table('prestasi')
            ->join('santri', 'prestasi.santri_id', '=', 'santri.santri_id')
            ->select('prestasi.*', 'santri.nama as nama_santri', 'santri.nis')
            ->where('prestasi.prestasi_id', $id)
            ->first();

        return response()->json([
            'message' => 'Data prestasi berhasil disimpan.',
            'data' => $record,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        if (!is_numeric($id)) {
            return response()->json(['message' => 'ID prestasi tidak valid.'], 400);
        }

        $existing = DB::table('prestasi')->where('prestasi_id', (int) $id)->first();
        if (!$existing) {
            return response()->json(['message' => 'Data prestasi tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'santri_id' => 'required|integer|exists:santri,santri_id',
            'nama_prestasi' => 'required|string|min:3|max:255',
            'peringkat' => 'nullable|string|max:100',
            'tingkat' => 'nullable|string|max:100',
            'tanggal' => 'required|date_format:Y-m-d|before_or_equal:today|after:2000-01-01',
            'keterangan' => 'nullable|string|max:2000',
        ], [
            'santri_id.required' => 'Pilih santri penerima prestasi.',
            'santri_id.exists' => 'Data santri yang dipilih tidak valid di sistem.',
            'nama_prestasi.required' => 'Nama atau judul prestasi wajib diisi.',
            'nama_prestasi.min' => 'Nama prestasi minimal 3 karakter.',
            'nama_prestasi.max' => 'Nama prestasi maksimal 255 karakter.',
            'tanggal.required' => 'Tanggal kejadian atau perlombaan wajib diisi.',
            'tanggal.date_format' => 'Format tanggal harus YYYY-MM-DD.',
            'tanggal.before_or_equal' => 'Tanggal prestasi tidak boleh di masa depan.',
            'tanggal.after' => 'Tanggal prestasi harus setelah tahun 2000.',
            'keterangan.max' => 'Keterangan tambahan maksimal 2000 karakter.',
        ]);

        $cleanNamaPrestasi = $this->sanitizeInput($validated['nama_prestasi']);
        if (!$cleanNamaPrestasi) {
            return response()->json([
                'message' => 'Nama / judul prestasi tidak boleh kosong atau hanya berisi tag HTML.',
                'errors' => ['nama_prestasi' => ['Nama prestasi tidak valid.']],
            ], 422);
        }

        DB::table('prestasi')->where('prestasi_id', (int) $id)->update([
            'santri_id' => (int) $validated['santri_id'],
            'nama_prestasi' => $cleanNamaPrestasi,
            'peringkat' => $this->sanitizeInput($validated['peringkat'] ?? null),
            'tingkat' => $this->sanitizeInput($validated['tingkat'] ?? null),
            'tanggal' => $validated['tanggal'],
            'keterangan' => $this->sanitizeInput($validated['keterangan'] ?? null),
            'updated_at' => now(),
        ]);

        $record = DB::table('prestasi')
            ->join('santri', 'prestasi.santri_id', '=', 'santri.santri_id')
            ->select('prestasi.*', 'santri.nama as nama_santri', 'santri.nis')
            ->where('prestasi.prestasi_id', (int) $id)
            ->first();

        return response()->json([
            'message' => 'Data prestasi berhasil diperbarui.',
            'data' => $record,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        if (!is_numeric($id)) {
            return response()->json(['message' => 'ID prestasi tidak valid.'], 400);
        }

        $deleted = DB::table('prestasi')->where('prestasi_id', (int) $id)->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Data prestasi tidak ditemukan.'], 404);
        }

        return response()->json(['message' => 'Data prestasi berhasil dihapus.']);
    }
}
