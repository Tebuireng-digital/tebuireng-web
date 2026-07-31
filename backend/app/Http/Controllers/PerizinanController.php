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

        return response()->json($query->get());
    }

    public function jenis()
    {
        return response()->json(DB::table('jenis_izin')->orderBy('nama')->get());
    }

    public function getSantriPerizinan(Request $request, $santriId)
    {
        if (!in_array($request->user()->jabatan, ['Admin', 'Pengasuh', 'Keamanan'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json(DB::table('perizinan')
            ->join('jenis_izin', 'perizinan.jenis_izin_id', '=', 'jenis_izin.jenis_izin_id')
            ->where('perizinan.santri_id', $santriId)
            ->orderByDesc('perizinan.created_at')
            ->select('perizinan.*', 'jenis_izin.nama as jenis_izin')
            ->get());
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

        $bentrok = DB::table('perizinan')
            ->where('santri_id', $data['santri_id'])
            ->whereIn('status', ['Disetujui', 'Sedang Berjalan'])
            ->where('tanggal_mulai', '<=', $data['rencana_kembali'])
            ->where('rencana_kembali', '>=', $data['tanggal_mulai'])
            ->exists();
        if ($bentrok) {
            return response()->json(['message' => 'Santri masih memiliki izin aktif pada rentang tersebut'], 422);
        }

        $perizinanId = DB::transaction(function () use ($data, $petugas) {
            $data['status'] = 'Disetujui';
            $data['diajukan_oleh'] = $petugas->petugas_id;
            $data['created_at'] = now();
            $data['updated_at'] = now();

            return DB::table('perizinan')->insertGetId($data);
        });

        event(new PerizinanDisetujui($perizinanId));

        return response()->json([
            'message' => 'Perizinan disetujui dan absensi izin telah dibuat',
            'perizinan_id' => $perizinanId,
        ], 201);
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
