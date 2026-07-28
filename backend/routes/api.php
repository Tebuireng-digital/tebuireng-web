<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Temporarily removed auth:sanctum for frontend testing
Route::group([], function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/ganti-password', [AuthController::class, 'changePassword']);
    Route::get('/me', [AuthController::class, 'me']);
    
    Route::get('/absensi', [\App\Http\Controllers\AbsensiController::class, 'index']);
    Route::post('/absensi/{jenis}/bulk', [\App\Http\Controllers\AbsensiController::class, 'bulkUpsert'])->middleware('throttle:bulk-input');
    Route::patch('/absensi/{id}', [\App\Http\Controllers\AbsensiController::class, 'update']);

    Route::get('/pelanggaran', [\App\Http\Controllers\PelanggaranController::class, 'index']);
    Route::post('/pelanggaran', [\App\Http\Controllers\PelanggaranController::class, 'store']);
    Route::post('/pelanggaran/{id}/lampiran', [\App\Http\Controllers\PelanggaranController::class, 'uploadLampiran']);
    Route::get('/santri/{id}/poin', [\App\Http\Controllers\PelanggaranController::class, 'getPoin']);

    Route::get('/perizinan', [\App\Http\Controllers\PerizinanController::class, 'index']);
    Route::post('/perizinan', [\App\Http\Controllers\PerizinanController::class, 'store']);
    Route::patch('/perizinan/{id}/approval/{tahap}', [\App\Http\Controllers\PerizinanController::class, 'approve']);
    Route::patch('/perizinan/{id}/gerbang', [\App\Http\Controllers\PerizinanController::class, 'gerbang']);

    // Laporan
    Route::get('/laporan/kehadiran', [\App\Http\Controllers\LaporanController::class, 'kehadiran']);
    Route::get('/laporan/pelanggaran', [\App\Http\Controllers\LaporanController::class, 'pelanggaran']);
    Route::get('/laporan/perizinan', [\App\Http\Controllers\LaporanController::class, 'perizinan']);
    Route::get('/laporan/bulanan', [\App\Http\Controllers\LaporanController::class, 'bulanan']);

    // Pelanggaran
    Route::get('/santri/{id}/perizinan', [\App\Http\Controllers\PerizinanController::class, 'getSantriPerizinan']);
    Route::get('/santri', [\App\Http\Controllers\SantriController::class, 'index']);

    // Admin & Master
    Route::post('/petugas/{id}/reset-password', [\App\Http\Controllers\PetugasController::class, 'resetPassword']);
    Route::get('/master/petugas', [\App\Http\Controllers\MasterController::class, 'getPetugas']);
    Route::get('/master/kamar', [\App\Http\Controllers\MasterController::class, 'getKamar']);
    Route::get('/master/santri', [\App\Http\Controllers\MasterController::class, 'getSantri']);
});
