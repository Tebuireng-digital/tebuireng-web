# Update 1.0.0

Tanggal: 9 Agustus 2026

## Ringkasan

Rilis ini menyiapkan data santri sebagai profil utama yang lebih lengkap, tanpa memutus relasi absensi, pelanggaran, perizinan, dan rapor yang tetap menggunakan `santri_id` internal.

`No. ID` dari `data_santri_semua.xls` menjadi identitas resmi santri yang ditampilkan kepada pengguna melalui kolom `no_id_induk`.

## Perubahan database

- Menambahkan profil santri: No. ID, NIK, jenis kelamin, kelahiran, nomor HP, dan domisili.
- Menambahkan tabel `santri_keluarga` untuk data KK, ayah, dan ibu.
- Menambahkan tabel `santri_pendidikan` untuk data pendidikan sumber.
- Menambahkan master `organisasi_daerah` dengan 15 ORDA awal.
- Menambahkan relasi `santri_organisasi_daerah` untuk penetapan ORDA dan riwayatnya.
- Menambahkan `organisasi_daerah_cakupan` sebagai dasar usulan ORDA dari domisili.
- Menambahkan `santri_roster_mappings` untuk verifikasi hubungan profil santri dengan roster lima kegiatan absensi.

## Perubahan aplikasi

- Menambahkan menu **Data Master → Verifikasi Santri**.
- Menampilkan antrean santri yang membutuhkan kelengkapan profil, ORDA, kelas, atau mapping kegiatan.
- Form data santri mendukung No. ID, NIK, domisili, ORDA, kelas formal, Madin, Al-Qur'an Subuh, Takhasus Maghrib, dan status verifikasi.
- Menambahkan endpoint admin untuk opsi profil dan antrean verifikasi.

## Perubahan import

- Perintah `import:santri-baru` sekarang menggunakan `new data/data_santri_semua.xls` sebagai sumber utama bila tidak diberi file lain.
- Import menyimpan data profil, keluarga, dan pendidikan.
- Import tidak menghapus absensi, pelanggaran, perizinan, maupun relasi internal `santri_id`.
- Kamar yang kosong dari sumber tidak akan menghapus kamar yang sudah tersimpan.
- Data hasil import ditandai `perlu_verifikasi` agar dapat ditinjau admin.

## Penerapan

Jalankan setelah backup database:

```bash
docker compose exec backend php artisan migrate
docker compose exec backend php artisan import:santri-baru
```

## Verifikasi

- `npm run build` berhasil.
- Backend test suite berhasil: 44 test dan 191 assertion.

## Aturan versi berikutnya

- **Major** (`2.0.0`): perubahan yang memerlukan migrasi besar atau mengubah alur/kontrak utama.
- **Minor** (`1.1.0`): fitur baru yang tetap kompatibel.
- **Patch** (`1.0.1`): perbaikan bug atau perubahan kecil yang kompatibel.
