<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MasterInstrumenUbudiyah extends Model
{
    use HasFactory;

    protected $table = 'master_instrumen_ubudiyah';
    protected $primaryKey = 'instrumen_id';
    public $timestamps = true;
    protected $guarded = [];

    public function pembuat()
    {
        return $this->belongsTo(Petugas::class, 'dibuat_oleh', 'petugas_id');
    }
}
