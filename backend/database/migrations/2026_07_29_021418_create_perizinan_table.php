<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('perizinan', function (Blueprint $table) {
            $table->id('perizinan_id');
            $table->unsignedInteger('santri_id');
            $table->unsignedInteger('jenis_izin_id');
            $table->string('keperluan', 255);
            $table->dateTime('tanggal_mulai');
            $table->dateTime('rencana_kembali');
            $table->dateTime('waktu_keluar_aktual')->nullable();
            $table->dateTime('waktu_masuk_aktual')->nullable();
            $table->unsignedInteger('dicatat_keamanan_oleh')->nullable();
            $table->enum('status', ['Diajukan','Disetujui','Ditolak','Sedang Berjalan','Selesai'])->default('Diajukan');
            $table->unsignedInteger('diajukan_oleh');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('santri_id', 'idx_perizinan_santri');
            $table->index('status', 'idx_perizinan_status');
            $table->index('rencana_kembali', 'idx_perizinan_rencana_kembali');

            $table->foreign('santri_id', 'fk_perizinan_santri')->references('santri_id')->on('santri');
            $table->foreign('jenis_izin_id', 'fk_perizinan_jenis')->references('jenis_izin_id')->on('jenis_izin');
            $table->foreign('dicatat_keamanan_oleh', 'fk_perizinan_keamanan')->references('petugas_id')->on('petugas');
            $table->foreign('diajukan_oleh', 'fk_perizinan_pengaju')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('perizinan');
    }
};
