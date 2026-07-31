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
        if (!app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('PetugasSeeder hanya boleh dijalankan pada local/testing.');
        }

        $roles = ['Pengasuh', 'Ustadz', 'Pembina Kamar', 'Wali Kelas', 'Keamanan', 'Admin'];
        $fixturePassword = (string) env('LOCAL_SEED_PASSWORD', 'masuk123');

        foreach ($roles as $role) {
            $username = strtolower(str_replace(' ', '', $role)); // e.g., pengasuh, ustadz, pembinakamar

            DB::table('petugas')->updateOrInsert(['username' => $username], [
                'nama' => 'User ' . $role,
                'password_hash' => Hash::make($fixturePassword),
                'wajib_ganti_password' => false,
                'no_hp' => '0812' . rand(10000000, 99999999),
                'jabatan' => $role,
                'status_aktif' => 1,
            ]);
        }
    }
}
