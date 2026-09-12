<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('santri_import_reviews')) {
            return;
        }

        Schema::table('santri_import_reviews', function (Blueprint $table): void {
            $table->string('status_sumber_review', 20)->nullable()->after('status');
            $table->string('tipe_review', 30)->default('verifikasi_manual')->after('status_sumber_review');
            $table->string('keputusan_admin', 30)->default('belum_diputuskan')->after('tipe_review');
            $table->string('status_tindak_lanjut', 40)->nullable()->after('keputusan_admin');
            $table->string('no_id_induk_kandidat_sumber', 30)->nullable()->after('status_tindak_lanjut');
            $table->string('nama_kandidat_sumber', 150)->nullable()->after('no_id_induk_kandidat_sumber');
            $table->string('kamar_kandidat_sumber', 100)->nullable()->after('nama_kandidat_sumber');
            $table->boolean('perlu_review_ulang')->default(false)->after('kamar_kandidat_sumber');
            $table->index(['status_sumber_review', 'keputusan_admin'], 'idx_review_source_decision');
            $table->index(['tipe_review', 'status'], 'idx_review_type_status');
        });

        DB::table('santri_import_reviews')
            ->where('status', 'digabung')
            ->update(['keputusan_admin' => 'digabung']);

        DB::table('santri_import_reviews')
            ->where('status', 'terpisah')
            ->update(['keputusan_admin' => 'terpisah']);
    }

    public function down(): void
    {
        if (!Schema::hasTable('santri_import_reviews')) {
            return;
        }

        Schema::table('santri_import_reviews', function (Blueprint $table): void {
            $table->dropIndex('idx_review_source_decision');
            $table->dropIndex('idx_review_type_status');
            $table->dropColumn([
                'status_sumber_review',
                'tipe_review',
                'keputusan_admin',
                'status_tindak_lanjut',
                'no_id_induk_kandidat_sumber',
                'nama_kandidat_sumber',
                'kamar_kandidat_sumber',
                'perlu_review_ulang',
            ]);
        });
    }
};
