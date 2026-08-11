# Update 1.1.3

Tanggal: 9 Agustus 2026

## Pembersihan data legacy permanen

Atas persetujuan pengguna, data santri legacy yang tidak memiliki `no_id_induk` telah dihapus permanen dari database Docker lokal.

## Data yang dihapus

- 489 profil santri legacy.
- 32 catatan absensi yang merujuk ke profil legacy tersebut.
- 3 catatan perizinan yang merujuk ke profil legacy tersebut.

Tidak ada pelanggaran, persetujuan perizinan, koreksi gerbang, keluarga, pendidikan, atau partisipasi kegiatan yang merujuk pada target penghapusan.

## Hasil verifikasi

- Total santri: 4.889.
- Total santri dengan No. ID: 4.889.
- Santri tanpa No. ID: 0.
- Total kelas formal: 240.

Penghapusan ini permanen dan tidak dibuatkan backup otomatis.
