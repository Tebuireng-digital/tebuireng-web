# Desain: Sistem Pendataan Pesantren Putra

Dokumen ini adalah spesifikasi arah visual untuk tim frontend (React), bukan brand guideline generik. Setiap keputusan di bawah diturunkan dari satu kondisi pemakaian nyata, bukan dari template dashboard yang biasa dipakai untuk produk apa pun.

## 0. Titik tolak: siapa yang memakai ini, dan dalam kondisi apa

Musyrif kamar berdiri di lorong asrama jam 20:00, satu tangan pegang HP, satu tangan lagi mungkin pegang buku jaga yang lama belum dibuang. Cahayanya lampu neon koridor, bukan meja kerja. Ustadz Diniyah input absensi sambil santri masih antre di depan kelas — dia butuh selesai dalam hitungan detik per santri, bukan menikmati transisi halaman. Keamanan mengisi form izin sambil motor penjemput sudah menyala di depan gerbang.

Ini bukan produk yang "dijual" lewat halaman landing yang cantik. Ini alat kerja harian yang dipakai berulang, di bawah tekanan waktu, sering dengan sinyal lemah. Konsekuensinya untuk desain:

- Kecepatan baca dan sentuh mengalahkan estetika dekoratif.
- Warna status harus bisa dibaca sekilas, termasuk di layar yang redup/pantulan cahaya HP.
- Elemen yang berulang (grid nama santri, pill status, kartu izin) harus konsisten sampai jadi refleks otot, bukan "menyegarkan" tiap update desain.
- Tidak ada hero, tidak ada halaman marketing di dalam produk ini. Prinsip "hero sebagai tesis" dari playbook desain umum sengaja tidak dipakai di sini — satu-satunya "hero" adalah daftar santri yang harus ditandai secepat mungkin.

## 1. Yang secara sadar dihindari

Supaya jelas apa yang ditolak, bukan cuma apa yang dipilih:

- **Krem hangat + serif kontras tinggi + aksen terracotta** (pola default asisten AI saat ini). Tidak relevan untuk alat operasional yang dipakai sambil berdiri di lorong asrama.
- **Latar nyaris hitam + aksen neon hijau/vermillion.** Kontras ekstrem seperti ini melelahkan untuk dilihat berulang kali per hari, dan tidak menyisakan "warna" untuk sistem status (hadir/izin/sakit/alpha/terlambat) yang justru harus jadi elemen warna utama di produk ini.
- **Gaya broadsheet/koran: hairline rules, radius nol, kolom padat.** Konteksnya sidebar-heavy desktop reading, bukan grid sentuh di layar 375px lebar.
- Gradient, drop shadow, glow — semua dihindari kecuali fungsi murni menandai state "sedang sinkron" (lihat §5).
- Angka langkah dekoratif (01 / 02 / 03) di tempat yang bukan urutan sungguhan. Satu-satunya penomoran berurutan yang dipakai adalah nomor urut santri (`NO`) — karena itu memang urutan asli dari buku daftar hadir fisik, bukan hiasan.

## 2. Signature element: tata letak buku induk, bukan dashboard kartu

Elemen yang membuat produk ini dikenali bukan warna atau font, tapi **struktur tabel `NO | NAMA | STATUS`** yang diwariskan langsung dari buku absen kertas yang selama ini dipakai pengasuhan (kolom `NO`, `NAMA LENGKAP`, grid tanggal 1–31 per bulan). Ini bukan pilihan nostalgia — musyrif dan ustadz sudah punya kebiasaan baca dari kiri (nomor) ke kanan (nama) ke ujung (status/tanggal) selama bertahun-tahun dari buku fisik. Mendigitalkan pola baca yang sudah ada mengurangi beban belajar ulang, bukan sekadar estetika "vintage ledger".

Konsekuensi konkret:
- Semua layar bulk-input (Kamar, Sekolah, PBS, PBM, Diniyah) memakai satu komponen dasar: **baris ledger** — nomor urut di kiri (lebar tetap, monospace, abu redup), nama di tengah (lebar fleksibel, jadi elemen paling menonjol di baris), status di kanan (pill besar, target sentuh ≥ 44px).
- Baris genap/ganjil dibedakan dengan beda kecerahan latar tipis (bukan garis pembatas tiap baris) — meniru cara mata menyusuri baris panjang di buku fisik tanpa penggaris.
- Header kolom nempel (sticky) saat scroll, karena satu kamar/kelas bisa 30–50 santri.

## 3. Token warna

Warna di produk ini punya dua lapis: **warna netral untuk struktur**, dan **warna status untuk data** — keduanya sengaja dipisah jauh secara persepsi supaya status tidak pernah tenggelam di antara warna dekoratif UI.

**Netral (struktur UI):**

| Token | Hex | Pemakaian |
| --- | --- | --- |
| `--kertas` | `#EEF1EC` | Latar utama — abu-hijau pucat, bukan krem hangat, terinspirasi warna kertas HVS daftar hadir yang sudah agak menguning-kehijauan setelah difotokopi berkali-kali |
| `--kertas-kartu` | `#FFFFFF` | Latar kartu/baris di atas `--kertas`, kontras tipis lewat shadow 1px, bukan border tebal |
| `--tinta` | `#1C2420` | Teks utama — hitam-kehijauan gelap, bukan hitam pekat |
| `--tinta-pudar` | `#5B655F` | Teks sekunder (label, timestamp, nomor urut) |
| `--garis` | `#D6DBD3` | Pembatas halus |
| `--aksen` | `#0F6E56` | Satu-satunya warna brand — hijau tua terinspirasi warna mihrab/keramik masjid pesantren, dipakai untuk elemen interaktif utama (tombol simpan, tab aktif), **tidak pernah** dipakai untuk status kehadiran supaya tidak bentrok makna dengan hijau "Hadir" |

**Status (data, satu-satunya tempat warna "ramai" boleh muncul):**

| Status | Token | Hex | Alasan pemilihan |
| --- | --- | --- | --- |
| Hadir | `--status-hadir` | `#3F7D45` | Hijau daun — netral-positif, beda ton dari `--aksen` supaya tidak tertukar makna |
| Izin | `--status-izin` | `#B8862E` | Kuning-tembaga, seperti warna kuningan ornamen mimbar — "sedang di luar dengan alasan sah", bukan warning merah |
| Sakit | `--status-sakit` | `#3A6EA5` | Biru — netral, tidak menghakimi |
| Alpha | `--status-alpha` | `#A23B2E` | Merah-bata — satu-satunya status yang perlu "menonjol untuk ditindaklanjuti" |
| Terlambat | `--status-terlambat` | `#C97A2B` | Oranye — sengaja di antara Izin dan Alpha secara visual, karena secara makna juga di antara keduanya |

Kelima warna status ini diuji kontras WCAG AA terhadap `--kertas-kartu` sebelum dipakai sebagai fill pill (teks putih di atasnya), dan sebagai teks pill outline (fill 10% opacity + teks warna penuh) untuk mode hemat-kontras di layar terik.

## 4. Tipografi

Dua peran huruf, dipilih karena alasan fungsional, bukan sekadar "pairing yang enak dilihat":

- **Plus Jakarta Sans** — untuk semua teks UI (label, judul, nama santri, tombol). Dipilih karena dirancang dan diproduksi di Indonesia (Jakarta), humanist, dan sangat legible di ukuran kecil pada layar — relevan karena target device utama adalah HP, bukan sekadar preferensi estetika.
- **IBM Plex Mono** — khusus untuk **data tabular**: nomor urut, NIS, tanggal, poin pelanggaran, jam. Digunakan supaya kolom angka rapi sejajar (tabular figures) dan supaya mata langsung bisa membedakan "ini kolom data" vs "ini label" tanpa perlu warna berbeda — meniru cara buku daftar hadir fisik biasanya ditulis tangan lebih rapi/kotak di kolom angka.

Skala tipe (mobile-first, breakpoint tunggal di 768px untuk tablet pengasuh):

| Peran | Ukuran mobile | Weight | Font |
| --- | --- | --- | --- |
| Judul layar | 18px | 600 | Plus Jakarta Sans |
| Nama santri (baris ledger) | 15px | 500 | Plus Jakarta Sans |
| Label/status kecil | 12px | 500, uppercase, tracking +0.02em | Plus Jakarta Sans |
| Data tabular (NIS, nomor, jam, poin) | 14px | 400, tabular-nums | IBM Plex Mono |
| Body/deskripsi (form pelanggaran, izin) | 14px | 400 | Plus Jakarta Sans |

Tidak ada varian display/hero besar (32px+) di mana pun dalam produk — tidak ada halaman yang butuh itu.

## 5. Komponen inti

**Pill status** — bentuk kapsul (`border-radius: 999px`), padding cukup untuk target sentuh 44px tinggi, satu warna solid dari §3. Tap sekali untuk siklus status (Hadir → Izin → Sakit → Alpha → Terlambat → Hadir), long-press untuk buka detail (keterangan, menit terlambat). Tidak pakai dropdown/select untuk aksi paling sering dilakukan ribuan kali sehari.

**Baris ledger** — lihat §2. Tinggi baris tetap 56px agar rapat tapi tetap gampang di-tap tanpa salah baris.

**Indikator sinkron** — satu-satunya tempat animasi dipakai secara sengaja: titik kecil di pojok kanan atas layar bulk-input. Abu diam = tersinkron, oranye berdenyut halus (`opacity` 0.4↔1, 1.5 detik, `prefers-reduced-motion` dihormati) = ada data di antrean offline, merah diam = gagal sinkron perlu perhatian. Tidak ada toast/notifikasi yang menutupi layar — musyrif tidak boleh kehilangan baris yang sedang ditandai gara-gara popup.

**Kartu progres izin berjenjang** — bukan stepper generik bertitik. Divisualisasikan sebagai **lembar disposisi** (pola yang sudah dikenal dari alur birokrasi pesantren/sekolah: kertas dengan kolom paraf berurutan) — tiga baris horizontal (Wali Kamar / Pengasuh / Keamanan), tiap baris menampilkan nama pemutus + waktu keputusan begitu terisi, garis penghubung antar baris solid kalau sudah lewat, putus-putus kalau masih menunggu. Ini numbered-sequence yang sah dipakai (bukan dekorasi 01/02/03) karena memang mencerminkan urutan approval sungguhan yang harus berurutan.

**Dashboard pengasuh** — satu-satunya layar yang boleh terasa lebih "lapang": ringkasan persentase kehadiran per modul hari ini ditampilkan sebagai angka besar (IBM Plex Mono, 28px) + label modul di bawahnya, disusun grid 2 kolom di mobile / 5 kolom di tablet, tanpa chart hias — chart batang/garis hanya muncul di halaman laporan detail saat pengasuh sengaja masuk untuk analisis, bukan di ringkasan harian yang dilihat sekilas.

## 6. Interaksi & motion

Motion dipakai seminimal mungkin, dan hanya untuk mengonfirmasi state, bukan untuk "terasa halus":

- Perubahan status pill: transisi warna 120ms, tanpa scale/bounce.
- Baris tersimpan (setelah bulk save): kedip latar hijau tipis 300ms lalu kembali normal — konfirmasi tanpa perlu teks "Tersimpan" yang memenuhi layar.
- Tidak ada page transition animasi antar layar (kecepatan navigasi lebih penting).
- Semua animasi dibungkus `@media (prefers-reduced-motion: no-preference)`.

## 7. Aksesibilitas & kondisi lapangan (bukan tambahan, tapi syarat)

- Kontras semua teks minimal AA di kondisi cahaya terik (diuji bukan cuma di monitor desain, tapi di foto layar HP di bawah sinar matahari langsung).
- Target sentuh minimal 44×44px untuk semua pill status dan tombol aksi — jempol musyrif yang buru-buru tidak boleh salah tap ke santri sebelah.
- Fokus keyboard terlihat jelas (untuk Admin yang kerja dari laptop input data master).
- Label bukan placeholder — field form (izin, pelanggaran) selalu punya label statis di atas input, bukan placeholder yang hilang saat mulai mengetik, supaya tidak salah isi saat buru-buru.

## 8. Nada tulisan (copy)

Mengikuti prinsip "tulis dari sisi pemakai, bukan sisi sistem":

- Tombol memakai kata kerja aktif dan konsisten: "Simpan absensi", bukan "Submit". Setelah disimpan, konfirmasi memakai kata yang sama: "Absensi tersimpan", bukan "Data berhasil dikirim".
- Pesan error menjelaskan apa yang terjadi dan apa yang bisa dilakukan, tanpa nada minta maaf berlebihan: "Belum tersinkron — akan otomatis terkirim saat sinyal kembali", bukan "Maaf, terjadi kesalahan pada sistem".
- Layar kosong (misal kamar belum punya santri terdaftar) ditulis sebagai ajakan bertindak: "Belum ada santri di kamar ini — tambahkan dari Data Master", bukan sekadar "Tidak ada data".
- Istilah yang dipakai di UI mengikuti istilah yang sudah dipakai pengasuhan sehari-hari (Kamar, PBS, PBM, Diniyah, Boyong, Musyrif) — bukan istilah generik "kelas" atau "sesi" yang terasa asing bagi penggunanya.
