# Analisis Mapping Data Santri ke Lima Kegiatan Absensi

Tanggal analisis: 9 Agustus 2026

## Cakupan dan cara baca

Analisis ini membandingkan `new data/data_santri_semua.xls` dengan lima workbook roster sumber. Ini **belum** menggambarkan database aktif karena import baru belum dijalankan.

Pencocokan otomatis memakai nama yang dinormalisasi (huruf besar, tanda baca dan spasi diabaikan). Baris hanya dihitung sebagai cocok jika nama tersebut menunjuk tepat ke satu santri pada data utama. Karena roster lama tidak memiliki No. ID yang sama dengan data baru, angka ini adalah baseline untuk antrean verifikasi, bukan hasil mapping final.

## Visual cakupan keseluruhan

```text
Data santri semua                                             4.889
├─ Ditemukan pada minimal satu roster kegiatan                1.874  (38,3%)
│  ├─ Ada pada 1 kegiatan                                        219
│  ├─ Ada pada 2 kegiatan                                         94
│  ├─ Ada pada 3 kegiatan                                        374
│  ├─ Ada pada 4 kegiatan                                        770
│  └─ Ada pada seluruh 5 kegiatan                                417
└─ Belum ditemukan pada roster sumber mana pun                3.015  (61,7%)
```

`Belum ditemukan` tidak berarti santri tidak aktif atau alumni. Kemungkinan penyebabnya adalah roster sumber belum mencakup seluruh santri, perbedaan tahun ajaran, perubahan nama, atau santri memang belum ditetapkan ke kegiatannya.

## Mapping per kegiatan

| Kegiatan | Baris roster sumber | Santri utama yang termapping otomatis | Belum termapping dari data santri utama | Nama ambigu di data utama | Baris roster tidak ditemukan |
|---|---:|---:|---:|---:|---:|
| Kamar | 1.376 | 1.275 (26,1%) | 3.614 | 3 | 98 |
| Sekolah formal | 773 | 609 (12,5%) | 4.280 | 2 | 162 |
| Madin | 1.783 | 1.648 (33,7%) | 3.241 | 5 | 123 |
| Al-Qur'an Subuh | 1.720 | 1.577 (32,3%) | 3.312 | 5 | 132 |
| Takhasus Maghrib | 1.791 | 1.585 (32,4%) | 3.304 | 5 | 181 |

Visual jumlah santri yang termapping:

```text
Kamar              1.275  █████████████░░░░░░░░░░░░░░░░░░░░░░░░ 26,1%
Sekolah formal       609  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 12,5%
Madin              1.648  █████████████████░░░░░░░░░░░░░░░░░░ 33,7%
Al-Qur'an Subuh    1.577  ████████████████░░░░░░░░░░░░░░░░░░░ 32,3%
Takhasus Maghrib   1.585  ████████████████░░░░░░░░░░░░░░░░░░░ 32,4%
```

## Implikasi untuk absensi dan rapor

1. Data `data_santri_semua` harus menjadi master identitas/profil, tetapi belum menggantikan roster kegiatan.
2. Satu `santri_id` internal tetap menjadi penghubung absensi, pelanggaran, perizinan, dan rapor.
3. Setiap kegiatan harus memiliki mapping ke `santri_id`; mapping yang belum pasti masuk antrean **Verifikasi Santri**.
4. Santri yang belum termapping tidak boleh otomatis dicatat alfa dan tidak boleh otomatis dipindahkan ke alumni.
5. Untuk sekolah formal, kelas perlu dibentuk dari kombinasi `Pend + Kls` pada data santri utama agar tidak hanya mencakup SMP tingkat 7–9.

## Tindak lanjut yang disarankan

1. Import profil lengkap dari `data_santri_semua` setelah migrasi database.
2. Bentuk seluruh master kelas formal dari `Pend + Kls` dan hubungkan setiap santri aktif ke kelasnya.
3. Gunakan halaman **Data Master → Verifikasi Santri** untuk melengkapi kelas, Madin, Al-Qur'an Subuh, Takhasus, ORDA, dan data identitas yang belum pasti.
4. Simpan keputusan mapping ke `santri_roster_mappings`; jangan mengandalkan pencocokan nama kembali setiap kali import.
5. Jadikan laporan ini baseline. Setelah mapping dijalankan, buat ulang analisis dan targetkan tidak ada roster yang belum memiliki `santri_id`.

## Keputusan implementasi

- Seluruh kode `Pend` diperlakukan sebagai unit formal yang terpisah: `MTS`, `MTSS`, `SMP`, `SMPT`, `SMA`, `SMAT`, `SMK`, `MA`, `MAS`, `MU`, dan `THS`.
- Setiap santri aktif wajib memiliki satu kelas formal yang dibentuk dari kombinasi `Pend + Kls`.
- Keikutsertaan kamar, Madin, Al-Qur'an Subuh, dan Takhasus Maghrib harus diputuskan eksplisit: `terdaftar`, `tidak_ikut`, atau `perlu_verifikasi`.
