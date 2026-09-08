# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SIMANTEB dipakai oleh Admin, Keamanan, Pembina Kamar, Wali Kelas, Piket Pengajian,
dan Wali Santri. Petugas bekerja dari HP atau desktop sesuai penugasan aktif;
Wali Santri memakai portal read-only untuk memantau data anak.

## Product Purpose

SIMANTEB menggantikan pencatatan manual absensi, perizinan, gerbang,
pelanggaran, prestasi, raport pengajian, dan raport pembinaan untuk operasional
santri putra Tebuireng.

## Operating Context

Input absensi berlangsung pada sesi pagi, siang, sore, dan malam dengan koneksi
server sebagai sumber status tersimpan. Data awal berasal dari workbook
canonical di `data/`; kandidat ambigu harus masuk antrean verifikasi sebelum
menjadi transaksi.

## Capabilities and Constraints

- Rilis awal hanya mencakup data santri putra.
- Enam modul absensi resmi: Kelas Formal, Keberangkatan Kelas, Kamar, PBS, PBM,
  dan Madin.
- Akses operasional mengikuti role dan assignment aktif.
- Absensi tidak offline-first; data baru dianggap tersimpan setelah server
  mengonfirmasi keberhasilan.
- Raport yang diterbitkan menjadi snapshot versi yang tidak menimpa histori.

## Brand Commitments

Nama produk adalah SIMANTEB. UI menggunakan istilah `Piket Pengajian` dan
`Raport Pembinaan`; `ubudiyah` hanya dipakai sebagai namespace teknis.

## Evidence on Hand

- `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`
- `data/Database_Pelanggaran_Santri_Tebuireng.xlsx`
- `data/data_rekam_santri.xlsx`
- `data/data_alumni.xlsx`
- `new version/prd.md`
- `new version/roles.md`
- `new version/SEEDER.md`

## Product Principles

- Scope dan akses harus mengikuti penugasan aktif.
- Data ambigu tidak boleh berubah menjadi transaksi tanpa keputusan Admin.
- Konteks sesi, roster, periode, dan status harus tetap terlihat saat bekerja.
- Setiap aksi bulk harus menjelaskan hasil, kegagalan, dan langkah berikutnya.
