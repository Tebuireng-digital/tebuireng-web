<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/ready', function () {
    try {
        DB::select('SELECT 1');

        if (!Schema::hasTable('migrations') || !Schema::hasTable('petugas')) {
            return response()->json(['status' => 'not_ready'], 503);
        }

        return response()->json(['status' => 'ready']);
    } catch (Throwable) {
        return response()->json(['status' => 'not_ready'], 503);
    }
});
