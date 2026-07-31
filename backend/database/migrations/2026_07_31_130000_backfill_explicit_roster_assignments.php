<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('petugas_penugasan', 'sumber')) {
            Schema::table('petugas_penugasan', function (Blueprint $table) {
                $table->string('sumber', 30)->nullable()->after('target_id');
            });
        }

        $today = now()->toDateString();

        $rooms = DB::table('kamar')
            ->join('petugas', 'kamar.pembina_id', '=', 'petugas.petugas_id')
            ->whereNotNull('kamar.pembina_id')
            ->where('petugas.jabatan', 'Pembina Kamar')
            ->where('petugas.status_aktif', 1)
            ->get(['kamar.kamar_id as target_id', 'petugas.petugas_id']);

        foreach ($rooms as $room) {
            $this->insertAssignmentIfMissing(
                $room->petugas_id,
                'Kamar',
                $room->target_id,
                $today
            );
        }

        $classes = DB::table('kelas_formal')
            ->join('petugas', 'kelas_formal.wali_kelas_id', '=', 'petugas.petugas_id')
            ->join('unit_pendidikan', 'kelas_formal.unit_id', '=', 'unit_pendidikan.unit_id')
            ->whereNotNull('kelas_formal.wali_kelas_id')
            ->where('petugas.jabatan', 'Wali Kelas')
            ->where('petugas.status_aktif', 1)
            ->where('unit_pendidikan.kode', 'SMP')
            ->whereIn('kelas_formal.tingkat', ['7', '8', '9'])
            ->get(['kelas_formal.kelas_formal_id as target_id', 'petugas.petugas_id']);

        foreach ($classes as $class) {
            $this->insertAssignmentIfMissing(
                $class->petugas_id,
                'KelasFormal',
                $class->target_id,
                $today
            );
        }
    }

    private function insertAssignmentIfMissing(int $petugasId, string $type, int $targetId, string $today): void
    {
        $exists = DB::table('petugas_penugasan')
            ->where('petugas_id', $petugasId)
            ->where('tipe_target', $type)
            ->where('target_id', $targetId)
            ->exists();

        if (!$exists) {
            DB::table('petugas_penugasan')->insert([
                'petugas_id' => $petugasId,
                'tipe_target' => $type,
                'target_id' => $targetId,
                'sumber' => 'metadata_backfill',
                'tanggal_mulai' => $today,
                'created_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('petugas_penugasan')->where('sumber', 'metadata_backfill')->delete();

        Schema::table('petugas_penugasan', function (Blueprint $table) {
            $table->dropColumn('sumber');
        });
    }
};
