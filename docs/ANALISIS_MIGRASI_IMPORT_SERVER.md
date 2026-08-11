# Analisis Data Migrasi dan Import Database Server

Dokumen ini adalah acuan untuk AI/operator server ketika menyiapkan database aplikasi Tebuireng. Isinya menggambarkan perilaku kode yang sedang digunakan pada repository ini, bukan rancangan ideal baru.

Status analisis: 11 Agustus 2026.

## 1. Gambaran sistem

Aplikasi terdiri dari:

- Backend Laravel 12 pada `backend/`.
- Database MySQL 8.4.
- Frontend React/Vite pada `frontend/`.
- Migration database pada `backend/database/migrations/`.
- Seeder master dan akun pada `backend/database/seeders/`.
- Import Excel pada `backend/app/Console/Commands/`.
- Sumber data utama pada `xlsx/` dan sumber data tambahan pada `docs/EXCEL BARU/`.

Database tidak diisi melalui SQL dump Excel secara langsung. Struktur tabel dibuat oleh Laravel migration, kemudian data master dan data Excel dimasukkan melalui seeder atau Artisan command.

## 2. Sumber data yang tersedia

### 2.1 Dipakai oleh `import:excel`

Command `php artisan import:excel` membaca file relatif terhadap root project:

| File | Sheet yang dibaca | Isi | Perkiraan baris data* |
|---|---|---|---:|
| `xlsx/Database_Santri_Kamar_MTS_SMP_SMA_SMK.xlsx` | `Database Santri Kamar` | Santri induk, unit, kamar, pembina | 1.376 |
| `xlsx/Database_Siswa_Kelas_7_8_9_2026_2027.xlsx` | `Database Siswa` | NIS, santri, tingkat, kelas formal, wali kelas | 773 |
| `xlsx/Database_Kelas_Madin_2026_2027.xlsx` | `Database Siswa Madin`, `Rekap Kelas Madin` | Peserta dan master kelompok Madin | 1.783, 78 |
| `xlsx/Database_Kelompok_AlQuran (belajar habis subuh)_2026_2027.xlsx` | `Database Al-Qur'an`, `Rekap Kelompok` | Peserta dan master kelompok PBS/Al-Qur'an | 1.720, 126 |
| `xlsx/Database_Takhassus (belajar habis maghrib)_2026_2027.xlsx` | `Database Takhassus`, `Rekap Kelompok` | Peserta dan master kelompok PBM/Takhassus | 1.791, 134 |
| `xlsx/Database_Pelanggaran_Santri_Tebuireng.xlsx` | `Master Pelanggaran` | Master pasal, uraian, poin, jenis, status | 72 |

\*Jumlah di atas berasal dari workbook saat analisis; baris pertama adalah header dan tidak diimpor. Sheet rekap hanya dipakai untuk membuat master kelompok, bukan untuk memasukkan jumlah sebagai transaksi.

Sheet yang tidak dibaca oleh `import:excel` antara lain `Rekap Kamar`, `Rekap Kelas`, `Lokasi Kelas`, `Daftar Kelas`, `Tabel Sanksi`, `Input Pelanggaran Santri`, dan `Panduan Penggunaan`.

### 2.2 Tersedia tetapi bukan bagian dari `import:excel`

| Sumber | Pemakai saat ini | Tujuan |
|---|---|---|
| `xlsx/DATA NOMOR INDUK PONDOK.xlsx` | Tidak ada command aktif yang membacanya | Data induk putra/putri; belum menjadi sumber import otomatis |
| `docs/EXCEL BARU/data_santri_semua.xls` | `import:santri-baru --file=...` | Profil lengkap, keluarga, pendidikan, kamar, dan status verifikasi santri |
| `docs/EXCEL BARU/data_rekam_santri.xlsx` atau `.json` | `import:rekam-pelanggaran --file=...` | Riwayat pelanggaran dan prestasi |
| `docs/EXCEL BARU/data_alumni.json` | `AlumniSeeder`, bila dipanggil eksplisit | Data alumni; tabel dikosongkan lalu diisi ulang |
| `docs/EXCEL BARU/data_wisma.xlsx` / `data_wisma.json` | Tidak ada pemanggil aktif yang ditemukan | Belum dimigrasikan otomatis |
| `xlsx/laporan-kehadiran.pdf` | Tidak dibaca aplikasi | Dokumen laporan, bukan sumber import |

`data_santri_semua.xls` adalah file HTML-table berformat `.xls`, bukan parser XLSX biasa. Gunakan command khususnya dan jangan menggantinya dengan `import:excel`.

## 3. Pemetaan proses `import:excel`

Urutan proses di `backend/app/Console/Commands/ImportExcelCommand.php` adalah sebagai berikut.

### Tahap 0 — Prasyarat

Tabel `unit_pendidikan` harus sudah berisi kode unit yang dibutuhkan sumber data. Kode final yang dibuat migration saat ini adalah:

| Kode | Status pada sistem saat ini |
|---|---|
| `MTS` | Unit dasar dari `DatabaseSeeder` |
| `SMP` | Unit dasar dari `DatabaseSeeder`; workbook `Database Siswa` saat ini dipaksa masuk ke unit ini |
| `SMA` | Unit dasar dari `DatabaseSeeder` |
| `SMK` | Unit dasar dari `DatabaseSeeder` |
| `MA` | Unit dasar dari `DatabaseSeeder` |
| `MTSS` | Unit sumber tambahan, dibuat oleh migration `2026_08_09_000002` |
| `SMPT` | Unit sumber tambahan, dibuat oleh migration `2026_08_09_000002` |
| `SMAT` | Unit sumber tambahan, dibuat oleh migration `2026_08_09_000002` |
| `MAS` | Unit sumber tambahan, dibuat oleh migration `2026_08_09_000002` |
| `MU` | Unit sumber tambahan, dibuat oleh migration `2026_08_09_000002` |
| `THS` | Unit sumber tambahan, dibuat oleh migration `2026_08_09_000002` |

`MTS` dan `MTSS`, serta `SMP` dan `SMPT`, adalah dua record berbeda karena memiliki kode dan `unit_id` berbeda. `THS` juga record unit tersendiri. Repository belum memiliki aturan alias yang menggabungkan kode-kode tersebut. Dengan demikian, jangan mengubah `MTSS` menjadi `MTS` atau `SMPT` menjadi `SMP` saat import sebelum ada keputusan bisnis tertulis; penggabungan dapat merusak kelas, laporan, dan filter unit.

Perbedaan ini terlihat jelas pada dua jalur import: `import:excel` memakai kode lima unit dasar dan memaksa workbook kelas 7–9 ke `SMP`, sedangkan `import:santri-baru` membaca nilai `Pend` secara persis dari database. Karena itu, data lengkap dengan `Pend=MTSS`, `SMPT`, atau `THS` harus diproses setelah migration tambahan tersebut sudah berjalan.

### Tahap 1 — Petugas

Nama pembina dari kolom `Pembina` pada sheet `Database Santri Kamar` dibuat sebagai `petugas` dengan jabatan `Pembina Kamar`. Nama wali kelas dari kolom `Wali Kelas` pada sheet `Database Siswa` dibuat sebagai `petugas` dengan jabatan `Wali Kelas` bila belum ada.

Untuk petugas baru:

- username dibuat dari slug nama ditambah angka acak;
- password dibuat acak 16 karakter pada server non-local;
- `wajib_ganti_password = true`;
- kredensial ditulis ke `backend/storage/app/private/credentials/akun-petugas-*.csv` dengan permission terbatas.

File kredensial harus dibagikan melalui kanal aman lalu dihapus setelah diterima. Jangan menampilkan password dalam log atau commit file CSV tersebut.

### Tahap 2 — Kamar dan mapping kode kamar

`Database Santri Kamar` membuat atau menggunakan kembali tabel `kamar` berdasarkan nama `Wisma/Kamar`, unit, dan pembina. Kode singkat kamar dari tiga workbook kegiatan kemudian dikumpulkan ke:

`backend/storage/app/mapping-kamar-draft.csv`

Mapping yang sudah dikonfirmasi di tabel `kamar_kode_mappings` memiliki prioritas lebih tinggi daripada CSV draft. Mapping yang tidak dapat ditebak dibiarkan kosong dan perlu dilengkapi sebelum import berikutnya atau melalui CMS admin.

### Tahap 3 — Kelas formal

`Database Siswa` membuat master `kelas_formal`. Implementasi saat ini menggunakan unit `SMP` untuk semua baris dari workbook kelas 7–9. Kelas dibuat berdasarkan kombinasi unit dan nama kelas; wali kelas dihubungkan ke `petugas`.

### Tahap 4 — Kelompok kegiatan

- `Rekap Kelas Madin` → `kelompok_madin` berdasarkan `jenjang` dan `nama_kelas_madin`.
- `Rekap Kelompok` dari Al-Qur'an → `kelompok_pbs` berdasarkan `kategori` dan `nama_kelompok`.
- `Rekap Kelompok` dari Takhassus → `kelompok_pbm` berdasarkan `kategori` dan `nama_kelompok`.

Baris `TOTAL` tidak diimpor. Nama PBS dinormalisasi oleh `App\Support\PbsGroupName`. Baris Madin `SMA / 2 ULYA` dilewati karena sumber mengandung duplikasi roster.

### Tahap 5 — Master pelanggaran

Sheet `Master Pelanggaran` dimasukkan ke `kategori_pelanggaran` dengan pemetaan posisi kolom:

| Kolom Excel | Kolom database |
|---|---|
| `Kode Pasal` | `kode_pasal` |
| `Kategori` | `kategori` |
| `Uraian Pelanggaran` | `uraian_pelanggaran` |
| `Poin Maks.` | `poin_maks` |
| `Jenis` | `jenis` |
| `Status Aktif` | `status_aktif` |

Kunci pengecekan duplikat adalah `kode_pasal`. Sheet `Tabel Sanksi` tidak dipakai; aturan sanksi berasal dari `DatabaseSeeder`.

### Tahap 6 — Santri dan matching

Sumber induk awal adalah `Database Santri Kamar`. Santri baru pada sumber ini dimasukkan ke `santri` berdasarkan kombinasi nama dan kamar.

Sumber kegiatan berikutnya memperkaya baris `santri` yang sudah ada:

| Sheet | Field yang ditambahkan/diperbarui |
|---|---|
| `Database Siswa` | `nis`, unit SMP, `kelas_formal_id` |
| `Database Siswa Madin` | unit, `kelompok_madin_id`, kode kamar sumber |
| `Database Al-Qur'an` | unit, `kelompok_pbs_id`, kode kamar sumber |
| `Database Takhassus` | unit, `kelompok_pbm_id`, kode kamar sumber |

Aturan pencocokan:

1. Untuk sumber kelas formal, NIS adalah identitas terkuat.
2. Nama dicocokkan dalam huruf besar; nama tidak selalu unik.
3. Kode kamar dipetakan ke nama kamar melalui CSV atau `kamar_kode_mappings`.
4. Satu kandidat nama yang unik dapat diperbarui langsung.
5. Banyak kandidat nama masuk kelompok review dan ditulis ke `santri-review-kandidat.xlsx`.
6. Tidak ada kandidat dibuat sebagai santri baru dengan `catatan_import` yang menyatakan perlu verifikasi, lalu ditulis ke `santri-review-baru.xlsx`.

Import ini menambah/memperkaya data secara bertahap dan umumnya tidak menghapus data santri yang sudah ada. Tetap lakukan backup sebelum mengulang import karena beberapa update dapat mengubah unit, kelas, kamar, atau keanggotaan kelompok.

## 4. Tabel database yang relevan

### Master dan hasil import

- `unit_pendidikan`: master unit pendidikan. Pada skema saat ini, jumlah kode yang diharapkan adalah 11: `MTS`, `SMP`, `SMA`, `SMK`, `MA`, `MTSS`, `SMPT`, `SMAT`, `MAS`, `MU`, `THS`.
- `petugas`: akun admin/pembina/wali/ustadz/keamanan.
- `kamar`: kamar/wisma, unit, dan pembina.
- `kelas_formal`: kelas sekolah dan wali kelas.
- `kelompok_madin`, `kelompok_pbs`, `kelompok_pbm`: master kelompok kegiatan.
- `petugas_penugasan`: penugasan eksplisit petugas ke kamar, kelas formal, atau kelompok.
- `santri`: data utama santri dan relasi unit, kamar, kelas, kelompok, status, serta profil.
- `kategori_pelanggaran`: master pasal pelanggaran.

### Tabel operasional aplikasi

Migration juga membuat tabel `jenis_kegiatan`, `jadwal_kegiatan`, `absensi`, `aturan_sanksi`, `pelanggaran`, `lampiran_pelanggaran`, `jenis_izin`, `perizinan`, `perizinan_approval`, `perizinan_gerbang_koreksi`, `notifikasi`, `log_aktivitas`, `pengaturan_sistem`, serta tabel session/cache/job Laravel.

### Tabel review dan profil tambahan

- `kamar_kode_mappings`: mapping kode kamar dari sumber ke kamar internal.
- `santri_import_reviews`: antrean hasil review/matching santri.
- `santri_keluarga`: keluarga santri.
- `santri_pendidikan`: riwayat/profil pendidikan per tahun ajaran.
- `santri_kegiatan_partisipasi`: status partisipasi santri pada setiap jenis kegiatan.
- `organisasi_daerah` dan tabel relasinya: organisasi daerah santri.
- `alumni`: data alumni, hanya diisi oleh `AlumniSeeder` jika dipanggil eksplisit.
- `prestasi`: data prestasi, diisi oleh `import:rekam-pelanggaran` ketika deskripsi terdeteksi sebagai prestasi.
- `raport_pengajian`, `raport_nilai`, `raport_kepribadian`: modul raport pengajian, bukan hasil `import:excel`.

Struktur final database harus selalu dibuat dari semua migration dengan `php artisan migrate`, bukan dari asumsi nama kolom Excel.

## 5. Seeder dan data master

`DatabaseSeeder` saat ini mengisi:

- unit: MTS, SMP, SMA, SMK, MA;
- jenis kegiatan: KAMAR, SEKOLAH, PBS, PBM, DINIYAH;
- jadwal kegiatan dan jamnya;
- jenis izin;
- aturan sanksi berdasarkan rentang poin;
- pengaturan sistem, termasuk URL/key gateway WA dan ambang poin;
- `OrganisasiDaerahSeeder`.

`PetugasSeeder` membuat akun fixture dan hanya boleh berjalan pada `local` atau `testing`. Karena itu, jangan memakai `php artisan db:seed --force` di production tanpa meninjau seeder yang aktif. Untuk production, seed master harus dijalankan dengan prosedur terkontrol dan nilai rahasia WA tidak boleh memakai contoh `secret-key-123`.

Catatan penting: `DatabaseSeeder` memanggil `PetugasSeeder`, tetapi `PetugasSeeder` menolak environment production. Ini perlu diperhitungkan saat bootstrap server.

## 6. Urutan migrasi/import yang direkomendasikan di server

### Persiapan

1. Pastikan repository dan keenam file Excel utama tersedia di root `xlsx/`.
2. Pastikan permission `storage/` dan `bootstrap/cache/` dapat ditulis oleh user container/backend.
3. Atur `.env` production: `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY`, kredensial MySQL, URL frontend, Sanctum, dan secret gateway secara aman.
4. Backup database jika database sudah berisi data.

Sebelum import, bandingkan daftar unit local dan server. Jalankan query berikut pada masing-masing database:

```sql
SELECT unit_id, kode, nama
FROM unit_pendidikan
ORDER BY kode;
```

Hasil local dan server harus sama pada kolom `kode` dan `nama`. Nilai `unit_id` boleh berbeda karena auto-increment; relasi aplikasi menggunakan `unit_id` dari database masing-masing dan tidak boleh dipindahkan manual antar server.

### Eksekusi

```bash
cd /var/www/tebuirengv2/backend
php artisan optimize:clear
php artisan migrate --force
```

Untuk database baru, isi master secara terkontrol. Jika `DatabaseSeeder` sudah disesuaikan agar aman untuk production:

```bash
php artisan db:seed --force
```

Kemudian jalankan import utama:

```bash
php artisan import:excel
```

Jika sumber profil lengkap tersedia, jalankan setelah import utama agar `unit`, `kelas_formal`, dan `kamar` sudah ada:

```bash
php artisan import:santri-baru --file="/var/www/tebuirengv2/docs/EXCEL BARU/data_santri_semua.xls"
```

Jika rekam pelanggaran/prestasi tersedia, jalankan setelah master santri dan master kategori pelanggaran:

```bash
php artisan import:rekam-pelanggaran --file="/var/www/tebuirengv2/docs/EXCEL BARU/data_rekam_santri.xlsx"
```

Alumni bukan bagian dari bootstrap default. Jalankan hanya jika memang diperlukan dan setelah backup:

```bash
php artisan db:seed --class=AlumniSeeder --force
```

Seeder alumni melakukan `truncate` pada tabel `alumni`; jangan menjalankannya bila data alumni server sudah diedit manual.

## 7. Verifikasi setelah import

Jalankan pemeriksaan berikut pada server:

```bash
php artisan migrate:status
php artisan tinker --execute="dump(DB::table('santri')->count(), DB::table('kamar')->count(), DB::table('kelas_formal')->count(), DB::table('petugas')->count(), DB::table('kategori_pelanggaran')->count());"
```

Periksa juga:

- file `storage/app/mapping-kamar-draft.csv`;
- file `storage/app/santri-review-kandidat.xlsx`;
- file `storage/app/santri-review-baru.xlsx`;
- file kredensial sementara pada `storage/app/private/credentials/`;
- jumlah santri tanpa `unit_id`, `kamar_id`, atau `kelas_formal_id` yang memang masih perlu verifikasi;
- jumlah pelanggaran/prestasi yang masuk dan jumlah baris yang dilewati;
- login akun hasil import dan kewajiban ganti password.

Contoh query audit:

```sql
SELECT COUNT(*) AS santri_tanpa_unit FROM santri WHERE unit_id IS NULL;
SELECT COUNT(*) AS santri_tanpa_kamar FROM santri WHERE kamar_id IS NULL;
SELECT COUNT(*) AS review_belum_selesai
FROM santri_import_reviews
WHERE status IN ('perlu_tinjau', 'perlu_mapping_kamar');
SELECT status_verifikasi, COUNT(*) AS jumlah
FROM santri
GROUP BY status_verifikasi;
```

## 8. Temuan dan risiko yang harus diketahui AI/server

1. `DATA NOMOR INDUK PONDOK.xlsx` belum dipakai oleh command import aktif. Jangan menganggap seluruh nomor induk dari file tersebut sudah masuk ke `santri`.
2. `import:excel` hanya membaca enam workbook tertentu. File `data_santri_semua.xls`, `data_rekam_santri.xlsx`, dan alumni harus diproses command/seeder masing-masing.
3. `import:review` saat ini hanya membaca jumlah kolom `Keputusan` dan melaporkan jumlah baris; implementasi penerapan keputusan masih berupa placeholder. Review resmi sebaiknya dilakukan melalui alur CMS/controller yang tersedia, bukan mengandalkan command tersebut.
4. `import:rekam-pelanggaran` menggunakan pencocokan `No ID (Induk)` ke kolom `santri.nis` untuk kompatibilitas data lama, lalu fallback ke nama. Pastikan identitas sudah benar sebelum import agar riwayat tidak tertempel pada santri yang salah.
5. Import rekam pelanggaran/prestasi tidak memiliki kunci idempotensi transaksi. Menjalankan command dua kali dapat menggandakan baris `pelanggaran` dan `prestasi`.
6. `import:santri-baru` mempertahankan kamar lama jika sumber baru tidak mempunyai kamar, tetapi dapat memperbarui profil dan status verifikasi. Backup wajib sebelum menjalankan ulang.
7. Kode saat ini menggunakan path `base_path('../xlsx/')`, sehingga pada Docker volume harus tersedia sebagai `/var/www/xlsx`. Pastikan mount read-only tidak berubah menjadi path lain.
8. Akun petugas baru menghasilkan password satu kali. Jika CSV kredensial hilang sebelum dibagikan, lakukan reset password melalui prosedur admin; jangan membaca password dari database karena yang tersimpan adalah hash.
9. Pengaturan WA pada seeder berisi nilai contoh. Production harus mengisi URL dan key dari secret manager atau environment aman.
10. `DatabaseSeeder` menggunakan beberapa `insert` langsung untuk master dan tidak seluruhnya idempoten. Jangan menjalankannya berulang pada database yang sama tanpa memastikan tidak terjadi duplikasi atau konflik unique.
11. Jangan menghapus volume/database atau menjalankan `migrate:fresh` di server yang sudah berisi data tanpa persetujuan eksplisit dan backup yang dapat dipulihkan.
12. Migration `2026_08_09_000002` menambahkan `MTSS`, `SMPT`, `SMAT`, `MAS`, `MU`, dan `THS`; jika server berhenti sebelum migration ini, local dan server akan memiliki daftar unit berbeda walaupun aplikasi berhasil menyala.

## 9. Sumber kode acuan

- `backend/app/Console/Commands/ImportExcelCommand.php`
- `backend/app/Console/Commands/ImportSantriBaruCommand.php`
- `backend/app/Console/Commands/ImportRekamPelanggaranCommand.php`
- `backend/app/Console/Commands/ImportReviewCommand.php`
- `backend/database/seeders/DatabaseSeeder.php`
- `backend/database/seeders/PetugasSeeder.php`
- `backend/database/seeders/AlumniSeeder.php`
- `backend/database/migrations/`
- `compose.yaml`
