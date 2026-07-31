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
        'wajib_ganti_password',
        'jabatan',
        'status_aktif'
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected function casts(): array
    {
        return [
            'status_aktif' => 'boolean',
            'wajib_ganti_password' => 'boolean',
        ];
    }

    public function hasAccess($tipeTarget, $targetId)
    {
        if ($this->jabatan === 'Admin') {
            return true;
        }

        return \Illuminate\Support\Facades\DB::table('petugas_penugasan')
            ->where('petugas_id', $this->petugas_id)
            ->where('tipe_target', $tipeTarget)
            ->where('target_id', $targetId)
            ->where('tanggal_mulai', '<=', now()->toDateString())
            ->where(function($q) {
                $q->whereNull('tanggal_selesai')
                  ->orWhere('tanggal_selesai', '>=', now()->toDateString());
            })
            ->exists();
    }
}
