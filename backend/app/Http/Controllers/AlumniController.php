<?php

namespace App\Http\Controllers;

use App\Models\Alumni;
use Illuminate\Http\Request;

class AlumniController extends Controller
{
    /**
     * GET /api/master/alumni
     * Returns all alumni with optional search & filter params.
     */
    public function index(Request $request)
    {
        $query = Alumni::query();

        // Search by nama, no_id_induk, orang_tua
        if ($q = $request->input('q')) {
            $query->where(function ($sub) use ($q) {
                $sub->where('nama', 'like', "%{$q}%")
                    ->orWhere('no_id_induk', 'like', "%{$q}%")
                    ->orWhere('orang_tua', 'like', "%{$q}%");
            });
        }

        // Filter by jenjang
        if ($jenjang = $request->input('jenjang')) {
            $query->where('jenjang', $jenjang);
        }

        // Filter by jenis kelamin
        if ($jk = $request->input('jenis_kelamin')) {
            $query->where('jenis_kelamin', $jk);
        }

        // Filter by angkatan
        if ($angkatan = $request->input('angkatan')) {
            $query->where('angkatan', $angkatan);
        }

        // Filter by tahun_lulus
        if ($tahunLulus = $request->input('tahun_lulus')) {
            $query->where('tahun_lulus', $tahunLulus);
        }

        $query->orderBy('nama', 'asc');

        return response()->json($query->get());
    }

    /**
     * GET /api/master/alumni/stats
     * Returns summary statistics for the alumni dashboard.
     */
    public function stats()
    {
        $total = Alumni::count();
        $byJenjang = Alumni::selectRaw('jenjang, COUNT(*) as jumlah')
            ->whereNotNull('jenjang')
            ->where('jenjang', '!=', '')
            ->groupBy('jenjang')
            ->orderByDesc('jumlah')
            ->get();
        $byJk = Alumni::selectRaw('jenis_kelamin, COUNT(*) as jumlah')
            ->whereNotNull('jenis_kelamin')
            ->where('jenis_kelamin', '!=', '')
            ->groupBy('jenis_kelamin')
            ->get();

        return response()->json([
            'total' => $total,
            'by_jenjang' => $byJenjang,
            'by_jenis_kelamin' => $byJk,
        ]);
    }
}
