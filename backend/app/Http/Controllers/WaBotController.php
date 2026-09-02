<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WaBotController extends Controller
{
    private string $baseUrl;
    private string $apiKey;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.wa_gateway.url', 'http://wa-gateway:3000'), '/');
        $this->apiKey = config('services.wa_gateway.key', config('services.wa_gateway.api_key', 'secret_key_bot_tebuireng'));
    }

    private function fetchFromGateway(string $path, string $method = 'GET')
    {
        $urls = array_unique([
            $this->baseUrl,
            'http://127.0.0.1:3000',
            'http://localhost:3000',
            'http://wa-gateway:3000',
        ]);

        $lastException = null;
        foreach ($urls as $url) {
            try {
                $req = Http::timeout(4)->withHeaders(['X-API-Key' => $this->apiKey]);
                return $method === 'POST' ? $req->post("{$url}{$path}") : $req->get("{$url}{$path}");
            } catch (\Throwable $e) {
                $lastException = $e;
            }
        }

        throw $lastException ?? new \RuntimeException('Unable to reach WA gateway service.');
    }

    public function getStatus(): JsonResponse
    {
        try {
            $response = $this->fetchFromGateway('/status', 'GET');
            return response()->json($response->json(), $response->status());
        } catch (\Throwable $e) {
            Log::error('Failed to get WA Bot status: ' . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'wa_connection' => 'offline',
                'message' => 'Service WA Gateway tidak merespons. Pastikan service wa-gateway berjalan di port 3000.'
            ], 503);
        }
    }

    public function getQrData(): JsonResponse
    {
        try {
            $response = $this->fetchFromGateway('/qr-data', 'GET');
            return response()->json($response->json(), $response->status());
        } catch (\Throwable $e) {
            Log::error('Failed to get WA Bot QR data: ' . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'wa_connection' => 'offline',
                'message' => 'Service WA Gateway tidak merespons.'
            ], 503);
        }
    }

    public function disconnect(): JsonResponse
    {
        try {
            $response = $this->fetchFromGateway('/disconnect', 'POST');
            return response()->json($response->json(), $response->status());
        } catch (\Throwable $e) {
            Log::error('Failed to disconnect WA Bot session: ' . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal menghubungi service WA Gateway.'
            ], 500);
        }
    }
}
