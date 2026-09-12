# Rencana Perbaikan Review dan Verifikasi Santri Master

Status dokumen: approved; implementasi fase fondasi selesai

Tanggal: 12 September 2026

## 1. Latar belakang

Modul **Verifikasi Data** saat ini memadukan dua kebutuhan yang berbeda:

1. **Verifikasi kelengkapan santri master**
   untuk memastikan data santri putra siap dipakai oleh operasional absensi,
   perizinan, pelanggaran, dan portal wali.
2. **Review kemiripan identitas**
   untuk memutuskan apakah sebuah baris dari sumber impor merupakan santri yang
   sama dengan santri master yang sudah ada, atau merupakan orang yang berbeda.

Hasil audit menunjukkan bahwa implementasi saat ini sudah memiliki fondasi yang
baik, tetapi alurnya masih bercampur antara:

- flow lama berbasis hasil `import:excel`;
- flow baru berbasis workbook canonical
  `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`;
- keputusan bisnis admin di UI;
- dan status teknis yang disimpan di tabel `santri_import_reviews`.

Akibatnya, beberapa aksi di UI terlihat tersedia, tetapi perilaku backend belum
sepenuhnya konsisten dengan sumber data canonical yang sekarang dipakai.

## 2. Purpose perbaikan

Tujuan perbaikan ini bukan hanya merapikan code, tetapi menegaskan ulang
kontrak bisnis dari modul review/verifikasi santri:

1. **Menjadikan workbook canonical sebagai sumber kebenaran tunggal**
   untuk antrean review identitas dan data master santri putra.
2. **Memisahkan dengan jelas dua jenis antrean**
   yaitu:
   - antrean kekurangan data master;
   - antrean review kemiripan identitas.
3. **Membuat keputusan admin menjadi durable**
   sehingga hasil `digabung` atau `terpisah` tidak hilang saat sinkronisasi
   ulang.
4. **Membuat aksi `gabungkan` dan `terpisah` benar-benar mencerminkan proses
   bisnis**
   dan bukan hanya perubahan label status di tabel review.
5. **Mencegah keputusan merge yang salah target**
   dengan membatasi kandidat ke santri canonical aktif yang memang layak
   menjadi record induk.
6. **Menyediakan jejak keputusan yang bisa diaudit**
   sehingga setelah data digabung atau dipisah, alasan dan dampaknya tetap
   dapat ditelusuri.

## 3. Sumber data yang berlaku saat ini

### 3.1 Data master santri

Data master aktif saat ini berasal dari sheet `MASTER_PUTRA` pada workbook:

- `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`

Sheet ini mengisi atau memperbarui:

- `santri`
- `kamar`
- `kelas_formal`
- `kelompok_madin`
- `kelompok_pbs`
- `kelompok_pbm`

Santri yang berstatus baru pada workbook dapat masuk ke `santri` dengan
penanda:

- `status_verifikasi = perlu_verifikasi`
- `status_siswa_sumber = santri_baru_2026`
- `catatan_import = SANTRI_BARU_2026`

Sedangkan santri canonical aktif lama diberi penanda:

- `status_siswa_sumber = aktif`
- `catatan_import = MASTER_PUTRA`

### 3.2 Data review kemiripan identitas

Antrean review identitas aktif saat ini berasal dari sheet `REVIEW_MATCH` pada
workbook canonical yang sama:

- `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`

Struktur bisnis pada sheet ini memuat:

- `jenis_data`
- `baris_sumber`
- `nama_sumber`
- `kamar_sumber`
- `kelompok_atau_kelas`
- `no_id_induk_kandidat`
- `nama_kandidat`
- `kamar_kandidat`
- `status`
- `similarity_percent`

Per 12 September 2026, contoh sumber review yang muncul di workbook canonical
adalah:

- `ABSENSI_KAMAR`
- `PBM`
- `PBS`
- `MADIN`

Status asli pada workbook juga masih bermakna secara bisnis:

- `EXACT`
- `REVIEW`
- `UNMATCHED`

### 3.2.1 Provenance row REVIEW_MATCH

`REVIEW_MATCH` bukan sumber data mentah. Sheet tersebut adalah hasil pencocokan
yang menyimpan kandidat dan skor, sehingga setiap row harus dibaca dengan dua
lapis referensi:

1. **Referensi hasil pencocokan:** workbook
   `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`, sheet `REVIEW_MATCH`, pada
   baris Excel yang disimpan sebagai `review_baris_excel`.
2. **Referensi sumber mentah:** file Excel asal, sheet asal, dan nomor baris asal
   yang disimpan sebagai `sumber_file_excel`, `sumber_sheet_excel`, dan
   `sumber_baris_excel`.

Relasi sumber mentah yang sudah diverifikasi terhadap workbook TA 2026/2027
adalah:

| `jenis_data` | File Excel mentah | Sheet mentah | Arti `baris_sumber` |
|---|---|---|---|
| `MADIN` | `xlsx/Database_Kelas_Madin_2026_2027.xlsx` | `Database Siswa Madin` | Baris Excel peserta Madin |
| `PBM` | `xlsx/Database_Takhassus (belajar habis maghrib)_2026_2027.xlsx` | `Database Takhassus` | Baris Excel peserta PBM |
| `PBS` | `xlsx/Database_Kelompok_AlQuran (belajar habis subuh)_2026_2027.xlsx` | `Database Al-Qur'an` | Baris Excel peserta PBS |
| `ABSENSI_KAMAR` | File `data/26-ABSENSI*.xlsx` sesuai unit/kamar | Sheet kamar pada file tersebut | Baris Excel santri pada sheet kamar |

Untuk `ABSENSI_KAMAR`, pemetaan yang aktif adalah `MMHA`, `MASS`, `MTS`,
`SMA`, `SMK`, dan `SMP`. Contoh bukti relasi:

- `REVIEW_MATCH` baris 2, `jenis_data=MADIN`, `baris_sumber=110` menunjuk ke
  `xlsx/Database_Kelas_Madin_2026_2027.xlsx` / `Database Siswa Madin` / baris
  110, nama `MUHAMMAD AMMAR DZAKKI`.
- `REVIEW_MATCH` baris 355, `jenis_data=ABSENSI_KAMAR`,
  `baris_sumber=9`, dan kamar `MU 201` menunjuk ke
  `data/26 - ABSENSI MMHA.xlsx` / sheet `201` / baris 9, nama
  `ABDILAH AIQON BIHI`.

Dengan kontrak ini, label `REVIEW` hanya menjelaskan status hasil matching,
bukan asal data. Jika mapping jenis data atau kamar tidak dikenal, sistem
menyimpan `status_provenance=PERLU_VERIFIKASI` dan tidak mengarang file/sheet
asal.

### 3.3 Flow lama yang masih tersisa di repo

Repo juga masih memiliki flow lama:

- `import:excel`
- output `storage/app/santri-review-kandidat.xlsx`
- output `storage/app/santri-review-baru.xlsx`
- command `import:review`

Namun berdasarkan code dan dokumen audit, flow itu **bukan lagi alur resmi yang
sebaiknya menjadi acuan keputusan admin**, karena:

1. sumber resmi sekarang sudah berada di workbook canonical;
2. `import:review` masih placeholder;
3. UI review admin aktif sekarang menggunakan tabel `santri_import_reviews`
   hasil sync controller, bukan membaca file Excel review manual secara
   langsung.

## 4. Alur bisnis yang seharusnya dipahami

### 4.1 Antrean verifikasi data santri

Antrean ini menjawab pertanyaan:

> "Apakah data santri master ini sudah cukup lengkap untuk dipakai operasional?"

Contoh masalah yang masuk antrean ini:

- belum punya nomor induk pondok;
- kamar belum dipetakan;
- kelas formal belum dipetakan;
- kelompok Madin/PBS/PBM belum dipetakan;
- ORDA belum ditetapkan;
- kontak wali belum terisi.

Keputusan pada antrean ini seharusnya berupa:

- melengkapi field yang kosong;
- memetakan kamar;
- menandai partisipasi kegiatan;
- memperbarui status verifikasi santri.

Antrean ini **bukan** untuk memutuskan dua identitas itu orang yang sama atau
berbeda.

### 4.2 Antrean review kemiripan data

Antrean ini menjawab pertanyaan:

> "Apakah baris sumber ini orang yang sama dengan santri master tertentu?"

Di sini admin menilai:

- kecocokan nama;
- kecocokan kamar;
- konteks kelas atau kelompok;
- ID kandidat dari workbook;
- dan bila perlu memilih kandidat master lain secara manual.

Hasil akhir idealnya hanya dua:

1. **Gabungkan**
   artinya sumber tersebut memang merujuk ke santri master yang sama.
2. **Terpisah**
   artinya sumber tersebut bukan orang yang sama dan harus diperlakukan sebagai
   entitas terpisah.

## 5. Masalah yang ditemukan pada implementasi sekarang

### 5.1 Keputusan admin belum durable

Saat tombol sinkronisasi review dijalankan, backend memanggil
`import:master-putra` lalu melakukan `updateOrInsert` ke
`santri_import_reviews`.

Masalahnya, status hasil keputusan admin dapat tertimpa lagi menjadi
`perlu_tinjau`.

Dampak bisnis:

- admin bisa kehilangan progres review;
- antrean bisa terlihat belum selesai padahal sudah pernah diputuskan;
- kepercayaan terhadap menu review menurun.

### 5.2 Flow canonical baru belum selaras dengan aksi merge

Aksi `merge` di backend mensyaratkan adanya `santri_otomatis_id` sebagai sumber
yang akan dipindahkan ke record induk.

Sementara sync canonical baru dari sheet `REVIEW_MATCH` pada praktiknya
mengisi:

- `kandidat_santri_id`
- `skor_kemiripan`
- metadata sumber

tetapi tidak membentuk `santri_otomatis_id` untuk setiap row review.

Dampak bisnis:

- tombol `Gabungkan` bisa tampak tersedia;
- tetapi backend dapat menolak karena source merge yang diharapkan tidak ada.

### 5.3 Kandidat merge manual terlalu luas

UI saat ini membuka pencarian kandidat dari seluruh daftar `/api/master/santri`.
Ini berarti admin berpotensi memilih:

- santri noncanonical lama;
- santri inactive;
- atau record lain yang tidak seharusnya menjadi induk canonical.

Dampak bisnis:

- merge bisa sah secara teknis tetapi salah secara data governance;
- identitas canonical dapat tercampur dengan data legacy.

### 5.4 Makna status review canonical belum dipertahankan

Workbook canonical masih membawa status:

- `EXACT`
- `REVIEW`
- `UNMATCHED`

Tetapi importer saat ini meratakan semuanya menjadi `perlu_tinjau`.

Dampak bisnis:

- admin kehilangan sinyal mana yang sebetulnya exact match dan mana yang benar
  benar ambiguous;
- dashboard antrean review tidak menggambarkan kualitas hasil matching awal.

### 5.5 Filter sumber review di UI masih memakai label legacy

Dropdown sumber review di UI masih memakai nama seperti:

- `Database Siswa`
- `Database Siswa Madin`
- `Database Al-Qur'an`
- `Database Takhassus`

Padahal workbook canonical aktif yang saya cek sekarang memuat:

- `ABSENSI_KAMAR`
- `PBM`
- `PBS`
- `MADIN`

Dampak bisnis:

- filter UI tidak merepresentasikan sumber review aktual;
- admin bisa salah memahami asal data yang sedang ditinjau.

### 5.6 Aksi `Terpisah` masih minim tindak lanjut

Saat admin memilih `Terpisah`, backend saat ini baru:

- mengubah status row review menjadi `terpisah`;
- mencatat siapa yang memutuskan;
- menyimpan catatan keputusan bila ada.

Yang belum terjadi otomatis:

- pembuatan draft santri baru bila memang orang kedua belum ada;
- pengaitan row review ke record baru;
- tugas lanjutan verifikasi data untuk entitas baru tersebut.

Dampak bisnis:

- keputusan benar secara label, tetapi proses penyelesaiannya masih manual;
- row review selesai, tetapi persoalan identitas bisa tetap belum selesai.

## 6. Prinsip desain perbaikan

Rencana perbaikan saya mengikuti prinsip berikut:

1. **Canonical-first**
   semua keputusan review harus mengikuti workbook canonical dan status santri
   canonical aktif.
2. **Durable decisions**
   keputusan admin tidak boleh hilang hanya karena proses sync ulang.
3. **Explicit business states**
   status teknis harus bisa dibaca sebagai status bisnis yang jelas.
4. **Safe merge**
   merge hanya boleh terjadi bila source dan target memang valid.
5. **Traceable actions**
   harus ada jejak siapa memutuskan apa, kapan, dan dengan alasan apa.
6. **Backward-aware**
   flow lama tidak boleh dibiarkan merusak flow baru, tetapi transisi harus
   tetap aman untuk data yang sudah telanjur ada.

## 7. Rencana perbaikan yang diusulkan

## 7.1 Tahap 1 - Rapikan model data review dan pertahankan keputusan admin

Tujuan:

- memastikan sync workbook canonical tidak menimpa hasil keputusan admin.

Perubahan yang direncanakan:

1. Ubah logika `upsertReview()` agar:
   - row review baru tetap dibuat bila belum ada;
   - row review existing tidak mengubah `status` bila sudah `digabung` atau
     `terpisah`;
   - metadata sumber boleh diperbarui bila workbook berubah;
   - perubahan kandidat workbook ditangani dengan aturan eksplisit.
2. Simpan status asli dari workbook canonical ke field baru, misalnya:
   - `status_sumber_review` = `EXACT|REVIEW|UNMATCHED`
3. Simpan snapshot kandidat sumber workbook ke field baru, misalnya:
   - `no_id_induk_kandidat_sumber`
   - `nama_kandidat_sumber`
   - `kamar_kandidat_sumber`
4. Bila workbook canonical berubah setelah keputusan admin dibuat,
   jangan otomatis menghapus keputusan. Sebaliknya:
   - tandai row sebagai perlu review ulang;
   - atau tampilkan indikator bahwa kandidat workbook berubah setelah
     keputusan terakhir.

Hasil yang diinginkan:

- keputusan admin tetap awet;
- sync ulang hanya memperbarui konteks, bukan menghapus hasil kerja admin.

## 7.2 Tahap 2 - Bedakan jelas row review yang hanya kandidat dengan row yang punya source merge

Tujuan:

- membuat aksi `Gabungkan` hanya tersedia bila secara data memang ada source
  record yang dapat dipindahkan.

Perubahan yang direncanakan:

1. Audit ulang makna `santri_otomatis_id`.
2. Pisahkan dua kasus review:
   - **kasus A**: row review hanya menunjuk kandidat existing canonical;
   - **kasus B**: row review mewakili record santri hasil auto-create yang
     perlu diputuskan akan dipertahankan atau digabung.
3. Di backend, `merge()` harus hanya berlaku untuk **kasus B**.
4. Untuk **kasus A**, siapkan aksi bisnis yang lebih tepat, misalnya:
   - `konfirmasi_kandidat`
   - atau `tautkan_ke_master`
   tanpa memindahkan transaksi dari source record yang sebenarnya tidak ada.
5. UI harus menampilkan tipe row review secara jelas:
   - `Kandidat workbook`
   - `Santri auto-create`
   - `Perlu verifikasi manual`

Hasil yang diinginkan:

- admin tidak lagi diberi tombol yang sebenarnya tidak valid untuk row
  tertentu;
- perilaku backend dan label UI menjadi sejalan.

## 7.3 Tahap 3 - Kunci kandidat merge ke santri canonical aktif

Tujuan:

- mencegah merge ke target yang salah.

Perubahan yang direncanakan:

1. Tambahkan helper query khusus kandidat canonical:
   - hanya `status_aktif = 1`
   - hanya `catatan_import = MASTER_PUTRA` atau status sumber canonical lain
     yang disetujui
   - exclude `legacy_noncanonical`
2. Ubah daftar kandidat di modal review agar hanya mengambil data yang layak
   menjadi record induk.
3. Validasi ulang di backend:
   - `kandidat_santri_id` tidak cukup `exists`;
   - harus lolos aturan canonical aktif.
4. Jika user mencoba memilih kandidat di luar rule tersebut,
   backend harus mengembalikan `422` dengan pesan bisnis yang jelas.

Hasil yang diinginkan:

- merge hanya bisa diarahkan ke record master yang benar;
- data legacy tidak lagi ikut menjadi target default.

## 7.4 Tahap 4 - Pulihkan makna status sumber review

Tujuan:

- membuat admin memahami kualitas matching dari workbook canonical sebelum
  membuat keputusan.

Perubahan yang direncanakan:

1. Pertahankan status asli dari workbook:
   - `EXACT`
   - `REVIEW`
   - `UNMATCHED`
2. Tampilkan status ini terpisah dari status keputusan admin.

Contoh model tampilan:

- `Status sumber`: `EXACT`
- `Status keputusan admin`: `Belum diputuskan`

atau:

- `Status sumber`: `UNMATCHED`
- `Status keputusan admin`: `Terpisah`

3. Dashboard review menghitung antrean berdasarkan gabungan dua dimensi:
   - status sumber review;
   - status keputusan admin.

Hasil yang diinginkan:

- admin dapat memprioritaskan review dengan lebih tepat;
- data exact tidak tercampur dengan data ambiguous.

## 7.5 Tahap 5 - Rapikan sumber dan terminologi UI

Tujuan:

- menyelaraskan label UI dengan sumber data yang benar-benar dipakai.

Perubahan yang direncanakan:

1. Dropdown sumber review tidak lagi hardcoded ke label legacy.
2. Nilai filter diambil dari data review aktual atau enum sumber resmi.
3. Tabel review menampilkan dengan jelas:
   - sheet sumber canonical;
   - baris sumber;
   - konteks data tambahan;
   - kandidat workbook;
   - kandidat master final yang dipilih admin.
4. Pesan tombol sinkronisasi disesuaikan dengan response backend yang benar.

Hasil yang diinginkan:

- admin paham persis asal data;
- filter UI tidak misleading;
- pesan sinkronisasi konsisten.

## 7.6 Tahap 6 - Sempurnakan alur `Terpisah`

Tujuan:

- membuat keputusan `Terpisah` benar-benar menutup kasus bisnis.

Perubahan yang direncanakan:

1. Bedakan dua hasil `Terpisah`:
   - `terpisah_sudah_ada_di_master`
   - `terpisah_belum_ada_di_master`
2. Untuk kasus belum ada di master, sediakan salah satu dari dua pendekatan:

### Opsi A - Draft otomatis

- sistem membuat draft santri baru dari data sumber review;
- draft diberi `status_verifikasi = perlu_verifikasi`;
- admin lalu melengkapi kamar, unit, dan kelompok.

### Opsi B - Tindak lanjut manual terstruktur

- sistem tidak membuat santri baru otomatis;
- tetapi row review diberi status lanjutan seperti
  `terpisah_perlu_buat_master`;
- UI menyediakan tombol lanjutan "Buat santri baru dari data ini".

Rekomendasi saya:

- gunakan **Opsi B** terlebih dahulu karena lebih aman;
- setelah perilaku bisnis stabil, baru pertimbangkan otomatisasi draft.

Hasil yang diinginkan:

- keputusan `Terpisah` tidak berhenti di status;
- selalu ada langkah akhir yang jelas.

## 7.7 Tahap 7 - Tambahkan audit trail dan pengujian end-to-end

Tujuan:

- menjaga flow tetap aman setelah diperbaiki.

Perubahan yang direncanakan:

1. Tambahkan test feature untuk:
   - sync review pertama kali;
   - sync ulang setelah keputusan `digabung`;
   - sync ulang setelah keputusan `terpisah`;
   - merge dengan target invalid;
   - merge dengan source missing;
   - separate dengan catatan;
   - perubahan kandidat workbook setelah keputusan admin.
2. Tambahkan log aktivitas atau audit event untuk:
   - siapa menekan `Gabungkan`;
   - siapa menekan `Terpisah`;
   - target merge mana yang dipilih;
   - apakah ada conflict absensi.
3. Tambahkan snapshot atau smoke test UI untuk:
   - filter sumber review;
   - badge status sumber;
   - badge status keputusan admin;
   - visibilitas tombol aksi sesuai tipe row.

Hasil yang diinginkan:

- perubahan tidak gampang regress;
- keputusan sensitif tetap terlacak.

## 8. Desain alur bisnis setelah perbaikan

### 8.1 Saat admin menekan `Gabungkan`

Alur target:

1. Admin membuka row review.
2. Sistem menampilkan:
   - data sumber review;
   - kandidat canonical dari workbook;
   - status sumber review;
   - kandidat master yang boleh dipilih.
3. Admin memilih target master canonical.
4. Backend memverifikasi:
   - row memang memiliki source yang valid untuk digabung;
   - target canonical aktif;
   - tidak ada benturan absensi/relasi yang membuat merge berbahaya.
5. Jika aman:
   - data enrichment source mengisi field target yang masih kosong;
   - seluruh relasi transaksional source dipindah ke target;
   - source diarsipkan atau dihapus sesuai kebijakan;
   - row review ditandai `digabung`;
   - keputusan dan alasan tersimpan.
6. Sync berikutnya tidak membuka lagi keputusan ini kecuali memang ada
   perubahan sumber yang mengharuskan review ulang.

### 8.2 Saat admin menekan `Terpisah`

Alur target:

1. Admin membuka row review.
2. Admin menyatakan dua identitas ini berbeda.
3. Backend menyimpan:
   - status keputusan;
   - siapa memutuskan;
   - kapan diputuskan;
   - catatan keputusan.
4. Sistem kemudian:
   - menutup row review bila master kedua sudah ada;
   - atau membuka tindak lanjut pembuatan/lengkapi master baru bila belum ada.

Dengan alur ini, `Terpisah` berarti:

- bukan orang yang sama;
- dan sistem tahu apa langkah lanjutan yang harus dilakukan.

## 9. Scope implementasi yang saya rekomendasikan

Agar risiko terkendali, saya sarankan dibagi menjadi dua fase.

### Fase 1 - Koreksi fondasi dan kontrak data

Scope:

- durable decision pada sync;
- validasi kandidat canonical aktif;
- perapian label/filter sumber review;
- pemisahan status sumber review vs status keputusan admin;
- test feature inti review.

Manfaat:

- risiko data salah merge langsung turun;
- UI dan backend menjadi konsisten;
- admin tidak kehilangan hasil kerja saat sync ulang.

### Fase 2 - Penyempurnaan alur bisnis lanjutan

Scope:

- desain baru untuk row yang tidak punya `santri_otomatis_id`;
- tindak lanjut `Terpisah` yang terstruktur;
- opsi pembuatan draft santri baru;
- audit trail lanjutan;
- notifikasi atau dashboard prioritas review.

Manfaat:

- flow review menjadi benar-benar tuntas secara operasional;
- bukan hanya benar secara teknis.

## 10. Risiko dan perhatian implementasi

1. **Perubahan pada sync harus menjaga data existing**
   karena tabel `santri_import_reviews` mungkin sudah berisi keputusan manual.
2. **Merge adalah operasi sensitif**
   karena menyentuh `absensi`, `pelanggaran`, dan `perizinan`.
3. **Perlu aturan jelas kapan keputusan lama dianggap usang**
   jika workbook canonical berubah.
4. **Pemilihan target canonical harus hati-hati**
   agar tidak memblokir kasus sah yang memang perlu diarahkan ke santri hasil
   verifikasi baru.
5. **Terminologi UI harus konsisten**
   supaya admin memahami beda antara:
   - status dari workbook;
   - status keputusan admin;
   - status verifikasi kelengkapan master.

## 11. Keputusan review yang saya butuhkan dari Anda

Sebelum saya implementasikan, ada beberapa keputusan bisnis yang sebaiknya Anda
setujui:

1. Apakah row `EXACT` dari workbook canonical perlu tetap tampil di halaman
   review, atau cukup dianggap informasi pasif dan tidak perlu aksi admin?
2. Saat memilih `Terpisah`, apakah Anda ingin:
   - hanya menandai berbeda lalu tindak lanjut manual;
   - atau langsung menyediakan aksi membuat draft santri baru?
3. Bila workbook canonical berubah setelah admin sudah memutuskan sebuah row,
   apakah keputusan lama:
   - tetap dipertahankan sampai admin membuka ulang;
   - atau otomatis diberi flag `perlu review ulang`?
4. Apakah kandidat manual di modal review harus dibatasi hanya ke
   `MASTER_PUTRA`, atau boleh juga memilih santri baru `SANTRI_BARU_2026`
   yang sudah diverifikasi aktif?

## 12. Rekomendasi keputusan awal dari saya

Agar implementasi aman dan bertahap, rekomendasi awal saya:

1. Row `EXACT` tetap disimpan, tetapi default UI hanya menonjolkan
   `REVIEW` dan `UNMATCHED`.
2. `Terpisah` tahap awal cukup menandai berbeda dan membuka tindak lanjut
   manual terstruktur, belum auto-create santri baru.
3. Keputusan admin tetap dipertahankan saat sync ulang, tetapi row diberi flag
   bila kandidat workbook berubah.
4. Kandidat manual dibatasi ke:
   - `status_aktif = 1`
   - bukan `legacy_noncanonical`
   - canonical `MASTER_PUTRA`
   - dan opsional `SANTRI_BARU_2026` yang sudah diverifikasi aktif.

## 13. Hasil akhir yang dituju

Jika rencana ini diterapkan, menu review/verifikasi akan memiliki perilaku
yang lebih sehat:

1. Admin tahu dengan jelas asal data review.
2. Admin tahu mana kekurangan master dan mana konflik identitas.
3. Tombol `Gabungkan` hanya muncul bila benar-benar valid.
4. Tombol `Terpisah` menghasilkan tindak lanjut yang jelas.
5. Sync workbook canonical tidak menghapus keputusan admin.
6. Audit data santri menjadi lebih aman sebelum sistem dipakai penuh untuk
   operasional harian.

## 14. Referensi implementasi yang diaudit

- `backend/app/Console/Commands/ImportMasterPutraCommand.php`
- `backend/app/Http/Controllers/ImportReviewController.php`
- `backend/app/Http/Controllers/MasterController.php`
- `frontend/src/pages/DataMasterPage.tsx`
- `docs/SEEDER.md`
- `docs/ANALISIS_MIGRASI_IMPORT_SERVER.md`
- `docs/WALKTHROUGH_TEST_MVP.md`

## 15. Definition of Done (DoD)

Task ini hanya boleh dinyatakan selesai apabila seluruh kriteria wajib di bawah
ini terpenuhi dan bukti pengujiannya tersedia. Perubahan code, migration,
konfigurasi, seed, dan dokumentasi harus konsisten dengan kriteria yang sama.

### 15.1 Kontrak sumber data

- [ ] Sumber resmi review dinyatakan secara eksplisit sebagai workbook canonical
  `data/MASTER_DATA_SANTRI_PUTRA_2026_2027.xlsx`.
- [ ] Sheet `MASTER_PUTRA` menjadi sumber data master putra, sedangkan sheet
  `REVIEW_MATCH` menjadi sumber antrean review identitas.
- [ ] Nilai `jenis_data` yang dipakai sistem dapat ditelusuri ke sumber
  `ABSENSI_KAMAR`, `PBM`, `PBS`, dan `MADIN` pada TA 2026/2027.
- [ ] Setiap row review menyimpan file Excel mentah, sheet mentah, baris mentah,
  serta referensi workbook `REVIEW_MATCH` dan baris hasil pencocokannya.
- [ ] Nilai kosong/null tidak dipaksa menjadi angka `0`; flag boolean dari
  database tidak dirender sebagai teks `0` di UI.
- [ ] Tidak ada flow legacy yang diam-diam menimpa hasil sync canonical.
  Jika flow legacy masih dipertahankan, batas penggunaan dan statusnya
  terdokumentasi sebagai legacy.
- [ ] Setiap row review memiliki identitas yang idempotent, sehingga sync ulang
  tidak membuat row duplikat untuk sumber yang sama.

### 15.2 Sinkronisasi dan keputusan admin

- [ ] Sync pertama kali membuat row review baru beserta metadata sumber,
  kandidat workbook, skor kemiripan, dan status sumber.
- [ ] Status sumber `EXACT`, `REVIEW`, dan `UNMATCHED` tersimpan tanpa
  diratakan menjadi satu status yang sama.
- [ ] Status sumber review dipisahkan dari status keputusan admin.
- [ ] Sync ulang tidak mengubah atau menghapus keputusan admin
  `digabung`/`terpisah`.
- [ ] Perubahan nama, kamar, kandidat, atau skor pada workbook setelah
  keputusan admin tersimpan sebagai perubahan konteks dan tidak menghilangkan
  keputusan sebelumnya.
- [ ] Perubahan kandidat setelah keputusan admin menghasilkan flag atau status
  `perlu review ulang` yang dapat dilihat admin.
- [ ] Proses sync bersifat aman untuk diulang dan menghasilkan hasil yang sama
  tanpa menambah data review ganda.

### 15.3 Klasifikasi row dan kandidat

- [ ] Sistem membedakan row yang hanya memiliki kandidat workbook dari row yang
  benar-benar memiliki source record untuk operasi merge.
- [ ] Tombol atau endpoint `Gabungkan` hanya tersedia untuk row yang memiliki
  source merge valid.
- [ ] Row kandidat workbook tanpa source merge menggunakan aksi bisnis yang
  sesuai, seperti konfirmasi kandidat atau tautkan ke master, bukan merge
  palsu.
- [ ] UI menampilkan tipe row review dan membedakan minimal:
  `Kandidat workbook`, `Santri auto-create`, dan `Perlu verifikasi manual`.
- [ ] Daftar kandidat manual hanya berisi santri yang memenuhi aturan
  canonical aktif yang telah disepakati.
- [ ] Kandidat manual tidak dapat diarahkan ke santri inactive,
  `legacy_noncanonical`, atau record yang tidak lolos aturan sumber.
- [ ] Backend mengulangi validasi kandidat secara server-side. Kandidat yang
  tidak sah ditolak dengan response `422` dan pesan bisnis yang jelas.

### 15.4 Acceptance `Gabungkan`

- [ ] Admin dapat melihat data sumber, kandidat workbook, status sumber,
  kandidat master yang diperbolehkan, dan alasan keputusan sebelum merge.
- [ ] Backend menolak merge jika source record tidak ada, target tidak aktif,
  target tidak canonical, source dan target sama, atau row tidak berada pada
  tipe yang boleh di-merge.
- [ ] Merge yang valid mengisi field target yang masih kosong sesuai aturan
  enrichment yang terdokumentasi.
- [ ] Relasi transaksi source yang memang wajib dipindahkan dipindahkan ke
  target tanpa kehilangan atau menggandakan data.
- [ ] Konflik relasi, terutama pada absensi, pelanggaran, dan perizinan,
  terdeteksi dan ditangani sesuai kebijakan; sistem tidak melakukan merge
  diam-diam ketika konflik belum terselesaikan.
- [ ] Source setelah merge mengikuti kebijakan lifecycle yang disepakati,
  yaitu diarsipkan atau dihapus secara terkontrol, dan statusnya dapat
  ditelusuri.
- [ ] Row review berubah menjadi `digabung` hanya setelah seluruh operasi
  merge berhasil dalam satu transaksi yang aman.
- [ ] Refresh halaman dan sync ulang tidak memunculkan kembali row yang sudah
  berhasil digabung, kecuali ada perubahan sumber yang memang ditandai untuk
  review ulang.

### 15.5 Acceptance `Terpisah`

- [ ] Admin dapat menyimpan keputusan `Terpisah` dengan catatan opsional.
- [ ] Sistem menyimpan siapa yang memutuskan, kapan keputusan dibuat, dan
  alasan/catatan keputusan.
- [ ] Sistem membedakan kasus `terpisah_sudah_ada_di_master` dan
  `terpisah_belum_ada_di_master`.
- [ ] Jika master kedua sudah ada, row review ditutup tanpa membuat duplikat
  santri baru.
- [ ] Jika master kedua belum ada, row review berubah menjadi status tindak
  lanjut yang jelas, misalnya `terpisah_perlu_buat_master`.
- [ ] Untuk kasus belum ada master, UI menyediakan langkah lanjutan yang jelas
  untuk membuat atau melengkapi master baru, atau secara eksplisit menampilkan
  bahwa proses masih menunggu tindakan manual.
- [ ] Keputusan `Terpisah` tetap bertahan setelah refresh dan sync ulang.

### 15.6 UI dan terminologi

- [ ] Filter sumber review menggunakan nilai sumber canonical aktual atau enum
  sumber resmi, bukan label legacy yang misleading.
- [ ] Tabel atau modal review menampilkan asal sheet, baris sumber, konteks
  tambahan, kandidat workbook, dan kandidat master final.
- [ ] Status sumber dan status keputusan admin tampil sebagai dua informasi
  yang berbeda.
- [ ] Visibilitas tombol aksi mengikuti tipe row dan status row yang sebenarnya.
- [ ] Pesan hasil sync, merge, separate, validasi, dan konflik konsisten dengan
  response backend.
- [ ] UI memiliki state loading, error, empty, dan success yang dapat dipahami
  admin tanpa melihat log teknis.
- [ ] Label produk dan role mengikuti istilah resmi repo serta tidak
  menghidupkan kembali istilah role legacy.

### 15.7 Keamanan data dan audit trail

- [ ] Semua validasi sensitif diterapkan di backend dan tidak hanya bergantung
  pada filter atau pilihan UI.
- [ ] Endpoint aksi review memeriksa autentikasi dan otorisasi role yang
  diperbolehkan.
- [ ] Input catatan keputusan divalidasi panjang, tipe, dan sanitasi sesuai
  standar aplikasi.
- [ ] Aksi `Gabungkan`, `Terpisah`, perubahan kandidat, dan penolakan validasi
  tercatat pada log/audit event yang memuat aktor, waktu, row review, source,
  target, dan hasil aksi.
- [ ] Audit trail tetap dapat dibaca setelah source diarsipkan atau status row
  berubah.
- [ ] Operasi merge tidak meninggalkan transaksi setengah jadi ketika terjadi
  exception atau kegagalan database.

### 15.8 Pengujian minimum

- [ ] Unit test mencakup normalisasi status sumber, pembentukan key review,
  klasifikasi tipe row, dan aturan kandidat canonical.
- [ ] Feature test mencakup sync pertama kali dan sync ulang idempotent.
- [ ] Feature test membuktikan keputusan `digabung` tidak tertimpa sync ulang.
- [ ] Feature test membuktikan keputusan `terpisah` tidak tertimpa sync ulang.
- [ ] Feature test menolak target merge inactive, legacy, tidak ditemukan,
  atau tidak canonical dengan `422`.
- [ ] Feature test menolak merge ketika source merge tidak tersedia.
- [ ] Feature test mencakup merge valid, konflik relasi, dan rollback saat
  operasi gagal.
- [ ] Feature test mencakup `Terpisah` dengan dan tanpa catatan serta kedua
  status tindak lanjutnya.
- [ ] Test UI atau smoke test mencakup filter sumber canonical, badge status,
  pencarian kandidat, dan visibilitas tombol aksi.
- [ ] Regression test memastikan data master putra, absensi, pelanggaran,
  perizinan, dan portal wali tidak rusak oleh perubahan review.

### 15.9 Dokumentasi dan bukti rilis

- [ ] Schema, migration, enum status, dan kontrak endpoint diperbarui sesuai
  perilaku yang benar-benar diimplementasikan.
- [ ] Dokumen menjelaskan asal data kandidat: kandidat default berasal dari
  `REVIEW_MATCH`, sedangkan kandidat manual berasal dari daftar master yang
  sudah difilter dengan aturan canonical.
- [ ] Dokumen menjelaskan perbedaan antrean verifikasi kelengkapan master dan
  antrean review kemiripan identitas.
- [ ] Runbook menjelaskan cara menjalankan sync, memeriksa hasil, menangani
  conflict, dan melakukan recovery bila merge gagal.
- [ ] Hasil test, contoh response error, dan bukti smoke test disimpan atau
  ditautkan pada task/PR.
- [ ] Migration dan perubahan data existing diuji pada salinan data staging
  sebelum diterapkan ke data operasional.
- [ ] Tidak ada known high atau critical issue yang belum memiliki keputusan
  eksplisit dari pemilik produk.

### 15.10 Skenario acceptance end-to-end

Task dianggap lolos secara bisnis bila minimal skenario berikut berhasil:

1. Admin melakukan sync workbook TA 2026/2027. Row dari `ABSENSI_KAMAR`,
   `PBM`, `PBS`, dan `MADIN` masuk tanpa duplikasi serta menampilkan status
   sumber yang benar.
2. Admin memeriksa row `REVIEW`, memilih kandidat canonical aktif, dan
   menyimpan keputusan. Setelah sync ulang, keputusan tetap ada.
3. Admin mencoba memilih kandidat inactive atau legacy. UI tidak menampilkan
   kandidat tersebut, dan backend tetap menolak manipulasi langsung dengan
   response `422`.
4. Admin mencoba merge pada row yang hanya memiliki kandidat workbook tanpa
   source merge. Sistem tidak melakukan pemindahan data dan menampilkan aksi
   konfirmasi/tautkan yang sesuai.
5. Admin melakukan merge pada row dengan source valid. Target menerima data
   yang diizinkan, relasi tidak hilang atau ganda, audit trail tercatat, dan
   row berubah menjadi `digabung`.
6. Admin memilih `Terpisah` dengan catatan. Sistem menyimpan aktor, waktu,
   catatan, dan tindak lanjut; sync ulang tidak membuka ulang keputusan tersebut.
7. Workbook berubah setelah sebuah keputusan dibuat. Sistem mempertahankan
   keputusan lama dan menampilkan indikator bahwa row perlu ditinjau ulang.

### 15.11 Kondisi task belum boleh ditutup

Task belum memenuhi DoD apabila salah satu kondisi berikut masih terjadi:

- sync ulang dapat menghapus keputusan admin;
- kandidat manual masih dapat memilih target yang tidak canonical aktif;
- status `EXACT`, `REVIEW`, dan `UNMATCHED` masih kehilangan makna;
- tombol `Gabungkan` tersedia untuk row tanpa source merge yang valid;
- `Terpisah` hanya mengganti label tanpa tindak lanjut yang dapat dipahami;
- operasi merge dapat meninggalkan data setengah pindah atau duplikat;
- tidak ada audit trail untuk aksi merge/separate;
- test hanya mencakup happy path tanpa menguji invalid target, conflict, dan
  sync ulang;
- dokumentasi masih menyatakan sumber review berasal dari flow legacy, bukan
  workbook canonical TA 2026/2027.

## 16. Catatan implementasi

Implementasi fase fondasi dari rencana ini telah diterapkan dengan cakupan:

- migration `2026_09_12_000001_harden_santri_import_review_decisions.php` untuk
  menyimpan status sumber, tipe row, keputusan admin, snapshot kandidat,
  tindak lanjut, dan flag perubahan sumber;
- migration `2026_09_12_000002_add_review_excel_provenance.php` untuk menyimpan
  file Excel mentah, sheet/baris mentah, serta file/sheet/baris `REVIEW_MATCH`;
- migration `2026_09_12_000003_fix_review_source_identity_collision.php` untuk
  mengganti key lama `sumber_sheet + baris_sumber` dengan identitas file/sheet/baris,
  sehingga nomor baris yang berulang pada sheet kamar tidak saling menimpa;
- importer canonical yang idempotent serta tidak menimpa keputusan final
  `digabung`/`terpisah` saat sync ulang;
- endpoint `GET /api/master/import-reviews/candidates` yang hanya mengembalikan
  santri canonical aktif;
- endpoint `POST /api/master/import-reviews/{id}/confirm` untuk row
  `REVIEW_MATCH` yang hanya memiliki kandidat workbook tanpa source transaksi;
- validasi server-side target merge, sanitasi catatan keputusan, audit trail,
  pemeriksaan konflik absensi, dan pengarsipan source setelah merge;
- UI filter sumber canonical `ABSENSI_KAMAR`, `PBM`, `PBS`, dan `MADIN`, badge
  status sumber, pencarian kandidat canonical, serta pilihan tindak lanjut
  `Terpisah`.
- UI review menampilkan provenance sebagai `Data Excel`, `Sheet`, `Baris`, dan
  referensi `REVIEW_MATCH`, bukan hanya label `Sumber Review`;
- skor null ditampilkan sebagai belum tersedia, dan flag `perlu_review_ulang`
  tidak lagi menghasilkan teks `0` ketika bernilai false.
- sinkronisasi development menghasilkan 516 row review, terdiri dari 163
  `ABSENSI_KAMAR`, 86 `MADIN`, 156 `PBM`, dan 111 `PBS`, seluruhnya dengan
  `status_provenance=TERVERIFIKASI`.

Verifikasi yang sudah dijalankan:

- `ImportReviewFeatureTest`: 5 test lulus, 20 assertion;
- regression area terkait verifikasi dan upload foto: 11 test lulus, 72
  assertion;
- build frontend TypeScript/Vite lulus;
- detector Impeccable untuk `DataMasterPage.tsx` tidak menemukan temuan.

Pembuatan master baru setelah keputusan `Terpisah` masih mengikuti Opsi B pada
rencana: row diberi status tindak lanjut `terpisah_belum_ada_di_master` dan
penyelesaian pembuatan master dilakukan secara manual terstruktur. Dua test
lain di full suite saat ini gagal di area rate-limit absensi dan password-gate,
di luar perubahan review ini; detail tersebut harus diselesaikan terpisah
sebelum DoD rilis keseluruhan ditutup.
