<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SantriController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->select(
                'santri.santri_id', 
                'santri.nama', 
                'santri.nis', 
                'santri.status_aktif',
                'santri.nama_wali',
                'santri.no_hp_wali',
                'kamar.nama as nama_kamar',
                'unit_pendidikan.nama as nama_unit'
            )
            ->where('santri.status_aktif', 1);

        if ($request->has('q')) {
            $q = $request->q;
            $query->where(function($w) use ($q) {
                $w->where('santri.nama', 'like', "%{$q}%")
                  ->orWhere('santri.nis', 'like', "%{$q}%");
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
