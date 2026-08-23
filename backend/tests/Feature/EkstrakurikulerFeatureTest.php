<?php

namespace Tests\Feature;

use App\Models\Petugas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EkstrakurikulerFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_update_and_deactivate_ekstrakurikuler(): void
    {
        $admin = Petugas::create([
            'nama' => 'Admin Ekstra', 'username' => 'admin_ekstra', 'password_hash' => Hash::make('password'),
            'jabatan' => 'Admin', 'status_aktif' => 1, 'wajib_ganti_password' => 0,
        ]);
        $pembimbing = Petugas::create([
            'nama' => 'Pembimbing Ekstra', 'username' => 'pembimbing_ekstra', 'password_hash' => Hash::make('password'),
            'jabatan' => 'Ustadz', 'status_aktif' => 1, 'wajib_ganti_password' => 0,
        ]);

        $created = $this->actingAs($admin)->postJson('/api/master/ekstrakurikuler', [
            'kode' => 'PRAMUKA', 'nama' => 'Pramuka', 'pembimbing_id' => $pembimbing->petugas_id,
        ])->assertCreated();
        $id = $created->json('ekstrakurikuler_id');

        $this->actingAs($admin)->putJson("/api/master/ekstrakurikuler/{$id}", [
            'kode' => 'PMR', 'nama' => 'Palang Merah Remaja', 'pembimbing_id' => $pembimbing->petugas_id, 'status_aktif' => true,
        ])->assertOk();
        $this->assertDatabaseHas('ekstrakurikuler', ['ekstrakurikuler_id' => $id, 'kode' => 'PMR']);

        $this->actingAs($admin)->deleteJson("/api/master/ekstrakurikuler/{$id}")->assertOk();
        $this->assertDatabaseHas('ekstrakurikuler', ['ekstrakurikuler_id' => $id, 'status_aktif' => 0]);
    }
}
