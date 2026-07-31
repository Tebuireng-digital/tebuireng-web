<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class PetugasSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = ['Pengasuh', 'Ustadz', 'Pembina Kamar', 'Wali Kelas', 'Keamanan', 'Admin'];

        foreach ($roles as $role) {
            $username = strtolower(str_replace(' ', '', $role)); // e.g., pengasuh, ustadz, pembinakamar

            DB::table('petugas')->insert([
                'nama' => 'User ' . $role,
                'username' => $username,
                'password_hash' => Hash::make('password'),
                'wajib_ganti_password' => true,
                'no_hp' => '0812' . rand(10000000, 99999999),
                'jabatan' => $role,
                'status_aktif' => 1,
            ]);
        }
    }
}
