---
target: frontend/src/pages/BulkInputPage.tsx
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/akbarhann/project/tebuirengv2/frontend/src/pages/BulkInputPage.tsx"
target_fingerprint: "sha256:68eb8deb759f3eef5435f5a1c223e97e2372fa68b3391b58b7289a4148376c4d"
target_path: /home/akbarhann/project/tebuirengv2/frontend/src/pages/BulkInputPage.tsx
timestamp: 2026-09-08T09-42-15Z
slug: frontend-src-pages-bulkinputpage-tsx
---
#### Report header provenance
⚠️ DEGRADED: single-context (running in unified agent session)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Summary counters real-time, but lacks subtle "Draft tersimpan otomatis" timestamp indicator |
| 2 | Match System / Real World | 3 | "Tandai Semua Hadir" modifies all 141 students even when a search query is filtering 3 students |
| 3 | User Control and Freedom | 3 | Preview mode locks unintentional edits, but no quick reset or undo single-row action |
| 4 | Consistency and Standards | 3 | Standard spreadsheet/roster sticky headers and floating bottom action bar are missing |
| 5 | Error Prevention | 3 | Preview mode locks input, but unselected validation only warns on submit |
| 6 | Recognition Rather Than Recall | 2 | Column headers scroll out of view on long lists (140+ rows) |
| 7 | Flexibility and Efficiency | 2 | No keyboard accelerators (e.g. 1-5 or hotkeys) for rapid roll-call entry |
| 8 | Aesthetic and Minimalist Design | 3 | Clean neutral palette, but 140 inline text inputs create unnecessary visual clutter |
| 9 | Error Recovery | 3 | LocalStorage draft recovery works reliably |
| 10 | Help and Documentation | 2 | No quick shortcut guide, tooltip legend, or contextual roll-call help |
| **Total** | | **27/40** | **Acceptable** |

#### Design Specificity Verdict

**LLM assessment**: Roster absensi saat ini memiliki fondasi yang tenang dan fungsional (bebas dari AI design slop), namun masih terasa seperti tabel database generik alih-alih alat pencatatan absensi lapangan (*specialized roll-call tool*). Untuk 140+ santri per kelas, ketiadaan sticky table header dan floating action bar membuat pengalaman pengisian di layar laptop/desktop melelahkan.

**Deterministic scan**: 0 finding (clean markup and semantics).

#### Overall Impression
Fondasi visual bersih dan aman dari warna mencolok, namun alur ergonomi operasional (*roll-call ergonomics*) untuk daftar santri panjang masih memiliki friksi: hilangnya header saat scroll, tombol simpan yang tertinggal di atas, dan ketiadaan shortcut keyboard untuk petugas.

#### What's Working
1. **Focus Mode (Zen Mode)**: Halaman menyembunyikan sidebar navigasi penuh sehingga petugas fokus tanpa distraksi.
2. **Mode Pratinjau Aman**: Mencegah klik tidak sengaja sebelum petugas siap memulai absensi.
3. **Draft Persistence**: Data aman di browser saat koneksi putus atau tab tertutup.

#### Priority Issues
- **[P1] Sticky Table Header & Floating Action Bar**: Saat scroll ke santri urutan 50-140, nama kolom Hadir/Sakit/Alpha hilang dari panduan mata, dan tombol Simpan Absensi tertinggal jauh di atas.
  - *Fix*: Buat header tabel sticky (`position: sticky; top: 0`) dan tambahkan floating bottom bar untuk tombol Simpan saat posisi scroll berada di bawah.
  - *Suggested command*: `$impeccable layout`
- **[P1] Filter vs Batch Action Mental Model Conflict**: Tombol "Tandai Semua Hadir" menandai seluruh 141 santri meskipun pencarian sedang memfilter 3 santri tertentu.
  - *Fix*: Bedakan "Tandai yang Tampil Hadir" vs "Tandai Semua Santri Hadir" secara kontekstual.
  - *Suggested command*: `$impeccable harden`
- **[P2] Ketiadaan Keyboard Shortcuts untuk Entry Cepat**: Petugas harus mengklik mouse ratusan kali untuk mengubah status santri yang tidak hadir.
  - *Fix*: Sediakan tombol navigasi keyboard (panah atas/bawah untuk pindah santri, angka 1-5 untuk status Hadir/Telat/Izin/Sakit/Alpha).
  - *Suggested command*: `$impeccable optimize`
- **[P2] Visual Clutter pada Kolom Catatan**: 140 input text kosong berjejer membuat baris tabel terlihat padat dan berat.
  - *Fix*: Gunakan micro-affordance tombol `+ Catatan` atau inline click-to-edit yang hanya memunculkan field saat ada catatan.
  - *Suggested command*: `$impeccable distill`

#### Persona Red Flags
- **Alex (Petugas Cepat/Power User)**: Harus scroll 140 baris ke atas hanya untuk menekan tombol simpan, dan terpaksa klik mouse satu per satu tanpa keyboard shortcut.
- **Jordan (Petugas Pengganti/Baru)**: Bingung apakah "Tandai Semua Hadir" saat mencari nama hanya berlaku untuk santri di layar atau seluruh kelas.
- **Sam (Keyboard-Only User)**: Menekan tombol Tab harus melewati 7 radio button + 1 input text per santri (lebih dari 1.100 kali Tab untuk 140 santri).

#### Minor Observations
- Tinggi kartu ringkasan (summary cards) dapat dibuat lebih kompak agar ruang vertikal untuk tabel lebih luas.
- Status autosave draft belum memiliki indikator visual waktu (misal: "Draft tersimpan otomatis 16:35").

#### Questions to Consider
- Bagaimana jika petugas dapat mengisi absensi santri tanpa menyentuh mouse sama sekali?
- Bagaimana jika tabel dilengkapi tombol simpan melayang di bawah layar saat petugas selesai memeriksa santri terakhir?
