<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('auth.force_password_change') && $request->user()?->wajib_ganti_password) {
            return response()->json([
                'message' => 'Anda wajib mengganti kata sandi sebelum mengakses fitur lain.',
                'code' => 'PASSWORD_CHANGE_REQUIRED',
            ], 423);
        }

        return $next($request);
    }
}
