# Guide Menjalankan Backend dan Frontend

Dokumen ini untuk menjalankan aplikasi Tebuireng di komputer lokal. Cara yang paling mudah adalah menggunakan Docker karena Docker sudah menyiapkan PHP, Composer, Node.js, npm, dan MySQL.

## Prasyarat

- Docker Engine dan Docker Compose v2; atau PHP 8.2+, Composer 2, Node.js 24+, npm, dan MySQL 8.
- Port `8000`, `5173`, dan `3307` tidak sedang digunakan.
- Jalankan semua perintah dari root repository, yaitu folder `tebuirengv2`.

## Opsi A — Docker (direkomendasikan)

### 1. Siapkan environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Untuk konfigurasi Docker lokal, pastikan nilai database di `backend/.env` menggunakan host service Docker:

```dotenv
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=absensi_santri
DB_USERNAME=tebuireng
DB_PASSWORD=tebuireng-local
FRONTEND_URL=http://localhost:5173
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173
```

`APP_KEY` boleh dibuat dengan perintah berikut jika masih kosong:

```bash
docker compose run --rm backend php artisan key:generate
```

### 2. Build dan jalankan service

```bash
docker volume create tebuireng_mysql_data
docker compose build
docker compose up -d
```

Service yang dijalankan:

| Service     | Alamat                | Keterangan                       |
| ----------- | --------------------- | -------------------------------- |
| Frontend    | http://localhost:5173 | Aplikasi web dan Vite dev server |
| Backend/API | http://localhost:8000 | Laravel API                      |
| MySQL       | `127.0.0.1:3307`    | Akses dari host                  |

Backend otomatis menjalankan migration saat container mulai. Cek statusnya dengan:

```bash
docker compose ps
docker compose logs -f backend frontend
```

### 3. Seed dan import data awal

Pada database baru, jalankan sekali:

```bash
docker compose exec backend php artisan db:seed --force
docker compose exec backend php artisan import:excel
```

File Excel sumber harus berada di folder `xlsx/` pada root repository. Jika belum ingin import data, langkah `import:excel` dapat dilewati.

### 4. Perintah harian

```bash
# Menyalakan kembali aplikasi
docker compose up -d

# Melihat log
docker compose logs -f backend frontend

# Menjalankan test
docker compose --profile tools run --rm test

# Menghentikan container tanpa menghapus database
docker compose down
```

Jangan gunakan `docker compose down -v` kecuali memang ingin menghapus database lokal dan seluruh data hasil import.

## Opsi B — Tanpa Docker

### 1. Siapkan MySQL

Buat database dan user, atau gunakan MySQL dari Docker:

```bash
docker compose up -d mysql
```

Jika memakai MySQL dari Docker dan backend berjalan langsung di host, gunakan `DB_HOST=127.0.0.1`, `DB_PORT=3307`, username `tebuireng`, dan password `tebuireng-local` di `backend/.env`.

### 2. Jalankan backend

Terminal pertama:

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=0.0.0.0 --port=8000
```

Atur `DB_*`, `APP_URL=http://localhost:8000`, `FRONTEND_URL=http://localhost:5173`, dan `SANCTUM_STATEFUL_DOMAINS` di `backend/.env` sebelum migration.

Untuk menjalankan scheduler pada terminal lain:

```bash
cd backend
php artisan schedule:work
```

### 3. Jalankan frontend

Terminal kedua:

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

Pastikan `frontend/.env` berisi:

```dotenv
VITE_API_URL=http://localhost:8000
```

Buka http://localhost:5173 setelah kedua server berjalan.

## Akun pengembangan

Seeder membuat akun `admin`, `pengasuh`, `keamanan`, `walikelas`, `pembinakamar`, dan `ustadz`. Password awal mengikuti nilai `LOCAL_SEED_PASSWORD` di `backend/.env.example` (default: `masuk123`). Ganti password setelah login dan jangan gunakan akun seed untuk produksi.

## Troubleshooting singkat

- **Frontend tidak bisa memanggil API:** cek `VITE_API_URL`, lalu pastikan backend berjalan di port `8000`.
- **Error koneksi database:** Docker memakai `DB_HOST=mysql` dan port internal `3306`; backend native memakai `127.0.0.1` dan biasanya port `3307` jika MySQL berasal dari Compose.
- **Perubahan dependency tidak terbaca:** jalankan `docker compose build` setelah `composer.lock` atau `package-lock.json` berubah.
- **Port sudah dipakai:** hentikan proses yang memakai port tersebut atau ubah mapping port di `compose.yaml` dan URL pada file `.env` terkait.
