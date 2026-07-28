<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('kelompok_madin', function (Blueprint $table) {
            $table->increments('kelompok_madin_id');
            $table->string('jenjang', 10)->comment('MTS, SMP, SMA, SMK, MA (kolom "Jenjang" di sheet)');
            $table->string('nama_kelas_madin', 50)->comment('mis. "1 WUSTHA ( A )", "I\'dad B"');
            $table->string('lokasi_kelas', 100)->nullable()->comment('dari sheet "Lokasi Kelas"');
            $table->unsignedInteger('ustadz_id')->nullable();
            $table->string('tahun_ajaran', 9)->default('2026/2027');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['jenjang', 'nama_kelas_madin', 'tahun_ajaran'], 'uq_kelompok_madin');
            $table->foreign('ustadz_id', 'fk_madin_ustadz')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('kelompok_madin');
    }
};
