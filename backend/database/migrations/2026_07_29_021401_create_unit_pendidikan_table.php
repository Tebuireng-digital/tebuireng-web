<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('unit_pendidikan', function (Blueprint $table) {
            $table->increments('unit_id');
            $table->string('kode', 10)->unique()->comment('MTS, SMP, SMA, SMK, MA');
            $table->string('nama', 100);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down()
    {
        Schema::dropIfExists('unit_pendidikan');
    }
};
