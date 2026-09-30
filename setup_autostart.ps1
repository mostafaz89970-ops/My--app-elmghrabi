# setup_autostart.ps1
# Adds serverWatchdog.js to Windows Startup folder (no Admin needed)
# Runs automatically at user login

$watchdogJs = Join-Path $PSScriptRoot "serverWatchdog.js"
$nodeExe    = (Get-Command node -ErrorAction SilentlyContinue).Source
$startupDir = [System.Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir "ElmaghraibiCardService.lnk"

if (-not $nodeExe) {
    Write-Host "[ERROR] Node.js not found in PATH." -ForegroundColor Red
    exit 1
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Elmaghrabi Card Service - Auto-Start Setup" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Create shortcut in Startup folder
$WScript = New-Object -ComObject WScript.Shell
$shortcut = $WScript.CreateShortcut($shortcutPath)
$shortcut.TargetPath    = $nodeExe
$shortcut.Arguments     = "`"$watchdogJs`""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.WindowStyle   = 7    # 7 = minimized (runs in background)
$shortcut.Description   = "Elmaghrabi Smart Card Service 2025"
$shortcut.Save()

Write-Host "[OK] Startup shortcut created:" -ForegroundColor Green
Write-Host "     $shortcutPath" -ForegroundColor White

# Also kill any existing watchdog/server and start fresh
Write-Host ""
Write-Host "[INFO] Starting service now..." -ForegroundColor Yellow
Start-Process -FilePath $nodeExe -ArgumentList "`"$watchdogJs`"" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden

Start-Sleep -Seconds 2

# Verify port is listening
$portCheck = netstat -aon | Select-String ":5002.*LISTENING"
if ($portCheck) {
    Write-Host "[OK] Server confirmed running on port 5002" -ForegroundColor Green
} else {
    Write-Host "[WARN] Server may still be starting..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "  Auto-start location: $startupDir" -ForegroundColor White
Write-Host ""
Write-Host "  The service will start automatically at every login." -ForegroundColor White
Write-Host "  To remove: Delete file:" -ForegroundColor Gray
Write-Host "    $shortcutPath" -ForegroundColor Gray
Write-Host "======================================================" -ForegroundColor Cyan
