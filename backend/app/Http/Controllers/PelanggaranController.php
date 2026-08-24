<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use App\Models\Pelanggaran;
use App\Support\SantriAccess;
use Illuminate\Support\Str;

class PelanggaranController extends Controller
{
    public function getKategori(Request $request)
    {
        if (Gate::forUser($request->user())->denies('viewAny', Pelanggaran::class)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $kategori = DB::table('kategori_pelanggaran')
            ->where('status_aktif', 'Aktif')
            ->orderBy('poin_maks', 'asc')
            ->get();
        return response()->json($kategori);
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
            ->select('pelanggaran.*', 'santri.nama as nama_santri', 'kategori_pelanggaran.uraian_pelanggaran', 'kategori_pelanggaran.kategori', 'kategori_pelanggaran.poin_maks');

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

        return response()->json($query->orderBy('pelanggaran.tanggal', 'desc')->get());
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
            'file' => 'nullable|file|mimes:jpeg,png,jpg,webp|max:5120',
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
            'file.mimes' => 'Bukti foto harus berformat JPG, PNG, atau WEBP.',
            'file.max' => 'Ukuran bukti foto maksimal 5 MB.',
        ]);

        $petugas = Auth::user();

        // Gate validation
        $model = new Pelanggaran();
        $model->santri_id = $data['santri_id'];
        if (Gate::forUser($petugas)->denies('create', $model)) {
            return response()->json(['message' => 'Role kamu tidak memiliki akses ini.'], 403);
        }

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

            $kodePasal = 'CUSTOM-' . strtoupper(Str::random(6));
            $kategoriId = DB::table('kategori_pelanggaran')->insertGetId([
                'kode_pasal' => $kodePasal,
                'kategori' => $data['kategori_custom'],
                'uraian_pelanggaran' => trim($data['uraian_pelanggaran_custom']),
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

        $attachmentPath = null;
        $attachment = $request->file('file');
        unset($data['file']);

        try {
            $pelanggaranId = DB::transaction(function () use ($data, $petugas, $attachment, &$attachmentPath) {
                $pelanggaranId = DB::table('pelanggaran')->insertGetId($data);

                if ($attachment) {
                    $attachmentPath = $attachment->storeAs(
                        'pelanggaran_lampiran',
                        Str::uuid() . '.' . $attachment->getClientOriginalExtension(),
                        'local'
                    );

                    DB::table('lampiran_pelanggaran')->insert([
                        'pelanggaran_id' => $pelanggaranId,
                        'path_file' => $attachmentPath,
                        'diunggah_oleh' => $petugas->petugas_id,
                        'created_at' => now(),
                    ]);
                }

                Cache::forget("santri:{$data['santri_id']}:poin");

                $totalPoin = $this->getPoinSantri($data['santri_id']);
                $ambang = DB::table('pengaturan_sistem')->where('setting_key', 'ambang_notifikasi_poin')->value('setting_value') ?? 20;

                if ($totalPoin >= $ambang) {
                    $pengasuhIds = DB::table('petugas')->where('jabatan', 'Pengasuh')->where('status_aktif', 1)->pluck('petugas_id');
                    $notifications = [];
                    foreach ($pengasuhIds as $pId) {
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
            if ($attachmentPath) {
                Storage::disk('local')->delete($attachmentPath);
            }

            throw $exception;
        }

        event(new \App\Events\PelanggaranDicatat($pelanggaranId));

        return response()->json([
            'message' => 'Pelanggaran berhasil disimpan',
            'pelanggaran_id' => $pelanggaranId,
        ], 201);
    }

    public function uploadLampiran(Request $request, $id)
    {
        $pelanggaran = DB::table('pelanggaran')->where('pelanggaran_id', $id)->first();
        if (!$pelanggaran) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $model = new Pelanggaran((array) $pelanggaran);
        $model->exists = true;
        if (Gate::forUser($request->user())->denies('update', $model)) {
            return response()->json(['message' => 'Role kamu tidak memiliki akses ini.'], 403);
        }

        $request->validate([
            'file' => 'required|file|mimes:jpeg,png,jpg,webp,pdf|max:5120',
        ]);

        $file = $request->file('file');
        $fileName = Str::uuid() . '.' . $file->getClientOriginalExtension();
        
        // Simpan ke local disk. Abstraksi bisa diletakkan di Service nanti.
        $path = $file->storeAs('pelanggaran_lampiran', $fileName, 'local');

        DB::table('lampiran_pelanggaran')->insert([
            'pelanggaran_id' => $id,
            'path_file' => $path,
            'diunggah_oleh' => $request->user()->petugas_id,
            'created_at' => now()
        ]);

        return response()->json(['message' => 'Lampiran berhasil diunggah', 'path' => $path]);
    }

    public function getPoin(Request $request, $santriId)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Pengasuh', 'Keamanan', 'Pembina Kamar'], true)) {
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
}
