-- =====================================================================
-- SKEMA DATABASE: SISTEM PENDATAAN PESANTREN PUTRA
-- (Absensi 5 Kegiatan, Pelanggaran, Perizinan Berjenjang)
-- Target: MySQL 8.0
--
-- Disusun berdasarkan struktur NYATA dari 6 file Excel existing:
--   1. Database_Siswa_Kelas_7_8_9_2026_2027.xlsx        -> kelas_formal (SMP)
--   2. Database_Santri_Kamar_MTS_SMP_SMA_SMK.xlsx       -> kamar
--   3. Database_Kelas_Madin_2026_2027.xlsx              -> kelompok_madin
--   4. Database_Kelompok_AlQuran_..._2026_2027.xlsx     -> kelompok_pbs (subuh)
--   5. Database_Takhassus_..._2026_2027.xlsx            -> kelompok_pbm (maghrib)
--   6. Database_Pelanggaran_Santri_Tebuireng.xlsx        -> kategori_pelanggaran, aturan_sanksi
--
-- CATATAN PENTING HASIL AUDIT DATA EXCEL (baca sebelum import, lihat juga
-- catatan "PANDUAN IMPORT" di akhir file ini):
--   a. Tidak ada NIS/ID unik di 4 dari 6 sheet -> santri diidentifikasi
--      dengan (nama + kamar) sebagai kunci pencocokan saat import awal,
--      BUKAN nama saja (ditemukan 8-22 nama kembar per sheet).
--   b. Kode kamar TIDAK konsisten antar file:
--        - Sheet Kelas Madin, Al-Qur'an, Takhassus pakai kode singkat
--          (AB 201, GD 303, HK 201, dst)
--        - Sheet Database Santri Kamar pakai nama panjang
--          (Hadji Kalla 201, Gus Dur 303, dst)
--      -> perlu tabel mapping kode_kamar <-> nama_kamar sebelum
--         auto-matching santri lintas sheet (lihat tabel `kamar`,
--         kolom `kode_singkat`).
--   c. Kolom "Unit" punya arti BERBEDA di tiap sheet:
--        - Di Database Santri Kamar & Kelas Madin: "Unit" = jenjang
--          pendidikan (MTS/SMP/SMA/SMK/MA)
--        - Di Al-Qur'an & Takhassus: "Unit" = gabungan
--          tingkat+jenjang (mis. "XII MA", "VIII SMP")
--      -> skema ini memisahkan jadi `unit_pendidikan` (jenjang saja)
--         dan `kelas_formal` (tingkat+jenjang+rombel).
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 1. MASTER: WILAYAH / STRUKTUR PENDIDIKAN & ASRAMA
-- =====================================================================

CREATE TABLE unit_pendidikan (
    unit_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode            VARCHAR(10)  NOT NULL UNIQUE COMMENT 'MTS, SMP, SMA, SMK, MA',
    nama            VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE petugas (
    petugas_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nama            VARCHAR(150) NOT NULL,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    no_hp           VARCHAR(20)  NULL,
    jabatan         ENUM('Pengasuh','Ustadz','Pembina Kamar','Wali Kelas','Keamanan','Admin') NOT NULL,
    status_aktif    TINYINT(1) NOT NULL DEFAULT 1,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kamar/Wisma asrama. `kode_singkat` menampung kode yang dipakai
-- sheet Madin/Qur'an/Takhassus (AB, GD, HK, dst) supaya proses
-- matching santri lintas sheet bisa otomatis.
CREATE TABLE kamar (
    kamar_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    unit_id         INT UNSIGNED NULL,
    nama            VARCHAR(100) NOT NULL COMMENT 'Nama lengkap, mis. "Hadji Kalla 201" (dari sheet Database Santri Kamar)',
    kode_singkat    VARCHAR(20)  NULL COMMENT 'Kode dipakai sheet lain, mis. "HK 201" (dari sheet Madin/Quran/Takhassus)',
    pembina_id      INT UNSIGNED NULL COMMENT 'FK petugas berjabatan Pembina Kamar',
    status_aktif    TINYINT(1) NOT NULL DEFAULT 1,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kamar_nama (nama),
    KEY idx_kamar_kode_singkat (kode_singkat),
    CONSTRAINT fk_kamar_unit FOREIGN KEY (unit_id) REFERENCES unit_pendidikan(unit_id),
    CONSTRAINT fk_kamar_pembina FOREIGN KEY (pembina_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kelas formal sekolah (dipakai untuk Absensi Sekolah).
-- Menampung baik format "7A" (SMP, dari Database Siswa) maupun
-- format "VIII D" / "X-D" / "XII BC" (MTS/SMA/SMK/MA, dari Kelas Madin & Takhassus).
CREATE TABLE kelas_formal (
    kelas_formal_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    unit_id         INT UNSIGNED NOT NULL,
    tingkat         VARCHAR(10)  NULL COMMENT 'mis. 7, 8, 9, VII, VIII, X, XII',
    nama_kelas      VARCHAR(50)  NOT NULL COMMENT 'mis. "7A", "VIII D", "X-D", "XII BC"',
    wali_kelas_id   INT UNSIGNED NULL,
    tahun_ajaran    VARCHAR(9)   NOT NULL DEFAULT '2026/2027',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kelas_formal (unit_id, nama_kelas, tahun_ajaran),
    CONSTRAINT fk_kelasformal_unit FOREIGN KEY (unit_id) REFERENCES unit_pendidikan(unit_id),
    CONSTRAINT fk_kelasformal_wali FOREIGN KEY (wali_kelas_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kelompok Madin/Diniyah (dari sheet Database Siswa Madin).
CREATE TABLE kelompok_madin (
    kelompok_madin_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    jenjang           VARCHAR(10)  NOT NULL COMMENT 'MTS, SMP, SMA, SMK, MA (kolom "Jenjang" di sheet)',
    nama_kelas_madin  VARCHAR(50)  NOT NULL COMMENT 'mis. "1 WUSTHA ( A )", "I\'dad B"',
    lokasi_kelas      VARCHAR(100) NULL COMMENT 'dari sheet "Lokasi Kelas"',
    ustadz_id         INT UNSIGNED NULL,
    tahun_ajaran      VARCHAR(9)   NOT NULL DEFAULT '2026/2027',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kelompok_madin (jenjang, nama_kelas_madin, tahun_ajaran),
    CONSTRAINT fk_madin_ustadz FOREIGN KEY (ustadz_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kelompok PBS (mengaji Al-Qur'an habis Subuh), dari sheet Database Al-Qur'an.
CREATE TABLE kelompok_pbs (
    kelompok_pbs_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kategori        VARCHAR(50)  NOT NULL COMMENT 'mis. "KELOMPOK A", "PASCA WISUDA MA"',
    nama_kelompok   VARCHAR(150) NOT NULL,
    lokasi          VARCHAR(100) NULL,
    ustadz_id       INT UNSIGNED NULL,
    tahun_ajaran    VARCHAR(9)   NOT NULL DEFAULT '2026/2027',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kelompok_pbs (kategori, nama_kelompok, tahun_ajaran),
    CONSTRAINT fk_pbs_ustadz FOREIGN KEY (ustadz_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kelompok Takhassus/PBM (belajar habis Maghrib), dari sheet Database Takhassus.
CREATE TABLE kelompok_pbm (
    kelompok_pbm_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kategori        VARCHAR(50)  NOT NULL COMMENT 'mis. "ULYA", "WUSTHO A", "FASOHAH"',
    nama_kelompok   VARCHAR(150) NOT NULL COMMENT 'mis. "ULYA A 1"',
    kelompok_asal   VARCHAR(150) NULL COMMENT 'kolom "Kelompok Asal" pada sheet (opsional)',
    ustadz_id       INT UNSIGNED NULL,
    tahun_ajaran    VARCHAR(9)   NOT NULL DEFAULT '2026/2027',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kelompok_pbm (kategori, nama_kelompok, tahun_ajaran),
    CONSTRAINT fk_pbm_ustadz FOREIGN KEY (ustadz_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 2. MASTER: SANTRI (gabungan dari 5 sheet sumber santri)
-- =====================================================================

CREATE TABLE santri (
    santri_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nis                 VARCHAR(30)  NULL COMMENT 'hanya terisi utk santri di sheet Database Siswa (SMP); NULL utk unit lain',
    nama                VARCHAR(150) NOT NULL,
    unit_id             INT UNSIGNED NOT NULL COMMENT 'jenjang: MTS/SMP/SMA/SMK/MA',
    kamar_id            INT UNSIGNED NULL,
    kelas_formal_id     INT UNSIGNED NULL COMMENT 'diisi jika santri tercatat di sheet Database Siswa atau Kelas Madin unit MTS/SMA/SMK/MA',
    kelompok_madin_id   INT UNSIGNED NULL,
    kelompok_pbs_id     INT UNSIGNED NULL,
    kelompok_pbm_id     INT UNSIGNED NULL,
    nama_wali           VARCHAR(150) NULL,
    no_hp_wali          VARCHAR(20)  NULL,
    status_aktif        TINYINT(1) NOT NULL DEFAULT 1,
    catatan_import      VARCHAR(255) NULL COMMENT 'jejak asal data / status pencocokan saat import awal, lihat PANDUAN IMPORT',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_santri_nama (nama),
    KEY idx_santri_nis (nis),
    CONSTRAINT fk_santri_unit          FOREIGN KEY (unit_id)           REFERENCES unit_pendidikan(unit_id),
    CONSTRAINT fk_santri_kamar         FOREIGN KEY (kamar_id)          REFERENCES kamar(kamar_id),
    CONSTRAINT fk_santri_kelasformal   FOREIGN KEY (kelas_formal_id)   REFERENCES kelas_formal(kelas_formal_id),
    CONSTRAINT fk_santri_kelompokmadin FOREIGN KEY (kelompok_madin_id) REFERENCES kelompok_madin(kelompok_madin_id),
    CONSTRAINT fk_santri_kelompokpbs   FOREIGN KEY (kelompok_pbs_id)   REFERENCES kelompok_pbs(kelompok_pbs_id),
    CONSTRAINT fk_santri_kelompokpbm   FOREIGN KEY (kelompok_pbm_id)   REFERENCES kelompok_pbm(kelompok_pbm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Penugasan petugas ke unit/kamar/kelas/kelompok (many-to-many).
-- Mengisi gap §9.1 PRD: satu Ustadz bisa mengampu >1 kelompok PBS/PBM/Diniyah,
-- dan mendukung rotasi petugas tanpa mengubah skema.
CREATE TABLE petugas_penugasan (
    penugasan_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    petugas_id      INT UNSIGNED NOT NULL,
    tipe_target     ENUM('Kamar','KelasFormal','KelompokMadin','KelompokPBS','KelompokPBM') NOT NULL,
    target_id       INT UNSIGNED NOT NULL COMMENT 'FK polymorphic ke kamar_id/kelas_formal_id/kelompok_*_id sesuai tipe_target',
    tanggal_mulai   DATE NOT NULL,
    tanggal_selesai DATE NULL COMMENT 'NULL = masih berlaku',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_penugasan_petugas (petugas_id),
    KEY idx_penugasan_target (tipe_target, target_id),
    CONSTRAINT fk_penugasan_petugas FOREIGN KEY (petugas_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 3. ABSENSI (5 KEGIATAN, SATU TABEL INTI)
-- =====================================================================

CREATE TABLE jenis_kegiatan (
    jenis_kegiatan_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode              VARCHAR(20)  NOT NULL UNIQUE COMMENT 'KAMAR, SEKOLAH, PBS, PBM, DINIYAH',
    nama              VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE jadwal_kegiatan (
    jadwal_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    jenis_kegiatan_id INT UNSIGNED NOT NULL,
    nama_jadwal       VARCHAR(100) NOT NULL COMMENT 'mis. "Absensi Kamar Malam"',
    jam_mulai         TIME NOT NULL,
    jam_selesai       TIME NOT NULL,
    toleransi_menit   INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'toleransi sebelum dianggap input terlambat',
    status_aktif      TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_jadwal_jenis FOREIGN KEY (jenis_kegiatan_id) REFERENCES jenis_kegiatan(jenis_kegiatan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE absensi (
    absensi_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    santri_id         INT UNSIGNED NOT NULL,
    jenis_kegiatan_id INT UNSIGNED NOT NULL,
    jadwal_id         INT UNSIGNED NOT NULL,
    tanggal           DATE NOT NULL,
    status            ENUM('Hadir','Sakit','Izin','Alpha','Terlambat') NOT NULL,
    menit_terlambat   SMALLINT UNSIGNED NULL COMMENT 'diisi jika status = Terlambat',
    keterangan        VARCHAR(255) NULL,
    waktu_input       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'diisi otomatis server saat baris pertama dibuat',
    diinput_oleh      INT UNSIGNED NOT NULL,
    diubah_oleh       INT UNSIGNED NULL,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_absensi (santri_id, jenis_kegiatan_id, jadwal_id, tanggal),
    KEY idx_absensi_tanggal (tanggal),
    KEY idx_absensi_jenis_tanggal (jenis_kegiatan_id, tanggal),
    CONSTRAINT fk_absensi_santri FOREIGN KEY (santri_id) REFERENCES santri(santri_id),
    CONSTRAINT fk_absensi_jenis  FOREIGN KEY (jenis_kegiatan_id) REFERENCES jenis_kegiatan(jenis_kegiatan_id),
    CONSTRAINT fk_absensi_jadwal FOREIGN KEY (jadwal_id) REFERENCES jadwal_kegiatan(jadwal_id),
    CONSTRAINT fk_absensi_input  FOREIGN KEY (diinput_oleh) REFERENCES petugas(petugas_id),
    CONSTRAINT fk_absensi_ubah   FOREIGN KEY (diubah_oleh) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 4. MODUL PELANGGARAN (dari sheet Master Pelanggaran & Tabel Sanksi)
-- =====================================================================

CREATE TABLE kategori_pelanggaran (
    kategori_pelanggaran_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode_pasal        VARCHAR(30)  NOT NULL COMMENT 'mis. "Pasal 10 ayat 1"',
    kategori          ENUM('Ringan','Sedang','Berat','Kewajiban') NOT NULL COMMENT 'nilai nyata di sheet: Ringan/Sedang/Berat/Kewajiban',
    uraian_pelanggaran TEXT NOT NULL,
    poin_maks         SMALLINT UNSIGNED NOT NULL,
    jenis             ENUM('Pelanggaran','Meninggalkan Kewajiban') NOT NULL,
    status_aktif      ENUM('Aktif','Tidak Aktif') NOT NULL DEFAULT 'Aktif',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kode_pasal (kode_pasal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Referensi statis "Tabel Sanksi" (Pasal 13-14): rentang akumulasi poin -> tindakan.
-- Akumulasi poin dihitung PER JENJANG PENDIDIKAN (sesuai catatan di sheet), maks 100.
CREATE TABLE aturan_sanksi (
    aturan_sanksi_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kategori          ENUM('Ringan','Sedang','Berat') NOT NULL,
    poin_min          SMALLINT UNSIGNED NOT NULL,
    poin_maks         SMALLINT UNSIGNED NOT NULL,
    tindakan_sanksi   TEXT NOT NULL,
    urutan            TINYINT UNSIGNED NOT NULL COMMENT 'urutan tampil sesuai sheet Tabel Sanksi'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pelanggaran (
    pelanggaran_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    santri_id         INT UNSIGNED NOT NULL,
    kategori_pelanggaran_id INT UNSIGNED NOT NULL,
    tanggal           DATE NOT NULL,
    keterangan        TEXT NULL,
    petugas_pencatat_id INT UNSIGNED NOT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_pelanggaran_santri (santri_id),
    KEY idx_pelanggaran_tanggal (tanggal),
    CONSTRAINT fk_pelanggaran_santri   FOREIGN KEY (santri_id) REFERENCES santri(santri_id),
    CONSTRAINT fk_pelanggaran_kategori FOREIGN KEY (kategori_pelanggaran_id) REFERENCES kategori_pelanggaran(kategori_pelanggaran_id),
    CONSTRAINT fk_pelanggaran_petugas  FOREIGN KEY (petugas_pencatat_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lampiran_pelanggaran (
    lampiran_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pelanggaran_id    BIGINT UNSIGNED NOT NULL,
    path_file         VARCHAR(255) NOT NULL,
    diunggah_oleh     INT UNSIGNED NOT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lampiran_pelanggaran FOREIGN KEY (pelanggaran_id) REFERENCES pelanggaran(pelanggaran_id) ON DELETE CASCADE,
    CONSTRAINT fk_lampiran_petugas FOREIGN KEY (diunggah_oleh) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 5. MODUL PERIZINAN BERJENJANG
-- =====================================================================

CREATE TABLE jenis_izin (
    jenis_izin_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nama              VARCHAR(100) NOT NULL,
    urutan_tahap_default VARCHAR(255) NOT NULL DEFAULT 'Pembina Kamar,Keamanan' COMMENT 'daftar jabatan approval dipisah koma, sesuai urutan'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE perizinan (
    perizinan_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    santri_id         INT UNSIGNED NOT NULL,
    jenis_izin_id     INT UNSIGNED NOT NULL,
    keperluan         VARCHAR(255) NOT NULL,
    tanggal_mulai     DATETIME NOT NULL,
    rencana_kembali   DATETIME NOT NULL,
    waktu_keluar_aktual DATETIME NULL,
    waktu_masuk_aktual  DATETIME NULL,
    dicatat_keamanan_oleh INT UNSIGNED NULL,
    status            ENUM('Diajukan','Disetujui','Ditolak','Sedang Berjalan','Selesai') NOT NULL DEFAULT 'Diajukan',
    diajukan_oleh     INT UNSIGNED NOT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_perizinan_santri (santri_id),
    KEY idx_perizinan_status (status),
    KEY idx_perizinan_rencana_kembali (rencana_kembali),
    CONSTRAINT fk_perizinan_santri FOREIGN KEY (santri_id) REFERENCES santri(santri_id),
    CONSTRAINT fk_perizinan_jenis  FOREIGN KEY (jenis_izin_id) REFERENCES jenis_izin(jenis_izin_id),
    CONSTRAINT fk_perizinan_keamanan FOREIGN KEY (dicatat_keamanan_oleh) REFERENCES petugas(petugas_id),
    CONSTRAINT fk_perizinan_pengaju FOREIGN KEY (diajukan_oleh) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE perizinan_approval (
    approval_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    perizinan_id      BIGINT UNSIGNED NOT NULL,
    tahap             TINYINT UNSIGNED NOT NULL COMMENT '1 = Wali Kamar, 2 = Keamanan, dst',
    jabatan_approver  ENUM('Pembina Kamar','Wali Kelas','Ustadz','Pengasuh','Keamanan','Admin') NOT NULL,
    petugas_id        INT UNSIGNED NULL COMMENT 'diisi saat petugas mengambil keputusan',
    keputusan         ENUM('Menunggu','Disetujui','Ditolak','Gugur') NOT NULL DEFAULT 'Menunggu',
    catatan           VARCHAR(255) NULL,
    waktu_keputusan   TIMESTAMP NULL,
    UNIQUE KEY uq_perizinan_tahap (perizinan_id, tahap),
    CONSTRAINT fk_approval_perizinan FOREIGN KEY (perizinan_id) REFERENCES perizinan(perizinan_id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_petugas FOREIGN KEY (petugas_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 6. KONFIGURASI, NOTIFIKASI, AUDIT
-- =====================================================================

CREATE TABLE pengaturan_sistem (
    setting_key       VARCHAR(100) PRIMARY KEY,
    setting_value     VARCHAR(255) NOT NULL,
    keterangan        VARCHAR(255) NULL,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifikasi (
    notifikasi_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    petugas_id        INT UNSIGNED NOT NULL,
    judul             VARCHAR(150) NOT NULL,
    pesan             VARCHAR(500) NOT NULL,
    tipe              VARCHAR(50)  NULL COMMENT 'mis. overdue_izin, ambang_poin, reminder_absensi',
    referensi_tabel   VARCHAR(50)  NULL,
    referensi_id      BIGINT UNSIGNED NULL,
    dibaca            TINYINT(1) NOT NULL DEFAULT 0,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_notifikasi_petugas (petugas_id, dibaca),
    CONSTRAINT fk_notifikasi_petugas FOREIGN KEY (petugas_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE log_aktivitas (
    log_id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    petugas_id        INT UNSIGNED NULL,
    aksi              ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    nama_tabel        VARCHAR(50) NOT NULL,
    record_id         BIGINT UNSIGNED NOT NULL,
    data_sebelum      JSON NULL,
    data_sesudah      JSON NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_log_tabel_record (nama_tabel, record_id),
    CONSTRAINT fk_log_petugas FOREIGN KEY (petugas_id) REFERENCES petugas(petugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 7. DATA AWAL (SEED) — sesuai isi nyata sheet Master Pelanggaran & Tabel Sanksi
-- =====================================================================

INSERT INTO unit_pendidikan (kode, nama) VALUES
 ('MTS','Madrasah Tsanawiyah'),
 ('SMP','Sekolah Menengah Pertama'),
 ('SMA','Sekolah Menengah Atas'),
 ('SMK','Sekolah Menengah Kejuruan'),
 ('MA','Madrasah Aliyah');

INSERT INTO jenis_kegiatan (kode, nama) VALUES
 ('KAMAR','Absensi Kamar'),
 ('SEKOLAH','Absensi Sekolah'),
 ('PBS','Absensi PBS Subuh (Al-Qur\'an)'),
 ('PBM','Absensi PBM Maghrib (Takhassus)'),
 ('DINIYAH','Absensi Diniyah/Madin');

INSERT INTO jenis_izin (nama, urutan_tahap_default) VALUES
 ('Izin Pulang/Keluar Reguler','Pembina Kamar,Keamanan'),
 ('Izin Sakit/Berobat','Pembina Kamar,Keamanan'),
 ('Izin Khusus (>1x24 jam)','Pembina Kamar,Pengasuh,Keamanan');

-- Aturan sanksi persis dari sheet "Tabel Sanksi" (Pasal 13-14)
INSERT INTO aturan_sanksi (kategori, poin_min, poin_maks, tindakan_sanksi, urutan) VALUES
 ('Ringan', 1, 20,  'Pembinaan; Roan', 1),
 ('Ringan', 21, 34, 'Pembinaan; Pemberitahuan orang tua; Roan', 2),
 ('Sedang', 35, 50, 'Pembinaan; Pemanggilan orang tua (peringatan); Digundul (putra)/jilbab pembinaan (putri); Menghafal Juz 30 atau surat pilihan; Menulis surat pilihan; Mengganti rugi sarana prasarana yang dirusak (Pasal 11 ayat 10)', 3),
 ('Sedang', 51, 74, 'Pembinaan; Pemanggilan orang tua (pernyataan); Digundul, wajib lapor shalat 5 waktu 30 hari tanpa putus; Menulis surat pilihan atau menghafal surat tertentu (Yasin, Waqi\'ah, Ar-Rahman) dan Istighosah serta do\'a', 4),
 ('Berat', 75, 75,  'Pembinaan; Pemanggilan orang tua (perjanjian); Pendampingan tenaga ahli; Wajib lapor shalat jama\'ah; Tidak boleh izin keluar pondok selama 3 bulan', 5),
 ('Berat', 100, 100,'Santri/siswa dikembalikan ke orang tua', 6);

INSERT INTO pengaturan_sistem (setting_key, setting_value, keterangan) VALUES
 ('ambang_notifikasi_poin', '75', 'Poin akumulasi (per jenjang) yang memicu notifikasi ke Pengasuh'),
 ('toleransi_menit_terlambat_input', '15', 'Toleransi menit sebelum input absensi dianggap terlambat'),
 ('durasi_edit_absensi_menit', '60', 'Jendela waktu petugas non-Admin boleh mengedit baris absensi setelah input pertama');

-- =====================================================================
-- 8. VIEW UNTUK DASHBOARD & LAPORAN
-- =====================================================================

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

-- =====================================================================
-- PANDUAN IMPORT DATA EXCEL (baca sebelum menjalankan ETL)
-- =====================================================================
-- Urutan import supaya foreign key terpenuhi:
--   1. unit_pendidikan, jenis_kegiatan, jenis_izin (sudah di-seed di atas)
--   2. petugas          <- ambil dari kolom "Pembina" (Kamar), "Wali Kelas" (Siswa),
--                          "Petugas Pencatat" (Pelanggaran) -> unik-kan nama jadi 1 baris/orang.
--   3. kamar             <- gabungkan sheet "Database Santri Kamar" (nama lengkap + pembina)
--                          dengan kode singkat dari sheet Madin/Qur'an/Takhassus.
--                          WAJIB buat tabel mapping manual kode_singkat -> nama:
--                            AB -> ? , GD -> Gus Dur, HK -> Hadji Kalla, dst.
--                          (baru 1 dari 79 kode Madin yang cocok string persis
--                          dengan nama di sheet Kamar, jadi mapping ini tidak
--                          bisa dilakukan otomatis 100%, perlu konfirmasi ke pengasuhan).
--   4. kelas_formal      <- sheet "Database Siswa" (SMP, ada NIS) + kolom "Unit"
--                          di sheet Kelas Madin untuk unit MTS/SMA/SMK/MA.
--   5. kelompok_madin    <- sheet "Rekap Kelas Madin" + "Lokasi Kelas".
--   6. kelompok_pbs      <- sheet "Rekap Kelompok" pada file Al-Qur'an.
--   7. kelompok_pbm      <- sheet "Rekap Kelompok" pada file Takhassus.
--   8. kategori_pelanggaran <- sheet "Master Pelanggaran" (72 baris, apa adanya).
--   9. santri            <- proses matching PALING SENSITIF. Kunci pencocokan:
--                          (nama diseragamkan UPPERCASE+trim) + kamar_id.
--                          Ditemukan saat audit:
--                            - 8-22 nama kembar per sheet (santri berbeda,
--                              nama sama) -> tidak boleh dedup dengan nama saja.
--                            - Hanya ~70-75% nama di sheet Madin/Qur'an/Takhassus
--                              yang match persis ke sheet Kamar -> sisanya perlu
--                              direview manual (kemungkinan beda ejaan atau
--                              santri yang sudah lulus/pindah/keluar antar sheet).
--                          Rekomendasi: jalankan ETL yang menghasilkan 3 kelompok:
--                            (a) match otomatis (nama+kamar identik)
--                            (b) match kandidat (nama identik, kamar beda/kosong -> perlu verifikasi)
--                            (c) tidak match (masuk santri baru, tandai di catatan_import)
--                          lalu serahkan daftar (b) & (c) ke pengasuhan untuk verifikasi
--                          SEBELUM go-live, karena ini menentukan akurasi absensi.
--  10. pelanggaran (opsional) <- sheet "Input Pelanggaran Santri" kosong di file
--                          contoh, jadi tidak ada data historis untuk di-migrasi.
-- =====================================================================