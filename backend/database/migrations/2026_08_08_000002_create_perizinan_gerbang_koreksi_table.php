<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('perizinan_gerbang_koreksi', function (Blueprint $table) {
            $table->id('koreksi_id');
            $table->unsignedBigInteger('perizinan_id');
            $table->dateTime('waktu_keluar_sebelum')->nullable();
            $table->dateTime('waktu_masuk_sebelum')->nullable();
            $table->dateTime('waktu_keluar_sesudah')->nullable();
            $table->dateTime('waktu_masuk_sesudah')->nullable();
            $table->string('status_sebelum', 32);
            $table->string('status_sesudah', 32);
            $table->unsignedInteger('dikoreksi_oleh');
            $table->string('alasan_koreksi', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('perizinan_id')->references('perizinan_id')->on('perizinan')->cascadeOnDelete();
            $table->foreign('dikoreksi_oleh')->references('petugas_id')->on('petugas');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('perizinan_gerbang_koreksi');
    }
};
