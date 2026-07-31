<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Absensi extends Model
{
    protected $table = 'absensi';
    protected $primaryKey = 'absensi_id';
    public $timestamps = false;
    protected $guarded = [];
}
