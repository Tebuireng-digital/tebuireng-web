<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->boolean('wajib_ganti_password')->default(true)->after('password_hash');
        });

        DB::table('santri')->whereNotNull('password_hash')->update([
            'password_hash' => Hash::make('masuk123'),
            'wajib_ganti_password' => true,
        ]);
    }

    public function down(): void
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->dropColumn('wajib_ganti_password');
        });
    }
};
