# Perilaku dan Kebutuhan UX per Role SIMANTEB

Dokumen ini melengkapi [prd.md](/home/akbarhann/project/tebuirengv2/docs/prd.md)
dan [desain.md](/home/akbarhann/project/tebuirengv2/docs/desain.md). PRD
menentukan apa yang boleh dilakukan setiap role. Dokumen ini menentukan bagaimana
pekerjaan itu seharusnya terasa dan berjalan bagi pengguna.

Dokumen ini bukan pengganti kontrak endpoint, permission backend, atau aturan
database. Jika ada perbedaan hak akses, PRD dan backend menjadi sumber kebenaran;
aturan di sini menjadi acuan urutan kerja, informasi yang ditampilkan, dan
perilaku UI.

---

## 1. Cara Membaca Dokumen Ini

Setiap role dijelaskan melalui lima pertanyaan:

1. Dalam kondisi apa role tersebut memakai aplikasi?
2. Keputusan apa yang sedang ingin dibuat pengguna?
3. Informasi minimum apa yang harus terlihat sebelum ia bertindak?
4. Bagaimana pengguna menyelesaikan pekerjaan dengan langkah sesedikit mungkin?
5. Apa yang harus terjadi jika data belum lengkap, gagal disimpan, atau salah?

SIMANTEB harus mengurangi tiga beban utama:

- **beban mencari**: pengguna tidak boleh mencari modul atau santri dari data
  global jika scope penugasannya sudah diketahui;
- **beban mengingat**: konteks tanggal, sesi, kelompok, kamar, dan penugasan
  harus tetap terlihat sepanjang pekerjaan;
- **beban memperbaiki**: kesalahan harus terlihat dekat dengan sumbernya dan
  dapat dikoreksi tanpa mengulang seluruh pekerjaan.

## 2. Kontrak Perilaku Lintas Role

### 2.1. Akses mengikuti penugasan aktif

- UI hanya menampilkan target, kelompok, kamar, kelas, dan aksi yang boleh
  digunakan role pada saat itu.
- Role tidak boleh melihat tombol yang selalu berakhir dengan pesan `403`.
- Admin dapat melihat seluruh scope operasional sesuai PRD.
- Pembina Kamar, Wali Kelas, dan Piket Pengajian bekerja dari penugasan aktif,
  bukan dari daftar seluruh target.

### 2.2. Satu konteks kerja harus bertahan

Saat pengguna membuka detail dari daftar, sistem mempertahankan:

- filter dan pencarian;
- tanggal dan semester;
- target kerja atau kelompok;
- posisi terakhir pada daftar;
- draft yang belum tersimpan.

Kembali ke daftar tidak boleh mengembalikan pengguna ke halaman awal tanpa
alasan.

### 2.3. Semua aksi memiliki hasil yang terbaca

Setelah aksi dilakukan, UI harus menjelaskan apa yang berubah, apakah perubahan
sudah tersimpan di server atau baru di perangkat, apakah ada baris yang gagal,
dan tindakan berikutnya yang paling masuk akal.

Toast singkat tidak cukup untuk aksi bulk, perubahan role, perubahan penempatan,
hapus data, atau verifikasi merge. Aksi tersebut membutuhkan ringkasan hasil.

### 2.4. Status tidak boleh hanya mengandalkan warna

Status harus memiliki teks, ikon atau bentuk, dan warna. Ini berlaku untuk
status absensi, penyimpanan server, kelengkapan data, izin, akun petugas, dan
verifikasi.

### 2.5. Pola komponen berdasarkan risiko

| Jenis pekerjaan | Pola utama | Alasan |
| --- | --- | --- |
| Absensi berulang | Ledger dengan aksi langsung | Mempercepat pengulangan dan mengurangi perpindahan layar |
| Lihat atau edit detail dari daftar | Drawer desktop, halaman penuh mobile | Konteks daftar tetap terlihat di desktop; ruang baca cukup di mobile |
| Form singkat | Modal atau bottom sheet | Fokus tetap dekat dengan konteks asal |
| Form panjang | Halaman terpisah atau wizard | Progress dan validasi lebih mudah dipahami |
| Penghapusan atau perubahan berdampak | Dialog konfirmasi dengan dampak | Mencegah keputusan impulsif |
| Verifikasi banyak item | Queue dengan `Simpan dan lanjut` | Mengurangi bolak-balik daftar-detail |

### 2.6. Histori absensi untuk role input

Wali Kelas, Pembina Kamar, dan Piket Pengajian harus dapat melihat histori
lengkap absensi santri yang berada dalam scope penugasannya. Histori bukan hanya
rekap dashboard; pengguna perlu melihat tanggal dan status per kejadian.

Alur bersama:

1. Dari roster, pengguna memilih santri atau membuka `Lihat histori`.
2. Sistem menampilkan histori dengan tanggal, jenis kegiatan, nama roster,
   sesi, status, keterangan, waktu input, dan status penyimpanan server.
3. Filter dapat dipersempit berdasarkan rentang tanggal, jenis kegiatan, roster,
   sesi, dan status.
4. Pengguna membuka satu catatan untuk melihat detail dan tombol `Edit` bila
   catatan masih berada dalam jendela edit.
5. Setelah perubahan disimpan, histori menampilkan status terbaru dan waktu
   perubahan.

Aturan edit:

- catatan dalam `durasi_edit_absensi_menit` dapat diedit oleh petugas yang
  memiliki scope target tersebut;
- catatan di luar jendela edit tetap terlihat tetapi read-only;
- jika koreksi lama diperlukan, tampilkan jalur `Minta koreksi ke Admin`;
- perubahan menyimpan audit siapa, kapan, status lama, dan status baru;
- histori tidak boleh berubah hanya karena pengguna mengubah filter roster.

---

## 3. Role Admin

### 3.1. Situasi kerja

Admin biasanya bekerja lebih lama di desktop dan berpindah dari satu sumber
masalah ke masalah lain. Admin tidak membutuhkan dashboard yang penuh angka,
melainkan peta pekerjaan yang belum selesai dan akses cepat untuk memperbaiki
data.

Admin sering datang dengan tujuan seperti:

- mencari santri yang belum siap dipakai untuk absensi;
- melengkapi atau mengoreksi data santri;
- membuat akun petugas dan menetapkan aksesnya;
- mengatur kamar, kelas formal, PBS, PBM, atau Madin;
- memasukkan prestasi;
- memastikan perubahan master tidak merusak roster yang sudah berjalan.

### 3.2. Dashboard Admin: mulai dari pekerjaan yang belum selesai

Dashboard Admin harus menampilkan queue prioritas, bukan hanya ringkasan jumlah.

Urutan default:

1. data santri yang menghambat operasional hari ini;
2. penugasan atau master yang belum lengkap;
3. hasil impor yang memerlukan keputusan;
4. izin atau kejadian yang memerlukan override;
5. shortcut ke pekerjaan master yang sering dipakai.

Setiap ringkasan harus dapat dibuka ke daftar yang sudah terfilter.

| Ringkasan | Hasil klik yang diharapkan |
| --- | --- |
| Santri belum memiliki kamar | Daftar santri dengan filter `kamar kosong` |
| Santri belum memiliki kelas formal | Daftar santri dengan filter `kelas kosong` |
| Nomor wali belum lengkap | Daftar santri dengan filter `nomor wali kosong` |
| Kelompok pengajian belum dipetakan | Daftar santri dengan filter kelompok terkait |
| Data perlu diverifikasi | Queue verifikasi pada tab dan prioritas yang sesuai |

Jangan memaksa Admin mengingat angka dari dashboard lalu mencarinya kembali di
Data Master.

### 3.3. Menemukan data santri yang belum lengkap

#### Tujuan pengguna

Admin ingin tahu data mana yang belum siap operasional, mengapa belum siap, dan
bagaimana memperbaikinya tanpa membuka setiap profil satu per satu.

#### Alur yang direkomendasikan

1. Admin membuka **Verifikasi Data** atau mengklik ringkasan masalah dari
   dashboard.
2. Sistem menampilkan queue dengan kolom `Santri`, `Masalah`, `Dampak`, `Sumber`,
   dan `Aksi berikutnya`.
3. Admin memfilter berdasarkan jenis kekurangan: identitas, kontak wali,
   penempatan, kelompok kegiatan, foto, atau ORDA.
4. Admin memilih satu santri untuk perbaikan detail atau beberapa santri untuk
   aksi massal yang aman.
5. Setelah disimpan, item hilang dari queue hanya jika validasi readiness sudah
   terpenuhi.

#### Kebutuhan UX

- tampilkan alasan spesifik, bukan label `Data belum lengkap`;
- bedakan data yang wajib untuk absensi dari data pelengkap;
- tampilkan sumber masalah jika berasal dari impor;
- tampilkan dampak, misalnya `Tidak muncul di roster kamar`;
- sediakan `Simpan dan lanjut berikutnya`;
- jumlah queue diperbarui tanpa kehilangan filter;
- jangan menganggap field terisi berarti data valid jika formatnya salah.

#### Empty dan error state

- jika tidak ada masalah: `Semua data pada filter ini siap digunakan`;
- jika filter tidak menemukan hasil: tampilkan filter aktif dan tombol `Reset
  filter`;
- jika validasi gagal: pertahankan seluruh input dan fokuskan field yang salah;
- jika konflik dengan data lain: tampilkan data pembanding dan pilihan koreksi.

### 3.4. Menambahkan data santri secara lengkap

Admin ingin membuat satu data santri baru tanpa form yang membingungkan, tetapi
juga tidak ingin santri masuk ke roster dengan data penting yang hilang.

Gunakan progressive disclosure dalam urutan berikut:

1. **Identitas utama**: nama, nomor induk, status aktif, dan identitas wajib.
2. **Penempatan operasional**: kamar, kelas formal, Madin, PBS, PBM, dan status
   partisipasi kegiatan.
3. **Keluarga dan wali**: nomor wali, relasi, dan kontak yang akan dipakai.
4. **Data pendukung**: foto, domisili, ORDA, ekstrakurikuler, dan pelengkap.
5. **Ringkasan kesiapan**: apa yang siap dan apa yang masih kurang.

Perilaku form:

- nomor induk diverifikasi saat blur atau sebelum lanjut;
- field kelompok hanya muncul jika partisipasinya bukan `tidak_ikut`;
- pilihan kamar, kelas, dan kelompok menampilkan status aktif atau kapasitas
  bila tersedia;
- jika nomor induk membuat akun wali, jelaskan konsekuensinya sebelum simpan;
- Admin tidak harus mengisi semua data pelengkap sebelum data minimal
  operasional disimpan;
- setelah berhasil, tawarkan `Lengkapi data`, `Atur penempatan`, dan `Lihat
  profil`.

### 3.5. Mengedit data santri

1. Admin mencari dengan nama, nomor induk, kamar, kelas, atau kelompok.
2. Hasil menampilkan status aktif dan indikator kelengkapan.
3. Admin membuka detail santri dalam section identitas, penempatan, keluarga,
   kegiatan, dan histori perubahan.
4. Admin mengedit hanya section yang diperlukan.
5. UI menampilkan ringkasan perubahan sebelum simpan untuk penempatan, status
   aktif, nomor induk, dan kontak wali.
6. Setelah simpan, Admin tetap berada pada profil dan melihat perubahan terakhir.

Perlindungan dari kesalahan:

- perubahan penempatan menjelaskan dampaknya pada roster dan penugasan;
- perubahan nomor induk menjelaskan dampaknya pada akun wali;
- nonaktifkan atau hapus tidak boleh menjadi aksi yang sama dengan edit;
- perubahan dari impor memperlihatkan nilai lama dan baru;
- histori perubahan penting tersedia untuk audit Admin.

### 3.6. Menambahkan petugas dan memberikan role

Admin ingin membuat akun yang langsung dapat digunakan petugas yang tepat,
tanpa salah memberikan akses terlalu luas atau lupa mengatur penugasan.

Gunakan alur dua tahap:

1. **Buat identitas petugas**: nama, username atau identitas login, nomor
   telepon bila diperlukan, dan status aktif.
2. **Tetapkan role dan scope kerja**: role resmi, target penugasan, periode
   aktif, dan kewajiban ganti password.

Role menjawab “jenis kewenangan apa”, sedangkan penugasan menjawab “target mana
yang boleh dikerjakan”.

Aturan scope:

- Wali Kelas: kelas formal;
- Pembina Kamar: kamar;
- Piket Pengajian: PBS, PBM, atau Madin;
- Keamanan: akses operasional keamanan sesuai kontrak;
- Admin: akses global tanpa penugasan target.

Perilaku UX:

- pilihan role hanya menampilkan role resmi PRD;
- setelah role dipilih, pilihan scope otomatis dibatasi;
- Admin dapat memilih lebih dari satu target roster untuk Pembina Kamar atau
  Piket Pengajian dalam satu assignment, selama tidak ada konflik penugasan;
- preview assignment menampilkan seluruh roster, jadwal, sesi, dan periode aktif
  yang akan diterima petugas;
- tampilkan preview akses sebelum akun dibuat;
- cegah penugasan bentrok atau duplikat sebelum submit;
- kredensial awal ditampilkan sekali dengan instruksi ganti password;
- Admin dapat menonaktifkan akun tanpa menghapus histori;
- perubahan role membutuhkan ringkasan dampak dan konfirmasi eksplisit.

Setelah akun dibuat, Admin melihat status akun, role, target penugasan, periode
akses, dan status kewajiban ganti password.

### 3.7. Mengelola data kamar

#### Tambah kamar

- form berisi nama/kode kamar, kategori atau wilayah, status aktif, dan
  keterangan bila diperlukan;
- kode kamar divalidasi unik sebelum simpan;
- setelah berhasil, tawarkan `Tugaskan pembina` atau `Lihat santri`.

#### Edit kamar

- perubahan nama atau kode menampilkan dampak terhadap mapping impor dan laporan;
- perubahan status aktif menjelaskan bahwa kamar tidak muncul sebagai target baru,
  tetapi histori tetap dipertahankan;
- daftar santri terdampak dapat dilihat sebelum perubahan disimpan.

#### Hapus atau nonaktifkan kamar

- gunakan **nonaktifkan** sebagai default jika kamar pernah dipakai;
- hapus permanen hanya jika tidak memiliki santri, penugasan, absensi, raport,
  atau referensi lain;
- dialog menyebut jumlah data yang terdampak;
- jangan memakai kata `Hapus` jika operasi sebenarnya `Nonaktifkan`.

### 3.8. Mengelola kelas formal, PBS, PBM, dan Madin

Keempat master memiliki pola interaksi sama, tetapi label dan target roster
harus tetap spesifik. Pengguna tidak boleh merasa semua kelompok adalah hal yang
sama.

#### Tambah dan edit

1. Admin memilih jenis master: kelas formal, PBS, PBM, atau Madin.
2. Admin mengisi nama/kode, periode atau tahun ajaran, status aktif, dan
   pengelompokan yang diperlukan.
3. Admin melihat preview target yang akan muncul pada absensi.
4. Admin menyimpan lalu dapat mengatur anggota atau penugasan.

Perubahan nama, kode, atau periode harus menampilkan target menu dan laporan yang
terdampak. Periode baru tidak boleh mengubah histori periode sebelumnya.

#### Hapus atau nonaktifkan

- master yang sudah memiliki histori tidak dihapus permanen;
- gunakan nonaktifkan agar tidak muncul sebagai pilihan baru;
- jika belum pernah dipakai, UI boleh menawarkan hapus dengan konfirmasi;
- konfirmasi menyebut anggota, penugasan, absensi, atau raport yang terdampak.

#### Pengelolaan anggota

- dukung pencarian dan filter, bukan hanya checkbox panjang tanpa pencarian;
- tampilkan perubahan anggota sebagai ringkasan sebelum simpan;
- jangan menghapus anggota dari histori absensi atau raport lama;
- setelah mapping, Admin dapat melihat santri yang masih belum memiliki
  kelompok wajib.

### 3.9. Mencatat prestasi santri

Prestasi hanya tersedia untuk Admin pada pengalaman petugas internal.

1. Admin mencari santri dengan nama atau nomor induk.
2. Profil ringkas ditampilkan agar Admin tidak salah memilih nama.
3. Admin mengisi nama prestasi, tingkat, peringkat, tanggal, dan keterangan.
4. Ringkasan ditampilkan sebelum simpan.
5. Setelah berhasil, prestasi muncul pada histori santri dan portal wali secara
   read-only sesuai PRD.

Pencarian harus menampilkan identitas pembeda, bukan nama saja. Hapus prestasi
memerlukan konfirmasi yang menyebut nama santri dan prestasi. Rilis awal
mengikuti PRD: lihat, tambah, dan hapus; jangan menampilkan aksi edit jika
endpoint edit belum menjadi scope.

### 3.10. Laporan dan pekerjaan lintas modul

Admin memerlukan filter yang dapat dibawa dari masalah ke laporan:

- kehadiran berdasarkan modul, target, sesi, tanggal, dan status;
- izin berdasarkan status dan rentang waktu;
- pelanggaran berdasarkan kategori, poin, dan santri;
- prestasi berdasarkan tingkat dan rentang waktu;
- ekspor menampilkan parameter yang dipakai agar hasil dapat dipertanggung-
  jawabkan.

---

## 4. Role Keamanan

Keamanan bekerja di gerbang, sering berdiri dan berpindah perhatian. UI harus
mendukung pencarian cepat serta mencegah salah mencatat orang atau waktu.

### 4.1. Membuat izin

1. Keamanan mencari santri dengan nama atau nomor induk.
2. Sistem menampilkan identitas, kamar, kelas, dan izin aktif yang bentrok.
3. Keamanan memilih jenis izin, tujuan, waktu rencana kembali, dan keterangan.
4. Sistem menampilkan ringkasan sebelum simpan.
5. Setelah berhasil, status langsung terlihat sebagai `Disetujui` sesuai rilis.

Nama santri dan penempatan menjadi pembeda utama. `rencana_kembali` harus mudah
dibaca dan tidak tertukar dengan waktu dibuat. PDF menjadi aksi sekunder setelah
izin tersimpan.

### 4.2. Mencatat keluar dan kembali

- halaman utama menampilkan izin `Disetujui` dan `Sedang Berjalan`;
- pencarian nama tetap tersedia di atas daftar;
- `Catat keluar` mengubah status ke `Sedang Berjalan` dan menampilkan waktu aktual;
- `Catat kembali` mengubah status ke `Selesai` dan menampilkan waktu aktual;
- jika nama mirip, tampilkan kamar atau kelas sebelum konfirmasi;
- koreksi waktu membutuhkan alasan dan menampilkan histori koreksi;
- setelah berhasil, baris tetap terlihat dengan status baru.

### 4.3. Mencatat pelanggaran

Keamanan hanya melihat kategori `Sedang` dan `Berat` sesuai PRD.

- mulai dari pencarian santri;
- tampilkan total poin saat ini sebelum kategori dipilih;
- kategori, poin, bukti, dan catatan dikelompokkan berdasarkan keputusan;
- jika melewati ambang notifikasi, jelaskan bahwa notifikasi internal dibuat;
- setelah simpan, tampilkan catatan dan total poin terbaru.

Jika jaringan putus, jangan menampilkan seolah izin sudah tersimpan di server.
Jika izin bentrok, pertahankan form dan arahkan ke izin yang bentrok.

### 4.4. Mengelola master pelanggaran

Keamanan juga mengelola referensi yang dipakai saat mencatat pelanggaran:

- menambahkan nama pelanggaran;
- menentukan tipe pelanggaran, seperti `Ringan`, `Sedang`, atau `Berat`;
- menentukan poin pelanggaran;
- mengedit nama, tipe, atau poin untuk input berikutnya;
- menonaktifkan atau menghapus master yang belum memiliki histori.

Alur yang aman:

1. Keamanan membuka **Master Pelanggaran** dari kelompok Kedisiplinan.
2. Daftar menampilkan nama, tipe, poin, status aktif, dan jumlah histori yang
   menggunakan master tersebut.
3. Saat menambah atau mengedit, form menampilkan preview dampak pada input baru.
4. Jika master sudah dipakai, aksi utama berubah dari `Hapus` menjadi
   `Nonaktifkan` agar histori lama tetap dapat dibaca.
5. Perubahan poin hanya berlaku untuk pencatatan baru; poin pada histori lama
   tidak dihitung ulang secara diam-diam.

Nama, tipe, dan poin harus tervalidasi dekat dengan field. Tipe tidak boleh
diganti jika perubahan itu membuat histori lama kehilangan makna tanpa workflow
koreksi yang jelas.

---

## 5. Role Pembina Kamar

Pembina Kamar berpindah antara tugas pagi, tugas malam, pembinaan, pelanggaran
ringan, dan kelengkapan data. Kesalahan terbesar yang harus dicegah adalah
tertukarnya konteks pagi dan malam atau kamar yang berbeda.

### 5.1. Keberangkatan kelas dan absensi kamar

- dashboard memisahkan `Keberangkatan Kelas — Sesi Pagi` dan `Kamar — Sesi
  Malam`;
- nama kamar dan jumlah santri selalu terlihat di header roster;
- sesi tidak boleh hanya dibedakan dengan warna;
- roster dimulai dari kamar yang sedang ditugaskan;
- setelah simpan, ringkasan status ditampilkan;
- status penyimpanan server terlihat tanpa menutupi nama santri.

Pembina tidak mengaktifkan atau menonaktifkan sesi. Sistem menampilkan tugas
berdasarkan jadwal dan penugasan aktif:

- pada waktu pagi, tampilkan **Keberangkatan Kelas** dan kamar yang ditugaskan;
- pada waktu malam, tampilkan **Kamar** dan kamar yang ditugaskan;
- setiap tugas menyebut sesi, tanggal, nama kamar, jumlah roster, dan status
  pengerjaan;
- jika belum waktunya, tugas boleh terlihat sebagai jadwal berikutnya tetapi
  tombol input belum menjadi aksi utama;
- jika waktu sudah lewat, tampilkan sebagai terlambat atau riwayat sesuai
  aturan backend, bukan menghilangkannya tanpa penjelasan.

Jika Pembina ditugaskan ke beberapa kamar, dashboard mengelompokkan tugas
berdasarkan waktu dan menampilkan satu tugas per kamar. Pembina dapat melihat
`Sekarang`, `Berikutnya`, dan `Selesai hari ini`, tetapi tetap membuka satu
roster saja dalam satu waktu. Header ledger selalu mengulang nama kamar, sesi,
tanggal, dan jumlah santri untuk mencegah perpindahan roster yang salah.

Pembina juga dapat membuka histori lengkap setiap santri di kamar yang menjadi
scope-nya. Dari histori tersebut Pembina dapat mengedit status dan keterangan
yang masih berada dalam jendela edit; catatan lama di luar jendela tetap dapat
dibaca dan menyediakan jalur koreksi ke Admin.

### 5.2. Raport Pembinaan

- Pembina memilih kamar dan bulan, bukan mencari seluruh santri;
- instrumen tampil konsisten per baris;
- nilai dan catatan tidak hilang saat berpindah baris;
- nilai invalid ditandai pada baris yang sama;
- `Simpan dan lanjut` mempertahankan kamar, bulan, dan posisi terakhir;
- PDF, histori nilai, dan arsip dokumen menjadi aksi setelah input;
- arsip yang sudah diterbitkan bersifat read-only; koreksi menghasilkan versi
  dokumen baru dan tidak menghapus versi sebelumnya.

### 5.3. Melengkapi data santri binaan

Pembina Kamar hanya dapat melengkapi santri dalam scope penugasan aktif.

- dashboard menampilkan daftar data santri yang perlu dilengkapi;
- item menjelaskan field yang kurang, misalnya foto, nomor wali, atau penempatan;
- Pembina dapat membuka profil santri binaan dalam mode lihat untuk memahami data
  identitas, penempatan, kontak wali, dan kelengkapan operasional;
- form menampilkan field operasional lebih dahulu;
- field di luar scope disembunyikan atau read-only;
- bagian foto menyediakan aksi `Tambah foto` atau `Ganti foto`, dengan preview
  sebelum simpan dan penjelasan format/ukuran file yang diterima;
- setelah foto berhasil disimpan, profil menampilkan foto terbaru dan waktu ubah;
- setelah simpan, Pembina melihat progres kelengkapan kamar;
- perubahan yang memengaruhi mapping global masuk queue verifikasi atau
  memerlukan Admin sesuai aturan backend.

Alur yang disarankan:

1. Pembina membuka kamar atau tugas `Data santri perlu dilengkapi`.
2. Pembina memilih santri untuk melihat profil ringkas dan daftar field yang
   masih kurang.
3. Pembina menambahkan foto dari kamera atau galeri perangkat, lalu memeriksa
   preview sebelum menyimpan.
4. Sistem memvalidasi file dan mempertahankan foto lama sampai foto baru
   berhasil tersimpan.
5. Profil dan daftar kamar memperbarui indikator kelengkapan tanpa menghapus
   draft field lain.

Pembina tidak dapat membuka atau mengedit santri di luar kamar yang ditugaskan.
Jika foto gagal dikirim, foto lama tetap digunakan, input foto baru dipertahankan
selama halaman masih terbuka, dan pengguna dapat menekan `Coba lagi` tanpa
mengulang pemilihan foto.

### 5.4. Pelanggaran ringan

- pencarian dibatasi pada santri binaan;
- kategori hanya `Ringan`;
- total poin terlihat sebelum simpan;
- setelah berhasil, Pembina melihat histori singkat tanpa membuka konsol penuh.

Jika kamar tidak lagi ditugaskan, jelaskan alasan akses tidak tersedia dan jangan
membuang draft yang belum tersimpan. Jika koneksi gagal, tampilkan error dan
pertahankan input selama halaman masih terbuka.

---

## 6. Role Wali Kelas

Wali Kelas terutama mengabsen kelas formal pada waktu tertentu dan melihat
rekap. Mereka tidak membutuhkan konsol administrasi atau menu raport pengajian.

### 6.1. Absensi kelas formal

- kelas formal yang aktif menjadi pilihan pertama;
- jika ada lebih dari satu kelas, tampilkan jadwal dan nama kelas;
- roster memakai ledger yang sama dengan modul lain;
- simpan dan status penyimpanan server dekat dengan roster;
- status yang berasal dari izin diberi penjelasan dan tidak ditimpa diam-diam;
- koreksi hanya tersedia dalam batas waktu backend.

Wali Kelas dapat membuka histori lengkap santri pada kelas formal yang ditugaskan,
termasuk tanggal sebelumnya. Setiap baris menampilkan status editability; baris
yang masih dalam jendela edit dapat dikoreksi tanpa keluar dari histori, sedangkan
baris lama menjadi read-only dan dapat dieskalasikan ke Admin.

### 6.2. Rekap kelas

- default ke kelas dan tanggal terbaru;
- ringkasan status terlihat sebelum tabel detail;
- filter tidak boleh membuka kelas lain;
- jika belum ada absensi, tampilkan jadwal dan aksi `Mulai absensi`;
- jika jadwal belum tersedia, jelaskan bahwa Admin perlu melengkapi penugasan.

---

## 7. Role Piket Pengajian

Piket Pengajian mengelola PBS, PBM, dan Madin. Risiko utamanya adalah kelompok
atau jenis pengajian tertukar saat beberapa sesi berlangsung berdekatan.

### 7.1. Absensi PBS, PBM, dan Madin

- dashboard memisahkan jenis kegiatan sebagai tujuan yang jelas;
- setiap roster menampilkan jenis, kelompok, jadwal, dan periode pada header;
- penugasan aktif menjadi filter awal;
- kelompok kosong atau tidak aktif tidak muncul sebagai pilihan normal;
- setelah menyimpan satu roster, pengguna dapat melanjutkan ke kelompok berikutnya;
- ringkasan selesai menyebut nama kegiatan dan kelompok.

Piket Pengajian tidak mengatur state enable/disable absensi. Sistem otomatis
menyediakan tugas yang sesuai dengan jadwal dan assignment aktif:

- pada jam pagi, tampilkan jenis kegiatan yang memang dijadwalkan, misalnya
  **PBS**, beserta kelompok dan roster yang ditugaskan;
- setiap kartu atau baris tugas menjelaskan jenis kegiatan, nama kelompok,
  jadwal, tanggal, jumlah santri, dan status pengerjaan;
- tugas yang belum dimulai dapat dilihat sebagai jadwal berikutnya, tetapi tidak
  boleh membuat Piket salah mengira bahwa roster sudah harus diisi;
- setelah tugas dipilih, header ledger mengulang konteks lengkap agar PBS, PBM,
  dan Madin tidak tertukar;
- setelah selesai, status tugas berubah dari perlu dikerjakan menjadi tersimpan
  setelah server mengonfirmasi.

Jika Piket ditugaskan ke beberapa roster, dashboard memisahkan tugas per jenis
kegiatan dan kelompok. Pada waktu absensi berjalan, tugas yang paling relevan
ditandai sebagai `Sekarang`; tugas lain tetap terlihat sebagai `Berikutnya` atau
`Selesai hari ini`. Piket tidak perlu menebak roster dari daftar santri global.

Piket dapat membuka histori lengkap santri pada kelompok PBS, PBM, atau Madin
yang menjadi scope assignment. Histori menampilkan tanggal dan roster asal,
sehingga status pada kelompok berbeda tidak tertukar. Catatan yang masih dapat
diedit memiliki aksi `Edit`; catatan lama tetap terbaca dan menggunakan jalur
koreksi Admin.

### 7.2. Raport Pengajian

- pilih jenis raport dan kelompok terlebih dahulu;
- bulan, tahun pelajaran, dan semester terlihat sebelum entry;
- aspek penilaian fixed tampil sebagai header stabil;
- bulk input mempertahankan posisi baris dan menandai santri belum dinilai;
- nilai invalid menyebut rentang atau format yang benar;
- mode cari nama tetap membatasi hasil pada kelompok yang boleh diakses.
- Piket dapat membuka histori raport per santri berdasarkan tahun pelajaran,
  semester, bulan, dan versi dokumen yang diterbitkan.

PBS, PBM, dan Madin tidak boleh dibedakan hanya dengan warna. Jika santri tidak
ikut kegiatan, jelaskan mengapa ia tidak ada di roster. Jika periode raport
terkunci, form menjadi read-only dengan alasan yang jelas.

---

## 8. Role Wali Santri

Wali Santri datang tidak sesering petugas dan biasanya memakai HP. Mereka ingin
menjawab: anak saya di mana, bagaimana kehadirannya, apa catatan pentingnya,
dan apakah ada perkembangan.

Portal wali adalah ruang baca. Jangan memberi kontrol yang terlihat seperti bisa
mengubah data operasional.

### 8.1. Prioritas informasi

1. identitas anak dan penempatan;
2. perubahan atau catatan terbaru;
3. kehadiran;
4. perizinan;
5. pelanggaran;
6. raport pengajian;
7. prestasi.

### 8.2. Kebutuhan UX

- identitas anak tetap terlihat saat membaca detail;
- bahasa dapat dipahami wali dan singkatan PBS/PBM/Madin diberi konteks;
- rentang waktu dan semester terlihat pada histori;
- status izin tidak ambigu;
- PDF dapat dibuka dari halaman yang sedang dibaca;
- histori raport menampilkan periode, versi, waktu terbit, dan status dokumen;
- dokumen raport yang sudah diterbitkan dapat diunduh tanpa mengubah nilai
  raport aktif;
- empty state menjelaskan apakah memang belum ada catatan atau data belum
  tersedia;
- portal tidak menampilkan Data Master, Verifikasi, atau aksi petugas;
- perubahan password menjadi satu-satunya pengaturan utama pada scope awal.

Jika data belum tersedia, gunakan penjelasan yang tidak menyalahkan wali dan
tampilkan waktu pembaruan terakhir bila relevan.

---

## 9. Queue, Notifikasi, dan Prioritas Perhatian

Notifikasi bukan pengganti desain queue. Setiap notifikasi harus membawa
pengguna ke konteks yang bisa ditindaklanjuti.

| Peristiwa | Penerima utama | Tujuan setelah dibuka |
| --- | --- | --- |
| Data santri belum siap operasional | Admin, Pembina Kamar sesuai scope | Field atau queue yang harus dilengkapi |
| Sesi absensi akan dimulai | Petugas yang ditugaskan | Roster kegiatan dan sesi terkait |
| Izin melewati waktu kembali | Keamanan, Admin | Daftar izin overdue dan aksi gerbang |
| Ambang poin terlewati | Keamanan, Admin | Profil santri dan histori poin |
| Hasil impor butuh keputusan | Admin | Review merge, separate, atau mapping |

Aturan:

- notifikasi menyebut objek, alasan, dan aksi;
- badge hanya menunjukkan pekerjaan yang masih terbuka;
- membuka notifikasi tidak otomatis menandai selesai jika tindakan belum dibuat;
- queue mempertahankan filter dan fokus setelah satu item diselesaikan;
- pekerjaan berisiko tinggi meminta konfirmasi sebelum perubahan final.

## 10. Checklist UX untuk Implementasi Setiap Role

- pengguna melihat target yang benar tanpa mencari dari direktori global;
- role, penugasan, tanggal, sesi, dan periode tampil pada konteks yang sama;
- aksi utama bisa dilakukan tanpa berpindah halaman berulang kali;
- draft dan filter tidak hilang saat validasi atau navigasi;
- hasil simpan membedakan server, perangkat, dan baris yang gagal;
- data kosong menjelaskan alasan dan langkah berikutnya;
- hapus, nonaktifkan, merge, dan perubahan penempatan menyebut dampaknya;
- mobile memakai bottom navbar maksimal lima tab dan menyembunyikannya pada
  layar kerja fokus;
- desktop memakai side menu yang hanya menampilkan akses role aktif;
- istilah UI mengikuti nama resmi PRD, terutama `Raport Pembinaan`,
  `Keberangkatan Kelas`, dan `Piket Pengajian`.

## 11. Keputusan UX Utama

SIMANTEB harus mengarahkan setiap role langsung ke pekerjaan yang menjadi
tanggung jawabnya. Gunakan queue dan shortcut untuk pekerjaan yang belum selesai,
ledger untuk input berulang, drawer untuk edit cepat di desktop, halaman penuh
untuk form panjang, dan konfirmasi berbasis dampak untuk perubahan yang dapat
merusak roster atau histori.

Keputusan defaultnya adalah: **role menentukan scope, penugasan menentukan
target, konteks tetap terlihat, dan setiap aksi harus meninggalkan bukti hasil
yang dapat dipercaya.**
