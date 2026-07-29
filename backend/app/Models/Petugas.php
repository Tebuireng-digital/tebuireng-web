<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Petugas extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'petugas';
    protected $primaryKey = 'petugas_id';
    
    // We do not use standard 'password' column name, we use 'password_hash'
    // But Laravel Auth needs to know this:
    public function getAuthPasswordName()
    {
        return 'password_hash';
    }

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    protected $fillable = [
        'nama',
        'username',
        'password_hash',
        'jabatan',
        'status_aktif'
    ];

    protected $hidden = [
        'password_hash',
    ];

    public function hasAccess($tipeTarget, $targetId)
    {
        if ($this->jabatan === 'Admin') {
            return true;
        }

        // Cek tabel petugas_penugasan
        $hasPenugasan = \Illuminate\Support\Facades\DB::table('petugas_penugasan')
            ->where('petugas_id', $this->petugas_id)
            ->where('tipe_target', $tipeTarget)
            ->where('target_id', $targetId)
            ->where(function($q) {
                $q->whereNull('tanggal_selesai')
                  ->orWhere('tanggal_selesai', '>=', now()->toDateString());
            })
            ->exists();

        if ($hasPenugasan) return true;

        // Fallback untuk Kamar dan Kelas karena di-import di tabel utamanya
        if ($tipeTarget === 'Kamar') {
            return \Illuminate\Support\Facades\DB::table('kamar')
                ->where('kamar_id', $targetId)
                ->where('pembina_id', $this->petugas_id)
                ->exists();
        }

        if ($tipeTarget === 'KelasFormal') {
            return \Illuminate\Support\Facades\DB::table('kelas_formal')
                ->where('kelas_formal_id', $targetId)
                ->where('wali_kelas_id', $this->petugas_id)
                ->exists();
        }

        return false;
    }
}
