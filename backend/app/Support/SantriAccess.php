<?php

namespace App\Support;

use App\Models\Petugas;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class SantriAccess
{
    private const TARGET_COLUMNS = [
        'Kamar' => 'kamar_id',
        'KelasFormal' => 'kelas_formal_id',
        'KelompokMadin' => 'kelompok_madin_id',
        'KelompokPBS' => 'kelompok_pbs_id',
        'KelompokPBM' => 'kelompok_pbm_id',
    ];

    public static function scopeAssigned(Builder $query, Petugas $petugas, string $table = 'santri'): Builder
    {
        $today = now()->toDateString();

        return $query->where(function (Builder $access) use ($petugas, $table, $today) {
            $access->whereExists(function (Builder $assignment) use ($petugas, $table, $today) {
                $assignment->selectRaw('1')
                    ->from('petugas_penugasan')
                    ->where('petugas_penugasan.petugas_id', $petugas->petugas_id)
                    ->where('petugas_penugasan.tanggal_mulai', '<=', $today)
                    ->where(function (Builder $active) use ($today) {
                        $active->whereNull('petugas_penugasan.tanggal_selesai')
                            ->orWhere('petugas_penugasan.tanggal_selesai', '>=', $today);
                    })
                    ->where(function (Builder $targets) use ($table) {
                        foreach (self::TARGET_COLUMNS as $type => $column) {
                            $targets->orWhere(function (Builder $target) use ($type, $column, $table) {
                                $target->where('petugas_penugasan.tipe_target', $type)
                                    ->whereColumn('petugas_penugasan.target_id', $table.'.'.$column);
                            });
                        }
                    });
            });
        });
    }

    public static function canAccess(Petugas $petugas, int $santriId): bool
    {
        if ($petugas->jabatan === 'Admin') {
            return true;
        }

        return self::scopeAssigned(
            DB::table('santri')->where('santri.santri_id', $santriId),
            $petugas
        )->exists();
    }
}
