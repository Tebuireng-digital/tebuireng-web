# Definition of Done (DoD) - Alur Kunci Hybrid & Publikasi Raport ke Portal Wali Santri

Dokumen ini mendefinisikan kriteria selesai (*Definition of Done*) untuk implementasi **Model C (Kunci Parsial/Hybrid)**, **Auto-Publish saat Dikunci**, dan **Integrasi Rapor Pengajian & Pembinaan pada Portal Wali Santri**.

---

## 1. Kriteria Fungsional (Backend)

### 1.1. Logika Kunci Hybrid (Model C)
- [x] **Raport Pengajian (`RaportPengajianController::lock`):**
  - Tidak melempar error `422` jika ada santri yang belum lengkap nilainya.
  - Mengidentifikasi santri dengan nilai lengkap (100%) dan santri yang belum lengkap (draft/susulan).
  - Hanya memperbarui status santri yang lengkap menjadi `dikunci` (`status = 'dikunci'`, `dikunci_oleh`, `dikunci_pada`).
  - Santri yang belum lengkap tetap berstatus `draft` dan nilainya tetap dapat disusulkan.
  - Response JSON mengembalikan rekap: jumlah santri terkunci, jumlah santri yang masih draft, dan daftar nama santri susulan.
- [x] **Raport Pembinaan (`UbudiyahController::lock`):**
  - Menerapkan alur yang sama: mengunci santri yang seluruh instrumen ubudiyah aktifnya sudah terisi angka.
  - Santri yang belum lengkap tetap berstatus `draft`.
- [x] **Alur Buka Kunci (`unlock`):**
  - Petugas yang berwenang (Admin atau petugas pengunci) dapat membuka kunci kelompok dengan mencatat `alasan_buka_kunci`.
  - Status santri yang dibuka kembali menjadi `draft`.

### 1.2. Proteksi & Auto-Publish Portal Wali Santri
- [x] **Penyaringan Rapor Pengajian (`portalSemester` & `portalSemesterPdf`):**
  - Query database secara ketat memfilter `where('status', 'dikunci')`.
  - Nilai yang masih berstatus `draft` **TIDAK PERNAH** terkirim ke API wali santri.
- [x] **Endpoint Rapor Pembinaan untuk Portal Wali Santri:**
  - Tersedia endpoint `GET /api/santri-portal/rapor-pembinaan` (dan versi PDF) dengan middleware `auth:wali`.
  - Query memfilter `where('status', 'dikunci')`.

---

## 2. Kriteria Tampilan & Interaksi (Frontend Petugas)

### 2.1. Halaman Input Raport (`RaportInputPage.tsx` & `UbudiyahFormPage.tsx`)
- [x] **Modal Konfirmasi Kunci Cerdas:**
  - Menampilkan ringkasan sebelum mengunci: *"X dari Y santri lengkap"*.
  - Jika ada santri yang belum lengkap, menampilkan nama-nama santri tersebut dengan keterangan bahwa mereka tetap dalam status draft (susulan).
- [x] **Status Baris Tabel per Santri:**
  - Baris santri yang sudah berstatus `dikunci` berubah menjadi *readonly/disabled* dengan badge hijau **Terkunci**.
  - Baris santri yang masih `draft` tetap aktif dan dapat diedit nilainya dengan badge kuning **Draft / Susulan**.
- [x] **Header Progres:**
  - Menampilkan ringkasan progres di atas tabel: misal *"23 / 25 Santri Terkunci, 2 Susulan"*.

---

### 3. Kriteria Portal Wali Santri (`SantriPortalPage.tsx`)

### 3.1. Navigasi & Tab
- [x] Halaman Rapor pada Portal Wali Santri memiliki 2 sub-tab yang jelas:
  1. **Rapor Pengajian** (Al-Qur'an Subuh / Takhasus / Madin)
  2. **Rapor Pembinaan** (Kamar / Ubudiyah Yaumiyah & Karakter)

### 3.2. Kondisi Nilai Belum Terbit (Draft / Kosong)
- [x] Jika rapor anak untuk periode/bulan yang dipilih belum berstatus `dikunci`:
  - **Tabel nilai disembunyikan total** (tidak menampilkan tabel kosong dengan angka 0 atau strip-strip).
  - Tampil kartu informasi yang ramah dan informatif:
    > *"Rapor periode ini belum diterbitkan. Penilaian sedang dalam proses oleh Ustadz Pengajian / Pembina Kamar."*

### 3.3. Kondisi Nilai Sudah Dikunci (Terbit)
- [x] Menampilkan ringkasan nilai, predikat, dan rincian aspek secara utuh.
- [x] Tombol **"Cetak Rapor"** aktif dan mengunduh PDF resmi santri yang bersangkutan.

---

## 4. Kriteria Kualitas Teknis & Build
- [x] Kompilasi TypeScript frontend (`tsc && vite build`) berhasil dengan exit code 0 tanpa error tipe.
- [x] Tidak ada regresi visual pada form absensi, layout sidebar, ataupun tabel raport lainnya.
- [x] Semua endpoint backend divalidasi dengan auth & role policy yang sesuai.

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

