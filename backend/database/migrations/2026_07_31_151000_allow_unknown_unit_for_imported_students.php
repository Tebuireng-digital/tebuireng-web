<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->dropSantriViewsForSqlite();

        Schema::table('santri', function (Blueprint $table) {
            $table->unsignedInteger('unit_id')->nullable()->change();
        });

        $this->recreateSantriViewsForSqlite();
    }

    public function down(): void
    {
        if (DB::table('santri')->whereNull('unit_id')->exists()) {
            throw new RuntimeException('Unit santri yang kosong harus dilengkapi sebelum rollback.');
        }

        $this->dropSantriViewsForSqlite();

        Schema::table('santri', function (Blueprint $table) {
            $table->unsignedInteger('unit_id')->nullable(false)->change();
        });

        $this->recreateSantriViewsForSqlite();
    }

    private function dropSantriViewsForSqlite(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::unprepared(<<<'SQL'
            DROP VIEW IF EXISTS v_rekap_absensi_harian;
            DROP VIEW IF EXISTS v_progres_approval_izin;
            DROP VIEW IF EXISTS v_santri_sedang_izin;
            DROP VIEW IF EXISTS v_akumulasi_poin_pelanggaran;
        SQL);
    }

    private function recreateSantriViewsForSqlite(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::unprepared(<<<'SQL'
            CREATE VIEW v_rekap_absensi_harian AS
            SELECT
                a.tanggal,
                jk.kode AS jenis_kegiatan,
                s.santri_id,
                s.nama AS nama_santri,
                u.kode AS unit,
                k.nama AS kamar,
                a.status,
                a.menit_terlambat,
                a.waktu_input
            FROM absensi a
            JOIN santri s ON s.santri_id = a.santri_id
            JOIN jenis_kegiatan jk ON jk.jenis_kegiatan_id = a.jenis_kegiatan_id
            JOIN unit_pendidikan u ON u.unit_id = s.unit_id
            LEFT JOIN kamar k ON k.kamar_id = s.kamar_id;

            CREATE VIEW v_progres_approval_izin AS
            SELECT
                p.perizinan_id,
                p.santri_id,
                s.nama AS nama_santri,
                p.status,
                p.tanggal_mulai,
                p.rencana_kembali,
                pa.tahap,
                pa.jabatan_approver,
                pa.keputusan,
                pa.waktu_keputusan
            FROM perizinan p
            JOIN santri s ON s.santri_id = p.santri_id
            JOIN perizinan_approval pa ON pa.perizinan_id = p.perizinan_id
            ORDER BY p.perizinan_id, pa.tahap;

            CREATE VIEW v_santri_sedang_izin AS
            SELECT p.*, s.nama AS nama_santri
            FROM perizinan p
            JOIN santri s ON s.santri_id = p.santri_id
            WHERE p.status IN ('Disetujui','Sedang Berjalan');

            CREATE VIEW v_akumulasi_poin_pelanggaran AS
            SELECT
                s.santri_id,
                s.nama AS nama_santri,
                s.unit_id,
                SUM(kp.poin_maks) AS total_poin
            FROM pelanggaran pl
            JOIN santri s ON s.santri_id = pl.santri_id
            JOIN kategori_pelanggaran kp ON kp.kategori_pelanggaran_id = pl.kategori_pelanggaran_id
            GROUP BY s.santri_id, s.nama, s.unit_id;
        SQL);
    }
};
