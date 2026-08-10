<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Raport Pengajian - {{ $data['santri']['nama'] }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            color: #000;
            line-height: 1.4;
            padding: 15px 25px;
        }

        /* Header */
        .header-table {
            width: 100%;
            border-bottom: 3px double #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
        }
        .logo-cell {
            width: 12%;
            text-align: center;
            vertical-align: middle;
        }
        .logo-img {
            max-height: 60px;
            max-width: 60px;
        }
        .header-cell {
            width: 88%;
            text-align: center;
            vertical-align: middle;
        }
        .header-cell .h-sub {
            font-size: 11px;
            font-weight: bold;
            letter-spacing: 1px;
            margin: 0;
        }
        .header-cell .h-main {
            font-size: 16px;
            font-weight: bold;
            letter-spacing: 2px;
            margin: 2px 0;
        }
        .header-cell .h-addr {
            font-size: 9px;
            color: #333;
            margin: 0;
        }

        /* Info santri */
        .info-table {
            width: 100%;
            margin-bottom: 12px;
        }
        .info-table td {
            padding: 2px 0;
            vertical-align: top;
            font-size: 11px;
        }
        .info-label { width: 22%; }
        .info-sep { width: 3%; text-align: center; }
        .info-val { width: 25%; }

        /* Section */
        .section-title {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 4px;
            margin-top: 8px;
        }
        .section-group {
            float: right;
            font-weight: normal;
        }

        /* Tabel Nilai */
        .nilai-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
        }
        .nilai-table th,
        .nilai-table td {
            border: 1px solid #000;
            padding: 3px 5px;
            text-align: center;
            font-size: 10px;
        }
        .nilai-table th {
            background-color: #e8e8e8;
            font-weight: bold;
            font-size: 9px;
        }
        .nilai-table td.aspek { text-align: left; }
        .nilai-table .no-col { width: 6%; }
        .nilai-table .aspek-col { width: 25%; }
        .nilai-table .angka-col { width: 14%; }
        .nilai-table .predikat-col { width: 27%; }
        .nilai-table .rata-col { width: 18%; }

        /* Summary box */
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
        }
        .summary-table td {
            border: 1px solid #000;
            padding: 3px 6px;
            font-size: 10px;
        }
        .summary-right { text-align: right; }
        .summary-bold { font-weight: bold; }

        /* Keputusan */
        .keputusan-box {
            border: 1px solid #000;
            padding: 4px 6px;
            font-size: 10px;
            margin-bottom: 10px;
        }
        .keputusan-bold { font-weight: bold; }

        /* Predikat scale */
        .predikat-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }
        .predikat-table td {
            padding: 1px 4px;
            font-size: 9px;
        }
        .predikat-table .col-left { width: 50%; }
        .predikat-table .col-right { width: 50%; }

        /* Kepribadian */
        .kepribadian-table {
            width: 70%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }
        .kepribadian-table th,
        .kepribadian-table td {
            border: 1px solid #000;
            padding: 3px 5px;
            text-align: center;
            font-size: 10px;
        }
        .kepribadian-table th {
            background-color: #e8e8e8;
            font-weight: bold;
            font-size: 9px;
        }
        .kepribadian-table td.jenis { text-align: left; }
        .predikat-umum-cell {
            font-weight: bold;
            font-size: 11px;
        }

        /* Signatures */
        .footer-info {
            margin-top: 12px;
            font-size: 10px;
        }
        .signatures-table {
            width: 100%;
            text-align: center;
            margin-top: 15px;
        }
        .signatures-table td {
            width: 33.33%;
            vertical-align: top;
            font-size: 10px;
        }
        .sig-title { font-weight: bold; margin-bottom: 50px; }
        .sig-name { font-weight: bold; text-decoration: underline; }

        .clearfix::after {
            content: "";
            display: table;
            clear: both;
        }
    </style>
</head>
<body>
    {{-- HEADER --}}
    <table class="header-table">
        <tr>
            <td class="logo-cell">
                @if(file_exists(public_path('LOGO_TEBUIRENG_.jpg')))
                    <img src="{{ public_path('LOGO_TEBUIRENG_.jpg') }}" class="logo-img" alt="Logo">
                @endif
            </td>
            <td class="header-cell">
                <p class="h-sub">MAJELIS ILMI PONDOK PUTRA</p>
                <p class="h-main">PESANTREN TEBUIRENG JOMBANG</p>
                <p class="h-addr">Jl. Irian Jaya 10 Tebuireng Cukir Diwek Jombang 61471</p>
            </td>
        </tr>
    </table>

    {{-- INFO SANTRI --}}
    <table class="info-table">
        <tr>
            <td class="info-label">Tahun Pelajaran</td>
            <td class="info-sep">:</td>
            <td class="info-val">{{ $data['tahun_pelajaran'] }}</td>
            <td class="info-label">Semester</td>
            <td class="info-sep">:</td>
            <td class="info-val">{{ $data['semester'] }}</td>
        </tr>
        <tr>
            <td class="info-label">Nomor Induk</td>
            <td class="info-sep">:</td>
            <td class="info-val">{{ $data['santri']['nis'] ?? '-' }}</td>
            <td class="info-label">Kelas Formal</td>
            <td class="info-sep">:</td>
            <td class="info-val">{{ $data['santri']['tingkat'] ? $data['santri']['tingkat'] . ' ' . ($data['santri']['nama_kelas'] ?? '') : '-' }}</td>
        </tr>
        <tr>
            <td class="info-label">Nama Santri</td>
            <td class="info-sep">:</td>
            <td class="info-val" colspan="1"><strong>{{ $data['santri']['nama'] }}</strong></td>
            <td class="info-label">Kamar</td>
            <td class="info-sep">:</td>
            <td class="info-val">{{ $data['santri']['nama_kamar'] ?? '-' }}</td>
        </tr>
    </table>

    {{-- A. PENGAJIAN AL QUR'AN --}}
    <div class="section-title clearfix">
        A. Pengajian Al Qur'an
        <span class="section-group">Kelompok &nbsp;: &nbsp;{{ $data['al_quran']['kelompok'] ?? '-' }}</span>
    </div>
    <table class="nilai-table">
        <thead>
            <tr>
                <th class="no-col" rowspan="2">No</th>
                <th class="aspek-col" rowspan="2">Aspek Penilaian</th>
                <th colspan="2">Nilai</th>
                <th class="rata-col" rowspan="2">Rata-rata<br>kelompok</th>
            </tr>
            <tr>
                <th class="angka-col">Angka</th>
                <th class="predikat-col">Predikat</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data['al_quran']['nilai'] as $i => $item)
            <tr>
                <td>{{ $i + 1 }}</td>
                <td class="aspek">{{ $item['aspek'] }}</td>
                <td>{{ $item['nilai_angka'] ?? '-' }}</td>
                <td>{{ $item['predikat'] ?? '-' }}</td>
                <td>{{ $item['rata_rata_kelompok'] ?? '-' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <table class="summary-table">
        <tr>
            <td style="width: 20%;">Total nilai</td>
            <td class="summary-bold" style="width: 20%;">{{ $data['al_quran']['total_nilai'] }}</td>
            <td style="width: 20%;">Peringkat ke -</td>
            <td class="summary-bold" style="width: 10%;">{{ $data['al_quran']['peringkat'] ?? '-' }}</td>
            <td rowspan="2" style="width: 30%;"></td>
        </tr>
        <tr>
            <td>Rata-rata</td>
            <td class="summary-bold">{{ $data['al_quran']['rata_rata'] }}</td>
            <td>Dari</td>
            <td class="summary-bold">{{ $data['al_quran']['dari'] ?? '-' }} santri</td>
        </tr>
    </table>

    <div class="keputusan-box">
        <strong>Keputusan</strong> &nbsp; Berdasarkan hasil yang dicapai dan keputusan rapat dewan guru pengajian Al Qur'an, santri dinyatakan : &nbsp; <span class="keputusan-bold">{{ $data['al_quran']['keputusan'] ?? '-' }}</span>
    </div>

    {{-- B. PENGAJIAN TAKHASSUS --}}
    <div class="section-title clearfix">
        B. Pengajian Takhassus
        <span class="section-group">Kelompok &nbsp;: &nbsp;{{ $data['takhassus']['kelompok'] ?? '-' }}</span>
    </div>
    <table class="nilai-table">
        <thead>
            <tr>
                <th class="no-col" rowspan="2">No</th>
                <th class="aspek-col" rowspan="2">Aspek Penilaian</th>
                <th colspan="2">Nilai</th>
                <th class="rata-col" rowspan="2">Rata-rata<br>kelompok</th>
            </tr>
            <tr>
                <th class="angka-col">Angka</th>
                <th class="predikat-col">Predikat</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data['takhassus']['nilai'] as $i => $item)
            <tr>
                <td>{{ $i + 1 }}</td>
                <td class="aspek">{{ $item['aspek'] }}</td>
                <td>{{ $item['nilai_angka'] ?? '-' }}</td>
                <td>{{ $item['predikat'] ?? '-' }}</td>
                <td>{{ $item['rata_rata_kelompok'] ?? '-' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <table class="summary-table">
        <tr>
            <td style="width: 20%;">Total nilai</td>
            <td class="summary-bold" style="width: 20%;">{{ $data['takhassus']['total_nilai'] }}</td>
            <td style="width: 20%;">Peringkat ke -</td>
            <td class="summary-bold" style="width: 10%;">{{ $data['takhassus']['peringkat'] ?? '-' }}</td>
            <td rowspan="2" style="width: 30%;"></td>
        </tr>
        <tr>
            <td>Rata-rata</td>
            <td class="summary-bold">{{ $data['takhassus']['rata_rata'] }}</td>
            <td>Dari</td>
            <td class="summary-bold">{{ $data['takhassus']['dari'] ?? '-' }} santri</td>
        </tr>
    </table>

    <div class="keputusan-box">
        <strong>Keputusan</strong> &nbsp; Berdasarkan hasil yang dicapai dan keputusan rapat dewan guru pengajian Takhassus, santri dinyatakan : &nbsp; <span class="keputusan-bold">{{ $data['takhassus']['keputusan'] ?? '-' }}</span>
    </div>

    {{-- PREDIKAT NILAI --}}
    <div style="margin-top: 6px; margin-bottom: 4px; font-weight: bold; font-size: 10px; text-decoration: underline;">Predikat Nilai</div>
    <table class="predikat-table">
        <tr>
            <td class="col-left">90 - 100 &nbsp; : &nbsp; Sangat Memuaskan</td>
            <td class="col-right">60 - 69 &nbsp; : &nbsp; Cukup</td>
        </tr>
        <tr>
            <td class="col-left">80 - 89 &nbsp; : &nbsp; Memuaskan</td>
            <td class="col-right">50 - 59 &nbsp; : &nbsp; Kurang</td>
        </tr>
        <tr>
            <td class="col-left">70 - 79 &nbsp; : &nbsp; Baik</td>
            <td class="col-right">0 - 49 &nbsp; : &nbsp; Sangat Kurang</td>
        </tr>
    </table>

    {{-- KEPRIBADIAN --}}
    <table class="kepribadian-table">
        <thead>
            <tr>
                <th style="width: 6%;">No</th>
                <th style="width: 25%;">Kepribadian</th>
                <th style="width: 10%;">Nilai</th>
                <th style="width: 22%;">Keterangan</th>
                <th style="width: 20%;">Predikat umum</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data['kepribadian'] as $i => $k)
            <tr>
                <td>{{ $i + 1 }}</td>
                <td class="jenis">{{ $k['jenis'] }}</td>
                <td>{{ $k['nilai'] ?? '-' }}</td>
                <td>{{ $k['keterangan'] ?? '-' }}</td>
                @if($i === 0)
                    <td rowspan="{{ count($data['kepribadian']) }}" class="predikat-umum-cell">{{ $data['predikat_umum'] ?? '-' }}</td>
                @endif
            </tr>
            @endforeach
        </tbody>
    </table>

    {{-- FOOTER --}}
    <div class="footer-info">
        <table style="width: 100%; font-size: 10px;">
            <tr>
                <td>Diberikan di</td>
                <td>: &nbsp; Tebuireng</td>
            </tr>
            <tr>
                <td>Tanggal</td>
                <td>: &nbsp; {{ \Carbon\Carbon::now()->locale('id')->isoFormat('D MMMM YYYY') }}</td>
            </tr>
        </table>
    </div>

    <table class="signatures-table">
        <tr>
            <td>
                <div class="sig-title">Kepala Pondok</div>
                <div>_________________________</div>
            </td>
            <td>
                <div class="sig-title">Koord. Majelis Ilmi</div>
                <div>_________________________</div>
            </td>
            <td>
                <div class="sig-title">Orang Tua/Wali</div>
                <div>_________________________</div>
            </td>
        </tr>
    </table>
</body>
</html>
