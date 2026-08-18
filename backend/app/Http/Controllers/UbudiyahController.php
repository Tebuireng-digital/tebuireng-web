<?php

namespace App\Http\Controllers;

use App\Models\MasterInstrumenUbudiyah;
use App\Models\RaportUbudiyah;
use App\Models\NilaiUbudiyah;
use App\Models\Santri;
use App\Support\KamarName;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;

class UbudiyahController extends Controller
{
    private const PREDIKAT_MAP = [
        [85, 100, 'A', 'Sangat Baik'],
        [80, 84, 'B+', 'Baik'],
        [75, 79, 'B', 'Baik'],
        [70, 74, 'C+', 'Cukup'],
        [60, 69, 'C', 'Cukup'],
        [50, 59, 'D', 'Kurang'],
        [0, 49, 'E', 'Sangat Kurang'],
    ];

    /**
     * Get room options assigned to the petugas (or all for Admin).
     */
    public function options(Request $request)
    {
        $petugas = $request->user();
        $query = DB::table('kamar')
            ->select('kamar_id as target_id', 'nama as nama_target');

        if ($petugas->jabatan !== 'Admin') {
            $assignedIds = DB::table('petugas_penugasan')
                ->where('petugas_id', $petugas->petugas_id)
                ->where('tipe_target', 'Kamar')
                ->where('tanggal_mulai', '<=', now()->toDateString())
                ->where(function ($q) {
                    $q->whereNull('tanggal_selesai')
                        ->orWhere('tanggal_selesai', '>=', now()->toDateString());
                })
                ->pluck('target_id');

            $query->whereIn('kamar_id', $assignedIds);
        }

        $rooms = $query->orderBy('nama')->get();

        return response()->json($rooms);
    }

    /**
     * Load santri list + active instruments + existing scores.
     */
    public function session(Request $request)
    {
        $data = $request->validate([
            'target_id' => 'required|integer',
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        $petugas = $request->user();
        $kamarId = $data['target_id'];

        // Access check
        if ($petugas->jabatan !== 'Admin') {
            $hasAccess = DB::table('petugas_penugasan')
                ->where('petugas_id', $petugas->petugas_id)
                ->where('tipe_target', 'Kamar')
                ->where('target_id', $kamarId)
                ->where('tanggal_mulai', '<=', now()->toDateString())
                ->where(function ($q) {
                    $q->whereNull('tanggal_selesai')
                        ->orWhere('tanggal_selesai', '>=', now()->toDateString());
                })
                ->exists();

            if (!$hasAccess) {
                return response()->json(['message' => 'Anda tidak ditugaskan pada kamar ini'], 403);
            }
        }

        $kamar = DB::table('kamar')->where('kamar_id', $kamarId)->first();
        if (!$kamar) {
            return response()->json(['message' => 'Kamar tidak ditemukan'], 404);
        }

        // Active instruments
        $instruments = MasterInstrumenUbudiyah::where('status_aktif', 1)
            ->orderBy('instrumen_id')
            ->get(['instrumen_id', 'nama_instrumen']);

        // Active santri in the room
        $santriList = Santri::where('kamar_id', $kamarId)
            ->where('status_aktif', 1)
            ->orderBy('nama')
            ->get(['santri_id', 'nis', 'nama']);

        // Existing reports for the month
        $existingRaports = RaportUbudiyah::whereIn('santri_id', $santriList->pluck('santri_id'))
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->get()
            ->keyBy('santri_id');

        $raportIds = $existingRaports->pluck('raport_ubudiyah_id');

        $existingNilai = DB::table('nilai_ubudiyah')
            ->whereIn('raport_ubudiyah_id', $raportIds)
            ->get()
            ->groupBy('raport_ubudiyah_id');

        // Compile santri data
        $santriData = $santriList->map(function ($santri) use ($existingRaports, $existingNilai) {
            $raport = $existingRaports->get($santri->santri_id);
            $nilai = [];
            $catatan = [];

            if ($raport) {
                $nilaiRows = $existingNilai->get($raport->raport_ubudiyah_id, collect());
                foreach ($nilaiRows as $row) {
                    $nilai[$row->instrumen_id] = $row->nilai_angka;
                    $catatan[$row->instrumen_id] = $row->catatan;
                }
            }

            return [
                'santri_id' => $santri->santri_id,
                'nis' => $santri->nis,
                'nama' => $santri->nama,
                'nilai' => $nilai,
                'catatan' => $catatan,
                'raport_ubudiyah_id' => $raport?->raport_ubudiyah_id ?? null,
            ];
        });

        return response()->json([
            'nama_kamar' => $kamar->nama,
            'target_id' => $kamarId,
            'bulan' => (int) $data['bulan'],
            'tahun' => (int) $data['tahun'],
            'aspek' => $instruments,
            'santri' => $santriData,
        ]);
    }

    /**
     * Save / update raport Ubudiyah bulk per room.
     */
    public function bulkUpsert(Request $request)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Pembina Kamar'], true)) {
            return response()->json(['message' => 'Hanya Admin dan Pembina Kamar yang dapat menginput raport'], 403);
        }

        $data = $request->validate([
            'target_id' => 'required|integer',
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
            'tahun_pelajaran' => 'required|string|max:20',
            'semester' => 'required|in:Ganjil,Genap',
            'entries' => 'required|array|min:1',
            'entries.*.santri_id' => 'required|integer|exists:santri,santri_id',
            'entries.*.nilai' => 'present|array',
            'entries.*.nilai.*' => 'nullable|integer|between:0,100',
            'entries.*.catatan' => 'present|array',
            'entries.*.catatan.*' => 'nullable|string|max:255',
        ]);

        $kamarId = $data['target_id'];

        // Access check
        if ($petugas->jabatan !== 'Admin') {
            $hasAccess = DB::table('petugas_penugasan')
                ->where('petugas_id', $petugas->petugas_id)
                ->where('tipe_target', 'Kamar')
                ->where('target_id', $kamarId)
                ->where('tanggal_mulai', '<=', now()->toDateString())
                ->where(function ($q) {
                    $q->whereNull('tanggal_selesai')
                        ->orWhere('tanggal_selesai', '>=', now()->toDateString());
                })
                ->exists();

            if (!$hasAccess) {
                return response()->json(['message' => 'Anda tidak ditugaskan pada kamar ini'], 403);
            }
        }

        $now = now();

        DB::transaction(function () use ($data, $kamarId, $petugas, $now) {
            foreach ($data['entries'] as $entry) {
                $santriId = $entry['santri_id'];

                // 1. Upsert Header
                $existing = RaportUbudiyah::where('santri_id', $santriId)
                    ->where('bulan', $data['bulan'])
                    ->where('tahun', $data['tahun'])
                    ->first();

                $raportData = [
                    'kamar_id' => $kamarId,
                    'tahun_pelajaran' => $data['tahun_pelajaran'],
                    'semester' => $data['semester'],
                    'diisi_oleh' => $petugas->petugas_id,
                    'updated_at' => $now,
                ];

                if ($existing) {
                    $existing->update($raportData);
                    $raportId = $existing->raport_ubudiyah_id;
                } else {
                    $raportData['santri_id'] = $santriId;
                    $raportData['bulan'] = $data['bulan'];
                    $raportData['tahun'] = $data['tahun'];
                    $raportData['created_at'] = $now;
                    $raportId = DB::table('raport_ubudiyah')->insertGetId($raportData);
                }

                // 2. Upsert Details
                foreach ($entry['nilai'] as $instId => $nilaiVal) {
                    $catatanVal = $entry['catatan'][$instId] ?? null;

                    if ($nilaiVal !== null) {
                        DB::table('nilai_ubudiyah')->updateOrInsert(
                            [
                                'raport_ubudiyah_id' => $raportId,
                                'instrumen_id' => $instId,
                            ],
                            [
                                'nilai_angka' => $nilaiVal,
                                'catatan' => $catatanVal,
                                'updated_at' => $now,
                            ]
                        );
                    } else {
                        // If score is null, remove existing entry if any
                        DB::table('nilai_ubudiyah')
                            ->where('raport_ubudiyah_id', $raportId)
                            ->where('instrumen_id', $instId)
                            ->delete();
                    }
                }
            }
        });

        return response()->json([
            'message' => 'Laporan Ubudiyah Yaumiyah berhasil disimpan',
            'jumlah' => count($data['entries']),
        ]);
    }

    /**
     * Get list of all instruments.
     */
    public function masterIndex(Request $request)
    {
        $instruments = MasterInstrumenUbudiyah::with('pembuat:petugas_id,nama')
            ->orderBy('status_aktif', 'desc')
            ->orderBy('instrumen_id', 'asc')
            ->get();

        return response()->json($instruments);
    }

    /**
     * Create new instrument.
     */
    public function masterStore(Request $request)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Pembina Kamar'], true)) {
            return response()->json(['message' => 'Anda tidak memiliki hak untuk menambah kriteria'], 403);
        }

        $data = $request->validate([
            'nama_instrumen' => 'required|string|max:150|unique:master_instrumen_ubudiyah,nama_instrumen',
        ]);

        $inst = MasterInstrumenUbudiyah::create([
            'nama_instrumen' => $data['nama_instrumen'],
            'status_aktif' => 1,
            'dibuat_oleh' => $petugas->petugas_id,
        ]);

        return response()->json([
            'message' => 'Kriteria penilaian berhasil ditambahkan',
            'data' => $inst,
        ]);
    }

    /**
     * Toggle active/inactive status of instrument.
     */
    public function masterToggle(Request $request, $id)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Pembina Kamar'], true)) {
            return response()->json(['message' => 'Anda tidak memiliki hak untuk mengedit kriteria'], 403);
        }

        $inst = MasterInstrumenUbudiyah::findOrFail($id);
        $inst->status_aktif = !$inst->status_aktif;
        $inst->save();

        return response()->json([
            'message' => 'Status kriteria berhasil diperbarui',
            'data' => $inst,
        ]);
    }

    /**
     * Get single santri's Ubudiyah report card.
     */
    public function show(Request $request, $santriId)
    {
        $data = $request->validate([
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        $santri = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->where('santri.santri_id', $santriId)
            ->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')
            ->first();

        if (!$santri) {
            return response()->json(['message' => 'Santri tidak ditemukan'], 404);
        }

        $raport = RaportUbudiyah::where('santri_id', $santriId)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->first();

        if (!$raport) {
            return response()->json(['message' => 'Laporan Ubudiyah belum diisi untuk periode ini'], 404);
        }

        $raportData = $this->buildReportCardData($raport, $santri);

        return response()->json($raportData);
    }

    /**
     * Download PDF for a single student.
     */
    public function downloadPdf(Request $request, $santriId)
    {
        $data = $request->validate([
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        $santri = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->where('santri.santri_id', $santriId)
            ->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')
            ->first();

        if (!$santri) {
            return response()->json(['message' => 'Santri tidak ditemukan'], 404);
        }

        $raport = RaportUbudiyah::where('santri_id', $santriId)
            ->where('bulan', $data['bulan'])
            ->where('tahun', $data['tahun'])
            ->first();

        if (!$raport) {
            return response()->json(['message' => 'Laporan Ubudiyah belum diisi untuk periode ini'], 404);
        }

        $raportData = $this->buildReportCardData($raport, $santri);

        Carbon::setLocale('id');

        $pdf = Pdf::loadView('pdf.raport_ubudiyah', [
            'data' => $raportData,
        ]);

        $pdf->setPaper('A4', 'portrait');

        $filename = 'Laporan_Ubudiyah_' . str_replace(' ', '_', $santri->nama) . '_' . $data['bulan'] . '_' . $data['tahun'] . '.pdf';
        return $pdf->download($filename);
    }

    /**
     * Download bulk PDF for all students in a room.
     */
    public function downloadPdfBulk(Request $request, $kamarId)
    {
        $data = $request->validate([
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer|between:2020,2100',
        ]);

        $santriList = Santri::leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->where('santri.kamar_id', $kamarId)
            ->where('santri.status_aktif', 1)
            ->orderBy('santri.nama')
            ->select('santri.*', 'kamar.nama as nama_kamar', 'kelas_formal.nama_kelas', 'kelas_formal.tingkat')
            ->get();

        if ($santriList->isEmpty()) {
            return response()->json(['message' => 'Tidak ada santri dalam kamar ini'], 404);
        }

        Carbon::setLocale('id');
        $allPages = [];

        foreach ($santriList as $santri) {
            $raport = RaportUbudiyah::where('santri_id', $santri->santri_id)
                ->where('bulan', $data['bulan'])
                ->where('tahun', $data['tahun'])
                ->first();

            if ($raport) {
                $allPages[] = $this->buildReportCardData($raport, $santri);
            }
        }

        if (empty($allPages)) {
            return response()->json(['message' => 'Belum ada laporan Ubudiyah yang diisi untuk periode ini'], 404);
        }

        $pdf = Pdf::loadView('pdf.raport_ubudiyah_bulk', [
            'allPages' => $allPages,
        ]);

        $pdf->setPaper('A4', 'portrait');

        $filename = 'Laporan_Ubudiyah_Bulk_Kamar_' . $kamarId . '_' . $data['bulan'] . '_' . $data['tahun'] . '.pdf';
        return $pdf->download($filename);
    }

    /**
     * Aggregate report for a semester.
     */
    public function rekapSemester(Request $request)
    {
        $data = $request->validate([
            'tahun_pelajaran' => 'required|string|max:20',
            'semester' => 'required|in:Ganjil,Genap',
            'kamar_id' => 'required|integer',
        ]);

        $kamarId = $data['kamar_id'];

        $raports = RaportUbudiyah::join('santri', 'raport_ubudiyah.santri_id', '=', 'santri.santri_id')
            ->where('raport_ubudiyah.kamar_id', $kamarId)
            ->where('raport_ubudiyah.tahun_pelajaran', $data['tahun_pelajaran'])
            ->where('raport_ubudiyah.semester', $data['semester'])
            ->select('raport_ubudiyah.*', 'santri.nama as nama_santri', 'santri.nis')
            ->orderBy('santri.nama')
            ->orderBy('raport_ubudiyah.bulan')
            ->get();

        $raportIds = $raports->pluck('raport_ubudiyah_id');
        $nilaiAll = DB::table('nilai_ubudiyah')
            ->whereIn('raport_ubudiyah_id', $raportIds)
            ->get()
            ->groupBy('raport_ubudiyah_id');

        $result = $raports->map(function ($r) use ($nilaiAll) {
            $nilaiRows = $nilaiAll->get($r->raport_ubudiyah_id, collect());
            $avg = $nilaiRows->avg('nilai_angka');

            return [
                'santri_id' => $r->santri_id,
                'nama_santri' => $r->nama_santri,
                'nis' => $r->nis,
                'bulan' => $r->bulan,
                'tahun' => $r->tahun,
                'rata_rata' => $avg ? round($avg, 1) : null,
            ];
        });

        return response()->json($result);
    }

    // ─── Helper Methods ─────────────────────────────────────────────

    private function getLetterGrade(int $score): string
    {
        foreach (self::PREDIKAT_MAP as [$min, $max, $letter, $label]) {
            if ($score >= $min && $score <= $max) {
                return $letter;
            }
        }
        return 'E';
    }

    private function getLetterLabel(int $score): string
    {
        foreach (self::PREDIKAT_MAP as [$min, $max, $letter, $label]) {
            if ($score >= $min && $score <= $max) {
                return $label;
            }
        }
        return 'Sangat Kurang';
    }

    private function getPeringkat(int $kamarId, int $bulan, int $tahun, int $santriId): array
    {
        $averages = DB::table('nilai_ubudiyah')
            ->join('raport_ubudiyah', 'nilai_ubudiyah.raport_ubudiyah_id', '=', 'raport_ubudiyah.raport_ubudiyah_id')
            ->where('raport_ubudiyah.kamar_id', $kamarId)
            ->where('raport_ubudiyah.bulan', $bulan)
            ->where('raport_ubudiyah.tahun', $tahun)
            ->groupBy('raport_ubudiyah.santri_id')
            ->select('raport_ubudiyah.santri_id', DB::raw('AVG(nilai_ubudiyah.nilai_angka) as avg_nilai'))
            ->orderByDesc('avg_nilai')
            ->get();

        $dari = $averages->count();
        $peringkat = 0;

        foreach ($averages->values() as $index => $row) {
            if ((int) $row->santri_id === $santriId) {
                $peringkat = $index + 1;
                break;
            }
        }

        return [$peringkat, $dari];
    }

    private function buildReportCardData($raport, $santri): array
    {
        $activeInstruments = MasterInstrumenUbudiyah::where('status_aktif', 1)
            ->orderBy('instrumen_id')
            ->get();

        $nilaiMap = DB::table('nilai_ubudiyah')
            ->where('raport_ubudiyah_id', $raport->raport_ubudiyah_id)
            ->get()
            ->keyBy('instrumen_id');

        $totalScore = 0;
        $countScores = 0;

        $nilaiData = $activeInstruments->map(function ($inst) use ($nilaiMap, &$totalScore, &$countScores) {
            $row = $nilaiMap->get($inst->instrumen_id);
            $nilaiAngka = $row?->nilai_angka;

            if ($nilaiAngka !== null) {
                $totalScore += $nilaiAngka;
                $countScores++;
            }

            return [
                'aspek' => $inst->nama_instrumen,
                'nilai_angka' => $nilaiAngka,
                'nilai_huruf' => $nilaiAngka !== null ? $this->getLetterGrade($nilaiAngka) : '—',
                'predikat' => $nilaiAngka !== null ? $this->getLetterLabel($nilaiAngka) : '—',
                'catatan' => $row?->catatan ?? null,
            ];
        });

        $avgScore = $countScores > 0 ? round($totalScore / $countScores, 1) : 0;

        [$peringkat, $dari] = $this->getPeringkat(
            $raport->kamar_id,
            $raport->bulan,
            $raport->tahun,
            $raport->santri_id
        );

        $namaKamar = $santri->nama_kamar ?? null;
        if ($namaKamar) {
            $namaKamar = KamarName::parse($namaKamar)['standar'];
        }

        $namaPetugas = DB::table('petugas')
            ->where('petugas_id', $raport->diisi_oleh)
            ->value('nama') ?? 'Pembina Kamar';

        return [
            'raport_ubudiyah_id' => $raport->raport_ubudiyah_id,
            'santri' => [
                'santri_id' => $santri->santri_id,
                'nis' => $santri->nis,
                'nama' => $santri->nama,
                'nama_kamar' => $namaKamar,
                'nama_kelas' => $santri->nama_kelas ?? null,
                'tingkat' => $santri->tingkat ?? null,
            ],
            'bulan' => $raport->bulan,
            'tahun' => $raport->tahun,
            'tahun_pelajaran' => $raport->tahun_pelajaran,
            'semester' => $raport->semester,
            'nama_pembina' => $namaPetugas,
            'nilai' => $nilaiData,
            'total_nilai' => $totalScore,
            'rata_rata' => $avgScore,
            'peringkat' => $peringkat,
            'dari' => $dari,
        ];
    }
}
