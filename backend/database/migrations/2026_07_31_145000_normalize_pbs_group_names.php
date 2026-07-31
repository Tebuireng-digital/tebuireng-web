<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $totalRows = DB::table('kelompok_pbs')
                ->whereRaw('UPPER(TRIM(nama_kelompok)) = ?', ['TOTAL'])
                ->get();

            foreach ($totalRows as $total) {
                $hasMembers = DB::table('santri')
                    ->where('kelompok_pbs_id', $total->kelompok_pbs_id)
                    ->exists();
                $hasAssignments = DB::table('petugas_penugasan')
                    ->where('tipe_target', 'KelompokPBS')
                    ->where('target_id', $total->kelompok_pbs_id)
                    ->exists();

                if ($hasMembers || $hasAssignments) {
                    throw new RuntimeException("Kelompok TOTAL ID {$total->kelompok_pbs_id} masih dirujuk dan tidak aman dihapus.");
                }

                DB::table('kelompok_pbs')->where('kelompok_pbs_id', $total->kelompok_pbs_id)->delete();
            }

            $groups = DB::table('kelompok_pbs')
                ->whereIn('kategori', ['KELOMPOK A', 'KELOMPOK B', 'KELOMPOK C'])
                ->get();

            foreach ($groups as $group) {
                if (!preg_match('/^(?:KEL\.?\s*)?([ABC])\s*(\d+)$/iu', trim($group->nama_kelompok), $matches)) {
                    continue;
                }

                $canonicalName = strtoupper($matches[1]).' '.(int) $matches[2];
                if ($canonicalName === $group->nama_kelompok) {
                    continue;
                }

                $collision = DB::table('kelompok_pbs')
                    ->where('kategori', $group->kategori)
                    ->where('nama_kelompok', $canonicalName)
                    ->where('tahun_ajaran', $group->tahun_ajaran)
                    ->where('kelompok_pbs_id', '!=', $group->kelompok_pbs_id)
                    ->exists();
                if ($collision) {
                    throw new RuntimeException("Normalisasi {$group->nama_kelompok} menjadi {$canonicalName} menghasilkan duplikasi.");
                }

                DB::table('kelompok_pbs')->where('kelompok_pbs_id', $group->kelompok_pbs_id)->update([
                    'nama_kelompok' => $canonicalName,
                    'updated_at' => now(),
                ]);
            }
        });
    }

    public function down(): void
    {
        // Data rekap TOTAL dan format nama yang inkonsisten sengaja tidak dipulihkan.
    }
};
