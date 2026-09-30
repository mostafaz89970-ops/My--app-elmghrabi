@echo off
setlocal EnableDelayedExpansion
title منظومة العدادات 2025 - خدمة الكروت
cd /d "%~dp0"

:: ─── فحص Node.js ────────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js غير موجود. يرجى تثبيته اولا.
    pause
    exit /b 1
)

:: ─── تحقق من عدم وجود نسخة اخرى تعمل ──────────────────────────────────────
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5002.*LISTENING"') do (
    set "existPid=%%a"
)
if defined existPid (
    echo [INFO] الخدمة تعمل بالفعل على port 5002 ^(PID: !existPid!^)
    echo [INFO] لا حاجة لإعادة التشغيل.
    goto :end
)

:: ─── تشغيل الـ Watchdog (يدير السيرفر ويراقبه) ──────────────────────────────
echo ═══════════════════════════════════════════════════
echo   منظومة العدادات 2025 — خدمة الكروت الذكية
echo   الـ Watchdog يبدأ ويراقب السيرفر تلقائياً
echo ═══════════════════════════════════════════════════
echo.

:: تشغيل Watchdog في نافذة مخفية (لا تزعج المستخدم)
start "" /B /MIN node "%~dp0serverWatchdog.js"

echo [OK] خدمة الكروت والمراقبة بدأت بنجاح في الخلفية.
echo.

:end
endlocal
