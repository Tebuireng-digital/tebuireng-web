<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class SantriPortalController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'nis' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $santri = \App\Models\Santri::where('nis', $credentials['nis'])->first();

        if ($santri && Hash::check($credentials['password'], $santri->password_hash)) {
            Auth::guard('santri')->login($santri);
            $request->session()->regenerate();
            
            return response()->json([
                'message' => 'Logged in successfully',
                'user' => $santri,
            ]);
        }

        return response()->json([
            'message' => 'NIS atau password yang Anda masukkan salah.'
        ], 401);
    }

    public function logout(Request $request)
    {
        Auth::guard('santri')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = Auth::guard('santri')->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        return response()->json(['user' => $user]);
    }

    public function kehadiran(Request $request)
    {
        $user = Auth::guard('santri')->user();
        $riwayat = DB::table('absensi')
            ->join('jenis_kegiatan', 'absensi.jenis_kegiatan_id', '=', 'jenis_kegiatan.jenis_kegiatan_id')
            ->where('absensi.santri_id', $user->santri_id)
            ->orderBy('absensi.tanggal', 'desc')
            ->select('absensi.*', 'jenis_kegiatan.nama_kegiatan')
            ->get();
        return response()->json($riwayat);
    }

    public function pelanggaran(Request $request)
    {
        $user = Auth::guard('santri')->user();
        $riwayat = DB::table('pelanggaran')
            ->join('kategori_pelanggaran', 'pelanggaran.kategori_pelanggaran_id', '=', 'kategori_pelanggaran.kategori_pelanggaran_id')
            ->where('pelanggaran.santri_id', $user->santri_id)
            ->orderBy('pelanggaran.tanggal', 'desc')
            ->select('pelanggaran.*', 'kategori_pelanggaran.kategori', 'kategori_pelanggaran.uraian_pelanggaran', 'kategori_pelanggaran.poin_maks')
            ->get();
        return response()->json($riwayat);
    }

    public function perizinan(Request $request)
    {
        $user = Auth::guard('santri')->user();
        $riwayat = DB::table('perizinan')
            ->join('jenis_izin', 'perizinan.jenis_izin_id', '=', 'jenis_izin.jenis_izin_id')
            ->where('perizinan.santri_id', $user->santri_id)
            ->orderBy('perizinan.tanggal_mulai', 'desc')
            ->select('perizinan.*', 'jenis_izin.nama as jenis_izin_nama')
            ->get();
        return response()->json($riwayat);
    }
}
