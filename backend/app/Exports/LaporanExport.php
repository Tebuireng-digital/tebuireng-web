<?php

namespace App\Exports;

use Illuminate\Contracts\View\View;
use Maatwebsite\Excel\Concerns\FromView;

class LaporanExport implements FromView
{
    protected $data;
    protected $judul;

    public function __construct($data, $judul = 'Laporan')
    {
        $this->data = $data;
        $this->judul = $judul;
    }

    public function view(): View
    {
        return view('exports.laporan', [
            'data' => $this->data,
            'judul' => $this->judul,
            'isExcel' => true,
        ]);
    }
}
