<?php
try {
    DB::select('SELECT * FROM v_rekap_absensi_harian LIMIT 1');
    echo "View v_rekap_absensi_harian OK.\n";
} catch (\Exception $e) { echo "Error v_rekap_absensi_harian: " . $e->getMessage() . "\n"; }

try {
    DB::select('SELECT * FROM v_progres_approval_izin LIMIT 1');
    echo "View v_progres_approval_izin OK.\n";
} catch (\Exception $e) { echo "Error v_progres_approval_izin: " . $e->getMessage() . "\n"; }

try {
    DB::select('SELECT * FROM v_santri_sedang_izin LIMIT 1');
    echo "View v_santri_sedang_izin OK.\n";
} catch (\Exception $e) { echo "Error v_santri_sedang_izin: " . $e->getMessage() . "\n"; }

try {
    DB::select('SELECT * FROM v_akumulasi_poin_pelanggaran LIMIT 1');
    echo "View v_akumulasi_poin_pelanggaran OK.\n";
} catch (\Exception $e) { echo "Error v_akumulasi_poin_pelanggaran: " . $e->getMessage() . "\n"; }

try {
    // Insert prerequisite data
    DB::table('petugas')->insert(['nama' => 'Pencatat', 'username' => 'pencatat', 'password_hash' => 'hash']);
    $petugasId = DB::table('petugas')->where('username', 'pencatat')->value('petugas_id');
    DB::table('santri')->insert(['nama' => 'Santri 1', 'unit_id' => 1]);
    $santriId = DB::table('santri')->where('nama', 'Santri 1')->value('santri_id');
    DB::table('jadwal_kegiatan')->insert(['jenis_kegiatan_id' => 1, 'nama_jadwal' => 'Subuh', 'jam_mulai' => '04:00', 'jam_selesai' => '05:00']);
    $jadwalId = DB::table('jadwal_kegiatan')->where('nama_jadwal', 'Subuh')->value('jadwal_id');

    // Insert 1st row
    DB::table('absensi')->insert([
        'santri_id' => $santriId,
        'jenis_kegiatan_id' => 1,
        'jadwal_id' => $jadwalId,
        'tanggal' => '2026-07-29',
        'status' => 'Hadir',
        'diinput_oleh' => $petugasId
    ]);
    echo "Insert absensi 1 OK.\n";

    // Insert 2nd row (should fail)
    DB::table('absensi')->insert([
        'santri_id' => $santriId,
        'jenis_kegiatan_id' => 1,
        'jadwal_id' => $jadwalId,
        'tanggal' => '2026-07-29',
        'status' => 'Alpha',
        'diinput_oleh' => $petugasId
    ]);
    echo "Insert absensi 2 OK (UNEXPECTED!).\n";
} catch (\Exception $e) {
    if (strpos($e->getMessage(), 'uq_absensi') !== false || strpos($e->getMessage(), 'Duplicate entry') !== false) {
        echo "Insert absensi 2 GAGAL seperti yang diharapkan (Duplicate uq_absensi).\n";
    } else {
        echo "Error absensi: " . $e->getMessage() . "\n";
    }
}
