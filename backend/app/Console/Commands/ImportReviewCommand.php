<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use OpenSpout\Reader\XLSX\Reader;

class ImportReviewCommand extends Command
{
    protected $signature = 'import:review';
    protected $description = 'Import reviewed Santri from Excel';

    public function handle()
    {
        $this->info("Memproses review Santri...");
        $kandidatPath = storage_path('app/santri-review-kandidat.xlsx');
        $baruPath = storage_path('app/santri-review-baru.xlsx');

        if (file_exists($kandidatPath)) {
            $this->processReview($kandidatPath, true);
        }
        if (file_exists($baruPath)) {
            $this->processReview($baruPath, false);
        }
        
        $this->info("Review selesai diproses.");
    }

    private function processReview($path, $isKandidat)
    {
        $reader = new Reader();
        $reader->open($path);
        
        $count = 0;
        foreach ($reader->getSheetIterator() as $sheet) {
            $rowIdx = 0;
            $header = [];
            $keputusanIdx = -1;
            
            foreach ($sheet->getRowIterator() as $row) {
                $cells = $row->toArray();
                if ($rowIdx === 0) {
                    $header = $cells;
                    foreach ($cells as $i => $h) {
                        if (strtolower(trim($h)) === 'keputusan') {
                            $keputusanIdx = $i;
                        }
                    }
                } else {
                    $keputusan = $keputusanIdx >= 0 ? trim($cells[$keputusanIdx] ?? '') : '';
                    if (empty($keputusan)) continue;
                    
                    // Logic to process decisions would go here
                    // Example: "Insert Baru", "Merge ID 123", "Abaikan"
                    $count++;
                }
                $rowIdx++;
            }
            break; // Only read first sheet
        }
        $reader->close();
        $type = $isKandidat ? "Kandidat" : "Baru";
        $this->info("Memproses $count keputusan dari file $type.");
    }
}
