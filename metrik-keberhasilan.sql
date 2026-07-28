-- Metrik Keberhasilan: Persentase Absensi Diinput Tepat Waktu (Sebelum Jam Selesai KBM)

-- 1. Mengukur persentase absensi sekolah yang diinput sebelum jam selesai kelas
WITH AbsensiValid AS (
    SELECT 
        a.absensi_id,
        a.created_at,
        j.jam_selesai
    FROM absensi a
    JOIN jadwal_sekolah j ON a.jadwal_sekolah_id = j.jadwal_sekolah_id
    WHERE a.jenis = 'Sekolah'
),
Kalkulasi AS (
    SELECT 
        COUNT(*) as total_absensi,
        SUM(CASE WHEN TIME(created_at) <= jam_selesai THEN 1 ELSE 0 END) as total_tepat_waktu
    FROM AbsensiValid
)
SELECT 
    total_absensi,
    total_tepat_waktu,
    ROUND((total_tepat_waktu * 100.0) / NULLIF(total_absensi, 0), 2) AS persentase_tepat_waktu
FROM Kalkulasi;
