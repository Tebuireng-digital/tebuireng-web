<?php

namespace App\Http\Controllers;

use App\Support\KamarName;
use App\Support\SantriAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

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

    public function storePetugas(Request $request)
    {
        $data = $request->validate([
            'nama' => 'required|string|max:150',
            'username' => 'required|string|max:100|unique:petugas,username',
            'password' => 'required|string|min:8|max:100',
            'no_hp' => 'nullable|string|max:20',
            'jabatan' => 'required|in:Pengasuh,Ustadz,Pembina Kamar,Wali Kelas,Keamanan,Admin',
            'status_aktif' => 'sometimes|boolean',
        ]);

        $id = DB::table('petugas')->insertGetId([
            'nama' => trim($data['nama']),
            'username' => trim($data['username']),
            'password_hash' => Hash::make($data['password']),
            'no_hp' => $data['no_hp'] ?? null,
            'jabatan' => $data['jabatan'],
            'status_aktif' => $data['status_aktif'] ?? true,
            'wajib_ganti_password' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Petugas berhasil ditambahkan.',
            'petugas' => DB::table('petugas')->where('petugas_id', $id)->first(),
        ], 201);
    }

    public function updatePetugas(Request $request, int $id)
    {
        $petugas = DB::table('petugas')->where('petugas_id', $id)->first();
        if (!$petugas) {
            return response()->json(['message' => 'Petugas tidak ditemukan.'], 404);
        }

        $data = $request->validate([
            'nama' => 'required|string|max:150',
            'username' => 'required|string|max:100|unique:petugas,username,'.$id.',petugas_id',
            'password' => 'nullable|string|min:8|max:100|confirmed',
            'password_confirmation' => 'nullable|string|min:8|max:100',
            'no_hp' => 'nullable|string|max:20',
            'jabatan' => 'required|in:Pengasuh,Ustadz,Pembina Kamar,Wali Kelas,Keamanan,Admin',
            'status_aktif' => 'required|boolean',
        ]);

        if ($petugas->petugas_id === $request->user()->petugas_id && !$data['status_aktif']) {
            return response()->json(['message' => 'Akun yang sedang digunakan tidak dapat dihapus.'], 422);
        }

        $payload = [
            'nama' => trim($data['nama']),
            'username' => trim($data['username']),
            'no_hp' => $data['no_hp'] ?? null,
            'jabatan' => $data['jabatan'],
            'status_aktif' => $data['status_aktif'],
            'updated_at' => now(),
        ];
        if (!empty($data['password'])) {
            $payload['password_hash'] = Hash::make($data['password']);
            $payload['wajib_ganti_password'] = true;
        }

        DB::table('petugas')->where('petugas_id', $id)->update($payload);

        return response()->json([
            'message' => 'Data petugas berhasil diperbarui.',
            'petugas' => DB::table('petugas')->where('petugas_id', $id)->first(),
        ]);
    }

    public function destroyPetugas(Request $request, int $id)
    {
        $petugas = DB::table('petugas')->where('petugas_id', $id)->first();
        if (!$petugas) {
            return response()->json(['message' => 'Petugas tidak ditemukan.'], 404);
        }
        if ($petugas->petugas_id === $request->user()->petugas_id) {
            return response()->json(['message' => 'Akun yang sedang digunakan tidak dapat dinonaktifkan.'], 422);
        }

        DB::table('petugas')->where('petugas_id', $id)->update([
            'status_aktif' => false,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Petugas berhasil dinonaktifkan.']);
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

    public function updateKamar(Request $request, int $id)
    {
        $kamar = DB::table('kamar')->where('kamar_id', $id)->first();
        if (!$kamar) {
            return response()->json(['message' => 'Wisma/kamar tidak ditemukan.'], 404);
        }

        $data = $request->validate([
            'nama' => 'required|string|max:100|unique:kamar,nama,'.$id.',kamar_id',
            'kode_singkat' => 'nullable|string|max:20',
            'status_aktif' => 'required|boolean',
        ]);

        DB::table('kamar')->where('kamar_id', $id)->update([
            'nama' => trim($data['nama']),
            'kode_singkat' => $data['kode_singkat'] ? strtoupper(trim($data['kode_singkat'])) : null,
            'status_aktif' => $data['status_aktif'],
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Data wisma/kamar berhasil diperbarui.',
            'kamar' => DB::table('kamar')->where('kamar_id', $id)->first(),
        ]);
    }

    public function destroyKamar(Request $request, int $id)
    {
        $kamar = DB::table('kamar')->where('kamar_id', $id)->first();
        if (!$kamar) {
            return response()->json(['message' => 'Wisma/kamar tidak ditemukan.'], 404);
        }

        DB::table('kamar')->where('kamar_id', $id)->update([
            'status_aktif' => false,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Wisma/kamar berhasil dinonaktifkan.']);
    }

    public function getSantri()
    {
        $query = DB::table('santri')
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('kelas_formal', 'santri.kelas_formal_id', '=', 'kelas_formal.kelas_formal_id')
            ->leftJoin('organisasi_daerah', 'santri.organisasi_daerah_id', '=', 'organisasi_daerah.organisasi_daerah_id')
            ->leftJoin('santri_organisasi_daerah as sod', function ($join) {
                $join->on('sod.santri_id', '=', 'santri.santri_id')
                    ->where('sod.status', '=', 'aktif')
                    ->whereNull('sod.tanggal_selesai');
            })
            ->leftJoin('organisasi_daerah as od', 'sod.organisasi_daerah_id', '=', 'od.organisasi_daerah_id');

        $petugas = auth()->user();
        if ($petugas && $petugas->jabatan !== 'Admin') {
            SantriAccess::scopeAssigned($query, $petugas, 'santri');
        }

        $santri = $query->select(
                'santri.santri_id',
                'santri.no_id_induk',
                'santri.nis',
                'santri.nik_siswa',
                'santri.nama',
                'santri.jenis_kelamin',
                'santri.tempat_lahir',
                'santri.tanggal_lahir',
                'santri.no_hp_santri',
                'santri.alamat_jalan',
                'santri.provinsi',
                'santri.kabupaten_kota',
                'santri.kecamatan',
                'santri.desa_kelurahan',
                'santri.kode_pos',
                'santri.unit_id',
                'unit_pendidikan.kode as kode_unit',
                'unit_pendidikan.nama as nama_unit',
                'santri.kamar_id',
                'kamar.nama as nama_kamar',
                'santri.kelas_formal_id',
                'santri.kelompok_madin_id',
                'santri.kelompok_pbs_id',
                'santri.kelompok_pbm_id',
                'kelas_formal.nama_kelas as nama_kelas_formal',
                'santri.organisasi_daerah_id',
                'organisasi_daerah.kode_singkat as kode_orda',
                'organisasi_daerah.nama_organisasi as nama_orda',
                'santri.nama_wali',
                'santri.no_hp_wali',
                'santri.status_aktif',
                'santri.status_verifikasi',
                'santri.foto_path',
                'od.organisasi_daerah_id as sod_organisasi_daerah_id',
                'od.kode as kode_organisasi_daerah',
                'od.nama as nama_organisasi_daerah',
                'santri.catatan_import'
            )
            ->orderBy('santri.nama')
            ->get();

        $partisipasi = DB::table('santri_kegiatan_partisipasi as p')
            ->join('jenis_kegiatan as j', 'p.jenis_kegiatan_id', '=', 'j.jenis_kegiatan_id')
            ->whereIn('p.santri_id', $santri->pluck('santri_id'))
            ->get(['p.santri_id', 'j.kode', 'p.status', 'p.alasan'])
            ->groupBy('santri_id');
        foreach ($santri as $row) {
            $row->foto_url = $row->foto_path ? Storage::url($row->foto_path) : null;
            $row->kegiatan_partisipasi = ($partisipasi[$row->santri_id] ?? collect())
                ->mapWithKeys(fn ($item) => [strtolower($item->kode) => ['status' => $item->status, 'alasan' => $item->alasan]])
                ->all();
        }

        return response()->json($santri);
    }

    public function countSantri()
    {
        return response()->json(['total' => DB::table('santri')->count()]);
    }

    public function storeSantri(Request $request)
    {
        $petugas = auth()->user();
        if ($petugas && $petugas->jabatan !== 'Admin' && $request->input('santri_id')) {
            if (!SantriAccess::canAccess($petugas, (int) $request->input('santri_id'))) {
                return response()->json(['message' => 'Anda tidak memiliki akses untuk memperbarui data santri ini.'], 403);
            }
        }

        $data = $request->validate([
            'santri_id' => 'nullable|integer',
            'no_id_induk' => 'nullable|string|max:30|unique:santri,no_id_induk,'.($request->input('santri_id') ?: 'NULL').',santri_id',
            'nis' => 'nullable|string|max:30',
            'nik_siswa' => 'nullable|string|max:32',
            'nama' => 'required|string|max:150',
            'jenis_kelamin' => 'nullable|in:L,P',
            'tempat_lahir' => 'nullable|string|max:100',
            'tanggal_lahir' => 'nullable|date',
            'no_hp_santri' => 'nullable|string|max:30',
            'alamat_jalan' => 'nullable|string',
            'provinsi' => 'nullable|string|max:100',
            'kabupaten_kota' => 'nullable|string|max:120',
            'kecamatan' => 'nullable|string|max:120',
            'desa_kelurahan' => 'nullable|string|max:120',
            'kode_pos' => 'nullable|string|max:12',
            'unit_id' => 'required|integer|exists:unit_pendidikan,unit_id',
            'kamar_id' => 'nullable|integer',
            'kelas_formal_id' => 'nullable|integer|exists:kelas_formal,kelas_formal_id',
            'kelompok_madin_id' => 'nullable|integer|exists:kelompok_madin,kelompok_madin_id',
            'kelompok_pbs_id' => 'nullable|integer|exists:kelompok_pbs,kelompok_pbs_id',
            'kelompok_pbm_id' => 'nullable|integer|exists:kelompok_pbm,kelompok_pbm_id',
            'nama_wali' => 'nullable|string|max:150',
            'no_hp_wali' => 'nullable|string|max:20',
            'status_verifikasi' => 'nullable|in:perlu_verifikasi,terverifikasi_aktif,perlu_lengkapi_profil,perlu_tentukan_kelas,perlu_mapping_kegiatan,perlu_review_identitas,kandidat_alumni,nonaktif',
            'organisasi_daerah_id' => 'nullable|integer|exists:organisasi_daerah,organisasi_daerah_id',
            'no_kk' => 'nullable|string|max:32',
            'nama_ayah' => 'nullable|string|max:150',
            'nik_ayah' => 'nullable|string|max:32',
            'pendidikan_ayah' => 'nullable|string|max:50',
            'pekerjaan_ayah' => 'nullable|string|max:100',
            'nama_ibu' => 'nullable|string|max:150',
            'nik_ibu' => 'nullable|string|max:32',
            'pendidikan_ibu' => 'nullable|string|max:50',
            'pekerjaan_ibu' => 'nullable|string|max:100',
            'rata_rata_penghasilan' => 'nullable|string|max:50',
            'tahun_ajaran' => 'nullable|string|max:9',
            'pend_sumber' => 'nullable|string|max:20',
            'kelas_sumber' => 'nullable|string|max:30',
            'jurusan' => 'nullable|string|max:100',
            'kelas_paralel' => 'nullable|string|max:100',
            'ranking' => 'nullable|string|max:30',
            'status_siswa_sumber' => 'nullable|string|max:30',
            'asal_sekolah' => 'nullable|string|max:255',
            'jenis_sekolah' => 'nullable|string|max:50',
            'status_sekolah' => 'nullable|string|max:50',
            'lokasi_sekolah' => 'nullable|string|max:100',
            'no_un' => 'nullable|string|max:50',
            'kip' => 'nullable|string|max:50',
            'saldo_spp' => 'nullable|string|max:50',
            'kegiatan_partisipasi' => 'nullable|array',
            'kegiatan_partisipasi.*.status' => 'required_with:kegiatan_partisipasi|in:terdaftar,tidak_ikut,perlu_verifikasi',
            'kegiatan_partisipasi.*.alasan' => 'nullable|string|max:255',
        ]);

        $nama = strtoupper(trim($data['nama']));
        $unitId = (int) $data['unit_id'];
        $kamarId = !empty($data['kamar_id']) ? (int) $data['kamar_id'] : null;
        $ordaId = !empty($data['organisasi_daerah_id']) ? (int) $data['organisasi_daerah_id'] : null;

        $baseFields = ['no_id_induk', 'nis', 'nik_siswa', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'no_hp_santri', 'alamat_jalan', 'provinsi', 'kabupaten_kota', 'kecamatan', 'desa_kelurahan', 'kode_pos', 'kelas_formal_id', 'kelompok_madin_id', 'kelompok_pbs_id', 'kelompok_pbm_id', 'nama_wali', 'no_hp_wali', 'status_verifikasi', 'status_siswa_sumber'];
        $payload = ['nama' => $nama, 'unit_id' => $unitId, 'kamar_id' => $kamarId, 'organisasi_daerah_id' => $ordaId, 'updated_at' => now()];
        foreach ($baseFields as $field) {
            if (array_key_exists($field, $data)) {
                $payload[$field] = $data[$field] ?: null;
            }
        }

        $result = DB::transaction(function () use ($data, $payload) {
            if (!empty($data['santri_id'])) {
                DB::table('santri')->where('santri_id', $data['santri_id'])->update($payload);
                $santriId = (int) $data['santri_id'];
                $created = false;
            } else {
                $santriId = DB::table('santri')->insertGetId($payload + [
                    'password_hash' => Hash::make('masuk123'),
                    'wajib_ganti_password' => true,
                    'status_aktif' => 1,
                    'status_verifikasi' => $payload['status_verifikasi'] ?? 'perlu_verifikasi',
                    'created_at' => now(),
                ]);
                $created = true;
            }

            if ($created && Schema::hasTable('wali_accounts') && !empty($data['no_id_induk'])) {
                DB::table('wali_accounts')->insert([
                    'santri_id' => $santriId,
                    'username' => $data['no_id_induk'],
                    'password_hash' => Hash::make('masuk123'),
                    'wajib_ganti_password' => true,
                    'status_aktif' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $keluargaFields = ['no_kk', 'nama_ayah', 'nik_ayah', 'pendidikan_ayah', 'pekerjaan_ayah', 'nama_ibu', 'nik_ibu', 'pendidikan_ibu', 'pekerjaan_ibu', 'rata_rata_penghasilan'];
            if (array_intersect($keluargaFields, array_keys($data))) {
                $keluarga = collect($keluargaFields)->mapWithKeys(fn ($field) => [$field => $data[$field] ?? null])->all();
                DB::table('santri_keluarga')->updateOrInsert(['santri_id' => $santriId], $keluarga + ['updated_at' => now(), 'created_at' => now()]);
            }

            $pendidikanFields = ['pend_sumber', 'kelas_sumber', 'jurusan', 'kelas_paralel', 'ranking', 'status_siswa_sumber', 'asal_sekolah', 'jenis_sekolah', 'status_sekolah', 'lokasi_sekolah', 'no_un', 'kip', 'saldo_spp'];
            if (array_intersect($pendidikanFields, array_keys($data))) {
                $pendidikan = collect($pendidikanFields)->mapWithKeys(fn ($field) => [$field => $data[$field] ?? null])->all();
                DB::table('santri_pendidikan')->updateOrInsert(
                    ['santri_id' => $santriId, 'tahun_ajaran' => $data['tahun_ajaran'] ?? '2026/2027'],
                    $pendidikan + ['updated_at' => now(), 'created_at' => now()]
                );
            }

            if (array_key_exists('organisasi_daerah_id', $data)) {
                DB::table('santri_organisasi_daerah')->where('santri_id', $santriId)->where('status', 'aktif')->update([
                    'status' => 'nonaktif', 'tanggal_selesai' => now()->toDateString(), 'updated_at' => now(),
                ]);
                if ($data['organisasi_daerah_id']) {
                    DB::table('santri_organisasi_daerah')->insert([
                        'santri_id' => $santriId,
                        'organisasi_daerah_id' => $data['organisasi_daerah_id'],
                        'status' => 'aktif',
                        'sumber_penetapan' => 'manual',
                        'ditetapkan_oleh' => optional(request()->user())->petugas_id,
                        'tanggal_mulai' => now()->toDateString(),
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
            }

            if (!empty($data['kegiatan_partisipasi'])) {
                $kodeMap = ['sekolah' => 'SEKOLAH', 'kamar' => 'KAMAR', 'pbs' => 'PBS', 'diniyah' => 'DINIYAH', 'pbm' => 'PBM'];
                $jenisIds = DB::table('jenis_kegiatan')->pluck('jenis_kegiatan_id', 'kode');
                foreach ($data['kegiatan_partisipasi'] as $slug => $keputusan) {
                    $kode = $kodeMap[$slug] ?? null;
                    if (!$kode || !isset($jenisIds[$kode])) continue;
                    DB::table('santri_kegiatan_partisipasi')->updateOrInsert([
                        'santri_id' => $santriId,
                        'jenis_kegiatan_id' => $jenisIds[$kode],
                    ], [
                        'status' => $keputusan['status'],
                        'alasan' => $keputusan['alasan'] ?? null,
                        'ditetapkan_oleh' => optional(request()->user())->petugas_id,
                        'updated_at' => now(), 'created_at' => now(),
                    ]);
                }
            }

            return compact('santriId', 'created');
        });

        return response()->json(['message' => $result['created'] ? 'Santri baru berhasil ditambahkan' : 'Data santri berhasil diperbarui', 'santri_id' => $result['santriId']], $result['created'] ? 201 : 200);
    }

    public function santriOptions()
    {
        return response()->json([
            'unit_pendidikan' => DB::table('unit_pendidikan')->orderBy('kode')->get(['unit_id', 'kode', 'nama']),
            'organisasi_daerah' => DB::table('organisasi_daerah')->where('status_aktif', 1)->orderBy('nama')->get(['organisasi_daerah_id', 'kode', 'nama']),
            'kelas_formal' => DB::table('kelas_formal')->orderBy('nama_kelas')->get(['kelas_formal_id', 'nama_kelas']),
            'kelompok_madin' => DB::table('kelompok_madin')->orderBy('nama_kelas_madin')->get(['kelompok_madin_id', 'nama_kelas_madin']),
            'kelompok_pbs' => DB::table('kelompok_pbs')->orderBy('nama_kelompok')->get(['kelompok_pbs_id', 'nama_kelompok']),
            'kelompok_pbm' => DB::table('kelompok_pbm')->orderBy('nama_kelompok')->get(['kelompok_pbm_id', 'nama_kelompok']),
        ]);
    }

    public function verificationQueue(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 50), 10), 100);
        $rows = DB::table('santri')
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->select('santri.santri_id', 'santri.no_id_induk', 'santri.nama', 'santri.kamar_id', 'santri.kelas_formal_id', 'santri.kelompok_madin_id', 'santri.kelompok_pbs_id', 'santri.kelompok_pbm_id', 'santri.status_verifikasi', 'unit_pendidikan.kode as kode_unit')
            ->where(function ($query) {
                $query->whereNull('santri.kamar_id')
                    ->orWhereNull('santri.kelas_formal_id')
                    ->orWhereExists(function ($subquery) {
                        $subquery->selectRaw('1')
                            ->from('santri_kegiatan_partisipasi as partisipasi')
                            ->join('jenis_kegiatan as kegiatan', 'partisipasi.jenis_kegiatan_id', '=', 'kegiatan.jenis_kegiatan_id')
                            ->whereColumn('partisipasi.santri_id', 'santri.santri_id')
                            ->where('partisipasi.status', '!=', 'tidak_ikut')
                            ->where(function ($kegiatanQuery) {
                                $kegiatanQuery
                                    ->where(function ($group) {
                                        $group->where('kegiatan.kode', 'DINIYAH')->whereNull('santri.kelompok_madin_id');
                                    })
                                    ->orWhere(function ($group) {
                                        $group->where('kegiatan.kode', 'PBS')->whereNull('santri.kelompok_pbs_id');
                                    })
                                    ->orWhere(function ($group) {
                                        $group->where('kegiatan.kode', 'PBM')->whereNull('santri.kelompok_pbm_id');
                                    });
                            });
                    });
            })
            ->orderBy('santri.nama')
            ->paginate($perPage);

        $santri = collect($rows->items());

        $partisipasi = DB::table('santri_kegiatan_partisipasi as p')
            ->join('jenis_kegiatan as j', 'p.jenis_kegiatan_id', '=', 'j.jenis_kegiatan_id')
            ->whereIn('p.santri_id', $santri->pluck('santri_id'))
            ->get(['p.santri_id', 'j.kode', 'p.status'])
            ->groupBy('santri_id');

        foreach ($santri as $row) {
            $statusKegiatan = ($partisipasi[$row->santri_id] ?? collect())->pluck('status', 'kode');
            $alasan = [];
            if (!$row->kamar_id && ($statusKegiatan['KAMAR'] ?? 'perlu_verifikasi') !== 'tidak_ikut') $alasan[] = 'kamar belum dipetakan';
            if (!$row->kelas_formal_id) $alasan[] = 'kelas formal belum dipetakan';
            if (!$row->kelompok_madin_id && ($statusKegiatan['DINIYAH'] ?? 'perlu_verifikasi') !== 'tidak_ikut') $alasan[] = 'Madin belum dipetakan';
            if (!$row->kelompok_pbs_id && ($statusKegiatan['PBS'] ?? 'perlu_verifikasi') !== 'tidak_ikut') $alasan[] = 'Al-Qur’an Subuh belum dipetakan';
            if (!$row->kelompok_pbm_id && ($statusKegiatan['PBM'] ?? 'perlu_verifikasi') !== 'tidak_ikut') $alasan[] = 'Takhasus Maghrib belum dipetakan';
            $row->alasan = $alasan;
        }

        $rows->setCollection($santri);

        return response()->json($rows);
    }

    public function ordaVerificationQueue(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 50), 10), 100);
        $rows = DB::table('santri')
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->leftJoin('santri_organisasi_daerah as sod', function ($join) {
                $join->on('sod.santri_id', '=', 'santri.santri_id')
                    ->where('sod.status', 'aktif')
                    ->whereNull('sod.tanggal_selesai');
            })
            ->whereNull('sod.santri_organisasi_daerah_id')
            ->select('santri.santri_id', 'santri.no_id_induk', 'santri.nama', 'santri.status_verifikasi', 'unit_pendidikan.kode as kode_unit')
            ->orderBy('santri.nama')
            ->paginate($perPage);

        $rows->getCollection()->each(function ($row) {
            $row->alasan = ['ORDA belum ditetapkan'];
        });

        return response()->json($rows);
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
