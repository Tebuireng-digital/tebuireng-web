<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('santri_id')->nullable()->index();
            $table->string('no_hp', 30);
            $table->string('tipe_pesan', 50)->default('lainnya')->index(); // perizinan, pelanggaran, dsb
            $table->unsignedBigInteger('referensi_id')->nullable();
            $table->text('isi_pesan');
            $table->string('status', 20)->default('pending')->index(); // pending, sent, failed
            $table->text('response_log')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->foreign('santri_id')->references('santri_id')->on('santri')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_notifications');
    }
};
