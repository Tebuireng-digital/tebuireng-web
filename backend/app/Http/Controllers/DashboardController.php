<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $petugas = $request->user();
        $summary = ['role' => $petugas->jabatan];

        if (in_array($petugas->jabatan, ['Admin', 'Keamanan'], true)) {
            $summary['perizinan'] = [
                'aktif' => DB::table('perizinan')->whereIn('status', ['Disetujui', 'Sedang Berjalan'])->count(),
                'berjalan' => DB::table('perizinan')->where('status', 'Sedang Berjalan')->count(),
                'overdue' => DB::table('perizinan')->where('status', 'Sedang Berjalan')->where('rencana_kembali', '<', now())->count(),
            ];
            $summary['notifikasi_belum_dibaca'] = DB::table('notifikasi')->where('petugas_id', $petugas->petugas_id)->where('dibaca', 0)->count();
        }

        if ($petugas->jabatan === 'Pembina Kamar') {
            $roomIds = DB::table('petugas_penugasan')->where('petugas_id', $petugas->petugas_id)->where('tipe_target', 'Kamar')->where('tanggal_mulai', '<=', now()->toDateString())->where(function ($query) { $query->whereNull('tanggal_selesai')->orWhere('tanggal_selesai', '>=', now()->toDateString()); })->pluck('target_id');
            $summary['kamar'] = ['jumlah' => $roomIds->count(), 'headcount' => DB::table('santri')->whereIn('kamar_id', $roomIds)->where('status_aktif', 1)->count()];
            $summary['pelanggaran_terbaru'] = DB::table('pelanggaran')->join('santri', 'santri.santri_id', '=', 'pelanggaran.santri_id')->whereIn('santri.kamar_id', $roomIds)->orderByDesc('pelanggaran.created_at')->limit(5)->get(['pelanggaran.pelanggaran_id', 'santri.nama', 'pelanggaran.tanggal', 'pelanggaran.poin']);
        }

        return response()->json($summary);
    }
}
