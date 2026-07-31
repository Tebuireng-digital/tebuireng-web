# Perbaikan Database, Backend, dan Docker — P0 sampai P2

Dokumen ini mencatat perbaikan yang diterapkan sampai 31 Juli 2026. Tujuannya adalah menjaga data tetap konsisten, mencegah test merusak database development, memperketat login dan otorisasi, serta memisahkan workflow development/QA dari deployment production.

## Ringkasan hasil

| Prioritas | Fokus | Kondisi setelah perbaikan |
| --- | --- | --- |
| P0 | Integritas data dan login | Database memakai satu external volume; test hanya memakai SQLite in-memory; akun sementara memiliki kebijakan ganti password yang konsisten. |
| P1 | Keamanan backend | Endpoint dibatasi berdasarkan role dan penugasan; PII wali tidak dikirim melalui direktori umum; login stateless ditolak tanpa menghasilkan error 500. |
| P2 | Operasional Docker dan production | Stack production terpisah, image immutable/multi-stage, migrasi eksplisit, secret tidak masuk image/repository, dan readiness memeriksa database. |

## Arsitektur environment

### Development

- Manifest: `compose.yaml`.
- Source backend dan frontend memakai bind mount agar review cepat tanpa rebuild image setiap perubahan source.
- Database MySQL memakai external volume bernama tetap `tebuireng_mysql_data`.
- MySQL hanya diekspos ke host melalui `127.0.0.1:3307`.
- `FORCE_PASSWORD_CHANGE=false` boleh dipakai untuk mempercepat development. Nilai ini hanya melewati gate pada respons/API dan tidak mengubah flag akun di database.

### Test dan QA otomatis

- Perintah resmi: `docker compose --profile tools run --rm test`.
- Environment dipaksa menjadi `testing`.
- Koneksi dipaksa menjadi SQLite dengan database `:memory:`.
- `tests/TestCase.php` menolak test jika environment, driver, atau nama database tidak aman.
- `FORCE_PASSWORD_CHANGE=true` dipaksakan saat test agar kebijakan production tetap teruji walaupun gate development sedang dimatikan.

### Production

- Manifest: `compose.production.yaml`.
- Secret dibaca dari `.env.production`, bukan ditanam di image.
- `.env.production` diabaikan Git; `.env.production.example` hanya berisi template tanpa secret.
- `FORCE_PASSWORD_CHANGE=true` ditetapkan eksplisit.
- MySQL tidak membuka port ke host.
- Migrasi tidak dijalankan otomatis saat container aplikasi start.
- Frontend menjadi satu-satunya port HTTP publik dan meneruskan `/api`, `/sanctum`, dan `/ready` ke backend.

## P0 — integritas database dan kredensial

### 1. Satu volume database yang kanonis

Compose menggunakan external volume berikut:

```yaml
volumes:
  mysql_data:
    external: true
    name: tebuireng_mysql_data
```

Keuntungan:

- nama volume tidak berubah ketika nama project Compose berubah;
- `docker compose down` tidak menghapus data;
- aplikasi tidak diam-diam tersambung ke anonymous volume baru yang kosong.

Larangan operasional:

- jangan menjalankan `docker compose down -v` untuk penggunaan harian;
- jangan menghapus `tebuireng_mysql_data` tanpa backup yang sudah diverifikasi;
- jangan menyalin `/var/lib/mysql` ketika MySQL sedang aktif sebagai metode backup.

Verifikasi volume:

```bash
docker volume inspect tebuireng_mysql_data
docker inspect tebuireng-local-mysql-1 --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{println}}{{end}}'
```

Target yang benar adalah `tebuireng_mysql_data -> /var/lib/mysql`.

### 2. Test tidak boleh menyentuh MySQL

Insiden data hilang sebelumnya terjadi karena test Laravel dengan `RefreshDatabase` berjalan menggunakan koneksi MySQL development. Perbaikannya berlapis:

1. `phpunit.xml` memaksa `APP_ENV=testing`;
2. `phpunit.xml` memaksa `DB_CONNECTION=sqlite` dan `DB_DATABASE=:memory:`;
3. service `test` pada Compose mengulang konfigurasi aman tersebut;
4. `tests/TestCase.php` menghentikan test jika konfigurasi aktual tidak cocok.

Jangan menjalankan `php artisan test` dari container backend development. Gunakan:

```bash
docker compose --profile tools run --rm test
```

### 3. Backup dan restore

Backup logis sebelum migrasi atau impor besar:

```bash
mkdir -p backups/mysql
docker compose exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE"' \
  | gzip > "backups/mysql/absensi_santri-$(date +%Y%m%d-%H%M%S).sql.gz"
chmod 600 backups/mysql/*.sql.gz
sha256sum backups/mysql/*.sql.gz > backups/mysql/SHA256SUMS
```

Restore bersifat destruktif terhadap isi database tujuan. Lakukan hanya pada database yang targetnya sudah diperiksa dan setelah backup terbaru tersedia:

```bash
gzip -dc backups/mysql/NAMA_BACKUP.sql.gz \
  | docker compose exec -T mysql sh -c \
    'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
```

Setelah restore, periksa `/ready`, jumlah migrasi, jumlah akun, dan beberapa data santri representatif.

### 4. Password sementara

- Akun hasil impor dan akun yang di-reset Admin disimpan dengan `wajib_ganti_password=true`.
- Password reset dibuat acak minimal 16 karakter.
- Password baru minimal 12 karakter serta harus mengandung huruf dan angka.
- File kredensial baru ditulis ke `storage/app/private/credentials/` dengan permission `0600`.
- File kredensial harus dibagikan melalui kanal aman dan dihapus setelah distribusi selesai.
- Seeder akun contoh hanya dapat berjalan pada environment `local` atau `testing`.

Development boleh memakai:

```env
FORCE_PASSWORD_CHANGE=false
```

Database tetap menyimpan flag asli. Production dan test menggunakan `true`, sehingga kebijakan tidak hilang saat aplikasi dipromosikan.

## P1 — keamanan backend dan otorisasi

### 1. Gate ganti password di backend

Middleware `EnsurePasswordChanged` melindungi endpoint fitur. Ketika gate aktif dan flag akun masih benar, backend mengembalikan:

```json
{
  "code": "PASSWORD_CHANGE_REQUIRED"
}
```

dengan status HTTP `423`.

Endpoint yang tetap dapat digunakan adalah login, logout, `/api/me`, dan ganti password. Frontend menggunakan nilai efektif dari `/api/me` untuk mengarahkan pengguna ke halaman ganti password.

### 2. Session dan CSRF

- API menggunakan session cookie Laravel Sanctum.
- CSRF aktif untuk request stateful.
- Frontend Axios mengirim XSRF token.
- Login tanpa konteks frontend stateful ditolak dengan `419 STATEFUL_REQUEST_REQUIRED`, bukan error 500.
- Domain frontend harus tercantum secara tepat pada `SANCTUM_STATEFUL_DOMAINS` tanpa skema URL.

### 3. Otorisasi berbasis role dan penugasan

`SantriAccess` menerapkan scope query berdasarkan penugasan aktif dan kepemilikan kelas/kamar. Aturan penting:

- Admin mempunyai akses administratif global.
- Keamanan dan Pengasuh dapat membaca data operasional global sesuai kebutuhan role.
- Pembina Kamar hanya dapat membaca santri dan pelanggaran dalam penugasan aktifnya.
- Wali Kelas dan Ustadz tidak dapat memakai endpoint direktori/pelanggaran yang tidak diperlukan oleh tugasnya.
- Pembuatan, pembaruan, dan penghapusan pelanggaran diperiksa kembali oleh policy backend; tampilan menu frontend bukan kontrol keamanan utama.
- Direktori santri umum tidak mengirim PII wali.

Detail matriks role tersedia pada `docs/ROLE_AKSES_CODEBASE.md`.

### 4. Readiness

Endpoint `/ready` tidak hanya memeriksa proses PHP. Respons `200` diberikan setelah:

- koneksi database berhasil;
- tabel `migrations` tersedia;
- tabel `petugas` tersedia.

Jika salah satu syarat gagal, endpoint mengembalikan `503`.

```bash
curl -i http://localhost:8000/ready
```

## P2 — Docker dan deployment production

### 1. Pemisahan manifest

`compose.yaml` tetap dioptimalkan untuk development cepat. `compose.production.yaml` menggunakan:

- image backend PHP-FPM immutable;
- Nginx khusus public backend;
- image frontend hasil build statis;
- scheduler terpisah;
- service migrasi dengan profile `tools`;
- external volume database yang sama dan volume storage aplikasi terkelola.

### 2. Image backend multi-stage

`backend/Dockerfile.production` memisahkan tahap kompilasi dari runtime. Runtime tidak menyediakan Composer, Git, GCC, atau Make. Extension PHP yang diperlukan tetap tersedia: `bcmath`, `gd`, `intl`, `mbstring`, `PDO`, `pdo_mysql`, dan `zip`.

Image tidak menjalankan migrasi otomatis. Entrypoint hanya menyiapkan direktori writable, memastikan ownership, dan menunggu koneksi database sebelum menjalankan PHP-FPM.

### 3. Urutan deployment

```bash
cp .env.production.example .env.production
# Isi APP_KEY, URL/domain, password database, dan root password secara aman.

docker compose --env-file .env.production -f compose.production.yaml build

# Backup dan review migration terlebih dahulu.
docker compose --env-file .env.production -f compose.production.yaml \
  --profile tools run --rm migrate

docker compose --env-file .env.production -f compose.production.yaml up -d
```

Migrasi eksplisit memberi waktu untuk review QA dan rollback. Container aplikasi tidak akan mengubah skema hanya karena restart.

### 4. Dependency audit

- Audit Composer terakhir tidak menemukan advisory keamanan.
- React Router dipin ke versi `7.18.2`.
- npm masih menandai advisory high untuk mode React Server Components/server actions. Aplikasi ini adalah SPA browser dan tidak memakai fitur tersebut. Versi patched yang disebut advisory belum tersedia di registry pada saat audit.
- Rantai build PWA juga memiliki advisory transitive yang belum memiliki upgrade kompatibel dengan Vite 8.
- Jangan menjalankan `npm audit fix --force` tanpa review karena dapat menurunkan/mengubah major version dan memperkenalkan regresi.

Risiko dependency harus diaudit kembali sebelum go-live dan setiap lockfile berubah.

## Workflow harian yang aman

### Development

```bash
docker compose up -d
docker compose ps
docker compose logs -f backend frontend scheduler
```

Perubahan source normal langsung terbaca. Rebuild hanya diperlukan setelah Dockerfile atau lockfile berubah.

### QA cepat

```bash
docker compose --profile tools run --rm test
docker compose exec frontend npm run build
curl -fsS http://localhost:8000/ready
```

### Pemeriksaan data tanpa mutasi

```bash
docker compose exec backend php artisan migrate:status
docker compose exec backend php artisan tinker --execute="dump([
    'petugas' => App\\Models\\Petugas::count(),
    'santri' => App\\Models\\Santri::count(),
]);"
```

## Troubleshooting login dan koneksi

| Status/gejala | Arti umum | Pemeriksaan |
| --- | --- | --- |
| `401` | Kredensial salah, akun tidak aktif, atau session tidak ada | Periksa username, `status_aktif`, hash password, dan cookie browser. |
| `419` | Request tidak stateful atau CSRF/session tidak cocok | Periksa `APP_URL`, `FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS`, cookie secure, origin, dan XSRF token. |
| `423` | Akun wajib mengganti password | Normal saat `FORCE_PASSWORD_CHANGE=true`; buka halaman ganti password. |
| `/ready` menghasilkan `503` | Database/tabel belum siap | Periksa service MySQL, credential DB, mount volume, dan status migrasi. |
| Login berhasil lalu kembali ke halaman login | Cookie session tidak tersimpan/terkirim | Periksa domain, HTTPS, `SESSION_SECURE_COOKIE`, SameSite, reverse proxy, dan waktu server. |
| Data tiba-tiba kosong | Kemungkinan volume/database yang dipakai berbeda | Hentikan mutasi, inspect mount, cek nama database, lalu bandingkan backup. Jangan seed/import ulang sebelum akar masalah jelas. |

Perintah diagnosis awal:

```bash
docker compose ps
docker compose logs --tail=200 backend mysql
docker volume inspect tebuireng_mysql_data
docker compose exec backend php artisan config:show database
docker compose exec backend php artisan config:show sanctum
curl -i http://localhost:8000/ready
```

Setelah mengubah `.env`, jalankan:

```bash
docker compose exec backend php artisan optimize:clear
```

## Checklist sebelum production

- [ ] Backup terbaru memiliki checksum dan sudah diuji restore pada environment terpisah.
- [ ] `tebuireng_mysql_data` adalah mount MySQL yang benar.
- [ ] `.env.production` tidak terlacak Git dan permission file dibatasi.
- [ ] `APP_ENV=production`, `APP_DEBUG=false`, dan `FORCE_PASSWORD_CHANGE=true`.
- [ ] `APP_URL`, `FRONTEND_URL`, serta `SANCTUM_STATEFUL_DOMAINS` sesuai domain HTTPS sebenarnya.
- [ ] Test backend dan build frontend lulus dari lockfile yang akan dirilis.
- [ ] Audit Composer/npm sudah direview dan risiko residual didokumentasikan.
- [ ] Migration sudah direview dan dijalankan eksplisit setelah backup.
- [ ] `/ready` mengembalikan `200`.
- [ ] Login, logout, refresh session, ganti password, dan satu alur tiap role diuji melalui domain production/staging.
- [ ] Scheduler berjalan dan log tidak berisi error koneksi berulang.
- [ ] File kredensial sementara yang sudah selesai didistribusikan telah dihapus.

## Rollback

Jika deployment aplikasi bermasalah tetapi tidak ada migrasi destruktif, rollback ke tag image sebelumnya dan pertahankan external volume database. Jika migrasi perlu dibatalkan, gunakan prosedur rollback migration yang sudah direview atau restore backup pada maintenance window.

Jangan pernah menyelesaikan rollback dengan membuat volume baru, menjalankan seed, atau mengimpor ulang data sebelum memastikan database dan mount yang sedang aktif.

## Peta file utama

- `compose.yaml` — development dan test runner.
- `compose.production.yaml` — production.
- `backend/phpunit.xml` dan `backend/tests/TestCase.php` — guard test database.
- `backend/app/Http/Middleware/EnsurePasswordChanged.php` — gate password.
- `backend/app/Support/SantriAccess.php` — query scope penugasan.
- `backend/app/Policies/` — otorisasi backend.
- `backend/routes/web.php` — readiness database.
- `backend/Dockerfile.production` — image PHP-FPM multi-stage.
- `frontend/Dockerfile.production` — build frontend statis.
- `.env.production.example` — template konfigurasi production.
