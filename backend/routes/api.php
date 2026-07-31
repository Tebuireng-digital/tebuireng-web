<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/ganti-password', [AuthController::class, 'changePassword']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::middleware('password.changed')->group(function () {
    
    Route::get('/absensi', [\App\Http\Controllers\AbsensiController::class, 'index']);
    Route::get('/absensi-options', [\App\Http\Controllers\AbsensiController::class, 'options']);
    Route::get('/absensi/{jenis}/session', [\App\Http\Controllers\AbsensiController::class, 'session']);
    Route::post('/absensi/{jenis}/bulk', [\App\Http\Controllers\AbsensiController::class, 'bulkUpsert'])->middleware('throttle:bulk-input');
    Route::patch('/absensi/{id}', [\App\Http\Controllers\AbsensiController::class, 'update']);

    Route::get('/pelanggaran', [\App\Http\Controllers\PelanggaranController::class, 'index']);
    Route::get('/pelanggaran/kategori', [\App\Http\Controllers\PelanggaranController::class, 'getKategori']);
    Route::post('/pelanggaran', [\App\Http\Controllers\PelanggaranController::class, 'store']);
    Route::post('/pelanggaran/{id}/lampiran', [\App\Http\Controllers\PelanggaranController::class, 'uploadLampiran']);
    Route::get('/santri/{id}/poin', [\App\Http\Controllers\PelanggaranController::class, 'getPoin']);

    Route::get('/perizinan', [\App\Http\Controllers\PerizinanController::class, 'index'])->middleware('role:Keamanan,Pengasuh');
    Route::get('/perizinan-jenis', [\App\Http\Controllers\PerizinanController::class, 'jenis'])->middleware('role:Keamanan');
    Route::post('/perizinan', [\App\Http\Controllers\PerizinanController::class, 'store'])->middleware('role:Keamanan');
    Route::patch('/perizinan/{id}/gerbang', [\App\Http\Controllers\PerizinanController::class, 'gerbang'])->middleware('role:Keamanan');

    // Laporan
    Route::get('/laporan/kehadiran', [\App\Http\Controllers\LaporanController::class, 'kehadiran'])->middleware('role:Pengasuh');
    Route::get('/laporan/pelanggaran', [\App\Http\Controllers\LaporanController::class, 'pelanggaran'])->middleware('role:Pengasuh');
    Route::get('/laporan/perizinan', [\App\Http\Controllers\LaporanController::class, 'perizinan'])->middleware('role:Pengasuh');
    Route::get('/laporan/bulanan', [\App\Http\Controllers\LaporanController::class, 'bulanan'])->middleware('role:Pengasuh');

    // Pelanggaran
    Route::get('/santri/{id}/perizinan', [\App\Http\Controllers\PerizinanController::class, 'getSantriPerizinan']);
    Route::get('/santri', [\App\Http\Controllers\SantriController::class, 'index']);

    // Admin & Master
    Route::post('/petugas/{id}/reset-password', [\App\Http\Controllers\PetugasController::class, 'resetPassword'])->middleware('role:Admin');
    Route::get('/master/petugas', [\App\Http\Controllers\MasterController::class, 'getPetugas'])->middleware('role:Admin');
    Route::get('/master/kamar', [\App\Http\Controllers\MasterController::class, 'getKamar'])->middleware('role:Admin');
    Route::post('/master/kamar', [\App\Http\Controllers\MasterController::class, 'storeKamar'])->middleware('role:Admin');
    Route::get('/master/santri', [\App\Http\Controllers\MasterController::class, 'getSantri'])->middleware('role:Admin');
    Route::get('/master/penugasan', [\App\Http\Controllers\MasterController::class, 'getPenugasan'])->middleware('role:Admin');
    Route::post('/master/penugasan', [\App\Http\Controllers\MasterController::class, 'storePenugasan'])->middleware('role:Admin');
    Route::delete('/master/penugasan/{id}', [\App\Http\Controllers\MasterController::class, 'deletePenugasan'])->middleware('role:Admin');
    Route::post('/master/import-reviews/sync', [\App\Http\Controllers\ImportReviewController::class, 'sync'])->middleware('role:Admin');
    Route::get('/master/import-reviews', [\App\Http\Controllers\ImportReviewController::class, 'index'])->middleware('role:Admin');
    Route::post('/master/import-reviews/{id}/merge', [\App\Http\Controllers\ImportReviewController::class, 'merge'])->middleware('role:Admin');
    Route::post('/master/import-reviews/{id}/separate', [\App\Http\Controllers\ImportReviewController::class, 'markSeparate'])->middleware('role:Admin');
    Route::get('/master/kamar-mappings', [\App\Http\Controllers\ImportReviewController::class, 'mappings'])->middleware('role:Admin');
    Route::post('/master/kamar-mappings', [\App\Http\Controllers\ImportReviewController::class, 'saveMapping'])->middleware('role:Admin');
    });
});
