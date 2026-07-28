<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('jenis_izin', function (Blueprint $table) {
            $table->increments('jenis_izin_id');
            $table->string('nama', 100);
            $table->string('urutan_tahap_default', 255)->default('Pembina Kamar,Keamanan')->comment('daftar jabatan approval dipisah koma, sesuai urutan');
        });
    }

    public function down()
    {
        Schema::dropIfExists('jenis_izin');
    }
};
