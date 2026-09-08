---
target_identity: "file:/home/akbarhann/project/tebuirengv2/frontend/src/pages/DashboardPage.tsx"
target_fingerprint: "sha256:0b125245ed0fb7c2f22fee7f61412dbc0a30e24a1911cab761abfe9140c589fd"
target_path: /home/akbarhann/project/tebuirengv2/frontend/src/pages/DashboardPage.tsx
timestamp: 2026-09-07T17-45-04Z
slug: frontend-src-pages-dashboardpage-tsx
---
# Critique: Beranda Admin (DashboardPage.tsx)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | Tidak ada ringkasan operasional harian (absensi hari ini, antrean verifikasi) |
| 2 | Match System / Real World | 3/4 | Nomenklatur sesuai domain pesantren (Data Santri, Alumni, Penugasan) |
| 3 | User Control and Freedom | 3/4 | Navigasi halaman dan link shortcut berfungsi dengan jelas |
| 4 | Consistency and Standards | 3/4 | Format card dan icon konsisten |
| 5 | Error Prevention | 3/4 | Link navigasi aman tanpa efek samping merusak |
| 6 | Recognition Rather Than Recall | 2/4 | Admin tidak bisa langsung melihat tugas penting yang butuh perhatian (misal: verifikasi ambigu) |
| 7 | Flexibility and Efficiency of Use | 2/4 | Belum ada aksi cepat (quick search santri / shortcut verifikasi data) |
| 8 | Aesthetic and Minimalist Design | 3/4 | Desain bersih & tenang, namun pemanfaatan ruang/kepadatan informasi masih terlampau senggang |
| 9 | Error Recovery | 3/4 | Terdapat fallback error box & tombol "Coba lagi" |
| 10 | Help and Documentation | 2/4 | Belum ada petunjuk/konteks awal untuk tugas administrasi harian |
| **Total** | | **26/40** | **Acceptable (65%)** |

## Design Specificity Verdict

**LLM Assessment**: Halaman Beranda Admin sudah menggunakan istilah domain SIMANTEB yang tepat. Namun, tampilannya saat ini lebih menyerupai *app launcher* daripada sebuah *command center* operasional pesantren. Admin membutuhkan visibilitas langsung terhadap status hari ini (antrean verifikasi data ambigu, kehadiran harian santri, dan izin yang overdue).

**Deterministic Scan**: 0 temuan pelanggaran mekanis otomatis pada `DashboardPage.tsx`.

## Priority Issues

- **[P1] Tidak ada Metric Operasional & Alert Antrean Verifikasi Data**: Admin belum dapat melihat jumlah antrean verifikasi data santri/kamar atau perizinan overdue secara langsung di Beranda tanpa membuka sub-menu.
  - *Fix*: Tambahkan widget ringkasan operasional harian (Antrean Verifikasi, Kehadiran Hari Ini, Izin Active/Overdue).
  - *Suggested command*: `$impeccable layout`
- **[P2] Shortcut Modul Belum Mencakup Verifikasi Data & Laporan**: Halaman Beranda memuat modul administrasi, tetapi `Verifikasi Data` (salah satu tugas utama Admin) belum ada di shortcut grid.
  - *Fix*: Tambahkan card shortcut `Verifikasi Data` dengan perhatian antrean (badge dot).
  - *Suggested command*: `$impeccable layout`
- **[P2] Kepadatan Informasi (Information Density) Masih Senggang**: Ruang utama di Beranda Admin masih didominasi kartu-kartu besar dengan informasi yang sedikit.
  - *Fix*: Optimalkan tata letak dengan menyajikan statistik ringkas dan status perhatian yang lebih informatif.
  - *Suggested command*: `$impeccable layout`
