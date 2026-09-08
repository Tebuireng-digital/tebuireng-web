# Tebu Ireng v3

Folder ini adalah paket acuan v3 yang dipisahkan dari codebase legacy.

## Isi

- `prd.md`: kebutuhan produk dan kontrak endpoint utama.
- `specs.md`: spesifikasi teknis target.
- `roles.md`: perilaku dan kebutuhan UX setiap role.
- `desain.md`: pedoman desain dan interaksi.
- `SEEDER.md`: urutan dan aturan pengisian database.

## Data

Data di `../data/` adalah sumber seed canonical yang disepakati:

- master santri putra hasil penggabungan roster kelas, kamar, Madin, PBS, dan PBM;
- master pelanggaran dan tabel sanksi;
- data alumni;
- rekam histori pelanggaran/prestasi santri.

Sheet `REVIEW_MATCH` dari master putra menjadi antrean verifikasi Dashboard.
Kandidat yang ambigu atau belum cocok tidak boleh di-seed sebagai transaksi
sebelum dikonfirmasi Admin.

Data putri belum termasuk scope paket v3 ini.

## Icon

`../icon/` berisi icon PWA dan aset brand SIMANTEB terbaru dari
`frontend/public`.
