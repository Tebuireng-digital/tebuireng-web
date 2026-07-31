<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use App\Models\Pelanggaran;
use Illuminate\Support\Str;

class PelanggaranController extends Controller
{
    public function getKategori()
    {
        $kategori = DB::table('kategori_pelanggaran')
            ->where('status_aktif', 'Aktif')
            ->orderBy('poin_maks', 'asc')
            ->get();
        return response()->json($kategori);
    }

    public function index(Request $request)
    {
        $query = DB::table('pelanggaran')
            ->join('kategori_pelanggaran', 'pelanggaran.kategori_pelanggaran_id', '=', 'kategori_pelanggaran.kategori_pelanggaran_id')
            ->select('pelanggaran.*', 'kategori_pelanggaran.uraian_pelanggaran', 'kategori_pelanggaran.kategori', 'kategori_pelanggaran.poin_maks');

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
            $query->join('santri', 'pelanggaran.santri_id', '=', 'santri.santri_id');
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
            'tanggal' => 'required|date',
            'keterangan' => 'nullable|string',
        ]);

        $petugas = Auth::user();

        // Gate validation
        $model = new Pelanggaran();
        $model->santri_id = $data['santri_id'];
        if (Gate::forUser($petugas)->denies('create', $model)) {
            return response()->json(['message' => 'Role kamu tidak memiliki akses ini.'], 403);
        }

        // Validate kategori
        $kategori = DB::table('kategori_pelanggaran')
            ->where('kategori_pelanggaran_id', $data['kategori_pelanggaran_id'])
            ->where('status_aktif', 'Aktif')
            ->first();

        if (!$kategori) {
            return response()->json(['message' => 'Kategori pelanggaran tidak valid atau tidak aktif'], 400);
        }

        // Validasi Role
        if ($petugas->jabatan === 'Pembina Kamar' && strtolower(trim($kategori->kategori)) !== 'ringan') {
            return response()->json(['message' => 'Pembina Kamar hanya dapat menginput pelanggaran Ringan'], 403);
        }
        if ($petugas->jabatan === 'Keamanan' && !in_array(strtolower(trim($kategori->kategori)), ['sedang', 'berat'])) {
            return response()->json(['message' => 'Keamanan hanya dapat menginput pelanggaran Sedang dan Berat'], 403);
        }

        $data['petugas_pencatat_id'] = $petugas->petugas_id;
        $data['created_at'] = now()->toDateTimeString();
        $data['updated_at'] = now()->toDateTimeString();

        $pelanggaranId = DB::transaction(function () use ($data, $petugas) {
            $pelanggaranId = DB::table('pelanggaran')->insertGetId($data);

            // Invalidate cache
            Cache::forget("santri:{$data['santri_id']}:poin");

            // Check total points
            $totalPoin = $this->getPoinSantri($data['santri_id']);
            $ambang = DB::table('pengaturan_sistem')->where('setting_key', 'ambang_notifikasi_poin')->value('setting_value') ?? 20;

            if ($totalPoin >= $ambang) {
                // Send notification to Pengasuh
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
            'file' => 'required|file|mimes:jpeg,png,jpg,pdf|max:5120',
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

    public function getPoin($santriId)
    {
        $poin = $this->getPoinSantri($santriId);
        return response()->json(['santri_id' => $santriId, 'total_poin' => $poin]);
    }

    private function getPoinSantri($santriId)
    {
        return Cache::rememberForever("santri:{$santriId}:poin", function () use ($santriId) {
            $viewData = DB::table('v_akumulasi_poin_pelanggaran')
                ->where('santri_id', $santriId)
                ->first();
                
            return $viewData ? (int) $viewData->total_poin : 0;
        });
    }
}
