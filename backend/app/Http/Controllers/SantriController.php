<?php

namespace App\Http\Controllers;

use App\Support\SantriAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SantriController extends Controller
{
    public function index(Request $request)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Keamanan', 'Pengasuh', 'Pembina Kamar'], true)) {
            return response()->json(['message' => 'Role Anda tidak dapat membuka direktori santri.'], 403);
        }

        $query = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->select(
                'santri.santri_id', 
                'santri.nama', 
                'santri.nis', 
                'santri.status_aktif',
                'kamar.nama as nama_kamar',
                'unit_pendidikan.nama as nama_unit'
            )
            ->where('santri.status_aktif', 1);

        if ($petugas->jabatan === 'Pembina Kamar') {
            SantriAccess::scopeAssigned($query, $petugas);
        }

        $search = $request->input('q') ?? $request->input('search');
        if (!empty($search)) {
            $query->where(function($w) use ($search) {
                $w->where('santri.nama', 'like', "%{$search}%")
                  ->orWhere('santri.nis', 'like', "%{$search}%");
            });
        }

        if ($request->has('kamar_id')) {
            $query->where('santri.kamar_id', $request->kamar_id);
        }
        if ($request->has('kelas_formal_id')) {
            $query->where('santri.kelas_formal_id', $request->kelas_formal_id);
        }
        if ($request->has('kelompok_pbs_id')) {
            $query->where('santri.kelompok_pbs_id', $request->kelompok_pbs_id);
        }
        if ($request->has('kelompok_pbm_id')) {
            $query->where('santri.kelompok_pbm_id', $request->kelompok_pbm_id);
        }
        if ($request->has('kelompok_madin_id')) {
            $query->where('santri.kelompok_madin_id', $request->kelompok_madin_id);
        }

        $query->orderBy('santri.nama', 'asc');

        if ($request->has('q')) {
            $query->limit(20); // limit for typeahead performance
        }

        return response()->json($query->get());
    }
}
