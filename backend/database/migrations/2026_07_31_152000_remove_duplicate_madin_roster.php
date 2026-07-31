<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('kelompok_madin')
            ->whereRaw('UPPER(TRIM(jenjang)) = ?', ['SMA'])
            ->whereRaw('UPPER(TRIM(nama_kelas_madin)) = ?', ['2 ULYA'])
            ->get();

        foreach ($rows as $row) {
            $hasMembers = DB::table('santri')->where('kelompok_madin_id', $row->kelompok_madin_id)->exists();
            $hasAssignments = DB::table('petugas_penugasan')
                ->where('tipe_target', 'KelompokMadin')
                ->where('target_id', $row->kelompok_madin_id)
                ->exists();
            if ($hasMembers || $hasAssignments) {
                throw new RuntimeException("Roster duplikat 2 ULYA ID {$row->kelompok_madin_id} masih dirujuk.");
            }
            DB::table('kelompok_madin')->where('kelompok_madin_id', $row->kelompok_madin_id)->delete();
        }
    }

    public function down(): void
    {
        // Roster duplikat sumber sengaja tidak dipulihkan.
    }
};
