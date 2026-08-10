<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrganisasiDaerahController extends Controller
{
    /**
     * List semua Organisasi Daerah beserta jumlah santri terdaftar.
     */
    public function index(Request $request)
    {
        $rows = DB::table('organisasi_daerah')
            ->leftJoin('santri', 'organisasi_daerah.organisasi_daerah_id', '=', 'santri.organisasi_daerah_id')
            ->select(
                'organisasi_daerah.*',
                DB::raw('COUNT(santri.santri_id) as total_santri')
            )
            ->groupBy('organisasi_daerah.organisasi_daerah_id')
            ->orderBy('organisasi_daerah.kode_singkat')
            ->get();

        return response()->json($rows);
    }

    /**
     * Tambah / edit data Organisasi Daerah.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'organisasi_daerah_id' => 'nullable|integer',
            'kode_singkat' => 'required|string|max:30',
            'nama_organisasi' => 'required|string|max:150',
            'deskripsi_wilayah' => 'nullable|string|max:255',
            'status_aktif' => 'nullable|boolean',
        ]);

        $kode = strtoupper(trim($data['kode_singkat']));
        $nama = trim($data['nama_organisasi']);
        $deskripsi = isset($data['deskripsi_wilayah']) ? trim($data['deskripsi_wilayah']) : null;
        $status = $data['status_aktif'] ?? 1;

        if (!empty($data['organisasi_daerah_id'])) {
            // Check unique constraint except current id
            $exists = DB::table('organisasi_daerah')
                ->where('kode_singkat', $kode)
                ->where('organisasi_daerah_id', '!=', $data['organisasi_daerah_id'])
                ->exists();
            if ($exists) {
                return response()->json(['message' => "Kode singkat '{$kode}' sudah digunakan"], 422);
            }

            DB::table('organisasi_daerah')
                ->where('organisasi_daerah_id', $data['organisasi_daerah_id'])
                ->update([
                    'kode_singkat' => $kode,
                    'nama_organisasi' => $nama,
                    'deskripsi_wilayah' => $deskripsi,
                    'status_aktif' => $status,
                    'updated_at' => now(),
                ]);

            return response()->json(['message' => 'Organisasi daerah berhasil diperbarui']);
        } else {
            $exists = DB::table('organisasi_daerah')
                ->where('kode_singkat', $kode)
                ->exists();
            if ($exists) {
                return response()->json(['message' => "Kode singkat '{$kode}' sudah digunakan"], 422);
            }

            $id = DB::table('organisasi_daerah')->insertGetId([
                'kode_singkat' => $kode,
                'nama_organisasi' => $nama,
                'deskripsi_wilayah' => $deskripsi,
                'status_aktif' => $status,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'message' => 'Organisasi daerah baru berhasil ditambahkan',
                'organisasi_daerah_id' => $id,
            ], 201);
        }
    }

    /**
     * Bulk update organisasi_daerah_id untuk banyak santri sekaligus.
     */
    public function bulkUpdateSantri(Request $request)
    {
        $data = $request->validate([
            'organisasi_daerah_id' => 'nullable|integer',
            'santri_ids' => 'required|array|min:1',
            'santri_ids.*' => 'integer|exists:santri,santri_id',
        ]);

        $ordaId = $data['organisasi_daerah_id'] ?: null;

        if ($ordaId) {
            $ordaExists = DB::table('organisasi_daerah')->where('organisasi_daerah_id', $ordaId)->exists();
            if (!$ordaExists) {
                return response()->json(['message' => 'Organisasi daerah tidak ditemukan'], 404);
            }
        }

        $updatedCount = DB::table('santri')
            ->whereIn('santri_id', $data['santri_ids'])
            ->update([
                'organisasi_daerah_id' => $ordaId,
                'updated_at' => now(),
            ]);

        return response()->json([
            'message' => "Organisasi daerah berhasil diperbarui untuk {$updatedCount} santri",
            'jumlah_santri' => $updatedCount,
        ]);
    }
}
