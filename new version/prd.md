# PRD Teknis SIMANTEB (Acuan Produk v1.3.4 — 5 September 2026)

Dokumen ini adalah acuan resmi kebutuhan produk SIMANTEB. Isinya merangkum model peran, alur fungsional, dan kontrak endpoint utama yang menjadi pegangan pengembangan pada rilis awal.

---

## 1. Ringkasan Produk

SIMANTEB adalah sistem operasional pesantren untuk mendigitalisasi:

1. absensi enam modul operasional santri: kelas formal, keberangkatan kelas, kamar, PBS, PBM, dan Madin;
2. perizinan keluar, pencatatan gerbang, dan surat izin;
3. pelanggaran, akumulasi poin, dan prestasi santri;
4. raport pengajian dan raport pembinaan;
5. kualitas data santri, penugasan petugas, dan notifikasi WhatsApp;
6. portal wali santri untuk memantau data anak secara read-only.

Pengalaman produk terbagi dua:

- **Petugas internal**: Admin, Keamanan, Pembina Kamar, Wali Kelas, dan Piket Pengajian.
- **Portal wali santri**: login terpisah berbasis Nomor Induk Pondok anak.

---

## 2. Tujuan Produk

- Mengganti buku manual absensi, izin, dan catatan pembinaan dengan workflow digital yang cepat dipakai di HP.
- Memastikan akses operasional mengikuti penugasan aktif, bukan asumsi jabatan semata.
- Menjaga data santri cukup lengkap untuk operasional harian, raport, dan notifikasi wali.
- Memberikan transparansi kepada wali tanpa membuka hak edit ke data operasional.

---

## 3. Peran Pengguna & Pengalaman Utama

| Pengguna | Kebutuhan utama | Surface utama |
| --- | --- | --- |
| **Admin** | Mengelola seluruh modul tanpa pembatasan operasional, termasuk input prestasi dan override administrasi | Dashboard admin, Data Master, Verifikasi Data, semua absensi, laporan, perizinan, pelanggaran, prestasi, raport pengajian, raport pembinaan |
| **Keamanan** | Membuat izin, mencatat keluar/kembali gerbang, mengunduh surat izin, mencatat pelanggaran sedang/berat, dan memantau notifikasi ambang poin | Dashboard keamanan, Catat Gerbang, daftar perizinan, pelanggaran |
| **Pembina Kamar** | Menangani absensi keberangkatan kelas pada sesi pagi dan absensi kamar pada sesi malam, mengisi raport pembinaan, mencatat pelanggaran ringan, membantu kelengkapan data santri kamar | Dashboard pembina, absensi keberangkatan kelas, absensi kamar, raport pembinaan input/lihat/master, pelanggaran, Data Master terbatas |
| **Wali Kelas** | Mengabsen kelas formal dan memantau rekap kelas | Dashboard teacher, absensi kelas formal, rekap kelas |
| **Piket Pengajian** | Mengabsen PBS, PBM, dan Madin serta mengisi raport pengajian untuk PBS/PBM | Dashboard teacher, absensi PBS/PBM/Madin, input raport pengajian, lihat raport pengajian |
| **Wali Santri** | Melihat profil anak, kehadiran, pelanggaran, perizinan, rapor pengajian, dan prestasi | Portal Wali Santri |

---

## 4. Surface Aplikasi & Kontrak Endpoint Utama

Rincian stack teknis dipisahkan ke [specs.md](/home/akbarhann/project/tebuirengv2/docs/specs.md). Bagian ini tetap dipertahankan di PRD karena kontrak endpoint utama menjadi acuan bersama untuk pengembangan backend dan frontend.

| Modul | Route UI utama | Endpoint API utama |
| --- | --- | --- |
| **Auth petugas** | `/pilih-login`, `/login`, `/ganti-kata-sandi` | `POST /api/login`, `POST /api/logout`, `GET /api/me`, `POST /api/ganti-password` |
| **Portal wali** | `/portal-santri/login`, `/portal-santri` | `POST /api/santri-portal/login`, `POST /api/santri-portal/logout`, `GET /api/santri-portal/me`, `POST /api/santri-portal/ganti-password`, `GET /api/santri-portal/kehadiran`, `GET /api/santri-portal/pelanggaran`, `GET /api/santri-portal/perizinan`, `GET /api/santri-portal/prestasi`, `GET /api/santri-portal/rapor-pengajian`, `GET /api/santri-portal/rapor-pengajian/history`, `GET /api/santri-portal/rapor-pengajian/{documentId}/pdf` |
| **Dashboard** | `/dashboard` | `GET /api/dashboard/summary` |
| **Absensi operasional** | `/absensi-kegiatan/:jenis`, `/absensi/:jenis/:id`, `/rekap-kelas` | `GET /api/absensi-options`, `GET /api/absensi/{jenis}/session`, `POST /api/absensi/{jenis}/bulk`, `PATCH /api/absensi/{id}`, `GET /api/absensi` |
| **Perizinan & gerbang** | `/perizinan/semua`, `/catat-gerbang` | `GET /api/perizinan`, `GET /api/perizinan-jenis`, `POST /api/perizinan`, `PATCH /api/perizinan/{id}/gerbang`, `PATCH /api/perizinan/{id}/gerbang/koreksi`, `GET /api/perizinan/{id}/pdf` |
| **Pelanggaran** | `/pelanggaran/semua`, `/pelanggaran/baru`, `/pelanggaran/master` | `GET /api/pelanggaran`, `GET /api/pelanggaran/kategori`, `POST /api/pelanggaran`, `POST /api/pelanggaran/{id}/lampiran`, `GET /api/santri/{id}/poin`; master: `POST /api/pelanggaran/kategori`, `PATCH /api/pelanggaran/kategori/{id}`, `DELETE /api/pelanggaran/kategori/{id}` |
| **Prestasi** | `/prestasi/semua` | `GET /api/prestasi`, `POST /api/prestasi`, `DELETE /api/prestasi/{id}` |
| **Raport pengajian** | `/raport/input`, `/raport/lihat` | `GET /api/raport-pengajian/options`, `GET /api/raport-pengajian/session`, `POST /api/raport-pengajian/bulk`, `POST /api/raport-pengajian/{santriId}/publish`, `GET /api/raport-pengajian/{santriId}`, `GET /api/raport-pengajian/{santriId}/history`, `GET /api/raport-pengajian/{santriId}/pdf`, `GET /api/raport-pengajian/{santriId}/documents/{documentId}/pdf`, `GET /api/raport-pengajian/kelompok/{jenis}/{kelompokId}/pdf`, `GET /api/raport-pengajian/rekap-semester` |
| **Raport Pembinaan** (teknis: `ubudiyah`) | `/ubudiyah/input`, `/ubudiyah/lihat`, `/ubudiyah/master` | `GET /api/ubudiyah/status`, `GET /api/ubudiyah/options`, `GET /api/ubudiyah/session`, `POST /api/ubudiyah/bulk`, `POST /api/ubudiyah/{santriId}/publish`, `GET /api/ubudiyah/master`, `GET /api/ubudiyah/{santriId}`, `GET /api/ubudiyah/{santriId}/history`, `GET /api/ubudiyah/{santriId}/pdf`, `GET /api/ubudiyah/{santriId}/documents/{documentId}/pdf`, `GET /api/ubudiyah/kamar/{kamarId}/pdf`, `GET /api/ubudiyah/rekap-semester` |
| **Data master & verifikasi** | `/data-master/:tab`, `/verifikasi-data/:tab` | endpoint petugas, kamar, santri, penugasan, import review, mapping kamar, ORDA, ekstrakurikuler, alumni, WA bot, `GET/POST /api/periode-akademik`, `PATCH /api/periode-akademik/{id}`, `POST /api/periode-akademik/{id}/tutup`, `GET /api/kenaikan-kelas/preview`, `POST /api/kenaikan-kelas/terapkan` |
| **Laporan & ekspor** | `/laporan/detail` | `GET /api/laporan/kehadiran`, `GET /api/laporan/pelanggaran`, `GET /api/laporan/perizinan`, `GET /api/laporan/prestasi`, `GET /api/laporan/bulanan`, `GET /api/laporan/organisasi-daerah` |

---

## 5. Kebutuhan Fungsional per Modul

### 5.1. Auth, Session, dan Login Terpisah

- Halaman awal meminta pengguna memilih jalur login: **petugas** atau **portal wali**.
- Login petugas memakai sesi stateful dan memerlukan CSRF cookie.
- Login petugas hanya berhasil untuk akun `petugas.status_aktif = 1`.
- Saat pertama kali login, petugas wajib mengganti password bila akun ditandai `wajib_ganti_password = true`.
- Password baru petugas minimal 12 karakter dan harus mengandung huruf serta angka.
- Login portal wali memakai tabel `wali_accounts` dengan `username = no_id_induk` milik santri.
- Portal wali memiliki alur ganti password sendiri dan tidak memakai kewajiban ganti password pertama seperti akun petugas.

### 5.2. Dashboard Berbasis Role

- **Admin** melihat pusat kendali data: antrean verifikasi, santri tanpa kamar/kelas, kelengkapan nomor wali, NIK, foto, dan shortcut ke Data Master.
- **Keamanan** melihat overdue permit, aksi cepat gerbang, log lintasan terbaru, notifikasi ambang poin, dan ringkasan pengawasan operasional izin/pelanggaran.
- **Pembina Kamar** melihat headcount kamar, status keberangkatan kelas pagi dan absensi kamar malam hari ini, pelanggaran terbaru, dan shortcut ke raport pembinaan/pelanggaran.
- **Wali Kelas** melihat jadwal kelas formal aktif dan shortcut ke absensi kelas serta rekap kelas.
- **Piket Pengajian** melihat jadwal PBS/PBM/Madin aktif dan shortcut ke absensi serta raport pengajian sesuai penugasan.

### 5.3. Enam Modul Absensi Operasional

#### Pemetaan kegiatan

| Modul operasional | Kode teknis | Target roster | Role input utama |
| --- | --- | --- | --- |
| Kelas Formal | `sekolah` | `kelas_formal` | Wali Kelas |
| Keberangkatan Kelas | `kamar` + jadwal pagi | `kamar` | Pembina Kamar |
| Kamar | `kamar` + jadwal malam | `kamar` | Pembina Kamar |
| PBS | `pbs` | `kelompok_pbs` | Piket Pengajian |
| PBM | `pbm` | `kelompok_pbm` | Piket Pengajian |
| Madin | `diniyah` | `kelompok_madin` | Piket Pengajian |

#### Aturan fungsional

- Menu absensi yang muncul di UI berasal dari `GET /api/absensi-options` dan harus mengembalikan enam entri operasional yang sesuai role serta penugasan aktif.
- Untuk rumpun `kamar`, endpoint tersebut menampilkan dua entri terpisah: `Keberangkatan Kelas` dengan preset jadwal pagi dan `Kamar` dengan preset jadwal malam, walaupun keduanya tetap memakai kode teknis `kamar`.
- Admin dapat melihat seluruh modul, jenis, target, dan jadwal tanpa penugasan khusus.
- Roster UI mengelompokkan target berdasarkan konteks:
  - `sekolah` dikelompokkan per unit/jenjang pendidikan,
  - `kamar` dikelompokkan per kategori kamar dan dipakai untuk dua konteks operasional: keberangkatan kelas pada sesi pagi serta absensi kamar pada sesi malam,
  - `pbs` dikelompokkan per kategori PBS,
  - `diniyah` dan `pbm` tampil sebagai daftar target pengajian.
- Halaman input absensi menggunakan satu layar ledger per target dan jadwal.
- Status kehadiran resmi adalah `Hadir`, `Izin`, `Sakit`, `Alpha`, dan `Terlambat`.
- Status `Terlambat` dapat memuat `menit_terlambat` dan `keterangan`.
- Penyimpanan bulk memakai upsert unik `(santri_id, jenis_kegiatan_id, jadwal_id, tanggal)`.
- Payload yang identik dengan data existing diperlakukan sebagai no-op agar tidak menulis audit log baru.
- Ketersediaan tugas absensi ditentukan otomatis dari jadwal aktif, waktu sesi, dan penugasan role. Petugas tidak perlu dan tidak boleh mengaktifkan atau menonaktifkan sesi secara manual.
- Dashboard petugas menampilkan tugas yang relevan pada waktunya, misalnya Pembina Kamar melihat roster kamar untuk keberangkatan kelas pagi atau absensi kamar malam, sedangkan Piket Pengajian melihat roster PBS, PBM, atau Madin yang ditugaskan untuk sesi berjalan.
- Petugas hanya memilih target yang sudah ditugaskan kepadanya dari daftar tugas yang tersedia; daftar ini harus menjelaskan jenis kegiatan, nama kelas/kelompok/kamar, sesi, tanggal, dan status pengerjaan.
- Wali Kelas, Pembina Kamar, dan Piket Pengajian dapat membuka histori lengkap absensi santri dalam scope penugasannya, dengan filter santri, rentang tanggal, jenis kegiatan, roster, sesi, dan status.
- Dari histori, petugas dapat membuka detail satu catatan dan mengeditnya jika masih berada dalam `durasi_edit_absensi_menit` dari `waktu_input`; perubahan memakai endpoint edit yang sama dan menyimpan audit perubahan.
- Catatan di luar jendela edit tetap dapat dilihat sebagai histori read-only. Jika koreksi diperlukan, UI menyediakan jalur permintaan atau eskalasi ke Admin tanpa mengubah data secara diam-diam.
- Petugas non-Admin hanya dapat mengedit baris absensi dalam jangka waktu `durasi_edit_absensi_menit` dari `waktu_input`; Admin tidak dibatasi.
- Endpoint mengembalikan flag `input_terlambat` bila penyimpanan melewati `jam_selesai + toleransi_menit_terlambat_input`.

#### Ketentuan koneksi

- Input absensi membutuhkan koneksi ke server; sistem tidak menggunakan
  offline-first atau queue absensi lokal.
- Jika koneksi gagal, UI mempertahankan input yang sedang diedit selama halaman
  masih terbuka, menampilkan error yang jelas, dan menyediakan aksi `Coba lagi`.
- Data dianggap tersimpan hanya setelah server mengonfirmasi keberhasilan.

#### Rekap kelas

- `/rekap-kelas` tersedia untuk Admin dan Wali Kelas.
- Halaman ini memuat rekap status harian satu kelas formal berdasarkan sesi `GET /api/absensi/sekolah/session`.

### 5.4. Perizinan, Pos Gerbang, dan Surat Izin

- Pembuatan izin adalah workflow utama role Keamanan; Admin dapat melakukan override operasional bila diperlukan.
- Pada rilis awal, izin yang dibuat langsung berstatus `Disetujui` dan tidak memakai approval berjenjang.
- Sistem menolak izin yang bentrok dengan izin aktif lain pada rentang waktu yang sama.
- UI Catat Gerbang memecah data menjadi:
  - izin aktif `Disetujui` dan `Sedang Berjalan`,
  - riwayat selesai/nonaktif.
- Pencatatan keluar gerbang mengisi `waktu_keluar_aktual` dan mengubah status ke `Sedang Berjalan`.
- Pencatatan masuk gerbang mengisi `waktu_masuk_aktual` dan mengubah status ke `Selesai`.
- Tersedia fitur koreksi waktu gerbang yang menyimpan histori koreksi secara terpisah.
- Surat izin PDF dapat diunduh dari daftar izin maupun halaman Catat Gerbang.
- Status resmi perizinan pada rilis awal adalah `Disetujui`, `Sedang Berjalan`, dan `Selesai`; istilah legacy seperti `keluar` atau `kembali` tidak menjadi acuan produk.
- Saat izin dibuat, event `PerizinanDisetujui` memicu pengisian otomatis status `Izin` ke semua jadwal aktif selama rentang izin.
- Saat santri kembali, sistem mengirim notifikasi WhatsApp ke nomor wali bila tersedia.

### 5.5. Pelanggaran, Poin, dan Pembinaan

- Daftar kategori pelanggaran diambil dari `kategori_pelanggaran` yang aktif.
- Admin dapat mencatat pelanggaran untuk seluruh santri.
- Keamanan dapat menambahkan, mengedit, dan menonaktifkan atau menghapus data master nama pelanggaran, tipe pelanggaran, dan poin pelanggaran sesuai validasi histori.
- Keamanan hanya dapat mencatat pelanggaran kategori `Sedang` dan `Berat`; hak mengelola master kategori tidak otomatis memberi hak mencatat kategori lain.
- Pembina Kamar hanya dapat mencatat kategori `Ringan` untuk santri yang berada dalam akses penugasannya.
- Form UI mendukung pencarian santri, preview akumulasi poin, input poin aktual, catatan, dan lampiran foto.
- Master pelanggaran yang sudah dipakai dalam histori tidak dihapus permanen; gunakan nonaktifkan agar tidak muncul pada input baru dan pertahankan histori lama.
- Perubahan tipe atau poin menampilkan dampak terhadap input berikutnya dan tidak mengubah poin historis yang sudah tercatat, kecuali ada workflow koreksi Admin yang terpisah.
- Jumlah poin per santri dihitung dari seluruh histori pelanggaran dan di-cache.
- Jika total poin melewati `ambang_notifikasi_poin`, sistem membuat notifikasi internal untuk Keamanan dan Admin.
- Pencatatan pelanggaran memicu notifikasi WhatsApp ke wali bila nomor tersedia.

### 5.6. Prestasi Santri

- Modul prestasi dipisahkan dari daftar pelanggaran dan memiliki route sendiri `/prestasi/semua`.
- Pada pengalaman petugas internal, modul prestasi hanya tersedia untuk Admin.
- Role petugas selain Admin tidak memiliki menu, route, atau hak lihat prestasi pada rilis awal.
- UI mendukung pencarian, filter tanggal, tambah prestasi lewat modal, dan hapus data.
- Field utama: santri, `nama_prestasi`, `peringkat`, `tingkat`, `tanggal`, dan `keterangan`.
- Portal wali menampilkan histori prestasi anak secara read-only.
- Pada rilis awal, modul prestasi mendukung lihat, tambah, dan hapus. Fitur edit tidak termasuk scope awal.

### 5.7. Raport Pengajian

- Pada rilis awal, modul ini meliputi dua jenis:
  - `AL_QURAN` berbasis kelompok PBS,
  - `TAKHASSUS` berbasis kelompok PBM.
- Input raport dilakukan bulanan per kelompok, dengan `tahun_pelajaran` dan `semester` diturunkan dari bulan/tahun input.
- Aspek penilaian bersifat fixed:
  - Al-Qur'an: `Fashohah`, `Tajwid`, `Kelancaran`, `Hafalan`,
  - Takhassus: `Ujian Tulis`, `Ujian Lisan`, `Nahwu`, `Shorof`, `Murod`.
- Penilaian kepribadian fixed: `Kelakuan`, `Kedisiplinan`, `Kerajinan` dengan nilai `A-E`.
- Input bulk dibatasi untuk Admin dan Piket Pengajian.
- Lihat raport pengajian tersedia untuk Admin dan Piket Pengajian.
- Wali Kelas tidak memiliki akses ke modul ini pada rilis awal.
- UI lihat raport mendukung:
  - mode kelompok,
  - mode cari nama,
  - unduh PDF per santri,
  - unduh PDF bulk per kelompok.
- Mode cari nama hanya menampilkan santri PBS/PBM yang berada dalam akses role aktif; fitur ini bukan direktori santri global.
- Portal wali dapat melihat rapor pengajian per tahun ajaran/semester dan mengunduh PDF gabungan untuk anaknya.
- Setiap raport yang diterbitkan disimpan sebagai snapshot dokumen per santri,
  jenis raport, periode, dan versi. Dokumen lama tidak ditimpa ketika ada
  koreksi atau penerbitan ulang.
- Raport menjadi arsip resmi ketika Admin atau role input yang berwenang
  menjalankan aksi `Terbitkan`; menyimpan draft tidak membuat arsip PDF baru.
- Riwayat raport dapat dibaca oleh role yang memiliki scope raport tersebut;
  Wali Santri hanya dapat membaca arsip raport anak yang terhubung ke akunnya.
- Rekap semester tersedia untuk Admin.

### 5.8. Raport Pembinaan

- Pada rilis awal, nama produk yang tampil di UI adalah **Raport Pembinaan**, sedangkan route dan endpoint teknis tetap memakai namespace `ubudiyah`.
- Modul raport pembinaan terdiri dari master instrumen, raport bulanan, dan nilai per instrumen untuk setiap santri.
- Penilaian dilakukan bulanan per kamar.
- Instrumen raport pembinaan tidak fixed; Admin dan Pembina Kamar dapat menambah serta menonaktifkan instrumen pada halaman master.
- Input raport pembinaan menyimpan nilai angka dan catatan per instrumen untuk setiap santri di kamar terpilih.
- UI menghitung rata-rata dan peringkat lokal sebelum/selama penyimpanan.
- Input dibatasi untuk Admin dan Pembina Kamar.
- Lihat raport pembinaan mendukung:
  - mode kamar,
  - mode cari nama,
  - unduh PDF per santri,
  - unduh PDF bulk per kamar.
- Lihat raport pembinaan tersedia untuk Admin dan Pembina Kamar.
- Rekap semester tersedia berbasis kamar dan tahun pelajaran.
- Setiap raport pembinaan yang diterbitkan disimpan sebagai snapshot dokumen
  per santri, periode, dan versi agar histori tetap dapat dibuka setelah data
  aktif berubah.

#### Periode akademik dan rollover

- Admin mengelola **Periode Akademik** dengan `tahun_pelajaran`, semester,
  tanggal mulai, tanggal selesai, dan status `Draft`, `Aktif`, atau `Ditutup`.
- Hanya satu periode akademik yang boleh aktif untuk jenis kegiatan yang sama.
- Sebelum semester atau tahun pelajaran ditutup, Admin melihat checklist
  raport yang belum lengkap, draft yang belum diterbitkan, dan santri yang
  belum memiliki assignment periode berikutnya.
- Saat periode ditutup, input raport periode tersebut menjadi read-only untuk
  role biasa. Koreksi setelah penutupan hanya dapat dilakukan Admin melalui
  workflow koreksi yang diaudit dan dapat membuat versi arsip baru.
- Kenaikan kelas dilakukan manual oleh Admin melalui tahap `Preview` lalu
  `Terapkan`, bukan perubahan otomatis berdasarkan kelas saat ini.
- Preview kenaikan kelas menampilkan santri, kelas asal, kelas tujuan, status
  transisi, konflik assignment, dan data yang belum lengkap sebelum ada
  perubahan.
- Eksekusi rollover menggunakan assignment berbasis periode: assignment lama
  ditutup dengan `effective_until`, assignment baru dibuat dengan
  `effective_from`. Data kelas lama tidak dioverwrite.
- Status transisi santri minimal mencakup `Naik Kelas`, `Tinggal Kelas`,
  `Lulus`, `Pindah`, dan `Keluar`. Santri yang tinggal kelas tetap memakai
  record santri yang sama dan mendapat assignment periode baru.
- Kelas formal, kamar, PBS, PBM, dan Madin diproses sebagai assignment
  terpisah. Kenaikan kelas formal tidak otomatis mengubah kamar atau kelompok
  pengajian tanpa keputusan assignment masing-masing.
- Histori absensi, nilai raport, roster, dan dokumen arsip selalu menunjuk ke
  periode serta assignment saat data dibuat. Perubahan periode baru tidak
  boleh mengubah histori periode sebelumnya.
- Endpoint utama periode dan rollover adalah:
  `GET /api/periode-akademik`, `POST /api/periode-akademik`,
  `PATCH /api/periode-akademik/{id}`,
  `POST /api/periode-akademik/{id}/tutup`,
  `GET /api/kenaikan-kelas/preview`, dan
  `POST /api/kenaikan-kelas/terapkan`.
- Endpoint penerbitan raport adalah
  `POST /api/raport-pengajian/{santriId}/publish` dan
  `POST /api/ubudiyah/{santriId}/publish`. Penerbitan ulang menghasilkan
  versi dokumen baru dan tidak menghapus versi lama.

### 5.9. Data Master, Verifikasi, dan Operasi Admin

#### Data santri

- Data santri yang dikelola meliputi identitas, domisili, kontak, keluarga, pendidikan, kamar, kelas formal, kelompok Madin/PBS/PBM, ORDA, status verifikasi, foto, dan partisipasi kegiatan.
- Saat `no_id_induk` pertama kali terisi, sistem otomatis membuat atau menautkan akun wali santri.
- Pembina Kamar dapat melengkapi data operasional santri binaannya, termasuk foto, nomor wali, kelengkapan penempatan kamar, partisipasi kegiatan, dan data pendukung operasional lain dalam scope penugasan aktif.
- Pembina Kamar dapat melihat profil dan data operasional santri dalam scope kamar yang ditugaskan untuk membantu melengkapi data.
- Pembina Kamar dapat menambahkan atau mengganti foto santri dalam scope penugasannya, dengan preview, validasi format/ukuran, dan histori perubahan.
- Pelengkapan data oleh Pembina Kamar dibatasi pada santri yang berada dalam scope penugasan kamar aktif.

#### Verifikasi data

- Queue verifikasi santri memeriksa data yang belum siap operasional:
  - kamar belum dipetakan,
  - kelas formal belum dipetakan,
  - kelompok Madin/PBS/PBM belum dipetakan padahal partisipasinya bukan `tidak_ikut`.
- Queue verifikasi ORDA menampilkan santri aktif yang belum memiliki ORDA aktif.
- Ada workflow sinkronisasi review hasil impor, merge kandidat santri, mark separate, dan mapping kode kamar sumber ke kamar resmi.

#### Penugasan petugas

- Penugasan absensi disimpan eksplisit per petugas dan target.
- Satu petugas boleh memiliki lebih dari satu target/roster aktif selama target tersebut tidak menimbulkan konflik penugasan atau duplikasi input.
- Assignment menyimpan konteks target, jenis kegiatan, jadwal/sesi, periode aktif, dan status penugasan agar sistem dapat membentuk daftar tugas absensi personal.
- Dashboard petugas menampilkan `Tugas absensi sekarang` berdasarkan waktu server, jadwal aktif, dan assignment; setiap tugas menyebut jenis kegiatan, nama roster, sesi, tanggal, jumlah santri, serta status `Belum dimulai`, `Sedang dikerjakan`, `Tersimpan`, atau `Gagal menyimpan`.
- Jika seorang Pembina Kamar ditugaskan ke beberapa kamar, semua roster kamar yang relevan tampil sebagai daftar tugas terpisah; membuka satu roster tidak mencampur santri dari roster lain.
- Jika seorang Piket Pengajian ditugaskan ke beberapa kelompok atau jenis kegiatan, daftar tugas memisahkan PBS, PBM, dan Madin serta nama kelompoknya.
- Petugas tidak mengaktifkan atau menonaktifkan sesi secara manual. Sistem hanya menampilkan tugas sesuai jadwal dan assignment, dengan tugas berikutnya tetap dapat dilihat sebagai jadwal.
- Aturan utama:
  - `sekolah` hanya untuk jabatan `Wali Kelas`,
  - `kamar` hanya untuk `Pembina Kamar` dan dipakai untuk modul keberangkatan kelas maupun kamar malam,
  - `pbs`, `diniyah`, `pbm` hanya untuk `Piket Pengajian`.
- Kelas formal hanya boleh memiliki satu penugasan aktif dan harus konsisten dengan metadata `wali_kelas_id` bila sudah diisi.

#### Referensi admin lainnya

- **Wisma/Kamar**: CRUD nama, kode, status aktif.
- **Mapping Kamar**: memetakan kode kamar sumber hasil impor ke kamar resmi.
- **Organisasi Daerah**: CRUD master ORDA dan bulk assignment ORDA ke banyak santri.
- **Ekstrakurikuler**: CRUD kode, nama, pembimbing, status aktif.
- **Alumni**: list, pencarian, filter, dan statistik; CRUD tidak termasuk scope awal.
- **Akun petugas**: CRUD akun, status aktif/nonaktif, reset password melalui edit atau endpoint reset.
- **WA Bot**: cek status, ambil QR pairing, dan disconnect session.

### 5.10. Portal Wali Santri

- Portal memakai halaman login terpisah dari petugas.
- Menu utama portal:
  - Beranda,
  - Data Anak,
  - Kehadiran,
  - Pelanggaran,
  - Perizinan,
  - Rapor Pengajian,
  - Prestasi,
  - Ganti Password.
- Data profil di portal menarik gabungan dari:
  - `santri`,
  - `santri_keluarga`,
  - `santri_pendidikan`,
  - penempatan kamar/kelas/kelompok,
  - partisipasi kegiatan,
  - foto.
- Portal bersifat read-only kecuali ganti password.
- Fitur `Notifikasi` dan `Pengaturan` di portal tidak termasuk scope awal selain ganti password.

### 5.11. Laporan dan Ekspor

- Sistem menyediakan laporan PDF/XLSX untuk:
  - kehadiran,
  - pelanggaran,
  - perizinan,
  - prestasi,
  - rangkuman bulanan gabungan,
  - organisasi daerah.
- UI `/laporan/detail` menyediakan selector jenis laporan, rentang tanggal, bulan, dan tahun.
- Laporan dan ekspor diposisikan sebagai workflow Admin.
- Surface ini tidak tersedia untuk role petugas non-Admin pada rilis awal.

---

## 6. Integrasi, Otomatisasi, dan Data Flow Penting

### 6.1. Impor data awal

- Pada rilis awal, impor data mengandalkan workbook Excel standar pesantren.
- Hasil impor dapat menghasilkan:
  - santri baru otomatis,
  - review kemiripan data,
  - mapping kamar sumber,
  - penugasan eksplisit,
  - akun petugas baru,
  - akun wali berdasarkan `no_id_induk`.

### 6.2. Scheduler & notifikasi internal

- Sistem membuat notifikasi `reminder_absensi` untuk petugas yang sesi absensinya akan dimulai 10 menit lagi.
- Sistem memeriksa izin `Sedang Berjalan` yang melewati `rencana_kembali` dan membuat notifikasi `overdue_izin` untuk Admin.

### 6.3. WhatsApp gateway

- Sistem mencatat semua pengiriman WhatsApp ke log notifikasi.
- Pengiriman dideduplikasi berdasarkan `tipe_pesan` dan `referensi_id` agar event yang sama tidak terkirim dua kali.
- Jenis pesan pada rilis awal:
  - perizinan disetujui,
  - santri kembali dari izin,
  - pelanggaran baru.

---

## 7. Ketentuan Produk Awal

1. Sistem memiliki **6 modul absensi resmi**: Kelas Formal, Keberangkatan Kelas, Kamar, PBS, PBM, dan Madin.
2. `GET /api/absensi-options` harus memunculkan enam entri operasional; **Keberangkatan Kelas** dan **Kamar** tetap tampil terpisah walaupun berbagi kode teknis `kamar`.
3. Role resmi produk adalah **Admin, Keamanan, Pembina Kamar, Wali Kelas, Piket Pengajian, dan Wali Santri**.
4. **Piket Pengajian** adalah role resmi untuk operasional PBS, PBM, Madin, serta input dan lihat raport pengajian.
5. **Wali Kelas** hanya menangani absensi kelas formal dan rekap kelas; akses raport pengajian tidak termasuk scope role ini.
6. **Admin** memiliki akses penuh ke seluruh modul, termasuk laporan, override operasional, dan pengelolaan prestasi.
7. **Prestasi** pada pengalaman petugas internal hanya tersedia untuk Admin dan pada rilis awal hanya mencakup lihat, tambah, dan hapus.
8. Nama produk resmi modul `ubudiyah` adalah **Raport Pembinaan**; namespace route dan endpoint teknis tetap `ubudiyah` pada rilis awal.
9. **Perizinan** pada rilis awal memakai alur persetujuan langsung tanpa approval berjenjang.
10. **Laporan dan ekspor** adalah kewenangan Admin.
11. **Pembina Kamar** membantu melengkapi data operasional santri binaannya dalam scope penugasan aktif; saat `no_id_induk` pertama kali terisi, sistem menyiapkan akun wali.
12. **Keamanan** dapat mengelola master nama, tipe, dan poin pelanggaran; penghapusan data master yang sudah memiliki histori dilakukan sebagai nonaktifkan agar histori tidak rusak.
13. Ketersediaan tugas absensi diturunkan dari jadwal aktif dan penugasan; petugas tidak mengelola state enable/disable sesi secara manual.
14. Satu petugas dapat memiliki multi-roster aktif; sistem memisahkan setiap roster sebagai tugas yang dapat dipilih tanpa mencampur data antar target.
15. Hak akses baca, input, edit, dan unduh harus ditentukan eksplisit per modul; tidak ada akses yang diasumsikan otomatis hanya dari nama jabatan.
16. Periode akademik memiliki status `Draft`, `Aktif`, dan `Ditutup`; periode yang ditutup menjadi read-only untuk role biasa.
17. Kenaikan kelas dan rollover periode dijalankan manual oleh Admin melalui preview dan penerapan terkonfirmasi; tidak ada perubahan assignment otomatis tanpa keputusan Admin.
18. Assignment lama ditutup berdasarkan periode dan assignment baru dibuat dengan tanggal efektif; histori lama tidak dioverwrite.
19. Kelas formal, kamar, PBS, PBM, dan Madin diproses sebagai assignment terpisah saat rollover.
20. Raport diterbitkan secara eksplisit, disimpan sebagai snapshot PDF immutable per santri/periode/versi, dan penerbitan ulang membuat versi baru.
21. Fitur yang belum tercantum pada dokumen ini dianggap **di luar scope rilis awal** sampai ada keputusan produk baru.

---

## 8. Definisi Selesai untuk Rilis Awal

Rilis awal dianggap memenuhi kebutuhan operasional bila:

1. enam modul absensi tampil sebagai enam entri operasional dan dapat diisi sesuai penugasan, dengan keberangkatan kelas dan kamar dibedakan jelas oleh sesi pagi/malam saat perangkat terhubung ke server;
2. izin keluar, catat gerbang, surat izin, dan sinkronisasi status `Izin` ke absensi berjalan stabil;
3. pelanggaran, poin, prestasi, raport pengajian, dan raport pembinaan dapat dicatat serta dibaca kembali sesuai role, dengan prestasi petugas terpusat di Admin;
4. Admin dapat menyelesaikan verifikasi data, penugasan, dan pemeliharaan referensi inti tanpa mengedit database langsung, sementara Pembina Kamar dapat melengkapi data operasional santri binaannya dalam scope penugasan;
5. wali santri dapat memantau data anak melalui portal tanpa bergantung pada akun petugas.
6. Admin dapat menutup periode, melakukan preview kenaikan kelas, menerapkan assignment periode baru, dan tetap membuka histori periode lama.
7. Raport yang diterbitkan memiliki arsip PDF per santri dengan periode, versi, actor penerbit, serta akses baca sesuai role.
