<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PerizinanApproval extends Model
{
    use HasFactory;

    protected $table = 'perizinan_approval';
    protected $primaryKey = 'approval_id';
    public $timestamps = false;
    protected $guarded = [];
}
