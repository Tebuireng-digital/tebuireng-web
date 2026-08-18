<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RaportUbudiyah extends Model
{
    use HasFactory;

    protected $table = 'raport_ubudiyah';
    protected $primaryKey = 'raport_ubudiyah_id';
    public $timestamps = true;
    protected $guarded = [];

    public function santri()
    {
        return $this->belongsTo(Santri::class, 'santri_id', 'santri_id');
    }

    public function kamar()
    {
        return $this->belongsTo(Kamar::class, 'kamar_id', 'kamar_id');
    }

    public function penilai()
    {
        return $this->belongsTo(Petugas::class, 'diisi_oleh', 'petugas_id');
    }

    public function nilaiDetails()
    {
        return $this->hasMany(NilaiUbudiyah::class, 'raport_ubudiyah_id', 'raport_ubudiyah_id');
    }
}
