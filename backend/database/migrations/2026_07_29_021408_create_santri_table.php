<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('santri', function (Blueprint $table) {
            $table->increments('santri_id');
            $table->string('nis', 30)->nullable()->comment('hanya terisi utk santri di sheet Database Siswa (SMP); NULL utk unit lain');
            $table->string('nama', 150);
            $table->unsignedInteger('unit_id')->comment('jenjang: MTS/SMP/SMA/SMK/MA');
            $table->unsignedInteger('kamar_id')->nullable();
            $table->unsignedInteger('kelas_formal_id')->nullable()->comment('diisi jika santri tercatat di sheet Database Siswa atau Kelas Madin unit MTS/SMA/SMK/MA');
            $table->unsignedInteger('kelompok_madin_id')->nullable();
            $table->unsignedInteger('kelompok_pbs_id')->nullable();
            $table->unsignedInteger('kelompok_pbm_id')->nullable();
            $table->string('nama_wali', 150)->nullable();
            $table->string('no_hp_wali', 20)->nullable();
            $table->boolean('status_aktif')->default(1);
            $table->string('catatan_import', 255)->nullable()->comment('jejak asal data / status pencocokan saat import awal, lihat PANDUAN IMPORT');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('nama', 'idx_santri_nama');
            $table->index('nis', 'idx_santri_nis');
            $table->foreign('unit_id', 'fk_santri_unit')->references('unit_id')->on('unit_pendidikan');
            $table->foreign('kamar_id', 'fk_santri_kamar')->references('kamar_id')->on('kamar');
            $table->foreign('kelas_formal_id', 'fk_santri_kelasformal')->references('kelas_formal_id')->on('kelas_formal');
            $table->foreign('kelompok_madin_id', 'fk_santri_kelompokmadin')->references('kelompok_madin_id')->on('kelompok_madin');
            $table->foreign('kelompok_pbs_id', 'fk_santri_kelompokpbs')->references('kelompok_pbs_id')->on('kelompok_pbs');
            $table->foreign('kelompok_pbm_id', 'fk_santri_kelompokpbm')->references('kelompok_pbm_id')->on('kelompok_pbm');
        });
    }

    public function down()
    {
        Schema::dropIfExists('santri');
    }
};
