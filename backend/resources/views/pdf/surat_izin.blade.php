<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #000;
            line-height: 1.5;
            margin: 0;
            padding: 10px;
        }
        .header-table {
            width: 100%;
            border-bottom: 3px double #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .logo-cell {
            width: 15%;
            text-align: center;
            vertical-align: middle;
        }
        .logo-img {
            max-height: 75px;
            max-width: 75px;
        }
        .header-cell {
            width: 85%;
            text-align: center;
            vertical-align: middle;
        }
        .header-cell h2 {
            margin: 0;
            font-size: 15px;
            font-weight: normal;
            letter-spacing: 0.5px;
        }
        .header-cell h1 {
            margin: 4px 0 0 0;
            font-size: 22px;
            font-weight: bold;
            letter-spacing: 1px;
        }
        .header-cell p {
            margin: 4px 0 0 0;
            font-size: 11px;
            color: #333;
        }
        .title {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 25px;
            margin-top: 10px;
            letter-spacing: 1px;
        }
        .section-label {
            font-weight: bold;
            margin-bottom: 10px;
        }
        .content-table {
            width: 100%;
            border-collapse: collapse;
        }
        .content-table td {
            padding: 8px 4px;
            vertical-align: top;
        }
        .content-table td.label {
            width: 28%;
        }
        .content-table td.separator {
            width: 4%;
            text-align: center;
        }
        .content-table td.value {
            width: 68%;
            border-bottom: 1px dotted #888;
        }
        .signatures-table {
            width: 100%;
            text-align: center;
            margin-top: 30px;
            margin-bottom: 30px;
        }
        .signatures-table td {
            width: 50%;
            vertical-align: top;
        }
        .signature-title {
            font-weight: bold;
            margin-bottom: 65px;
        }
        .notes {
            margin-top: 40px;
            font-size: 11px;
            border-top: 1px dashed #aaa;
            padding-top: 10px;
        }
        .notes-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .notesol {
            margin: 0;
            padding-left: 15px;
        }
        .notesol li {
            margin-bottom: 3px;
        }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td class="logo-cell">
                @if(file_exists(public_path('LOGO_TEBUIRENG_.jpg')))
                    <img src="{{ public_path('LOGO_TEBUIRENG_.jpg') }}" class="logo-img" alt="Logo">
                @endif
            </td>
            <td class="header-cell">
                <h2>MAJELIS AMNI</h2>
                <h1>TEBUIRENG</h1>
                <p>Sekretariat: Jl. Irian Jaya No. 10 Tebuireng, Diwek, Jombang, Jawa Timur 61471</p>
            </td>
        </tr>
    </table>

    <div class="title">{{ $title }}</div>

    <table style="width: 100%; margin-bottom: 25px;">
        <tr>
            <td style="width: 72%; vertical-align: top;">
                <div class="section-label">Yang meminta izin :</div>
                <table class="content-table">
                    <tr>
                        <td class="label">Nama</td>
                        <td class="separator">:</td>
                        <td class="value"><strong>{{ $perizinan->nama_santri }}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">Asrama</td>
                        <td class="separator">:</td>
                        <td class="value">{{ $perizinan->nama_kamar ?? 'Kamar belum ditentukan' }}</td>
                    </tr>
                    <tr>
                        <td class="label">Alasan</td>
                        <td class="separator">:</td>
                        <td class="value">{{ $perizinan->keperluan }}</td>
                    </tr>
                    <tr>
                        <td class="label">{{ $labelKeluar }}</td>
                        <td class="separator">:</td>
                        <td class="value">{{ $waktuKeluarStr }}</td>
                    </tr>
                    <tr>
                        <td class="label">{{ $labelMasuk }}</td>
                        <td class="separator">:</td>
                        <td class="value"><strong>{{ $waktuMasukStr }}</strong></td>
                    </tr>
                </table>
            </td>
            <td style="width: 28%; text-align: center; vertical-align: middle; padding-left: 15px;">
                @if(isset($qrCodeUrl))
                    <img src="{{ $qrCodeUrl }}" style="width: 120px; height: 120px; border: 1px solid #ddd; padding: 4px;" alt="QR Code">
                    <div style="font-size: 9px; color: #555; margin-top: 5px;">Scan untuk verifikasi</div>
                @endif
            </td>
        </tr>
    </table>

    <div style="text-align: center; font-weight: bold; margin-bottom: 15px;">Diketahui:</div>
    
    <table class="signatures-table">
        <tr>
            <td>
                <div class="signature-title">Keamanan / Admin</div>
                <div>( {{ $perizinan->nama_keamanan ?? '....................................' }} )</div>
            </td>
            <td>
                <div class="signature-title">Petugas Pengaju</div>
                <div>( {{ $perizinan->nama_pengaju ?? '....................................' }} )</div>
            </td>
        </tr>
    </table>

    <div class="notes">
        <div class="notes-title">Catatan:</div>
        <ol class="notesol">
            <li>Surat izin ini harus dikembalikan oleh yang bersangkutan ke sie keamanan saat kembali.</li>
            <li>Apabila tidak bisa datang pada waktu yang telah ditetapkan harap menghubungi pihak pesantren.</li>
        </ol>
    </div>
</body>
</html>
