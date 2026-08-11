<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Prestasi;

class PrestasiController extends Controller
{
    public function index(Request $request)
    {
        $petugas = $request->user();

        $query = DB::table('prestasi')
            ->join('santri', 'prestasi.santri_id', '=', 'santri.santri_id')
            ->select('prestasi.*', 'santri.nama as nama_santri', 'santri.nis');

        if ($request->filled('santri_id')) {
            $query->where('prestasi.santri_id', $request->santri_id);
        }

        if ($request->filled('search')) {
            $search = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('santri.nama', 'like', $search)
                  ->orWhere('prestasi.nama_prestasi', 'like', $search)
                  ->orWhere('prestasi.keterangan', 'like', $search);
            });
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
            'nama_prestasi' => 'required|string|max:255',
            'peringkat' => 'nullable|string|max:100',
            'tingkat' => 'nullable|string|max:100',
            'tanggal' => 'required|date',
            'keterangan' => 'nullable|string',
        ]);

        $id = DB::table('prestasi')->insertGetId([
            'santri_id' => $validated['santri_id'],
            'nama_prestasi' => $validated['nama_prestasi'],
            'peringkat' => $validated['peringkat'] ?? null,
            'tingkat' => $validated['tingkat'] ?? null,
            'tanggal' => $validated['tanggal'],
            'keterangan' => $validated['keterangan'] ?? null,
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

    public function destroy(Request $request, $id)
    {
        $deleted = DB::table('prestasi')->where('prestasi_id', $id)->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Data prestasi tidak ditemukan.'], 44);
        }

        return response()->json(['message' => 'Data prestasi berhasil dihapus.']);
    }
}
