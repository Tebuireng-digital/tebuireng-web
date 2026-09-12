<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MasterInstrumenPengajian extends Model
{
    use HasFactory;

    protected $table = 'master_instrumen_pengajian';
    protected $primaryKey = 'instrumen_id';
    public $timestamps = true;

    protected $fillable = [
        'jenis_pengajian',
        'nama_instrumen',
        'urutan',
        'status_aktif',
        'dibuat_oleh',
    ];

    protected $casts = [
        'status_aktif' => 'boolean',
        'urutan' => 'integer',
    ];

    public function pembuat()
    {
        return $this->belongsTo(Petugas::class, 'dibuat_oleh', 'petugas_id');
    }
}
