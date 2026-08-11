# Seeder dan Sumber Pengisian Database

Dokumen ini menjelaskan dari mana database Tebuireng diisi pada kondisi repository saat ini. Tujuannya agar proses local dan server tidak dianggap sama jika sebenarnya berbeda.

Status audit: 11 Agustus 2026.

## Kesimpulan utama

Database diisi melalui empat mekanisme berbeda:

1. **Migration** membuat struktur tabel dan beberapa migration juga mengisi atau mengubah data.
2. **Seeder Laravel** mengisi master aplikasi, akun pengembangan, organisasi daerah, dan alumni tertentu.
3. **Command import Excel/JSON** mengisi data santri, roster kegiatan, kamar, petugas dari workbook, pelanggaran, dan prestasi.
4. **Input aplikasi** mengisi transaksi operasional setelah aplikasi digunakan, seperti absensi, izin, pelanggaran baru, notifikasi, dan log.

Tidak ada proses yang otomatis membaca seluruh Excel local ketika container/server mulai. Container hanya menjalankan migration.

## 1. Alur aktual saat aplikasi dijalankan

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
docker compose exec backend php artisan db:seed --force
docker compose exec backend php artisan import:excel
```

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
- `php artisan import:excel`;
- `php artisan import:santri-baru`;
- `php artisan import:rekam-pelanggaran`;
- `php artisan db:seed --class=AlumniSeeder`.

Pada `compose.production.yaml`, image production juga tidak memasang volume root `xlsx/`, `docs/`, atau `new data/`. Jika import Excel diperlukan di production, file harus disediakan melalui prosedur deployment/import yang terkontrol, lalu command dijalankan pada container yang dapat membaca file tersebut.

## 2. Urutan `DatabaseSeeder`

File utama: `backend/database/seeders/DatabaseSeeder.php`.

Urutan aktualnya:

```text
DatabaseSeeder
├─ PetugasSeeder
├─ OrganisasiDaerahSeeder
├─ unit_pendidikan
├─ jenis_kegiatan
├─ jadwal_kegiatan
├─ jenis_izin
├─ aturan_sanksi
└─ pengaturan_sistem
```

### 2.1 `PetugasSeeder`

File: `backend/database/seeders/PetugasSeeder.php`.

Sumber data:

- enam akun hardcoded;
- `backend/database/data_user.json`, jika file tersedia.

Akun hardcoded:

| Username | Nama | Jabatan |
|---|---|---|
| `admin` | User Admin | Admin |
| `keamanan` | User Keamanan | Keamanan |
| `pembinakamar` | User Pembina Kamar | Pembina Kamar |
| `pengasuh` | User Pengasuh | Pengasuh |
| `ustadz` | User Ustadz | Ustadz |
| `walikelas` | User Wali Kelas | Wali Kelas |

Perilaku penting:

- hanya boleh berjalan pada environment `local` atau `testing`;
- password menggunakan `LOCAL_SEED_PASSWORD`, default `masuk123`;
- akun di `data_user.json` memakai password fixture yang sama;
- role tertentu dipetakan ke enum aplikasi;
- petugas non-default dihapus setelah foreign key master dinullkan dan penugasan dihapus;
- `updateOrInsert` digunakan untuk username, tetapi nomor HP dibuat acak setiap pemanggilan.

Implikasi: `DatabaseSeeder` tidak dapat dijalankan utuh pada production saat ini karena `PetugasSeeder` melempar exception untuk environment production.

File `new data/data_user.xlsx` tidak dibaca oleh seeder. Yang dibaca hanya `backend/database/data_user.json`.

### 2.2 `OrganisasiDaerahSeeder`

File: `backend/database/seeders/OrganisasiDaerahSeeder.php`.

Sumber data: daftar organisasi hardcoded di PHP, bukan Excel atau JSON.

Seeder memakai `updateOrInsert` berdasarkan `kode_singkat`. Data yang diisi mencakup nama organisasi, wilayah, dan status aktif.

Catatan: migration profil santri juga memiliki sejarah pembuatan/pengisian `organisasi_daerah`. Karena repository memiliki beberapa perubahan schema organisasi, jalankan semua migration dalam urutan timestamp dan jangan mengimpor SQL schema lama secara parsial.

### 2.3 Master `unit_pendidikan`

Sumber: hardcoded di `DatabaseSeeder` dan tambahan dari migration.

`DatabaseSeeder` mengisi:

```text
MTS, SMP, SMA, SMK, MA
```

Migration `2026_08_09_000002_add_source_units_and_kegiatan_participation.php` mengisi tambahan:

```text
MTSS, SMPT, SMAT, MAS, MU, THS
```

Dengan demikian, migration dan seeder menghasilkan total 11 kode unit. `MTS` berbeda dari `MTSS`, dan `SMP` berbeda dari `SMPT`; aplikasi tidak melakukan alias otomatis.

### 2.4 Master kegiatan dan jadwal

`DatabaseSeeder` mengisi lima jenis kegiatan:

| Kode | Nama | Jadwal awal |
|---|---|---|
| `KAMAR` | Kegiatan Kamar | Absensi Kamar Malam, 20:00–20:30 |
| `SEKOLAH` | Kelas Formal | Absensi Kelas Formal, 07:00–07:30 |
| `PBS` | Kelompok Al-Qur'an Subuh | 05:00–06:00 |
| `PBM` | Takhasus Maghrib | 18:30–19:30 |
| `DINIYAH` | Kelas Madin | 15:30–16:00 |

Jadwal mengacu pada ID hasil insert `jenis_kegiatan`, bukan ID tetap. Namun insert master dilakukan dengan `insert` biasa, bukan `updateOrInsert`, sehingga seeder bukan operasi yang aman untuk dijalankan berulang.

### 2.5 Jenis izin

Data hardcoded:

- Izin Pulang;
- Izin Sakit;
- Izin Keluar Komplek.

### 2.6 Aturan sanksi

Data hardcoded berdasarkan rentang poin 1–100:

| Rentang | Tindakan |
|---:|---|
| 1–19 | Teguran lisan dan pembinaan |
| 20–29 | Teguran tertulis/SP1 atau botak |
| 30–49 | Pemanggilan orang tua/SP2 |
| 50–79 | SP3 dan skorsing |
| 80–100 | Dikembalikan kepada orang tua/dikeluarkan |

Sheet `Tabel Sanksi` dari workbook pelanggaran tidak dibaca oleh `import:excel`; sumber aturan sanksi aktif adalah seeder.

### 2.7 Pengaturan sistem

`DatabaseSeeder` mengisi pengaturan gateway WhatsApp, batas overdue, ambang SP, toleransi input absensi, durasi edit, dan ambang notifikasi poin.

Nilai berikut adalah contoh development dan tidak boleh dipakai mentah di production:

```text
WA_API_URL = http://localhost:3000/send
WA_API_KEY = secret-key-123
```

Production harus mengubahnya melalui prosedur secret/configuration yang aman.

## 3. Data yang diisi oleh migration

Migration bukan hanya membuat tabel. Beberapa migration melakukan data backfill atau insert:

| Migration | Pengisian/perubahan data |
|---|---|
| `2026_07_29_062600_add_password_to_santri_table` | Mengisi password default santri lama dengan hash |
| `2026_07_31_130000_backfill_explicit_roster_assignments` | Membuat penugasan petugas dari metadata kamar/kelas yang sudah ada |
| `2026_07_31_145000_normalize_pbs_group_names` | Menormalisasi dan menghapus konflik nama kelompok PBS |
| `2026_07_31_150000_remove_total_madin_pbm_rosters` | Menghapus roster kelompok `TOTAL` yang tidak valid bila tidak dipakai |
| `2026_07_31_152000_remove_duplicate_madin_roster` | Menghapus duplikasi roster Madin tertentu |
| `2026_08_06_000001_add_poin_to_pelanggaran_table` | Mengisi/backfill nilai poin pelanggaran |
| `2026_08_09_000001_expand_santri_profile_and_verification` | Membuat tabel profil keluarga/pendidikan/organisasi/roster dan mengisi organisasi awal |
| `2026_08_09_000002_add_source_units_and_kegiatan_participation` | Menambah enam unit sumber dan tabel partisipasi kegiatan |
| `2026_08_09_000003_assign_all_formal_classes_to_demo_wali_kelas` | Memberi penugasan kelas formal kepada wali kelas demo bila tersedia |
| `2026_08_10_000004_cleanup_empty_legacy_kelas_formal` | Membersihkan kelas formal kosong dan penugasannya |

Karena migration dapat mengubah data existing, backup database wajib dilakukan sebelum deploy migration baru.

## 4. Data Excel/JSON yang bukan seeder

### 4.0 Ringkasan sumber data tambahan

Berikut data tambahan yang sering disebut sebagai “data Excel baru”. Nama file, format yang dibaca kode, dan tujuan database harus dibedakan:

| Data bisnis | File yang tersedia | File yang dibaca kode saat ini | Command/seeder | Tabel tujuan |
|---|---|---|---|---|
| Santri baru/profil lengkap | `docs/EXCEL BARU/data_santri_semua.xls` dan salinan di `new data/` | `.xls` HTML-table melalui `import:santri-baru` | `php artisan import:santri-baru --file=...` | `santri`, `santri_keluarga`, `santri_pendidikan`, `santri_kegiatan_partisipasi`, `kelas_formal` |
| Alumni | `docs/EXCEL BARU/data_alumni.json` dan `data_alumni.xlsx` | `.json` saja | `php artisan db:seed --class=AlumniSeeder --force` | `alumni` |
| Rekam pelanggaran/prestasi | `docs/EXCEL BARU/data_rekam_santri.xlsx` dan `.json` | `.xlsx`, atau fallback `.json` | `php artisan import:rekam-pelanggaran --file=...` | `pelanggaran`, `prestasi` |
| Data wisma | `docs/EXCEL BARU/data_wisma.xlsx` dan `.json` | Tidak ada | Tidak ada command aktif | Tidak ada |
| Data user/pengurus | `backend/database/data_user.json` dan `new data/data_user.xlsx` | `.json` pada `PetugasSeeder` | `php artisan db:seed` di local/testing | `petugas` |

Istilah “`data_santri_semua.xlsx`” dapat digunakan sebagai nama bisnis, tetapi file yang ada dan dibaca implementasi sekarang adalah `data_santri_semua.xls`. File tersebut bukan XLSX modern; isinya berupa HTML table yang diproses dengan `DOMDocument`. Jangan mengganti ekstensi atau format file tanpa menyesuaikan command import.

Dengan kata lain, data santri baru, alumni, dan rekam pelanggaran **tidak otomatis masuk hanya karena file berada di local**. Masing-masing harus menjalankan command/seeder pada kolom di atas.

### 4.1 `import:excel`

File: `backend/app/Console/Commands/ImportExcelCommand.php`.

Sumber default: folder `../xlsx/` relatif terhadap `backend/`.

Data yang diisi:

| Sumber | Tabel utama |
|---|---|
| Database Santri Kamar | `petugas`, `kamar`, `petugas_penugasan`, `santri` |
| Database Siswa | `petugas`, `kelas_formal`, `petugas_penugasan`, `santri` |
| Database Kelas Madin | `kelompok_madin`, `santri` |
| Database Kelompok Al-Qur'an | `kelompok_pbs`, `santri` |
| Database Takhassus | `kelompok_pbm`, `santri` |
| Master Pelanggaran | `kategori_pelanggaran` |

Output tambahan:

- `storage/app/mapping-kamar-draft.csv`;
- `storage/app/santri-review-kandidat.xlsx`;
- `storage/app/santri-review-baru.xlsx`;
- `storage/app/private/credentials/akun-petugas-*.csv`.

Import ini tidak dijalankan oleh `db:seed` dan tidak dijalankan otomatis oleh entrypoint.

### 4.2 `import:santri-baru`

File: `backend/app/Console/Commands/ImportSantriBaruCommand.php`.

Sumber default yang dicari berurutan:

1. `../new data/data_santri_semua.xls`;
2. `../xlsx/data_santri_semua.xls`.

Sumber repository yang tersedia saat ini berada di `docs/EXCEL BARU/data_santri_semua.xls`, sehingga pada server sebaiknya selalu gunakan `--file` secara eksplisit.

Data yang diisi atau diperbarui:

- `santri`;
- `santri_keluarga`;
- `santri_pendidikan` untuk tahun ajaran `2026/2027`;
- `santri_kegiatan_partisipasi`;
- `kelas_formal` bila kelas dari `Pend` dan `Kls` belum ada.

Kode `Pend` dibaca secara persis. Karena itu `MTSS`, `SMPT`, dan `THS` membutuhkan record unit hasil migration.

### 4.3 `import:rekam-pelanggaran`

File: `backend/app/Console/Commands/ImportRekamPelanggaranCommand.php`.

Sumber default:

1. `/tmp/data_rekam_santri.xlsx`;
2. `../new data/data_rekam_santri.xlsx`;
3. `../xlsx/data_rekam_santri.xlsx`;
4. `../docs/EXCEL BARU/data_rekam_santri.json`.

Data masuk ke:

- `prestasi` jika deskripsi terdeteksi sebagai prestasi;
- `pelanggaran` jika dianggap pelanggaran;
- referensi kategori berasal dari `kategori_pelanggaran`.

Command ini tidak idempoten penuh. Menjalankannya dua kali dapat menggandakan riwayat pelanggaran dan prestasi.

### 4.4 `AlumniSeeder`

File: `backend/database/seeders/AlumniSeeder.php`.

Sumber: `docs/EXCEL BARU/data_alumni.json`.

Seeder ini tidak dipanggil oleh `DatabaseSeeder`. Jika dipanggil eksplisit, tabel `alumni` di-`truncate` dahulu lalu diisi ulang. Jangan jalankan pada production yang sudah memiliki perubahan manual tanpa backup dan persetujuan.

### 4.5 Data yang tersedia tetapi tidak dibaca otomatis

- `xlsx/DATA NOMOR INDUK PONDOK.xlsx`;
- `docs/EXCEL BARU/data_wisma.xlsx`;
- `docs/EXCEL BARU/data_wisma.json`;
- `new data/data_user.xlsx`;
- `docs/EXCEL BARU/data_alumni.xlsx` karena alumni seeder memakai JSON;
- `xlsx/laporan-kehadiran.pdf`.

Keberadaan file-file tersebut di local tidak berarti datanya sudah ada di database.

## 5. Klasifikasi tabel berdasarkan sumber

| Tabel | Migration | Seeder | Excel/JSON import | Input aplikasi |
|---|:---:|:---:|:---:|:---:|
| `unit_pendidikan` | ✓ tambahan unit | ✓ unit dasar | ✓ dipakai sebagai referensi |  |
| `petugas` |  | ✓ akun local/testing | ✓ petugas dari workbook | ✓ admin dapat mengubah |
| `kamar` |  |  | ✓ workbook kamar | ✓ master admin |
| `kelas_formal` |  |  | ✓ workbook/`Pend+Kls` | ✓ master admin |
| `kelompok_madin/pbs/pbm` |  |  | ✓ workbook rekap | ✓ master admin |
| `santri` | ✓ backfill tertentu |  | ✓ workbook santri | ✓ perubahan aplikasi |
| `santri_keluarga` | ✓ struktur |  | ✓ profil lengkap | ✓ edit profil |
| `santri_pendidikan` | ✓ struktur |  | ✓ profil lengkap | ✓ edit profil |
| `santri_kegiatan_partisipasi` | ✓ struktur |  | ✓ profil lengkap | ✓ verifikasi admin |
| `kategori_pelanggaran` |  |  | ✓ master pelanggaran | ✓ tambah dari aplikasi |
| `aturan_sanksi` |  | ✓ hardcoded |  |  |
| `alumni` | ✓ struktur | ✓ eksplisit saja |  |  |
| `prestasi` | ✓ struktur |  | ✓ rekam santri | ✓ input aplikasi |
| `absensi` | ✓ struktur |  |  | ✓ transaksi aplikasi |
| `perizinan` | ✓ struktur | ✓ jenis izin |  | ✓ transaksi aplikasi |
| `pelanggaran` | ✓ backfill poin |  | ✓ rekam santri | ✓ input aplikasi |
| `notifikasi`, `log_aktivitas` | ✓ struktur |  |  | ✓ event/aplikasi |

## 6. Prosedur bootstrap local yang benar

Untuk database local baru:

```bash
docker compose up -d
docker compose exec backend php artisan migrate:status
docker compose exec backend php artisan db:seed --force
docker compose exec backend php artisan import:excel
```

Jika membutuhkan data profil lengkap:

```bash
docker compose exec backend php artisan import:santri-baru \
  --file="/var/www/docs/EXCEL BARU/data_santri_semua.xls"
```

Path `/var/www/docs/...` berlaku karena `compose.yaml` memasang root `docs/` ke `/var/www/docs`. Untuk `import:excel`, path default `/var/www/xlsx/` berasal dari mount `./xlsx:/var/www/xlsx:ro`.

Jika membutuhkan rekam pelanggaran/prestasi:

```bash
docker compose exec backend php artisan import:rekam-pelanggaran \
  --file="/var/www/docs/EXCEL BARU/data_rekam_santri.xlsx"
```

Jangan menjalankan `db:seed` berulang pada database local yang sudah berisi data. Banyak bagian `DatabaseSeeder` menggunakan `insert` biasa dan dapat menimbulkan duplikasi atau konflik unique.

## 7. Prosedur bootstrap production saat ini

Production baru belum memiliki seeder baseline yang aman. Prosedur aktual yang aman adalah:

1. Buat atau restore database baseline yang sudah diverifikasi.
2. Jalankan seluruh migration terbaru dengan service `migrate`.
3. Sediakan akun admin production melalui prosedur khusus yang aman, bukan `PetugasSeeder`.
4. Sediakan file Excel di container/job import secara terkontrol.
5. Jalankan command import satu per satu setelah backup.
6. Verifikasi jumlah unit, santri, kamar, kelas, kelompok, kategori pelanggaran, dan akun.

Perintah ini **dilarang digunakan pada production saat ini**:

```bash
php artisan db:seed --force
php artisan migrate --seed
```

Alasannya, keduanya memanggil `DatabaseSeeder`, yang memanggil `PetugasSeeder`, sedangkan `PetugasSeeder` hanya mengizinkan `local` dan `testing`.

## 8. Verifikasi sumber data setelah pengisian

```sql
SELECT kode, nama
FROM unit_pendidikan
ORDER BY kode;

SELECT COUNT(*) AS jumlah_petugas FROM petugas;
SELECT COUNT(*) AS jumlah_santri FROM santri;
SELECT COUNT(*) AS jumlah_kamar FROM kamar;
SELECT COUNT(*) AS jumlah_kelas FROM kelas_formal;
SELECT COUNT(*) AS jumlah_madin FROM kelompok_madin;
SELECT COUNT(*) AS jumlah_pbs FROM kelompok_pbs;
SELECT COUNT(*) AS jumlah_pbm FROM kelompok_pbm;
SELECT COUNT(*) AS jumlah_kategori_pelanggaran FROM kategori_pelanggaran;
SELECT COUNT(*) AS jumlah_pelanggaran FROM pelanggaran;
SELECT COUNT(*) AS jumlah_prestasi FROM prestasi;
```

Verifikasi file hasil import:

- `storage/app/mapping-kamar-draft.csv`;
- `storage/app/santri-review-kandidat.xlsx`;
- `storage/app/santri-review-baru.xlsx`;
- `storage/app/private/credentials/`.

## 9. Keputusan operasional

- **Migration** adalah sumber kebenaran struktur database dan data backfill.
- **Seeder** adalah sumber kebenaran master aplikasi dan fixture local/testing.
- **Excel/JSON import** adalah sumber data santri dan data operasional historis, bukan bagian otomatis dari migration.
- **SQL dump** dipakai untuk backup atau baseline production yang sudah diverifikasi, bukan pengganti migration pada setiap deployment.
- Local dan server harus menjalankan commit code serta seluruh migration yang sama sebelum membandingkan hasil data.
- `unit_id` tidak boleh disamakan secara manual antara local dan server; yang harus sama adalah `kode` dan `nama` unit.
