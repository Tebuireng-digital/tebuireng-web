<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('pelanggaran', function (Blueprint $table) {
            $table->id('pelanggaran_id'); // BIGINT UNSIGNED
            $table->unsignedInteger('santri_id');
            $table->unsignedInteger('kategori_pelanggaran_id');
            $table->date('tanggal');
            $table->text('keterangan')->nullable();
            $table->unsignedInteger('petugas_pencatat_id');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('santri_id', 'idx_pelanggaran_santri');
            $table->index('tanggal', 'idx_pelanggaran_tanggal');
            $table->foreign('santri_id', 'fk_pelanggaran_santri')->references('santri_id')->on('santri');
            $table->foreign('kategori_pelanggaran_id', 'fk_pelanggaran_kategori')->references('kategori_pelanggaran_id')->on('kategori_pelanggaran');
            $table->foreign('petugas_pencatat_id', 'fk_pelanggaran_petugas')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('pelanggaran');
    }
};
