<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NilaiUbudiyah extends Model
{
    use HasFactory;

    protected $table = 'nilai_ubudiyah';
    protected $primaryKey = 'nilai_id';
    public $timestamps = true;
    protected $guarded = [];

    public function raportHeader()
    {
        return $this->belongsTo(RaportUbudiyah::class, 'raport_ubudiyah_id', 'raport_ubudiyah_id');
    }

    public function instrumen()
    {
        return $this->belongsTo(MasterInstrumenUbudiyah::class, 'instrumen_id', 'instrumen_id');
    }
}
