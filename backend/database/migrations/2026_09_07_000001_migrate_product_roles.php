<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE petugas MODIFY jabatan ENUM('Pengasuh','Ustadz','Piket Pengajian','Pembina Kamar','Wali Kelas','Keamanan','Admin') NOT NULL");
            DB::statement("ALTER TABLE perizinan_approval MODIFY jabatan_approver ENUM('Pembina Kamar','Wali Kelas','Ustadz','Piket Pengajian','Pengasuh','Keamanan','Admin') NOT NULL");
        }

        DB::table('petugas')->where('jabatan', 'Ustadz')->update(['jabatan' => 'Piket Pengajian']);
        DB::table('petugas')->where('jabatan', 'Pengasuh')->update(['jabatan' => 'Admin']);
        DB::table('perizinan_approval')->where('jabatan_approver', 'Ustadz')->update(['jabatan_approver' => 'Piket Pengajian']);
        DB::table('perizinan_approval')->where('jabatan_approver', 'Pengasuh')->update(['jabatan_approver' => 'Admin']);

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE petugas MODIFY jabatan ENUM('Admin','Keamanan','Pembina Kamar','Wali Kelas','Piket Pengajian') NOT NULL");
            DB::statement("ALTER TABLE perizinan_approval MODIFY jabatan_approver ENUM('Pembina Kamar','Wali Kelas','Piket Pengajian','Keamanan','Admin') NOT NULL");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE petugas MODIFY jabatan ENUM('Pengasuh','Ustadz','Piket Pengajian','Pembina Kamar','Wali Kelas','Keamanan','Admin') NOT NULL");
            DB::statement("ALTER TABLE perizinan_approval MODIFY jabatan_approver ENUM('Pembina Kamar','Wali Kelas','Ustadz','Piket Pengajian','Pengasuh','Keamanan','Admin') NOT NULL");
        }

        DB::table('petugas')->where('jabatan', 'Piket Pengajian')->update(['jabatan' => 'Ustadz']);
        DB::table('perizinan_approval')->where('jabatan_approver', 'Piket Pengajian')->update(['jabatan_approver' => 'Ustadz']);
    }
};
