# Walkthrough Pengujian MVP Tebuireng

Versi: 31 Juli 2026. Dokumen ini digunakan untuk uji coba internal sebelum sistem dipakai sebagai aplikasi operasional.

## Status setup lokal saat ini

Setup pada mesin ini sudah aktif dan tidak perlu diinisialisasi ulang:

| Komponen | Alamat/status |
|---|---|
| Frontend | <http://localhost:5173> |
| Backend API | <http://localhost:8000> |
| Health check | <http://localhost:8000/up> |
| MySQL 8 | `localhost:3307`, Docker volume persisten |
| Scheduler | aktif setiap menit |
| Test otomatis | 14 test, 43 assertion, seluruhnya lulus |
| Docker build | cold build 106 detik; warm build 3,71–5,40 detik |

Database lokal sudah berisi 2.310 santri. Roster yang terisi: formal 2.117, kamar 1.503, Al-Qur'an 1.712, Madin 1.775, dan Takhasus 1.732.

Untuk mulai atau melanjutkan testing pada mesin ini:

```bash
docker compose up -d
docker compose ps
```

Jangan menjalankan seed atau impor lagi pada setup yang sudah terisi ini.

## 1. Batas MVP

Fitur yang siap diuji:

- login petugas tanpa akun santri;
- lima roster absensi: kelas formal, kamar, Al-Qur'an Subuh, Madin, dan Takhasus Maghrib;
- pembatasan roster berdasarkan jabatan dan penugasan;
- input absensi massal dan sinkronisasi antrean offline;
- perizinan yang dibuat dan langsung disetujui Keamanan;
- pencatatan keluar/kembali di gerbang;
- pencatatan pelanggaran dan lampiran;
- laporan dasar PDF/Excel;
- pengaturan penugasan oleh Admin.

Mode offline saat ini digunakan setelah halaman roster berhasil dibuka ketika masih online. Jangan memuat ulang atau membuka roster baru setelah koneksi terputus karena roster belum disimpan permanen di perangkat.

## 2. Menyiapkan instalasi baru

### Cara Docker (direkomendasikan)

Dari root repository:

```bash
docker compose build
docker compose up -d
```

Environment lokal, MySQL, backend, frontend, dan scheduler akan dijalankan otomatis. Hanya untuk volume database yang benar-benar baru, jalankan seed dan impor satu kali:

```bash
docker compose exec backend php artisan db:seed --force
docker compose exec backend php artisan import:excel
```

Buka <http://localhost:5173>. Periksa service dengan `docker compose ps`; MySQL dan backend harus berstatus `healthy`.

Jalankan test menggunakan service SQLite khusus agar data MySQL hasil impor tidak disentuh:

```bash
docker compose --profile tools run --rm test
```

Jangan menjalankan `php artisan test` langsung pada container backend. Perintah tersebut dapat memakai koneksi MySQL aplikasi. Jangan pula menggunakan `docker compose down -v` pada database yang ingin dipertahankan.

### Build cepat dan penggunaan cache

Untuk perubahan source PHP, React, CSS, atau konfigurasi aplikasi biasa, tidak perlu menjalankan build. Folder source sudah dipasang langsung ke container; cukup biarkan service aktif dan Vite akan melakukan hot reload:

```bash
docker compose up -d
```

Jalankan build ulang hanya jika `Dockerfile`, `composer.lock`, atau `package-lock.json` berubah:

```bash
docker compose build
docker compose up -d
```

Dockerfile menyalin lockfile lebih dahulu dan memakai cache download BuildKit untuk Composer/npm. Backend, scheduler, dan test memakai image backend yang sama, sehingga dependency PHP hanya dibangun sekali. Checksum lockfile pada startup memastikan named volume hanya disinkronkan jika dependency memang berubah. Pengukuran pada mesin ini: build pertama 106 detik dan build tanpa perubahan 3,71–5,40 detik. Cold build dapat berubah mengikuti koneksi internet, sedangkan target build cache hangat berada jauh di bawah lima menit.

Jangan gunakan opsi/perintah berikut pada penggunaan harian karena akan membuang cache dan membuat build berikutnya lambat:

```text
docker compose build --no-cache
docker builder prune
docker system prune
```

### Cara tanpa Docker

Siapkan MySQL 8 dan buat database kosong, misalnya `absensi_santri`.

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
```

Isi koneksi database pada `.env`, serta pastikan nilai berikut sesuai alamat frontend:

```dotenv
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173
```

Kemudian jalankan:

```bash
php artisan migrate --seed
php artisan import:excel
php artisan serve
```

Jangan menjalankan `migrate:fresh` pada database yang sudah berisi data operasional karena perintah tersebut menghapus seluruh tabel.

Setelah impor, simpan `backend/storage/app/akun-petugas-baru.csv` di tempat aman. File tersebut berisi password sementara petugas hasil impor. Bagikan secara privat dan hapus file setelah akun dibagikan.

## 3. Persiapan frontend tanpa Docker

Pada terminal lain:

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Untuk pengujian online dari HP, ganti `VITE_API_URL` dengan IP komputer backend yang dapat dijangkau HP. Sesuaikan juga `FRONTEND_URL` dan `SANCTUM_STATEFUL_DOMAINS` pada backend, lalu restart frontend dan backend. Jangan memakai `localhost` karena pada HP alamat itu menunjuk ke HP sendiri.

Service worker/PWA tidak aktif pada alamat IP HTTP biasa. Uji offline melalui `localhost`, atau siapkan HTTPS terlebih dahulu untuk pengujian dari HP.

## 4. Login awal

Akun seed pengembangan menggunakan password `password`:

| Username | Jabatan |
|---|---|
| `admin` | Admin |
| `pengasuh` | Pengasuh |
| `keamanan` | Keamanan |
| `walikelas` | Wali Kelas |
| `pembinakamar` | Pembina Kamar |
| `ustadz` | Ustadz |

Semua akun harus diarahkan ke halaman ganti password saat login pertama. Masukkan password lama `password`, lalu buat password baru minimal enam karakter. Setelah berhasil, pengguna diarahkan ke Dashboard. Gunakan akun seed hanya untuk pengujian.

Kredensial akun hasil impor terdapat di `backend/storage/app/akun-petugas-baru.csv`. File ini sensitif dan tidak masuk Git. Bagikan secara privat lalu hapus setelah akun diterima petugas.

## 5. Atur penugasan

1. Login sebagai Admin.
2. Buka **Data Master**.
3. Buat penugasan berikut:

| Kegiatan | Jabatan petugas | Target penugasan |
|---|---|---|
| Kelas formal 7/8/9 | Wali Kelas | KelasFormal |
| Kamar | Pembina Kamar | Kamar |
| Al-Qur'an Subuh | Ustadz | KelompokPBS |
| Madin | Ustadz | KelompokMadin |
| Takhasus Maghrib | Ustadz | KelompokPBM |

4. Logout, lalu login menggunakan akun petugas terkait.
5. Dashboard seharusnya hanya menampilkan kelompok yang ditugaskan kepada akun tersebut.

Admin dapat melihat semua target tanpa penugasan khusus.

## 6. Uji absensi online

Ulangi pengujian untuk kelima jenis kegiatan:

1. Pilih kartu kelompok dari Dashboard.
2. Pastikan nama kegiatan, target, jadwal, tanggal, dan daftar santri benar.
3. Ubah beberapa status menjadi `Sakit`, `Izin`, `Alpha`, dan `Terlambat`.
4. Tekan lama nama/status santri untuk mengisi menit keterlambatan atau catatan.
5. Tekan **Simpan Absensi**.
6. Muat ulang halaman.

Hasil yang diharapkan: status yang disimpan tetap sama dan tidak terbentuk baris duplikat ketika tombol simpan ditekan kembali.

## 7. Uji absensi offline

1. Ketika masih online, buka salah satu halaman roster sampai semua santri tampil.
2. Putuskan koneksi internet tanpa memuat ulang halaman.
3. Ubah beberapa status dan tekan **Simpan Absensi**.
4. Pastikan aplikasi menunjukkan bahwa data masuk antrean offline.
5. Aktifkan kembali internet.
6. Tunggu proses sinkronisasi, lalu muat ulang halaman.

Hasil yang diharapkan: perubahan dikirim sebagai satu batch dan muncul kembali setelah halaman dimuat ulang. Antrean akun A tidak boleh terkirim menggunakan akun B.

## 8. Uji perizinan dan gerbang

1. Login sebagai Keamanan.
2. Buka **Perizinan & Gerbang**.
3. Cari santri, pilih jenis izin, isi keperluan, tanggal mulai, dan rencana kembali.
4. Simpan perizinan.

Hasil yang diharapkan: izin langsung berstatus disetujui tanpa tahapan persetujuan Wali Kelas/Pembina/Pengasuh dan absensi pada periode terkait mendapat status `Izin`.

Lanjutkan dengan mencatat waktu keluar dan waktu kembali. Pastikan status perjalanan berubah sesuai pencatatan gerbang.

## 9. Uji pelanggaran

1. Login sebagai Admin, Keamanan, atau Pembina Kamar.
2. Pilih santri dan kategori pelanggaran.
3. Isi tanggal dan keterangan.
4. Simpan, kemudian unggah JPG/PNG/PDF sebagai lampiran.

Hasil yang diharapkan:

- Pembina Kamar hanya dapat mencatat kategori ringan pada santri dalam penugasannya;
- Keamanan dapat mencatat kategori sedang dan berat;
- Admin dapat mencatat seluruh kategori;
- ID pelanggaran terbentuk dan lampiran tersimpan;
- total poin santri bertambah sesuai kategori.

## 10. Uji laporan

Login sebagai Admin atau Pengasuh, lalu buka **Laporan Detail**. Unduh laporan PDF dan Excel. Pastikan browser mengunduh file tanpa mengalihkan pengguna ke halaman login dan angka laporan bulanan berasal dari absensi yang baru diuji.

## 11. Data yang perlu diperhatikan

Sebanyak 719 baris yang sebelumnya masuk `santri-review-kandidat.xlsx` bukan data santri kosong. Seluruhnya mempunyai tepat satu kandidat nama yang sama:

- 432 baris Database Siswa tidak mempunyai kolom kamar pada workbook sumber;
- 114 baris berasal dari Madin;
- 107 baris berasal dari Al-Qur'an;
- 66 baris berasal dari Takhasus.

Sesuai keputusan pemilik data, seluruh kandidat tunggal tersebut sekarang otomatis digabung. Kamar dan unit dari database induk dipertahankan, sedangkan NIS, kelas, dan kelompok dari sumber lain ditambahkan. Hasil impor terakhir menunjukkan kandidat ambigu `0`.

File `santri-review-baru.xlsx` berbeda dari daftar 719 tadi. File ini berisi 971 kemunculan pada sumber yang saat impor awal belum mempunyai kandidat nama di database. Santri tersebut dibuat otomatis jika unitnya dapat ditentukan dan diberi catatan `perlu verifikasi`. Periksa nama, unit, dan kamar mereka sebelum penggunaan operasional penuh.

## 12. Syarat sebelum produksi

- verifikasi santri pada `santri-review-baru.xlsx`;
- pastikan seluruh petugas sudah mendapat penugasan yang benar;
- ubah seluruh password awal;
- gunakan HTTPS;
- atur backup MySQL harian;
- jalankan `php artisan schedule:work` sebagai service;
- uji dengan beberapa HP dan kondisi jaringan pesantren;
- lakukan pilot pada satu kamar/kelas terlebih dahulu sebelum membuka semua roster.

## 13. Checklist penerimaan testing

Catat hasil setiap skenario dengan `Lulus`, `Gagal`, dan keterangan:

| Skenario | Hasil yang wajib tercapai |
|---|---|
| Login pertama | wajib mengganti password |
| Wali Kelas | hanya melihat kelas formal yang ditugaskan |
| Pembina Kamar | hanya melihat kamar yang ditugaskan |
| Ustadz | hanya melihat kelompok Al-Qur'an/Madin/Takhasus yang ditugaskan |
| Absensi online | tersimpan dan tetap sama setelah refresh |
| Simpan berulang | tidak membuat data duplikat |
| Absensi offline | antre saat putus koneksi dan sinkron kembali |
| Perizinan | langsung disetujui Keamanan dan menghasilkan status Izin |
| Gerbang | waktu keluar dan kembali tercatat |
| Pelanggaran | kategori mengikuti jabatan dan poin bertambah |
| Lampiran | JPG/PNG/PDF berhasil tersimpan |
| Laporan | PDF/Excel terunduh dengan sesi login aktif |

## 14. Troubleshooting

Periksa kondisi service:

```bash
docker compose ps
docker compose logs --tail=100 backend frontend scheduler
```

- Login `401`: gunakan frontend dan backend dengan hostname yang konsisten (`localhost`, jangan dicampur dengan `127.0.0.1`), lalu bersihkan cookie situs.
- Dashboard petugas kosong: Admin belum memberikan penugasan yang sesuai jabatan.
- Frontend tidak dapat menghubungi API: periksa `frontend/.env`, CORS, dan `backend/.env`.
- Perubahan source belum terlihat: Vite seharusnya hot reload; bila perlu jalankan `docker compose restart backend frontend` tanpa build ulang.
- Build tiba-tiba menginstal dependency: periksa apakah `composer.lock`, `package-lock.json`, atau Dockerfile berubah. Jangan gunakan `--no-cache`.
- Ingin menjalankan test: gunakan `docker compose --profile tools run --rm test`.
- Menghentikan aplikasi tanpa kehilangan data: gunakan `docker compose down`.
- `docker compose down -v` menghapus seluruh database lokal dan hanya boleh dipakai bila memang ingin mulai dari nol.
