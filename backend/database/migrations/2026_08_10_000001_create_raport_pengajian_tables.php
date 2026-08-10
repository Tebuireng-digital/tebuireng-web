<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('raport_kepribadian');
        Schema::dropIfExists('raport_nilai');
        Schema::dropIfExists('raport_pengajian');

        Schema::create('raport_pengajian', function (Blueprint $table) {
            $table->id('raport_id');
            $table->unsignedInteger('santri_id');
            $table->tinyInteger('bulan'); // 1-12
            $table->smallInteger('tahun');
            $table->string('tahun_pelajaran', 20); // e.g., "2025-2026"
            $table->enum('semester', ['Ganjil', 'Genap']);
            $table->unsignedInteger('kelompok_pbs_id')->nullable();
            $table->unsignedInteger('kelompok_pbm_id')->nullable();
            $table->enum('keputusan_pbs', ['Naik', 'Tidak Naik'])->nullable();
            $table->enum('keputusan_pbm', ['Naik', 'Tidak Naik'])->nullable();
            $table->string('predikat_umum', 50)->nullable();
            $table->unsignedInteger('diisi_oleh');
            $table->timestamps();

            $table->unique(['santri_id', 'bulan', 'tahun'], 'raport_santri_periode_unique');

            $table->foreign('santri_id')->references('santri_id')->on('santri')->onDelete('cascade');
            $table->foreign('kelompok_pbs_id')->references('kelompok_pbs_id')->on('kelompok_pbs')->onDelete('set null');
            $table->foreign('kelompok_pbm_id')->references('kelompok_pbm_id')->on('kelompok_pbm')->onDelete('set null');
            $table->foreign('diisi_oleh')->references('petugas_id')->on('petugas')->onDelete('restrict');
        });

        Schema::create('raport_nilai', function (Blueprint $table) {
            $table->id('nilai_id');
            $table->unsignedBigInteger('raport_id');
            $table->enum('jenis_pengajian', ['AL_QURAN', 'TAKHASSUS']);
            $table->string('aspek', 50); // Fashohah, Tajwid, etc.
            $table->tinyInteger('nilai_angka')->unsigned(); // 0-100

            $table->unique(['raport_id', 'jenis_pengajian', 'aspek'], 'raport_nilai_unique');

            $table->foreign('raport_id')->references('raport_id')->on('raport_pengajian')->onDelete('cascade');
        });

        Schema::create('raport_kepribadian', function (Blueprint $table) {
            $table->id('kepribadian_id');
            $table->unsignedBigInteger('raport_id');
            $table->enum('jenis', ['Kelakuan', 'Kedisiplinan', 'Kerajinan']);
            $table->char('nilai', 1); // A, B, C, D, E

            $table->unique(['raport_id', 'jenis'], 'raport_kepribadian_unique');

            $table->foreign('raport_id')->references('raport_id')->on('raport_pengajian')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('raport_kepribadian');
        Schema::dropIfExists('raport_nilai');
        Schema::dropIfExists('raport_pengajian');
    }
};
