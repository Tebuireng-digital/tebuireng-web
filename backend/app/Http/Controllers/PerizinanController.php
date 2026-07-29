<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use App\Models\Perizinan;
use App\Events\PerizinanDisetujui;

class PerizinanController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('perizinan')
            ->join('santri', 'perizinan.santri_id', '=', 'santri.santri_id')
            ->select('perizinan.*', 'santri.nama as nama_santri', 'santri.nis');

        if ($request->has('status')) {
            $statuses = explode(',', $request->status);
            $query->whereIn('perizinan.status', $statuses);
        }

        $query->orderBy('perizinan.created_at', 'desc');

        // Untuk persetujuan-izin, kita juga perlu gabungkan dengan perizinan_approval jika diminta filter tahap
        if ($request->has('menunggu_tahap_jabatan')) {
            $jabatan = $request->menunggu_tahap_jabatan;
            $query->join('perizinan_approval', 'perizinan.perizinan_id', '=', 'perizinan_approval.perizinan_id')
                  ->where('perizinan_approval.jabatan_approver', $jabatan)
                  ->where('perizinan_approval.keputusan', 'Menunggu')
                  // Pastikan tahap sebelumnya sudah disetujui (atau ini tahap 1)
                  ->whereRaw("
                      (perizinan_approval.tahap = 1 OR EXISTS (
                          SELECT 1 FROM perizinan_approval pa2 
                          WHERE pa2.perizinan_id = perizinan.perizinan_id 
                          AND pa2.tahap = perizinan_approval.tahap - 1 
                          AND pa2.keputusan = 'Disetujui'
                      ))
                  ");
            $query->addSelect('perizinan_approval.tahap as tahap_menunggu');
        }

        return response()->json($query->get());
    }
    public function getSantriPerizinan($santriId)
    {
        $perizinan = DB::table('v_progres_approval_izin')
            ->where('santri_id', $santriId)
            ->get();
            
        // Group by perizinan_id for structured response
        $grouped = [];
        foreach ($perizinan as $p) {
            if (!isset($grouped[$p->perizinan_id])) {
                $grouped[$p->perizinan_id] = [
                    'perizinan_id' => $p->perizinan_id,
                    'status' => $p->status,
                    'tanggal_mulai' => $p->tanggal_mulai,
                    'rencana_kembali' => $p->rencana_kembali,
                    'approval' => []
                ];
            }
            $grouped[$p->perizinan_id]['approval'][] = [
                'tahap' => $p->tahap,
                'jabatan_approver' => $p->jabatan_approver,
                'keputusan' => $p->keputusan,
                'waktu_keputusan' => $p->waktu_keputusan
            ];
        }

        return response()->json(array_values($grouped));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'santri_id' => 'required|integer|exists:santri,santri_id',
            'jenis_izin_id' => 'required|integer',
            'keperluan' => 'required|string|max:255',
            'tanggal_mulai' => 'required|date',
            'rencana_kembali' => 'required|date|after_or_equal:tanggal_mulai',
        ]);

        $petugas = Auth::user();
        
        $model = new Perizinan();
        $model->santri_id = $data['santri_id'];
        if (Gate::forUser($petugas)->denies('create', $model)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $jenisIzin = DB::table('jenis_izin')->where('jenis_izin_id', $data['jenis_izin_id'])->first();
        if (!$jenisIzin) {
            return response()->json(['message' => 'Jenis izin tidak ditemukan'], 404);
        }

        DB::transaction(function () use ($data, $petugas) {
            $data['status'] = 'Disetujui';
            $data['diajukan_oleh'] = $petugas->petugas_id;
            $data['created_at'] = now();
            $data['updated_at'] = now();

            $perizinanId = DB::table('perizinan')->insertGetId($data);
            
            // Note: Sistem approval berjenjang telah ditiadakan sesuai instruksi terbaru.
            // Perizinan yang diajukan oleh Admin/Keamanan langsung berstatus 'Disetujui'.
        });

        return response()->json(['message' => 'Perizinan berhasil ditambahkan'], 201);
    }

    public function approve(Request $request, $id, $tahap)
    {
        $data = $request->validate([
            'keputusan' => 'required|in:Disetujui,Ditolak',
            'catatan' => 'nullable|string|max:255'
        ]);

        $perizinan = DB::table('perizinan')->where('perizinan_id', $id)->first();
        if (!$perizinan || $perizinan->status === 'Ditolak' || $perizinan->status === 'Dibatalkan') {
            return response()->json(['message' => 'Perizinan tidak valid atau sudah dibatalkan/ditolak'], 400);
        }

        $currentApproval = DB::table('perizinan_approval')
            ->where('perizinan_id', $id)
            ->where('tahap', $tahap)
            ->first();

        if (!$currentApproval) {
            return response()->json(['message' => 'Tahap approval tidak ditemukan'], 404);
        }

        $petugas = Auth::user();
        
        // Cek apakah petugas memegang jabatan yang sesuai (atau Admin)
        if ($petugas->jabatan !== 'Admin' && $petugas->jabatan !== $currentApproval->jabatan_approver) {
            return response()->json(['message' => 'Anda tidak berwenang pada tahap ini'], 403);
        }

        // Validasi tahap sebelumnya (kecuali tahap 1)
        if ((int)$tahap > 1) {
            $prevApproval = DB::table('perizinan_approval')
                ->where('perizinan_id', $id)
                ->where('tahap', $tahap - 1)
                ->first();

            if ($prevApproval && $prevApproval->keputusan !== 'Disetujui') {
                return response()->json(['message' => 'Tahap sebelumnya belum disetujui'], 400);
            }
        }

        DB::transaction(function () use ($id, $tahap, $data, $petugas) {
            DB::table('perizinan_approval')
                ->where('perizinan_id', $id)
                ->where('tahap', $tahap)
                ->update([
                    'keputusan' => $data['keputusan'],
                    'catatan' => $data['catatan'] ?? null,
                    'petugas_id' => $petugas->petugas_id,
                    'waktu_keputusan' => now()
                ]);

            if ($data['keputusan'] === 'Ditolak') {
                // Set perizinan ditolak
                DB::table('perizinan')->where('perizinan_id', $id)->update(['status' => 'Ditolak']);
                
                // Set tahap sesudahnya jadi Gugur
                DB::table('perizinan_approval')
                    ->where('perizinan_id', $id)
                    ->where('tahap', '>', $tahap)
                    ->where('keputusan', 'Menunggu')
                    ->update(['keputusan' => 'Gugur']);
            } else {
                // Cek jika ini tahap terakhir
                $maxTahap = DB::table('perizinan_approval')->where('perizinan_id', $id)->max('tahap');
                if ((int)$tahap === (int)$maxTahap) {
                    DB::table('perizinan')->where('perizinan_id', $id)->update(['status' => 'Disetujui']);
                    event(new PerizinanDisetujui($id));
                }
            }
        });

        return response()->json(['message' => 'Approval berhasil diproses']);
    }

    public function gerbang(Request $request, $id)
    {
        $data = $request->validate([
            'waktu_keluar_aktual' => 'nullable|date',
            'waktu_masuk_aktual' => 'nullable|date',
        ]);

        $petugas = Auth::user();
        if ($petugas->jabatan !== 'Keamanan' && $petugas->jabatan !== 'Admin') {
            return response()->json(['message' => 'Hanya Keamanan yang dapat mengisi data gerbang'], 403);
        }

        $perizinan = DB::table('perizinan')->where('perizinan_id', $id)->first();
        if (!$perizinan || !in_array($perizinan->status, ['Disetujui', 'Sedang Berjalan'])) {
            return response()->json(['message' => 'Perizinan belum disetujui atau sudah selesai'], 400);
        }

        $update = [];
        if (isset($data['waktu_keluar_aktual']) && !$perizinan->waktu_keluar_aktual) {
            $update['waktu_keluar_aktual'] = \Carbon\Carbon::parse($data['waktu_keluar_aktual'])->toDateTimeString();
            $update['status'] = 'Sedang Berjalan';
            $update['dicatat_keamanan_oleh'] = $petugas->petugas_id;
        }

        if (isset($data['waktu_masuk_aktual']) && !$perizinan->waktu_masuk_aktual) {
            $update['waktu_masuk_aktual'] = \Carbon\Carbon::parse($data['waktu_masuk_aktual'])->toDateTimeString();
            $update['status'] = 'Selesai';
            // Cek keterlambatan, tapi prd blm detil, cukup status = Selesai
            if (!$perizinan->dicatat_keamanan_oleh) {
                $update['dicatat_keamanan_oleh'] = $petugas->petugas_id;
            }
        }

        if (!empty($update)) {
            DB::table('perizinan')->where('perizinan_id', $id)->update($update);
            return response()->json(['message' => 'Data gerbang berhasil disimpan']);
        }

        return response()->json(['message' => 'Tidak ada perubahan data gerbang'], 400);
    }
}
