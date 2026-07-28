<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('perizinan_approval', function (Blueprint $table) {
            $table->id('approval_id');
            $table->unsignedBigInteger('perizinan_id');
            $table->unsignedTinyInteger('tahap')->comment('1 = Wali Kamar, 2 = Keamanan, dst');
            $table->enum('jabatan_approver', ['Pembina Kamar','Wali Kelas','Ustadz','Pengasuh','Keamanan','Admin']);
            $table->unsignedInteger('petugas_id')->nullable()->comment('diisi saat petugas mengambil keputusan');
            $table->enum('keputusan', ['Menunggu','Disetujui','Ditolak','Gugur'])->default('Menunggu');
            $table->string('catatan', 255)->nullable();
            $table->timestamp('waktu_keputusan')->nullable();

            $table->unique(['perizinan_id', 'tahap'], 'uq_perizinan_tahap');
            $table->foreign('perizinan_id', 'fk_approval_perizinan')->references('perizinan_id')->on('perizinan')->cascadeOnDelete();
            $table->foreign('petugas_id', 'fk_approval_petugas')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('perizinan_approval');
    }
};
