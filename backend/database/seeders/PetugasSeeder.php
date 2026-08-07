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

        $fixturePassword = (string) env('LOCAL_SEED_PASSWORD', 'masuk123');

        // 1. Ensure the default 6 accounts exist
        $defaultUsers = [
            'admin' => ['nama' => 'User Admin', 'jabatan' => 'Admin'],
            'keamanan' => ['nama' => 'User Keamanan', 'jabatan' => 'Keamanan'],
            'pembinakamar' => ['nama' => 'User Pembina Kamar', 'jabatan' => 'Pembina Kamar'],
            'pengasuh' => ['nama' => 'User Pengasuh', 'jabatan' => 'Pengasuh'],
            'ustadz' => ['nama' => 'User Ustadz', 'jabatan' => 'Ustadz'],
            'walikelas' => ['nama' => 'User Wali Kelas', 'jabatan' => 'Wali Kelas'],
        ];

        foreach ($defaultUsers as $username => $data) {
            DB::table('petugas')->updateOrInsert(['username' => $username], [
                'nama' => $data['nama'],
                'password_hash' => Hash::make($fixturePassword),
                'wajib_ganti_password' => false,
                'no_hp' => '0812' . rand(10000000, 99999999),
                'jabatan' => $data['jabatan'],
                'status_aktif' => 1,
            ]);
        }

        $defaultUsernames = array_keys($defaultUsers);

        // 2. Nullify master references to users that are about to be deleted
        DB::table('kamar')->whereIn('pembina_id', function ($query) use ($defaultUsernames) {
            $query->select('petugas_id')->from('petugas')->whereNotIn('username', $defaultUsernames);
        })->update(['pembina_id' => null]);

        DB::table('kelas_formal')->whereIn('wali_kelas_id', function ($query) use ($defaultUsernames) {
            $query->select('petugas_id')->from('petugas')->whereNotIn('username', $defaultUsernames);
        })->update(['wali_kelas_id' => null]);

        DB::table('kelompok_madin')->whereIn('ustadz_id', function ($query) use ($defaultUsernames) {
            $query->select('petugas_id')->from('petugas')->whereNotIn('username', $defaultUsernames);
        })->update(['ustadz_id' => null]);

        DB::table('kelompok_pbs')->whereIn('ustadz_id', function ($query) use ($defaultUsernames) {
            $query->select('petugas_id')->from('petugas')->whereNotIn('username', $defaultUsernames);
        })->update(['ustadz_id' => null]);

        DB::table('kelompok_pbm')->whereIn('ustadz_id', function ($query) use ($defaultUsernames) {
            $query->select('petugas_id')->from('petugas')->whereNotIn('username', $defaultUsernames);
        })->update(['ustadz_id' => null]);

        // 3. Delete penugasan for users that are about to be deleted
        DB::table('petugas_penugasan')->whereIn('petugas_id', function ($query) use ($defaultUsernames) {
            $query->select('petugas_id')->from('petugas')->whereNotIn('username', $defaultUsernames);
        })->delete();

        // 4. Delete all other records except these 6 default usernames (with FK checks disabled)
        \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();
        DB::table('petugas')->whereNotIn('username', $defaultUsernames)->delete();
        \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

        // 5. Read data_user.json and insert/update
        $jsonPath = database_path('data_user.json');
        if (file_exists($jsonPath)) {
            $json = json_decode(file_get_contents($jsonPath), true);
            $usersToImport = $json['data'] ?? [];

            $roleMap = [
                'Pembina/Ketua Kamar' => 'Pembina Kamar',
                'Keamanan' => 'Keamanan',
                'Sekretaris Pondok' => 'Admin',
                'Petugas Sambangan' => 'Keamanan',
            ];

            foreach ($usersToImport as $u) {
                $username = strtolower(trim($u['Username']));
                $nama = trim($u['Nama Pengurus']);
                $rawRole = trim($u['Jabatan']);
                
                // Map raw role to valid enum values
                $jabatan = $roleMap[$rawRole] ?? 'Admin'; // fallback to Admin if unknown

                // Skip if it duplicates a default username to avoid conflict
                if (in_array($username, $defaultUsernames)) {
                    continue;
                }

                DB::table('petugas')->updateOrInsert(['username' => $username], [
                    'nama' => $nama,
                    'password_hash' => Hash::make($fixturePassword),
                    'wajib_ganti_password' => false,
                    'no_hp' => '0812' . rand(10000000, 99999999),
                    'jabatan' => $jabatan,
                    'status_aktif' => 1,
                ]);
            }
        }
    }
}

