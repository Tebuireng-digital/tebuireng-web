<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('kategori_pelanggaran', function (Blueprint $table) {
            $table->increments('kategori_pelanggaran_id');
            $table->string('kode_pasal', 30)->comment('mis. "Pasal 10 ayat 1"');
            $table->enum('kategori', ['Ringan','Sedang','Berat','Kewajiban'])->comment('nilai nyata di sheet: Ringan/Sedang/Berat/Kewajiban');
            $table->text('uraian_pelanggaran');
            $table->unsignedSmallInteger('poin_maks');
            $table->enum('jenis', ['Pelanggaran','Meninggalkan Kewajiban']);
            $table->enum('status_aktif', ['Aktif','Tidak Aktif'])->default('Aktif');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique('kode_pasal', 'uq_kode_pasal');
        });
    }

    public function down()
    {
        Schema::dropIfExists('kategori_pelanggaran');
    }
};
