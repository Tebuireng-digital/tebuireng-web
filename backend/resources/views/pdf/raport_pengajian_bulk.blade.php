<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Raport Pengajian - Bulk</title>
</head>
<body>
@foreach($allPages as $index => $data)
    @if($index > 0)
        <div style="page-break-before: always;"></div>
    @endif
    @include('pdf.raport_pengajian', ['data' => $data, 'predikatMap' => $predikatMap, 'kepribadianMap' => $kepribadianMap])
@endforeach
</body>
</html>
