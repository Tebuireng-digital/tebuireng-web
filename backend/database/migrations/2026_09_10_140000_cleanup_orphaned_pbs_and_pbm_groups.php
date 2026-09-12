<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            // 1. Ambil ID kelompok PBS sisa lama yang tidak memiliki santri dan raport
            $orphanedPbsIds = DB::table('kelompok_pbs as kp')
                ->leftJoin('santri as s', 'kp.kelompok_pbs_id', '=', 's.kelompok_pbs_id')
                ->leftJoin('raport_pengajian as r', 'kp.kelompok_pbs_id', '=', 'r.kelompok_pbs_id')
                ->whereNull('s.santri_id')
                ->whereNull('r.raport_id')
                ->where('kp.created_at', '<', '2026-09-07')
                ->pluck('kp.kelompok_pbs_id');

            if ($orphanedPbsIds->isNotEmpty()) {
                DB::table('petugas_penugasan')
                    ->where('tipe_target', 'KelompokPBS')
                    ->whereIn('target_id', $orphanedPbsIds)
                    ->delete();

                DB::table('kelompok_pbs')
                    ->whereIn('kelompok_pbs_id', $orphanedPbsIds)
                    ->delete();
            }

            // 2. Ambil ID kelompok PBM sisa lama yang tidak memiliki santri dan raport
            $orphanedPbmIds = DB::table('kelompok_pbm as kp')
                ->leftJoin('santri as s', 'kp.kelompok_pbm_id', '=', 's.kelompok_pbm_id')
                ->leftJoin('raport_pengajian as r', 'kp.kelompok_pbm_id', '=', 'r.kelompok_pbm_id')
                ->whereNull('s.santri_id')
                ->whereNull('r.raport_id')
                ->where('kp.created_at', '<', '2026-09-07')
                ->pluck('kp.kelompok_pbm_id');

            if ($orphanedPbmIds->isNotEmpty()) {
                DB::table('petugas_penugasan')
                    ->where('tipe_target', 'KelompokPBM')
                    ->whereIn('target_id', $orphanedPbmIds)
                    ->delete();

                DB::table('kelompok_pbm')
                    ->whereIn('kelompok_pbm_id', $orphanedPbmIds)
                    ->delete();
            }

            // 3. Sinkronkan penugasan petugas "piketpengajian" (dan seluruh petugas Piket Pengajian) ke kelompok aktif
            $piketUsers = DB::table('petugas')
                ->where('jabatan', 'Piket Pengajian')
                ->orWhere('username', 'piketpengajian')
                ->get();

            $activePbsIds = DB::table('kelompok_pbs')->pluck('kelompok_pbs_id');
            $activePbmIds = DB::table('kelompok_pbm')->pluck('kelompok_pbm_id');
            $today = now()->toDateString();

            foreach ($piketUsers as $petugas) {
                foreach ($activePbsIds as $pbsId) {
                    $exists = DB::table('petugas_penugasan')
                        ->where('petugas_id', $petugas->petugas_id)
                        ->where('tipe_target', 'KelompokPBS')
                        ->where('target_id', $pbsId)
                        ->whereNull('tanggal_selesai')
                        ->exists();

                    if (!$exists) {
                        DB::table('petugas_penugasan')->insert([
                            'petugas_id' => $petugas->petugas_id,
                            'tipe_target' => 'KelompokPBS',
                            'target_id' => $pbsId,
                            'tanggal_mulai' => $today,
                        ]);
                    }
                }

                foreach ($activePbmIds as $pbmId) {
                    $exists = DB::table('petugas_penugasan')
                        ->where('petugas_id', $petugas->petugas_id)
                        ->where('tipe_target', 'KelompokPBM')
                        ->where('target_id', $pbmId)
                        ->whereNull('tanggal_selesai')
                        ->exists();

                    if (!$exists) {
                        DB::table('petugas_penugasan')->insert([
                            'petugas_id' => $petugas->petugas_id,
                            'tipe_target' => 'KelompokPBM',
                            'target_id' => $pbmId,
                            'tanggal_mulai' => $today,
                        ]);
                    }
                }
            }
        });
    }

    public function down(): void
    {
        // Data cleanup sengaja tidak di-revert karena kelompok lama bersifat dummy/orphan
    }
};
