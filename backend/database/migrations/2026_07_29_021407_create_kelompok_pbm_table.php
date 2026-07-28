<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('kelompok_pbm', function (Blueprint $table) {
            $table->increments('kelompok_pbm_id');
            $table->string('kategori', 50)->comment('mis. "ULYA", "WUSTHO A", "FASOHAH"');
            $table->string('nama_kelompok', 150)->comment('mis. "ULYA A 1"');
            $table->string('kelompok_asal', 150)->nullable()->comment('kolom "Kelompok Asal" pada sheet (opsional)');
            $table->unsignedInteger('ustadz_id')->nullable();
            $table->string('tahun_ajaran', 9)->default('2026/2027');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['kategori', 'nama_kelompok', 'tahun_ajaran'], 'uq_kelompok_pbm');
            $table->foreign('ustadz_id', 'fk_pbm_ustadz')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('kelompok_pbm');
    }
};
