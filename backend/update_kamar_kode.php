<?php
$csvPath = __DIR__ . '/storage/app/mapping-kamar-draft.csv';
if (!file_exists($csvPath)) die("File not found");

$handle = fopen($csvPath, "r");
$headers = fgetcsv($handle, 1000, ",");
$updated = 0;
while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
    $kode = $data[0] ?? '';
    $nama = $data[1] ?? '';
    if ($kode && $nama) {
        $affected = DB::table('kamar')
            ->where('nama', $nama)
            ->update(['kode_singkat' => $kode]);
        if ($affected) $updated++;
    }
}
fclose($handle);
echo "Updated $updated kamar records with kode_singkat.\n";
