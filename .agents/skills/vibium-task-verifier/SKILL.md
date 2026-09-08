---
name: vibium-task-verifier
description: Verifikasi hasil kerja AI yang terlihat di browser menggunakan Vibium dengan membandingkan brief, diff, dan perilaku aplikasi nyata. Gunakan saat user meminta cek apakah task web/frontend sudah benar di localhost atau preview; jangan gunakan untuk pekerjaan backend-only yang tidak punya bukti browser.
---

# Vibium Task Verifier

Verifikasi hasil kerja AI berdasarkan bukti, bukan klaim model, `git diff`, atau screenshot tunggal. Skill ini dipakai untuk tugas yang outcome-nya bisa diamati di browser: halaman baru, bugfix UI, form, role/access, navigasi, approval flow, empty/error/loading state, dan responsive behavior.

Jangan mengubah source code, konfigurasi, database, atau data nyata sebagai bagian dari verifikasi. Jika butuh submit, delete, approve, atau aksi mutatif lain, gunakan fixture atau state test yang aman; bila tidak ada, berhenti sebelum mutasi dan tandai item itu sebagai `blocked`.

## Workflow

### 1. Pahami kontrak task

- Baca `AGENTS.md` yang berlaku.
- Untuk repo ini, mulai dari `.agents/AGENTS.md`, lalu baca dokumen `docs/` yang relevan:
  - `prd.md` untuk scope route, role, dan kontrak fitur;
  - `roles.md` untuk alur kerja per role;
  - `desain.md` untuk ekspektasi UI;
  - `specs.md` untuk batasan implementasi.
- Ambil acceptance criteria dari brief user, issue, TODO, atau jawaban agent sebelumnya.
- Ubah requirement menjadi checklist singkat `klaim -> bukti browser yang diharapkan`.

### 2. Petakan scope implementasi

- Cek file yang berubah, route, layout, state store, endpoint, validation, dan test terkait memakai `rg`, `git diff`, dan pembacaan file yang terarah.
- Tujuannya bukan menyetujui diff, tetapi mengetahui flow apa yang wajib dibuktikan di browser.
- Jangan menandai item `passed` hanya karena source terlihat benar atau test lulus.

### 3. Siapkan environment verifikasi

- Jalankan app memakai command repo bila belum tersedia.
- Resolve Vibium sekali: coba `vibium`, lalu `./clicker/bin/vibium`, lalu `./node_modules/.bin/vibium`. Pastikan dengan `--help`.
- Jangan menebak URL, credential, atau role. Gunakan storage state atau akun test yang sudah disediakan.
- Jangan menulis credential, token, atau data sensitif ke laporan maupun screenshot.
- Jika Vibium atau app tidak dapat dijalankan, lanjutkan audit source seperlunya tetapi tandai bukti browser sebagai `blocked`, bukan `verified`.

### 4. Verifikasi setiap acceptance item di browser

- Uji minimal desktop dan mobile untuk flow utama.
- Gunakan pola dasar berikut dan sesuaikan port atau route:

```bash
vibium go http://localhost:5173/<route>
vibium wait load
vibium viewport 1440 900
vibium screenshot --full-page -o /tmp/vibium-verify-desktop.png
vibium a11y-tree --everything
vibium map
vibium viewport 390 844
vibium screenshot --full-page -o /tmp/vibium-verify-mobile.png
```

- Gunakan `find`, `click`, `fill`, `press`, `scroll`, `hover`, `dialog`, `text`, `is`, dan `diff map` untuk membuktikan flow nyata.
- Verifikasi state yang relevan untuk task tersebut: loading, empty, success, error, validation, disabled, permission denied, responsive overflow, focus visibility, dan hasil akhir setelah aksi.
- Untuk bugfix, ikuti langkah reproduksi asli bila ada. Jika tidak ada, nyatakan asumsi reproduksi yang dipakai.

### 5. Beri verdict yang tegas

- `verified`: acceptance item terbukti dari interaksi Vibium, screenshot, accessibility tree, atau state akhir yang terlihat.
- `failed`: perilaku aktual bertentangan dengan acceptance criteria.
- `partial`: sebagian acceptance item lolos, sebagian `failed` atau `blocked`.
- `blocked`: tidak aman atau tidak mungkin diverifikasi karena app, auth, fixture, dependency, atau Vibium tidak tersedia.
- `inferred`: source mengindikasikan implementasi ada, tetapi belum terbukti di browser. `inferred` tidak boleh dihitung sebagai pass.

## Batasan penting

- Jangan self-certify pekerjaan AI hanya dari ringkasan agent sebelumnya.
- Jangan memakai aksi destruktif pada data nyata untuk membuktikan task.
- Jangan mengarang hasil screenshot, node accessibility, atau outcome interaksi.
- Simpan artefak hanya di direktori temporary dan jangan commit.
- Bila task ternyata backend-only atau CLI-only tanpa permukaan browser yang relevan, jangan pakai skill ini.

## Format laporan

Mulai dengan verdict keseluruhan: `PASS`, `FAIL`, `PARTIAL`, atau `BLOCKED`.

Lalu laporkan per acceptance item dengan format ringkas berikut:

```text
[verified] Filter tetap aktif setelah submit — `/perizinan`, 1440x900
Kriteria: ...
Langkah: ...
Bukti: screenshot `/tmp/...`, `vibium text`, `vibium diff map`, atau source `path:line`
Verdict: ...
```

Aturan output:

- Bedakan jelas antara `verified`, `failed`, `blocked`, dan `inferred`.
- Sertakan route dan viewport pada setiap item yang diuji.
- Tutup dengan daftar command validasi yang dijalankan dan state yang belum bisa diverifikasi.
- Jika semua acceptance item lolos, tetap sebutkan apa yang diuji; jangan hanya menulis "sudah aman".
