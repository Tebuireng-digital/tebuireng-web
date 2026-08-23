<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('unit_pendidikan')
            ->whereIn('kode', ['MA', 'MAS', 'MTS', 'MTSS', 'MU', 'SMA', 'SMAT', 'SMK', 'SMP', 'SMPT', 'THS'])
            ->update(['nama' => DB::raw('kode'), 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Nama unit sebelumnya tidak dipulihkan karena sumber resmi adalah kolom Pend Excel.
    }
};
