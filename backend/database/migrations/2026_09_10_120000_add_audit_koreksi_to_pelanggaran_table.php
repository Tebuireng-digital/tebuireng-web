<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pelanggaran', function (Blueprint $table) {
            $table->unsignedInteger('diubah_oleh_petugas_id')->nullable()->after('petugas_pencatat_id');
            $table->text('alasan_koreksi')->nullable()->after('diubah_oleh_petugas_id');
            $table->timestamp('waktu_koreksi')->nullable()->after('alasan_koreksi');
            $table->unsignedTinyInteger('jumlah_koreksi')->default(0)->after('waktu_koreksi');

            if (DB::getDriverName() !== 'sqlite') {
                $table->foreign('diubah_oleh_petugas_id', 'fk_pelanggaran_diubah_oleh')
                    ->references('petugas_id')
                    ->on('petugas')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('pelanggaran', function (Blueprint $table) {
            if (DB::getDriverName() !== 'sqlite') {
                $table->dropForeign('fk_pelanggaran_diubah_oleh');
            }
            $table->dropColumn([
                'diubah_oleh_petugas_id',
                'alasan_koreksi',
                'waktu_koreksi',
                'jumlah_koreksi',
            ]);
        });
    }
};
