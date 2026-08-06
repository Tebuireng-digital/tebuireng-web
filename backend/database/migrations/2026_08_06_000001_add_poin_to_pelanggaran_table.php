<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pelanggaran', function (Blueprint $table) {
            // Nullable saat penambahan agar aman untuk database yang sudah berisi data.
            $table->unsignedSmallInteger('poin')->nullable()->after('kategori_pelanggaran_id');
        });

        DB::table('pelanggaran')
            ->join('kategori_pelanggaran', 'kategori_pelanggaran.kategori_pelanggaran_id', '=', 'pelanggaran.kategori_pelanggaran_id')
            ->select('pelanggaran.pelanggaran_id', 'kategori_pelanggaran.poin_maks')
            ->orderBy('pelanggaran.pelanggaran_id')
            ->get()
            ->each(function ($row) {
                DB::table('pelanggaran')
                    ->where('pelanggaran_id', $row->pelanggaran_id)
                    ->update(['poin' => $row->poin_maks]);
            });

    }

    public function down(): void
    {
        Schema::table('pelanggaran', function (Blueprint $table) {
            $table->dropColumn('poin');
        });
    }
};
