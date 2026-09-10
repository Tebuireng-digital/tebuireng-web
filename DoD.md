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
