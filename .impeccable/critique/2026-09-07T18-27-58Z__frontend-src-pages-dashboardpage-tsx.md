---
target_identity: "file:/home/akbarhann/project/tebuirengv2/frontend/src/pages/DashboardPage.tsx"
target_fingerprint: "sha256:24369df1c27addc941a44ee46852d8ca79356d55e22ca39bad92a9a67f2db708"
target_path: /home/akbarhann/project/tebuirengv2/frontend/src/pages/DashboardPage.tsx
timestamp: 2026-09-07T18-27-58Z
slug: frontend-src-pages-dashboardpage-tsx
closed: true
---
# Critique: Kartu-Kartu Beranda Admin (DashboardPage.tsx)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Angka antrean verifikasi & perizinan tampil dengan badge & count yang jelas |
| 2 | Match System / Real World | 3/4 | Nomenklatur kartu sesuai kebutuhan operasional Admin Pesantren |
| 3 | User Control and Freedom | 3/4 | Setiap kartu dapat diklik langsung sebagai shortcut navigasi |
| 4 | Consistency and Standards | 2/4 | Inkonsistensi alignment: Section 1 rata kiri, Section 2 rata tengah. Tipografi bercampur (UPPERCASE vs Title Case) |
| 5 | Error Prevention | 3/4 | Kartu navigasi aman tanpa aksi mutasi data langsung |
| 6 | Recognition Rather Than Recall | 3/4 | Admin dapat langsung mengenali antrean verifikasi tanpa mengingat path halaman |
| 7 | Flexibility and Efficiency of Use | 3/4 | Menyarankan jalan pintas 1-klik ke halaman verifikasi & perizinan |
| 8 | Aesthetic and Minimalist Design | 2/4 | Fragmentasi visual: terdapat 3 variasi kartu berbeda gaya yang ditumpuk di satu halaman |
| 9 | Error Recovery | 3/4 | Memiliki fallback loading skeleton & tanda strip (—) saat error |
| 10 | Help and Documentation | 3/4 | Deskripsi di bawah angka membantu menjelaskan fungsi kartu |
| **Total** | | **28/40** | **Good (70%)** |

## Design Specificity Verdict

**LLM Assessment**: Kartu-kartu di bawah hero section Beranda Admin sudah jauh lebih fungsional dan informatif dibandingkan rilis awal. Namun, dari segi *craft* visual, terdapat 3 bahasa desain kartu yang saling bertabrakan (kartu putih dengan border, kartu dengan latar warna pastel yang mirip, dan kartu list horizontal). Menyatukan bahasa visual dan alignment kartu akan secara signifikan meningkatkan kerapian dan keterbacaan (*scanability*).

**Deterministic Scan**: 0 temuan pelanggaran mekanis otomatis (`impeccable detect`).

## Priority Issues

- **[P1] Inkonsistensi Alignment & Tipografi Kartu**: Section 1 (Antrean Verifikasi) menggunakan teks rata kiri, sedangkan Section 2 (Status Data Master) menggunakan teks rata tengah. Tipografi juga bercampur antara Uppercase dan Title Case.
  - *Fix*: Samakan alignment menjadi rata kiri pada semua kartu dan gunakan hierarki font yang konsisten.
  - *Suggested command*: `$impeccable layout`
- **[P2] Fragmentasi Gaya Visual Kartu**: Terdapat 3 gaya kartu berbeda di satu halaman.
  - *Fix*: Uniformkan bahasa visual kartu menggunakan kontainer putih bersih dengan border netral, aksen warna pada ikon/badge, serta efek hover yang konsisten.
  - *Suggested command*: `$impeccable layout`
- **[P2] Redundansi Shortcut "Verifikasi Data"**: Menu `Verifikasi Data` muncul di Section 1 (Antrean Verifikasi) sekaligus di Section 3 (Modul Administrasi).
  - *Fix*: Tata ulang shortcut Modul Administrasi agar tidak mengulang kartu yang sudah ada di seksi antrean verifikasi.
  - *Suggested command*: `$impeccable layout`
