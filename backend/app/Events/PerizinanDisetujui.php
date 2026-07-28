<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PerizinanDisetujui
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $perizinanId;
    
    public function __construct($perizinanId)
    {
        $this->perizinanId = $perizinanId;
    }
}
