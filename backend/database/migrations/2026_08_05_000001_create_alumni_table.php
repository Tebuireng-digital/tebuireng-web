<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('alumni', function (Blueprint $table) {
            $table->id('alumni_id');
            $table->string('no_id_induk', 50)->nullable()->index();
            $table->string('nama', 255)->index();
            $table->string('jenis_kelamin', 10)->nullable();
            $table->string('tempat_lahir', 100)->nullable();
            $table->string('tanggal_lahir', 20)->nullable();
            $table->string('orang_tua', 255)->nullable();
            $table->string('jenjang', 50)->nullable();
            $table->string('kelas', 50)->nullable();
            $table->string('no_hp', 50)->nullable();
            $table->string('saldo_spp', 50)->nullable();
            $table->bigInteger('nominal_saldo')->default(0);
            $table->text('alamat')->nullable();
            $table->string('wilayah', 150)->nullable();
            $table->string('provinsi', 150)->nullable();
            $table->string('angkatan', 50)->nullable();
            $table->string('tahun_lulus', 50)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down()
    {
        Schema::dropIfExists('alumni');
    }
};
