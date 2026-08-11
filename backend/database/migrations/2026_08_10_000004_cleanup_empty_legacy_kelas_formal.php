<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 74 kelas_formal dummy legacy yang 0 santri
        $emptyClassIds = DB::table('kelas_formal')
            ->whereNotIn('kelas_formal_id', function ($query) {
                $query->select('kelas_formal_id')
                    ->from('santri')
                    ->whereNotNull('kelas_formal_id');
            })
            ->pluck('kelas_formal_id');

        if ($emptyClassIds->isNotEmpty()) {
            DB::table('petugas_penugasan')
                ->where('tipe_target', 'KelasFormal')
                ->whereIn('target_id', $emptyClassIds)
                ->delete();

            DB::table('kelas_formal')
                ->whereIn('kelas_formal_id', $emptyClassIds)
                ->delete();
        }
    }

    public function down(): void
    {
        // No-op for cleanup migration
    }
};
