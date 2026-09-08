<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP VIEW IF EXISTS v_rekap_absensi_harian');
        Schema::table('absensi', function (Blueprint $table): void {
            $table->unsignedInteger('periode_id')->nullable()->after('tanggal');
            $table->foreign('periode_id')->references('periode_id')->on('periode_akademik')->nullOnDelete();
            $table->index(['periode_id', 'tanggal'], 'idx_absensi_periode_tanggal');
        });
        Schema::table('raport_pengajian', function (Blueprint $table): void {
            $table->unsignedInteger('periode_id')->nullable()->after('tahun');
            $table->foreign('periode_id')->references('periode_id')->on('periode_akademik')->nullOnDelete();
        });
        Schema::table('raport_ubudiyah', function (Blueprint $table): void {
            $table->unsignedInteger('periode_id')->nullable()->after('tahun');
            $table->foreign('periode_id')->references('periode_id')->on('periode_akademik')->nullOnDelete();
        });
        DB::statement("CREATE VIEW v_rekap_absensi_harian AS
            SELECT a.tanggal, jk.kode AS jenis_kegiatan, s.santri_id, s.nama AS nama_santri,
                u.kode AS unit, k.nama AS kamar, a.status, a.menit_terlambat, a.waktu_input
            FROM absensi a
            JOIN santri s ON s.santri_id = a.santri_id
            JOIN jenis_kegiatan jk ON jk.jenis_kegiatan_id = a.jenis_kegiatan_id
            JOIN unit_pendidikan u ON u.unit_id = s.unit_id
            LEFT JOIN kamar k ON k.kamar_id = s.kamar_id");
    }

    public function down(): void
    {
        Schema::table('raport_ubudiyah', function (Blueprint $table): void { $table->dropForeign(['periode_id']); $table->dropColumn('periode_id'); });
        Schema::table('raport_pengajian', function (Blueprint $table): void { $table->dropForeign(['periode_id']); $table->dropColumn('periode_id'); });
        Schema::table('absensi', function (Blueprint $table): void { $table->dropIndex('idx_absensi_periode_tanggal'); $table->dropForeign(['periode_id']); $table->dropColumn('periode_id'); });
    }
};
