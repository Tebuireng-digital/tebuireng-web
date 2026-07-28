<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('petugas_penugasan', function (Blueprint $table) {
            $table->increments('penugasan_id');
            $table->unsignedInteger('petugas_id');
            $table->enum('tipe_target', ['Kamar','KelasFormal','KelompokMadin','KelompokPBS','KelompokPBM']);
            $table->unsignedInteger('target_id')->comment('FK polymorphic ke kamar_id/kelas_formal_id/kelompok_*_id sesuai tipe_target');
            $table->date('tanggal_mulai');
            $table->date('tanggal_selesai')->nullable()->comment('NULL = masih berlaku');
            $table->timestamp('created_at')->useCurrent();

            $table->index('petugas_id', 'idx_penugasan_petugas');
            $table->index(['tipe_target', 'target_id'], 'idx_penugasan_target');
            $table->foreign('petugas_id', 'fk_penugasan_petugas')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('petugas_penugasan');
    }
};
