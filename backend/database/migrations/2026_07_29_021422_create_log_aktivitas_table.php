<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('log_aktivitas', function (Blueprint $table) {
            $table->id('log_id');
            $table->unsignedInteger('petugas_id')->nullable();
            $table->enum('aksi', ['INSERT','UPDATE','DELETE']);
            $table->string('nama_tabel', 50);
            $table->unsignedBigInteger('record_id');
            $table->json('data_sebelum')->nullable();
            $table->json('data_sesudah')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['nama_tabel', 'record_id'], 'idx_log_tabel_record');
            $table->foreign('petugas_id', 'fk_log_petugas')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('log_aktivitas');
    }
};
