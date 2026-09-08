# AGENTS.md - Scope Project SIMANTEB v3

Repo ini adalah paket acuan SIMANTEB v3 yang dipisahkan dari codebase legacy.
Isi utamanya saat ini adalah dokumen produk/teknis, sumber data seed canonical,
dan aset icon. Jangan bertindak seolah seluruh aplikasi backend/frontend sudah
ada di repo ini; bila perlu membuat scaffold atau proposal implementasi, semua
keputusan harus tetap tunduk pada dokumen di `docs/`.

## 1. Sumber Kebenaran

Urutan acuan kerja untuk repo ini:

1. `docs/prd.md` untuk scope produk, route UI, kontrak endpoint, dan hak akses.
2. `docs/roles.md` untuk alur kerja dan pengalaman tiap role.
3. `docs/desain.md` untuk keputusan visual, copy, token, dan larangan desain.
4. `docs/specs.md` untuk stack target dan arsitektur implementasi.
5. `docs/SEEDER.md` untuk aturan seed, import, dan baseline data.
6. `docs/README.md` untuk ringkasan paket acuan v3 ini.

Jika ada konflik interpretasi:

- `prd.md` menentukan apa yang dibangun dan siapa yang boleh melakukannya.
- `roles.md` menentukan bagaimana pekerjaan itu harus terasa di UI.
- `desain.md` menentukan bagaimana tampilannya.
- `specs.md` menentukan bagaimana implementasinya dibangun.

Catatan penting: beberapa markdown link di dokumen masih menunjuk absolute path
repo lama `tebuirengv2`. Untuk scope project ini, tetap gunakan file lokal di
folder `./docs/` sebagai sumber kebenaran, bukan path legacy tersebut.

## 2. Scope Produk Yang Wajib Dijaga

- Scope rilis awal hanya untuk data santri putra. Data putri belum masuk scope.
- Modul inti yang menjadi acuan: enam modul absensi, perizinan/gerbang,
  pelanggaran, prestasi, raport pengajian, raport pembinaan, verifikasi data,
  laporan, dan portal wali santri.
- Role resmi yang boleh dipakai: Admin, Keamanan, Pembina Kamar,
  Wali Kelas, Piket Pengajian, dan Wali Santri.
- Jangan menghidupkan kembali role legacy seperti `Pengasuh` sebagai acuan
  produk baru kecuali ada keputusan eksplisit yang mengubah PRD.
- Portal wali bersifat read-only terhadap data operasional anak.

## 3. Aturan Istilah Produk

- Tampilkan nama produk **Raport Pembinaan** di UI. Namespace teknis
  `ubudiyah` hanya untuk route, endpoint, atau struktur internal.
- Untuk perizinan, gunakan status resmi `Disetujui`, `Sedang Berjalan`,
  dan `Selesai`. Jangan kembali ke istilah legacy seperti `keluar`/`kembali`
  sebagai label status utama.
- Domain PBS, PBM, dan Madin dipayungi role produk **Piket Pengajian**.
- Untuk rumpun `kamar`, UI harus membedakan **Keberangkatan Kelas** dan
  **Kamar** sebagai dua konteks operasional, walau keduanya tetap memakai kode
  teknis `kamar`.

## 4. Guardrail Implementasi

- Stack target mengikuti `docs/specs.md`: Laravel 12, MySQL 8, Inertia.js v3,
  Vue 3 Composition API + TypeScript, Tailwind CSS v4, Pinia, dan auth session
  stateful dua guard.
- Arsitektur target adalah monolith Laravel + Inertia, bukan SPA terpisah
  dengan API publik yang berdiri sendiri.
- Absensi tidak offline-first. Data dianggap tersimpan hanya setelah server
  mengonfirmasi keberhasilan.
- Jangan menambahkan capability, endpoint, tombol, atau workflow yang tidak
  punya dasar jelas di `prd.md`, `roles.md`, atau `desain.md`.
- Jika dokumen menyebut command, table, atau path target yang belum ada di repo,
  perlakukan itu sebagai kontrak yang harus diwujudkan nanti, bukan bukti bahwa
  implementasinya sudah tersedia sekarang.

## 5. Guardrail Data

- File di folder `data/` adalah sumber seed canonical yang disepakati untuk
  paket v3 ini.
- Sheet `REVIEW_MATCH` adalah antrean verifikasi Dashboard. Kandidat ambigu
  tidak boleh langsung di-seed sebagai transaksi atau mapping final.
- Import histori pelanggaran, prestasi, atau alumni harus selalu dicocokkan
  dulu ke master putra sebelum dianggap data operasional valid.
- Jangan mencampur workbook legacy ke database target tanpa aturan pencocokan
  yang jelas dari `docs/SEEDER.md`.

## 6. Guardrail Desain Tambahan: Anti AI Design Slop

Aturan di bagian ini berlaku default untuk semua pekerjaan UI, mockup, page,
komponen, wireframe, dan visual di repo ini, kecuali user secara eksplisit
meminta gaya berbeda dan permintaan itu tetap tidak bertentangan dengan
`docs/desain.md`.

### 6.1. Warna dan efek

- Jangan default ke gradient ungu ke pink, biru ke ungu, rainbow gradient,
  glowing gradient background, gradient text, gradient cards, atau gradient
  buttons.
- Jangan default ke palet pastel startup seperti pastel purple, pastel pink,
  pastel blue, atau pastel rainbow.
- Mulai dari fondasi netral atau grayscale dengan warna aksen yang tertahan.
- Gunakan solid color lebih dulu. Warna harus mendukung hierarki, bukan
  menjadi hierarki utama.
- Default warna maksimum:
  - satu accent color,
  - satu danger color,
  - dan grayscale netral.
- Jangan memakai lebih dari tiga warna semantik utama kecuali ada alasan
  fungsional yang jelas.

### 6.2. Pola layout dan komponen yang dilarang

- Jangan gunakan pola left border accent card, colored stripe card, atau
  quote-block feature card sebagai default.
- Hindari pola seperti ini kecuali memang ada alasan produk yang kuat:

```html
<div class="border-l-4 border-blue-500 pl-4">
```

- Jangan spam halaman dengan metric cards, quick action cards, insight cards,
  atau summary cards. Setiap card harus punya alasan keberadaan yang jelas.
- Utamakan information density daripada card density.
- Jangan otomatis membuat hero section template berisi giant headline, giant
  gradient text, giant CTA, atau giant dashboard screenshot kecuali layar itu
  benar-benar landing page marketing.
- Jangan otomatis membuat feature grid template tiga kolom dengan banyak card
  identik pola icon + title + description. Rancang layout berdasarkan
  informasi, bukan template.

### 6.3. Ikon, radius, shadow, dan noise

- Jangan gunakan emoji sebagai ikon UI seperti `🚀`, `✨`, `🎯`, `💡`, atau `📈`.
- Jika perlu ikon, gunakan proper icon library seperti Lucide, Heroicons, atau
  Tabler. Jika ikon tidak membantu, lebih baik tanpa ikon.
- Jangan default ke border radius besar seperti `24px` atau `32px`.
- Radius yang lebih disukai: `4px`, `6px`, `8px`, atau `12px`. Radius besar
  harus jarang dan punya alasan.
- Jangan default ke `shadow-xl`, floating card di mana-mana, glowing card,
  atau blurred shadow besar.
- Utamakan border, spacing, dan contrast sebelum menambah shadow.
- Jangan tambahkan artificial visual noise seperti floating blobs, abstract
  gradients, random background patterns, decorative circles, decorative dots,
  atau decorative sparkles.
- Setiap elemen visual harus punya fungsi nyata, bukan sekadar hiasan.

### 6.4. Prinsip hirarki

- Hierarki utama harus datang dari layout, spacing, dan typography.
- Warna adalah alat terakhir, bukan alat pertama.
- Utamakan production UI yang tenang dan bisa dipakai lama daripada konsep
  visual pameran.
- Referensi rasa yang lebih dekat dengan standar ini: Linear, Stripe, Notion,
  GitHub, Vercel, dan Anthropic.
- Hindari gaya flashy ala konsep Dribbble, Behance-style concept, atau
  glassmorphism yang tidak realistis untuk produk operasional.
- Asumsi bahasa desain default:
  - neutral background,
  - subtle borders,
  - restrained color,
  - minimal shadows,
  - readable typography,
  - high information density.

### 6.5. Checklist sebelum submit desain

- Apakah desain ini masih terlihat baik dalam grayscale?
- Apakah hierarkinya tetap terbaca tanpa warna?
- Apakah setiap card benar-benar diperlukan?
- Apakah setiap ikon benar-benar diperlukan?
- Apakah setiap shadow benar-benar diperlukan?
- Apakah setiap gradient benar-benar diperlukan?
- Jika jawabannya tidak, hapus elemen tersebut.

## 7. Aturan Kerja Agent Di Repo Ini

- Baca dokumen yang relevan lebih dulu sebelum menulis scaffold, skema, halaman,
  atau copy.
- Karena repo ini masih berupa paket acuan, perubahan yang paling sering benar
  adalah perubahan dokumentasi, struktur, atau bootstrap awal; jangan mengarang
  file aplikasi besar hanya untuk "melengkapi" repo.
- Jika mendesain UI, baca subbagian role yang relevan di `docs/roles.md` dan
  patuhi larangan visual di `docs/desain.md`.
- Jika mengusulkan schema, endpoint, atau import flow, cocokkan lagi dengan
  `docs/prd.md`, `docs/specs.md`, dan `docs/SEEDER.md`.
- Bila keputusan scope produk berubah, perbarui file ini agar agent berikutnya
  tidak membawa asumsi lama.

## 8. Definisi Selesai

Sebuah perubahan belum selesai bila:

- memperluas scope tanpa dasar dokumen;
- memakai istilah legacy yang sudah diganti oleh produk baru;
- mengasumsikan data putri, workflow offline, atau role non-resmi sudah aktif;
- membuat UI generik yang bertentangan dengan `docs/desain.md`;
- melanggar guardrail anti AI design slop di Bagian 6 tanpa alasan yang jelas;
- atau mengubah aturan data/import tanpa menyesuaikan dokumentasi acuan.
