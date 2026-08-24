<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    /**
     * Format nomor telepon Indonesia ke format internasional (62...)
     */
    public function formatPhoneNumber(?string $phone): ?string
    {
        if (!$phone) {
            return null;
        }

        $clean = preg_replace('/\D/', '', $phone);
        if (empty($clean)) {
            return null;
        }

        if (str_starts_with($clean, '0')) {
            $clean = '62' . substr($clean, 1);
        } elseif (!str_starts_with($clean, '62')) {
            $clean = '62' . $clean;
        }

        return $clean;
    }

    /**
     * Kirim pesan WhatsApp ke nomor tujuan dan catat di wa_notifications table.
     */
    public function sendMessage(string $phone, string $message, ?int $santriId = null, string $tipePesan = 'lainnya', ?int $referensiId = null): bool
    {
        $enabled = config('services.wa_gateway.enabled', true);
        $formattedPhone = $this->formatPhoneNumber($phone);

        if (!$formattedPhone) {
            Log::warning("WA Service: Nomor HP tidak valid ({$phone})");
            return false;
        }

        // Cek apakah pesan dengan tipe dan referensi ID yang sama sudah pernah terkirim (cukup 1 kali saja)
        if ($referensiId && $tipePesan !== 'lainnya') {
            $alreadySent = DB::table('wa_notifications')
                ->where('tipe_pesan', $tipePesan)
                ->where('referensi_id', $referensiId)
                ->where('status', 'sent')
                ->exists();

            if ($alreadySent) {
                Log::info("WA Service: Pesan '{$tipePesan}' ref ID {$referensiId} sudah pernah dikirim. Mengabaikan kirim ulang.");
                return true;
            }
        }

        // Simpan log awal (pending)
        $notificationId = DB::table('wa_notifications')->insertGetId([
            'santri_id' => $santriId,
            'no_hp' => $formattedPhone,
            'tipe_pesan' => $tipePesan,
            'referensi_id' => $referensiId,
            'isi_pesan' => $message,
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if (!$enabled) {
            Log::info("WA Service: WhatsApp notifications disabled via config. Skipping HTTP request.");
            DB::table('wa_notifications')->where('id', $notificationId)->update([
                'status' => 'failed',
                'response_log' => 'WhatsApp notifications disabled in config',
                'updated_at' => now(),
            ]);
            return false;
        }

        $url = config('services.wa_gateway.url') . '/send-message';
        $apiKey = config('services.wa_gateway.key');

        try {
            $response = Http::timeout(10)
                ->withHeaders(['X-API-Key' => $apiKey])
                ->post($url, [
                    'phone' => $formattedPhone,
                    'message' => $message,
                ]);

            if ($response->successful()) {
                DB::table('wa_notifications')->where('id', $notificationId)->update([
                    'status' => 'sent',
                    'response_log' => $response->body(),
                    'sent_at' => now(),
                    'updated_at' => now(),
                ]);
                return true;
            }

            Log::error("WA Service Error: HTTP {$response->status()} - {$response->body()}");
            DB::table('wa_notifications')->where('id', $notificationId)->update([
                'status' => 'failed',
                'response_log' => $response->body(),
                'updated_at' => now(),
            ]);
            return false;
        } catch (\Throwable $e) {
            Log::error("WA Service Exception: " . $e->getMessage());
            DB::table('wa_notifications')->where('id', $notificationId)->update([
                'status' => 'failed',
                'response_log' => $e->getMessage(),
                'updated_at' => now(),
            ]);
            return false;
        }
    }
}
