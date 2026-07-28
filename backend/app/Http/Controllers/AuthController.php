<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        \Illuminate\Support\Facades\Log::info('Login attempt', ['credentials' => $credentials]);

        // Attempt login using the web guard
        if (Auth::guard('web')->attempt($credentials)) {
            $request->session()->regenerate();
            
            return response()->json([
                'message' => 'Logged in successfully',
                'user' => Auth::user(),
            ]);
        }

        return response()->json([
            'message' => 'The provided credentials do not match our records.'
        ], 401);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $penugasan = DB::table('petugas_penugasan')
            ->where('petugas_id', $user->petugas_id)
            ->where(function($q) {
                $q->whereNull('tanggal_selesai')
                  ->orWhere('tanggal_selesai', '>=', now()->toDateString());
            })
            ->get();

        return response()->json([
            'user' => $user,
            'penugasan' => $penugasan
        ]);
    }

    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'old_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:6', 'different:old_password'],
        ]);

        $user = $request->user();

        if (!\Illuminate\Support\Facades\Hash::check($data['old_password'], $user->password_hash)) {
            return response()->json(['message' => 'Kata sandi lama tidak sesuai'], 400);
        }

        DB::table('petugas')->where('petugas_id', $user->petugas_id)->update([
            'password_hash' => \Illuminate\Support\Facades\Hash::make($data['new_password']),
            'wajib_ganti_password' => false,
        ]);

        return response()->json(['message' => 'Kata sandi berhasil diubah']);
    }
}
