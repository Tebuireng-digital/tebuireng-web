<?php

namespace App\Http\Controllers;

use App\Models\Absensi;
use App\Support\KamarName;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class AbsensiController extends Controller
{
    private const JENIS = [
        'sekolah' => [
            'kode' => 'SEKOLAH',
            'nama' => 'Kelas Formal',
            'sumber' => 'Kelas formal dari data santri',
            'tipe_target' => 'KelasFormal',
            'santri_column' => 'kelas_formal_id',
            'target_table' => 'kelas_formal',
            'target_pk' => 'kelas_formal_id',
            'target_label' => 'nama_kelas',
        ],
        'kamar' => [
            'kode' => 'KAMAR',
            'nama' => 'Kamar',
            'sumber' => 'Database Santri Kamar',
            'tipe_target' => 'Kamar',
            'santri_column' => 'kamar_id',
            'target_table' => 'kamar',
            'target_pk' => 'kamar_id',
            'target_label' => 'nama',
        ],
        'keberangkatan' => [
            'kode' => 'KAMAR',
            'nama' => 'Keberangkatan Kelas',
            'sumber' => 'Kamar pada sesi pagi',
            'tipe_target' => 'Kamar',
            'santri_column' => 'kamar_id',
            'target_table' => 'kamar',
            'target_pk' => 'kamar_id',
            'target_label' => 'nama',
        ],
        'pbs' => [
            'kode' => 'PBS',
            'nama' => 'Kelompok Al-Qur\'an Subuh',
            'sumber' => 'Database Kelompok Al-Qur\'an',
            'tipe_target' => 'KelompokPBS',
            'santri_column' => 'kelompok_pbs_id',
            'target_table' => 'kelompok_pbs',
            'target_pk' => 'kelompok_pbs_id',
            'target_label' => 'nama_kelompok',
        ],
        'diniyah' => [
            'kode' => 'DINIYAH',
            'nama' => 'Kelas Madin',
            'sumber' => 'Database Kelas Madin',
            'tipe_target' => 'KelompokMadin',
            'santri_column' => 'kelompok_madin_id',
            'target_table' => 'kelompok_madin',
            'target_pk' => 'kelompok_madin_id',
            'target_label' => 'nama_kelas_madin',
        ],
        'pbm' => [
            'kode' => 'PBM',
            'nama' => 'Takhasus Maghrib',
            'sumber' => 'Database Takhasus',
            'tipe_target' => 'KelompokPBM',
            'santri_column' => 'kelompok_pbm_id',
            'target_table' => 'kelompok_pbm',
            'target_pk' => 'kelompok_pbm_id',
            'target_label' => 'nama_kelompok',
        ],
    ];

    private const ROLE_TARGETS = [
        'Pembina Kamar' => ['Kamar'],
        'Wali Kelas' => ['KelasFormal'],
        'Piket Pengajian' => ['KelompokPBS', 'KelompokMadin', 'KelompokPBM'],
        'Admin' => ['Kamar', 'KelasFormal', 'KelompokPBS', 'KelompokMadin', 'KelompokPBM'],
    ];

    public function options(Request $request)
    {
        $petugas = $request->user();
        $allowedTargets = self::ROLE_TARGETS[$petugas->jabatan] ?? [];
        $result = [];

        foreach (self::JENIS as $slug => $config) {
            if (!in_array($config['tipe_target'], $allowedTargets, true)) {
                continue;
            }

            $kegiatan = DB::table('jenis_kegiatan')->where('kode', $config['kode'])->first();
            if (!$kegiatan) {
                continue;
            }

            if ($config['tipe_target'] === 'KelasFormal') {
                $targetQuery = DB::table('kelas_formal')
                    ->leftJoin('unit_pendidikan', 'kelas_formal.unit_id', '=', 'unit_pendidikan.unit_id')
                    ->select([
                        'kelas_formal.kelas_formal_id as target_id',
                        'kelas_formal.nama_kelas as nama_target',
                        'kelas_formal.tingkat',
                        'unit_pendidikan.kode as unit_kode',
                        'unit_pendidikan.nama as unit_nama',
                    ]);
            } else {
                $targetQuery = DB::table($config['target_table'])
                    ->select([
                        $config['target_pk'].' as target_id',
                        $config['target_label'].' as nama_target',
                    ]);
            }

            $this->constrainTargetQuery($targetQuery, $config, $petugas->jabatan !== 'Admin');

            if ($config['target_table'] === 'kelompok_pbs') {
                $targetQuery->addSelect('kategori as kategori_target');
            }

            if ($petugas->jabatan !== 'Admin') {
                $assignedIds = DB::table('petugas_penugasan')
                    ->where('petugas_id', $petugas->petugas_id)
                    ->where('tipe_target', $config['tipe_target'])
                    ->where('tanggal_mulai', '<=', now()->toDateString())
                    ->where(function ($query) {
                        $query->whereNull('tanggal_selesai')
                            ->orWhere('tanggal_selesai', '>=', now()->toDateString());
                    })
                    ->pluck('target_id');

                $targetQuery->whereIn($config['target_table'].'.'.$config['target_pk'], $assignedIds);
            }

            if ($config['target_table'] === 'kamar') {
                $targetQuery->where('status_aktif', 1);
            }

            $targets = $targetQuery->orderBy($config['target_label'])->get();
            if ($config['target_table'] === 'kamar') {
                $targets->each(function ($target) {
                    $name = KamarName::parse($target->nama_target);
                    $target->nama_target_asli = $target->nama_target;
                    $target->nama_target = $name['standar'];
                    $target->kategori_target = $name['kategori'];
                    $target->nomor_target = $name['nomor'];
                });
                $targets = $targets->sort(function ($left, $right) {
                    $categoryComparison = strcasecmp($left->kategori_target, $right->kategori_target);
                    return $categoryComparison !== 0
                        ? $categoryComparison
                        : strnatcasecmp((string) $left->nomor_target, (string) $right->nomor_target);
                })->values();
            }
            if ($config['target_table'] === 'kelompok_pbs') {
                $targets = $targets->sort(function ($left, $right) {
                    $kategoriComparison = strcasecmp($left->kategori_target, $right->kategori_target);
                    return $kategoriComparison !== 0
                        ? $kategoriComparison
                        : strnatcasecmp($left->nama_target, $right->nama_target);
                })->values();
            }
            if ($targets->isEmpty() && $petugas->jabatan !== 'Admin') {
                continue;
            }

            $jadwal = DB::table('jadwal_kegiatan')
                ->where('jenis_kegiatan_id', $kegiatan->jenis_kegiatan_id)
                ->where('konteks_operasional', match ($slug) {
                    'keberangkatan' => 'keberangkatan_kelas',
                    'kamar' => 'kamar',
                    default => 'utama',
                })
                ->where('status_aktif', 1)
                ->orderBy('jam_mulai')
                ->get(['jadwal_id', 'nama_jadwal', 'jam_mulai', 'jam_selesai']);

            $result[] = [
                'jenis' => $slug,
                'nama' => $config['nama'],
                'sumber' => $config['sumber'],
                'targets' => $targets,
                'jadwal' => $jadwal,
            ];
        }

        return response()->json($result);
    }

    public function session(Request $request, string $jenis)
    {
        [$config, $kegiatan] = $this->resolveJenis($jenis);
        if (!$config) {
            return response()->json(['message' => 'Jenis kegiatan tidak valid'], 404);
        }

        $data = $request->validate([
            'target_id' => 'required|integer',
            'jadwal_id' => 'required|integer',
            'tanggal' => 'required|date_format:Y-m-d',
        ]);

        $targetQuery = DB::table($config['target_table'])
            ->where($config['target_pk'], $data['target_id']);
        $this->constrainTargetQuery($targetQuery, $config);
        $target = $targetQuery->first();
        if (!$target) {
            return response()->json(['message' => 'Kelompok absensi tidak ditemukan'], 404);
        }

        $jadwal = DB::table('jadwal_kegiatan')
            ->where('jadwal_id', $data['jadwal_id'])
            ->where('jenis_kegiatan_id', $kegiatan->jenis_kegiatan_id)
            ->where('status_aktif', 1)
            ->first();
        if (!$jadwal) {
            return response()->json(['message' => 'Jadwal tidak sesuai dengan jenis kegiatan'], 422);
        }

        if (!$this->canAccessTarget($request->user(), $config, $data['target_id'])) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kelompok ini'], 403);
        }

        $santri = DB::table('santri')
            ->leftJoin('absensi', function ($join) use ($data, $kegiatan) {
                $join->on('absensi.santri_id', '=', 'santri.santri_id')
                    ->where('absensi.jenis_kegiatan_id', $kegiatan->jenis_kegiatan_id)
                    ->where('absensi.jadwal_id', $data['jadwal_id'])
                    ->where('absensi.tanggal', $data['tanggal']);
            })
            ->where('santri.'.$config['santri_column'], $data['target_id'])
            ->where('santri.status_aktif', 1)
            ->where(function ($query) {
                $query->whereNull('santri.status_siswa_sumber')->orWhere('santri.status_siswa_sumber', '!=', 'legacy_noncanonical');
            })
            ->orderBy('santri.nama')
            ->get([
                'santri.santri_id',
                'santri.nis',
                'santri.no_id_induk',
                'santri.nama',
                'absensi.absensi_id',
                'absensi.status',
                'absensi.menit_terlambat',
                'absensi.keterangan',
                'absensi.waktu_input',
            ]);

        $namaPenanggungJawab = null;
        if ($config['tipe_target'] === 'KelasFormal' && $target->wali_kelas_id) {
            $namaPenanggungJawab = DB::table('petugas')
                ->where('petugas_id', $target->wali_kelas_id)
                ->value('nama');
        }

        return response()->json([
            'jenis' => $jenis,
            'nama_kegiatan' => $config['nama'],
            'target' => [
                'target_id' => $data['target_id'],
                'nama_target' => $config['target_table'] === 'kamar'
                    ? KamarName::parse($target->{$config['target_label']})['standar']
                    : $target->{$config['target_label']},
                'nama_penanggung_jawab' => $namaPenanggungJawab,
            ],
            'jadwal' => $jadwal,
            'tanggal' => $data['tanggal'],
            'santri' => $santri,
        ]);
    }

    public function index(Request $request)
    {
        $petugas = $request->user();
        $query = DB::table('absensi')
            ->join('santri', 'santri.santri_id', '=', 'absensi.santri_id')
            ->join('jenis_kegiatan as jk', 'jk.jenis_kegiatan_id', '=', 'absensi.jenis_kegiatan_id')
            ->join('jadwal_kegiatan as jadwal', 'jadwal.jadwal_id', '=', 'absensi.jadwal_id')
            ->leftJoin('unit_pendidikan as unit', 'unit.unit_id', '=', 'santri.unit_id')
            ->leftJoin('kamar', 'kamar.kamar_id', '=', 'santri.kamar_id')
            ->select([
                'absensi.absensi_id', 'absensi.tanggal', 'jk.kode as jenis_kegiatan', 'jk.nama as nama_kegiatan',
                'jadwal.nama_jadwal', 'santri.santri_id', 'santri.nama as nama_santri', 'unit.kode as unit',
                'kamar.nama as kamar', 'absensi.status', 'absensi.menit_terlambat', 'absensi.keterangan',
                'absensi.waktu_input', 'absensi.diinput_oleh',
            ])
            ->orderByDesc('absensi.tanggal')
            ->orderBy('santri.nama');

        if ($petugas->jabatan !== 'Admin') {
            $scopeMap = [
                'SEKOLAH' => ['KelasFormal', 'kelas_formal_id'],
                'KAMAR' => ['Kamar', 'kamar_id'],
                'PBS' => ['KelompokPBS', 'kelompok_pbs_id'],
                'PBM' => ['KelompokPBM', 'kelompok_pbm_id'],
                'DINIYAH' => ['KelompokMadin', 'kelompok_madin_id'],
            ];
            $query->where(function ($scoped) use ($scopeMap, $petugas) {
                foreach ($scopeMap as $kode => [$tipeTarget, $studentColumn]) {
                    $scoped->orWhere(function ($entry) use ($kode, $tipeTarget, $studentColumn, $petugas) {
                        $entry->where('jk.kode', $kode)->whereExists(function ($assignment) use ($tipeTarget, $studentColumn, $petugas) {
                            $assignment->selectRaw('1')->from('petugas_penugasan as assignment')
                                ->where('assignment.petugas_id', $petugas->petugas_id)
                                ->where('assignment.tipe_target', $tipeTarget)
                                ->whereColumn("assignment.target_id", "santri.{$studentColumn}")
                                ->where('assignment.tanggal_mulai', '<=', now()->toDateString())
                                ->where(function ($end) { $end->whereNull('assignment.tanggal_selesai')->orWhere('assignment.tanggal_selesai', '>=', now()->toDateString()); });
                        });
                    });
                }
            });
        }

        foreach (['jenis' => 'jk.kode', 'status' => 'absensi.status'] as $input => $column) {
            if ($request->filled($input)) $query->where($column, $request->input($input));
        }
        if ($request->filled('dari')) $query->whereDate('absensi.tanggal', '>=', $request->date('dari'));
        if ($request->filled('sampai')) $query->whereDate('absensi.tanggal', '<=', $request->date('sampai'));
        if ($request->filled('santri')) $query->where('santri.nama', 'like', '%'.$request->string('santri').'%');
        if ($request->filled('kamar_id')) $query->where('santri.kamar_id', $request->integer('kamar_id'));

        return response()->json($query->limit(500)->get());
    }

    public function bulkUpsert(Request $request, string $jenis)
    {
        [$config, $kegiatan] = $this->resolveJenis($jenis);
        if (!$config) {
            return response()->json(['message' => 'Jenis kegiatan tidak valid'], 404);
        }

        $data = $request->validate([
            'target_id' => 'required|integer',
            'jadwal_id' => 'required|integer',
            'tanggal' => 'required|date_format:Y-m-d',
            'absensi' => 'required|array|min:1',
            'absensi.*.santri_id' => 'required|integer|distinct|exists:santri,santri_id',
            'absensi.*.status' => 'required|in:Hadir,Sakit,Izin,Alpha,Terlambat',
            'absensi.*.menit_terlambat' => 'nullable|integer|min:0|max:1440',
            'absensi.*.keterangan' => 'nullable|string|max:255',
        ]);

        $targetQuery = DB::table($config['target_table'])
            ->where($config['target_pk'], $data['target_id']);
        $this->constrainTargetQuery($targetQuery, $config);
        if (!$targetQuery->exists()) {
            return response()->json(['message' => 'Kelompok absensi tidak termasuk sumber data kegiatan ini'], 422);
        }

        if (!$this->canAccessTarget($request->user(), $config, $data['target_id'])) {
            return response()->json(['message' => 'Anda tidak ditugaskan pada kelompok ini'], 403);
        }

        $jadwal = DB::table('jadwal_kegiatan')
            ->where('jadwal_id', $data['jadwal_id'])
            ->where('jenis_kegiatan_id', $kegiatan->jenis_kegiatan_id)
            ->where('status_aktif', 1)
            ->first();
        if (!$jadwal) {
            return response()->json(['message' => 'Jadwal tidak sesuai dengan jenis kegiatan'], 422);
        }

        $santriIds = collect($data['absensi'])->pluck('santri_id');
        $validCount = DB::table('santri')
            ->whereIn('santri_id', $santriIds)
            ->where($config['santri_column'], $data['target_id'])
            ->where('status_aktif', 1)
            ->where(function ($query) {
                $query->whereNull('status_siswa_sumber')->orWhere('status_siswa_sumber', '!=', 'legacy_noncanonical');
            })
            ->count();
        if ($validCount !== $santriIds->count()) {
            return response()->json(['message' => 'Terdapat santri yang bukan anggota kelompok ini'], 422);
        }

        $now = now();
        $petugas = $request->user();
        $periodeId = DB::table('periode_akademik')->where('status', 'Aktif')->whereDate('tanggal_mulai', '<=', $data['tanggal'])->whereDate('tanggal_selesai', '>=', $data['tanggal'])->value('periode_id');
        $existingRows = DB::table('absensi')
            ->whereIn('santri_id', $santriIds)
            ->where('jenis_kegiatan_id', $kegiatan->jenis_kegiatan_id)
            ->where('jadwal_id', $data['jadwal_id'])
            ->where('tanggal', $data['tanggal'])
            ->get()
            ->keyBy('santri_id');

        $upsertData = [];
        foreach ($data['absensi'] as $item) {
            $existing = $existingRows->get($item['santri_id']);
            $upsertData[] = [
                'santri_id' => $item['santri_id'],
                'jenis_kegiatan_id' => $kegiatan->jenis_kegiatan_id,
                'jadwal_id' => $data['jadwal_id'],
                'tanggal' => $data['tanggal'],
                'periode_id' => $periodeId,
                'status' => $item['status'],
                'menit_terlambat' => $item['status'] === 'Terlambat' ? ($item['menit_terlambat'] ?? null) : null,
                'keterangan' => $item['keterangan'] ?? null,
                'waktu_input' => $existing?->waktu_input ?? $now->toDateTimeString(),
                'diinput_oleh' => $existing?->diinput_oleh ?? $petugas->petugas_id,
                'diubah_oleh' => $existing ? $petugas->petugas_id : null,
                'updated_at' => $now->toDateTimeString(),
            ];
        }

        // Payload identik adalah no-op: jangan menyentuh updated_at/diubah_oleh
        // dan jangan menghasilkan audit log baru.
        $writeData = array_values(array_filter($upsertData, function (array $row) use ($existingRows) {
            $existing = $existingRows->get($row['santri_id']);
            if (!$existing) {
                return true;
            }

            return $existing->status !== $row['status']
                || $existing->menit_terlambat !== $row['menit_terlambat']
                || $existing->keterangan !== $row['keterangan'];
        }));

        DB::transaction(function () use ($upsertData, $writeData, $existingRows, $data, $kegiatan, $petugas) {
            if ($writeData) {
                DB::table('absensi')->upsert(
                    $writeData,
                    ['santri_id', 'jenis_kegiatan_id', 'jadwal_id', 'tanggal'],
                ['periode_id', 'status', 'menit_terlambat', 'keterangan', 'diubah_oleh', 'updated_at']
                );
            }

            $saved = DB::table('absensi')
                ->whereIn('santri_id', collect($upsertData)->pluck('santri_id'))
                ->where('jenis_kegiatan_id', $kegiatan->jenis_kegiatan_id)
                ->where('jadwal_id', $data['jadwal_id'])
                ->where('tanggal', $data['tanggal'])
                ->get()
                ->keyBy('santri_id');

            $logs = [];
            foreach ($upsertData as $row) {
                $before = $existingRows->get($row['santri_id']);
                $after = $saved->get($row['santri_id']);
                $changed = !$before
                    || $before->status !== $row['status']
                    || $before->menit_terlambat !== $row['menit_terlambat']
                    || $before->keterangan !== $row['keterangan'];
                if (!$changed || !$after) {
                    continue;
                }
                $logs[] = [
                    'petugas_id' => $petugas->petugas_id,
                    'aksi' => $before ? 'UPDATE' : 'INSERT',
                    'nama_tabel' => 'absensi',
                    'record_id' => $after->absensi_id,
                    'data_sebelum' => $before ? json_encode($before) : null,
                    'data_sesudah' => json_encode($after),
                    'created_at' => now(),
                ];
            }
            if ($logs) {
                DB::table('log_aktivitas')->insert($logs);
            }
        });

        $toleransi = (int) (DB::table('pengaturan_sistem')
            ->where('setting_key', 'toleransi_menit_terlambat_input')
            ->value('setting_value') ?? 30);
        $batasInput = Carbon::parse($data['tanggal'].' '.$jadwal->jam_selesai)->addMinutes($toleransi);

        return response()->json([
            'message' => 'Absensi berhasil disimpan',
            'jumlah' => count($upsertData),
            'jumlah_diubah' => count($writeData),
            'input_terlambat' => $now->greaterThan($batasInput),
        ]);
    }

    public function update(Request $request, $id)
    {
        $absensi = DB::table('absensi')->where('absensi_id', $id)->first();
        if (!$absensi) {
            return response()->json(['message' => 'Absensi tidak ditemukan'], 404);
        }

        $petugas = Auth::user();
        $absensiModel = new Absensi((array) $absensi);
        $absensiModel->santri_id = $absensi->santri_id;
        $absensiModel->jenis_kegiatan_id = $absensi->jenis_kegiatan_id;

        if (Gate::forUser($petugas)->denies('update', $absensiModel)) {
            return response()->json(['message' => 'Anda tidak berhak mengubah absensi ini'], 403);
        }

        if ($petugas->jabatan !== 'Admin') {
            $durasiEdit = (int) (DB::table('pengaturan_sistem')
                ->where('setting_key', 'durasi_edit_absensi_menit')
                ->value('setting_value') ?? 60);
            if (Carbon::parse($absensi->waktu_input)->diffInMinutes(now()) > $durasiEdit) {
                return response()->json(['message' => 'Batas waktu edit absensi telah habis'], 403);
            }
        }

        $data = $request->validate([
            'status' => 'required|in:Hadir,Sakit,Izin,Alpha,Terlambat',
            'menit_terlambat' => 'nullable|integer|min:0|max:1440',
            'keterangan' => 'nullable|string|max:255',
        ]);
        if ($data['status'] !== 'Terlambat') {
            $data['menit_terlambat'] = null;
        }
        $data['diubah_oleh'] = $petugas->petugas_id;
        $data['updated_at'] = now()->toDateTimeString();

        DB::transaction(function () use ($absensi, $data, $petugas, $id) {
            DB::table('absensi')->where('absensi_id', $id)->update($data);
            DB::table('log_aktivitas')->insert([
                'petugas_id' => $petugas->petugas_id,
                'aksi' => 'UPDATE',
                'nama_tabel' => 'absensi',
                'record_id' => $id,
                'data_sebelum' => json_encode($absensi),
                'data_sesudah' => json_encode(array_merge((array) $absensi, $data)),
                'created_at' => now(),
            ]);
        });

        return response()->json(['message' => 'Absensi berhasil diubah']);
    }

    private function resolveJenis(string $jenis): array
    {
        $config = self::JENIS[$jenis] ?? null;
        if (!$config) {
            return [null, null];
        }

        $kegiatan = DB::table('jenis_kegiatan')->where('kode', $config['kode'])->first();
        return $kegiatan ? [$config, $kegiatan] : [null, null];
    }

    private function constrainTargetQuery($query, array $config, bool $allowEmptyRoster = false): void
    {
        if ($allowEmptyRoster) {
            return;
        }
        // Target absensi harus punya roster aktif dari master canonical; referensi
        // legacy tetap dipertahankan untuk histori tetapi tidak boleh muncul sebagai tugas baru.
        $query->whereExists(function ($roster) use ($config): void {
            $roster->selectRaw('1')
                ->from('santri')
                ->where('santri.status_aktif', 1)
                ->where(function ($source) {
                    $source->whereNull('santri.status_siswa_sumber')
                        ->orWhere('santri.status_siswa_sumber', '!=', 'legacy_noncanonical');
                })
                ->whereColumn('santri.'.$config['santri_column'], $config['target_table'].'.'.$config['target_pk']);
        });
    }

    private function canAccessTarget($petugas, array $config, int $targetId): bool
    {
        $allowedTargets = self::ROLE_TARGETS[$petugas->jabatan] ?? [];
        return in_array($config['tipe_target'], $allowedTargets, true)
            && $petugas->hasAccess($config['tipe_target'], $targetId);
    }
}
