<?php
require 'vendor/autoload.php';
$r = new OpenSpout\Reader\XLSX\Reader();
$r->open('storage/app/santri-review-kandidat.xlsx');
foreach ($r->getSheetIterator() as $s) {
    foreach ($s->getRowIterator() as $row) {
        var_dump($row->toArray());
        break;
    }
}
$r->close();
