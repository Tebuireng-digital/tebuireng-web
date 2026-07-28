<?php

namespace App\Policies;

use App\Models\Petugas;
use Illuminate\Support\Facades\DB;

class PelanggaranPolicy
{
    public function viewAny(Petugas $petugas)
    {
        return true;
    }

    public function view(Petugas $petugas, $pelanggaran)
    {
        return true;
    }

    public function create(Petugas $petugas, $santriId)
    {
        return $this->checkAccess($petugas, $santriId);
    }

    public function update(Petugas $petugas, $pelanggaran)
    {
        return $this->checkAccess($petugas, $pelanggaran->santri_id);
    }

    public function delete(Petugas $petugas, $pelanggaran)
    {
        return $this->checkAccess($petugas, $pelanggaran->santri_id);
    }

    private function checkAccess(Petugas $petugas, $santriId)
    {
        if ($petugas->jabatan === 'Admin') return true;

        $santri = DB::table('santri')->where('santri_id', $santriId)->first();
        if (!$santri) return false;

        return $petugas->hasAccess('Kamar', $santri->kamar_id) ||
               $petugas->hasAccess('KelasFormal', $santri->kelas_formal_id) ||
               $petugas->hasAccess('KelompokMadin', $santri->kelompok_madin_id) ||
               $petugas->hasAccess('KelompokPBS', $santri->kelompok_pbs_id) ||
               $petugas->hasAccess('KelompokPBM', $santri->kelompok_pbm_id);
    }
}
