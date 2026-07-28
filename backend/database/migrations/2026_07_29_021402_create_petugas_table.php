<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('petugas', function (Blueprint $table) {
            $table->increments('petugas_id');
            $table->string('nama', 150);
            $table->string('username', 100)->unique();
            $table->string('password_hash', 255);
            $table->string('no_hp', 20)->nullable();
            $table->enum('jabatan', ['Pengasuh','Ustadz','Pembina Kamar','Wali Kelas','Keamanan','Admin']);
            $table->boolean('status_aktif')->default(1);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down()
    {
        Schema::dropIfExists('petugas');
    }
};
