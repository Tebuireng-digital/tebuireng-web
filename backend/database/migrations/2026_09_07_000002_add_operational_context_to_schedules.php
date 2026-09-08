<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jadwal_kegiatan', function (Blueprint $table): void {
            $table->string('konteks_operasional', 40)->default('utama')->after('nama_jadwal');
            $table->index(['jenis_kegiatan_id', 'konteks_operasional', 'status_aktif'], 'idx_jadwal_konteks');
        });
    }

    public function down(): void
    {
        Schema::table('jadwal_kegiatan', function (Blueprint $table): void {
            $table->dropIndex('idx_jadwal_konteks');
            $table->dropColumn('konteks_operasional');
        });
    }
};
