<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            // 1. Normalisasi kategori pada kelompok_pbs
            $pbsRows = DB::table('kelompok_pbs')->get();
            foreach ($pbsRows as $row) {
                if ($row->kategori === 'MASTER_PUTRA' || empty($row->kategori)) {
                    $category = 'LAINNYA';
                    if (preg_match('/^(KELOMPOK [A-Z]|BANDONGAN|TAHSIN|TAHFIDZ|SOROGAN|PASCA WISUDA(?: MA)?)/i', $row->nama_kelompok, $matches)) {
                        $category = strtoupper(trim($matches[1]));
                    }
                    DB::table('kelompok_pbs')
                        ->where('kelompok_pbs_id', $row->kelompok_pbs_id)
                        ->update(['kategori' => $category, 'updated_at' => now()]);
                }
            }

            // 2. Normalisasi kategori pada kelompok_pbm
            $pbmRows = DB::table('kelompok_pbm')->get();
            foreach ($pbmRows as $row) {
                if ($row->kategori === 'MASTER_PUTRA' || empty($row->kategori)) {
                    $category = 'LAINNYA';
                    if (preg_match('/^([^-]+)\s*-\s*/', $row->nama_kelompok, $matches)) {
                        $category = strtoupper(trim($matches[1]));
                    }
                    DB::table('kelompok_pbm')
                        ->where('kelompok_pbm_id', $row->kelompok_pbm_id)
                        ->update(['kategori' => $category, 'updated_at' => now()]);
                }
            }
        });
    }

    public function down(): void
    {
        // No-op rollback
    }
};
