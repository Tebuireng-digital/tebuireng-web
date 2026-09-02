# Update Deploy Server

Perubahan pada update ini:

- Memperbaiki mismatch API key di `WaBotController` agar panel admin WA memakai key yang sama dengan service pengirim WA.
- Menghapus emoji dari UI frontend dan dari template pesan WhatsApp.
- Menambahkan regression test untuk route admin WA.
- Menghentikan tracking file sesi lokal `wa-gateway/sessions/*` lewat `.gitignore`.
- Memperbarui `deploy-systemd.sh` agar service `wa-gateway` ikut dibangun, dijalankan, dan dipantau log-nya saat deploy.

## Catatan penting sebelum deploy

- Jangan jalankan `docker compose down -v`.
- Production memakai named volume `wa_session_data`, jadi sesi WA seharusnya tetap aman selama volume tidak dihapus.
- Jika server production selama ini belum pernah menjalankan `wa-gateway`, setelah deploy status WA bisa menjadi `connecting` atau `disconnected` sampai admin scan QR dari menu `Data Master > Pengaturan Bot WA`.

## Langkah deploy yang disarankan

Jalankan dari root repository di server:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose --env-file .env.production -f compose.production.yaml config --quiet
sudo ./deploy-systemd.sh deploy
```

## Verifikasi setelah deploy

Pastikan semua service hidup:

```bash
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --tail=200 backend frontend wa-gateway
curl --fail --show-error http://127.0.0.1:3000/status
curl --fail --show-error http://127.0.0.1:8080/ready
```

Target hasil:

- `frontend`, `backend`, `backend-web`, `mysql`, dan `wa-gateway` berstatus `Up`.
- `http://127.0.0.1:8080/ready` mengembalikan `{"status":"ready"}`.
- `http://127.0.0.1:3000/status` mengembalikan JSON dengan `status: "ok"`.

## Jika WA masih offline setelah deploy

1. Periksa log:

```bash
docker compose --env-file .env.production -f compose.production.yaml logs --tail=200 wa-gateway
```

2. Jika log menunjukkan sesi tidak valid atau bot belum tertaut, buka dashboard admin:

- Masuk ke `Data Master`
- Buka `Pengaturan Bot WA`
- Klik `Refresh Status`
- Scan QR dengan nomor WhatsApp resmi yang akan menjadi sender

3. Jika perlu restart service WA saja:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build wa-gateway
```

## Verifikasi lokal yang sudah lulus

```bash
docker compose exec -T frontend npm run build
docker compose run --rm test php artisan test --filter=WaBotControllerTest
docker compose run --rm test php artisan test --filter=WhatsAppNotificationTest
```
