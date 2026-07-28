<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('lampiran_pelanggaran', function (Blueprint $table) {
            $table->increments('lampiran_id');
            $table->unsignedBigInteger('pelanggaran_id');
            $table->string('path_file', 255);
            $table->unsignedInteger('diunggah_oleh');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('pelanggaran_id', 'fk_lampiran_pelanggaran')->references('pelanggaran_id')->on('pelanggaran')->cascadeOnDelete();
            $table->foreign('diunggah_oleh', 'fk_lampiran_petugas')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('lampiran_pelanggaran');
    }
};
