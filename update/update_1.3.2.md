# Update 1.3.2

Tanggal: 10 Agustus 2026

## Roster Absensi 11 Unit & Pembersihan Kelas Dummy

Pembaruan struktur Roster Absensi Kelas Formal dan pembersihan data legacy.

- **Pengelompokan Berdasarkan Unit Pendidikan**: Accordion Roster Absensi Kelas Formal kini dikelompokkan secara dinamis berdasarkan 11 Unit Pendidikan (MA, MAS, MTS, MTSS, MU, SMA, SMAT, SMK, SMP, SMPT, THS).
- **Pengurutan Natural Kelas**: Kartu-kartu kelas di dalam setiap unit diurutkan secara alphanumerik natural (`1A`, `1B`, `2A`, `7A`, `10 IPA 1`, dsb.).
- **Pembersihan 74 Kelas Formal Dummy**: Menjalankan migrasi database `2026_08_10_000004_cleanup_empty_legacy_kelas_formal.php` untuk menghapus 74 kelas formal kosong (0 santri) sisa seeder lama.
- **Auto-Assignment Kelas Formal**: Menjalankan migrasi database `2026_08_09_000003_assign_all_formal_classes_to_demo_wali_kelas.php` untuk menghubungkan seluruh 166 kelas aktif ke akun Wali Kelas demo.
