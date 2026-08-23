<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureSantriPasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $santri = Auth::guard('wali')->user();

        if (config('auth.force_password_change') && $santri?->wajib_ganti_password) {
            return response()->json([
                'message' => 'Anda wajib mengganti kata sandi sebelum mengakses portal.',
                'code' => 'PASSWORD_CHANGE_REQUIRED',
            ], 423);
        }

        return $next($request);
    }
}
