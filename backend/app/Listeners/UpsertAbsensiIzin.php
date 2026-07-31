<?php

namespace App\Listeners;

use App\Events\PerizinanDisetujui;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class UpsertAbsensiIzin
{
    public function handle(PerizinanDisetujui $event): void
    {
        $perizinan = DB::table('perizinan')->where('perizinan_id', $event->perizinanId)->first();
        if (!$perizinan || !in_array($perizinan->status, ['Disetujui', 'Sedang Berjalan'])) {
            return;
        }

        $startDate = Carbon::parse($perizinan->tanggal_mulai);
        $endDate = Carbon::parse($perizinan->rencana_kembali);

        $jadwals = DB::table('jadwal_kegiatan')
            ->where('status_aktif', 1)
            ->get();

        $upsertData = [];
        $now = now()->toDateTimeString();

        for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
            foreach ($jadwals as $jadwal) {
                $existing = DB::table('absensi')
                    ->where('santri_id', $perizinan->santri_id)
                    ->where('jenis_kegiatan_id', $jadwal->jenis_kegiatan_id)
                    ->where('jadwal_id', $jadwal->jadwal_id)
                    ->where('tanggal', $date->toDateString())
                    ->first();

                $upsertData[] = [
                    'santri_id' => $perizinan->santri_id,
                    'jenis_kegiatan_id' => $jadwal->jenis_kegiatan_id,
                    'jadwal_id' => $jadwal->jadwal_id,
                    'tanggal' => $date->toDateString(),
                    'status' => 'Izin',
                    'menit_terlambat' => null,
                    'keterangan' => 'Sistem: Otomatis dari Perizinan ID ' . $perizinan->perizinan_id,
                    'waktu_input' => $existing ? $existing->waktu_input : $now,
                    'diinput_oleh' => $existing ? $existing->diinput_oleh : $perizinan->diajukan_oleh,
                    'diubah_oleh' => $existing ? $perizinan->diajukan_oleh : null,
                    'updated_at' => $now
                ];
            }
        }

        if (!empty($upsertData)) {
            // Because there can be many, we chunk them
            $chunks = array_chunk($upsertData, 500);
            foreach ($chunks as $chunk) {
                DB::table('absensi')->upsert($chunk, ['santri_id', 'jenis_kegiatan_id', 'jadwal_id', 'tanggal'], [
                    'status', 'keterangan', 'diubah_oleh', 'updated_at'
                ]);
            }
        }
    }
}
