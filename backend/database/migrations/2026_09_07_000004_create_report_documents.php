<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_documents', function (Blueprint $table): void {
            $table->bigIncrements('document_id');
            $table->enum('jenis', ['raport_pengajian', 'raport_pembinaan']);
            $table->unsignedInteger('santri_id');
            $table->unsignedInteger('periode_id')->nullable();
            $table->string('tahun_pelajaran', 20);
            $table->enum('semester', ['Ganjil', 'Genap']);
            $table->unsignedInteger('versi');
            $table->string('file_path', 255);
            $table->json('snapshot_data');
            $table->unsignedInteger('diterbitkan_oleh');
            $table->timestamp('diterbitkan_pada');
            $table->timestamps();
            $table->unique(['jenis', 'santri_id', 'tahun_pelajaran', 'semester', 'versi'], 'report_document_version_unique');
            $table->foreign('santri_id')->references('santri_id')->on('santri')->cascadeOnDelete();
            $table->foreign('periode_id')->references('periode_id')->on('periode_akademik')->nullOnDelete();
            $table->foreign('diterbitkan_oleh')->references('petugas_id')->on('petugas')->restrictOnDelete();
            $table->index(['jenis', 'santri_id', 'tahun_pelajaran', 'semester']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_documents');
    }
};
