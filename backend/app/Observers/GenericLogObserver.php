<?php

namespace App\Observers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class GenericLogObserver
{
    protected function log($model, $aksi)
    {
        $user = Auth::user();
        if (!$user) return;

        $tabel = $model->getTable();
        // Skip log_aktivitas to avoid infinite loop
        if ($tabel === 'log_aktivitas') return;

        $dataSebelum = $aksi === 'UPDATE' || $aksi === 'DELETE' ? json_encode($model->getOriginal()) : null;
        $dataSesudah = $aksi === 'INSERT' || $aksi === 'UPDATE' ? json_encode($model->getAttributes()) : null;

        DB::table('log_aktivitas')->insert([
            'petugas_id' => $user->petugas_id,
            'aksi' => $aksi,
            'tabel_yang_diubah' => $tabel,
            'data_sebelum' => $dataSebelum,
            'data_sesudah' => $dataSesudah,
            'waktu_aktivitas' => now()
        ]);
    }

    public function created($model)
    {
        $this->log($model, 'INSERT');
    }

    public function updated($model)
    {
        $this->log($model, 'UPDATE');
    }

    public function deleted($model)
    {
        $this->log($model, 'DELETE');
    }
}
