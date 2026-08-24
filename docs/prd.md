# PRD Teknis: Sistem Pendataan Pesantren Putra Tebuireng (Versi 1.3.4)

Dokumen PRD Teknis ini diselaraskan dengan arsitektur dan status implementasi sistem terbaru per **Agustus 2026 (v1.3.4)**. Setiap kebutuhan fungsional dipetakan ke skema database, API endpoint, dan hak akses frontend/backend.

---

## 1. Ringkasan Sistem

Sistem Pendataan Pesantren Tebuireng menggantikan pencatatan manual dengan platform digital terintegrasi yang digunakan oleh pembina/ustadz via browser HP/aplikasi mobile Android (Capacitor) dan dipantau oleh Pengasuh/Admin.

Sistem ini mengelola empat modul operasional utama:
1. **Modul Presensi (5 Roster Kegiatan)**: Kelas Formal, Kamar, Kelompok Al-Qur'an Subuh, Kelas Madin, dan Takhasus Maghrib.
2. **Modul Perizinan & Gerbang**: Pencatatan keluar/masuk santri oleh Keamanan. Izin aktif otomatis menandai status `Izin` di kelima kegiatan presensi.
3. **Modul Pelanggaran**: Pencatatan kedisiplinan dan akumulasi poin santri.
4. **Modul Prestasi (Mandiri / Standalone)**: Pencatatan rekam prestasi, peringkat, dan penghargaan santri yang terpisah dari modul pelanggaran (Update v1.3.4).

Santri dan wali santri tidak memegang akun login petugas. Informasi santri dipublikasikan secara terbatas dan read-only melalui **Santri Portal**.

---

## 2. Stack Teknis Terkini

| Layer | Teknologi | Implementasi & Catatan Operasional |
| --- | --- | --- |
| **Frontend** | React (Vite) + TypeScript + Tailwind CSS | Single Page Application (SPA) responsif mobile-first, dioptimalkan untuk pengisian cepat di HP musyrif/ustadz. |
| **Mobile Packaging** | Capacitor (Android) + PWA | Dibangun untuk browser HP dan dapat dikemas sebagai APK Android native via Capacitor. |
| **State & Offline Queue** | TanStack Query + IndexedDB (Dexie.js) | Presensi mendukung offline-first: data tersimpan di IndexedDB lokal saat sinyal lemah dan otomatis disinkronkan saat online. |
| **Backend** | Laravel 11/12 (PHP 8.3+) REST API | Auth Sanctum, Policy Otorisasi per unit, job scheduler (overdue izin, ambang poin), audit log, dan ekspor data. |
| **Auth** | Laravel Sanctum (SPA Token) | Token otentikasi SPA dengan proteksi masa berlaku dan wajib ganti password pada login pertama. |
| **Database** | MySQL 8.0 / SQLite (Test) | Database utama MySQL 8.0 dengan Docker Volume terisolasi (`tebuireng_mysql_data`). |
| **Queue & Scheduler** | Laravel Queue + Task Scheduler | Cron job untuk pengecekan overdue perizinan harian dan notifikasi pengingat presensi H-10 menit. |
| **Ekspor Engine** | Laravel Excel (`maatwebsite/excel`) & DomPDF | Ekspor data terpusat (Khusus Admin) tanpa grafik/cover page gambar pada format Excel (.xlsx). |

---

## 3. Peran & Hak Akses (Role Matrix)

Dipetakan ke enum `petugas.jabatan` di database:

| Peran Produk | `jabatan` di DB | Hak Akses Utama |
| --- | --- | --- |
| **Admin / Superadmin** | `Admin` | Full Access: CRUD Data Master, Override Presensi, Kelola Pengguna, dan **Akses Eksklusif Ekspor Laporan** (`/laporan/detail`). |
| **Pembina Kamar** | `Pembina Kamar` | Input presensi Kamar untuk kamar yang diampu. |
| **Wali Kelas** | `Wali Kelas` | Input presensi Kelas Formal (7/8/9) untuk kelas yang diampu. |
| **Ustadz** | `Ustadz` | Input presensi Kelompok Al-Qur'an Subuh, Kelas Madin, atau Takhasus Maghrib sesuai penugasan. |
| **Keamanan** | `Keamanan` | Membuat perizinan, mencatat jam keluar/masuk gerbang aktual, dan mencatat pelanggaran santri. |
| **Pengasuh / Pimpinan** | `Pengasuh` | Dashboard rekapitulasi harian, pemantauan statistik, dan menerima notifikasi ambang poin/overdue. |
| **Santri / Wali Santri** | — | Read-only melalui **Santri Portal** (`/portal-santri`). Pencarian data profil & riwayat santri tanpa akun petugas. |

---

## 4. Modul Presensi (5 Roster Kegiatan)

### 4.1. Pemetaan 5 Modul Kegiatan

| Modul Kegiatan | Kode Intern | Jadwal Standard | Sumber Roster Excel | Endpoint Principal |
| --- | --- | --- | --- | --- |
| **Kelas Formal 7/8/9** | `SEKOLAH` | 07:00–07:30 | `Database_Siswa_Kelas_7_8_9_2026_2027.xlsx` | `POST /api/absensi/sekolah/bulk` |
| **Kamar** | `KAMAR` | 20:00–20:30 | `Database_Santri_Kamar_MTS_SMP_SMA_SMK.xlsx` | `POST /api/absensi/kamar/bulk` |
| **Kelompok Al-Qur'an Subuh** | `PBS` | 05:00–06:00 | `Database_Kelompok_AlQuran (belajar habis subuh)_2026_2027.xlsx` | `POST /api/absensi/pbs/bulk` |
| **Kelas Madin** | `DINIYAH` | 15:30–16:00 | `Database_Kelas_Madin_2026_2027.xlsx` | `POST /api/absensi/diniyah/bulk` |
| **Takhasus Maghrib** | `PBM` | 18:30–19:30 | `Database_Takhassus (belajar habis maghrib)_2026_2027.xlsx` | `POST /api/absensi/pbm/bulk` |

### 4.2. Ketentuan Fungsional Presensi
- **Bulk Input (Satu Layar Ledger)**: Endpoint bulk menerima array santri dan melakukan *upsert* unik `(santri_id, jenis_kegiatan_id, jadwal_id, tanggal)` secara idempotent.
- **Status Presensi**: `Hadir`, `Izin`, `Sakit`, `Alpha`, `Terlambat` (disertai parameter `menit_terlambat`).
- **Auto-Sync Status Izin**: Izin aktif yang diterbitkan Keamanan otomatis mengisi status `Izin` di kelima kegiatan selama rentang tanggal berlaku.
- **Batas Edit Presensi**: Petugas biasa hanya dapat mengedit presensi max 60 menit setelah input. Perubahan setelahnya memerlukan hak akses `Admin`.

---

## 5. Modul Perizinan & Gerbang (Keamanan)

- **Penerbitan Izin**: Endpoint `POST /api/perizinan` (Role Keamanan/Admin). Izin yang dibuat langsung berstatus `Disetujui` (tanpa approval berjenjang).
- **Catat Gerbang**: `PATCH /api/perizinan/{id}/gerbang` mencatat `waktu_keluar_aktual` dan `waktu_masuk_aktual`.
- **Status Flow**: `Disetujui` ➔ `Sedang Berjalan` (setelah keluar gerbang) ➔ `Selesai` (setelah masuk gerbang).
- **Deteksi Overdue**: Scheduler harian otomatis menandai dan mengeskalasi perizinan yang melewati `rencana_kembali` tanpa catatan masuk gerbang.

---

## 6. Modul Pelanggaran & Akumulasi Poin

- **Input Kedisiplinan**: `POST /api/pelanggaran` mencatat jenis pelanggaran, tanggal, lokasi, dan keterangan.
- **Master Kategori Pelanggaran**: Dikelola oleh Admin (`tingkat` dan bobot `poin`).
- **Akumulasi Poin**: Total poin santri dihitung secara otomatis dan real-time dari histori pelanggaran.
- **Notifikasi Ambang Poin**: Sistem memicu peringatan ke Pengasuh jika total poin santri melampaui batas ambang yang dikonfigurasi.

---

## 7. Modul Prestasi Santri (v1.3.4 Standalone)

- **Pemisahan Modul**: Modul Prestasi memiliki menu mandiri (`/prestasi/semua`) di sidebar, terpisah sepenuhnya dari Modul Pelanggaran.
- **Fitur Pencatatan**: Mencakup jenis achievement, peringkat/penghargaan (Juara 1, Harapan, dsb.), tingkat (Kecamatan, Kabupaten, Nasional, dll.), tanggal, dan deskripsi.
- **Tampilan Mobile & Card-View**: Menggunakan layout berbasis kartu di mobile dengan hierarki visual berwarna aksen emas untuk penghargaan.
- **Endpoint API**: `GET /api/prestasi`, `POST /api/prestasi`, `PUT /api/prestasi/{id}`, `DELETE /api/prestasi/{id}`.

---

## 8. Dashboard, Laporan & Ekspor Data (Admin-Only & Clean Excel)

- **Dashboard Operational**: Menampilkan ringkasan persentase kehadiran harian 5 kegiatan, jumlah santri izin aktif, dan pelanggaran hari ini.
- **Pusat Ekspor Laporan Admin (`/laporan/detail`)**:
  - Seluruh tombol/fitur ekspor laporan (Presensi, Perizinan, Pelanggaran, Prestasi) **dibatasi secara ketat khusus untuk Role Administrator**.
  - **Clean Excel Export**: File `.xlsx` yang diunduh diproses tanpa cover page/logo grafik visual agar data langsung siap diolah.
  - **Filter Komprehensif**: Filter berdasarkan tanggal/periode, kamar, kelas, status, dan kategori.

---

## 9. Impor Data Awal & Maintenance

- **Command Artisan Impor**: `php artisan import:excel` membaca 7 workbook dari folder `xlsx/`.
- **File Kredensial Impor**: Password sementara hasil impor disimpan di `storage/app/private/credentials/akun-petugas-<timestamp>.csv` (permission `0600`).
- **Keamanan Seed**: Seed password lokal `LOCAL_SEED_PASSWORD` (default `masuk123`) hanya aktif pada environment `local`/`testing`. Environment `production` mewajibkan `FORCE_PASSWORD_CHANGE=true`.

---

## 10. Metrik Keberhasilan

1. 100% pencatatan presensi 5 kegiatan terinput secara digital dan tepat waktu.
2. Proses pencatatan perizinan gerbang real-time tanpa penumpukan fisik.
3. Seluruh ekspor rekapitulasi data laporan terpusat, aman, dan mudah diolah oleh Administrator.
4. Penggunaan interface yang konsisten dan responsif di seluruh perangkat (Mobile HP & Desktop).
