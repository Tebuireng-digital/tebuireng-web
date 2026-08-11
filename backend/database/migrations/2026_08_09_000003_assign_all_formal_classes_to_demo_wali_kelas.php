<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $waliKelasId = DB::table('petugas')
            ->where('username', 'walikelas')
            ->orWhere('nama', 'User Wali Kelas')
            ->value('petugas_id');

        if (!$waliKelasId) {
            $waliKelasId = DB::table('petugas')
                ->where('jabatan', 'Wali Kelas')
                ->value('petugas_id');
        }

        if (!$waliKelasId) {
            return;
        }

        $today = now()->toDateString();
        $classIds = DB::table('kelas_formal')->pluck('kelas_formal_id');

        foreach ($classIds as $classId) {
            $exists = DB::table('petugas_penugasan')
                ->where('petugas_id', $waliKelasId)
                ->where('tipe_target', 'KelasFormal')
                ->where('target_id', $classId)
                ->exists();

            if (!$exists) {
                DB::table('petugas_penugasan')->insert([
                    'petugas_id' => $waliKelasId,
                    'tipe_target' => 'KelasFormal',
                    'target_id' => $classId,
                    'tanggal_mulai' => $today,
                    'tanggal_selesai' => null,
                    'sumber' => 'Demo All Classes',
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('petugas_penugasan')
            ->where('sumber', 'Demo All Classes')
            ->delete();
    }
};
