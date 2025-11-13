# Script tự động restart server sau khi build React app

Write-Host "🔄 Đang tìm và dừng process Node.js..." -ForegroundColor Yellow

# Tìm và dừng tất cả process node
Get-Process | Where-Object {$_.ProcessName -eq "node"} | ForEach-Object {
    Write-Host "  ⏹️  Đang dừng process ID: $($_.Id)" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force
}

Start-Sleep -Seconds 2

Write-Host "`n✅ Đã dừng server cũ!" -ForegroundColor Green
Write-Host "🚀 Khởi động server mới...`n" -ForegroundColor Cyan

# Chuyển về thư mục gốc và khởi động server
Set-Location "D:\Demo\MyMap"
npm start
