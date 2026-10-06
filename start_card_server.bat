@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "NODE_EXE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
    echo [ERROR] Node.js is not installed or is not available in PATH.
    echo Install Node.js LTS, then run this file again.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:5002/api/status' -TimeoutSec 2; if ($r.success) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -State Listen -LocalPort 5002 -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Port 5002 is occupied by another application. No process was stopped.
        pause
        exit /b 1
    )
    echo Starting the local reports server...
    start "" /min "%NODE_EXE%" "%~dp0serverWatchdog.js"
) else (
    echo The local reports server is already running.
)

set /a "ATTEMPTS=0"
:wait_for_server
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:5002/api/status' -TimeoutSec 2; if ($r.success) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto server_ready
set /a "ATTEMPTS+=1"
if %ATTEMPTS% GEQ 15 (
    echo [ERROR] The reports server did not start. Check watchdog.log for details.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait_for_server

:server_ready
echo [OK] The local reports server is ready at http://127.0.0.1:5002
start "" "https://mostafaz89970-ops.github.io/My--app-elmghrabi/"
endlocal
exit /b 0
