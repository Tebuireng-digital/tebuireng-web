<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('jadwal_kegiatan', function (Blueprint $table) {
            $table->increments('jadwal_id');
            $table->unsignedInteger('jenis_kegiatan_id');
            $table->string('nama_jadwal', 100)->comment('mis. "Absensi Kamar Malam"');
            $table->time('jam_mulai');
            $table->time('jam_selesai');
            $table->unsignedInteger('toleransi_menit')->default(0)->comment('toleransi sebelum dianggap input terlambat');
            $table->boolean('status_aktif')->default(1);

            $table->foreign('jenis_kegiatan_id', 'fk_jadwal_jenis')->references('jenis_kegiatan_id')->on('jenis_kegiatan');
        });
    }

    public function down()
    {
        Schema::dropIfExists('jadwal_kegiatan');
    }
};
