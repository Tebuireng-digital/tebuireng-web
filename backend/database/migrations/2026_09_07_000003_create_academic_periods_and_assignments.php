<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('periode_akademik', function (Blueprint $table): void {
            $table->increments('periode_id');
            $table->string('tahun_pelajaran', 20);
            $table->enum('semester', ['Ganjil', 'Genap']);
            $table->date('tanggal_mulai');
            $table->date('tanggal_selesai');
            $table->enum('status', ['Draft', 'Aktif', 'Ditutup'])->default('Draft');
            $table->unsignedInteger('dibuat_oleh');
            $table->unsignedInteger('ditutup_oleh')->nullable();
            $table->timestamp('ditutup_pada')->nullable();
            $table->timestamps();
            $table->unique(['tahun_pelajaran', 'semester']);
            $table->foreign('dibuat_oleh')->references('petugas_id')->on('petugas')->restrictOnDelete();
            $table->foreign('ditutup_oleh')->references('petugas_id')->on('petugas')->nullOnDelete();
            $table->index(['status', 'tanggal_mulai', 'tanggal_selesai']);
        });

        Schema::create('assignment_periode', function (Blueprint $table): void {
            $table->bigIncrements('assignment_id');
            $table->unsignedInteger('periode_id');
            $table->unsignedInteger('santri_id');
            $table->enum('jenis', ['kelas_formal', 'kamar', 'pbs', 'pbm', 'madin']);
            $table->unsignedInteger('target_id');
            $table->enum('status_transisi', ['Naik Kelas', 'Tinggal Kelas', 'Lulus', 'Pindah', 'Keluar'])->nullable();
            $table->timestamps();
            $table->unique(['periode_id', 'santri_id', 'jenis']);
            $table->foreign('periode_id')->references('periode_id')->on('periode_akademik')->cascadeOnDelete();
            $table->foreign('santri_id')->references('santri_id')->on('santri')->cascadeOnDelete();
            $table->index(['jenis', 'target_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_periode');
        Schema::dropIfExists('periode_akademik');
    }
};
