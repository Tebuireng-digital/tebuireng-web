<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('pengaturan_sistem', function (Blueprint $table) {
            $table->string('setting_key', 100)->primary();
            $table->string('setting_value', 255);
            $table->string('keterangan', 255)->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down()
    {
        Schema::dropIfExists('pengaturan_sistem');
    }
};
