<!DOCTYPE html>
<html>
<head>
    <title>Laporan</title>
    <style>
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid black;
            padding: 8px;
            text-align: left;
        }
    </style>
</head>
<body>
    <h2>{{ $judul ?? 'Laporan' }}</h2>
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
        </tbody>
    </table>
</body>
</html>
