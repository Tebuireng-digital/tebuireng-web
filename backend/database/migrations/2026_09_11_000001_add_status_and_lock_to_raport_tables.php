<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('raport_ubudiyah', function (Blueprint $table) {
            $table->enum('status', ['draft', 'dikunci'])->default('draft')->after('semester');
            $table->unsignedInteger('dikunci_oleh')->nullable()->after('status');
            $table->timestamp('dikunci_pada')->nullable()->after('dikunci_oleh');
            $table->text('alasan_buka_kunci')->nullable()->after('dikunci_pada');
            $table->unsignedInteger('dibuka_oleh')->nullable()->after('alasan_buka_kunci');
            $table->timestamp('dibuka_pada')->nullable()->after('dibuka_oleh');

            $table->foreign('dikunci_oleh')->references('petugas_id')->on('petugas')->nullOnDelete();
            $table->foreign('dibuka_oleh')->references('petugas_id')->on('petugas')->nullOnDelete();
        });

        Schema::table('raport_pengajian', function (Blueprint $table) {
            $table->enum('status', ['draft', 'dikunci'])->default('draft')->after('semester');
            $table->unsignedInteger('dikunci_oleh')->nullable()->after('status');
            $table->timestamp('dikunci_pada')->nullable()->after('dikunci_oleh');
            $table->text('alasan_buka_kunci')->nullable()->after('dikunci_pada');
            $table->unsignedInteger('dibuka_oleh')->nullable()->after('alasan_buka_kunci');
            $table->timestamp('dibuka_pada')->nullable()->after('dibuka_oleh');

            $table->foreign('dikunci_oleh')->references('petugas_id')->on('petugas')->nullOnDelete();
            $table->foreign('dibuka_oleh')->references('petugas_id')->on('petugas')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('raport_pengajian', function (Blueprint $table) {
            $table->dropForeign(['dikunci_oleh']);
            $table->dropForeign(['dibuka_oleh']);
            $table->dropColumn([
                'status',
                'dikunci_oleh',
                'dikunci_pada',
                'alasan_buka_kunci',
                'dibuka_oleh',
                'dibuka_pada',
            ]);
        });

        Schema::table('raport_ubudiyah', function (Blueprint $table) {
            $table->dropForeign(['dikunci_oleh']);
            $table->dropForeign(['dibuka_oleh']);
            $table->dropColumn([
                'status',
                'dikunci_oleh',
                'dikunci_pada',
                'alasan_buka_kunci',
                'dibuka_oleh',
                'dibuka_pada',
            ]);
        });
    }
};
