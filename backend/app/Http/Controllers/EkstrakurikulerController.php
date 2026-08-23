<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EkstrakurikulerController extends Controller
{
    public function index()
    {
        return response()->json(DB::table('ekstrakurikuler')
            ->leftJoin('petugas', 'ekstrakurikuler.pembimbing_id', '=', 'petugas.petugas_id')
            ->select('ekstrakurikuler.*', 'petugas.nama as nama_pembimbing')
            ->orderBy('ekstrakurikuler.nama')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'ekstrakurikuler_id' => 'nullable|integer',
            'kode' => 'required|string|max:30',
            'nama' => 'required|string|max:120',
            'pembimbing_id' => 'nullable|integer|exists:petugas,petugas_id',
            'status_aktif' => 'nullable|boolean',
        ]);
        $payload = [
            'kode' => strtoupper(trim($data['kode'])),
            'nama' => trim($data['nama']),
            'pembimbing_id' => $data['pembimbing_id'] ?? null,
            'status_aktif' => $data['status_aktif'] ?? true,
            'updated_at' => now(),
        ];
        $duplicate = DB::table('ekstrakurikuler')->where('kode', $payload['kode'])
            ->when(!empty($data['ekstrakurikuler_id']), fn ($q) => $q->where('ekstrakurikuler_id', '!=', $data['ekstrakurikuler_id']))->exists();
        if ($duplicate) return response()->json(['message' => 'Kode ekstrakurikuler sudah digunakan.'], 422);
        if (!empty($data['ekstrakurikuler_id'])) {
            DB::table('ekstrakurikuler')->where('ekstrakurikuler_id', $data['ekstrakurikuler_id'])->update($payload);
            return response()->json(['message' => 'Ekstrakurikuler berhasil diperbarui.']);
        }
        $payload['created_at'] = now();
        $id = DB::table('ekstrakurikuler')->insertGetId($payload);
        return response()->json(['message' => 'Ekstrakurikuler berhasil ditambahkan.', 'ekstrakurikuler_id' => $id], 201);
    }

    public function update(Request $request, int $id)
    {
        if (!DB::table('ekstrakurikuler')->where('ekstrakurikuler_id', $id)->exists()) return response()->json(['message' => 'Ekstrakurikuler tidak ditemukan.'], 404);
        $request->merge(['ekstrakurikuler_id' => $id]);
        return $this->store($request);
    }

    public function destroy(int $id)
    {
        $updated = DB::table('ekstrakurikuler')->where('ekstrakurikuler_id', $id)->update(['status_aktif' => false, 'updated_at' => now()]);
        return $updated ? response()->json(['message' => 'Ekstrakurikuler berhasil dinonaktifkan.']) : response()->json(['message' => 'Ekstrakurikuler tidak ditemukan.'], 404);
    }
}
