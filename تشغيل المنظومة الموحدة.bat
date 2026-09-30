@echo off
chcp 65001 >nul
cd /d "D:\منظومة العدادت 2025"

:: 1. تشغيل السيرفر الداخلي في الخلفية صامتاً
start "" /min "C:\Program Files\nodejs\node.exe" "D:\منظومة العدادت 2025\serverWatchdog.js"

:: 2. فتح صفحة المنظومة الموحدة في المتصفح
timeout /t 1 /nobreak >nul
start "" "D:\منظومة العدادت 2025\المنظومة الموحدة للعدادات.html"

exit
