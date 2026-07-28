<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PerizinanApproval extends Model
{
    use HasFactory;

    protected $table = 'perizinan_approval';
    protected $primaryKey = 'perizinan_approval_id';
    public $timestamps = true;
    protected $guarded = [];
}
