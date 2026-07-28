<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Carbon\Carbon;

Schedule::call(function () {
    $now = Carbon::now();
    $targetTime = $now->copy()->addMinutes(10)->format('H:i:00');
    
    // Cari jadwal yang mulai 10 menit dari sekarang
    $jadwals = DB::table('jadwal_kegiatan')
        ->join('jenis_kegiatan', 'jadwal_kegiatan.jenis_kegiatan_id', '=', 'jenis_kegiatan.jenis_kegiatan_id')
        ->where('jadwal_kegiatan.jam_mulai', $targetTime)
        ->where('jadwal_kegiatan.status_aktif', 1)
        ->select('jadwal_kegiatan.*', 'jenis_kegiatan.kode', 'jenis_kegiatan.nama as nama_kegiatan')
        ->get();

    foreach ($jadwals as $jadwal) {
        $tipeTarget = null;
        switch ($jadwal->kode) {
            case 'KAMAR': $tipeTarget = 'Kamar'; break;
            case 'SEKOLAH': $tipeTarget = 'KelasFormal'; break;
            case 'PBS': $tipeTarget = 'KelompokPBS'; break;
            case 'PBM': $tipeTarget = 'KelompokPBM'; break;
            case 'DINIYAH': $tipeTarget = 'KelompokMadin'; break;
        }

        if ($tipeTarget) {
            // Dapatkan semua petugas yang aktif untuk tipe target ini
            $petugasIds = DB::table('petugas_penugasan')
                ->where('tipe_target', $tipeTarget)
                ->where(function($q) use ($now) {
                    $q->whereNull('tanggal_selesai')
                      ->orWhere('tanggal_selesai', '>=', $now->toDateString());
                })
                ->pluck('petugas_id')
                ->unique();

            $notifications = [];
            foreach ($petugasIds as $petugasId) {
                $notifications[] = [
                    'petugas_id' => $petugasId,
                    'judul' => 'Reminder Absensi',
                    'pesan' => "Kegiatan {$jadwal->nama_jadwal} akan dimulai pada {$jadwal->jam_mulai}. Jangan lupa input absensi.",
                    'tipe' => 'reminder_absensi',
                    'referensi_tabel' => 'jadwal_kegiatan',
                    'referensi_id' => $jadwal->jadwal_id,
                    'created_at' => $now->toDateTimeString()
                ];
            }

            if (!empty($notifications)) {
                DB::table('notifikasi')->insert($notifications);
            }
        }
    }
})->everyMinute();

Schedule::call(function () {
    $now = Carbon::now();
    
    $overdueIzin = DB::table('perizinan')
        ->join('santri', 'perizinan.santri_id', '=', 'santri.santri_id')
        ->where('perizinan.status', 'Sedang Berjalan')
        ->where('perizinan.rencana_kembali', '<', $now->toDateTimeString())
        ->whereNull('perizinan.waktu_masuk_aktual')
        ->select('perizinan.*', 'santri.nama as nama_santri')
        ->get();

    if ($overdueIzin->isNotEmpty()) {
        $adminIds = DB::table('petugas')
            ->where('jabatan', 'Admin')
            ->where('status_aktif', 1)
            ->pluck('petugas_id');
            
        $notifications = [];
        foreach ($overdueIzin as $izin) {
            foreach ($adminIds as $adminId) {
                $notifications[] = [
                    'petugas_id' => $adminId,
                    'judul' => 'Perizinan Overdue',
                    'pesan' => "Santri {$izin->nama_santri} belum kembali dari perizinan (Batas: {$izin->rencana_kembali}).",
                    'tipe' => 'overdue_izin',
                    'referensi_tabel' => 'perizinan',
                    'referensi_id' => $izin->perizinan_id,
                    'created_at' => $now->toDateTimeString()
                ];
            }
        }
        
        if (!empty($notifications)) {
            DB::table('notifikasi')->insert($notifications);
        }
    }
})->daily();
