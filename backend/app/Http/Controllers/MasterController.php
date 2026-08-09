<?php

namespace App\Http\Controllers;

use App\Support\KamarName;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MasterController extends Controller
{
    private const PENUGASAN = [
        'sekolah' => ['tipe' => 'KelasFormal', 'table' => 'kelas_formal', 'pk' => 'kelas_formal_id', 'label' => 'nama_kelas', 'jabatan' => 'Wali Kelas', 'prefix' => 'Kelas'],
        'kamar' => ['tipe' => 'Kamar', 'table' => 'kamar', 'pk' => 'kamar_id', 'label' => 'nama', 'jabatan' => 'Pembina Kamar', 'prefix' => 'Kamar'],
        'pbs' => ['tipe' => 'KelompokPBS', 'table' => 'kelompok_pbs', 'pk' => 'kelompok_pbs_id', 'label' => 'nama_kelompok', 'jabatan' => 'Ustadz', 'prefix' => 'PBS'],
        'diniyah' => ['tipe' => 'KelompokMadin', 'table' => 'kelompok_madin', 'pk' => 'kelompok_madin_id', 'label' => 'nama_kelas_madin', 'jabatan' => 'Ustadz', 'prefix' => 'Madin'],
        'pbm' => ['tipe' => 'KelompokPBM', 'table' => 'kelompok_pbm', 'pk' => 'kelompok_pbm_id', 'label' => 'nama_kelompok', 'jabatan' => 'Ustadz', 'prefix' => 'PBM'],
    ];

    public function getPetugas()
    {
        $petugas = DB::table('petugas')
            ->select('petugas_id', 'nama', 'username', 'no_hp', 'jabatan', 'status_aktif', 'wajib_ganti_password')
            ->orderBy('nama')
            ->get();
        $today = now()->toDateString();
        $assignments = DB::table('petugas_penugasan')
            ->where('tanggal_mulai', '<=', $today)
            ->where(function ($query) use ($today) {
                $query->whereNull('tanggal_selesai')
                    ->orWhere('tanggal_selesai', '>=', $today);
            })
            ->get()
            ->groupBy('petugas_id');

        foreach ($petugas as $staff) {
            $labels = collect($assignments->get($staff->petugas_id, []))
                ->map(function ($assignment) {
                    $config = collect(self::PENUGASAN)->firstWhere('tipe', $assignment->tipe_target);
                    if (!$config) {
                        return null;
                    }
                    $target = DB::table($config['table'])
                        ->where($config['pk'], $assignment->target_id)
                        ->value($config['label']);

                    if ($target && $assignment->tipe_target === 'Kamar') {
                        $target = KamarName::parse($target)['standar'];
                    }

                    return $target ? $config['prefix'].' '.$target : null;
                })
                ->filter()
                ->unique()
                ->values();

            $staff->tanggung_jawab_absensi = $labels->isEmpty() ? '-' : $labels->join(', ');
        }

        return response()->json($petugas);
    }

    public function getKamar()
    {
        return response()->json(DB::table('kamar')->orderBy('nama')->get());
    }

    /** Membuat kamar resmi dan, bila diberi, langsung mengikat kode dari workbook sumber. */
    public function storeKamar(Request $request)
    {
        $data = $request->validate([
            'nama' => 'required|string|max:100',
            'kode_sumber' => 'nullable|string|max:100',
        ]);
        $nama = trim($data['nama']);
        $kode = strtoupper(trim($data['kode_sumber'] ?? ''));

        $result = DB::transaction(function () use ($nama, $kode) {
            $kamar = DB::table('kamar')->where('nama', $nama)->first();
            if (!$kamar) {
                $id = DB::table('kamar')->insertGetId([
                    'nama' => $nama,
                    'kode_singkat' => $kode ?: null,
                    'status_aktif' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $kamar = DB::table('kamar')->where('kamar_id', $id)->first();
            }
            if ($kode) {
                if (!$kamar->kode_singkat) {
                    DB::table('kamar')->where('kamar_id', $kamar->kamar_id)->update([
                        'kode_singkat' => $kode,
                        'updated_at' => now(),
                    ]);
                    $kamar->kode_singkat = $kode;
                }
                DB::table('kamar_kode_mappings')->updateOrInsert(['kode_sumber' => $kode], [
                    'kamar_id' => $kamar->kamar_id,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]);
            }
            $updated = 0;
            if ($kode) {
                $santriIds = DB::table('santri_import_reviews')->where('kode_kamar_sumber', $kode)
                    ->whereNotNull('santri_otomatis_id')->pluck('santri_otomatis_id')->unique();
                $updated = DB::table('santri')->whereIn('santri_id', $santriIds)->whereNull('kamar_id')
                    ->update(['kamar_id' => $kamar->kamar_id]);
                DB::table('santri_import_reviews')->where('kode_kamar_sumber', $kode)
                    ->where('status', 'perlu_mapping_kamar')->update(['status' => 'perlu_tinjau', 'updated_at' => now()]);
            }
            return ['kamar' => $kamar, 'santri_diperbarui' => $updated];
        });

        return response()->json([
            'message' => $kode ? 'Kamar resmi dan mapping kode berhasil disimpan.' : 'Kamar resmi berhasil disimpan.',
            'kamar' => $result['kamar'],
            'santri_diperbarui' => $result['santri_diperbarui'],
        ], 201);
    }

    public function getSantri()
    {
        $santri = DB::table('santri')
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->select(
                'santri.santri_id',
                'santri.nis',
                'santri.nama',
                'santri.unit_id',
                'unit_pendidikan.kode as kode_unit',
                'unit_pendidikan.nama as nama_unit',
                'santri.kamar_id',
                'kamar.nama as nama_kamar',
                'santri.kelas_formal_id',
                'kelas_formal.nama_kelas as nama_kelas_formal',
                'santri.nama_wali',
                'santri.no_hp_wali',
                'santri.status_aktif',
                'santri.catatan_import'
            )
            ->orderBy('santri.nama')
            ->get();

        return response()->json($santri);
    }

    public function countSantri()
    {
        return response()->json(['total' => DB::table('santri')->count()]);
    }

    public function storeSantri(Request $request)
    {
        $data = $request->validate([
            'santri_id' => 'nullable|integer',
            'nis' => 'nullable|string|max:30',
            'nama' => 'required|string|max:150',
            'unit_id' => 'required|integer|exists:unit_pendidikan,unit_id',
            'kamar_id' => 'nullable|integer',
            'nama_wali' => 'nullable|string|max:150',
            'no_hp_wali' => 'nullable|string|max:20',
        ]);

        $nama = strtoupper(trim($data['nama']));
        $unitId = (int) $data['unit_id'];
        $kamarId = !empty($data['kamar_id']) ? (int) $data['kamar_id'] : null;

        if (!empty($data['santri_id'])) {
            DB::table('santri')->where('santri_id', $data['santri_id'])->update([
                'nis' => $data['nis'] ?: null,
                'nama' => $nama,
                'unit_id' => $unitId,
                'kamar_id' => $kamarId,
                'nama_wali' => $data['nama_wali'] ?: null,
                'no_hp_wali' => $data['no_hp_wali'] ?: null,
                'updated_at' => now(),
            ]);
            return response()->json(['message' => 'Data santri berhasil diperbarui']);
        } else {
            $id = DB::table('santri')->insertGetId([
                'nis' => $data['nis'] ?: null,
                'nama' => $nama,
                'unit_id' => $unitId,
                'kamar_id' => $kamarId,
                'nama_wali' => $data['nama_wali'] ?: null,
                'no_hp_wali' => $data['no_hp_wali'] ?: null,
                'status_aktif' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            return response()->json(['message' => 'Santri baru berhasil ditambahkan', 'santri_id' => $id], 201);
        }
    }

    public function getPenugasan()
    {
        $rows = DB::table('petugas_penugasan')
            ->join('petugas', 'petugas_penugasan.petugas_id', '=', 'petugas.petugas_id')
            ->orderBy('petugas.nama')
            ->select('petugas_penugasan.*', 'petugas.nama as nama_petugas', 'petugas.jabatan')
            ->get();

        foreach ($rows as $row) {
            $config = collect(self::PENUGASAN)->firstWhere('tipe', $row->tipe_target);
            $row->nama_target = $config
                ? DB::table($config['table'])->where($config['pk'], $row->target_id)->value($config['label'])
                : null;
        }

        return response()->json($rows);
    }

    public function storePenugasan(Request $request)
    {
        $data = $request->validate([
            'petugas_id' => 'required|integer|exists:petugas,petugas_id',
            'jenis' => 'required|in:sekolah,kamar,pbs,diniyah,pbm',
            'target_id' => 'required|integer',
        ]);
        $config = self::PENUGASAN[$data['jenis']];
        $petugas = DB::table('petugas')->where('petugas_id', $data['petugas_id'])->where('status_aktif', 1)->first();

        if (!$petugas || $petugas->jabatan !== $config['jabatan']) {
            return response()->json([
                'message' => "Kegiatan ini hanya dapat ditugaskan kepada petugas berjabatan {$config['jabatan']}",
            ], 422);
        }
        $targetQuery = DB::table($config['table'])->where($config['pk'], $data['target_id']);
        if ($data['jenis'] === 'sekolah') {
            $smpUnitId = DB::table('unit_pendidikan')->where('kode', 'SMP')->value('unit_id');
            $targetQuery->where('unit_id', $smpUnitId)->whereIn('tingkat', ['7', '8', '9']);
        }
        if (!$targetQuery->exists()) {
            return response()->json(['message' => 'Kelompok tujuan tidak ditemukan'], 422);
        }

        $result = DB::transaction(function () use ($data, $config) {
            $today = now()->toDateString();

            // Kelas formal hanya boleh memiliki satu penugasan aktif. wali_kelas_id
            // tetap metadata kepemilikan dan tidak memberikan akses tanpa penugasan.
            if ($data['jenis'] === 'sekolah') {
                $kelas = DB::table('kelas_formal')
                    ->where('kelas_formal_id', $data['target_id'])
                    ->lockForUpdate()
                    ->first();

                if ($kelas?->wali_kelas_id && (int) $kelas->wali_kelas_id !== $data['petugas_id']) {
                    $wali = DB::table('petugas')->where('petugas_id', $kelas->wali_kelas_id)->value('nama');
                    return ['error' => "Kelas {$kelas->nama_kelas} sudah dikelola oleh {$wali} sebagai wali kelas."];
                }

                $collision = DB::table('petugas_penugasan')
                    ->join('petugas', 'petugas_penugasan.petugas_id', '=', 'petugas.petugas_id')
                    ->where('petugas_penugasan.tipe_target', 'KelasFormal')
                    ->where('petugas_penugasan.target_id', $data['target_id'])
                    ->where('petugas_penugasan.petugas_id', '!=', $data['petugas_id'])
                    ->where(function ($query) use ($today) {
                        $query->whereNull('petugas_penugasan.tanggal_selesai')
                            ->orWhere('petugas_penugasan.tanggal_selesai', '>=', $today);
                    })
                    ->lockForUpdate()
                    ->first(['petugas.nama as nama_petugas']);

                if ($collision) {
                    return ['error' => "Kelas {$kelas->nama_kelas} sudah memiliki penugasan aktif untuk {$collision->nama_petugas}."];
                }
            }

            $existing = DB::table('petugas_penugasan')
                ->where('petugas_id', $data['petugas_id'])
                ->where('tipe_target', $config['tipe'])
                ->where('target_id', $data['target_id'])
                ->lockForUpdate()
                ->first();

            if ($existing) {
                DB::table('petugas_penugasan')->where('penugasan_id', $existing->penugasan_id)->update([
                    'sumber' => 'manual',
                    'tanggal_mulai' => $today,
                    'tanggal_selesai' => null,
                ]);
                return ['id' => $existing->penugasan_id];
            }

            return ['id' => DB::table('petugas_penugasan')->insertGetId([
                'petugas_id' => $data['petugas_id'],
                'tipe_target' => $config['tipe'],
                'target_id' => $data['target_id'],
                'sumber' => 'manual',
                'tanggal_mulai' => $today,
                'created_at' => now(),
            ])];
        });

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], 422);
        }

        return response()->json(['message' => 'Penugasan berhasil disimpan', 'penugasan_id' => $result['id']], 201);
    }

    public function deletePenugasan($id)
    {
        $deleted = DB::table('petugas_penugasan')->where('penugasan_id', $id)->delete();
        return $deleted
            ? response()->json(['message' => 'Penugasan dihapus'])
            : response()->json(['message' => 'Penugasan tidak ditemukan'], 404);
    }
}
