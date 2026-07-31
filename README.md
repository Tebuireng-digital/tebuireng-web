# Tebuireng — MVP Manajemen Santri

MVP ini memprioritaskan absensi oleh petugas/pembina. Santri tidak memiliki akun. Lima sumber roster yang didukung:

1. kelas formal 7/8/9 — Wali Kelas;
2. kamar — Pembina Kamar;
3. kelompok Al-Qur'an setelah Subuh — Ustadz;
4. kelas Madin — Ustadz;
5. kelompok Takhasus setelah Maghrib — Ustadz.

Perizinan dibuat sekaligus disetujui oleh Keamanan. Pelanggaran dapat dicatat oleh petugas sesuai hak akses. Keputusan produk lengkap ada di [docs/prd.md](docs/prd.md).

## Kebutuhan

- PHP 8.2+ beserta ekstensi Laravel, GD, dan MySQL;
- Composer 2;
- MySQL 8;
- Node.js 24+ dan npm.

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
- `akun-petugas-baru.csv` untuk kredensial sementara petugas yang baru diimpor.

File kredensial hanya dibuat bila ada akun baru. Bagikan secara aman lalu hapus file tersebut. Semua akun impor wajib mengganti password saat login pertama. Sesuai keputusan data awal, satu kandidat dengan nama persis otomatis digabung; hanya nama yang memiliki lebih dari satu kandidat yang masuk daftar pemeriksaan manual.

Setelah impor, Admin membuka **Data Master**, lalu menetapkan petugas pada kelas, kamar, atau kelompok yang menjadi tanggung jawabnya.

## Akun seed pengembangan

Password awal seluruh akun berikut adalah `password` dan wajib langsung diganti: `admin`, `pengasuh`, `keamanan`, `walikelas`, `pembinakamar`, dan `ustadz`. Jangan gunakan akun seed tersebut sebagai kredensial produksi.

## Verifikasi

```bash
cd backend
php artisan test

cd ../frontend
npm run build
```

Absensi tetap dapat diisi saat koneksi perangkat terputus. Antrean offline dipisahkan per akun dan dikirim sebagai satu batch ketika koneksi kembali tersedia. Perizinan, pelanggaran, serta perubahan data master membutuhkan koneksi.
