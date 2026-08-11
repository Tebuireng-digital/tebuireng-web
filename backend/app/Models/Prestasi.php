<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Prestasi extends Model
{
    use HasFactory;

    protected $table = 'prestasi';
    protected $primaryKey = 'prestasi_id';
    public $timestamps = true;
    protected $guarded = [];

    public function santri()
    {
        return $this->belongsTo(Santri::class, 'santri_id', 'santri_id');
    }

    public function petugas()
    {
        return $this->belongsTo(Petugas::class, 'petugas_pencatat_id', 'petugas_id');
    }
}
