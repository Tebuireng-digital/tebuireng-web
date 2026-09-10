<?php

namespace App\Policies;

use App\Models\Petugas;
use App\Support\SantriAccess;

class PelanggaranPolicy
{
    public function viewAny(Petugas $petugas)
    {
        return in_array($petugas->jabatan, ['Admin', 'Keamanan', 'Pembina Kamar'], true);
    }

    public function view(Petugas $petugas, $pelanggaran)
    {
        if (in_array($petugas->jabatan, ['Admin', 'Keamanan'], true)) {
            return true;
        }

        return $petugas->jabatan === 'Pembina Kamar'
            && SantriAccess::canAccess($petugas, (int) $pelanggaran->santri_id);
    }

    public function create(Petugas $petugas, $pelanggaran)
    {
        if (in_array($petugas->jabatan, ['Admin', 'Keamanan'], true)) {
            return true;
        }

        return $petugas->jabatan === 'Pembina Kamar'
            && SantriAccess::canAccess($petugas, (int) $pelanggaran->santri_id);
    }

    public function update(Petugas $petugas, $pelanggaran)
    {
        if ($petugas->jabatan === 'Admin') {
            return true;
        }

        if ($petugas->jabatan === 'Keamanan') {
            $isOwner = (int) $pelanggaran->petugas_pencatat_id === (int) $petugas->petugas_id;
            if (!$isOwner) {
                return false;
            }

            if (!$pelanggaran->created_at) {
                return false;
            }

            $createdAt = \Carbon\Carbon::parse($pelanggaran->created_at);
            return abs(now()->diffInSeconds($createdAt, false)) <= 86400;
        }

        return false;
    }

    public function delete(Petugas $petugas, $pelanggaran)
    {
        return $this->checkAccess($petugas, $pelanggaran->santri_id);
    }

    private function checkAccess(Petugas $petugas, $santriId)
    {
        if (in_array($petugas->jabatan, ['Admin', 'Keamanan'], true)) return true;

        return $petugas->jabatan === 'Pembina Kamar'
            && SantriAccess::canAccess($petugas, (int) $santriId);
    }
}
