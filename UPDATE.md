# Panduan Update & Deployment Seeding Data SIMANTEB v3

Dokumen ini berisi panduan teknis dan aturan deployment untuk seeding database SIMANTEB v3 berdasarkan **audit empiris berbasis bukti (empirical proof)** langsung pada database MySQL yang berjalan, **70 file migrasi database**, **seeder Laravel**, **command console import**, dan **file canonical master putra** di repository.

---

## 1. Audit Empiris Tabel Master Unit Pendidikan

Berdasarkan eksekusi langsung script audit pada database MySQL aktif, tabel `unit_pendidikan` berisi **11 baris**, namun terbagi secara tegas menjadi **6 Unit Operasional Aktif SIMANTEB v3** dan **5 Unit Legacy/Non-Aktif**:

### Table Audit `unit_pendidikan` & Relasi Operasional
```text
===========================================================================================
ID   | Kode     | Nama         | Total Santri   | Santri Aktif   | Kamar    | Kelas   
===========================================================================================
1    | MTSS     | MTSS         | 479            | 0 (Legacy)     | 0        | 3       
2    | SMPT     | SMPT         | 710            | 0 (Legacy)     | 0        | 24      
3    | SMAT     | SMAT         | 632            | 0 (Legacy)     | 0        | 24      
4    | MAS      | MAS          | 137            | 0 (Legacy)     | 0        | 3       
5    | MU       | MU           | 433            | 433 (Aktif)    | 16       | 30      
6    | THS      | THS          | 7              | 0 (Legacy)     | 0        | 1       
7    | MTS      | MTS          | 615            | 438 (Aktif)    | 34       | 36      
8    | SMP      | SMP          | 700            | 479 (Aktif)    | 40       | 70      
9    | SMK      | SMK          | 87             | 86 (Aktif)     | 7        | 6       
10   | SMA      | SMA          | 558            | 381 (Aktif)    | 36       | 40      
11   | MA       | MA           | 624            | 409 (Aktif)    | 23       | 25      
===========================================================================================
```

### Bukti & Kesimpulan Unit:
1. **6 Unit Operasional Aktif SIMANTEB v3 (`status_aktif = 1`)**:
   - `SMP`: 479 santri aktif (40 kamar, 70 kelas)
   - `MTS`: 438 santri aktif (34 kamar, 36 kelas)
   - `MU`: 433 santri aktif (16 kamar, 30 kelas)
   - `MA`: 409 santri aktif (23 kamar, 25 kelas)
   - `SMA`: 381 santri aktif (36 kamar, 40 kelas)
   - `SMK`: 86 santri aktif (7 kamar, 6 kelas)
   - **Total Santri Putra Aktif**: **2.226 Santri** (terdistribusi tepat di 6 unit ini).
2. **5 Unit Inaktif/Legacy (`status_aktif = 0`)**:
   - `MTSS`, `SMPT`, `SMAT`, `MAS`, `THS` memiliki **0 santri aktif** dan **0 kamar aktif**. Unit ini berasal dari registrasi histori sekolah sumber lama (`2026_08_09_000002`).

---

## 2. Rincian Audit Database & Structure (70 Migrasi Executed)

Hasil audit status migrasi (`php artisan migrate:status`) menunjukkan **70 migrasi telah dieksekusi penuh (`Ran`)**:

### 2.1 Ringkasan Santri
- **Total record di tabel `santri`**: 4.982 santri.
- **Santri Aktif Canonical (`status_aktif = 1`)**: **2.226 santri**
  - `status_siswa_sumber = 'aktif'`: 1.741 santri
  - `status_siswa_sumber = 'santri_baru_2026'`: 485 santri
- **Santri Inaktif Legacy (`status_aktif = 0`)**: **2.756 santri**
  - `status_siswa_sumber = 'legacy_noncanonical'`: 2.756 santri (otomatis dinonaktifkan oleh command `import:master-putra`).

### 2.2 Roster Operasional
- **Kamar Aktif (`kamar` where `status_aktif = 1`)**: Tepat **175 kamar** (semua terikat pada 6 unit aktif).
- **Kelas Formal (`kelas_formal` where `tahun_ajaran = '2026/2027'`)**: **262 kelas** (207 kelas untuk unit aktif, 55 kelas histori untuk unit legacy).
- **Kelompok Pengajian**:
  - `kelompok_madin`: 154 kelompok
  - `kelompok_pbs`: 134 kelompok
  - `kelompok_pbm`: 138 kelompok

### 2.3 Master Pelanggaran, Sanksi & Review Match
- `kategori_pelanggaran`: **72 pasal** (Ringan, Sedang, Berat, Kewajiban).
- `aturan_sanksi`: **5 jenjang sanksi** (Urutan 1–5).
- `santri_import_reviews`: **516 baris** antrean tinjau dashboard (`status = 'perlu_tinjau'`) dari sheet `REVIEW_MATCH` di `MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`.

### 2.4 Transaksi & Data Historis
- `pelanggaran`: 669 catatan transaksi.
- `prestasi`: 40 catatan prestasi.
- `alumni`: 18.768 data alumni.

---

## 3. Sumber Data Baseline Canonical & Command Pengolah

Data seeding diproses dari file baseline di folder `data/` dan `docs/`:

| Data Business | File Sumber Canonical | Command / Seeder Pengolah | Tabel Tujuan Utama |
|---|---|---|---|
| **Master Santri Putra & Roster** | `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx` | `php artisan import:master-putra` | `santri`, `kamar`, `kelas_formal`, `kelompok_madin`, `kelompok_pbs`, `kelompok_pbm`, `santri_import_reviews` |
| **Master Pelanggaran & Sanksi** | `data/Database_Pelanggaran_Santri_Tebuireng.xlsx` | `php artisan import:master-pelanggaran` | `kategori_pelanggaran`, `aturan_sanksi` |
| **Profil Lengkap & Ortu** | `docs/EXCEL BARU/data_santri_semua.xls` | `php artisan import:santri-baru --file=...` | `santri`, `santri_keluarga`, `santri_pendidikan`, `santri_kegiatan_partisipasi`, `wali_accounts` |
| **Rekam Pelanggaran & Prestasi** | `data/data_rekam_santri.xlsx` | `php artisan import:rekam-pelanggaran --file=...` | `pelanggaran`, `prestasi` |
| **Data Alumni** | `data/data_alumni.xlsx` | `php artisan import:alumni --file=...` | `alumni` |

---

## 4. Alur & Perilaku Command Seeding Dalam Codebase

### 4.1 `DatabaseSeeder.php`
Urutan panggilan saat `php artisan db:seed --force`:
1. `PetugasSeeder`: Membuat 5 akun default (`admin`, `keamanan`, `pembinakamar`, `piketpengajian`, `walikelas`) dan mengimpor pengurus dari `database/data_user.json`. *Hanya diizinkan di env `local` & `testing` (PetugasSeeder.php:16).*
2. `OrganisasiDaerahSeeder`: Memuat 12 Orda baseline via `updateOrInsert`.
3. `UbudiyahSeeder`: Inisialisasi kriteria ubudiyah dasar.
4. `UnitPendidikanSeeder`: Menyinkronkan unit pendidikan dengan fallback 11 unit.
5. `PrestasiSeeder`: Fixture contoh prestasi.
6. **`import:master-putra` (`ImportMasterPutraCommand`)**:
   - Membaca sheet `MASTER_PUTRA` dari `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`.
   - Melakukan upsert 2.226 santri putra pada **6 unit aktif** (`MTS`, `SMP`, `SMA`, `SMK`, `MA`, `MU`).
   - Memasukkan 516 baris `REVIEW_MATCH` ke `santri_import_reviews` dengan `identitas_sumber` unik untuk mencegah duplikasi.
   - Mengosongkan ID gantung `2699...`.
   - Menonaktifkan santri non-canonical (`status_siswa_sumber = 'legacy_noncanonical'`, `status_aktif = false`).
7. System Setup: Memuat `periode_akademik` 2026/2027 Ganjil, `jenis_kegiatan`, `jadwal_kegiatan`, `jenis_izin`, `aturan_sanksi`, `pengaturan_sistem`, dan `petugas_penugasan`.

---

## 5. Prosedur Deployment Berurutan (Lokal & Server Production)

### Langkah 1: Update Repo
```bash
git fetch origin && git checkout main && git pull --ff-only origin main
```

### Langkah 2: Migrasi Database
```bash
# Production Docker
docker compose --env-file .env.production -f compose.production.yaml --profile tools run --rm migrate

# Local Docker
docker compose exec backend php artisan migrate --force
```

### Langkah 3: Eksekusi Import Master Canonical Putra & System Setup
```bash
# Lokal
docker compose exec backend php artisan db:seed --force

# Production (karena PetugasSeeder dibatasi di env production, jalankan command import langsung)
docker compose --env-file .env.production -f compose.production.yaml exec backend php artisan import:master-putra --file="/var/www/data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx"
```

### Langkah 4: Eksekusi Import Master Pelanggaran & Sanksi
```bash
# Lokal
docker compose exec backend php artisan import:master-pelanggaran --file="../data/Database_Pelanggaran_Santri_Tebuireng.xlsx"

# Production
docker compose --env-file .env.production -f compose.production.yaml exec backend php artisan import:master-pelanggaran --file="/var/www/data/Database_Pelanggaran_Santri_Tebuireng.xlsx"
```

### Langkah 5: Eksekusi Import Profil & Rekam Historis (Enrichment)
```bash
docker compose exec backend php artisan import:santri-baru --file="/var/www/docs/EXCEL BARU/data_santri_semua.xls"
docker compose exec backend php artisan import:rekam-pelanggaran --file="/var/www/data/data_rekam_santri.xlsx"
docker compose exec backend php artisan import:alumni --file="/var/www/data/data_alumni.xlsx"
```

---

## 6. Query SQL Verifikasi Keselarasan 100% (SQL Audit Script)

Gunakan query ini di database lokal dan server untuk membuktikan data aligned 100%:

```sql
-- 1. Verifikasi Unit Pendidikan Operasional vs Total DB
SELECT COUNT(*) AS total_unit_db FROM unit_pendidikan; -- Target: 11
SELECT 
    u.kode, 
    u.nama, 
    COUNT(CASE WHEN s.status_aktif = 1 THEN 1 END) AS santri_aktif,
    COUNT(CASE WHEN s.status_aktif = 0 THEN 1 END) AS santri_legacy
FROM unit_pendidikan u
LEFT JOIN santri s ON u.unit_id = s.unit_id
GROUP BY u.unit_id, u.kode, u.nama
ORDER BY u.unit_id;
/*
Target Hasil:
+------+------+--------------+---------------+
| kode | nama | santri_aktif | santri_legacy |
+------+------+--------------+---------------+
| MTSS | MTSS |            0 |           479 |
| SMPT | SMPT |            0 |           710 |
| SMAT | SMAT |            0 |           632 |
| MAS  | MAS  |            0 |           137 |
| MU   | MU   |          433 |             0 |
| THS  | THS  |            0 |             7 |
| MTS  | MTS  |          438 |           177 |
| SMP  | SMP  |          479 |           221 |
| SMK  | SMK  |           86 |             1 |
| SMA  | SMA  |          381 |           177 |
| MA   | MA   |          409 |           215 |
+------+------+--------------+---------------+
*/

-- 2. Verifikasi Status Santri Putra
SELECT status_siswa_sumber, status_aktif, COUNT(*) AS jumlah FROM santri GROUP BY status_siswa_sumber, status_aktif;
-- Target: aktif (1.741), santri_baru_2026 (485), legacy_noncanonical (2.756)

-- 3. Verifikasi Kamar & Kelas
SELECT COUNT(*) AS kamar_aktif FROM kamar WHERE status_aktif = 1; -- Target: 175
SELECT COUNT(*) AS kelas_2026 FROM kelas_formal WHERE tahun_ajaran = '2026/2027'; -- Target: 262

-- 4. Verifikasi Pelanggaran & Sanksi
SELECT COUNT(*) AS total_kategori FROM kategori_pelanggaran; -- Target: 72
SELECT COUNT(*) AS total_sanksi FROM aturan_sanksi; -- Target: 5

-- 5. Verifikasi Antrean Review Match
SELECT status, COUNT(*) AS jumlah FROM santri_import_reviews GROUP BY status; -- Target: perlu_tinjau = 516

-- 6. Verifikasi Transaksi & Alumni
SELECT COUNT(*) AS total_pelanggaran FROM pelanggaran; -- Target: 669
SELECT COUNT(*) AS total_prestasi FROM prestasi; -- Target: 40
SELECT COUNT(*) AS total_alumni FROM alumni; -- Target: 18.768
```

---

## 7. Guardrail Keamanan & Operasional

1. **Dilarang keras `docker compose down -v` atau `php artisan migrate:fresh` di Production**:
   Menghapus volume database akan memusnahkan transaksi absensi, perizinan, dan keputusan review admin.
2. **Penanganan Format File `.xls`**:
   File `docs/EXCEL BARU/data_santri_semua.xls` adalah HTML-table berbasis DOM. Jangan diganti ke `.xlsx` tanpa memperbarui parser `ImportSantriBaruCommand`.
3. **Akun Admin Production**:
   Karena `PetugasSeeder` dibatasi khusus env `local` & `testing`, password akun Admin production diatur via Tinker CLI:
   ```bash
   php artisan tinker --execute="DB::table('petugas')->where('username', 'admin')->update(['password_hash' => Hash::make('PASSWORD_PROD_AMAN'), 'updated_at' => now()]);"
   ```
4. **Prinsip Idempotensi**:
   Semua command import bersifat idempoten (`updateOrInsert` / `upsert`). Menjalankan ulang command aman dan tidak akan menggandakan master data atau merusak relasi.
