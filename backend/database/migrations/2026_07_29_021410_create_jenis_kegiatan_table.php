<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('jenis_kegiatan', function (Blueprint $table) {
            $table->increments('jenis_kegiatan_id');
            $table->string('kode', 20)->unique()->comment('KAMAR, SEKOLAH, PBS, PBM, DINIYAH');
            $table->string('nama', 100);
        });
    }

    public function down()
    {
        Schema::dropIfExists('jenis_kegiatan');
    }
};
