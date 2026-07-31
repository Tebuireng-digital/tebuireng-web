<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $configs = [
                ['table' => 'kelompok_madin', 'pk' => 'kelompok_madin_id', 'column' => 'kelompok_madin_id', 'type' => 'KelompokMadin'],
                ['table' => 'kelompok_pbm', 'pk' => 'kelompok_pbm_id', 'column' => 'kelompok_pbm_id', 'type' => 'KelompokPBM'],
            ];

            foreach ($configs as $config) {
                $rows = DB::table($config['table'])
                    ->whereRaw('UPPER(TRIM('.$config['table'].'.'.($config['table'] === 'kelompok_madin' ? 'nama_kelas_madin' : 'nama_kelompok').')) = ?', ['TOTAL'])
                    ->get();

                foreach ($rows as $row) {
                    $id = $row->{$config['pk']};
                    $hasMembers = DB::table('santri')->where($config['column'], $id)->exists();
                    $hasAssignments = DB::table('petugas_penugasan')
                        ->where('tipe_target', $config['type'])
                        ->where('target_id', $id)
                        ->exists();
                    if ($hasMembers || $hasAssignments) {
                        throw new RuntimeException("Roster TOTAL {$config['type']} ID {$id} masih dirujuk.");
                    }
                    DB::table($config['table'])->where($config['pk'], $id)->delete();
                }
            }
        });
    }

    public function down(): void
    {
        // Baris rekap TOTAL bukan roster dan sengaja tidak dipulihkan.
    }
};
