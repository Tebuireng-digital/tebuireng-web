# Tebuireng — MVP Manajemen Santri

MVP ini memprioritaskan absensi oleh petugas/pembina. Santri tidak memiliki akun. Lima sumber roster yang didukung:

1. kelas formal 7/8/9 — Wali Kelas;
2. kamar — Pembina Kamar;
3. kelompok Al-Qur'an setelah Subuh — Ustadz;
4. kelas Madin — Ustadz;
5. kelompok Takhasus setelah Maghrib — Ustadz.

Perizinan dibuat sekaligus disetujui oleh Keamanan. Pelanggaran dapat dicatat oleh petugas sesuai hak akses. Keputusan produk lengkap ada di [docs/prd.md](docs/prd.md).

## Kebutuhan

- Docker Engine dan Docker Compose (cara lokal yang direkomendasikan); atau
- PHP 8.2+ beserta ekstensi Laravel, GD, dan MySQL;
- Composer 2;
- MySQL 8;
- Node.js 24+ dan npm.

## Menjalankan dengan Docker (direkomendasikan)

Panduan lengkap langkah demi langkah tersedia di [docs/GUIDE_RUN.md](docs/GUIDE_RUN.md).

Environment lokal sudah disiapkan untuk MySQL 8, Laravel/PHP 8.3, scheduler, dan Vite:

```bash
# satu kali per mesin; Compose memakai external volume bernama tetap
docker volume inspect tebuireng_mysql_data >/dev/null 2>&1 || docker volume create tebuireng_mysql_data

# pertama kali, atau setelah Dockerfile/lockfile berubah
docker compose build

# pemakaian harian
docker compose up -d
```

Source backend dan frontend dipasang sebagai bind mount. Perubahan source biasa langsung terbaca oleh Laravel/Vite dan **tidak memerlukan build ulang**. Dependency Composer/npm berada pada layer dan volume terpisah; `backend`, `scheduler`, dan `test` juga memakai satu image backend yang sama. Checksum lockfile memastikan volume dependency hanya disinkronkan ketika lockfile benar-benar berubah.

Build ulang hanya diperlukan setelah mengubah `Dockerfile`, `composer.lock`, atau `package-lock.json`:

```bash
docker compose build
docker compose up -d
```

Build cache hangat pada setup ini terukur 3,71–5,40 detik. Build pertama terukur 106 detik, termasuk download base image dan pengisian cache awal. Kecepatan build pertama tetap bergantung pada koneksi internet. Hindari `--no-cache`, `docker builder prune`, dan `docker system prune` karena perintah tersebut membuang cache dependency.

Pada database baru, jalankan seed dan impor satu kali:

```bash
docker compose exec backend php artisan db:seed --force
docker compose exec backend php artisan import:excel
```

Buka aplikasi di <http://localhost:5173>. API tersedia di <http://localhost:8000> dan MySQL dapat diakses dari host melalui port `3307`. Database disimpan di Docker volume sehingga `docker compose down` tidak menghapus data.

Perintah operasional:

```bash
# status service
docker compose ps

# log aplikasi
docker compose logs -f backend frontend scheduler

# test aman memakai SQLite in-memory
docker compose --profile tools run --rm test

# menghentikan service tanpa menghapus database
docker compose down
```

Jangan menjalankan `docker compose down -v` kecuali benar-benar ingin menghapus database lokal beserta seluruh hasil impor.

Untuk database operasional, buat backup logis sebelum migrasi atau impor besar dan uji proses restore secara berkala. Jangan menyalin direktori `/var/lib/mysql` ketika server sedang aktif:

```bash
mkdir -p backups/mysql
docker compose exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE"' \
  | gzip > "backups/mysql/absensi_santri-$(date +%Y%m%d-%H%M%S).sql.gz"
chmod 600 backups/mysql/*.sql.gz
sha256sum backups/mysql/*.sql.gz > backups/mysql/SHA256SUMS
```

## Menjalankan backend

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Sesuaikan koneksi MySQL, `APP_URL`, `FRONTEND_URL`, dan `SANCTUM_STATEFUL_DOMAINS` di `backend/.env`. Pada server operasional jalankan scheduler Laravel secara permanen:

```bash
php artisan schedule:work
```

## Menjalankan frontend

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Isi `VITE_API_URL` dengan alamat backend yang dapat dijangkau perangkat pembina. Untuk build produksi gunakan `npm run build`.

## Impor data awal

Lima workbook roster dan workbook pelanggaran harus berada di folder `xlsx/`, lalu jalankan setelah migrasi dan seed:

```bash
cd backend
php artisan import:excel
```

Hasil rekonsiliasi tersimpan di `backend/storage/app/`:

- `mapping-kamar-draft.csv` untuk pemetaan singkatan kamar;
- `santri-review-kandidat.xlsx` untuk nama yang masih memiliki lebih dari satu kandidat;
- `santri-review-baru.xlsx` untuk santri yang dibuat otomatis dan perlu diverifikasi;
- `private/credentials/akun-petugas-<timestamp>.csv` untuk kredensial sementara petugas yang baru diimpor (permission `0600`).

File kredensial hanya dibuat bila ada akun baru. Bagikan secara aman lalu hapus file tersebut. Semua akun impor wajib mengganti password saat login pertama. Sesuai keputusan data awal, satu kandidat dengan nama persis otomatis digabung; hanya nama yang memiliki lebih dari satu kandidat yang masuk daftar pemeriksaan manual.

Setelah impor, Admin membuka **Data Master**, lalu menetapkan petugas pada kelas, kamar, atau kelompok yang menjadi tanggung jawabnya.

## Akun seed pengembangan

Password awal seluruh akun petugas pada environment lokal mengikuti `LOCAL_SEED_PASSWORD` (default `masuk123`). Seeder hanya boleh dijalankan pada environment `local`/`testing`; jangan gunakan kredensial lokal tersebut di produksi. Impor pada produksi menghasilkan password acak dan mewajibkan penggantian password saat login pertama.

Untuk mempercepat review lokal, `.env.example` menetapkan `FORCE_PASSWORD_CHANGE=false`. Manifest production selalu menetapkan nilainya ke `true`.

## Deployment production

Production memakai manifest terpisah dan migration dijalankan eksplisit setelah backup:

```bash
cp .env.production.example .env.production
# isi APP_KEY, DB_PASSWORD, MYSQL_ROOT_PASSWORD, dan URL production
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml --profile tools run --rm migrate
docker compose --env-file .env.production -f compose.production.yaml up -d
```

Jangan memakai `.env.production` atau `compose.production.yaml` untuk test. Development memakai `compose.yaml`, sedangkan test memakai SQLite in-memory.

## Verifikasi

```bash
cd backend
php artisan test

cd ../frontend
npm run build
```

Pada setup Docker, gunakan `docker compose --profile tools run --rm test` dan `docker compose exec frontend npm run build`.

Absensi tetap dapat diisi saat koneksi perangkat terputus. Antrean offline dipisahkan per akun dan dikirim sebagai satu batch ketika koneksi kembali tersedia. Perizinan, pelanggaran, serta perubahan data master membutuhkan koneksi.
