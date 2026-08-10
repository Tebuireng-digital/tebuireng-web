<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Santri extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'santri';
    protected $primaryKey = 'santri_id';

    public function getAuthPasswordName()
    {
        return 'password_hash';
    }

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    protected $fillable = [
        'nis',
        'nama',
        'unit_id',
        'kamar_id',
        'organisasi_daerah_id',
        'kelas_formal_id',
        'kelompok_madin_id',
        'kelompok_pbs_id',
        'kelompok_pbm_id',
        'nama_wali',
        'no_hp_wali',
        'status_aktif',
        'password_hash'
    ];

    protected $hidden = [
        'password_hash',
    ];
}
