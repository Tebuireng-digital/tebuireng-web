<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('kamar', function (Blueprint $table) {
            $table->increments('kamar_id');
            $table->unsignedInteger('unit_id')->nullable();
            $table->string('nama', 100)->comment('Nama lengkap, mis. "Hadji Kalla 201" (dari sheet Database Santri Kamar)');
            $table->string('kode_singkat', 20)->nullable()->comment('Kode dipakai sheet lain, mis. "HK 201" (dari sheet Madin/Quran/Takhassus)');
            $table->unsignedInteger('pembina_id')->nullable()->comment('FK petugas berjabatan Pembina Kamar');
            $table->boolean('status_aktif')->default(1);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique('nama', 'uq_kamar_nama');
            $table->index('kode_singkat', 'idx_kamar_kode_singkat');
            $table->foreign('unit_id', 'fk_kamar_unit')->references('unit_id')->on('unit_pendidikan');
            $table->foreign('pembina_id', 'fk_kamar_pembina')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('kamar');
    }
};
