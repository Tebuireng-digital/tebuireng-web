const fs = require('fs');
const path = require('path');

const migrationsPath = path.join(__dirname, 'database', 'migrations');
if (!fs.existsSync(migrationsPath)) fs.mkdirSync(migrationsPath, { recursive: true });

function pad(num) { return num.toString().padStart(2, '0'); }

const now = new Date();
let secondCounter = 0;

function getFilename(name) {
    secondCounter++;
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const H = pad(now.getHours());
    const M = pad(now.getMinutes());
    const S = pad(secondCounter);
    return `${y}_${m}_${d}_${H}${M}${S}_create_${name}_table.php`;
}

function writeMigration(name, upContent, downContent) {
    const content = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;
use Illuminate\\Support\\Facades\\DB;

return new class extends Migration
{
    public function up()
    {
${upContent}
    }

    public function down()
    {
${downContent}
    }
};
`;
    fs.writeFileSync(path.join(migrationsPath, getFilename(name)), content);
}

writeMigration('unit_pendidikan', `        Schema::create('unit_pendidikan', function (Blueprint $table) {
            $table->increments('unit_id');
            $table->string('kode', 10)->unique()->comment('MTS, SMP, SMA, SMK, MA');
            $table->string('nama', 100);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });`, `        Schema::dropIfExists('unit_pendidikan');`);

writeMigration('petugas', `        Schema::create('petugas', function (Blueprint $table) {
            $table->increments('petugas_id');
            $table->string('nama', 150);
            $table->string('username', 100)->unique();
            $table->string('password_hash', 255);
            $table->string('no_hp', 20)->nullable();
            $table->enum('jabatan', ['Pengasuh','Ustadz','Pembina Kamar','Wali Kelas','Keamanan','Admin']);
            $table->boolean('status_aktif')->default(1);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });`, `        Schema::dropIfExists('petugas');`);

writeMigration('kamar', `        Schema::create('kamar', function (Blueprint $table) {
            $table->increments('kamar_id');
            $table->unsignedInteger('unit_id')->nullable();
            $table->string('nama', 100)->comment('Nama lengkap, mis. "Hadji Kalla 201" (dari sheet Database Santri Kamar)');
            $table->string('kode_singkat', 20)->nullable()->comment('Kode dipakai sheet lain, mis. "HK 201" (dari sheet Madin/Quran/Takhassus)');
            $table->unsignedInteger('pembina_id')->nullable()->comment('FK petugas berjabatan Pembina Kamar');
            $table->boolean('status_aktif')->default(1);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique('nama', 'uq_kamar_nama');
            $table->index('kode_singkat', 'idx_kamar_kode_singkat');
            $table->foreign('unit_id', 'fk_kamar_unit')->references('unit_id')->on('unit_pendidikan');
            $table->foreign('pembina_id', 'fk_kamar_pembina')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('kamar');`);

writeMigration('kelas_formal', `        Schema::create('kelas_formal', function (Blueprint $table) {
            $table->increments('kelas_formal_id');
            $table->unsignedInteger('unit_id');
            $table->string('tingkat', 10)->nullable()->comment('mis. 7, 8, 9, VII, VIII, X, XII');
            $table->string('nama_kelas', 50)->comment('mis. "7A", "VIII D", "X-D", "XII BC"');
            $table->unsignedInteger('wali_kelas_id')->nullable();
            $table->string('tahun_ajaran', 9)->default('2026/2027');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['unit_id', 'nama_kelas', 'tahun_ajaran'], 'uq_kelas_formal');
            $table->foreign('unit_id', 'fk_kelasformal_unit')->references('unit_id')->on('unit_pendidikan');
            $table->foreign('wali_kelas_id', 'fk_kelasformal_wali')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('kelas_formal');`);

writeMigration('kelompok_madin', `        Schema::create('kelompok_madin', function (Blueprint $table) {
            $table->increments('kelompok_madin_id');
            $table->string('jenjang', 10)->comment('MTS, SMP, SMA, SMK, MA (kolom "Jenjang" di sheet)');
            $table->string('nama_kelas_madin', 50)->comment('mis. "1 WUSTHA ( A )", "I\\'dad B"');
            $table->string('lokasi_kelas', 100)->nullable()->comment('dari sheet "Lokasi Kelas"');
            $table->unsignedInteger('ustadz_id')->nullable();
            $table->string('tahun_ajaran', 9)->default('2026/2027');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['jenjang', 'nama_kelas_madin', 'tahun_ajaran'], 'uq_kelompok_madin');
            $table->foreign('ustadz_id', 'fk_madin_ustadz')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('kelompok_madin');`);

writeMigration('kelompok_pbs', `        Schema::create('kelompok_pbs', function (Blueprint $table) {
            $table->increments('kelompok_pbs_id');
            $table->string('kategori', 50)->comment('mis. "KELOMPOK A", "PASCA WISUDA MA"');
            $table->string('nama_kelompok', 150);
            $table->string('lokasi', 100)->nullable();
            $table->unsignedInteger('ustadz_id')->nullable();
            $table->string('tahun_ajaran', 9)->default('2026/2027');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['kategori', 'nama_kelompok', 'tahun_ajaran'], 'uq_kelompok_pbs');
            $table->foreign('ustadz_id', 'fk_pbs_ustadz')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('kelompok_pbs');`);

writeMigration('kelompok_pbm', `        Schema::create('kelompok_pbm', function (Blueprint $table) {
            $table->increments('kelompok_pbm_id');
            $table->string('kategori', 50)->comment('mis. "ULYA", "WUSTHO A", "FASOHAH"');
            $table->string('nama_kelompok', 150)->comment('mis. "ULYA A 1"');
            $table->string('kelompok_asal', 150)->nullable()->comment('kolom "Kelompok Asal" pada sheet (opsional)');
            $table->unsignedInteger('ustadz_id')->nullable();
            $table->string('tahun_ajaran', 9)->default('2026/2027');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['kategori', 'nama_kelompok', 'tahun_ajaran'], 'uq_kelompok_pbm');
            $table->foreign('ustadz_id', 'fk_pbm_ustadz')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('kelompok_pbm');`);

writeMigration('santri', `        Schema::create('santri', function (Blueprint $table) {
            $table->increments('santri_id');
            $table->string('nis', 30)->nullable()->comment('hanya terisi utk santri di sheet Database Siswa (SMP); NULL utk unit lain');
            $table->string('nama', 150);
            $table->unsignedInteger('unit_id')->comment('jenjang: MTS/SMP/SMA/SMK/MA');
            $table->unsignedInteger('kamar_id')->nullable();
            $table->unsignedInteger('kelas_formal_id')->nullable()->comment('diisi jika santri tercatat di sheet Database Siswa atau Kelas Madin unit MTS/SMA/SMK/MA');
            $table->unsignedInteger('kelompok_madin_id')->nullable();
            $table->unsignedInteger('kelompok_pbs_id')->nullable();
            $table->unsignedInteger('kelompok_pbm_id')->nullable();
            $table->string('nama_wali', 150)->nullable();
            $table->string('no_hp_wali', 20)->nullable();
            $table->boolean('status_aktif')->default(1);
            $table->string('catatan_import', 255)->nullable()->comment('jejak asal data / status pencocokan saat import awal, lihat PANDUAN IMPORT');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('nama', 'idx_santri_nama');
            $table->index('nis', 'idx_santri_nis');
            $table->foreign('unit_id', 'fk_santri_unit')->references('unit_id')->on('unit_pendidikan');
            $table->foreign('kamar_id', 'fk_santri_kamar')->references('kamar_id')->on('kamar');
            $table->foreign('kelas_formal_id', 'fk_santri_kelasformal')->references('kelas_formal_id')->on('kelas_formal');
            $table->foreign('kelompok_madin_id', 'fk_santri_kelompokmadin')->references('kelompok_madin_id')->on('kelompok_madin');
            $table->foreign('kelompok_pbs_id', 'fk_santri_kelompokpbs')->references('kelompok_pbs_id')->on('kelompok_pbs');
            $table->foreign('kelompok_pbm_id', 'fk_santri_kelompokpbm')->references('kelompok_pbm_id')->on('kelompok_pbm');
        });`, `        Schema::dropIfExists('santri');`);

writeMigration('petugas_penugasan', `        Schema::create('petugas_penugasan', function (Blueprint $table) {
            $table->increments('penugasan_id');
            $table->unsignedInteger('petugas_id');
            $table->enum('tipe_target', ['Kamar','KelasFormal','KelompokMadin','KelompokPBS','KelompokPBM']);
            $table->unsignedInteger('target_id')->comment('FK polymorphic ke kamar_id/kelas_formal_id/kelompok_*_id sesuai tipe_target');
            $table->date('tanggal_mulai');
            $table->date('tanggal_selesai')->nullable()->comment('NULL = masih berlaku');
            $table->timestamp('created_at')->useCurrent();

            $table->index('petugas_id', 'idx_penugasan_petugas');
            $table->index(['tipe_target', 'target_id'], 'idx_penugasan_target');
            $table->foreign('petugas_id', 'fk_penugasan_petugas')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('petugas_penugasan');`);

writeMigration('jenis_kegiatan', `        Schema::create('jenis_kegiatan', function (Blueprint $table) {
            $table->increments('jenis_kegiatan_id');
            $table->string('kode', 20)->unique()->comment('KAMAR, SEKOLAH, PBS, PBM, DINIYAH');
            $table->string('nama', 100);
        });`, `        Schema::dropIfExists('jenis_kegiatan');`);

writeMigration('jadwal_kegiatan', `        Schema::create('jadwal_kegiatan', function (Blueprint $table) {
            $table->increments('jadwal_id');
            $table->unsignedInteger('jenis_kegiatan_id');
            $table->string('nama_jadwal', 100)->comment('mis. "Absensi Kamar Malam"');
            $table->time('jam_mulai');
            $table->time('jam_selesai');
            $table->unsignedInteger('toleransi_menit')->default(0)->comment('toleransi sebelum dianggap input terlambat');
            $table->boolean('status_aktif')->default(1);

            $table->foreign('jenis_kegiatan_id', 'fk_jadwal_jenis')->references('jenis_kegiatan_id')->on('jenis_kegiatan');
        });`, `        Schema::dropIfExists('jadwal_kegiatan');`);

writeMigration('absensi', `        Schema::create('absensi', function (Blueprint $table) {
            $table->id('absensi_id'); // BIGINT UNSIGNED
            $table->unsignedInteger('santri_id');
            $table->unsignedInteger('jenis_kegiatan_id');
            $table->unsignedInteger('jadwal_id');
            $table->date('tanggal');
            $table->enum('status', ['Hadir','Sakit','Izin','Alpha','Terlambat']);
            $table->unsignedSmallInteger('menit_terlambat')->nullable()->comment('diisi jika status = Terlambat');
            $table->string('keterangan', 255)->nullable();
            $table->timestamp('waktu_input')->useCurrent()->comment('diisi otomatis server saat baris pertama dibuat');
            $table->unsignedInteger('diinput_oleh');
            $table->unsignedInteger('diubah_oleh')->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['santri_id', 'jenis_kegiatan_id', 'jadwal_id', 'tanggal'], 'uq_absensi');
            $table->index('tanggal', 'idx_absensi_tanggal');
            $table->index(['jenis_kegiatan_id', 'tanggal'], 'idx_absensi_jenis_tanggal');

            $table->foreign('santri_id', 'fk_absensi_santri')->references('santri_id')->on('santri');
            $table->foreign('jenis_kegiatan_id', 'fk_absensi_jenis')->references('jenis_kegiatan_id')->on('jenis_kegiatan');
            $table->foreign('jadwal_id', 'fk_absensi_jadwal')->references('jadwal_id')->on('jadwal_kegiatan');
            $table->foreign('diinput_oleh', 'fk_absensi_input')->references('petugas_id')->on('petugas');
            $table->foreign('diubah_oleh', 'fk_absensi_ubah')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('absensi');`);

writeMigration('kategori_pelanggaran', `        Schema::create('kategori_pelanggaran', function (Blueprint $table) {
            $table->increments('kategori_pelanggaran_id');
            $table->string('kode_pasal', 30)->comment('mis. "Pasal 10 ayat 1"');
            $table->enum('kategori', ['Ringan','Sedang','Berat','Kewajiban'])->comment('nilai nyata di sheet: Ringan/Sedang/Berat/Kewajiban');
            $table->text('uraian_pelanggaran');
            $table->unsignedSmallInteger('poin_maks');
            $table->enum('jenis', ['Pelanggaran','Meninggalkan Kewajiban']);
            $table->enum('status_aktif', ['Aktif','Tidak Aktif'])->default('Aktif');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique('kode_pasal', 'uq_kode_pasal');
        });`, `        Schema::dropIfExists('kategori_pelanggaran');`);

writeMigration('aturan_sanksi', `        Schema::create('aturan_sanksi', function (Blueprint $table) {
            $table->increments('aturan_sanksi_id');
            $table->enum('kategori', ['Ringan','Sedang','Berat']);
            $table->unsignedSmallInteger('poin_min');
            $table->unsignedSmallInteger('poin_maks');
            $table->text('tindakan_sanksi');
            $table->unsignedTinyInteger('urutan')->comment('urutan tampil sesuai sheet Tabel Sanksi');
        });`, `        Schema::dropIfExists('aturan_sanksi');`);

writeMigration('pelanggaran', `        Schema::create('pelanggaran', function (Blueprint $table) {
            $table->id('pelanggaran_id'); // BIGINT UNSIGNED
            $table->unsignedInteger('santri_id');
            $table->unsignedInteger('kategori_pelanggaran_id');
            $table->date('tanggal');
            $table->text('keterangan')->nullable();
            $table->unsignedInteger('petugas_pencatat_id');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('santri_id', 'idx_pelanggaran_santri');
            $table->index('tanggal', 'idx_pelanggaran_tanggal');
            $table->foreign('santri_id', 'fk_pelanggaran_santri')->references('santri_id')->on('santri');
            $table->foreign('kategori_pelanggaran_id', 'fk_pelanggaran_kategori')->references('kategori_pelanggaran_id')->on('kategori_pelanggaran');
            $table->foreign('petugas_pencatat_id', 'fk_pelanggaran_petugas')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('pelanggaran');`);

writeMigration('lampiran_pelanggaran', `        Schema::create('lampiran_pelanggaran', function (Blueprint $table) {
            $table->increments('lampiran_id');
            $table->unsignedBigInteger('pelanggaran_id');
            $table->string('path_file', 255);
            $table->unsignedInteger('diunggah_oleh');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('pelanggaran_id', 'fk_lampiran_pelanggaran')->references('pelanggaran_id')->on('pelanggaran')->cascadeOnDelete();
            $table->foreign('diunggah_oleh', 'fk_lampiran_petugas')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('lampiran_pelanggaran');`);

writeMigration('jenis_izin', `        Schema::create('jenis_izin', function (Blueprint $table) {
            $table->increments('jenis_izin_id');
            $table->string('nama', 100);
            $table->string('urutan_tahap_default', 255)->default('Pembina Kamar,Keamanan')->comment('daftar jabatan approval dipisah koma, sesuai urutan');
        });`, `        Schema::dropIfExists('jenis_izin');`);

writeMigration('perizinan', `        Schema::create('perizinan', function (Blueprint $table) {
            $table->id('perizinan_id');
            $table->unsignedInteger('santri_id');
            $table->unsignedInteger('jenis_izin_id');
            $table->string('keperluan', 255);
            $table->dateTime('tanggal_mulai');
            $table->dateTime('rencana_kembali');
            $table->dateTime('waktu_keluar_aktual')->nullable();
            $table->dateTime('waktu_masuk_aktual')->nullable();
            $table->unsignedInteger('dicatat_keamanan_oleh')->nullable();
            $table->enum('status', ['Diajukan','Disetujui','Ditolak','Sedang Berjalan','Selesai'])->default('Diajukan');
            $table->unsignedInteger('diajukan_oleh');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->index('santri_id', 'idx_perizinan_santri');
            $table->index('status', 'idx_perizinan_status');
            $table->index('rencana_kembali', 'idx_perizinan_rencana_kembali');

            $table->foreign('santri_id', 'fk_perizinan_santri')->references('santri_id')->on('santri');
            $table->foreign('jenis_izin_id', 'fk_perizinan_jenis')->references('jenis_izin_id')->on('jenis_izin');
            $table->foreign('dicatat_keamanan_oleh', 'fk_perizinan_keamanan')->references('petugas_id')->on('petugas');
            $table->foreign('diajukan_oleh', 'fk_perizinan_pengaju')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('perizinan');`);

writeMigration('perizinan_approval', `        Schema::create('perizinan_approval', function (Blueprint $table) {
            $table->id('approval_id');
            $table->unsignedBigInteger('perizinan_id');
            $table->unsignedTinyInteger('tahap')->comment('1 = Wali Kamar, 2 = Keamanan, dst');
            $table->enum('jabatan_approver', ['Pembina Kamar','Wali Kelas','Ustadz','Pengasuh','Keamanan','Admin']);
            $table->unsignedInteger('petugas_id')->nullable()->comment('diisi saat petugas mengambil keputusan');
            $table->enum('keputusan', ['Menunggu','Disetujui','Ditolak','Gugur'])->default('Menunggu');
            $table->string('catatan', 255)->nullable();
            $table->timestamp('waktu_keputusan')->nullable();

            $table->unique(['perizinan_id', 'tahap'], 'uq_perizinan_tahap');
            $table->foreign('perizinan_id', 'fk_approval_perizinan')->references('perizinan_id')->on('perizinan')->cascadeOnDelete();
            $table->foreign('petugas_id', 'fk_approval_petugas')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('perizinan_approval');`);

writeMigration('pengaturan_sistem', `        Schema::create('pengaturan_sistem', function (Blueprint $table) {
            $table->string('setting_key', 100)->primary();
            $table->string('setting_value', 255);
            $table->string('keterangan', 255)->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });`, `        Schema::dropIfExists('pengaturan_sistem');`);

writeMigration('notifikasi', `        Schema::create('notifikasi', function (Blueprint $table) {
            $table->id('notifikasi_id');
            $table->unsignedInteger('petugas_id');
            $table->string('judul', 150);
            $table->string('pesan', 500);
            $table->string('tipe', 50)->nullable()->comment('mis. overdue_izin, ambang_poin, reminder_absensi');
            $table->string('referensi_tabel', 50)->nullable();
            $table->unsignedBigInteger('referensi_id')->nullable();
            $table->boolean('dibaca')->default(0);
            $table->timestamp('created_at')->useCurrent();

            $table->index(['petugas_id', 'dibaca'], 'idx_notifikasi_petugas');
            $table->foreign('petugas_id', 'fk_notifikasi_petugas')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('notifikasi');`);

writeMigration('log_aktivitas', `        Schema::create('log_aktivitas', function (Blueprint $table) {
            $table->id('log_id');
            $table->unsignedInteger('petugas_id')->nullable();
            $table->enum('aksi', ['INSERT','UPDATE','DELETE']);
            $table->string('nama_tabel', 50);
            $table->unsignedBigInteger('record_id');
            $table->json('data_sebelum')->nullable();
            $table->json('data_sesudah')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['nama_tabel', 'record_id'], 'idx_log_tabel_record');
            $table->foreign('petugas_id', 'fk_log_petugas')->references('petugas_id')->on('petugas');
        });`, `        Schema::dropIfExists('log_aktivitas');`);

writeMigration('view_dashboard_laporan', `        DB::unprepared("
            CREATE OR REPLACE VIEW v_rekap_absensi_harian AS
            SELECT
                a.tanggal,
                jk.kode          AS jenis_kegiatan,
                s.santri_id,
                s.nama           AS nama_santri,
                u.kode           AS unit,
                k.nama           AS kamar,
                a.status,
                a.menit_terlambat,
                a.waktu_input
            FROM absensi a
            JOIN santri s          ON s.santri_id = a.santri_id
            JOIN jenis_kegiatan jk ON jk.jenis_kegiatan_id = a.jenis_kegiatan_id
            JOIN unit_pendidikan u ON u.unit_id = s.unit_id
            LEFT JOIN kamar k      ON k.kamar_id = s.kamar_id;

            CREATE OR REPLACE VIEW v_progres_approval_izin AS
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

            CREATE OR REPLACE VIEW v_santri_sedang_izin AS
            SELECT p.*, s.nama AS nama_santri
            FROM perizinan p
            JOIN santri s ON s.santri_id = p.santri_id
            WHERE p.status IN ('Disetujui','Sedang Berjalan');

            CREATE OR REPLACE VIEW v_akumulasi_poin_pelanggaran AS
            SELECT
                s.santri_id,
                s.nama AS nama_santri,
                s.unit_id,
                SUM(kp.poin_maks) AS total_poin
            FROM pelanggaran pl
            JOIN santri s ON s.santri_id = pl.santri_id
            JOIN kategori_pelanggaran kp ON kp.kategori_pelanggaran_id = pl.kategori_pelanggaran_id
            GROUP BY s.santri_id, s.nama, s.unit_id;
        ");`, `        DB::unprepared("
            DROP VIEW IF EXISTS v_rekap_absensi_harian;
            DROP VIEW IF EXISTS v_progres_approval_izin;
            DROP VIEW IF EXISTS v_santri_sedang_izin;
            DROP VIEW IF EXISTS v_akumulasi_poin_pelanggaran;
        ");`);

console.log('Migrations created successfully.');
