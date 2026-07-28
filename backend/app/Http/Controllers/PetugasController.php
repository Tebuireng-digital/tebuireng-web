<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PetugasController extends Controller
{
    public function resetPassword(Request $request, $id)
    {
        // Admin only
        $admin = $request->user();
        if ($admin->jabatan !== 'Admin') {
            return response()->json(['message' => 'Hanya Admin yang dapat mereset kata sandi'], 403);
        }

        $petugas = DB::table('petugas')->where('petugas_id', $id)->first();
        if (!$petugas) {
            return response()->json(['message' => 'Petugas tidak ditemukan'], 404);
        }

        // Generate random password
        $newPassword = Str::random(8);

        DB::table('petugas')->where('petugas_id', $id)->update([
            'password_hash' => Hash::make($newPassword),
            'wajib_ganti_password' => true,
        ]);

        return response()->json([
            'message' => 'Kata sandi berhasil direset',
            'new_password' => $newPassword,
            'note' => 'Simpan kata sandi ini sekarang, tidak akan ditampilkan lagi.'
        ]);
    }
}
