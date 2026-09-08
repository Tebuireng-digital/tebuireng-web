<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PeriodeAkademikController extends Controller
{
    public function index()
    {
        return response()->json(DB::table('periode_akademik')->orderByDesc('tanggal_mulai')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'tahun_pelajaran' => ['required', 'string', 'max:20'],
            'semester' => ['required', Rule::in(['Ganjil', 'Genap'])],
            'tanggal_mulai' => ['required', 'date'],
            'tanggal_selesai' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'status' => ['sometimes', Rule::in(['Draft', 'Aktif'])],
        ]);

        if (($data['status'] ?? 'Draft') === 'Aktif') {
            $this->assertNoActivePeriod($data['tahun_pelajaran'], $data['semester']);
        }

        $id = DB::table('periode_akademik')->insertGetId([
            ...$data,
            'status' => $data['status'] ?? 'Draft',
            'dibuat_oleh' => $request->user()->petugas_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(DB::table('periode_akademik')->where('periode_id', $id)->first(), 201);
    }

    public function update(Request $request, int $id)
    {
        $period = $this->period($id);
        if ($period->status === 'Ditutup') {
            return response()->json(['message' => 'Periode yang sudah ditutup tidak dapat diubah.'], 422);
        }
        $data = $request->validate([
            'tahun_pelajaran' => ['sometimes', 'string', 'max:20'],
            'semester' => ['sometimes', Rule::in(['Ganjil', 'Genap'])],
            'tanggal_mulai' => ['sometimes', 'date'],
            'tanggal_selesai' => ['sometimes', 'date', 'after_or_equal:tanggal_mulai'],
            'status' => ['sometimes', Rule::in(['Draft', 'Aktif'])],
        ]);
        if (($data['status'] ?? $period->status) === 'Aktif') {
            $this->assertNoActivePeriod($data['tahun_pelajaran'] ?? $period->tahun_pelajaran, $data['semester'] ?? $period->semester, $id);
        }
        DB::table('periode_akademik')->where('periode_id', $id)->update([...$data, 'updated_at' => now()]);
        return response()->json($this->period($id));
    }

    public function close(Request $request, int $id)
    {
        $period = $this->period($id);
        if ($period->status === 'Ditutup') {
            return response()->json($period);
        }
        $incomplete = [
            'raport_pengajian_belum_diterbitkan' => DB::table('raport_pengajian as raport')
                ->where('raport.tahun_pelajaran', $period->tahun_pelajaran)
                ->where('raport.semester', $period->semester)
                ->whereNotExists(fn ($query) => $query->select(DB::raw(1))->from('report_documents as dokumen')->whereColumn('dokumen.santri_id', 'raport.santri_id')->where('dokumen.jenis', 'raport_pengajian')->where('dokumen.tahun_pelajaran', $period->tahun_pelajaran)->where('dokumen.semester', $period->semester))
                ->count(),
            'raport_pembinaan_belum_diterbitkan' => DB::table('raport_ubudiyah as raport')
                ->where('raport.tahun_pelajaran', $period->tahun_pelajaran)
                ->where('raport.semester', $period->semester)
                ->whereNotExists(fn ($query) => $query->select(DB::raw(1))->from('report_documents as dokumen')->whereColumn('dokumen.santri_id', 'raport.santri_id')->where('dokumen.jenis', 'raport_pembinaan')->where('dokumen.tahun_pelajaran', $period->tahun_pelajaran)->where('dokumen.semester', $period->semester))
                ->count(),
            'santri_belum_memiliki_assignment' => DB::table('santri')->where('status_aktif', 1)->whereNotExists(fn ($query) => $query->select(DB::raw(1))->from('assignment_periode as assignment')->whereColumn('assignment.santri_id', 'santri.santri_id')->where('assignment.periode_id', $id))->count(),
        ];
        if (!$request->boolean('konfirmasi')) {
            return response()->json(['message' => 'Checklist penutupan harus dikonfirmasi.', 'checklist' => $incomplete], 422);
        }
        DB::table('periode_akademik')->where('periode_id', $id)->update([
            'status' => 'Ditutup',
            'ditutup_oleh' => $request->user()->petugas_id,
            'ditutup_pada' => now(),
            'updated_at' => now(),
        ]);
        return response()->json($this->period($id));
    }

    public function rolloverPreview(Request $request)
    {
        $period = $this->period((int) $request->query('periode_id'));
        $students = DB::table('santri')->where('status_aktif', 1)->select(['santri_id', 'nama', 'kelas_formal_id', 'kamar_id', 'kelompok_pbs_id', 'kelompok_pbm_id', 'kelompok_madin_id'])->orderBy('nama')->get();
        return response()->json([
            'periode' => $period,
            'items' => $students->map(fn ($student) => [
                ...((array) $student),
                'status_transisi' => 'Naik Kelas',
                'konflik_assignment' => false,
                'data_belum_lengkap' => collect(['kelas_formal_id', 'kamar_id', 'kelompok_pbs_id', 'kelompok_pbm_id', 'kelompok_madin_id'])->filter(fn ($field) => $student->{$field} === null)->values(),
            ]),
        ]);
    }

    public function rolloverApply(Request $request)
    {
        $data = $request->validate(['periode_id' => ['required', 'integer'], 'items' => ['required', 'array', 'min:1']]);
        $period = $this->period($data['periode_id']);
        if ($period->status === 'Ditutup') {
            return response()->json(['message' => 'Assignment tidak dapat diterapkan ke periode tertutup.'], 422);
        }
        DB::transaction(function () use ($data, $period): void {
            foreach ($data['items'] as $item) {
                $studentId = (int) ($item['santri_id'] ?? 0);
                if ($studentId < 1) {
                    continue;
                }
                foreach ([
                    'kelas_formal' => 'kelas_formal_id', 'kamar' => 'kamar_id', 'pbs' => 'kelompok_pbs_id',
                    'pbm' => 'kelompok_pbm_id', 'madin' => 'kelompok_madin_id',
                ] as $jenis => $field) {
                    if (!array_key_exists($field, $item) || $item[$field] === null) continue;
                    DB::table('assignment_periode')
                        ->where('santri_id', $studentId)
                        ->where('jenis', $jenis)
                        ->where('periode_id', '!=', $period->periode_id)
                        ->whereNull('effective_until')
                        ->update([
                            'effective_until' => date('Y-m-d', strtotime($period->tanggal_mulai . ' -1 day')),
                            'updated_at' => now(),
                        ]);
                    DB::table('assignment_periode')->updateOrInsert(
                        ['periode_id' => $period->periode_id, 'santri_id' => $studentId, 'jenis' => $jenis],
                        [
                            'target_id' => (int) $item[$field],
                            'status_transisi' => $item['status_transisi'] ?? 'Naik Kelas',
                            'effective_from' => $period->tanggal_mulai,
                            'effective_until' => null,
                            'updated_at' => now(),
                            'created_at' => now(),
                        ]
                    );
                }
            }
        });
        return response()->json(['message' => 'Assignment periode berhasil diterapkan.', 'periode_id' => $period->periode_id]);
    }

    private function period(int $id): object
    {
        $period = DB::table('periode_akademik')->where('periode_id', $id)->first();
        abort_unless($period, 404, 'Periode akademik tidak ditemukan.');
        return $period;
    }

    private function assertNoActivePeriod(string $year, string $semester, ?int $ignoreId = null): void
    {
        $query = DB::table('periode_akademik')->where('tahun_pelajaran', $year)->where('semester', $semester)->where('status', 'Aktif');
        if ($ignoreId) $query->where('periode_id', '!=', $ignoreId);
        abort_if($query->exists(), 422, 'Sudah ada periode aktif untuk tahun pelajaran dan semester tersebut.');
    }
}
