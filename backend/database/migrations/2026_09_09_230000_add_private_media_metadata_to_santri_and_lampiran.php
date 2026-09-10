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
            $table->string('foto_disk', 30)->nullable()->after('foto_path');
            $table->string('foto_original_filename', 255)->nullable()->after('foto_disk');
            $table->string('foto_mime_type', 120)->nullable()->after('foto_original_filename');
            $table->unsignedBigInteger('foto_size_bytes')->nullable()->after('foto_mime_type');
            $table->char('foto_sha256', 64)->nullable()->after('foto_size_bytes');
            $table->timestamp('foto_uploaded_at')->nullable()->after('foto_sha256');
        });

        Schema::table('lampiran_pelanggaran', function (Blueprint $table) {
            $table->string('disk', 30)->nullable()->after('path_file');
            $table->string('original_filename', 255)->nullable()->after('disk');
            $table->string('mime_type', 120)->nullable()->after('original_filename');
            $table->unsignedBigInteger('size_bytes')->nullable()->after('mime_type');
            $table->char('sha256', 64)->nullable()->after('size_bytes');
            $table->timestamp('updated_at')->nullable()->after('created_at');
        });

        DB::table('santri')
            ->whereNotNull('foto_path')
            ->whereNull('foto_disk')
            ->update([
                'foto_disk' => 'public',
                'foto_uploaded_at' => DB::raw('updated_at'),
            ]);

        DB::table('lampiran_pelanggaran')
            ->whereNull('disk')
            ->update([
                'disk' => 'local',
                'updated_at' => DB::raw('created_at'),
            ]);
    }

    public function down(): void
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->dropColumn([
                'foto_disk',
                'foto_original_filename',
                'foto_mime_type',
                'foto_size_bytes',
                'foto_sha256',
                'foto_uploaded_at',
            ]);
        });

        Schema::table('lampiran_pelanggaran', function (Blueprint $table) {
            $table->dropColumn([
                'disk',
                'original_filename',
                'mime_type',
                'size_bytes',
                'sha256',
                'updated_at',
            ]);
        });
    }
};
