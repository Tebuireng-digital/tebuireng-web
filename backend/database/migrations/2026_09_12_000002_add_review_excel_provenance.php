<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('santri_import_reviews')) {
            return;
        }

        Schema::table('santri_import_reviews', function (Blueprint $table): void {
            $table->string('sumber_file_excel', 255)->nullable()->after('sumber_sheet');
            $table->string('sumber_sheet_excel', 150)->nullable()->after('sumber_file_excel');
            $table->unsignedInteger('sumber_baris_excel')->nullable()->after('sumber_sheet_excel');
            $table->string('review_file_excel', 255)->nullable()->after('sumber_baris_excel');
            $table->string('review_sheet_excel', 100)->nullable()->after('review_file_excel');
            $table->unsignedInteger('review_baris_excel')->nullable()->after('review_sheet_excel');
            $table->string('status_provenance', 24)->default('PERLU_VERIFIKASI')->after('review_baris_excel');
            $table->index(['sumber_file_excel', 'sumber_sheet_excel'], 'idx_review_excel_source');
            $table->index(['status_provenance', 'review_sheet_excel'], 'idx_review_provenance_status');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('santri_import_reviews')) {
            return;
        }

        Schema::table('santri_import_reviews', function (Blueprint $table): void {
            $table->dropIndex('idx_review_excel_source');
            $table->dropIndex('idx_review_provenance_status');
            $table->dropColumn([
                'sumber_file_excel',
                'sumber_sheet_excel',
                'sumber_baris_excel',
                'review_file_excel',
                'review_sheet_excel',
                'review_baris_excel',
                'status_provenance',
            ]);
        });
    }
};
