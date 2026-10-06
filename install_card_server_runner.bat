@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or is not available in PATH.
    echo Install Node.js LTS before installing the server runner.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$startup = [Environment]::GetFolderPath('Startup'); $shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut((Join-Path $startup 'Unified Counter System - Reports Server.lnk')); $shortcut.TargetPath = Join-Path '%~dp0' 'start_card_server.bat'; $shortcut.WorkingDirectory = '%~dp0'; $shortcut.Save()"
if errorlevel 1 (
    echo [ERROR] Could not create the current-user startup shortcut.
    pause
    exit /b 1
)

echo [OK] The reports server will start when you sign in to Windows.
echo It will not open the MEEDCO, Maasara, or Iskra applications.
endlocal
