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
            $table->string('identitas_sumber', 500)->nullable()->after('status_provenance');
        });

        DB::table('santri_import_reviews')
            ->select('review_id', 'sumber_sheet', 'baris_sumber', 'sumber_file_excel', 'sumber_sheet_excel', 'sumber_baris_excel')
            ->orderBy('review_id')
            ->get()
            ->each(function (object $row): void {
                $identity = $row->sumber_file_excel && $row->sumber_sheet_excel && $row->sumber_baris_excel
                    ? implode('|', [$row->sumber_file_excel, $row->sumber_sheet_excel, $row->sumber_baris_excel])
                    : implode('|', ['LEGACY', $row->sumber_sheet, $row->baris_sumber, $row->review_id]);

                DB::table('santri_import_reviews')
                    ->where('review_id', $row->review_id)
                    ->update(['identitas_sumber' => $identity]);
            });

        Schema::table('santri_import_reviews', function (Blueprint $table): void {
            $table->dropUnique('uq_review_sumber_baris');
            $table->unique('identitas_sumber', 'uq_review_identitas_sumber');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('santri_import_reviews')) {
            return;
        }

        Schema::table('santri_import_reviews', function (Blueprint $table): void {
            $table->dropUnique('uq_review_identitas_sumber');
            $table->unique(['sumber_sheet', 'baris_sumber'], 'uq_review_sumber_baris');
            $table->dropColumn('identitas_sumber');
        });
    }
};
