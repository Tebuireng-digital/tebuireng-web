# Definition of Done (DoD) - Fitur Koreksi Data Pelanggaran

Dokumen ini mendefinisikan kriteria selesai (*Acceptance Criteria & Definition of Done*) untuk implementasi fitur **Koreksi Data Pelanggaran** oleh role **Keamanan** dan **Admin** pada SIMANTEB v3.

---

## 1. Aturan Bisnis & Otorisasi (Backend Security)

- [ ] **Ownership Guardrail:**
  - Petugas Keamanan hanya dapat mengoreksi data pelanggaran yang dicatat oleh akunnya sendiri (`petugas_pencatat_id === current_user->petugas_id`).
  - Percobaan koreksi terhadap data milik petugas lain oleh Keamanan harus mengembalikan respons `403 Forbidden`.
- [ ] **Grace Period Guardrail (Batas Waktu 24 Jam):**
  - Petugas Keamanan hanya dapat mengoreksi data pelanggaran dalam jangka waktu maksimal **24 jam** sejak record dibuat (`created_at`).
  - Setelah melewati 24 jam, percobaan koreksi oleh Keamanan harus ditolak oleh backend dengan pesan yang jelas (HTTP `403 Forbidden`).
- [ ] **Admin Global Override:**
  - Role `Admin` dapat melakukan koreksi terhadap catatan pelanggaran apa pun tanpa terikat batasan 24 jam maupun batasan pemilik catatan.
- [ ] **Audit Trail Wajib:**
  - Setiap request koreksi wajib menyertakan payload `alasan_koreksi` (minimal 5 karakter).
  - Database mencatat:
    - `diubah_oleh_petugas_id` (ID petugas yang melakukan koreksi).
    - `alasan_koreksi` (alasan mengapa data diubah).
    - `waktu_koreksi` (timestamp saat perubahan disimpan).
    - `jumlah_koreksi` (penambahan counter modifikasi).

---

## 2. Kontrak Endpoint & Data (Backend API)

- [ ] Endpoint `PATCH /api/pelanggaran/{id}` tersedia dan dilindungi middleware `auth` serta `role:Admin,Keamanan`.
- [ ] Validasi input ketat:
  - `santri_id`: wajib, integer valid di tabel `santri`.
  - `kategori_pelanggaran_id`: wajib, integer valid di tabel `kategori_pelanggaran`.
  - `tanggal`: wajib, format tanggal valid, tidak boleh tanggal masa depan.
  - `keterangan`: string/teks uraian kejadian.
  - `alasan_koreksi`: wajib diisi, string minimal 5 karakter.
- [ ] Poin pelanggaran disinkronisasi ulang otomatis sesuai `poin_maks` dari master kategori pelanggaran yang dipilih.
- [ ] Endpoint `GET /api/pelanggaran` menyertakan atribut `can_edit` (boolean) untuk mempermudah frontend menentukan apakah baris tersebut dapat dikoreksi oleh user yang aktif.

---

## 3. Desain & Pengalaman Pengguna (Frontend UI/UX)

- [ ] **Tabel Daftar Pelanggaran:**
  - Kolom **Aksi** menampilkan tombol **"Koreksi"** jika baris data memiliki `can_edit === true`.
  - Jika data milik user tetapi sudah melewati 24 jam, tombol tampil dalam keadaan nonaktif (*disabled*) dengan tooltip: *"Data telah terkunci (>24 jam). Hubungi Admin untuk koreksi."*
  - Baris data yang pernah dikoreksi menampilkan tanda/badge status halus `(Terkoreksi)` tanpa merusak estetika tabel.
- [ ] **Modal / Form Koreksi:**
  - Menampilkan ringkasan data sebelum dikoreksi.
  - Form terisi otomatis dengan nilai awal (pre-filled).
  - Input field wajib untuk **Alasan Koreksi**.
  - Mengikuti pedoman desain anti-AI slop: layout bersih, border halus, warna netral solid, tanpa dekorasi berlebihan.
- [ ] **Feedback Notifikasi:**
  - Saat koreksi berhasil disimpan, modal tertutup dan muncul **Toast notifikasi di pojok kanan atas** (warna latar hitam, teks putih, ikon ceklis) bertuliskan:
    `✓ Perubahan data berhasil dikoreksi`
  - Data tabel otomatis diperbarui tanpa perlu memuat ulang halaman (*full page reload*).

---

## 4. Kualitas Kode & Pengujian

- [ ] Migrasi database berhasil dijalankan tanpa error dan rollback terdefinisi dengan aman.
- [ ] Build frontend berjalan bersih tanpa error: `npm --prefix frontend run build` exit code 0.
- [ ] Seluruh endpoint backend yang diperbarui lolos pengujian otorisasi (Role Admin, Keamanan penginput, Keamanan non-penginput, dan role lain seperti Pembina Kamar/Wali Kelas).

---

# Definition of Done (DoD) - Fitur Input Raport Pembinaan

Dokumen ini mendefinisikan kriteria selesai (*Acceptance Criteria & Definition of Done*) untuk implementasi peningkatan UI/UX, ergonomi input massal, dan perbaikan logika kalkulasi pada modul **Input Raport Pembinaan** di SIMANTEB v3.

---

## 1. Ergonomi & Pengalaman Pengguna (UI/UX)

- [x] **Tersedia Dua Mode Tampilan (View Switcher):**
  - **Mode Tabel Matriks (Default / Rekomendasi):** Seluruh santri dalam 1 kamar dan 10 kriteria evaluasi tersaji dalam satu lembar kerja tabel ringkas tanpa memerlukan klik expand/collapse per santri.
  - **Mode Kartu Santri (Fokus):** Opsi tampilan kartu individual untuk kenyamanan input di layar sentuh atau smartphone.
- [x] **Navigasi Keyboard Cepat:**
  - Pengguna dapat berpindah input field menggunakan tombol keyboard (`Enter` atau `Panah Bawah` untuk turun ke santri berikutnya pada kriteria yang sama, `Tab` untuk bergeser ke kriteria berikutnya, `Panah Atas` untuk santri sebelumnya).
- [x] **Pembersihan Kontrol Input Nilai:**
  - Spinner tombol bawaan browser (`▲▼`) dihilangkan pada input angka nilai agar angka tidak terhimpit.
  - Event scroll wheel mouse pada kotak input dinonaktifkan sehingga scroll halaman tidak mengubah nilai secara tidak sengaja.
- [x] **Fitur Isi Cepat (Quick Fill / Nilai Standar):**
  - Pembina dapat mengisi nilai standar (contoh: 80 / Baik) ke seluruh kriteria santri terpilih atau seluruh kamar sekaligus dengan satu tombol konfirmasi cepat.
- [x] **Sticky Action Bar:**
  - Tombol aksi utama (*Simpan Raport Pembinaan*, *Download PDF*, dan ringkasan progres santri lengkap) selalu terlihat melayang di bagian bawah layar tanpa perlu scroll ke ujung baris ke-21.

---

## 2. Integritas Logika & Validasi Data

- [x] **Kalkulasi Rata-rata yang Akurat:**
  - Rata-rata akhir dan predikat hanya dihitung/ditampilkan secara final apabila seluruh kriteria instrumen aktif telah terisi lengkap.
  - Santri yang baru diisi sebagian menampilkan indikator progres pengisian (contoh: `1/10 kriteria`) dengan status netral (*Belum Lengkap*), bukan langsung diberi predikat E atau ranking prematur.
- [x] **Peringkat Kamar yang Valid:**
  - Peringkat hanya diperhitungkan di antara santri yang sudah berstatus lengkap, sehingga santri yang baru diuji coba 1 nilai tidak melompat menjadi peringkat 1/21.
- [x] **Validasi Rentang Angka Ketat:**
  - Input hanya menerima bilangan bulat antara `0` s/d `100`.
  - Nilai di luar batas `0-100` dicegah dan diberi umpan balik visual jelas (border error merah).

---

## 3. Kualitas Kode, Desain Anti-Slop, & Build

- [x] **Pematuhan Panduan Desain SIMANTEB:**
  - Mengikuti aturan anti-AI design slop: warna solid netral, hierarki tipografi jelas, border halus, tanpa background gradient mencolok atau floating cards berlebihan.
- [x] **Freeze Kolom Ganda (No & Nama Santri):**
  - Kolom "No" (`left: 0`) dan "Nama Santri" (`left: 40px`) tetap terkunci (*frozen / sticky*) saat tabel discroll ke samping (horizontal), menjaga konteks identitas santri saat mengisi kriteria di ujung kanan.
- [x] **Penyederhanaan Catatan (1 Catatan per Santri):**
  - Catatan pembina disederhanakan menjadi 1 catatan evaluasi umum per santri, bukan lagi 10 catatan per metrik. Input langsung tersedia di baris tabel (mode matriks) dan di bawah formulir nilai (mode kartu), tanpa memerlukan popup modal terpisah.
- [x] **Container Lebar Penuh (Mepet Sidemenu):**
  - Layout halaman diperluas selebar layar konten (`max-width: 100%`) mepet dengan menu sidebar untuk memaksimalkan area tampilan kolom kriteria dan meminimalkan scrollbar horizontal pada desktop.
- [x] **Verifikasi Build:**
  - Perintah `npm --prefix frontend run build` selesai dengan exit code 0 tanpa peringatan TypeScript atau syntax error.

---

# Definition of Done (DoD) - Sistem Draft & Kunci Raport (Pembinaan & Pengajian)

Dokumen ini mendefinisikan kriteria selesai (*Acceptance Criteria & Definition of Done*) untuk implementasi **Sistem Siklus Hidup Raport (Draft, Kunci Nilai, dan Arsip Dokumen)** pada modul Raport Pembinaan (Ubudiyah) dan Raport Pengajian di SIMANTEB v3.

---

## 1. Aturan Bisnis & Lifecycle Status (Backend Security)

- [x] **Status Default (Draft by Default):**
  - Setiap periode raport kamar/kelompok baru otomatis berstatus `draft`.
  - Pembina bebas mencicil nilai dan menekan tombol *Simpan Perubahan* berkali-kali tanpa batasan (*idempotent bulk upsert*).
- [x] **Syarat Penguncian (100% Completeness Guardrail):**
  - Raport kamar/kelompok HANYA dapat dikunci jika 100% santri aktif dan seluruh instrumen evaluasi aktif telah terisi lengkap.
  - Percobaan penguncian raport yang belum 100% lengkap ditolak oleh backend dengan respons HTTP `422 Unprocessable Content` disertai rincian santri/kriteria yang belum lengkap.
- [x] **Pencegahan Mutasi Setelah Dikunci (Lock Protection):**
  - Setelah berstatus `dikunci`, endpoint penyimpanan (`bulkUpsert`) menolak modifikasi data dari role non-Admin (HTTP `422/403`).
  - Seluruh input nilai pada antarmuka web beralih menjadi *read-only* (dinonaktifkan).
- [x] **Hak Akses & Audit Pembukaan Kunci (Unlock Exception):**
  - Pembukaan kunci hanya dapat dilakukan oleh role `Admin` atau oleh Pembina yang menyertakan catatan alasan pembukaan kunci tertulis.
  - Database mencatat audit: `alasan_buka_kunci`, `dibuka_oleh_petugas_id`, dan timestamp pembukaan.
- [x] **Pemisahan Dokumen Draft vs Resmi:**
  - Penguncian raport secara otomatis membekukan data snapshot dan menerbitkan arsip PDF resmi di tabel `report_documents`.
  - Unduhan raport saat berstatus Draft ditandai sebagai draf kerja, sedangkan unduhan saat status Dikunci menghasilkan berkas resmi final.

---

## 2. Kontrak Endpoint & Database (Backend API)

- [x] Migrasi database menambahkan kolom `status` (enum `draft`, `dikunci`), `dikunci_oleh`, `dikunci_pada`, dan `alasan_buka_kunci` ke tabel `raport_ubudiyah` dan `raport_pengajian`.
- [x] Endpoint `GET /api/ubudiyah/session` dan `GET /api/raport-pengajian/session` merespons objek `lock_status`:
  `{ "is_locked": boolean, "status": "draft" | "dikunci", "dikunci_pada": string|null, "dikunci_oleh_nama": string|null }`.
- [x] Endpoint `POST /api/ubudiyah/lock` dan `POST /api/raport-pengajian/lock` tersedia dengan validasi kelengkapan 100% dan otorisasi role `Admin,Pembina Kamar`.
- [x] Endpoint `POST /api/ubudiyah/unlock` dan `POST /api/raport-pengajian/unlock` tersedia dengan pencatatan audit alasan buka kunci.

---

## 3. Desain & Pengalaman Pengguna (Frontend UI/UX)

- [x] **Badge Indikator Status:**
  - Menampilkan badge status jelas pada header/toolbar:
    - `Draft (Pengisian Aktif)` dengan warna netral/kuning tenang.
    - `Terkunci (Final)` dengan warna hijau solid dan ikon gembok terkunci.
- [x] **Tombol Kunci Raport:**
  - Terletak pada bilah aksi bawah (*sticky bottom bar*).
  - Berstatus dinonaktifkan (*disabled*) jika progres kelengkapan belum 100%.
  - Aktif ketika progres mencapai 100%, memicu modal konfirmasi penguncian sebelum status diubah.
- [x] **Mode Terkunci (Read-Only Grid):**
  - Seluruh kotak input angka nilai (`.matrix-score-input`) dan catatan pembina (`.matrix-note-input`) dinonaktifkan (`disabled`).
  - Tombol *Isi Standar (80)* dan *Simpan Perubahan* dinonaktifkan atau disembunyikan saat terkunci.
- [x] **Aksi Buka Kunci (Admin / Revisi):**
  - Menampilkan tombol *"Buka Kunci Raport"* bagi role Admin atau pembina yang berwenang, lengkap dengan modal konfirmasi dan input alasan revisi.
- [x] **Tombol Download PDF 1 Kamar:**
  - Menyesuaikan status: menampilkan label/tanda draf saat belum terkunci, dan mengunduh berkas arsip resmi saat telah terkunci.

---

## 4. Kualitas Kode, Keamanan, & Automated Testing

- [x] Migrasi database berhasil dieksekusi tanpa error dan skema rollback teruji aman.
- [x] Automated feature tests `RaportLockFeatureTest.php` lulus 100% untuk skenario:
  - Simpan bertahap pada status draft.
  - Penolakan penguncian jika data belum 100% lengkap.
  - Keberhasilan penguncian saat data 100% lengkap.
  - Penolakan perubahan nilai setelah dikunci bagi pembina non-admin.
  - Keberhasilan pembukaan kunci oleh admin dan audit pencatatannya.
- [x] Build frontend `npm --prefix frontend run build` selesai dengan exit code 0 tanpa peringatan tipe TypeScript.

---

# Definition of Done (DoD) - Menu Management Admin (CMS Master Pelanggaran, Pembinaan, Pengajian & Rentang Nilai)

Dokumen ini mendefinisikan kriteria selesai (*Acceptance Criteria & Definition of Done*) untuk implementasi grup menu **Management** khusus role **Admin**, pemindahan sub-menu master terkait, serta pembuatan modul baru **Master Kriteria Pengajian** dan **Pengelolaan Rentang Nilai A–E**.

---

## 1. Navigasi & Otorisasi Menu Sidebar (RBAC & UX)

- [x] **Menu Khusus Role Admin:**
  - Grup menu **Management** hanya ditampilkan pada sidebar untuk akun berjabatan `Admin`.
  - Role selain Admin (`Keamanan`, `Pembina Kamar`, `Wali Kelas`, `Piket Pengajian`) tidak melihat grup menu Management.
- [x] **Struktur Sub-Menu Terpadu di Management:**
  - `Master Pelanggaran` (mengarah ke `/pelanggaran/master`).
  - `Master Kriteria Pembinaan` (mengarah ke `/ubudiyah/master`).
  - `Master Kriteria Pengajian` (mengarah ke `/raport/master`).
- [x] **Pembersihan Menu Operasional (No Redundancy):**
  - Sub-menu `Master Pelanggaran` dihapus dari dropdown menu operasional `Pelanggaran` untuk Admin.
  - Sub-menu `Master Kriteria Pembinaan` dihapus dari dropdown menu operasional `Raport Pembinaan` untuk Admin.
  - Menu operasional (`Pelanggaran`, `Raport Pengajian`, `Raport Pembinaan`) tetap fokus untuk input, monitoring, dan cetak data.
- [x] **Navigasi Responsif & Status Aktif:**
  - Grup menu Management mendukung collapsible dengan animasi chevron halus.
  - Sub-menu aktif ditandai dengan styling fokus/aktif yang jelas sesuai rute halaman yang sedang dibuka.

---

## 2. Fitur Master Kriteria Pengajian (PBS & PBM)

- [x] **Halaman CMS Master Kriteria Pengajian (`/raport/master`):**
  - Tampilan bersih, profesional, solid color, dan mematuhi pedoman anti-AI design slop.
  - Memiliki tab switcher untuk:
    1. **Pengajian Al-Qur'an (PBS)**
    2. **Pengajian Kitab (PBM / Takhassus)**
    3. **Konfigurasi Rentang Nilai & Predikat (A–E)**
- [x] **Operasi Metrik Kriteria:**
  - Menampilkan daftar instrumen kriteria pengajian (nama instrumen, status aktif, dibuat oleh).
  - Modal **Tambah Kriteria Baru** dengan validasi input teks nama kriteria (wajib, max 150 karakter).
  - Modal **Ganti Nama Kriteria / Metrik** (sama seperti di pembinaan) untuk mengubah nama instrumen yang sudah ada.
  - Tombol **Aktifkan / Nonaktifkan** instrumen dengan feedback toast status seketika.
- [x] **Integrasi Dinamis ke Form Input Pengajian:**
  - Halaman `RaportInputPage.tsx` dan kalkulasi backend membaca daftar aspek aktif dari database, tidak lagi hardcoded.

---

## 3. Fitur Pengelolaan Rentang Nilai A–E (Grading Scale CMS)

- [x] **Tabel Konfigurasi Rentang Nilai Interaktif:**
  - Admin dapat mengelola rentang nilai untuk kategori **Pengajian** dan **Pembinaan**.
  - Menampilkan baris tingkat huruf standar: `A`, `B+`, `B`, `C+`, `C`, `D`, `E`.
  - Input field angka untuk batas minimum (`min_nilai`) dan batas maksimum (`max_nilai`).
  - Input field teks untuk label predikat (contoh: `Sangat Baik`, `Baik`, `Cukup`, `Kurang`, `Sangat Kurang`).
- [x] **Validasi Integritas Rentang Nilai:**
  - Angka berada dalam rentang `0` sampai `100`.
  - Nilai minimum tidak boleh lebih besar dari nilai maksimum pada baris yang sama.
  - Rentang antar kategori tidak boleh saling bertabrakan (*non-overlapping*) dan mencakup skala 0–100 secara utuh.
- [x] **Sinkronisasi Hasil Evaluasi:**
  - Hasil penentuan huruf predikat pada kalkulasi nilai rata-rata otomatis menyesuaikan batas rentang nilai yang disimpan oleh Admin.

---

## 4. Kualitas Kode, Database, & Pengujian

- [x] Migrasi tabel `master_instrumen_pengajian` dan `master_rentang_nilai` dieksekusi dengan aman dan memiliki seeder default.
- [x] Seluruh endpoint CMS dilindungi middleware otorisasi ketat `role:Admin`.
- [x] Automated tests backend lulus 100% untuk operasi CRUD kriteria dan pembaruan rentang nilai.
- [x] Build frontend `npm --prefix frontend run build` selesai dengan exit code 0 tanpa error TypeScript atau CSS.

---

# Definition of Done (DoD) - Tampilan Foto Santri pada Tabel Presensi & Validasi Endpoint Media

Dokumen ini mendefinisikan kriteria selesai (*Acceptance Criteria & Definition of Done*) untuk implementasi penambahan ruang/slot foto santri pada tabel roster kegiatan absensi (seluruh 6 kegiatan dan seluruh kelompok) serta verifikasi dan penguatan endpoint media foto santri di SIMANTEB v3.

---

## 1. Validasi & Otorisasi Endpoint Foto Santri (Backend)

- [x] **Validasi Penyimpanan Foto (`POST /api/santri/{id}/foto`):**
  - Hanya menerima file gambar yang valid (`image`, mimes: `jpg`, `jpeg`, `png`, `webp`).
  - Membatasi ukuran file maksimal 5 MB (`5120 KB`).
  - Memastikan `santri_id` valid dan terdaftar aktif di database.
  - Memastikan petugas pengunggah memiliki hak akses: role `Admin` atau role `Pembina Kamar` yang ditugaskan ke santri tersebut (`SantriAccess::canAccess($petugas, $id)`). Petugas yang tidak ditugaskan ditolak dengan status `403 Forbidden`.
  - Menggunakan transaksi database (`DB::transaction`) untuk memperbarui metadata santri: `foto_path`, `foto_disk`, `foto_original_filename`, `foto_mime_type`, `foto_size_bytes`, `foto_sha256`, dan `foto_uploaded_at`.
  - Menghapus file fisik foto lama dari storage saat foto baru diunggah untuk mencegah penumpukan file yatim (*orphaned files*).
  - Melakukan cleanup otomatis pada file fisik baru jika transaksi database mengalami kegagalan (*rollback safety*).
  - Mengembalikan respons JSON berisi `foto_path` dan `foto_url` yang terikat versi timestamp.

- [x] **Validasi Pengambilan Foto (`GET /api/santri/{id}/foto`):**
  - Mengizinkan seluruh role petugas operasional absensi: `Admin`, `Keamanan`, `Pembina Kamar`, `Wali Kelas`, dan `Piket Pengajian`.
  - Role dengan penugasan spesifik (`Pembina Kamar`, `Wali Kelas`, `Piket Pengajian`) diverifikasi melalui `SantriAccess::canAccess($petugas, $id)` untuk memastikan hanya dapat membuka foto santri yang berada dalam binaan/kelas/kelompoknya.
  - Akses oleh role lain atau petugas di luar penugasan ditolak dengan status `403 Forbidden`.
  - Menghasilkan stream media dengan header keamanan `X-Content-Type-Options: nosniff` dan content-type yang sesuai.

- [x] **Integrasi Data Session Absensi (`GET /api/absensi/{jenis}/session`):**
  - Query session menyertakan `foto_path` dan `foto_uploaded_at` santri.
  - Mengembalikan atribut `foto_url` untuk setiap santri dalam array `santri`, dibangun via `MediaUrl::santriPhoto((int) $s->santri_id, $s->foto_uploaded_at)`.
  - Menyembunyikan atribut internal `foto_path` dan `foto_uploaded_at` dari response JSON.

---

## 2. Tampilan Ruang Foto pada Tabel Absensi (Frontend UI/UX)

- [x] **Cakupan Roster Absensi Lengkap:**
  - Ruang foto tampil pada tabel roster presensi ([BulkInputPage.tsx](file:///home/akbarhann/project/tebuirengv2/frontend/src/pages/BulkInputPage.tsx)) untuk **seluruh 6 kegiatan presensi**:
    1. Kelas Formal (`sekolah`)
    2. Keberangkatan Kelas (`keberangkatan`)
    3. Kamar (`kamar`)
    4. Al-Qur'an Subuh (`pbs`)
    5. Kelas Madin (`diniyah`)
    6. Takhasus Maghrib (`pbm`)
  - Berlaku untuk **seluruh kelompok** binaan pada kegiatan masing-masing (semua kelas, semua kamar, semua kelompok PBS, semua jenjang Madin, dan semua kelompok PBM).

- [x] **Ergonomi & Tata Letak Kolom Nama Santri:**
  - Terdapat slot foto berukuran **36×36 px** di sebelah kiri tumpukan teks nama santri dan NIP (`santri-name-stack`).
  - Menggunakan jarak (*gap*) proporsional sebesar 10–12 px antara thumbnail foto dan nama.
  - Lebar kolom `th.th-nama` dan `td.cell-nama` disesuaikan (minimal 270 px) sehingga nama santri tidak terhimpit dan baris tabel tetap proporsional.
  - Tinggi baris tabel tetap kompak dan nyaman untuk alur pencentangan kehadiran cepat (*rapid attendance ticking*).

- [x] **State Tampilan Foto & Fallback:**
  - **Santri Memiliki Foto:** Menampilkan foto santri melalui `resolveApiAssetUrl(santri.foto_url)` dengan `object-fit: cover`.
  - **Santri Tanpa Foto / Gagal Muat:** Menampilkan avatar placeholder berbentuk squircle (`border-radius: 8px`) dengan latar belakang netral, border halus (`#e2e8f0`), dan inisial huruf pertama nama santri secara rapi dan tegas.
  - Jika file gambar rusak atau gagal dimuat (*image load error*), tampilan otomatis beralih ke avatar placeholder tanpa memecah layout tabel.

- [x] **Kepatuhan Pedoman Desain (Anti AI Design Slop):**
  - Menggunakan palet netral grayscale dengan aksen tertahan.
  - Tidak menggunakan gradient dekoratif berlebih, tidak menggunakan border radius berlebihan (>12px), dan tanpa efek blur glow.
  - Tampilan visual tetap memiliki hierarki dan kontras yang jelas saat diuji dalam mode grayscale.

---

## 3. Kualitas Kode, Integritas Tipe, & Pengujian

- [x] Interface TypeScript `SantriAbsensi` pada frontend diperbarui dengan `foto_url?: string | null;` tanpa type error.
- [x] Build frontend `npm --prefix frontend run build` sukses (exit code 0).
- [x] Test backend `SantriFotoFeatureTest` dan `AbsensiFeatureTest` lulus 100% di lingkungan pengujian container.

---

# Definition of Done (DoD) - Sub-Menu Management Jadwal Absensi

Dokumen ini mendefinisikan kriteria selesai (*Acceptance Criteria & Definition of Done*) untuk implementasi penambahan sub-menu **Jadwal Absensi** pada posisi ke-1 grup dropdown **Management**, halaman tabel data jadwal kegiatan absensi, dan modal edit penyesuaian waktu pelaksanaan presensi di SIMANTEB v3.

---

## 1. Navigasi & Posisi Sub-Menu (Frontend Navigation)

- [x] **Posisi Pertama di Dropdown Management:**
  - Sub-menu **Jadwal Absensi** tampil di posisi ke-1 (paling atas) di dalam kelompok menu accordion `Management` pada Sidebar Admin.
  - Urutan sub-menu Management untuk Admin:
    1. **Jadwal Absensi** (`/absensi/jadwal`)
    2. **Master Pelanggaran** (`/pelanggaran/master`)
    3. **Master Kriteria Pembinaan** (`/ubudiyah/master`)
    4. **Master Kriteria Pengajian** (`/raport/master`)
    5. **Penugasan Absensi** (`/data-master/penugasan`)
    6. **Akun Petugas** (`/data-master/akun`)
    7. **WhatsApp Gateway** (`/data-master/wa-bot`)
- [x] **Akses Terbatas Khusus Role Admin:**
  - Grup menu `Management` dan sub-menu `Jadwal Absensi` hanya diakses oleh pengguna dengan role `Admin`.
- [x] **State Navigasi & Collapsible:**
  - Rute `/absensi/jadwal` dikenali sebagai rute Management (`isManagementRoute`), sehingga kelompok menu Management otomatis terbuka (*expanded*) dan link *Jadwal Absensi* berstatus aktif (`active`).

---

## 2. Halaman Master Jadwal Absensi (`/absensi/jadwal`)

- [x] **Tampilan Tabel Master Jadwal:**
  - Tabel menampilkan seluruh 6 daftar kegiatan absensi santri:
    1. Absensi Kamar malam (20:00 - 20:30, Pembina kamar)
    2. Absensi Kamar Pagi (keberangkatan kelas) (06:00 - 07:30, Pembina Kamar)
    3. Absensi Sekolah (07:30 - 13:00, Wali kelas)
    4. Absensi PBSubuh (05:00 - 06:00, Piket Pengajian)
    5. Absensi PBMmaghrib (18:30 - 19:30, Piket Pengajian)
    6. Absensi Diniyah (15:30 - 16:00, Piket Pengajian)
  - **Kolom Tabel Wajib:**
    1. **Nama Kegiatan** (contoh: *Absensi Kamar malam*)
    2. **Absensi / Modul Absensi** (contoh: *Kegiatan Kamar*, *Kelas Formal*, *Kelompok Al-Qur'an Subuh*, *Takhasus Maghrib*, *Kelas Madin*)
    3. **Waktu Pelaksanaan** (format HH:mm - HH:mm, contoh: `20:00 - 20:30`)
    4. **Penanggung Jawab Input** (contoh: *Pembina kamar*, *Wali kelas*, *Piket Pengajian*)
    5. **Aksi** (Tombol `Edit`)
- [x] **Tampilan Visual Anti-AI Design Slop:**
  - Desain bersih, kontras tinggi, menggunakan warna netral dengan aksen tertahan.
  - Memiliki badge status kegiatan aktif/nonaktif dan format jam yang jelas.

---

## 3. Modal Edit & Pembaruan Waktu Pelaksanaan

- [x] **Modal Interactive Penyesuaian Jadwal:**
  - Menampilkan nama kegiatan dan modul absensi yang sedang diubah.
  - Field input **Jam Mulai** (time picker / input time format HH:mm).
  - Field input **Jam Selesai** (time picker / input time format HH:mm).
  - Field input **Nama Kegiatan** (dapat disesuaikan jika diperlukan).
  - Field input **Toleransi Menit Input** (default 15/30 menit).
- [x] **Validasi Waktu Ketat:**
  - `jam_selesai` harus lebih besar dari `jam_mulai`.
  - Mencegah submit jika format jam kosong atau invalid.
- [x] **Umpan Balik Notifikasi & Real-time Update:**
  - Saat penyesuaian waktu berhasil disimpan, modal tertutup dan toast notifikasi muncul: `✓ Waktu pelaksanaan absensi berhasil diperbarui`.
  - Data pada tabel otomatis ter-update tanpa memuat ulang seluruh halaman (*full page reload*).

---

## 4. API Endpoints & Otorisasi Backend

- [x] **Endpoint Pengambilan Data (`GET /api/absensi/jadwal`):**
  - Mengembalikan daftar seluruh jadwal kegiatan absensi beserta nama jenis kegiatan dan penanggung jawab default.
  - Terlindungi oleh middleware `auth:sanctum` dan `role:Admin`.
- [x] **Endpoint Pembaruan Data (`PUT /api/absensi/jadwal/{id}`):**
  - Menerima payload `jam_mulai`, `jam_selesai`, `nama_jadwal`, `toleransi_menit`, dan `status_aktif`.
  - Memperbarui record pada tabel database `jadwal_kegiatan`.
  - Terlindungi oleh middleware `auth:sanctum` dan `role:Admin`.

---

## 5. Kualitas Kode & Pengujian

- [x] Build frontend `npm --prefix frontend run build` sukses (exit code 0).
- [x] Automated tests backend untuk `AbsensiJadwalFeatureTest` lulus 100%.

---

# Definition of Done (DoD) - Idempotensi & Lifecycle Status Absensi SIMANTEB v3

Dokumen ini mendefinisikan kriteria selesai (*Acceptance Criteria & Definition of Done*) untuk implementasi **Idempotensi Sesi Absensi, Pembersihan Draft Otomatis, dan Perubahan Status Tombol** pada form absensi santri SIMANTEB v3.

---

## 1. Idempotensi Sesi & Penguncian Form (Attendance Session Lock)

- [x] **Deteksi Sesi Selesai (Already Recorded):**
  - Sistem mendeteksi otomatis jika sesi absensi untuk suatu kelompok (kamar, kelas formal, kelompok pengajian), jadwal, dan tanggal aktif sudah pernah disimpan di database server.
  - Sesi yang sudah memiliki data absensi lengkap diperlakukan sebagai **Selesai / Terkunci (Locked)**.
- [x] **Pencegahan Absen Baru pada Sesi Tersimpan:**
  - Form tidak mengizinkan aksi "Mulai Absensi" baru jika sesi hari ini sudah tersimpan.
  - Tabel santri ditampilkan dalam mode terkunci (*read-only preview*): checkbox dinonaktifkan, indikator status menampilkan data yang tersimpan di server.

---

## 2. Perubahan Status Tombol Toolbar

- [x] **Status Tombol Sebelum Disimpan:**
  - Menampilkan tombol hijau **"Mulai Absensi"** saat sesi belum dimulai.
  - Menampilkan tombol merah **"Batal Absen"** dan tombol hijau **"Simpan Absensi"** saat sesi dalam proses pengisian.
- [x] **Status Tombol Setelah Berhasil Disimpan:**
  - Tombol **"Batal Absen"** dan **"Simpan Absensi"** berganti secara otomatis setelah proses simpan berhasil.
  - Toolbar menampilkan badge status informatif: **"Sudah Diabsen"** (hijau solid tenang dengan ikon ceklis).
  - Toolbar menampilkan tombol navigasi sekunder: **"Rekap Absensi"** yang mengarahkan petugas langsung ke halaman histori absensi (`/absensi-histori`).

---

## 3. Penghapusan Draft Mutlak (No Ghost Draft)

- [x] **Pembersihan LocalStorage:**
  - Saat tombol "Simpan Absensi" ditekan dan server mengembalikan respons berhasil, key draft pada `localStorage` (`simanteb_attendance_draft_*`) dihapus tuntas.
  - State `isAbsensiStarted` diubah menjadi `false` sebelum pembersihan draft sehingga tidak memicu *re-population* otomatis ke state `drafts`.
  - Hook auto-save draft tidak berjalan setelah proses penyimpanan selesai.
- [x] **Verifikasi Menu Roster Kegiatan (`/absensi-kegiatan/:jenis`):**
  - Setelah keluar dari form absensi yang telah disimpan, kartu peringatan *"Draft Absensi Belum Selesai"* **tidak muncul lagi** di menu kegiatan maupun beranda.

---

## 4. Alur Koreksi Data Terpusat (Audit Trail)

- [x] **Arah Alur Pengeditan:**
  - Pengubahan status atau koreksi catatan santri untuk sesi yang telah tersimpan diarahkan ke menu **Histori & Rekap Absensi** (`/absensi-histori`).
  - Form bulk absensi menyertakan banner netral penjelas: *"Absensi untuk sesi ini telah tersimpan (idempoten). Perubahan status atau koreksi dapat dilakukan melalui menu Rekap Absensi."*

---

## 5. Kualitas Kode & Tampilan (Design System Anti-Slop)

- [x] Menggunakan styling standar SIMANTEB: solid colors, typography Inter/IBM Plex Mono, badge status proporsional, tanpa decorative gradient atau AI slop.
- [x] Kompilasi TypeScript frontend `npm run build` sukses tanpa error dan tanpa type warning.

