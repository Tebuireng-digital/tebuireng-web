# PRD: Sistem Pendataan Pesantren Putra (Absensi, Pelanggaran, Perizinan)

Versi ini menurunkan PRD produk yang sudah ada menjadi PRD teknis: setiap kebutuhan fungsional dipetakan ke tabel di `skema_database_absensi_santri.sql`, ke endpoint API, dan ke tanggung jawab frontend/backend. Tujuannya supaya tim engineering bisa langsung memecah jadi task tanpa menerka struktur data.

## 1. Ringkasan

Menggantikan pencatatan manual (buku absen kamar, buku absen kelas, buku keterlambatan, lembar izin kertas) dengan sistem digital yang dipakai musyrif/ustadz dari browser HP di lapangan, dan dipantau pengasuh/keamanan lewat dashboard. Lima kegiatan absensi (Kamar, Sekolah, PBS Subuh, PBM Maghrib, Diniyah) + modul Pelanggaran + modul Perizinan berjenjang dari musyrif ke keamanan, semuanya saling terhubung: santri yang izin otomatis tertandai izin di kelima modul absensi selama rentang izinnya.

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
| Musyrif PBS / PBM | `Ustadz` (dibedakan lewat penugasan, lihat §9.1) | Input absensi PBS/PBM untuk kelompok yang diampu |
| Ustadz Diniyah | `Ustadz` | Input absensi Diniyah untuk kelompok yang diampu |
| Keamanan | `Keamanan` | Approve tahap akhir izin, catat keluar/masuk gerbang aktual, catat pelanggaran |
| Pengasuh/Pimpinan | `Pengasuh` | Dashboard & laporan rekap semua modul, terima notifikasi ambang poin & overdue |
| Wali Santri | — (belum ada di skema) | **Di luar cakupan fase 1** (lihat §8). Hanya dicatat sebagai kontak (`santri.nama_wali`, `santri.no_hp_wali`), belum sebagai akun login. |

Setiap request ke API divalidasi lewat Laravel Policy: petugas hanya boleh mengubah data absensi/pelanggaran/izin untuk kamar/kelas/kelompok yang jadi tanggung jawabnya (lihat gap skema §9.1), kecuali `Admin`.

## 4. Modul Absensi (5 kegiatan) → Skema & API

Kelima modul berbagi satu tabel inti `absensi` dengan `jenis_kegiatan_id` sebagai pembeda (lihat `jenis_kegiatan`: Kamar, Sekolah, PBS, PBM, Diniyah), jadi UI-nya seragam tapi query-nya difilter per jenis.

| Modul | Jadwal | Sumber daftar santri | Endpoint utama |
| --- | --- | --- | --- |
| Absensi Kamar | 20:00–20:30 | `santri.kamar_id` | `POST /api/absensi/kamar/bulk` |
| Absensi Sekolah | 07:00–07:30 | `santri.kelas_formal_id` | `POST /api/absensi/sekolah/bulk` |
| Absensi PBS Subuh | 05:00–06:00 | kelompok PBS (lihat gap §9.1 — belum ada tabel `kelompok_pbs`) | `POST /api/absensi/pbs/bulk` |
| Absensi PBM Maghrib | 18:30–19:30 | `santri.kelas_formal_id` atau kelompok PBS (perlu dikonfirmasi ke pengasuhan) | `POST /api/absensi/pbm/bulk` |
| Absensi Diniyah | 15:30–16:00 | `santri.kelompok_diniyah_id` | `POST /api/absensi/diniyah/bulk` |

**Kebutuhan fungsional → implementasi:**

- **Bulk input satu layar** — endpoint `bulk` menerima array `{santri_id, status, keterangan?}` dan melakukan upsert ke `absensi` menggunakan constraint unik `(santri_id, jenis_kegiatan_id, jadwal_id, tanggal)`, sehingga aman dipanggil ulang (idempotent) saat retry sinkronisasi offline.
- **Timestamp & deteksi keterlambatan input** — `absensi.waktu_input` diisi otomatis oleh server saat baris pertama kali dibuat. Backend membandingkan `waktu_input` dengan `jadwal_kegiatan.jam_selesai` + toleransi untuk menandai "input terlambat" — ini bukan kolom baru, melainkan properti terhitung yang dikirim balik ke UI dan dipakai untuk laporan kedisiplinan petugas.
- **Status "Terlambat" santri** (bukan input terlambat) — memakai `absensi.status = 'Terlambat'` + `absensi.menit_terlambat`, relevan terutama untuk Kamar/PBS yang berbasis jamaah (mengikuti pola sheet `TERLAMBAT` di data existing).
- **Notifikasi pengingat H-10 menit** — job terjadwal Laravel yang jalan tiap menit, mengecek `jadwal_kegiatan` yang akan mulai 10 menit lagi dan mengirim notifikasi (channel `database`, dan `broadcast` bila real-time diaktifkan) ke petugas yang bertanggung jawab.
- **Edit dibatasi rentang waktu** — Policy di backend menolak `PATCH` ke baris `absensi` jika `now() - waktu_input > 60 menit`, kecuali requester adalah `Admin`. Setiap perubahan tercatat di `log_aktivitas`.
- **Auto-tandai "Izin"** — event listener `PerizinanDisetujui` (dipicu saat tahap approval terakhir di `perizinan_approval` = `Disetujui`) menjalankan job yang meng-upsert baris `absensi` berstatus `Izin` untuk santri tsb, di kelima jenis kegiatan, untuk setiap tanggal antara `tanggal_mulai` dan `rencana_kembali`. Jika petugas mencoba override manual, sistem menampilkan peringatan "santri ini sedang izin" (bukan block keras, karena rencana kembali bisa meleset).
- **Rekap harian dengan filter** — `GET /api/absensi?jenis=&tanggal=&kamar_id=&kelas_id=&status=` memakai view `v_rekap_absensi_harian` sebagai basis query.

## 5. Modul Pelanggaran → Skema & API

- `POST /api/pelanggaran` menyimpan ke tabel `pelanggaran`, merujuk `kategori_pelanggaran` (berisi `tingkat` dan `poin`) yang dikelola Admin lewat `/api/master/kategori-pelanggaran`.
- **Bukti foto (opsional)** — **gap skema**, lihat §9.2 (`lampiran_pelanggaran`).
- **Akumulasi poin otomatis** — dihitung on-the-fly lewat query agregat (`SUM(kategori_pelanggaran.poin) GROUP BY santri_id`), di-cache per santri (Laravel cache, invalidasi saat ada pelanggaran baru) daripada disimpan sebagai kolom fisik, supaya selalu konsisten dengan histori.
- **Notifikasi ambang batas poin** — job dipicu setiap kali `pelanggaran` baru disimpan: jika akumulasi poin santri melewati ambang (nilai ambang dikonfigurasi Admin, lihat §9.2 `pengaturan_sistem`), kirim notifikasi ke `Pengasuh`.
- **Filter laporan** — `GET /api/pelanggaran?santri_id=&kamar_id=&kelas_id=&kategori_id=&dari=&sampai=`.

## 6. Modul Perizinan (berjenjang) → Skema & API

- `POST /api/perizinan` membuat baris `perizinan` (status awal `Diajukan`) sekaligus baris-baris `perizinan_approval` sesuai alur tahap untuk `jenis_izin` terkait (default: `Pembina Kamar` → `Keamanan`).
- `PATCH /api/perizinan/{id}/approval/{tahap}` — dipanggil petugas terkait untuk mengisi `keputusan` (`Disetujui`/`Ditolak`) + `catatan`. Backend memvalidasi bahwa tahap sebelumnya sudah `Disetujui` sebelum tahap berikutnya bisa diputuskan (mencegah lompat tahap).
- Begitu tahap terakhir `Disetujui`, backend mengubah `perizinan.status` menjadi `Disetujui` (lalu `Sedang Berjalan` saat `waktu_keluar_aktual` diisi Keamanan). Jika salah satu tahap `Ditolak`, `perizinan.status` langsung `Ditolak` dan tahap sisanya ditandai gugur.
- **Catat keluar/masuk aktual** — `PATCH /api/perizinan/{id}/gerbang` (khusus role `Keamanan`) mengisi `waktu_keluar_aktual` / `waktu_masuk_aktual` dan `dicatat_keamanan_oleh`; saat `waktu_masuk_aktual` terisi, `status` → `Selesai`.
- **Deteksi overdue** — job terjadwal harian mencari `perizinan` dengan `status = 'Sedang Berjalan'` dan `rencana_kembali < now()` tanpa `waktu_masuk_aktual`, lalu mengirim notifikasi ke `Admin` (sesuai PRD produk — bukan ke Keamanan, agar eskalasi jelas).
- **Riwayat per santri** — `GET /api/santri/{id}/perizinan` memakai view `v_progres_approval_izin` untuk menampilkan progres tahap sekaligus histori.

## 7. Kebutuhan Non-Fungsional → Implikasi Desain Sistem

| Kebutuhan | Implikasi teknis |
| --- | --- |
| Web-based, browser HP | React PWA, target Chrome/Safari mobile, hindari fitur yang butuh native (kamera pakai `<input type="file" capture>`, bukan native camera API). |
| Offline-first / koneksi lemah | Service worker cache shell aplikasi; mutasi absensi & izin ditulis dulu ke IndexedDB dengan status `pending`, disinkron via background sync saat online; UI menampilkan indikator "belum tersinkron" per baris. |
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

## 9. Kesenjangan Skema (perlu keputusan sebelum implementasi)

Skema `skema_database_absensi_santri.sql` saat ini sudah menutupi struktur data existing (santri, kamar, kelas, kelompok, absensi, pelanggaran, perizinan berjenjang), tapi PRD produk menuntut beberapa hal yang belum ada tabelnya:

1. **Penugasan petugas ke unit/kamar/kelas/kelompok** — PRD produk poin 6 minta data pengguna mencatat "unit/kamar/kelas yang menjadi tanggung jawabnya". Skema saat ini hanya punya relasi 1-ke-1 (`kamar.pembina_id`, `kelas_formal.wali_kelas_id`), tidak mengakomodasi satu Ustadz mengampu banyak kelompok PBS/PBM/Diniyah sekaligus, atau rotasi petugas. **Rekomendasi**: tabel pivot baru `petugas_penugasan (petugas_id, tipe_target ENUM('Kamar','KelasFormal','KelompokDiniyah','KelompokQuran','KelompokTakhassus'), target_id)`.
2. **Kelompok PBS** — belum ada tabel setara `kelompok_diniyah`/`kelompok_quran` untuk PBS. Perlu dikonfirmasi: apakah PBS mengikuti pengelompokan kamar, kelas formal, atau kelompok sendiri (mengingat belum ada file contoh PBS saat penyusunan skema awal).
3. **Bukti foto pelanggaran** — perlu tabel `lampiran_pelanggaran (lampiran_id, pelanggaran_id FK, path_file, diunggah_oleh, created_at)` karena sifatnya bisa lebih dari satu foto per kejadian.
4. **Konfigurasi ambang & aturan** (ambang poin notifikasi, toleransi menit keterlambatan, durasi jendela edit) — sebaiknya tabel `pengaturan_sistem (key, value)` yang dikelola Admin, bukan hardcode di kode, karena PRD produk poin 12 menyebut ini masih perlu didiskusikan.
5. **Notifikasi** — perlu tabel `notifikasi` (atau memakai tabel `notifications` bawaan Laravel) untuk menyimpan riwayat notifikasi in-app, terpisah dari job pengirimnya.

Ini bukan blocker untuk mulai membangun modul inti (data master, absensi, pelanggaran, perizinan), tapi perlu disepakati sebelum modul dashboard/notifikasi dikerjakan.

## 10. Di Luar Cakupan Fase 1

Sama seperti dokumen produk asli: portal/aplikasi wali santri, integrasi pembayaran SPP, modul akademik/nilai. Ditambah dari sisi teknis: integrasi WhatsApp/SMS gateway, fingerprint/RFID/QR, dan realtime broadcasting (Reverb) bisa ditunda ke fase berikutnya jika timeline ketat — polling interval wajar (mis. 30 detik) di dashboard cukup untuk fase 1.

## 11. Pertanyaan Terbuka

Dibawa dari dokumen produk, plus tambahan teknis:

- Apakah izin santri memerlukan persetujuan wali santri, atau cukup 3 tahap internal (Wali Kamar → Pengasuh → Keamanan)?
- Skema poin pelanggaran → sanksi (SP1/SP2) otomatis atau manual di fase 1?
- **[Teknis]** Struktur kelompok PBS — ikut kamar, kelas, atau kelompok baru? (menentukan apakah perlu tabel `kelompok_pbs`)
- **[Teknis]** Apakah satu Ustadz/Musyrif memang bisa ditugaskan ke lebih dari satu kamar/kelompok? (menentukan urgensi tabel `petugas_penugasan`)
- **[Teknis]** Volume data foto bukti pelanggaran — cukup local storage atau perlu object storage (S3-compatible) sejak awal?

## 12. Metrik Keberhasilan

Sama seperti dokumen produk: 100% kegiatan absensi terinput tepat waktu dalam 30 hari setelah peluncuran, waktu rekap laporan bulanan berkurang signifikan, seluruh data pelanggaran & perizinan tercatat di sistem tanpa pencatatan paralel di buku manual.
