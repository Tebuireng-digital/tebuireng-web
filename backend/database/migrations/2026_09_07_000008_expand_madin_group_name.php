<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }
        Schema::table('kelompok_madin', function (Blueprint $table): void {
            $table->string('nama_kelas_madin', 150)->change();
        });
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }
        Schema::table('kelompok_madin', function (Blueprint $table): void {
            $table->string('nama_kelas_madin', 50)->change();
        });
    }
};
