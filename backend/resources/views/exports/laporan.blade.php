<!DOCTYPE html>
<html>
<head>
    <title>{{ $judul ?? 'Laporan' }}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            line-height: 1.4;
        }
        
        /* Cover Page Styling */
        .cover-page {
            text-align: center;
            padding: 80px 40px;
            border: 4px double #0F6E56;
            margin: 20px;
            height: 740px;
            position: relative;
            page-break-after: always;
        }
        .cover-logo {
            max-height: 120px;
            margin-bottom: 40px;
        }
        .cover-title {
            font-size: 26px;
            font-weight: bold;
            color: #0F6E56;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 20px;
            margin-top: 40px;
        }
        .cover-subtitle {
            font-size: 16px;
            margin-bottom: 50px;
            color: #555;
        }
        .cover-period {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 150px;
            text-transform: uppercase;
        }
        .cover-footer {
            font-size: 16px;
            font-weight: bold;
            color: #0F6E56;
            letter-spacing: 1px;
            text-transform: uppercase;
            position: absolute;
            bottom: 60px;
            left: 0;
            width: 100%;
        }

        /* Report Table Styling */
        .report-section {
            padding: 20px;
        }
        .report-title {
            font-size: 18px;
            font-weight: bold;
            color: #0F6E56;
            border-bottom: 2px solid #0F6E56;
            padding-bottom: 8px;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th {
            background-color: #0F6E56;
            color: #ffffff;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            border: 1px solid #ddd;
            padding: 8px 6px;
            text-align: left;
        }
        td {
            border: 1px solid #ddd;
            padding: 8px 6px;
            font-size: 10px;
            text-align: left;
            word-wrap: break-word;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
    </style>
</head>
<body>
    {{-- COVER PAGE --}}
    <div class="cover-page">
        @if(file_exists(public_path('LOGO_TEBUIRENG_.jpg')))
            <img src="{{ public_path('LOGO_TEBUIRENG_.jpg') }}" class="cover-logo" alt="Logo">
        @else
            <div style="font-size: 28px; font-weight: bold; color: #0F6E56; margin-top: 50px; margin-bottom: 40px; letter-spacing: 2px;">SIMANTEB</div>
        @endif
        
        <div class="cover-title">
            {{ $judul ?? 'Laporan Detail' }}
        </div>
        <div class="cover-subtitle">
            Sistem Manajemen Kehadiran &amp; Tata Tertib Santri
        </div>
        
        <div class="cover-period">
            @if(isset($dari) && isset($sampai) && $dari && $sampai)
                PERIODE: {{ \Carbon\Carbon::parse($dari)->locale('id')->isoFormat('D MMMM YYYY') }} s/d {{ \Carbon\Carbon::parse($sampai)->locale('id')->isoFormat('D MMMM YYYY') }}
            @elseif(isset($bulan) && isset($tahun) && $bulan && $tahun)
                PERIODE: {{ \Carbon\Carbon::create()->month($bulan)->locale('id')->isoFormat('MMMM') }} {{ $tahun }}
            @else
                TANGGAL CETAK: {{ \Carbon\Carbon::now()->locale('id')->isoFormat('D MMMM YYYY') }}
            @endif
        </div>
        
        <div class="cover-footer">
            PONDOK PESANTREN TEBUIRENG JOMBANG<br>
            <span style="font-size: 11px; font-weight: normal; text-transform: none; color: #666;">Jl. Irian Jaya 10 Tebuireng Cukir Diwek Jombang 61471</span>
        </div>
    </div>
    
    {{-- REPORT CONTENT PAGE --}}
    <div class="report-section">
        <div class="report-title">
            {{ $judul ?? 'Laporan' }}
        </div>
        <table>
            <thead>
                <tr>
                    @if(count($data) > 0)
                        @foreach((array)$data[0] as $key => $value)
                            <th>{{ strtoupper(str_replace('_', ' ', $key)) }}</th>
                        @endforeach
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($data as $row)
                    <tr>
                        @foreach((array)$row as $value)
                            <td>{{ $value }}</td>
                        @endforeach
                    </tr>
                @endforeach
                @if(count($data) === 0)
                    <tr>
                        <td colspan="10" style="text-align: center; padding: 20px; color: #666; font-style: italic;">Tidak ada data untuk periode ini.</td>
                    </tr>
                @endif
            </tbody>
        </table>
    </div>
</body>
</html>
