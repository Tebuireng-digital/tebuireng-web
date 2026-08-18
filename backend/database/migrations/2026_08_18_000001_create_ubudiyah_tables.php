<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('master_instrumen_ubudiyah', function (Blueprint $table) {
            $table->increments('instrumen_id');
            $table->string('nama_instrumen', 150);
            $table->boolean('status_aktif')->default(true);
            $table->unsignedInteger('dibuat_oleh');
            $table->timestamps();

            $table->foreign('dibuat_oleh')->references('petugas_id')->on('petugas')->onDelete('restrict');
        });

        Schema::create('raport_ubudiyah', function (Blueprint $table) {
            $table->id('raport_ubudiyah_id');
            $table->unsignedInteger('santri_id');
            $table->unsignedInteger('kamar_id');
            $table->tinyInteger('bulan')->unsigned(); // 1-12
            $table->smallInteger('tahun')->unsigned();
            $table->string('tahun_pelajaran', 20); // e.g., "2026/2027"
            $table->enum('semester', ['Ganjil', 'Genap']);
            $table->unsignedInteger('diisi_oleh');
            $table->timestamps();

            $table->unique(['santri_id', 'bulan', 'tahun'], 'raport_ubudiyah_unique');

            $table->foreign('santri_id')->references('santri_id')->on('santri')->onDelete('cascade');
            $table->foreign('kamar_id')->references('kamar_id')->on('kamar')->onDelete('cascade');
            $table->foreign('diisi_oleh')->references('petugas_id')->on('petugas')->onDelete('restrict');
        });

        Schema::create('nilai_ubudiyah', function (Blueprint $table) {
            $table->id('nilai_id');
            $table->unsignedBigInteger('raport_ubudiyah_id');
            $table->unsignedInteger('instrumen_id');
            $table->tinyInteger('nilai_angka')->unsigned(); // 0-100
            $table->string('catatan', 255)->nullable();
            $table->timestamps();

            $table->unique(['raport_ubudiyah_id', 'instrumen_id'], 'nilai_ubudiyah_unique');

            $table->foreign('raport_ubudiyah_id')->references('raport_ubudiyah_id')->on('raport_ubudiyah')->onDelete('cascade');
            $table->foreign('instrumen_id')->references('instrumen_id')->on('master_instrumen_ubudiyah')->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nilai_ubudiyah');
        Schema::dropIfExists('raport_ubudiyah');
        Schema::dropIfExists('master_instrumen_ubudiyah');
    }
};
