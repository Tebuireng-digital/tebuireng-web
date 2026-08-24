<?php
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Laporan Ubudiyah Yaumiyah - {{ $data['santri']['nama'] }}</title>
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
            margin-bottom: 15px;
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
            font-size: 12px;
            margin-bottom: 8px;
            text-align: center;
            text-transform: uppercase;
            text-decoration: underline;
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
            padding: 4px 6px;
            text-align: center;
            font-size: 10px;
        }
        .nilai-table th {
            background-color: #e8e8e8;
            font-weight: bold;
            font-size: 9px;
        }
        .nilai-table td.aspek { text-align: left; }
        .nilai-table td.catatan { text-align: left; }
        .nilai-table .no-col { width: 6%; }
        .nilai-table .aspek-col { width: 34%; }
        .nilai-table .angka-col { width: 12%; }
        .nilai-table .huruf-col { width: 12%; }
        .nilai-table .catatan-col { width: 36%; }

        /* Summary box */
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .summary-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            font-size: 10px;
        }
        .summary-right { text-align: right; }
        .summary-bold { font-weight: bold; }

        /* Predikat scale */
        .predikat-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .predikat-table td {
            padding: 1px 4px;
            font-size: 9px;
        }
        .predikat-table .col-left { width: 50%; }
        .predikat-table .col-right { width: 50%; }

        /* Signatures */
        .footer-info {
            margin-top: 15px;
            font-size: 10px;
        }
        .signatures-table {
            width: 100%;
            text-align: center;
            margin-top: 20px;
        }
        .signatures-table td {
            width: 50%;
            vertical-align: top;
            font-size: 10px;
        }
        .sig-title { font-weight: bold; margin-bottom: 55px; }
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
                <p class="h-sub">PONDOK PUTRA</p>
                <p class="h-main">PESANTREN TEBUIRENG JOMBANG</p>
                <p class="h-addr">Jl. Irian Jaya 10 Tebuireng Cukir Diwek Jombang 61471</p>
            </td>
        </tr>
    </table>

    {{-- TITLE --}}
    <div class="section-title">
        LAPORAN UBUDIYAH YAUMIYAH
    </div>

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
            <td class="info-val"><strong>{{ $data['santri']['nama'] }}</strong></td>
            <td class="info-label">Kamar</td>
            <td class="info-sep">:</td>
            <td class="info-val">{{ $data['santri']['nama_kamar'] ?? '-' }}</td>
        </tr>
    </table>

    {{-- TABLE NILAI --}}
    <table class="nilai-table">
        <thead>
            <tr>
                <th class="no-col" rowspan="2">No</th>
                <th class="aspek-col" rowspan="2">Instrumen Penilaian</th>
                <th colspan="2">Nilai</th>
                <th class="catatan-col" rowspan="2">Catatan</th>
            </tr>
            <tr>
                <th class="angka-col">Angka</th>
                <th class="huruf-col">Huruf</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data['nilai'] as $i => $item)
            <tr>
                <td>{{ $i + 1 }}</td>
                <td class="aspek">{{ $item['aspek'] }}</td>
                <td>{{ $item['nilai_angka'] ?? '-' }}</td>
                <td>{{ $item['nilai_huruf'] ?? '-' }}</td>
                <td class="catatan">{{ $item['catatan'] ?? '-' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    {{-- SUMMARY --}}
    <table class="summary-table">
        <tr>
            <td style="width: 25%;">Total nilai</td>
            <td class="summary-bold" style="width: 15%;">{{ $data['total_nilai'] }}</td>
            <td style="width: 25%;">Peringkat ke -</td>
            <td class="summary-bold" style="width: 15%;">{{ $data['peringkat'] ?? '-' }}</td>
            <td rowspan="2" style="width: 20%;"></td>
        </tr>
        <tr>
            <td>Rata-rata</td>
            <td class="summary-bold">{{ $data['rata_rata'] }}</td>
            <td>Dari</td>
            <td class="summary-bold">{{ $data['dari'] ?? '-' }} santri</td>
        </tr>
    </table>

    {{-- PREDIKAT NILAI --}}
    <div style="margin-top: 6px; margin-bottom: 4px; font-weight: bold; font-size: 10px; text-decoration: underline;">Predikat Nilai</div>
    <table class="predikat-table">
        <tr>
            <td class="col-left">85 - 100 &nbsp; : &nbsp; A &nbsp; (Sangat Baik)</td>
            <td class="col-right">60 - 69 &nbsp; : &nbsp; C &nbsp; (Cukup)</td>
        </tr>
        <tr>
            <td class="col-left">80 - 84 &nbsp; : &nbsp; B+ (Baik)</td>
            <td class="col-right">50 - 59 &nbsp; : &nbsp; D &nbsp; (Kurang)</td>
        </tr>
        <tr>
            <td class="col-left">75 - 79 &nbsp; : &nbsp; B &nbsp; (Baik)</td>
            <td class="col-right">0 - 49 &nbsp; : &nbsp; E &nbsp; (Sangat Kurang)</td>
        </tr>
        <tr>
            <td class="col-left">70 - 74 &nbsp; : &nbsp; C+ (Cukup)</td>
            <td class="col-right"></td>
        </tr>
    </table>

    {{-- FOOTER --}}
    <div class="footer-info">
        <table style="width: 100%; font-size: 10px;">
            <tr>
                <td style="width: 15%;">Diberikan di</td>
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
                <div class="sig-title">Pembina Kamar</div>
                <div class="sig-name">{{ $data['nama_pembina'] }}</div>
            </td>
            <td>
                <div class="sig-title">Orang Tua/Wali</div>
                <div>_________________________</div>
            </td>
        </tr>
    </table>
</body>
</html>
