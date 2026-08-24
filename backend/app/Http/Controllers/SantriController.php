<?php

namespace App\Http\Controllers;

use App\Support\SantriAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class SantriController extends Controller
{
    public function index(Request $request)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Keamanan', 'Pengasuh', 'Pembina Kamar'], true)) {
            return response()->json(['message' => 'Role Anda tidak dapat membuka direktori santri.'], 403);
        }

        $query = DB::table('santri')
            ->leftJoin('kamar', 'santri.kamar_id', '=', 'kamar.kamar_id')
            ->leftJoin('unit_pendidikan', 'santri.unit_id', '=', 'unit_pendidikan.unit_id')
            ->select(
                'santri.santri_id', 
                'santri.nama', 
                'santri.nis', 
                'santri.status_aktif',
                'santri.foto_path',
                'kamar.nama as nama_kamar',
                'unit_pendidikan.nama as nama_unit'
            )
            ->where('santri.status_aktif', 1);

        if ($petugas->jabatan === 'Pembina Kamar') {
            SantriAccess::scopeAssigned($query, $petugas);
        }

        $search = $request->input('q') ?? $request->input('search');
        if (!empty($search)) {
            $query->where(function($w) use ($search) {
                $w->where('santri.nama', 'like', "%{$search}%")
                  ->orWhere('santri.nis', 'like', "%{$search}%");
            });
        }

        if ($request->has('kamar_id')) {
            $query->where('santri.kamar_id', $request->kamar_id);
        }
        if ($request->has('kelas_formal_id')) {
            $query->where('santri.kelas_formal_id', $request->kelas_formal_id);
        }
        if ($request->has('kelompok_pbs_id')) {
            $query->where('santri.kelompok_pbs_id', $request->kelompok_pbs_id);
        }
        if ($request->has('kelompok_pbm_id')) {
            $query->where('santri.kelompok_pbm_id', $request->kelompok_pbm_id);
        }
        if ($request->has('kelompok_madin_id')) {
            $query->where('santri.kelompok_madin_id', $request->kelompok_madin_id);
        }

        $query->orderBy('santri.nama', 'asc');

        if ($request->has('q')) {
            $query->limit(20); // limit for typeahead performance
        }

        $results = $query->get()->map(function ($s) {
            $s->foto_url = $s->foto_path ? Storage::url($s->foto_path) : null;
            return $s;
        });

        return response()->json($results);
    }

    public function uploadFoto(Request $request, int $id)
    {
        $petugas = $request->user();
        if (!in_array($petugas->jabatan, ['Admin', 'Pembina Kamar'], true)) {
            return response()->json(['message' => 'Role Anda tidak memiliki izin untuk mengunggah foto santri.'], 403);
        }

        if (!SantriAccess::canAccess($petugas, $id)) {
            return response()->json(['message' => 'Anda tidak memiliki akses untuk memperbarui foto santri ini.'], 403);
        }

        $santri = DB::table('santri')->where('santri_id', $id)->first();
        if (!$santri) {
            return response()->json(['message' => 'Santri tidak ditemukan.'], 404);
        }

        $request->validate([
            'foto' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ], [
            'foto.required' => 'File foto wajib diunggah.',
            'foto.image' => 'File yang diunggah harus berupa gambar.',
            'foto.mimes' => 'Format foto harus berupa JPG, JPEG, PNG, atau WEBP.',
            'foto.max' => 'Ukuran foto maksimal 5 MB.',
        ]);

        $file = $request->file('foto');
        $filename = 'santri_' . $id . '_' . time() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('santri_foto', $filename, 'public');

        if ($santri->foto_path && Storage::disk('public')->exists($santri->foto_path)) {
            Storage::disk('public')->delete($santri->foto_path);
        }

        DB::table('santri')->where('santri_id', $id)->update([
            'foto_path' => $path,
            'updated_at' => now(),
        ]);

        $fotoUrl = Storage::url($path);

        return response()->json([
            'message' => 'Foto santri berhasil diperbarui.',
            'foto_path' => $path,
            'foto_url' => $fotoUrl,
        ]);
    }
}
