<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('aturan_sanksi', function (Blueprint $table) {
            $table->increments('aturan_sanksi_id');
            $table->enum('kategori', ['Ringan','Sedang','Berat']);
            $table->unsignedSmallInteger('poin_min');
            $table->unsignedSmallInteger('poin_maks');
            $table->text('tindakan_sanksi');
            $table->unsignedTinyInteger('urutan')->comment('urutan tampil sesuai sheet Tabel Sanksi');
        });
    }

    public function down()
    {
        Schema::dropIfExists('aturan_sanksi');
    }
};
