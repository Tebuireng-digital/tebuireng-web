# Update 1.1.1

Tanggal: 9 Agustus 2026

## Penerapan migrasi lokal

Dua migrasi data santri telah diterapkan pada database Docker lokal proyek:

- `2026_08_09_000001_expand_santri_profile_and_verification`
- `2026_08_09_000002_add_source_units_and_kegiatan_participation`

## Hasil verifikasi

- Tersedia 11 unit formal: `MA`, `MAS`, `MTS`, `MTSS`, `MU`, `SMA`, `SMAT`, `SMK`, `SMP`, `SMPT`, dan `THS`.
- Master organisasi daerah berisi 15 ORDA.

## Catatan

Import `data_santri_semua` belum dijalankan. Data santri aktif, absensi, dan rapor yang ada belum diubah oleh penerapan migrasi ini.
