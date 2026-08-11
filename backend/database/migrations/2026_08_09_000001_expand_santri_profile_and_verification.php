<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->string('no_id_induk', 30)->nullable()->unique()->after('santri_id');
            $table->string('nik_siswa', 32)->nullable()->index()->after('no_id_induk');
            $table->string('jenis_kelamin', 1)->nullable()->after('nama');
            $table->string('tempat_lahir', 100)->nullable()->after('jenis_kelamin');
            $table->date('tanggal_lahir')->nullable()->after('tempat_lahir');
            $table->string('no_hp_santri', 30)->nullable()->after('tanggal_lahir');
            $table->text('alamat_jalan')->nullable()->after('no_hp_santri');
            $table->string('provinsi', 100)->nullable()->after('alamat_jalan');
            $table->string('kabupaten_kota', 120)->nullable()->after('provinsi');
            $table->string('kecamatan', 120)->nullable()->after('kabupaten_kota');
            $table->string('desa_kelurahan', 120)->nullable()->after('kecamatan');
            $table->string('kode_pos', 12)->nullable()->after('desa_kelurahan');
            $table->string('status_verifikasi', 40)->default('perlu_verifikasi')->after('status_aktif');
            $table->string('status_siswa_sumber', 30)->nullable()->after('status_verifikasi');
        });

        Schema::create('santri_keluarga', function (Blueprint $table) {
            $table->id('santri_keluarga_id');
            $table->unsignedInteger('santri_id')->unique();
            $table->string('no_kk', 32)->nullable();
            $table->string('nama_ayah', 150)->nullable();
            $table->string('nik_ayah', 32)->nullable();
            $table->string('pendidikan_ayah', 50)->nullable();
            $table->string('pekerjaan_ayah', 100)->nullable();
            $table->string('nama_ibu', 150)->nullable();
            $table->string('nik_ibu', 32)->nullable();
            $table->string('pendidikan_ibu', 50)->nullable();
            $table->string('pekerjaan_ibu', 100)->nullable();
            $table->string('rata_rata_penghasilan', 50)->nullable();
            $table->timestamps();
            $table->foreign('santri_id')->references('santri_id')->on('santri')->cascadeOnDelete();
        });

        Schema::create('santri_pendidikan', function (Blueprint $table) {
            $table->id('santri_pendidikan_id');
            $table->unsignedInteger('santri_id');
            $table->string('tahun_ajaran', 9)->default('2026/2027');
            $table->string('pend_sumber', 20)->nullable();
            $table->string('kelas_sumber', 30)->nullable();
            $table->string('jurusan', 100)->nullable();
            $table->string('kelas_paralel', 100)->nullable();
            $table->string('ranking', 30)->nullable();
            $table->string('status_siswa_sumber', 30)->nullable();
            $table->string('asal_sekolah', 255)->nullable();
            $table->string('jenis_sekolah', 50)->nullable();
            $table->string('status_sekolah', 50)->nullable();
            $table->string('lokasi_sekolah', 100)->nullable();
            $table->string('no_un', 50)->nullable();
            $table->string('kip', 50)->nullable();
            $table->string('saldo_spp', 50)->nullable();
            $table->timestamps();
            $table->unique(['santri_id', 'tahun_ajaran']);
            $table->foreign('santri_id')->references('santri_id')->on('santri')->cascadeOnDelete();
        });

        Schema::create('organisasi_daerah', function (Blueprint $table) {
            $table->id('organisasi_daerah_id');
            $table->string('kode', 30)->nullable();
            $table->string('nama', 150)->nullable();
            $table->text('keterangan')->nullable();
            $table->boolean('status_aktif')->default(true);
            $table->timestamps();
        });

        Schema::create('santri_organisasi_daerah', function (Blueprint $table) {
            $table->id('santri_organisasi_daerah_id');
            $table->unsignedInteger('santri_id');
            $table->unsignedBigInteger('organisasi_daerah_id');
            $table->string('status', 20)->default('aktif');
            $table->string('sumber_penetapan', 30)->default('manual');
            $table->unsignedInteger('ditetapkan_oleh')->nullable();
            $table->date('tanggal_mulai')->nullable();
            $table->date('tanggal_selesai')->nullable();
            $table->timestamps();
            $table->index(['santri_id', 'status']);
            $table->foreign('santri_id')->references('santri_id')->on('santri')->cascadeOnDelete();
            $table->foreign('organisasi_daerah_id')->references('organisasi_daerah_id')->on('organisasi_daerah')->cascadeOnDelete();
            $table->foreign('ditetapkan_oleh')->references('petugas_id')->on('petugas')->nullOnDelete();
        });

        Schema::create('organisasi_daerah_cakupan', function (Blueprint $table) {
            $table->id('cakupan_id');
            $table->unsignedBigInteger('organisasi_daerah_id');
            $table->string('provinsi', 100)->nullable();
            $table->string('kabupaten_kota', 120)->nullable();
            $table->string('kecamatan', 120)->nullable();
            $table->boolean('status_aktif')->default(true);
            $table->timestamps();
            $table->foreign('organisasi_daerah_id')->references('organisasi_daerah_id')->on('organisasi_daerah')->cascadeOnDelete();
        });

        Schema::create('santri_roster_mappings', function (Blueprint $table) {
            $table->id('mapping_id');
            $table->unsignedInteger('santri_id')->nullable();
            $table->string('sumber_kegiatan', 20);
            $table->string('sumber_roster', 150);
            $table->string('nama_sumber', 150);
            $table->string('identitas_sumber', 100)->nullable();
            $table->unsignedInteger('target_id')->nullable();
            $table->string('metode_pencocokan', 30)->default('perlu_review');
            $table->string('status_review', 30)->default('perlu_review');
            $table->timestamps();
            $table->index(['sumber_kegiatan', 'status_review']);
            $table->foreign('santri_id')->references('santri_id')->on('santri')->nullOnDelete();
        });

        DB::table('organisasi_daerah')->insert([
            ['kode' => 'HISPA', 'nama' => 'Himpunan Santri Pasundan', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'OPIM', 'nama' => 'Organisasi Pelajar Islam Malang / Tapal Kuda', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'HISMA', 'nama' => 'Himpunan Santri Majapahit', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'IKSMA', 'nama' => 'Ikatan Santri Madura', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'PUTRA_DELTA', 'nama' => 'Putra Delta (Sidoarjo)', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'HISWITA', 'nama' => 'Himpunan Santri Wilayah Tengah dan Timur', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'RIM', 'nama' => 'Radlatul Islamiyah Al-Mardiyah (Brebes & Tegal)', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'OPI_DKI', 'nama' => 'Organisasi Pelajar Islam Daerah Khusus Ibu Kota', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'KSHC', 'nama' => 'Keluarga Santri Syarief Hidayatullah Cirebon', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'OPIA', 'nama' => 'Organisasi Pelajar Islam Andalas', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'OPI_TH', 'nama' => 'Organisasi Pelajar Islam Thariqul Huda', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'KSPI', 'nama' => 'Keluarga Santri Pemalang Indonesia', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'KESIS', 'nama' => 'Keluarga Santri Indonesia Semarang', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'CPISA', 'nama' => 'Correlatie Pelajar Islam Sunan Ampel', 'created_at' => now(), 'updated_at' => now()],
            ['kode' => 'HISLA', 'nama' => 'Himpunan Santri Lamongan', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('santri_roster_mappings');
        Schema::dropIfExists('organisasi_daerah_cakupan');
        Schema::dropIfExists('santri_organisasi_daerah');
        Schema::dropIfExists('organisasi_daerah');
        Schema::dropIfExists('santri_pendidikan');
        Schema::dropIfExists('santri_keluarga');
        Schema::table('santri', function (Blueprint $table) {
            $table->dropUnique(['no_id_induk']);
            $table->dropIndex(['nik_siswa']);
            $table->dropColumn(['no_id_induk', 'nik_siswa', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'no_hp_santri', 'alamat_jalan', 'provinsi', 'kabupaten_kota', 'kecamatan', 'desa_kelurahan', 'kode_pos', 'status_verifikasi', 'status_siswa_sumber']);
        });
    }
};
