<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MasterController extends Controller
{
    public function getPetugas()
    {
        return response()->json(DB::table('petugas')->get());
    }

    public function getKamar()
    {
        return response()->json(DB::table('kamar')->get());
    }

    public function getSantri()
    {
        return response()->json(DB::table('santri')->get());
    }
}
