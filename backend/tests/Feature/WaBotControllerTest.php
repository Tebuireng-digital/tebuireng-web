<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WaBotControllerTest extends TestCase
{
    use RefreshDatabase;

    private Petugas $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Petugas::create([
            'nama' => 'Admin WA',
            'username' => 'admin-wa',
            'password_hash' => Hash::make('PasswordAdmin123'),
            'wajib_ganti_password' => false,
            'jabatan' => 'Admin',
            'status_aktif' => 1,
        ]);
    }

    public function test_status_uses_configured_gateway_key_header(): void
    {
        config()->set('services.wa_gateway.url', 'http://wa-gateway.test:3000');
        config()->set('services.wa_gateway.key', 'rotated-wa-key');

        Http::fake([
            'http://wa-gateway.test:3000/status' => Http::response([
                'status' => 'ok',
                'wa_connection' => 'connected',
            ], 200),
        ]);

        $this->actingAs($this->admin, 'sanctum');

        $this->getJson('/api/master/wa-bot/status')
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('wa_connection', 'connected');

        Http::assertSent(function ($request) {
            return $request->url() === 'http://wa-gateway.test:3000/status'
                && $request->hasHeader('X-API-Key', 'rotated-wa-key');
        });
    }
}
