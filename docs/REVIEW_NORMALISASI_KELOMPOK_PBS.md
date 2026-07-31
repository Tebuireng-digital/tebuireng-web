# Review Normalisasi Nama Kelompok PBS

Status: **diterapkan pada database lokal setelah persetujuan.**

## Tujuan

Menjadikan kode kelompok PBS mudah dibaca dan konsisten di Dashboard tanpa mengubah `kelompok_pbs_id`, anggota santri, penugasan Ustadz, atau riwayat absensi.

Konvensi yang disetujui:

```text
A 1, A 12, A 21
B 1, B 21
C 1, C 10
```

Tidak memakai prefiks `Kelompok` / `KEL.` atau tanda hubung. Huruf seri dan nomor dipisahkan satu spasi.

## Sumber dan temuan audit

Sumber kelompok PBS adalah sheet **Rekap Kelompok** dari workbook berikut:

`xlsx/Database_Kelompok_AlQuran (belajar habis subuh)_2026_2027.xlsx`

Ada 126 record pada tabel `kelompok_pbs`:

| Kategori | Jumlah record | Perlakuan pada tahap ini |
|---|---:|---|
| KELOMPOK A | 49 | Normalisasi otomatis aman |
| KELOMPOK B | 32 | Normalisasi otomatis aman |
| KELOMPOK C | 11 | Normalisasi otomatis aman |
| PASCA WISUDA | 18 | Tidak diubah pada tahap ini |
| PASCA WISUDA MA | 15 | Tidak diubah pada tahap ini |
| kosong | 1 | Kandidat data rekap yang harus ditangani terpisah |

## Preview perubahan yang aman

Total nama yang telah dinormalisasi: **92 kelompok**.

| ID kelompok | Kategori | Pola nama saat ini | Nama setelah normalisasi | Jumlah |
|---|---|---|---|---:|
| 34–82 | KELOMPOK A | `A 1` sampai `A 49` | tetap `A 1` sampai `A 49` | 49 |
| 83–114 | KELOMPOK B | `KEL. B 1` sampai `KEL. B 32` | `B 1` sampai `B 32` | 32 |
| 115–125 | KELOMPOK C | `KEL. C 1` sampai `KEL. C 11` | `C 1` sampai `C 11` | 11 |

Contoh perubahan:

| ID | Sebelum | Sesudah |
|---:|---|---|
| 34 | `A 1` | `A 1` |
| 37 | `A 12` | `A 12` |
| 96 | `KEL. B 21` | `B 21` |
| 115 | `KEL. C 1` | `C 1` |
| 116 | `KEL. C 10` | `C 10` |

## Data yang tidak akan diubah pada tahap normalisasi kode

Kelompok berikut tetap memakai nama sumber sampai ada keputusan penamaan khusus:

- Bandongan Unit MTS/SMA/SMP/MA;
- Tahfidz 1–9;
- Tahsin 1–18;
- Sorogan.

Artinya tahap ini hanya menghapus ketidakkonsistenan format seri A, B, dan C. Tidak ada kelompok yang digabung, dihapus, atau dipindahkan.

## Record anomali `TOTAL`

| ID | Kategori | Nama | Santri terkait | Asal workbook |
|---:|---|---|---:|---|
| 126 | kosong | `TOTAL` | 0 | Sheet `Rekap Kelompok`, baris 127: `TOTAL | 1720` |

Ini adalah baris rekap jumlah santri, bukan kelompok pengajian. Importer saat ini membaca baris tersebut sebagai kelompok karena hanya melewati baris yang kolom namanya kosong.

Record ID 126 telah dihapus setelah persetujuan. Penghapusan aman karena audit menunjukkan tidak ada santri maupun penugasan Ustadz yang merujuknya.

## Jaminan implementasi nanti

Saat perubahan diterapkan:

1. Update dilakukan berdasarkan `kelompok_pbs_id`, bukan pencocokan nama.
2. Tidak ada perubahan pada `santri.kelompok_pbs_id`.
3. Tidak ada perubahan pada `petugas_penugasan.target_id`.
4. Tidak ada perubahan pada tabel `absensi` atau riwayat log.
5. Sebelum dan sesudah update, jumlah anggota pada tiap kelompok A/B/C diverifikasi tetap sama.

## Hasil dan tindak lanjut

1. Semua 92 nama seri A/B/C telah dinormalisasi sesuai preview.
2. Record rekap `TOTAL` (ID 126) telah dihapus.
3. Importer kini melewati baris `TOTAL` dan menormalisasi lookup PBS, sehingga impor ulang tidak mengembalikan format lama atau melepaskan relasi roster.
4. Dashboard kini mengurutkan kode PBS secara natural, misalnya `A 1`, `A 2`, …, `A 10`.
5. Format nama Bandongan tetap menunggu diskusi terpisah bila ingin dibuat lebih ringkas.
