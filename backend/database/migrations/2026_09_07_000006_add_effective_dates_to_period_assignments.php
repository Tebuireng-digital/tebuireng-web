<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignment_periode', function (Blueprint $table): void {
            $table->date('effective_from')->nullable()->after('target_id');
            $table->date('effective_until')->nullable()->after('effective_from');
            $table->index(['santri_id', 'jenis', 'effective_from', 'effective_until'], 'assignment_periode_scope_idx');
        });
    }

    public function down(): void
    {
        Schema::table('assignment_periode', function (Blueprint $table): void {
            $table->dropIndex('assignment_periode_scope_idx');
            $table->dropColumn(['effective_from', 'effective_until']);
        });
    }
};
