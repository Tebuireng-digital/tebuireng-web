<?php
require __DIR__ . '/vendor/autoload.php';

use OpenSpout\Reader\Xlsx\Reader;

$dir = __DIR__ . '/../docs/excel';
$files = glob($dir . '/*.xlsx');

foreach ($files as $file) {
    echo "=== File: " . basename($file) . " ===\n";
    $reader = new Reader();
    $reader->open($file);
    foreach ($reader->getSheetIterator() as $sheet) {
        echo "  Sheet: " . $sheet->getName() . "\n";
        $count = 0;
        foreach ($sheet->getRowIterator() as $row) {
            $cells = $row->toArray();
            // Try to find the header row (sometimes row 1 is empty or title, so print first 3 non-empty rows)
            $nonEmpty = array_filter($cells, fn($c) => trim((string)$c) !== '');
            if (!empty($nonEmpty)) {
                echo "    Row $count: " . implode(' | ', $cells) . "\n";
                $count++;
            }
            if ($count >= 3) break;
        }
    }
    $reader->close();
}
