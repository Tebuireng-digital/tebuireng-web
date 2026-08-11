# Update 1.3.0

Tanggal: 10 Agustus 2026

## Fitur Baru: Review Kemiripan Data Santri (Verifikasi Data)

Sistem kini memiliki modul peninjauan kemiripan data santri otomatis di bawah menu **Verifikasi Data → Review Kemiripan Data**.

- **Matching Engine Hibrida**: Menyeleksi calon santri berdasarkan kesamaan Nama, No. ID Induk, NIK, dan tanggal lahir.
- **Penyaringan Data Kosong**: Hanya menampilkan profil yang memiliki kandidat pasangan nyata dengan skor kemiripan valid.
- **UI/UX Refactor Peninjauan**:
  - Format skor kemiripan ditampilkan sebagai persentase bersih (mis. `95%`).
  - Pemisahan aksi menjadi dua tombol independen: `[ Gabungkan ]` (membuka modal konfirmasi detail) dan `[ Terpisah ]` (menandai profil terpisah secara langsung).
  - Penambahan kontrol pagination maksimal 10 data per halaman.
