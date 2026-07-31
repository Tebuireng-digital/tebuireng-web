<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sebagian database development sudah memiliki tabel ini dari proses
        // recovery sebelum migration record tercatat. Adopsi tabel yang sudah
        // identik agar migrasi tetap aman dan dapat direkonsiliasi.
        if (!Schema::hasTable('kamar_kode_mappings')) {
            Schema::create('kamar_kode_mappings', function (Blueprint $table) {
                $table->increments('mapping_id');
                $table->string('kode_sumber', 100)->unique();
                $table->unsignedInteger('kamar_id');
                $table->timestamps();

                $table->foreign('kamar_id')->references('kamar_id')->on('kamar');
            });
        }

        if (!Schema::hasTable('santri_import_reviews')) {
            Schema::create('santri_import_reviews', function (Blueprint $table) {
                $table->increments('review_id');
                $table->string('sumber_sheet', 100);
                $table->unsignedInteger('baris_sumber')->nullable();
                $table->string('nama_sumber', 150);
                $table->string('kode_kamar_sumber', 100)->nullable();
                $table->string('data_tambahan', 255)->nullable();
                $table->unsignedInteger('santri_otomatis_id')->nullable();
                $table->unsignedInteger('kandidat_santri_id')->nullable();
                $table->decimal('skor_kemiripan', 5, 2)->nullable();
                $table->enum('status', ['perlu_tinjau', 'perlu_mapping_kamar', 'terpisah', 'digabung'])->default('perlu_tinjau');
                $table->unsignedInteger('diputuskan_oleh')->nullable();
                $table->timestamp('diputuskan_pada')->nullable();
                $table->string('catatan_keputusan', 255)->nullable();
                $table->timestamps();

                $table->unique(['sumber_sheet', 'baris_sumber'], 'uq_review_sumber_baris');
                $table->index(['status', 'skor_kemiripan']);
                $table->foreign('santri_otomatis_id')->references('santri_id')->on('santri')->nullOnDelete();
                $table->foreign('kandidat_santri_id')->references('santri_id')->on('santri')->nullOnDelete();
                $table->foreign('diputuskan_oleh')->references('petugas_id')->on('petugas')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('santri_import_reviews');
        Schema::dropIfExists('kamar_kode_mappings');
    }
};
