<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('kelompok_pbs', function (Blueprint $table) {
            $table->increments('kelompok_pbs_id');
            $table->string('kategori', 50)->comment('mis. "KELOMPOK A", "PASCA WISUDA MA"');
            $table->string('nama_kelompok', 150);
            $table->string('lokasi', 100)->nullable();
            $table->unsignedInteger('ustadz_id')->nullable();
            $table->string('tahun_ajaran', 9)->default('2026/2027');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['kategori', 'nama_kelompok', 'tahun_ajaran'], 'uq_kelompok_pbs');
            $table->foreign('ustadz_id', 'fk_pbs_ustadz')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('kelompok_pbs');
    }
};
