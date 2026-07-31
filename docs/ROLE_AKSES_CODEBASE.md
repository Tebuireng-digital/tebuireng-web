# Hak Akses Role — Implementasi Codebase Saat Ini

Dokumen ini adalah audit perilaku **yang benar-benar diterapkan oleh backend dan frontend saat ini**, bukan hanya target dalam PRD. Sumber utama: `backend/routes/api.php`, controller, policy Laravel, middleware `role`, dan `frontend/src/App.tsx`.

## Daftar role

Kolom `petugas.jabatan` dibatasi menjadi enam nilai berikut:

| Role | Tujuan utama |
|---|---|
| `Admin` | Administrasi sistem dan override operasional |
| `Pengasuh` | Monitoring dan laporan |
| `Keamanan` | Perizinan, gerbang, dan pelanggaran |
| `Pembina Kamar` | Absensi kamar dan pelanggaran ringan pada santri yang menjadi tanggung jawabnya |
| `Wali Kelas` | Absensi kelas formal |
| `Ustadz` | Absensi Al-Qur'an Subuh, Madin, dan Takhasus |

Santri tidak mempunyai akun dan tidak melakukan input.

## Ringkasan hak absensi

| Role | Bisa melihat kartu/roster absensi | Bisa menyimpan absensi | Target yang diizinkan | Bisa melihat rekap seluruh absensi | Bisa edit baris absensi |
|---|---|---|---|---|---|
| Admin | Ya | Ya | Semua lima jenis, tanpa penugasan | Ya | Ya, tanpa batas waktu |
| Pengasuh | Tidak | Tidak | — | Ya | Tidak |
| Keamanan | Tidak | Tidak | — | Tidak | Tidak melalui alur normal |
| Pembina Kamar | Ya | Ya | Hanya `Kamar` yang aktif ditugaskan | Tidak | Ya, hanya kamar yang berhak dan maksimal dalam jendela edit |
| Wali Kelas | Ya | Ya | Hanya `KelasFormal` yang aktif ditugaskan | Tidak | Ya, hanya kelas yang berhak dan maksimal dalam jendela edit |
| Ustadz | Ya | Ya | Hanya `KelompokPBS`, `KelompokMadin`, dan `KelompokPBM` yang aktif ditugaskan | Tidak | Ya, hanya kelompok yang berhak dan maksimal dalam jendela edit |

Lima jenis absensi dan penugasan yang valid:

| Slug API | Kegiatan | Tipe target | Role penugasannya |
|---|---|---|---|
| `sekolah` | Kelas formal 7/8/9 | `KelasFormal` | Wali Kelas |
| `kamar` | Kamar | `Kamar` | Pembina Kamar |
| `pbs` | Al-Qur'an setelah Subuh | `KelompokPBS` | Ustadz |
| `diniyah` | Kelas Madin | `KelompokMadin` | Ustadz |
| `pbm` | Takhasus setelah Maghrib | `KelompokPBM` | Ustadz |

### Aturan penugasan absensi

- Admin dapat membuat atau menghapus penugasan melalui **Data Master**.
- Penugasan berlaku jika `tanggal_mulai` sudah tiba dan `tanggal_selesai` kosong atau belum lewat.
- Seluruh akses roster non-Admin harus berasal dari penugasan aktif di `petugas_penugasan`.
- Relasi pemilik hasil impor seperti `pembina_id`, `wali_kelas_id`, dan `ustadz_id` hanya metadata dan tidak memberikan akses dengan sendirinya.
- Migrasi data mengubah metadata Pembina Kamar dan Wali Kelas lama menjadi penugasan eksplisit; proses impor berikutnya juga langsung membuat penugasan tersebut.
- Admin dapat membuka semua roster tanpa penugasan khusus.
- Simpan ulang absensi pada santri, kegiatan, jadwal, dan tanggal yang sama melakukan upsert; tidak membuat baris duplikat.
- Petugas non-Admin hanya dapat mengubah baris absensi dalam durasi pengaturan `durasi_edit_absensi_menit` (default 60 menit). Admin tidak dibatasi waktu ini.

Endpoint absensi:

```text
GET   /api/absensi-options
GET   /api/absensi/{jenis}/session
POST  /api/absensi/{jenis}/bulk
PATCH /api/absensi/{id}
GET   /api/absensi                 # rekap: Admin dan Pengasuh
```

## Matriks modul per role

Keterangan: **Penuh** = seluruh data; **Terbatas** = dibatasi penugasan atau kategori; **Lihat** = tanpa perubahan; **—** = tidak memiliki akses melalui UI/API yang dimaksud.

| Role | Absensi | Perizinan & gerbang | Pelanggaran | Laporan | Data Master |
|---|---|---|---|---|---|
| Admin | Penuh | Buat izin, lihat izin, catat gerbang | Semua kategori dan semua santri | Penuh | Kelola penugasan, lihat petugas/kamar/santri, reset password petugas |
| Pengasuh | Rekap saja | Lihat daftar izin | Lihat endpoint pelanggaran | Penuh | — |
| Keamanan | — | Buat izin yang langsung disetujui, lihat daftar izin, catat keluar/kembali | Sedang dan berat, seluruh santri | — | — |
| Pembina Kamar | Kamar yang ditugaskan | — | Ringan, terbatas pada santri yang dapat diakses | — | — |
| Wali Kelas | Kelas formal yang ditugaskan | — | Lihat catatan implementasi di bawah | — | — |
| Ustadz | PBS/Madin/PBM yang ditugaskan | — | Lihat catatan implementasi di bawah | — | — |

## Rincian per role

### Admin

- Selalu lolos middleware `role`; Admin menjadi override untuk seluruh route yang memakai middleware tersebut.
- Dapat mengisi dan mengedit seluruh lima jenis absensi, termasuk target tanpa penugasan.
- Dapat melihat rekap `/api/absensi` dan seluruh laporan kehadiran, pelanggaran, perizinan, serta bulanan.
- Dapat membuat izin, mengakses jenis izin, dan mencatat pergerakan gerbang. Izin yang dibuat langsung berstatus `Disetujui`.
- Dapat mencatat pelanggaran kategori ringan, sedang, maupun berat untuk seluruh santri; dapat mengunggah lampiran.
- Dapat melihat daftar petugas, kamar, dan santri; membuat/menghapus penugasan; dan mereset password petugas.

### Pengasuh

- Tidak mendapat kartu absensi dan tidak dapat menginput absensi. Ini sebab akun `pengasuh` pada dashboard tidak menampilkan kartu kamar/sekolah/kelompok.
- Dapat melihat rekap absensi seluruh kegiatan di `/api/absensi`.
- Dapat membuka seluruh laporan melalui **Laporan Detail**: kehadiran, pelanggaran, perizinan, dan bulanan (PDF/XLSX bila tersedia pada endpoint laporan).
- Dapat melihat daftar perizinan, tetapi tidak dapat membuat izin maupun mencatat gerbang.
- Menerima notifikasi saat poin pelanggaran santri melampaui ambang yang dikonfigurasi.

### Keamanan

- Tidak memiliki hak input atau kartu absensi.
- Dapat membuat izin; backend langsung menetapkan status `Disetujui` dan memicu pengisian status `Izin` pada absensi dalam rentang izin.
- Dapat melihat jenis izin dan daftar izin, lalu mengisi waktu keluar serta waktu kembali aktual di gerbang. Saat keluar dicatat, status menjadi `Sedang Berjalan`; saat kembali dicatat, status menjadi `Selesai`.
- Dapat mencatat pelanggaran **sedang** dan **berat** untuk seluruh santri serta mengunggah lampiran.
- Tidak memiliki menu laporan atau data master.

### Pembina Kamar

- Dapat mengisi absensi `kamar` hanya untuk kamar yang memiliki penugasan aktif.
- Tidak dapat mengisi sekolah, PBS, Madin, atau PBM.
- Dapat mencatat pelanggaran **ringan** bila policy menemukan santri berada dalam target yang dapat ia akses. Dalam alur normal, targetnya adalah kamar yang ditugaskan.
- Tidak dapat membuat izin, mencatat gerbang, melihat laporan, atau mengelola master.

### Wali Kelas

- Dapat mengisi absensi `sekolah` hanya untuk kelas formal yang memiliki penugasan aktif.
- Tidak dapat mengisi kamar, PBS, Madin, atau PBM.
- Tidak memiliki menu perizinan, gerbang, laporan, atau master.
- Tidak dapat membaca direktori santri, kategori/poin/riwayat pelanggaran, atau membuat pelanggaran melalui API.

### Ustadz

- Dapat mengisi absensi `pbs`, `diniyah`, dan `pbm` hanya untuk kelompok yang ditugaskan aktif.
- Tidak dapat mengisi kelas formal atau kamar.
- Satu Ustadz dapat memiliki lebih dari satu penugasan dan lintas jenis kelompok PBS/Madin/PBM.
- Tidak memiliki menu perizinan, gerbang, laporan, atau master.
- Tidak dapat membaca direktori santri, kategori/poin/riwayat pelanggaran, atau membuat pelanggaran melalui API.

## Akses umum seluruh petugas terautentikasi

Semua akun petugas aktif dapat login, logout, mengganti password, dan memanggil `/api/me`.

Semua akun baru dengan `wajib_ganti_password = true` dikunci oleh frontend pada halaman **Ganti Password**. Backend juga mengembalikan `423 PASSWORD_CHANGE_REQUIRED` untuk seluruh endpoint terproteksi selain logout, `/api/me`, dan ganti password. Password baru minimal 12 karakter, harus memiliki huruf dan angka, serta memerlukan konfirmasi.

## Catatan implementasi dan celah yang perlu dipahami

Bagian ini penting agar hak akses yang diuji tidak keliru dianggap sudah sama persis dengan PRD.

1. **Endpoint baca operasional sudah dibatasi backend.** Admin/Keamanan/Pengasuh dapat membaca data operasional sesuai kebutuhan; Pembina Kamar hanya melihat santri dan pelanggaran dalam penugasannya. Respons direktori umum tidak memuat PII wali. Wali Kelas dan Ustadz ditolak dari endpoint tersebut.
2. **Patch absensi bergantung pada policy target, bukan daftar role input.** `POST /bulk` secara ketat memakai pemetaan role–jenis absensi. Untuk `PATCH /api/absensi/{id}`, policy memeriksa akses target santri; data penugasan normal dari Data Master sudah membatasi kombinasi role–target, tetapi validasi role–jenis tidak diulang secara eksplisit pada policy patch.
3. **Data Master yang tersedia di MVP lebih sempit daripada PRD.** Backend saat ini menyediakan lihat petugas/kamar/santri, kelola penugasan, dan reset password. CRUD kategori pelanggaran, jenis izin, seluruh data santri, kelas, atau kelompok belum diekspos sebagai endpoint master terpisah.
4. **Admin adalah override middleware.** Walau route ditulis misalnya `role:Pengasuh` atau `role:Keamanan`, `RoleMiddleware` tetap mengizinkan Admin.

## Checklist cepat pengujian absensi

1. Login sebagai Admin, selesaikan ganti password jika diminta.
2. Buat penugasan yang cocok: Pembina Kamar → Kamar, Wali Kelas → KelasFormal, atau Ustadz → kelompok yang relevan.
3. Logout lalu login sebagai petugas tersebut dan selesaikan ganti password.
4. Pastikan Dashboard hanya menampilkan kartu/target yang sesuai role dan penugasan.
5. Simpan beberapa status absensi, refresh roster yang sama, lalu simpan lagi untuk memastikan upsert tidak menggandakan data.
6. Coba membuka target milik petugas lain; hasil yang diharapkan adalah `403`.
