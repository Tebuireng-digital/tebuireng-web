<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up()
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->string('password_hash')->nullable()->after('nama');
        });

        // Set default password "password" for all existing santri
        $defaultPassword = Hash::make('password');
        DB::table('santri')->update(['password_hash' => $defaultPassword]);
    }

    public function down()
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->dropColumn('password_hash');
        });
    }
};
