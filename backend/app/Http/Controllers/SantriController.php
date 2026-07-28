<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SantriController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('santri')
            ->select('santri_id', 'nama', 'nis', 'status_aktif')
            ->where('status_aktif', 1);

        if ($request->has('kamar_id')) {
            $query->where('kamar_id', $request->kamar_id);
        }
        if ($request->has('kelas_formal_id')) {
            $query->where('kelas_formal_id', $request->kelas_formal_id);
        }
        if ($request->has('kelompok_pbs_id')) {
            $query->where('kelompok_pbs_id', $request->kelompok_pbs_id);
        }
        if ($request->has('kelompok_pbm_id')) {
            $query->where('kelompok_pbm_id', $request->kelompok_pbm_id);
        }
        if ($request->has('kelompok_madin_id')) {
            $query->where('kelompok_madin_id', $request->kelompok_madin_id);
        }

        $query->orderBy('nama', 'asc');

        return response()->json($query->get());
    }
}
