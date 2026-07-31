<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        if (!$request->hasSession()) {
            return response()->json([
                'message' => 'Sesi login tidak tersedia. Muat ulang aplikasi lalu coba kembali.',
                'code' => 'STATEFUL_REQUEST_REQUIRED',
            ], 419);
        }

        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        if (Auth::guard('web')->attempt([
            'username' => $credentials['username'],
            'password' => $credentials['password'],
            'status_aktif' => 1,
        ])) {
            $request->session()->regenerate();

            $user = $this->userForResponse(Auth::user());
            
            return response()->json([
                'message' => 'Logged in successfully',
                'user' => $user,
            ]);
        }

        return response()->json([
            'message' => 'Username atau password yang Anda masukkan salah.'
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
            'user' => $this->userForResponse($user),
            'penugasan' => $penugasan
        ]);
    }

    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'old_password' => ['required', 'string'],
            'new_password' => [
                'required',
                'string',
                'confirmed',
                'different:old_password',
                Password::min(12)->letters()->numbers(),
            ],
        ]);

        $user = $request->user();

        if (!Hash::check($data['old_password'], $user->password_hash)) {
            return response()->json(['message' => 'Kata sandi lama tidak sesuai'], 400);
        }

        DB::table('petugas')->where('petugas_id', $user->petugas_id)->update([
            'password_hash' => Hash::make($data['new_password']),
            'wajib_ganti_password' => false,
        ]);

        return response()->json(['message' => 'Kata sandi berhasil diubah']);
    }

    private function userForResponse($user)
    {
        if ($user && !config('auth.force_password_change')) {
            $user->setAttribute('wajib_ganti_password', false);
        }

        return $user;
    }
}
