<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('absensi', function (Blueprint $table) {
            $table->id('absensi_id'); // BIGINT UNSIGNED
            $table->unsignedInteger('santri_id');
            $table->unsignedInteger('jenis_kegiatan_id');
            $table->unsignedInteger('jadwal_id');
            $table->date('tanggal');
            $table->enum('status', ['Hadir','Sakit','Izin','Alpha','Terlambat']);
            $table->unsignedSmallInteger('menit_terlambat')->nullable()->comment('diisi jika status = Terlambat');
            $table->string('keterangan', 255)->nullable();
            $table->timestamp('waktu_input')->useCurrent()->comment('diisi otomatis server saat baris pertama dibuat');
            $table->unsignedInteger('diinput_oleh');
            $table->unsignedInteger('diubah_oleh')->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['santri_id', 'jenis_kegiatan_id', 'jadwal_id', 'tanggal'], 'uq_absensi');
            $table->index('tanggal', 'idx_absensi_tanggal');
            $table->index(['jenis_kegiatan_id', 'tanggal'], 'idx_absensi_jenis_tanggal');

            $table->foreign('santri_id', 'fk_absensi_santri')->references('santri_id')->on('santri');
            $table->foreign('jenis_kegiatan_id', 'fk_absensi_jenis')->references('jenis_kegiatan_id')->on('jenis_kegiatan');
            $table->foreign('jadwal_id', 'fk_absensi_jadwal')->references('jadwal_id')->on('jadwal_kegiatan');
            $table->foreign('diinput_oleh', 'fk_absensi_input')->references('petugas_id')->on('petugas');
            $table->foreign('diubah_oleh', 'fk_absensi_ubah')->references('petugas_id')->on('petugas');
        });
    }

    public function down()
    {
        Schema::dropIfExists('absensi');
    }
};
