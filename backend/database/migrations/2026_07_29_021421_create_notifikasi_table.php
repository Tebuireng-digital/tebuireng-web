<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('notifikasi', function (Blueprint $table) {
            $table->id('notifikasi_id');
            $table->unsignedInteger('petugas_id');
            $table->string('judul', 150);
            $table->string('pesan', 500);
            $table->string('tipe', 50)->nullable()->comment('mis. overdue_izin, ambang_poin, reminder_absensi');
            $table->string('referensi_tabel', 50)->nullable();
            $table->unsignedBigInteger('referensi_id')->nullable();
            $table->boolean('dibaca')->default(0);
            $table->timestamp('created_at')->useCurrent();

            $table->index(['petugas_id', 'dibaca'], 'idx_notifikasi_petugas');
            $table->foreign('petugas_id', 'fk_notifikasi_petugas')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('notifikasi');
    }
};
