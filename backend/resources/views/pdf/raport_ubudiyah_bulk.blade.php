<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Laporan Ubudiyah Yaumiyah - Bulk</title>
</head>
<body>
@foreach($allPages as $index => $data)
    @if($index > 0)
        <div style="page-break-before: always;"></div>
    @endif
    @include('pdf.raport_ubudiyah', ['data' => $data])
@endforeach
</body>
</html>
