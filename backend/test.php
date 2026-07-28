<?php
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

$kode = "AB 201";
foreach ($prefixes as $p => $full) {
    var_dump($kode, $p . ' ', strpos($kode, $p . ' '));
    if (strpos($kode, $p . ' ') === 0) {
        $num = substr($kode, strlen($p) + 1);
        $nama = $full . ' ' . $num;
        var_dump($nama);
        break;
    }
}
