<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class WaliAccount extends Authenticatable
{
    use Notifiable;

    protected $table = 'wali_accounts';
    protected $primaryKey = 'wali_id';

    public function getAuthPasswordName()
    {
        return 'password_hash';
    }

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    protected $hidden = ['password_hash'];

    protected function casts(): array
    {
        return [
            'status_aktif' => 'boolean',
            'wajib_ganti_password' => 'boolean',
        ];
    }
}
