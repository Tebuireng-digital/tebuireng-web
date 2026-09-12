<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MasterRentangNilai extends Model
{
    use HasFactory;

    protected $table = 'master_rentang_nilai';
    protected $primaryKey = 'id';
    public $timestamps = true;

    protected $fillable = [
        'kategori',
        'huruf',
        'min_nilai',
        'max_nilai',
        'predikat',
        'urutan',
    ];

    protected $casts = [
        'min_nilai' => 'integer',
        'max_nilai' => 'integer',
        'urutan' => 'integer',
    ];
}
