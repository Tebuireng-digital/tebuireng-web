# Update 1.1.0

Tanggal: 9 Agustus 2026

## Ringkasan

Memperluas absensi formal agar mencakup seluruh unit pendidikan dari `Pend`, serta menambahkan keputusan keikutsertaan eksplisit untuk lima kegiatan absensi.

## Perubahan

- Menambahkan unit formal `MTSS`, `SMPT`, `SMAT`, `MAS`, `MU`, dan `THS` tanpa menggabungkannya ke unit lain.
- Importer membentuk kelas formal tahun ajaran `2026/2027` dari kombinasi `Pend + Kls` dan menghubungkan santri ke `kelas_formal_id`.
- Menghapus pembatasan target absensi formal yang sebelumnya hanya menerima SMP tingkat 7, 8, dan 9.
- Mengizinkan wali kelas ditugaskan ke kelas formal dari unit mana pun.
- Menambahkan tabel `santri_kegiatan_partisipasi` dengan status `terdaftar`, `tidak_ikut`, dan `perlu_verifikasi`.
- Form Verifikasi Santri menyediakan keputusan keikutsertaan untuk sekolah formal, kamar, Madin, Al-Qur'an Subuh, dan Takhasus Maghrib.

## Penerapan

Jalankan setelah backup database:

```bash
docker compose exec backend php artisan migrate
docker compose exec backend php artisan import:santri-baru
```

## Verifikasi

- `npm run build` berhasil.
- Backend test suite berhasil: 44 test dan 190 assertion.
