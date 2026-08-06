<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Alumni extends Model
{
    protected $table = 'alumni';
    protected $primaryKey = 'alumni_id';

    protected $fillable = [
        'no_id_induk',
        'nama',
        'jenis_kelamin',
        'tempat_lahir',
        'tanggal_lahir',
        'orang_tua',
        'jenjang',
        'kelas',
        'no_hp',
        'saldo_spp',
        'nominal_saldo',
        'alamat',
        'wilayah',
        'provinsi',
        'angkatan',
        'tahun_lulus',
    ];
}
