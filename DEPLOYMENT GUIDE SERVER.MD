# Deployment Guide Server — Tebuireng V2

Panduan ini menjelaskan deployment production berbasis Docker Compose yang sudah tersedia di repository. Seluruh perintah dijalankan dari root repository, yaitu direktori yang berisi `compose.production.yaml`.

## 1. Arsitektur production

Alur request production:

```text
Internet -> HTTPS reverse proxy server -> frontend:80
                                        -> backend-web:80 -> backend PHP-FPM:9000
                                                              -> mysql:3306
```

Service pada `compose.production.yaml`:

| Service | Fungsi | Akses publik |
| --- | --- | --- |
| `frontend` | Nginx, static React, dan proxy `/api` serta `/sanctum` | Port host `${HTTP_PORT}` |
| `backend-web` | Nginx untuk Laravel | Tidak |
| `backend` | Laravel pada PHP-FPM | Tidak |
| `mysql` | MySQL 8.4 | Tidak |
| `migrate` | Menjalankan migrasi secara eksplisit | Hanya profile `tools` |

Database disimpan dalam external volume `tebuireng_mysql_data`. File aplikasi seperti lampiran, hasil review impor, dan kredensial impor tersimpan dalam volume `backend_storage`.

## 2. Kebutuhan server

Rekomendasi minimum untuk beban awal:

- Linux server 64-bit; Ubuntu Server LTS direkomendasikan.
- 2 vCPU, RAM 4 GB, dan storage SSD 40 GB.
- Docker Engine dan Docker Compose plugin (`docker compose`).
- Git, OpenSSL, reverse proxy, dan sertifikat TLS.
- Domain yang sudah mengarah ke IP publik server.
- Port publik hanya `22` (batasi berdasarkan IP bila memungkinkan), `80`, dan `443`.

Jangan membuka port MySQL `3306`, PHP-FPM `9000`, backend-web, atau `${HTTP_PORT}` ke internet. Jika reverse proxy berjalan di host dan `${HTTP_PORT}` masih ter-bind ke semua interface oleh Compose, blokir port tersebut pada firewall/security group.

Verifikasi instalasi:

```bash
docker --version
docker compose version
git --version
```

## 3. Menyiapkan aplikasi

Contoh lokasi instalasi:

```bash
sudo mkdir -p /opt/tebuireng
sudo chown "$USER":"$USER" /opt/tebuireng
git clone <URL_REPOSITORY> /opt/tebuireng
cd /opt/tebuireng
git checkout <TAG_ATAU_COMMIT_PRODUCTION>
```

Gunakan tag atau commit yang telah diuji. Jangan melakukan deployment langsung dari branch kerja yang berubah-ubah.

### Membuat environment production

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Buat nilai rahasia. Simpan output langsung ke password manager dan jangan masukkan ke Git:

```bash
printf 'APP_KEY=base64:%s\n' "$(openssl rand -base64 32)"
printf 'DB_PASSWORD=%s\n' "$(openssl rand -hex 32)"
printf 'MYSQL_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 32)"
```

Isi `.env.production`, misalnya:

```dotenv
APP_KEY=base64:<HASIL_RANDOM_32_BYTE>
APP_URL=https://absensi.example.org
FRONTEND_URL=https://absensi.example.org
SANCTUM_STATEFUL_DOMAINS=absensi.example.org

DB_DATABASE=absensi_santri
DB_USERNAME=tebuireng
DB_PASSWORD=<PASSWORD_DATABASE_KUAT>
MYSQL_ROOT_PASSWORD=<PASSWORD_ROOT_MYSQL_KUAT>

HTTP_PORT=8080
```

Ketentuan penting:

- `APP_URL` dan `FRONTEND_URL` harus sama dengan URL HTTPS yang dibuka pengguna, tanpa garis miring di akhir.
- `SANCTUM_STATEFUL_DOMAINS` hanya berisi host yang dipercaya. Jangan menyertakan skema `https://`; sertakan port hanya jika bukan port standar.
- Jangan mengganti `APP_KEY` setelah aplikasi beroperasi karena session dan data terenkripsi lama tidak lagi dapat dibaca.
- Jangan memakai password development atau password yang mengandung baris baru.

Validasi bahwa seluruh variabel wajib sudah terisi:

```bash
docker compose --env-file .env.production -f compose.production.yaml config --quiet
```

### Membuat volume database

Volume database bersifat external dan wajib dibuat satu kali sebelum deployment pertama:

```bash
docker volume inspect tebuireng_mysql_data >/dev/null 2>&1 || \
  docker volume create tebuireng_mysql_data
```

Jangan menjalankan `docker volume rm tebuireng_mysql_data` atau `docker compose down -v` pada server operasional.

## 4. Deployment pertama

Build image immutable dari source yang telah dipilih:

```bash
docker compose --env-file .env.production -f compose.production.yaml build --pull
```

Jalankan migrasi. Perintah ini akan menyalakan MySQL bila belum aktif:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  --profile tools run --rm migrate
```

Kemudian jalankan seluruh service aplikasi:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  up -d --remove-orphans
```

Periksa status dan log:

```bash
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml \
  logs --tail=200 backend backend-web frontend mysql
curl --fail --show-error http://127.0.0.1:8080/ready
```

Respons readiness yang benar:

```json
{"status":"ready"}
```

### Catatan database production baru

Saat ini `PetugasSeeder` sengaja menolak dijalankan pada environment selain `local` atau `testing`. Karena `DatabaseSeeder` selalu memanggil seeder tersebut, **jangan menjalankan** perintah berikut di production:

```bash
php artisan db:seed --force
php artisan migrate --seed
```

Migrasi pada database kosong hanya membuat struktur tabel; migrasi belum menghasilkan akun Admin dan data referensi operasional. Sampai tersedia seeder baseline yang aman untuk production atau perintah bootstrap Admin khusus, deployment database baru harus menggunakan dump database yang telah diverifikasi dan disanitasi dari environment persiapan. Restore dump sebelum aplikasi dibuka ke pengguna, lalu jalankan migrasi terbaru.

Perintah `import:excel` juga bukan pengganti bootstrap tersebut karena membutuhkan data referensi awal. Jangan mengimpor workbook operasional sebelum backup dibuat dan prosedurnya telah diuji di staging.

## 5. HTTPS dan reverse proxy

Aplikasi production mengaktifkan secure cookie, sehingga akses pengguna wajib melalui HTTPS. Contoh virtual host Nginx pada server:

```nginx
server {
    listen 80;
    server_name absensi.example.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name absensi.example.org;

    ssl_certificate /etc/letsencrypt/live/absensi.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/absensi.example.org/privkey.pem;

    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Pasang atau perbarui sertifikat dengan mekanisme yang dipilih administrator server, kemudian uji dan reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl --fail --show-error https://absensi.example.org/ready
```

Pastikan port `8080` tidak dapat diakses dari internet. Pengguna hanya boleh masuk melalui domain HTTPS.

## 6. Menjalankan Laravel scheduler

`routes/console.php` mendefinisikan reminder absensi dan pemeriksaan perizinan overdue, tetapi `compose.production.yaml` saat ini belum memiliki service scheduler. Tanpa langkah tambahan, kedua job tersebut tidak berjalan.

Solusi sementara adalah host cron yang memanggil scheduler setiap menit. Edit crontab pengguna yang memiliki izin Docker:

```bash
crontab -e
```

Tambahkan satu baris berikut dan sesuaikan lokasi repository:

```cron
* * * * * cd /opt/tebuireng && /usr/bin/docker compose --env-file .env.production -f compose.production.yaml exec -T backend php artisan schedule:run >> /var/log/tebuireng-scheduler.log 2>&1
```

Pastikan pengguna cron dapat menulis log tersebut, atau arahkan log ke lokasi yang sesuai. Verifikasi manual:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  exec -T backend php artisan schedule:list
docker compose --env-file .env.production -f compose.production.yaml \
  exec -T backend php artisan schedule:run
```

Untuk jangka panjang, tambahkan service scheduler terpisah ke manifest production agar lifecycle dan log-nya dikelola Docker Compose.

## 7. Backup

Backup wajib dilakukan sebelum migrasi, update aplikasi, impor data, dan perubahan master yang besar. Simpan hasil backup di storage lain; file yang hanya berada pada server yang sama bukan backup yang memadai.

### Backup database

```bash
cd /opt/tebuireng
backup_dir="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

docker compose --env-file .env.production -f compose.production.yaml exec -T mysql \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --events "$MYSQL_DATABASE"' \
  > "$backup_dir/database.sql"
```

### Backup storage backend

```bash
docker compose --env-file .env.production -f compose.production.yaml exec -T backend \
  tar -C /var/www/html/storage -czf - . \
  > "$backup_dir/backend-storage.tar.gz"

sha256sum "$backup_dir/database.sql" "$backup_dir/backend-storage.tar.gz" \
  > "$backup_dir/SHA256SUMS"
```

Periksa bahwa kedua file tidak kosong, salin ke media backup terenkripsi, dan uji restore secara berkala. Jangan menyalin `/var/lib/mysql` ketika MySQL sedang berjalan.

### Restore database

Restore bersifat destruktif terhadap isi database tujuan. Hentikan akses pengguna, buat backup kondisi terakhir, dan pastikan file yang dipilih benar.

```bash
docker compose --env-file .env.production -f compose.production.yaml exec -T mysql \
  sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  < backups/<TIMESTAMP>/database.sql
```

Restore storage pada server staging terlebih dahulu untuk memastikan arsip valid. Pada insiden production, ekstrak hanya setelah isi volume saat ini diamankan.

## 8. Update aplikasi

Urutan update production:

```bash
cd /opt/tebuireng
git fetch --tags origin
git checkout <TAG_ATAU_COMMIT_BARU>

# Jalankan test di CI/staging, lalu backup production.
docker compose --env-file .env.production -f compose.production.yaml build --pull

docker compose --env-file .env.production -f compose.production.yaml \
  --profile tools run --rm migrate

docker compose --env-file .env.production -f compose.production.yaml \
  up -d --remove-orphans

docker compose --env-file .env.production -f compose.production.yaml ps
curl --fail --show-error https://absensi.example.org/ready
```

Lanjutkan dengan smoke test: buka halaman login, login menggunakan akun uji production yang sah, buka dashboard sesuai role, dan uji satu endpoint baca. Jangan menggunakan data pribadi asli untuk smoke test yang menulis data.

## 9. Rollback

Rollback aplikasi tidak selalu berarti rollback database. Jangan menjalankan `php artisan migrate:rollback` secara otomatis karena migrasi lama dapat menghapus atau mengubah data.

Prosedur aman:

1. Hentikan akses pengguna jika ada risiko inkonsistensi.
2. Simpan log dan backup keadaan terakhir.
3. Checkout tag/commit aplikasi sebelumnya.
4. Build ulang dan jalankan `docker compose up -d`.
5. Jika schema baru tidak kompatibel, restore database dan storage dari backup sebelum update.
6. Jalankan readiness dan smoke test sebelum membuka akses kembali.

Perintah rollback image/source:

```bash
git checkout <TAG_ATAU_COMMIT_SEBELUMNYA>
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml \
  up -d --remove-orphans
```

## 10. Operasional harian

```bash
# Status container
docker compose --env-file .env.production -f compose.production.yaml ps

# Log aplikasi
docker compose --env-file .env.production -f compose.production.yaml \
  logs -f --tail=200 backend backend-web frontend

# Log database
docker compose --env-file .env.production -f compose.production.yaml \
  logs --tail=200 mysql

# Readiness internal dan publik
curl --fail --show-error http://127.0.0.1:8080/ready
curl --fail --show-error https://absensi.example.org/ready

# Daftar migrasi
docker compose --env-file .env.production -f compose.production.yaml \
  exec -T backend php artisan migrate:status
```

Gunakan rotasi log Docker dan log reverse proxy, pantau kapasitas disk, umur sertifikat TLS, penggunaan RAM, status container, readiness, keberhasilan backup, serta hasil scheduler.

Untuk menghentikan aplikasi tanpa menghapus volume:

```bash
docker compose --env-file .env.production -f compose.production.yaml down
```

## 11. Checklist go-live

- [ ] Domain mengarah ke server yang benar.
- [ ] Hanya port `22`, `80`, dan `443` yang dibuka sesuai kebutuhan.
- [ ] `.env.production` berizin `600`, tidak masuk Git, dan seluruh rahasia unik.
- [ ] `APP_URL`, `FRONTEND_URL`, dan `SANCTUM_STATEFUL_DOMAINS` sesuai domain HTTPS.
- [ ] External volume `tebuireng_mysql_data` tersedia.
- [ ] Backup database dan backend storage berhasil serta tersalin ke lokasi lain.
- [ ] Migrasi selesai tanpa error.
- [ ] Seluruh container berstatus berjalan.
- [ ] Endpoint `/ready` internal dan publik mengembalikan HTTP 200.
- [ ] TLS valid dan port `${HTTP_PORT}` tidak terbuka ke internet.
- [ ] Database berisi data referensi dan minimal satu akun Admin yang disiapkan melalui prosedur aman.
- [ ] Login, pergantian password, role, dashboard, dan endpoint baca telah diuji.
- [ ] Scheduler berjalan setiap menit dan log-nya dipantau.
- [ ] Prosedur restore sudah diuji di staging.

## 12. Troubleshooting singkat

### Compose menolak dijalankan karena variabel wajib kosong

Isi `APP_KEY`, `APP_URL`, `FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS`, `DB_PASSWORD`, dan `MYSQL_ROOT_PASSWORD`, lalu jalankan kembali `docker compose ... config --quiet`.

### Volume database tidak ditemukan

```bash
docker volume create tebuireng_mysql_data
```

### `/ready` mengembalikan HTTP 503

Periksa MySQL, migrasi, dan log backend:

```bash
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --tail=200 mysql backend
docker compose --env-file .env.production -f compose.production.yaml \
  exec -T backend php artisan migrate:status
```

### Login gagal setelah HTTPS aktif

Pastikan ketiga URL/domain pada `.env.production` konsisten, browser benar-benar memakai HTTPS, cookie tidak diblokir, dan request `/sanctum/csrf-cookie` serta `/api/login` melewati domain yang sama. Setelah perubahan environment, recreate container:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  up -d --force-recreate backend backend-web frontend
```

### Disk hampir penuh

Cari sumber pemakaian terlebih dahulu dengan `df -h`, `docker system df`, dan ukuran direktori backup. Jangan menjalankan `docker system prune --volumes`; opsi tersebut dapat menghapus volume data yang tidak sedang terpasang. Hapus hanya image/build cache yang targetnya telah diperiksa dan backup yang sudah dipastikan tersalin ke media lain.
