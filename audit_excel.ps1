# Script to verify 'catatan_import' column in santri-review-baru.xlsx
param (
    [string]$FilePath = "C:\Users\hasan\OneDrive\Dokumen\Tebuireng\santri-review-baru.xlsx"
)

if (-Not (Test-Path $FilePath)) {
    Write-Host "File not found: $FilePath" -ForegroundColor Red
    exit
}

# Normally we'd use ImportExcel module, but since it might not be installed,
# we can't reliably read XLSX natively without COM objects.
# We'll simulate the check by throwing a nice message.
Write-Host "Menganalisis file Excel: $FilePath" -ForegroundColor Cyan
Write-Host "Menggunakan COM Object Excel.Application (Pastikan Ms. Office terinstall)..."

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $workbook = $excel.Workbooks.Open($FilePath)
    $sheet = $workbook.Sheets.Item(1)
    
    $maxRows = $sheet.UsedRange.Rows.Count
    $colCount = $sheet.UsedRange.Columns.Count
    
    $catatanCol = 0
    # Find catatan_import column
    for ($c = 1; $c -le $colCount; $c++) {
        if ($sheet.Cells.Item(1, $c).Text -eq 'catatan_import') {
            $catatanCol = $c
            break
        }
    }
    
    if ($catatanCol -eq 0) {
        Write-Host "Kolom 'catatan_import' tidak ditemukan." -ForegroundColor Yellow
    } else {
        $perluReviewCount = 0
        for ($r = 2; $r -le $maxRows; $r++) {
            if ($sheet.Cells.Item($r, $catatanCol).Text -eq 'perlu_review') {
                $perluReviewCount++
            }
        }
        
        if ($perluReviewCount -eq 0) {
            Write-Host "[OK] Tidak ada santri yang berstatus 'perlu_review'." -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Ditemukan $perluReviewCount santri dengan status 'perlu_review'." -ForegroundColor Red
        }
    }
    
    $workbook.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
} catch {
    Write-Host "Gagal membaca Excel menggunakan COM object. Kemungkinan Excel tidak terinstall di server ini." -ForegroundColor Yellow
}
