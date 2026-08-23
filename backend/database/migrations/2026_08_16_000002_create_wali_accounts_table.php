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
        Schema::create('wali_accounts', function (Blueprint $table) {
            $table->id('wali_id');
            $table->unsignedInteger('santri_id')->unique();
            $table->string('username', 30)->unique()->comment('Nomor Induk Pondok anak');
            $table->string('password_hash', 255);
            $table->boolean('wajib_ganti_password')->default(true);
            $table->boolean('status_aktif')->default(true);
            $table->timestamps();
            $table->foreign('santri_id')->references('santri_id')->on('santri')->cascadeOnDelete();
        });

        $temporaryPassword = Hash::make('masuk123');
        DB::table('santri')
            ->whereNotNull('no_id_induk')
            ->where('no_id_induk', '!=', '')
            ->orderBy('santri_id')
            ->get(['santri_id', 'no_id_induk'])
            ->each(function ($santri) use ($temporaryPassword) {
                DB::table('wali_accounts')->insertOrIgnore([
                    'santri_id' => $santri->santri_id,
                    'username' => $santri->no_id_induk,
                    'password_hash' => $temporaryPassword,
                    'wajib_ganti_password' => true,
                    'status_aktif' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('wali_accounts');
    }
};
