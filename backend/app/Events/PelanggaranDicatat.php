<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PelanggaranDicatat
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $pelanggaranId;

    public function __construct($pelanggaranId)
    {
        $this->pelanggaranId = $pelanggaranId;
    }
}
