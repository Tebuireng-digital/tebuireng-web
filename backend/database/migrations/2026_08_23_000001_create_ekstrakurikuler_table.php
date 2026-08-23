<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ekstrakurikuler', function (Blueprint $table) {
            $table->increments('ekstrakurikuler_id');
            $table->string('kode', 30)->unique();
            $table->string('nama', 120);
            $table->unsignedInteger('pembimbing_id')->nullable();
            $table->boolean('status_aktif')->default(true);
            $table->timestamps();
            $table->foreign('pembimbing_id')->references('petugas_id')->on('petugas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ekstrakurikuler');
    }
};
