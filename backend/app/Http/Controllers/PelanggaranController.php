<?php

namespace App\Http\Controllers;

use App\Models\Pelanggaran;
use App\Support\MediaStorage;
use App\Support\MediaUrl;
use App\Support\SantriAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class PelanggaranController extends Controller
{
    /**
     * Sanitasi string input: menghapus script/style block, tag HTML, null byte, dan normalisasi spasi.
     */
    private function sanitizeInput(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $clean = preg_replace('/<script\b[^>]*>(.*?)<\/script>/is', '', $value);
        $clean = preg_replace('/<style\b[^>]*>(.*?)<\/style>/is', '', $clean);
        $clean = strip_tags($clean);
        $clean = str_replace(chr(0), '', $clean);
        $clean = trim(preg_replace('/\s+/u', ' ', $clean));

        return $clean === '' ? null : $clean;
    }

    public function getKategori(Request $request)
    {
        if (Gate::forUser($request->user())->denies('viewAny', Pelanggaran::class)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $query = DB::table('kategori_pelanggaran');

        if (!$request->boolean('all') || !in_array($request->user()->jabatan, ['Admin', 'Keamanan'], true)) {
            $query->where('status_aktif', 'Aktif');
        }

        $kategori = $query->orderBy('poin_maks', 'asc')->get();
        return response()->json($kategori);
    }

    public function storeKategori(Request $request)
    {
        abort_unless(in_array($request->user()->jabatan, ['Admin', 'Keamanan'], true), 403, 'Hanya Admin atau Keamanan yang dapat mengelola master pelanggaran.');
        $data = $request->validate(['kode_pasal' => 'required|string|max:30', 'kategori' => 'required|in:Ringan,Sedang,Berat,Kewajiban', 'uraian_pelanggaran' => 'required|string|max:1000', 'poin_maks' => 'required|integer|min:1|max:100', 'jenis' => 'required|in:Pelanggaran,Meninggalkan Kewajiban']);

        $data['kode_pasal'] = $this->sanitizeInput($data['kode_pasal']);
        $data['uraian_pelanggaran'] = $this->sanitizeInput($data['uraian_pelanggaran']);

        if (!$data['kode_pasal']) {
            return response()->json([
                'message' => 'Kode pasal tidak boleh kosong atau hanya berisi tag HTML.',
                'errors' => ['kode_pasal' => ['Kode pasal tidak valid.']],
            ], 422);
        }

        if (!$data['uraian_pelanggaran']) {
            return response()->json([
                'message' => 'Uraian pelanggaran tidak boleh kosong atau hanya berisi tag HTML.',
                'errors' => ['uraian_pelanggaran' => ['Uraian pelanggaran tidak valid.']],
            ], 422);
        }

        $id = DB::table('kategori_pelanggaran')->insertGetId([...$data, 'status_aktif' => 'Aktif', 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(DB::table('kategori_pelanggaran')->where('kategori_pelanggaran_id', $id)->first(), 201);
    }

    public function updateKategori(Request $request, int $id)
    {
        abort_unless(in_array($request->user()->jabatan, ['Admin', 'Keamanan'], true), 403, 'Hanya Admin atau Keamanan yang dapat mengelola master pelanggaran.');
        $data = $request->validate([
            'kode_pasal' => 'sometimes|string|max:30',
            'kategori' => 'sometimes|in:Ringan,Sedang,Berat,Kewajiban',
            'uraian_pelanggaran' => 'sometimes|string|max:1000',
            'poin_maks' => 'sometimes|integer|min:1|max:100',
            'jenis' => 'sometimes|in:Pelanggaran,Meninggalkan Kewajiban',
            'status_aktif' => 'sometimes|in:Aktif,Tidak Aktif',
        ]);

        if (array_key_exists('kode_pasal', $data)) {
            $data['kode_pasal'] = $this->sanitizeInput($data['kode_pasal']);
            if (!$data['kode_pasal']) {
                return response()->json([
                    'message' => 'Kode pasal tidak boleh kosong atau hanya berisi tag HTML.',
                    'errors' => ['kode_pasal' => ['Kode pasal tidak valid.']],
                ], 422);
            }
        }

        if (array_key_exists('uraian_pelanggaran', $data)) {
            $data['uraian_pelanggaran'] = $this->sanitizeInput($data['uraian_pelanggaran']);
            if (!$data['uraian_pelanggaran']) {
                return response()->json([
                    'message' => 'Uraian pelanggaran tidak boleh kosong atau hanya berisi tag HTML.',
                    'errors' => ['uraian_pelanggaran' => ['Uraian pelanggaran tidak valid.']],
                ], 422);
            }
        }

        DB::table('kategori_pelanggaran')->where('kategori_pelanggaran_id', $id)->update([...$data, 'updated_at' => now()]);
        return response()->json(DB::table('kategori_pelanggaran')->where('kategori_pelanggaran_id', $id)->first());
    }

    public function destroyKategori(Request $request, int $id)
    {
        abort_unless(in_array($request->user()->jabatan, ['Admin', 'Keamanan'], true), 403, 'Hanya Admin atau Keamanan yang dapat mengelola master pelanggaran.');
        DB::table('kategori_pelanggaran')->where('kategori_pelanggaran_id', $id)->update(['status_aktif' => 'Tidak Aktif', 'updated_at' => now()]);
        return response()->json(['message' => 'Master pelanggaran dinonaktifkan; histori tetap dipertahankan.']);
    }

    public function index(Request $request)
    {
        $petugas = $request->user();
        if (Gate::forUser($petugas)->denies('viewAny', Pelanggaran::class)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $query = DB::table('pelanggaran')
            ->join('kategori_pelanggaran', 'pelanggaran.kategori_pelanggaran_id', '=', 'kategori_pelanggaran.kategori_pelanggaran_id')
            ->join('santri', 'pelanggaran.santri_id', '=', 'santri.santri_id')
            ->select(
                'pelanggaran.*',
                'santri.nama as nama_santri',
                'santri.foto_path',
                'santri.foto_uploaded_at',
                'kategori_pelanggaran.uraian_pelanggaran',
                'kategori_pelanggaran.kategori',
                'kategori_pelanggaran.poin_maks'
            );

        if ($petugas->jabatan === 'Pembina Kamar') {
            SantriAccess::scopeAssigned($query, $petugas);
        }

        if ($request->has('santri_id')) {
            $query->where('pelanggaran.santri_id', $request->santri_id);
        }
        if ($request->has('kategori_id')) {
            $query->where('pelanggaran.kategori_pelanggaran_id', $request->kategori_id);
        }
        if ($request->has('dari')) {
            $query->where('pelanggaran.tanggal', '>=', $request->dari);
        }
        if ($request->has('sampai')) {
            $query->where('pelanggaran.tanggal', '<=', $request->sampai);
        }

        if ($request->has('kamar_id') || $request->has('kelas_id')) {
            if ($request->has('kamar_id')) {
                $query->where('santri.kamar_id', $request->kamar_id);
            }
            if ($request->has('kelas_id')) {
                $query->where('santri.kelas_formal_id', $request->kelas_id);
            }
        }

        $records = $query->orderBy('pelanggaran.tanggal', 'desc')->get();
        $now = now();

        $result = $records->map(function ($row) use ($petugas, $now) {
            $canEdit = false;
            $isLocked = false;

            if ($petugas->jabatan === 'Admin') {
                $canEdit = true;
            } elseif ($petugas->jabatan === 'Keamanan') {
                $isOwner = (int) $row->petugas_pencatat_id === (int) $petugas->petugas_id;
                if ($isOwner) {
                    if ($row->created_at) {
                        $diffSeconds = abs($now->diffInSeconds(\Carbon\Carbon::parse($row->created_at), false));
                        if ($diffSeconds <= 86400) {
                            $canEdit = true;
                        } else {
                            $isLocked = true;
                        }
                    }
                }
            }

            $row->can_edit = $canEdit;
            $row->is_locked = $isLocked;
            $row->foto_url = $row->foto_path ? MediaUrl::santriPhoto((int) $row->santri_id, $row->foto_uploaded_at) : null;
            unset($row->foto_path, $row->foto_uploaded_at);
            return $row;
        });

        return response()->json($result);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'santri_id' => 'required|integer|exists:santri,santri_id',
            'kategori_pelanggaran_id' => 'required|integer',
            'uraian_pelanggaran_custom' => 'nullable|string|max:255',
            'kategori_custom' => 'nullable|string|in:Ringan,Sedang,Berat,Kewajiban',
            'poin' => 'nullable|integer|min:1',
            'tanggal' => 'required|date',
            'keterangan' => 'nullable|string',
            'file' => MediaStorage::validationRules('pelanggaran_attachment'),
        ], [
            'santri_id.required' => 'Santri wajib dipilih.',
            'santri_id.exists' => 'Santri yang dipilih tidak ditemukan.',
            'kategori_pelanggaran_id.required' => 'Kategori pelanggaran wajib dipilih.',
            'kategori_pelanggaran_id.integer' => 'Kategori pelanggaran tidak valid.',
            'tanggal.required' => 'Tanggal kejadian wajib diisi.',
            'tanggal.date' => 'Tanggal kejadian tidak valid.',
            'poin.integer' => 'Jumlah poin harus berupa angka.',
            'poin.min' => 'Jumlah poin minimal adalah 1.',
            'file.file' => 'Bukti foto harus berupa file yang dapat diunggah.',
            'file.image' => 'Bukti pendukung harus berupa gambar yang valid.',
            'file.mimes' => 'Bukti foto harus berformat JPG, PNG, atau WEBP.',
            'file.mimetypes' => 'Bukti foto harus berformat JPG, PNG, atau WEBP.',
            'file.max' => 'Ukuran bukti foto maksimal 1 MB.',
        ]);

        $petugas = Auth::user();

        // Gate validation
        $model = new Pelanggaran();
        $model->santri_id = $data['santri_id'];
        if (Gate::forUser($petugas)->denies('create', $model)) {
            return response()->json(['message' => 'Role kamu tidak memiliki akses ini.'], 403);
        }

        $data['keterangan'] = $this->sanitizeInput($data['keterangan'] ?? null);

        // Handle Custom / Manual violation input
        if ((int) $data['kategori_pelanggaran_id'] === 0 || !empty($data['uraian_pelanggaran_custom'])) {
            $request->validate([
                'uraian_pelanggaran_custom' => 'required|string|max:255',
                'kategori_custom' => 'required|string|in:Ringan,Sedang,Berat,Kewajiban',
                'poin' => 'required|integer|min:1|max:100',
            ], [
                'uraian_pelanggaran_custom.required' => 'Nama atau uraian pelanggaran baru wajib diisi.',
                'uraian_pelanggaran_custom.max' => 'Nama atau uraian pelanggaran maksimal 255 karakter.',
                'kategori_custom.required' => 'Tingkat kategori pelanggaran wajib dipilih.',
                'kategori_custom.in' => 'Tingkat kategori pelanggaran tidak valid.',
                'poin.required' => 'Jumlah poin pelanggaran manual wajib diisi.',
                'poin.integer' => 'Jumlah poin pelanggaran manual harus berupa angka.',
                'poin.min' => 'Jumlah poin pelanggaran manual minimal 1.',
                'poin.max' => 'Jumlah poin pelanggaran manual maksimal 100.',
            ]);

            $cleanCustomDescription = $this->sanitizeInput($data['uraian_pelanggaran_custom'] ?? null);
            if (!$cleanCustomDescription) {
                return response()->json([
                    'message' => 'Nama atau uraian pelanggaran baru tidak boleh kosong atau hanya berisi tag HTML.',
                    'errors' => ['uraian_pelanggaran_custom' => ['Nama atau uraian pelanggaran baru tidak valid.']],
                ], 422);
            }

            $customCategory = strtolower(trim($data['kategori_custom']));
            if ($petugas->jabatan === 'Pembina Kamar' && $customCategory !== 'ringan') {
                return response()->json(['message' => 'Pembina Kamar hanya dapat menginput pelanggaran Ringan'], 403);
            }
            if ($petugas->jabatan === 'Keamanan' && !in_array($customCategory, ['sedang', 'berat'], true)) {
                return response()->json(['message' => 'Keamanan hanya dapat menginput pelanggaran Sedang dan Berat'], 403);
            }

            $kodePasal = 'CUSTOM-' . strtoupper(Str::random(6));
            $kategoriId = DB::table('kategori_pelanggaran')->insertGetId([
                'kode_pasal' => $kodePasal,
                'kategori' => $data['kategori_custom'],
                'uraian_pelanggaran' => $cleanCustomDescription,
                'poin_maks' => (int) $data['poin'],
                'jenis' => $data['kategori_custom'] === 'Kewajiban' ? 'Meninggalkan Kewajiban' : 'Pelanggaran',
                'status_aktif' => 'Aktif',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $data['kategori_pelanggaran_id'] = $kategoriId;
        }

        // Validate kategori
        $kategori = DB::table('kategori_pelanggaran')
            ->where('kategori_pelanggaran_id', $data['kategori_pelanggaran_id'])
            ->where('status_aktif', 'Aktif')
            ->first();

        if (!$kategori) {
            return response()->json(['message' => 'Kategori pelanggaran tidak valid atau tidak aktif'], 400);
        }

        $poin = (int) ($data['poin'] ?? $kategori->poin_maks);
        if ($poin > (int) $kategori->poin_maks) {
            return response()->json([
                'message' => "Jumlah poin tidak boleh lebih dari {$kategori->poin_maks} poin untuk kategori ini.",
            ], 422);
        }
        $data['poin'] = $poin;

        // Validasi Role
        if ($petugas->jabatan === 'Pembina Kamar' && strtolower(trim($kategori->kategori)) !== 'ringan') {
            return response()->json(['message' => 'Pembina Kamar hanya dapat menginput pelanggaran Ringan'], 403);
        }
        if ($petugas->jabatan === 'Keamanan' && !in_array(strtolower(trim($kategori->kategori)), ['sedang', 'berat'])) {
            return response()->json(['message' => 'Keamanan hanya dapat menginput pelanggaran Sedang dan Berat'], 403);
        }

        // Clean custom fields before saving to pelanggaran table
        unset($data['uraian_pelanggaran_custom'], $data['kategori_custom']);

        $data['petugas_pencatat_id'] = $petugas->petugas_id;
        $data['created_at'] = now()->toDateTimeString();
        $data['updated_at'] = now()->toDateTimeString();

        $storedAttachment = null;
        $attachment = $request->file('file');
        unset($data['file']);

        try {
            $pelanggaranId = DB::transaction(function () use ($data, $petugas, $attachment, &$storedAttachment) {
                $pelanggaranId = DB::table('pelanggaran')->insertGetId($data);

                if ($attachment) {
                    $storedAttachment = MediaStorage::store($attachment, 'pelanggaran_attachment');
                    $this->persistLampiran($pelanggaranId, $petugas->petugas_id, $storedAttachment);
                }

                Cache::forget("santri:{$data['santri_id']}:poin");

                $totalPoin = $this->getPoinSantri($data['santri_id']);
                $ambang = DB::table('pengaturan_sistem')->where('setting_key', 'ambang_notifikasi_poin')->value('setting_value') ?? 20;

                if ($totalPoin >= $ambang) {
                    $adminIds = DB::table('petugas')->where('jabatan', 'Admin')->where('status_aktif', 1)->pluck('petugas_id');
                    $notifications = [];
                    foreach ($adminIds as $pId) {
                        $notifications[] = [
                            'petugas_id' => $pId,
                            'judul' => 'Ambang Poin Pelanggaran',
                            'pesan' => "Santri ID {$data['santri_id']} telah mencapai {$totalPoin} poin pelanggaran (Ambang: {$ambang}).",
                            'tipe' => 'ambang_poin',
                            'referensi_tabel' => 'pelanggaran',
                            'referensi_id' => $pelanggaranId,
                            'created_at' => now()->toDateTimeString()
                        ];
                    }
                    if (!empty($notifications)) {
                        DB::table('notifikasi')->insert($notifications);
                    }
                }

                return $pelanggaranId;
            });
        } catch (\Throwable $exception) {
            if (is_array($storedAttachment)) {
                MediaStorage::delete($storedAttachment['disk'], $storedAttachment['path']);
            }

            throw $exception;
        }

        event(new \App\Events\PelanggaranDicatat($pelanggaranId));

        return response()->json([
            'message' => 'Pelanggaran berhasil disimpan',
            'pelanggaran_id' => $pelanggaranId,
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $pelanggaran = $this->findPelanggaranModel($id);
        if (!$pelanggaran) {
            return response()->json(['message' => 'Pelanggaran tidak ditemukan.'], 404);
        }

        if (Gate::forUser($request->user())->denies('update', $pelanggaran)) {
            $isOwner = (int) $pelanggaran->petugas_pencatat_id === (int) $request->user()->petugas_id;
            if ($request->user()->jabatan === 'Keamanan' && $isOwner) {
                return response()->json([
                    'message' => 'Batas waktu koreksi (24 jam) telah berakhir. Data telah dikunci.',
                ], 403);
            }
            return response()->json(['message' => 'Role kamu tidak memiliki hak mengoreksi data ini.'], 403);
        }

        $validated = $request->validate([
            'santri_id' => 'required|integer|exists:santri,santri_id',
            'kategori_pelanggaran_id' => 'required|integer|exists:kategori_pelanggaran,kategori_pelanggaran_id',
            'tanggal' => 'required|date|before_or_equal:today',
            'keterangan' => 'nullable|string',
            'alasan_koreksi' => 'required|string|min:5|max:500',
        ], [
            'alasan_koreksi.required' => 'Alasan koreksi wajib diisi.',
            'alasan_koreksi.min' => 'Alasan koreksi minimal 5 karakter.',
            'tanggal.before_or_equal' => 'Tanggal pelanggaran tidak boleh di masa depan.',
        ]);

        $kategori = DB::table('kategori_pelanggaran')
            ->where('kategori_pelanggaran_id', $validated['kategori_pelanggaran_id'])
            ->first();

        $poin = $kategori->poin_maks ?? 0;
        $cleanKeterangan = $this->sanitizeInput($validated['keterangan'] ?? null);
        $cleanAlasanKoreksi = $this->sanitizeInput($validated['alasan_koreksi']);

        if (!$cleanAlasanKoreksi || mb_strlen($cleanAlasanKoreksi) < 5) {
            return response()->json([
                'message' => 'Alasan koreksi tidak boleh kosong atau hanya berisi tag HTML.',
                'errors' => ['alasan_koreksi' => ['Alasan koreksi minimal 5 karakter setelah dibersihkan.']],
            ], 422);
        }

        DB::table('pelanggaran')
            ->where('pelanggaran_id', $id)
            ->update([
                'santri_id' => $validated['santri_id'],
                'kategori_pelanggaran_id' => $validated['kategori_pelanggaran_id'],
                'tanggal' => $validated['tanggal'],
                'keterangan' => $cleanKeterangan,
                'poin' => $poin,
                'diubah_oleh_petugas_id' => $request->user()->petugas_id,
                'alasan_koreksi' => $cleanAlasanKoreksi,
                'waktu_koreksi' => now(),
                'jumlah_koreksi' => DB::raw('COALESCE(jumlah_koreksi, 0) + 1'),
                'updated_at' => now(),
            ]);

        $updated = DB::table('pelanggaran')
            ->join('kategori_pelanggaran', 'pelanggaran.kategori_pelanggaran_id', '=', 'kategori_pelanggaran.kategori_pelanggaran_id')
            ->join('santri', 'pelanggaran.santri_id', '=', 'santri.santri_id')
            ->select('pelanggaran.*', 'santri.nama as nama_santri', 'kategori_pelanggaran.uraian_pelanggaran', 'kategori_pelanggaran.kategori', 'kategori_pelanggaran.poin_maks')
            ->where('pelanggaran.pelanggaran_id', $id)
            ->first();

        if ($updated) {
            $updated->can_edit = Gate::forUser($request->user())->allows('update', $this->findPelanggaranModel($id));
            $updated->is_locked = false;
        }

        return response()->json([
            'message' => 'Data pelanggaran berhasil dikoreksi.',
            'data' => $updated,
        ]);
    }

    public function uploadLampiran(Request $request, $id)
    {
        $pelanggaran = $this->findPelanggaranModel((int) $id);
        if (!$pelanggaran) {
            return response()->json(['message' => 'Pelanggaran tidak ditemukan.'], 404);
        }

        if (Gate::forUser($request->user())->denies('update', $pelanggaran)) {
            return response()->json(['message' => 'Role kamu tidak memiliki akses ini.'], 403);
        }

        $request->validate([
            'file' => MediaStorage::validationRules('pelanggaran_attachment', true),
        ], [
            'file.required' => 'Bukti foto wajib diunggah.',
            'file.file' => 'Bukti foto harus berupa file yang dapat diunggah.',
            'file.image' => 'Bukti pendukung harus berupa gambar yang valid.',
            'file.mimes' => 'Bukti foto harus berformat JPG, PNG, atau WEBP.',
            'file.mimetypes' => 'Bukti foto harus berformat JPG, PNG, atau WEBP.',
            'file.max' => 'Ukuran bukti foto maksimal 1 MB.',
        ]);

        $file = $request->file('file');
        $storedAttachment = MediaStorage::store($file, 'pelanggaran_attachment');

        try {
            $lampiranId = DB::transaction(function () use ($id, $request, $storedAttachment) {
                return $this->persistLampiran((int) $id, $request->user()->petugas_id, $storedAttachment);
            });
        } catch (\Throwable $exception) {
            MediaStorage::delete($storedAttachment['disk'], $storedAttachment['path']);

            throw $exception;
        }

        $lampiran = DB::table('lampiran_pelanggaran')
            ->where('lampiran_id', $lampiranId)
            ->first();

        return response()->json([
            'message' => 'Lampiran berhasil diunggah.',
            'lampiran' => $lampiran ? $this->formatLampiranResponse($lampiran) : null,
        ]);
    }

    public function listLampiran(Request $request, int $id)
    {
        $pelanggaran = $this->findPelanggaranModel($id);
        if (!$pelanggaran) {
            return response()->json(['message' => 'Pelanggaran tidak ditemukan.'], 404);
        }

        if (Gate::forUser($request->user())->denies('view', $pelanggaran)) {
            return response()->json(['message' => 'Role kamu tidak memiliki akses ini.'], 403);
        }

        $lampiran = DB::table('lampiran_pelanggaran')
            ->where('pelanggaran_id', $id)
            ->orderByDesc('created_at')
            ->orderByDesc('lampiran_id')
            ->get()
            ->map(fn ($item) => $this->formatLampiranResponse($item));

        return response()->json($lampiran);
    }

    public function showLampiran(Request $request, int $id, int $lampiranId)
    {
        $pelanggaran = $this->findPelanggaranModel($id);
        if (!$pelanggaran) {
            return response()->json(['message' => 'Pelanggaran tidak ditemukan.'], 404);
        }

        if (Gate::forUser($request->user())->denies('view', $pelanggaran)) {
            return response()->json(['message' => 'Role kamu tidak memiliki akses ini.'], 403);
        }

        $lampiran = DB::table('lampiran_pelanggaran')
            ->where('pelanggaran_id', $id)
            ->where('lampiran_id', $lampiranId)
            ->first();

        if (!$lampiran) {
            return response()->json(['message' => 'Lampiran tidak ditemukan.'], 404);
        }

        $profile = MediaStorage::profile('pelanggaran_attachment');

        return MediaStorage::stream(
            $lampiran->disk ?: $profile['disk'],
            $lampiran->path_file,
            $lampiran->original_filename ?: sprintf('pelanggaran-%d-lampiran-%d', $id, $lampiranId),
            $lampiran->mime_type,
            $request->boolean('download') ? 'attachment' : 'inline',
            $profile['fallback_read_disks']
        );
    }

    public function getPoin(Request $request, $santriId)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Keamanan', 'Pembina Kamar'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if ($petugas->jabatan === 'Pembina Kamar' && !SantriAccess::canAccess($petugas, (int) $santriId)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $poin = $this->getPoinSantri($santriId);
        return response()->json(['santri_id' => $santriId, 'total_poin' => $poin]);
    }

    private function getPoinSantri($santriId)
    {
        return Cache::rememberForever("santri:{$santriId}:poin", function () use ($santriId) {
            return (int) DB::table('pelanggaran')
                ->where('santri_id', $santriId)
                ->sum('poin');
        });
    }

    /**
     * @param  array{
     *     disk:string,
     *     path:string,
     *     original_filename:string,
     *     mime_type:string,
     *     size_bytes:int,
     *     sha256:string
     * }  $storedAttachment
     */
    private function persistLampiran(int $pelanggaranId, int $petugasId, array $storedAttachment): int
    {
        $timestamp = now();

        return DB::table('lampiran_pelanggaran')->insertGetId([
            'pelanggaran_id' => $pelanggaranId,
            'path_file' => $storedAttachment['path'],
            'disk' => $storedAttachment['disk'],
            'original_filename' => $storedAttachment['original_filename'],
            'mime_type' => $storedAttachment['mime_type'],
            'size_bytes' => $storedAttachment['size_bytes'],
            'sha256' => $storedAttachment['sha256'],
            'diunggah_oleh' => $petugasId,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    private function findPelanggaranModel(int $id): ?Pelanggaran
    {
        $pelanggaran = DB::table('pelanggaran')->where('pelanggaran_id', $id)->first();
        if (!$pelanggaran) {
            return null;
        }

        $model = new Pelanggaran((array) $pelanggaran);
        $model->exists = true;

        return $model;
    }

    /**
     * @return array{
     *     lampiran_id:int,
     *     pelanggaran_id:int,
     *     original_filename:string,
     *     mime_type:string|null,
     *     size_bytes:int|null,
     *     created_at:mixed,
     *     preview_url:string,
     *     download_url:string
     * }
     */
    private function formatLampiranResponse(object $lampiran): array
    {
        $previewUrl = MediaUrl::pelanggaranLampiran(
            (int) $lampiran->pelanggaran_id,
            (int) $lampiran->lampiran_id,
            $lampiran->updated_at ?? $lampiran->created_at
        );

        return [
            'lampiran_id' => (int) $lampiran->lampiran_id,
            'pelanggaran_id' => (int) $lampiran->pelanggaran_id,
            'original_filename' => $lampiran->original_filename ?: basename($lampiran->path_file),
            'mime_type' => $lampiran->mime_type,
            'size_bytes' => $lampiran->size_bytes !== null ? (int) $lampiran->size_bytes : null,
            'created_at' => $lampiran->created_at,
            'preview_url' => $previewUrl,
            'download_url' => $previewUrl.(str_contains($previewUrl, '?') ? '&' : '?').'download=1',
        ];
    }
}
