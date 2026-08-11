# Update 1.1.2

Tanggal: 9 Agustus 2026

## Import data santri

Import `new data/data_santri_semua.xls` telah dijalankan pada database Docker lokal.

## Hasil rekonsiliasi

- 4.889 No. ID dari workbook telah tersimpan.
- 4.889 data keluarga dan 4.889 data pendidikan sumber telah tersimpan.
- 24.445 keputusan partisipasi kegiatan telah dibuat untuk proses verifikasi.
- Tersedia 240 kelas formal.
- 5.202 santri memiliki kelas formal.

Total tabel `santri` menjadi 5.378 karena 489 data lama yang belum dapat dipasangkan ke No. ID sumber tetap dipertahankan untuk melindungi histori absensi, perizinan, pelanggaran, dan rapor.

## Perbaikan importer

- Memasang folder `new data` sebagai volume read-only pada container backend.
- Memperbaiki pembuatan kelas formal saat proses bersamaan.
- Memperbaiki fallback pencocokan nama: nama yang muncul lebih dari sekali di workbook tidak lagi menimpa profil santri lain.
