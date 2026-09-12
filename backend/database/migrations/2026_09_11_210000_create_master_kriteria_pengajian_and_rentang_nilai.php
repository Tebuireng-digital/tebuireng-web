<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Tabel Master Instrumen Pengajian
        if (!Schema::hasTable('master_instrumen_pengajian')) {
            Schema::create('master_instrumen_pengajian', function (Blueprint $table) {
                $table->increments('instrumen_id');
                $table->enum('jenis_pengajian', ['AL_QURAN', 'TAKHASSUS']);
                $table->string('nama_instrumen', 150);
                $table->tinyInteger('urutan')->default(0);
                $table->boolean('status_aktif')->default(true);
                $table->unsignedInteger('dibuat_oleh')->nullable();
                $table->timestamps();

                $table->foreign('dibuat_oleh')->references('petugas_id')->on('petugas')->nullOnDelete();
            });

            // Seed default criteria
            $firstAdminId = DB::table('petugas')->where('jabatan', 'Admin')->value('petugas_id');
            $now = now();

            $alQuranAspects = ['Fashohah', 'Tajwid', 'Kelancaran', 'Hafalan'];
            foreach ($alQuranAspects as $idx => $nama) {
                DB::table('master_instrumen_pengajian')->insert([
                    'jenis_pengajian' => 'AL_QURAN',
                    'nama_instrumen' => $nama,
                    'urutan' => $idx + 1,
                    'status_aktif' => 1,
                    'dibuat_oleh' => $firstAdminId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $takhassusAspects = ['Makna', 'Pemahaman', 'Tarkib', 'Hafalan'];
            foreach ($takhassusAspects as $idx => $nama) {
                DB::table('master_instrumen_pengajian')->insert([
                    'jenis_pengajian' => 'TAKHASSUS',
                    'nama_instrumen' => $nama,
                    'urutan' => $idx + 1,
                    'status_aktif' => 1,
                    'dibuat_oleh' => $firstAdminId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        // 2. Tabel Master Rentang Nilai (Grading Scale)
        if (!Schema::hasTable('master_rentang_nilai')) {
            Schema::create('master_rentang_nilai', function (Blueprint $table) {
                $table->increments('id');
                $table->enum('kategori', ['pembinaan', 'pengajian']);
                $table->string('huruf', 10);
                $table->tinyInteger('min_nilai')->unsigned();
                $table->tinyInteger('max_nilai')->unsigned();
                $table->string('predikat', 60);
                $table->tinyInteger('urutan')->default(0);
                $table->timestamps();

                $table->unique(['kategori', 'huruf'], 'unique_kategori_huruf');
            });

            $now = now();
            $defaultRangesPembinaan = [
                ['huruf' => 'A',  'min_nilai' => 85, 'max_nilai' => 100, 'predikat' => 'Sangat Baik', 'urutan' => 1],
                ['huruf' => 'B+', 'min_nilai' => 80, 'max_nilai' => 84,  'predikat' => 'Baik',        'urutan' => 2],
                ['huruf' => 'B',  'min_nilai' => 75, 'max_nilai' => 79,  'predikat' => 'Baik',        'urutan' => 3],
                ['huruf' => 'C+', 'min_nilai' => 70, 'max_nilai' => 74,  'predikat' => 'Cukup',       'urutan' => 4],
                ['huruf' => 'C',  'min_nilai' => 60, 'max_nilai' => 69,  'predikat' => 'Cukup',       'urutan' => 5],
                ['huruf' => 'D',  'min_nilai' => 50, 'max_nilai' => 59,  'predikat' => 'Kurang',      'urutan' => 6],
                ['huruf' => 'E',  'min_nilai' => 0,  'max_nilai' => 49,  'predikat' => 'Sangat Kurang','urutan' => 7],
            ];

            foreach ($defaultRangesPembinaan as $r) {
                DB::table('master_rentang_nilai')->insert(array_merge($r, [
                    'kategori' => 'pembinaan',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]));
            }

            $defaultRangesPengajian = [
                ['huruf' => 'A',  'min_nilai' => 85, 'max_nilai' => 100, 'predikat' => 'Sangat Memuaskan', 'urutan' => 1],
                ['huruf' => 'B+', 'min_nilai' => 80, 'max_nilai' => 84,  'predikat' => 'Memuaskan',        'urutan' => 2],
                ['huruf' => 'B',  'min_nilai' => 75, 'max_nilai' => 79,  'predikat' => 'Baik',             'urutan' => 3],
                ['huruf' => 'C+', 'min_nilai' => 70, 'max_nilai' => 74,  'predikat' => 'Cukup',            'urutan' => 4],
                ['huruf' => 'C',  'min_nilai' => 60, 'max_nilai' => 69,  'predikat' => 'Cukup',            'urutan' => 5],
                ['huruf' => 'D',  'min_nilai' => 50, 'max_nilai' => 59,  'predikat' => 'Kurang',           'urutan' => 6],
                ['huruf' => 'E',  'min_nilai' => 0,  'max_nilai' => 49,  'predikat' => 'Sangat Kurang',    'urutan' => 7],
            ];

            foreach ($defaultRangesPengajian as $r) {
                DB::table('master_rentang_nilai')->insert(array_merge($r, [
                    'kategori' => 'pengajian',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]));
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('master_rentang_nilai');
        Schema::dropIfExists('master_instrumen_pengajian');
    }
};
