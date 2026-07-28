<?php

$csvPath = __DIR__ . '/storage/app/mapping-kamar-draft.csv';
$rows = [];
if (($handle = fopen($csvPath, "r")) !== FALSE) {
    while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
        $rows[] = $data;
    }
    fclose($handle);
}

$prefixes = [
    'GD' => 'Gus Dur',
    'HK' => 'Hadji Kalla',
    'AB' => 'KH. A. Baidlowi',
    'KI' => 'KH. Ilyas',
    'RD' => 'Roudloh',
    'SZ' => 'Saifuddin Zuhri',
    'SH' => 'Sholihah',
    'SK' => 'Suryo Kusumo',
    'KK' => 'Kiyai Karim',
];

$out = [];
foreach ($rows as $i => $row) {
    if ($i === 0) {
        $out[] = $row;
        continue;
    }
    $kode = $row[0];
    $nama = $row[1] ?? '';
    if (empty($nama)) {
        if ($kode === 'K-BAWAH') {
            $nama = 'K BAWAH';
        } else {
            foreach ($prefixes as $p => $full) {
                if (strpos($kode, $p . ' ') === 0) {
                    $num = substr($kode, strlen($p) + 1);
                    $nama = $full . ' ' . $num;
                    break;
                }
            }
        }
    }
    $out[] = [$kode, $nama];
}

$f = fopen($csvPath, 'w');
foreach ($out as $row) {
    fputcsv($f, $row);
}
fclose($f);

echo "Auto-mapping completed.\n";
