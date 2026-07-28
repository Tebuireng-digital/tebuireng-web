<?php

namespace App\Policies;

use App\Models\Petugas;
use Illuminate\Support\Facades\DB;

class AbsensiPolicy
{
    public function viewAny(Petugas $petugas)
    {
        return true;
    }

    public function view(Petugas $petugas, $absensi)
    {
        return true;
    }

    public function create(Petugas $petugas, $santriId, $jenisKegiatanId)
    {
        return $this->checkAccess($petugas, $santriId, $jenisKegiatanId);
    }

    public function update(Petugas $petugas, $absensi)
    {
        return $this->checkAccess($petugas, $absensi->santri_id, $absensi->jenis_kegiatan_id);
    }

    public function delete(Petugas $petugas, $absensi)
    {
        return $this->checkAccess($petugas, $absensi->santri_id, $absensi->jenis_kegiatan_id);
    }

    private function checkAccess(Petugas $petugas, $santriId, $jenisKegiatanId)
    {
        if ($petugas->jabatan === 'Admin') return true;

        $kegiatan = DB::table('jenis_kegiatan')->where('jenis_kegiatan_id', $jenisKegiatanId)->first();
        if (!$kegiatan) return false;

        $santri = DB::table('santri')->where('santri_id', $santriId)->first();
        if (!$santri) return false;

        switch ($kegiatan->kode) {
            case 'KAMAR':
                return $petugas->hasAccess('Kamar', $santri->kamar_id);
            case 'SEKOLAH':
                return $petugas->hasAccess('KelasFormal', $santri->kelas_formal_id);
            case 'DINIYAH':
                return $petugas->hasAccess('KelompokMadin', $santri->kelompok_madin_id);
            case 'PBS':
                return $petugas->hasAccess('KelompokPBS', $santri->kelompok_pbs_id);
            case 'PBM':
                return $petugas->hasAccess('KelompokPBM', $santri->kelompok_pbm_id);
        }

        return false;
    }
}
