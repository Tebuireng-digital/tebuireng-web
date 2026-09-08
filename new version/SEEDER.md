# Seeder, Baseline Lama, dan Overlay EXCEL BARU

Dokumen ini menjadi acuan pengisian database SIMANTEB. Sumber utama data
operasional adalah workbook master canonical; workbook asal dipakai sebagai
bahan pembentukan, audit, dan perbaikan data, bukan langsung dicampur ke
database tanpa proses pencocokan.

## Kesimpulan utama

Database diisi melalui empat mekanisme berbeda:

1. **Migration** membuat struktur tabel dan beberapa migration juga mengisi atau mengubah data.
2. **Seeder Laravel** mengisi master aplikasi, akun pengembangan, organisasi daerah, dan alumni tertentu.
3. **Command import Excel/JSON** mengisi data santri, roster kegiatan, kamar, petugas dari workbook, pelanggaran, dan prestasi.
4. **Input aplikasi** mengisi transaksi operasional setelah aplikasi digunakan, seperti absensi, izin, pelanggaran baru, notifikasi, dan log.

Untuk data putra rilis awal, pembacaan sumber data mengikuti urutan canonical berikut:

1. `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx` menjadi master santri putra untuk nomor induk, nama, unit, kelas formal, komplek, kamar, dan roster Madin/PBS/PBM.
2. `data/Database_Pelanggaran_Santri_Tebuireng.xlsx` menjadi sumber master pelanggaran dan tabel sanksi; sheet input pelanggaran diperlakukan sebagai histori yang harus melalui pencocokan santri.
3. `data/data_alumni.xlsx` menjadi sumber alumni.
4. `data/data_rekam_santri.xlsx` menjadi sumber histori pelanggaran/prestasi. Identitasnya harus dicocokkan ke master putra sebelum transaksi dibuat.

Workbook sumber pembentuk master tetap disimpan sebagai bahan audit:

- `xlsx/DATA NOMOR INDUK PONDOK.xlsx`, sheet `PUTRA`;
- `xlsx/Database_Kelas_Madin_2026_2027.xlsx`;
- `xlsx/Database_Kelompok_AlQuran (belajar habis subuh)_2026_2027.xlsx`;
- `xlsx/Database_Takhassus (belajar habis maghrib)_2026_2027.xlsx`.

Sheet `PUTRI` belum termasuk scope master ini dan akan diproses pada tahap terpisah.

Dokumen ini mengikuti istilah role pada PRD baru:

- **Piket Pengajian** adalah nama produk untuk domain PBS, PBM, dan Madin.
- Role internal yang menjadi acuan adalah **Admin, Keamanan, Pembina Kamar, Wali Kelas, dan Piket Pengajian**.
- Role `Pengasuh` tidak dipakai dalam model role target.

Pengisian data tidak berjalan otomatis ketika container atau server mulai. Migration dapat berjalan otomatis, tetapi seed dan import tetap dijalankan bertahap sesuai kebutuhan environment.

Command `import:master-putra`, `import:master-pelanggaran`, dan
`import:alumni` pada dokumen ini adalah kontrak command target untuk alur seed
canonical terbaru. Jika belum tersedia di codebase, command tersebut harus
diimplementasikan sebelum prosedur bootstrap ini dijalankan pada server.

## 1. Alur Pengisian Database

### Local Docker

`backend/docker/entrypoint.sh` melakukan:

```text
menunggu MySQL
→ composer install jika composer.lock berubah
→ php artisan migrate --force
→ menjalankan command container (serve Laravel)
```

File `xlsx/`, `docs/`, dan `new data/` dipasang ke container local melalui volume pada `compose.yaml`, tetapi pemasangan file tersebut **tidak berarti import otomatis**.

Untuk mengisi database local, perintahnya harus dijalankan manual:

```bash
# 1. Seed referensi dasar dan fixture local/testing
docker compose exec backend php artisan db:seed --force

# 2. Import master canonical putra dan masukkan kandidat REVIEW_MATCH
#    ke antrean verifikasi Dashboard, bukan langsung digabung
docker compose exec backend php artisan import:master-putra \
  --file="/var/www/data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx"

# 3. Seed master pelanggaran dan aturan sanksi
docker compose exec backend php artisan import:master-pelanggaran \
  --file="/var/www/data/Database_Pelanggaran_Santri_Tebuireng.xlsx"

# 4. Import histori pelanggaran/prestasi setelah master putra tersedia
docker compose exec backend php artisan import:rekam-pelanggaran \
  --file="/var/www/data/data_rekam_santri.xlsx"

# 5. Import alumni dari workbook XLSX
docker compose exec backend php artisan import:alumni \
  --file="/var/www/data/data_alumni.xlsx"
```

Workbook lama tidak lagi menjadi langkah seed canonical putra setelah master
tersedia. `import:excel` hanya dipertahankan untuk compatibility atau audit
legacy, dan tidak boleh dijalankan bersamaan dengan import master putra pada
database yang sama karena dapat membuat santri/roster ganda.

### Production Docker

`backend/docker/production-entrypoint.sh` hanya:

```text
menunggu MySQL
→ menjalankan command image
```

File migration dijalankan oleh service terpisah:

```bash
docker compose --env-file .env.production \
  -f compose.production.yaml \
  --profile tools run --rm migrate
```

Production tidak otomatis menjalankan:

- `php artisan db:seed`;
- `php artisan import:master-putra`;
- `php artisan import:master-pelanggaran`;
- `php artisan import:rekam-pelanggaran`;
- `php artisan import:alumni`.

Pada `compose.production.yaml`, image production juga tidak memasang volume root `xlsx/`, `docs/`, atau `new data/`. Jika import Excel diperlukan di production, file harus disediakan melalui prosedur deployment/import yang terkontrol, lalu command dijalankan pada container yang dapat membaca file tersebut.

## 2. Urutan Seed Referensi

File utama: `backend/database/seeders/DatabaseSeeder.php`.

Urutan seed referensi:

```text
DatabaseSeeder
├─ PetugasSeeder
├─ OrganisasiDaerahSeeder
├─ UbudiyahSeeder
├─ UnitPendidikanSeeder
├─ jenis_kegiatan
├─ jadwal_kegiatan
├─ jenis_izin
├─ aturan_sanksi
└─ pengaturan_sistem
```

### 2.1 `PetugasSeeder`

File: `backend/database/seeders/PetugasSeeder.php`.

Sumber data:

- akun bootstrap local/testing untuk role internal;
- `backend/database/data_user.json`, jika file disediakan.

Akun bootstrap local/testing yang perlu tersedia:

| Username saran     | Nama contoh          | Role target     |
| ------------------ | -------------------- | --------------- |
| `admin`          | User Admin           | Admin           |
| `keamanan`       | User Keamanan        | Keamanan        |
| `pembinakamar`   | User Pembina Kamar   | Pembina Kamar   |
| `piketpengajian` | User Piket Pengajian | Piket Pengajian |
| `walikelas`      | User Wali Kelas      | Wali Kelas      |

Perilaku penting:

- hanya boleh berjalan pada environment `local` atau `testing`;
- password menggunakan `LOCAL_SEED_PASSWORD`, default `masuk123`;
- akun di `data_user.json` memakai password fixture yang sama;
- setiap akun bootstrap wajib dipetakan ke role produk yang resmi;
- penugasan demo dapat dibersihkan lalu dibentuk ulang saat bootstrap local/testing agar data uji tetap konsisten;
- akun portal wali tidak membutuhkan fixture hardcoded karena dibentuk dari `no_id_induk` saat overlay santri dijalankan.

Production tidak memakai `PetugasSeeder` untuk bootstrap petugas. Akun produksi disiapkan melalui prosedur provisioning yang terkontrol.

Catatan penting:

- file `new data/data_user.xlsx` tidak menjadi sumber seed;
- format acuan bootstrap petugas berbasis file adalah `backend/database/data_user.json`;
- domain PBS, PBM, dan Madin dipetakan ke role **Piket Pengajian**.

### 2.2 `OrganisasiDaerahSeeder`

File: `backend/database/seeders/OrganisasiDaerahSeeder.php`.

Sumber data: daftar organisasi hardcoded di PHP, bukan Excel atau JSON.

Seeder memakai `updateOrInsert` berdasarkan `kode_singkat`. Data yang diisi mencakup nama organisasi, wilayah, dan status aktif.

Catatan: migration profil santri juga memiliki sejarah pembuatan/pengisian `organisasi_daerah`. Karena repository memiliki beberapa perubahan schema organisasi, jalankan semua migration dalam urutan timestamp dan jangan mengimpor SQL schema lama secara parsial.

### 2.3 `UbudiyahSeeder`

File: `backend/database/seeders/UbudiyahSeeder.php`.

Sumber data: daftar instrumen awal di PHP.

Seeder ini memakai `updateOrInsert` berdasarkan `nama_instrumen`, mengaktifkan instrumen, dan memakai akun `admin` sebagai `dibuat_oleh` bila tersedia.

Catatan acuan produk:

- namespace teknis tetap `master_instrumen_ubudiyah`;
- secara produk, modul ini dibaca sebagai **Raport Pembinaan**;
- instrumen seed berfungsi sebagai baseline awal dan tetap dapat dikelola dari aplikasi.

### 2.4 Master `unit_pendidikan`

Sumber:

- `UnitPendidikanSeeder` yang membaca kolom `Pend` dari `docs/EXCEL BARU/data_santri_semua.xls`;
- migration `2026_08_09_000002_add_source_units_and_kegiatan_participation.php` yang memastikan unit sumber tambahan tetap tersedia.

Kode unit minimum yang harus tersedia:

```text
MTS, SMP, SMA, SMK, MA
```

Tambahan unit sumber yang dijaga oleh migration:

```text
MTSS, SMPT, SMAT, MAS, MU, THS
```

Dengan demikian, daftar unit pada bootstrap baru bergantung pada data `Pend` dari `EXCEL BARU`, dengan migration sebagai pagar minimum untuk unit sumber tambahan. `MTS` berbeda dari `MTSS`, dan `SMP` berbeda dari `SMPT`; aplikasi tidak melakukan alias otomatis.

### 2.5 Master kegiatan dan jadwal baseline

Seed referensi menyiapkan lima kode kegiatan teknis yang menjadi dasar enam modul operasional:

| Kode teknis | Nama seed                | Jadwal awal                                                    | Pembacaan menurut PRD baru                                        |
| ----------- | ------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `KAMAR`   | Kegiatan Kamar           | sesi pagi untuk Keberangkatan Kelas dan sesi malam untuk Kamar | dipakai oleh dua modul operasional: Keberangkatan Kelas dan Kamar |
| `SEKOLAH` | Kelas Formal             | Absensi Kelas Formal, 07:00–07:30                             | Kelas Formal                                                      |
| `PBS`     | Kelompok Al-Qur'an Subuh | 05:00–06:00                                                   | domain Piket Pengajian                                            |
| `PBM`     | Takhasus Maghrib         | 18:30–19:30                                                   | domain Piket Pengajian                                            |
| `DINIYAH` | Kelas Madin              | 15:30–16:00                                                   | domain Piket Pengajian                                            |

Catatan penting:

- pemisahan enam modul operasional pada PRD baru tidak berarti ada enam kode teknis di seed; `Keberangkatan Kelas` dan `Kamar` masih berbagi kode teknis `KAMAR`;
- rumpun `KAMAR` perlu memiliki dua jadwal operasional: sesi pagi untuk `Keberangkatan Kelas` dan sesi malam untuk `Kamar`;
- blok kegiatan, jadwal, jenis izin, aturan sanksi, dan pengaturan sistem memakai `updateOrInsert` agar bootstrap referensi tetap idempoten.

### 2.6 Jenis izin

Data hardcoded:

- Izin Pulang;
- Izin Sakit;
- Izin Keluar Komplek.

### 2.7 Aturan sanksi

Data hardcoded berdasarkan rentang poin 1–100:

| Rentang | Tindakan                                  |
| ------: | ----------------------------------------- |
|   1–19 | Teguran lisan dan pembinaan               |
|  20–29 | Teguran tertulis/SP1 atau botak           |
|  30–49 | Pemanggilan orang tua/SP2                 |
|  50–79 | SP3 dan skorsing                          |
| 80–100 | Dikembalikan kepada orang tua/dikeluarkan |

Sheet `Tabel Sanksi` dari workbook pelanggaran menjadi sumber canonical melalui
`import:master-pelanggaran`. Aturan hardcoded di seeder hanya menjadi fallback
untuk environment yang belum menjalankan import workbook.

### 2.8 Pengaturan sistem

`DatabaseSeeder` mengisi pengaturan gateway WhatsApp, batas overdue, ambang SP, toleransi input absensi, durasi edit, dan ambang notifikasi poin.

Nilai berikut adalah contoh development dan tidak boleh dipakai mentah di production:

```text
WA_API_URL = http://localhost:3000/send
WA_API_KEY = secret-key-123
```

Production harus mengubahnya melalui prosedur secret/configuration yang aman.

## 3. Data yang diisi oleh migration

Migration bukan hanya membuat tabel. Beberapa migration melakukan data backfill atau insert:

| Migration                                                          | Pengisian/perubahan data                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `2026_07_29_062600_add_password_to_santri_table`                 | Mengisi password default santri lama dengan hash                                       |
| `2026_07_31_130000_backfill_explicit_roster_assignments`         | Membuat penugasan petugas dari metadata kamar/kelas yang sudah ada                     |
| `2026_07_31_145000_normalize_pbs_group_names`                    | Menormalisasi dan menghapus konflik nama kelompok PBS                                  |
| `2026_07_31_150000_remove_total_madin_pbm_rosters`               | Menghapus roster kelompok`TOTAL` yang tidak valid bila tidak dipakai                 |
| `2026_07_31_152000_remove_duplicate_madin_roster`                | Menghapus duplikasi roster Madin tertentu                                              |
| `2026_08_06_000001_add_poin_to_pelanggaran_table`                | Mengisi/backfill nilai poin pelanggaran                                                |
| `2026_08_09_000001_expand_santri_profile_and_verification`       | Membuat tabel profil keluarga/pendidikan/organisasi/roster dan mengisi organisasi awal |
| `2026_08_09_000002_add_source_units_and_kegiatan_participation`  | Menambah enam unit sumber dan tabel partisipasi kegiatan                               |
| `2026_08_09_000003_assign_all_formal_classes_to_demo_wali_kelas` | Memberi penugasan kelas formal kepada wali kelas demo bila tersedia                    |
| `2026_08_10_000004_cleanup_empty_legacy_kelas_formal`            | Membersihkan kelas formal kosong dan penugasannya                                      |

Karena migration dapat mengubah data existing, backup database wajib dilakukan sebelum deploy migration baru.

## 4. Master Canonical dan Review Dashboard

### 4.0 Model penggabungan sumber

Pengisian database rilis awal dibaca sebagai lapisan berikut:

| Lapisan              | Sumber utama                                                                            | Fungsi                                                                                       | Sifat perubahan        |
| -------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------- |
| Seed referensi       | `DatabaseSeeder` dan seeder eksplisit                                                 | menyiapkan master dasar, fixture local/testing, instrumen awal, dan pengaturan sistem        | referensi awal         |
| Master santri putra  | `xlsx/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx` lewat `import:master-putra`          | sumber canonical identitas, kelas formal, kamar, Madin, PBS, dan PBM                         | sumber utama putra     |
| Review pencocokan    | sheet`REVIEW_MATCH` dari master                                                       | menampilkan kandidat yang belum cukup aman untuk merge di Dashboard                          | tidak masuk otomatis   |
| Master pelanggaran   | `xlsx/Database_Pelanggaran_Santri_Tebuireng.xlsx` lewat `import:master-pelanggaran` | mengisi kategori pelanggaran dan aturan sanksi                                               | referensi kedisiplinan |
| Histori rekam santri | `docs/EXCEL BARU/data_rekam_santri.xlsx` lewat `import:rekam-pelanggaran`           | mengisi histori pelanggaran/prestasi setelah identitas cocok                                 | overlay histori        |
| Alumni               | `docs/EXCEL BARU/data_alumni.xlsx` lewat `import:alumni`                            | mengisi tabel alumni                                                                         | data arsip             |
| Input aplikasi       | UI + API operasional                                                                    | menghasilkan transaksi berjalan seperti absensi, izin, pelanggaran baru, notifikasi, dan log | data hidup harian      |

Pengecualian penting: walaupun `db:seed` termasuk lapisan seed referensi, `UnitPendidikanSeeder` di dalamnya tetap membaca `docs/EXCEL BARU/data_santri_semua.xls` untuk menyinkronkan kode unit pendidikan.

Aturan baca praktis:

- anggap `MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx` sebagai sumber kebenaran awal putra;
- jangan menggabungkan ulang workbook pembentuk ke database setelah master canonical diimpor;
- kandidat di `REVIEW_MATCH` hanya menjadi data review sampai Admin menetapkan santri target dan menyimpan keputusan;
- histori dari `data_rekam_santri.xlsx` dicocokkan dengan `no_id_induk` terlebih dahulu, lalu nama exact yang sudah dinormalisasi, kemudian fuzzy match sesuai confidence threshold;
- kandidat histori yang ambigu atau tidak cocok masuk antrean review dan tidak membuat transaksi pelanggaran/prestasi;
- untuk domain PBS, PBM, dan Madin, dokumen ini selalu memakai istilah **Piket Pengajian**.

### 4.1 Master canonical putra

File `xlsx/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx` memiliki tiga sheet:

| Sheet            | Fungsi                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `MASTER_PUTRA` | satu baris canonical per santri putra dengan identitas, kelas, kamar, Madin, PBS, dan PBM               |
| `REVIEW_MATCH` | kandidat roster yang tidak aman untuk merge otomatis, lengkap dengan skor kemiripan dan kandidat santri |
| `SUMMARY`      | jumlah baris, hasil exact match, fuzzy match, review, dan unmatched                                     |

Aturan import master:

- `no_id_induk` dari `MASTER_PUTRA` menjadi identitas utama santri;
- kelas formal memakai gabungan unit pendidikan dan kelas, misalnya `MA 3A`;
- nilai Madin, PBS, dan PBM dapat berisi lebih dari satu assignment dan tidak boleh dipotong menjadi satu nilai;
- kamar, kelas, dan kelompok yang berasal dari master membentuk roster aktif periode yang sedang di-seed;
- kolom status pencocokan disimpan sebagai metadata import/audit, bukan sebagai status bisnis santri;
- tidak ada data putri yang diimpor dari workbook ini.

#### Review pencocokan di Dashboard

- setiap baris `REVIEW_MATCH` disimpan ke antrean review dengan sumber, nama, kamar, kandidat, similarity, edit distance, dan status;
- Admin dapat memilih kandidat santri yang benar, menandai `bukan santri yang sama`, atau memperbaiki mapping roster;
- keputusan review menyimpan actor, waktu, nilai sebelum, nilai sesudah, dan sumber workbook;
- setelah disetujui, sistem mengisi assignment atau histori yang relevan tanpa membuat santri duplicate;
- kandidat `UNMATCHED` tidak boleh dibuat sebagai santri baru tanpa keputusan Admin eksplisit;
- review yang belum selesai tidak boleh dianggap sebagai data roster lengkap.

### 4.2 Ringkasan sumber data tambahan

Sumber yang digunakan pada seed terbaru dan tujuan databasenya:

| Data bisnis                   | File yang disiapkan                                                 | File sumber yang dibaca                                      | Command/seeder                                       | Tabel tujuan                                                                                                |
| ----------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Master santri putra           | `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`                    | `.xlsx`, sheet `MASTER_PUTRA` dan `REVIEW_MATCH`       | `php artisan import:master-putra --file=...`       | `santri`, `kelas_formal`, `kamar`, `kelompok_madin`, `kelompok_pbs`, `kelompok_pbm`, assignment |
| Master pelanggaran dan sanksi | `data/Database_Pelanggaran_Santri_Tebuireng.xlsx`                 | `.xlsx`, sheet `Master Pelanggaran` dan `Tabel Sanksi` | `php artisan import:master-pelanggaran --file=...` | `kategori_pelanggaran`, `aturan_sanksi`                                                                 |
| Histori rekam santri          | `data/data_rekam_santri.xlsx`                                     | `.xlsx`, sheet `Detail Rekam Jejak`                      | `php artisan import:rekam-pelanggaran --file=...`  | `pelanggaran`, `prestasi`, antrean review bila identitas ambigu                                         |
| Alumni                        | `data/data_alumni.xlsx`                                          | `.xlsx`, sheet `Daftar Alumni`                           | `php artisan import:alumni --file=...`             | `alumni`                                                                                                  |
| Profil santri tambahan        | `docs/EXCEL BARU/data_santri_semua.xls`                           | `.xls` HTML-table, hanya enrichment opsional               | command overlay terpisah                             | tabel profil santri terkait                                                                                 |
| Data wisma                    | `docs/EXCEL BARU/data_wisma.xlsx` dan `.json`                   | Belum dipakai                                                | Tidak ada command aktif                              | Tidak ada                                                                                                   |
| Data user/pengurus            | `backend/database/data_user.json` dan `new data/data_user.xlsx` | `.json` pada `PetugasSeeder`                             | `php artisan db:seed` di local/testing             | `petugas`                                                                                                 |

Istilah “`data_santri_semua.xlsx`” dapat digunakan sebagai nama bisnis, tetapi file sumber yang dipakai adalah `data_santri_semua.xls`. File tersebut bukan XLSX modern; isinya berupa HTML table yang diproses dengan `DOMDocument`. Jangan mengganti ekstensi atau format file tanpa menyesuaikan command import.

Dengan kata lain, file tidak otomatis masuk hanya karena berada di local.
Master canonical, master pelanggaran, histori, dan alumni harus diimpor melalui
urutan command yang terdokumentasi.

### 4.3 `import:excel` (legacy compatibility)

File: `backend/app/Console/Commands/ImportExcelCommand.php`.

Sumber default: folder `../xlsx/` relatif terhadap `backend/`. Folder `docs/excel/`
dianggap salinan/sumber yang setara; sebelum import, pastikan workbook yang
dipakai memiliki versi dan checksum yang sama bila kedua folder tersedia.

Data yang diisi:

| Sumber                      | Tabel utama                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| Database Santri Kamar       | `petugas`, `kamar`, `petugas_penugasan`, `santri`        |
| Database Siswa              | `petugas`, `kelas_formal`, `petugas_penugasan`, `santri` |
| Database Kelas Madin        | `kelompok_madin`, `santri`                                   |
| Database Kelompok Al-Qur'an | `kelompok_pbs`, `santri`                                     |
| Database Takhassus          | `kelompok_pbm`, `santri`                                     |
| Master Pelanggaran          | `kategori_pelanggaran`                                         |

Peran dalam strategi pengisian:

- command ini bukan sumber canonical putra setelah `MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx` tersedia;
- jangan menjalankannya pada database yang sudah diisi master canonical karena dapat membuat santri atau roster ganda;
- command ini hanya dipakai untuk compatibility, audit legacy, atau database eksperimen terpisah.

Output tambahan:

- `storage/app/mapping-kamar-draft.csv`;
- `storage/app/santri-review-kandidat.xlsx`;
- `storage/app/santri-review-baru.xlsx`;
- `storage/app/private/credentials/akun-petugas-*.csv`.

Import ini tidak dijalankan oleh `db:seed` dan tidak dijalankan otomatis oleh entrypoint.

### 4.4 `import:santri-baru` (enrichment opsional)

File: `backend/app/Console/Commands/ImportSantriBaruCommand.php`.

Sumber default yang dicari berurutan:

1. `../new data/data_santri_semua.xls`;
2. `../xlsx/data_santri_semua.xls`.

File utama overlay santri ditempatkan di `docs/EXCEL BARU/data_santri_semua.xls`, sehingga pada server sebaiknya selalu gunakan `--file` secara eksplisit.

Data yang diisi atau diperbarui:

- `santri`;
- `santri_keluarga`;
- `santri_pendidikan` untuk tahun ajaran `2026/2027`;
- `santri_kegiatan_partisipasi`;
- `kelas_formal` bila kelas dari `Pend` dan `Kls` belum ada;
- `wali_accounts` bila `no_id_induk` tersedia dan tabelnya ada.

Aturan enrichment yang penting:

- command ini bukan pengganti master canonical dan tidak boleh mengubah nomor induk master secara diam-diam;
- pencocokan prioritasnya adalah `no_id_induk` lalu nama exact yang dinormalisasi;
- kandidat nama ambigu masuk review Dashboard, bukan langsung membuat santri baru;
- kode `Pend` dibaca secara persis. Karena itu `MTSS`, `SMPT`, dan `THS` membutuhkan record unit hasil migration;
- jika kamar dari enrichment tidak dapat dipetakan, kamar existing dari master tidak dihapus;
- partisipasi kegiatan yang dibentuk tetap mengikuti lima kode teknis existing. Pemecahan menjadi enam modul operasional tetap menjadi urusan produk/UI.

### 4.5 `import:master-pelanggaran`

Sumber: `xlsx/Database_Pelanggaran_Santri_Tebuireng.xlsx`.

- Sheet `Master Pelanggaran` menjadi sumber `kategori_pelanggaran`, termasuk
  kode pasal, kategori, uraian, poin maksimal, jenis, dan status aktif.
- Sheet `Tabel Sanksi` menjadi sumber `aturan_sanksi` berdasarkan rentang
  akumulasi poin dan tindakan sanksi.
- Sheet `Input Pelanggaran Santri` menjadi sumber histori pelanggaran tambahan;
  barisnya harus memiliki identitas santri dan tanggal yang dapat diverifikasi.
- Histori dari sheet tersebut diproses dengan duplicate guard yang sama dengan
  `data_rekam_santri.xlsx`; baris yang tidak cocok masuk review Dashboard.
- Seed master pelanggaran bersifat idempoten berdasarkan kode pasal atau
  identifier bisnis yang disepakati, bukan insert buta setiap kali dijalankan.

### 4.6 `import:rekam-pelanggaran`

File: `backend/app/Console/Commands/ImportRekamPelanggaranCommand.php`.

Sumber canonical: `docs/EXCEL BARU/data_rekam_santri.xlsx`, sheet
`Detail Rekam Jejak`. Sheet `Daftar Santri` hanya digunakan sebagai referensi
tambahan jika diperlukan, bukan sumber master santri kedua.

Data masuk ke:

- `prestasi` jika deskripsi terdeteksi sebagai prestasi;
- `pelanggaran` jika dianggap pelanggaran;
- referensi kategori berasal dari `kategori_pelanggaran`.

Pencocokan identitas:

- prioritas pertama adalah `No ID (Induk)` ke `santri.no_id_induk` pada master;
- jika nomor induk kosong atau tidak ditemukan, gunakan nama exact setelah
  normalisasi tanda baca dan spasi;
- fuzzy match hanya boleh otomatis jika confidence memenuhi threshold yang
  sama dengan pembentukan `MASTER_PUTRA`;
- kandidat ambigu, unmatched, atau memiliki lebih dari satu kandidat masuk
  review Dashboard dan tidak membuat transaksi.

Peran dalam strategi pengisian:

- ini adalah overlay histori, bukan pembentuk master kategori;
- record `prestasi` hasil import masuk sebagai data internal yang pada PRD baru dibaca sebagai domain Admin untuk pengalaman petugas;
- portal wali tetap dapat membaca hasil akhirnya secara read-only sesuai kontrak produk.

Import histori wajib memiliki duplicate guard berdasarkan santri, tanggal,
deskripsi, poin, dan sumber baris atau checksum batch. Menjalankannya dua kali
tidak boleh menggandakan riwayat.

### 4.7 `import:alumni`

Sumber canonical: `docs/EXCEL BARU/data_alumni.xlsx`, sheet `Daftar Alumni`.

- `No ID (Induk)` menjadi identifier utama alumni;
- `Nama Alumni`, jenis kelamin, tempat/tanggal lahir, orang tua, jenjang,
  kelas, kontak, saldo, wilayah, provinsi, angkatan, dan tahun lulus dipetakan
  ke tabel `alumni`;
- import harus upsert berdasarkan nomor induk, bukan truncate tabel secara
  default;
- data alumni yang sudah diedit dari aplikasi tidak boleh hilang saat import
  ulang tanpa mode replace dan backup eksplisit.

### 4.8 Data yang tersedia tetapi tidak dibaca otomatis

- workbook pembentuk master yang sudah dirangkum ke `MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`;
- `docs/EXCEL BARU/data_wisma.xlsx`;
- `docs/EXCEL BARU/data_wisma.json`;
- `new data/data_user.xlsx`;
- `xlsx/laporan-kehadiran.pdf`.

Keberadaan file-file tersebut di local tidak berarti datanya sudah ada di database.

## 5. Klasifikasi tabel berdasarkan sumber

| Tabel                             |          Migration          |        Seeder        |        Excel/JSON import        |       Input aplikasi       |
| --------------------------------- | :--------------------------: | :-------------------: | :-----------------------------: | :------------------------: |
| `unit_pendidikan`               |       ✓ tambahan unit       |     ✓ unit dasar     |  ✓ dipakai sebagai referensi  |                            |
| `jenis_kegiatan`                |                              |  ✓ baseline teknis  |                                |                            |
| `jadwal_kegiatan`               |                              |  ✓ jadwal baseline  |                                | ✓ dipakai operasi harian |
| `jenis_izin`                    |                              |     ✓ hardcoded     |                                |  ✓ dipakai operasi izin  |
| `pengaturan_sistem`             |                              |    ✓ baseline dev    |                                |      ✓ operasi/admin      |
| `petugas`                       |                              | ✓ akun local/testing |    ✓ petugas dari workbook    |  ✓ admin dapat mengubah  |
| `organisasi_daerah`             | ✓ struktur/perubahan schema |  ✓ master hardcoded  |                                |    ✓ admin assignment    |
| `kamar`                         |                              |                      |       ✓`MASTER_PUTRA`       |      ✓ master admin      |
| `kelas_formal`                  |                              |                      | ✓`MASTER_PUTRA`/`Pend+Kls` |      ✓ master admin      |
| `kelompok_madin/pbs/pbm`        |                              |                      |       ✓`MASTER_PUTRA`       |      ✓ master admin      |
| `santri`                        |     ✓ backfill tertentu     |                      |       ✓`MASTER_PUTRA`       |   ✓ perubahan aplikasi   |
| `santri_keluarga`               |         ✓ struktur         |                      |        ✓ profil lengkap        |       ✓ edit profil       |
| `santri_pendidikan`             |         ✓ struktur         |                      |        ✓ profil lengkap        |       ✓ edit profil       |
| `santri_kegiatan_partisipasi`   |         ✓ struktur         |                      |        ✓ profil lengkap        |    ✓ verifikasi admin    |
| `wali_accounts`                 |         ✓ struktur         |                      |    ✓ overlay`no_id_induk`    |       ✓ portal wali       |
| `kategori_pelanggaran`          |                              |                      |    ✓`Master Pelanggaran`    |  ✓ tambah dari aplikasi  |
| `aturan_sanksi`                 |                              |      ✓ fallback      |       ✓`Tabel Sanksi`       |                            |
| `master_instrumen_ubudiyah`     |                              |   ✓ instrumen awal   |                                | ✓ admin/pembina mengelola |
| `alumni`                        |         ✓ struktur         |                      |       ✓`Daftar Alumni`       |   ✓ perubahan aplikasi   |
| `prestasi`                      |         ✓ struktur         |                      |         ✓ rekam santri         |     ✓ input aplikasi     |
| `absensi`                       |         ✓ struktur         |                      |                                |   ✓ transaksi aplikasi   |
| `perizinan`                     |         ✓ struktur         |                      |                                |   ✓ transaksi aplikasi   |
| `pelanggaran`                   |       ✓ backfill poin       |                      |         ✓ rekam santri         |     ✓ input aplikasi     |
| `notifikasi`, `log_aktivitas` |         ✓ struktur         |                      |                                |     ✓ event/aplikasi     |

## 6. Prosedur bootstrap local yang benar

Untuk database local baru yang akan diisi penuh mendekati acuan PRD:

```bash
docker compose up -d
docker compose exec backend php artisan migrate:status
docker compose exec backend php artisan db:seed --force
docker compose exec backend php artisan import:master-putra \
  --file="/var/www/data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx"
docker compose exec backend php artisan import:master-pelanggaran \
  --file="/var/www/data/Database_Pelanggaran_Santri_Tebuireng.xlsx"
docker compose exec backend php artisan import:rekam-pelanggaran \
  --file="/var/www/data/data_rekam_santri.xlsx"
docker compose exec backend php artisan import:alumni \
  --file="/var/www/data/data_alumni.xlsx"
```

Path `/var/www/data/...` berasal dari mount canonical
`./data:/var/www/data:ro`. Folder `xlsx/` tetap dipertahankan untuk compatibility
legacy dan audit sumber pembentuk master.

Setelah import, Admin wajib membuka antrean review Dashboard dan menyelesaikan
kandidat `REVIEW_MATCH` sebelum menganggap roster lengkap. `import:excel` dan
`import:santri-baru` hanya dijalankan pada environment compatibility yang belum
menggunakan master canonical.

Jangan menjalankan `db:seed` berulang pada database local yang sudah berisi data. Walaupun master teknis relatif idempoten, fixture petugas dan relasi turunannya sebaiknya di-bootstrap dengan urutan yang tetap.

## 7. Prosedur Bootstrap Production

Untuk production, gunakan baseline referensi terkontrol dan jalankan impor bertahap sebagai berikut:

1. Buat atau restore database baseline yang sudah diverifikasi.
2. Jalankan seluruh migration terbaru dengan service `migrate`.
3. Sediakan akun admin production serta role target produk melalui prosedur provisioning yang aman, bukan `PetugasSeeder` fixture local/testing.
4. Sediakan file Excel di container/job import secara terkontrol.
5. Sediakan dan checksum file master putra, master pelanggaran, rekam santri,
   dan alumni sebelum import.
6. Jalankan `import:master-putra`, lalu `import:master-pelanggaran`, histori
   rekam santri, dan alumni secara terpisah setelah backup.
7. Selesaikan antrean review Dashboard sebelum mengaktifkan roster operasional.
8. Verifikasi jumlah unit, santri, kamar, kelas, kelompok, kategori
   pelanggaran, alumni, akun, dan wali account.

Perintah berikut tidak digunakan pada production:

```bash
php artisan db:seed --force
php artisan migrate --seed
```

Alasannya, keduanya memanggil `DatabaseSeeder`, sedangkan `PetugasSeeder` hanya diperuntukkan bagi environment `local` dan `testing`.

## 8. Verifikasi sumber data setelah pengisian

```sql
SELECT kode, nama
FROM unit_pendidikan
ORDER BY kode;

SELECT jabatan, COUNT(*) AS jumlah
FROM petugas
GROUP BY jabatan
ORDER BY jabatan;

SELECT COUNT(*) AS jumlah_petugas FROM petugas;
SELECT COUNT(*) AS jumlah_santri FROM santri;
SELECT COUNT(*) AS jumlah_kamar FROM kamar;
SELECT COUNT(*) AS jumlah_kelas FROM kelas_formal;
SELECT COUNT(*) AS jumlah_madin FROM kelompok_madin;
SELECT COUNT(*) AS jumlah_pbs FROM kelompok_pbs;
SELECT COUNT(*) AS jumlah_pbm FROM kelompok_pbm;
SELECT COUNT(*) AS jumlah_kategori_pelanggaran FROM kategori_pelanggaran;
SELECT COUNT(*) AS jumlah_wali_accounts FROM wali_accounts;
SELECT COUNT(*) AS jumlah_instrumen_ubudiyah FROM master_instrumen_ubudiyah;
SELECT COUNT(*) AS jumlah_pelanggaran FROM pelanggaran;
SELECT COUNT(*) AS jumlah_prestasi FROM prestasi;
SELECT COUNT(*) AS jumlah_review_import FROM santri_import_reviews;
```

Verifikasi file dan antrean hasil import:

- `xlsx/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`;
- sheet `REVIEW_MATCH` dan jumlah `santri_import_reviews`;
- hasil import master pelanggaran dan aturan sanksi;
- `storage/app/private/credentials/`.

## 9. Keputusan operasional

- **Migration** adalah sumber kebenaran struktur database dan data backfill.
- **Seeder** adalah sumber kebenaran master aplikasi dan bootstrap local/testing.
- **`data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`** adalah sumber canonical putra untuk seed awal.
- Workbook pembentuk di `/xlsx` dan `docs/excel/` disimpan sebagai bahan audit dan hanya diproses ulang saat membangun versi master baru.
- `data/data_rekam_santri.xlsx` dan `data/data_alumni.xlsx` adalah sumber histori/alumni yang diimpor setelah master canonical tersedia.
- Kandidat `REVIEW_MATCH` dan identitas histori yang ambigu harus diselesaikan melalui Dashboard, bukan merge otomatis.
- Untuk domain PBS, PBM, dan Madin, role produk yang dipakai adalah **Piket Pengajian**.
- Model role target tidak memakai `Pengasuh`.
- **Excel/JSON import** adalah sumber data santri dan data operasional historis, bukan bagian otomatis dari migration.
- **SQL dump** dipakai untuk backup atau baseline production yang sudah diverifikasi, bukan pengganti migration pada setiap deployment.
- Local dan server harus menjalankan commit code serta seluruh migration yang sama sebelum membandingkan hasil data.
- `unit_id` tidak boleh disamakan secara manual antara local dan server; yang harus sama adalah `kode` dan `nama` unit.
