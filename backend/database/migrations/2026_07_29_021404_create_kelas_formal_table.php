<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('kelas_formal', function (Blueprint $table) {
            $table->increments('kelas_formal_id');
            $table->unsignedInteger('unit_id');
            $table->string('tingkat', 10)->nullable()->comment('mis. 7, 8, 9, VII, VIII, X, XII');
            $table->string('nama_kelas', 50)->comment('mis. "7A", "VIII D", "X-D", "XII BC"');
            $table->unsignedInteger('wali_kelas_id')->nullable();
            $table->string('tahun_ajaran', 9)->default('2026/2027');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['unit_id', 'nama_kelas', 'tahun_ajaran'], 'uq_kelas_formal');
            $table->foreign('unit_id', 'fk_kelasformal_unit')->references('unit_id')->on('unit_pendidikan');
            $table->foreign('wali_kelas_id', 'fk_kelasformal_wali')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('kelas_formal');
    }
};
