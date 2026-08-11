<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('prestasi', function (Blueprint $table) {
            $table->id('prestasi_id');
            $table->unsignedInteger('santri_id');
            $table->string('nama_prestasi');
            $table->string('peringkat')->nullable();
            $table->string('tingkat')->nullable();
            $table->date('tanggal');
            $table->text('keterangan')->nullable();
            $table->unsignedInteger('petugas_pencatat_id');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('santri_id', 'idx_prestasi_santri');
            $table->index('tanggal', 'idx_prestasi_tanggal');
            $table->foreign('santri_id', 'fk_prestasi_santri')->references('santri_id')->on('santri')->cascadeOnDelete();
            $table->foreign('petugas_pencatat_id', 'fk_prestasi_petugas')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('prestasi');
    }
};
