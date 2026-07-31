# PRD: Sistem Pendataan Pesantren Putra (Absensi, Pelanggaran, Perizinan)

Versi ini menurunkan PRD produk yang sudah ada menjadi PRD teknis: setiap kebutuhan fungsional dipetakan ke tabel di `skema_database_absensi_santri.sql`, ke endpoint API, dan ke tanggung jawab frontend/backend. Tujuannya supaya tim engineering bisa langsung memecah jadi task tanpa menerka struktur data.

## 1. Ringkasan

Menggantikan pencatatan manual dengan sistem digital yang dipakai pembina masing-masing kegiatan dari browser HP dan dipantau Pengasuh/Keamanan. Lima roster absensi adalah Kelas Formal 7/8/9, Kamar, Kelompok Al-Qur'an Subuh, Kelas Madin, dan Takhasus Maghrib. Modul Pelanggaran dan Perizinan terhubung dengan absensi: izin yang dibuat sekaligus disetujui Keamanan otomatis menandai santri sebagai `Izin` pada kelima kegiatan selama rentang izinnya. Santri tidak memiliki akun dan tidak melakukan input karena santri tidak memegang HP.

## 2. Stack Teknis & Alasan Pemilihan

| Layer | Teknologi | Alasan |
| --- | --- | --- |
| Frontend | React (Vite) + TypeScript, dikemas sebagai PWA | Input dilakukan dari browser HP musyrif di lapangan (NFR: bukan native app), butuh bulk-action UI yang responsif, dan butuh mode offline-first — PWA + service worker mendukung ini tanpa perlu app store. |
| State & offline queue | TanStack Query untuk data server + IndexedDB (Dexie.js) untuk antrean mutasi offline | Saat sinyal lemah di asrama, input absensi tetap tersimpan lokal lalu disinkronkan begitu online. |
| Backend | Laravel 12 (REST API), PHP 8.3+ | Auth berjenjang (Sanctum + role/policy), job terjadwal (deteksi overdue izin, notifikasi ambang poin), audit log, dan validasi bisnis lintas modul (izin → auto-absen) lebih rapi ditangani di backend terpusat daripada di klien. |
| Auth | Laravel Sanctum (token berbasis SPA) | Cocok untuk SPA React yang dipanggil dari domain sendiri, ringan dibanding OAuth penuh. |
| Database | MySQL 8.0 (skema terlampir) | Sesuai skema yang sudah disusun dari data existing (kamar, kelas, kelompok diniyah/qur'an/takhassus). |
| Queue & scheduler | Laravel Queue (database atau Redis driver) + Task Scheduling (`routes/console.php`) | Menjalankan job "cek izin overdue", "cek ambang poin pelanggaran", dan reminder H-10 menit sebelum jadwal absensi. |
| Realtime (opsional fase 1) | Laravel Reverb / broadcasting event | Dashboard pengasuh bisa live-update saat ada input absensi/izin baru, tanpa polling agresif yang boros baterai/koneksi. |
| Penyimpanan bukti foto | Laravel filesystem (local/S3-compatible) | Untuk lampiran foto pelanggaran (opsional sesuai PRD produk). |
| Ekspor laporan | Laravel Excel (`maatwebsite/excel`) + `barryvdh/laravel-dompdf` | Kebutuhan ekspor Excel/PDF di bagian Dashboard & Laporan. |

## 3. Peran & Hak Akses

Dipetakan ke `petugas.jabatan` (ENUM: `Pengasuh`, `Ustadz`, `Pembina Kamar`, `Wali Kelas`, `Keamanan`, `Admin`):

| Peran produk | `jabatan` di DB | Akses utama |
| --- | --- | --- |
| Admin/Superadmin | `Admin` | CRUD data master (santri, kamar, kelas, kelompok, pengguna), kelola master jenis pelanggaran & jenis izin, override edit absensi kapan saja |
| Musyrif Kamar | `Pembina Kamar` | Input absensi Kamar untuk kamar yang diampu |
| Guru/Wali Kelas | `Wali Kelas` | Input absensi Sekolah untuk kelas yang diampu |
| Pembina Al-Qur'an / Takhasus | `Ustadz` (dibedakan lewat penugasan) | Input absensi kelompok Al-Qur'an Subuh/Takhasus Maghrib yang diampu |
| Pembina Madin | `Ustadz` | Input absensi kelas Madin yang diampu |
| Keamanan | `Keamanan` | Membuat sekaligus menyetujui izin, mencatat keluar/masuk gerbang aktual, dan mencatat pelanggaran |
| Pengasuh/Pimpinan | `Pengasuh` | Dashboard & laporan rekap semua modul, terima notifikasi ambang poin & overdue |
| Santri/Wali Santri | — | **Di luar cakupan MVP.** Santri tidak login; data wali hanya disimpan sebagai kontak. Jika portal wali dibuat kelak, gunakan akun wali tersendiri, bukan akun santri. |

Setiap request ke API divalidasi lewat Laravel Policy: petugas hanya boleh mengubah data absensi/pelanggaran/izin untuk kamar/kelas/kelompok yang jadi tanggung jawabnya (lihat gap skema §9.1), kecuali `Admin`.

## 4. Modul Absensi (5 kegiatan) → Skema & API

Kelima modul memakai UI dan aturan input yang sama. Kode internal lama (`SEKOLAH`, `KAMAR`, `PBS`, `DINIYAH`, `PBM`) tetap dapat dipakai, tetapi nama yang tampil kepada pengguna harus mengikuti istilah operasional berikut.

| Modul | Jadwal | Sumber daftar santri | Endpoint utama |
| --- | --- | --- | --- |
| Kelas Formal 7/8/9 | 07:00–07:30 | `Database_Siswa_Kelas_7_8_9_2026_2027.xlsx` | `POST /api/absensi/sekolah/bulk` |
| Kamar | 20:00–20:30 | `Database_Santri_Kamar_MTS_SMP_SMA_SMK.xlsx` | `POST /api/absensi/kamar/bulk` |
| Kelompok Al-Qur'an Subuh | 05:00–06:00 | `Database_Kelompok_AlQuran (belajar habis subuh)_2026_2027.xlsx` | `POST /api/absensi/pbs/bulk` |
| Kelas Madin | 15:30–16:00 | `Database_Kelas_Madin_2026_2027.xlsx` | `POST /api/absensi/diniyah/bulk` |
| Takhasus Maghrib | 18:30–19:30 | `Database_Takhassus (belajar habis maghrib)_2026_2027.xlsx` | `POST /api/absensi/pbm/bulk` |

**Kebutuhan fungsional → implementasi:**

- **Bulk input satu layar** — endpoint `bulk` menerima array `{santri_id, status, keterangan?}` dan melakukan upsert ke `absensi` menggunakan constraint unik `(santri_id, jenis_kegiatan_id, jadwal_id, tanggal)`, sehingga aman dipanggil ulang (idempotent) saat retry sinkronisasi offline.
- **Timestamp & deteksi keterlambatan input** — `absensi.waktu_input` diisi otomatis oleh server saat baris pertama kali dibuat. Backend membandingkan `waktu_input` dengan `jadwal_kegiatan.jam_selesai` + toleransi untuk menandai "input terlambat" — ini bukan kolom baru, melainkan properti terhitung yang dikirim balik ke UI dan dipakai untuk laporan kedisiplinan petugas.
- **Status "Terlambat" santri** (bukan input terlambat) — memakai `absensi.status = 'Terlambat'` + `absensi.menit_terlambat`, relevan terutama untuk Kamar/PBS yang berbasis jamaah (mengikuti pola sheet `TERLAMBAT` di data existing).
- **Notifikasi pengingat H-10 menit** — job terjadwal Laravel yang jalan tiap menit, mengecek `jadwal_kegiatan` yang akan mulai 10 menit lagi dan mengirim notifikasi (channel `database`, dan `broadcast` bila real-time diaktifkan) ke petugas yang bertanggung jawab.
- **Edit dibatasi rentang waktu** — Policy di backend menolak `PATCH` ke baris `absensi` jika `now() - waktu_input > 60 menit`, kecuali requester adalah `Admin`. Setiap perubahan tercatat di `log_aktivitas`.
- **Auto-tandai "Izin"** — setelah Keamanan membuat izin, status langsung `Disetujui` dan event `PerizinanDisetujui` meng-upsert absensi `Izin` pada kelima kegiatan untuk setiap tanggal dalam rentang izin.
- **Rekap harian dengan filter** — `GET /api/absensi?jenis=&tanggal=&kamar_id=&kelas_id=&status=` memakai view `v_rekap_absensi_harian` sebagai basis query.

## 5. Modul Pelanggaran → Skema & API

- `POST /api/pelanggaran` menyimpan ke tabel `pelanggaran`, merujuk `kategori_pelanggaran` (berisi `tingkat` dan `poin`) yang dikelola Admin lewat `/api/master/kategori-pelanggaran`.
- **Bukti foto (opsional)** — **gap skema**, lihat §9.2 (`lampiran_pelanggaran`).
- **Akumulasi poin otomatis** — dihitung on-the-fly lewat query agregat (`SUM(kategori_pelanggaran.poin) GROUP BY santri_id`), di-cache per santri (Laravel cache, invalidasi saat ada pelanggaran baru) daripada disimpan sebagai kolom fisik, supaya selalu konsisten dengan histori.
- **Notifikasi ambang batas poin** — job dipicu setiap kali `pelanggaran` baru disimpan: jika akumulasi poin santri melewati ambang (nilai ambang dikonfigurasi Admin, lihat §9.2 `pengaturan_sistem`), kirim notifikasi ke `Pengasuh`.
- **Filter laporan** — `GET /api/pelanggaran?santri_id=&kamar_id=&kelas_id=&kategori_id=&dari=&sampai=`.

## 6. Modul Perizinan oleh Keamanan → Skema & API

- `POST /api/perizinan` hanya dapat dipanggil Keamanan atau Admin. Keamanan memilih santri, jenis izin, keperluan, waktu mulai, dan rencana kembali. Izin langsung berstatus `Disetujui`; tidak ada approval berjenjang pada MVP.
- Sistem menolak rentang izin baru yang bertabrakan dengan izin aktif santri yang sama.
- Setelah izin tersimpan, sistem otomatis membuat/memperbarui absensi `Izin` pada lima kegiatan.
- **Catat keluar/masuk aktual** — `PATCH /api/perizinan/{id}/gerbang` (khusus role `Keamanan`) mengisi `waktu_keluar_aktual` / `waktu_masuk_aktual` dan `dicatat_keamanan_oleh`; saat `waktu_masuk_aktual` terisi, `status` → `Selesai`.
- **Deteksi overdue** — job terjadwal harian mencari `perizinan` dengan `status = 'Sedang Berjalan'` dan `rencana_kembali < now()` tanpa `waktu_masuk_aktual`, lalu mengirim notifikasi ke `Admin` (sesuai PRD produk — bukan ke Keamanan, agar eskalasi jelas).
- **Riwayat per santri** — `GET /api/santri/{id}/perizinan` menampilkan riwayat izin tanpa progres approval.

## 7. Kebutuhan Non-Fungsional → Implikasi Desain Sistem

| Kebutuhan | Implikasi teknis |
| --- | --- |
| Web-based, browser HP | React PWA, target Chrome/Safari mobile, hindari fitur yang butuh native (kamera pakai `<input type="file" capture>`, bukan native camera API). |
| Offline-first / koneksi lemah | Mutasi absensi ditulis ke IndexedDB per akun petugas dengan status `pending`, lalu disinkron saat online; UI menampilkan status sinkronisasi. Perizinan memerlukan koneksi karena langsung memengaruhi gerbang dan lima roster absensi. |
| Bulk input ≤ 2 menit untuk 20–40 santri | Satu request `bulk` per sesi (bukan 1 request per santri), UI checkbox/segmented-control per baris tanpa reload halaman. |
| Kontrol akses per unit tanggung jawab | Laravel Policy per resource, lihat gap skema §9.1. |
| Audit trail | Semua `INSERT`/`UPDATE`/`DELETE` pada tabel sensitif (`absensi`, `pelanggaran`, `perizinan`, `perizinan_approval`) dicatat lewat model observer ke `log_aktivitas`. |
| Skalabel ke unit putri | Skema sudah generik (tidak ada kolom "putra" hardcode di tabel inti); pemisahan putra/putri cukup lewat data `unit_pendidikan`/`kamar` terpisah, bukan skema terpisah. |

## 8. Dashboard & Laporan

- `GET /api/dashboard/ringkasan-harian` — persentase kehadiran per modul hari ini, jumlah pelanggaran hari ini, jumlah santri sedang izin (dari `v_santri_sedang_izin`).
- `GET /api/laporan/kehadiran?santri_id=&periode=` — rekap per santri lintas 5 modul.
- `GET /api/laporan/pelanggaran?...` dan `GET /api/laporan/perizinan?...` — sesuai filter di §5/§6.
- `GET /api/laporan/bulanan?bulan=&tahun=&kamar_id=|kelas_id=` — rekap gabungan (kehadiran 5 modul + pelanggaran + perizinan) untuk evaluasi bulanan pengasuhan.
- Ekspor: setiap endpoint laporan punya varian `?format=xlsx` / `?format=pdf` yang menghasilkan file lewat `maatwebsite/excel` / `dompdf`, diunduh via signed URL sementara (bukan disimpan permanen di server).

## 9. Keputusan Produk yang Sudah Dikonfirmasi

1. Setiap kegiatan memiliki pelaksana berbeda dan hak input dibatasi oleh jabatan serta penugasan kelompok.
2. Kelompok Al-Qur'an Subuh dan Takhasus Maghrib mengikuti roster Excel masing-masing, bukan kamar atau kelas formal.
3. Izin dibuat sekaligus disetujui Keamanan, tanpa approval berjenjang.
4. Santri tidak memiliki akun dan tidak melakukan input.
5. Satu petugas dapat menerima lebih dari satu penugasan selama jabatan sesuai jenis kegiatan.

## 10. Di Luar Cakupan Fase 1

Sama seperti dokumen produk asli: portal/aplikasi wali santri, integrasi pembayaran SPP, modul akademik/nilai. Ditambah dari sisi teknis: integrasi WhatsApp/SMS gateway, fingerprint/RFID/QR, dan realtime broadcasting (Reverb) bisa ditunda ke fase berikutnya jika timeline ketat — polling interval wajar (mis. 30 detik) di dashboard cukup untuk fase 1.

## 11. Pertanyaan Terbuka

Dibawa dari dokumen produk, plus tambahan teknis:

- Skema poin pelanggaran → sanksi (SP1/SP2) otomatis atau manual di fase 1?
- **[Teknis]** Volume data foto bukti pelanggaran — cukup local storage atau perlu object storage (S3-compatible) sejak awal?

## 12. Metrik Keberhasilan

Sama seperti dokumen produk: 100% kegiatan absensi terinput tepat waktu dalam 30 hari setelah peluncuran, waktu rekap laporan bulanan berkurang signifikan, seluruh data pelanggaran & perizinan tercatat di sistem tanpa pencatatan paralel di buku manual.
