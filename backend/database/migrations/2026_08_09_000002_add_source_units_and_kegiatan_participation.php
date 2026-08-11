<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        foreach ([
            'MTSS' => 'MTSS',
            'SMPT' => 'SMPT',
            'SMAT' => 'SMAT',
            'MAS' => 'MAS',
            'MU' => 'MU',
            'THS' => 'THS',
        ] as $kode => $nama) {
            DB::table('unit_pendidikan')->updateOrInsert(['kode' => $kode], [
                'nama' => $nama,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::create('santri_kegiatan_partisipasi', function (Blueprint $table) {
            $table->id('partisipasi_id');
            $table->unsignedInteger('santri_id');
            $table->unsignedInteger('jenis_kegiatan_id');
            $table->enum('status', ['terdaftar', 'tidak_ikut', 'perlu_verifikasi'])->default('perlu_verifikasi');
            $table->string('alasan', 255)->nullable();
            $table->unsignedInteger('ditetapkan_oleh')->nullable();
            $table->timestamps();
            $table->unique(['santri_id', 'jenis_kegiatan_id'], 'uq_santri_partisipasi_kegiatan');
            $table->foreign('santri_id')->references('santri_id')->on('santri')->cascadeOnDelete();
            $table->foreign('jenis_kegiatan_id')->references('jenis_kegiatan_id')->on('jenis_kegiatan')->cascadeOnDelete();
            $table->foreign('ditetapkan_oleh')->references('petugas_id')->on('petugas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('santri_kegiatan_partisipasi');
        DB::table('unit_pendidikan')->whereIn('kode', ['MTSS', 'SMPT', 'SMAT', 'MAS', 'MU', 'THS'])->delete();
    }
};
