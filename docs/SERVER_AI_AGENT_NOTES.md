# Catatan Server untuk AI Agent

Dokumen ini menjadi checklist wajib sebelum AI agent melakukan deploy, troubleshooting, atau migrasi pada server SIMANTEB.

## Aturan keselamatan

- Jangan menjalankan `git reset --hard`, menghapus volume Docker, atau menghapus database tanpa persetujuan eksplisit.
- Jangan membaca, menampilkan, atau meng-commit `.env`, password, `APP_KEY`, cookie, token, dan data pribadi santri.
- Backup database sebelum migration, seeder, import Excel, atau perubahan konfigurasi production.
- Jangan menjalankan seeder/import berulang tanpa memastikan apakah prosesnya idempotent.
- Bedakan data master, data santri aktif, data alumni, data pelanggaran, dan data raport sebelum import.

## Konfigurasi autentikasi production

Error `401 Unauthenticated` pada menu Raport atau endpoint API berarti session Sanctum tidak terbaca. Ini berbeda dari `403`, yang berarti user sudah login tetapi tidak memiliki role yang sesuai.

Pastikan nilai production sesuai domain yang benar-benar dibuka pengguna:

```env
APP_URL=https://domain-server
FRONTEND_URL=https://domain-server
SANCTUM_STATEFUL_DOMAINS=domain-server
SESSION_DRIVER=file
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
```

Ketentuan:

- `SANCTUM_STATEFUL_DOMAINS` hanya berisi host/domain, tanpa `https://` dan tanpa trailing slash.
- Jika frontend dan backend memakai subdomain berbeda, gunakan konfigurasi domain cookie yang sesuai dan pastikan CORS mengizinkan origin frontend.
- `SESSION_SECURE_COOKIE=true` hanya digunakan melalui HTTPS.
- Reverse proxy harus meneruskan `Cookie`, `Set-Cookie`, `X-Forwarded-Proto`, dan `X-Forwarded-Host`.
- Session storage harus persisten dan dapat ditulis oleh user/container Laravel.

Setelah mengubah environment:

```bash
docker compose -f compose.production.yaml exec backend php artisan optimize:clear
docker compose -f compose.production.yaml restart backend backend-web frontend
```

Verifikasi tanpa menampilkan cookie/token:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://domain-server/ready
```

Uji dari browser setelah login:

1. `/api/me` harus merespons `200`.
2. `/api/raport-pengajian/options` harus merespons `200`.
3. Jika session expired, frontend harus mengarahkan user ke login.

## Perbaikan input pelanggaran dengan foto

Form input pelanggaran sekarang mengirim data pelanggaran dan foto dalam satu request multipart ke `POST /api/pelanggaran`.

Backend menyimpan keduanya dalam satu transaksi:

- jika data dan foto berhasil, keduanya tersimpan;
- jika foto gagal divalidasi atau disimpan, data pelanggaran dibatalkan;
- file yang sudah sempat tersimpan akan dihapus ketika transaksi gagal.

Format foto yang diterima:

- JPG/JPEG
- PNG
- WEBP
- maksimal 5 MB

Endpoint lama `POST /api/pelanggaran/{id}/lampiran` tetap dipertahankan untuk kompatibilitas data lama. Jangan menghapusnya tanpa audit client yang masih menggunakannya.

## Prosedur deploy perubahan

1. Periksa branch dan remote sebelum push.
2. Pastikan file Excel, dump database, `.env`, dan data pribadi tidak masuk commit.
3. Jalankan pemeriksaan backend:

   ```bash
   docker compose exec -T backend php -l app/Http/Controllers/PelanggaranController.php
   docker compose --profile tools run --rm test
   ```

4. Jalankan build frontend:

   ```bash
   cd frontend && npm run build
   ```

5. Deploy image atau source sesuai prosedur server.
6. Backup database sebelum migration.
7. Jalankan migration secara eksplisit:

   ```bash
   docker compose -f compose.production.yaml --profile tools run --rm migrate
   ```

8. Clear cache Laravel dan restart service.
9. Uji login, `/api/me`, menu Raport, input pelanggaran tanpa foto, dan input pelanggaran dengan foto kecil.
10. Periksa log hanya untuk status/error yang diperlukan; jangan menyalin credential atau payload pribadi ke chat.

## Checklist rollback

- Simpan commit/image yang sedang berjalan sebelum deploy.
- Simpan backup database dan lokasi backup lampiran.
- Jika Raport mendapat 401 setelah deploy, periksa environment Sanctum, cookie, reverse proxy, dan session storage sebelum menyentuh database.
- Jika input pelanggaran gagal, jangan mengulang submit secara membabi buta sebelum memastikan tidak ada record yang sudah tersimpan.
