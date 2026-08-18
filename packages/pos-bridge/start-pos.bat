@echo off
color 0A
title Smart Kiosk POS Bridge
echo ==========================================
echo    UPDATE AUTOMAT POS BRIDGE (SMART KIOSK)
echo ==========================================
echo.
echo Se descarca ultima versiune din Cloud...
echo.

:: Descarcă ultima versiune a fișierului index.js direct din GitHub (branch-ul main)
curl -s -L -o index.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js"

if %errorlevel% neq 0 (
    color 0C
    echo ❌ EROARE: Nu s-a putut descarca fisierul! Verifica conexiunea la internet.
    pause
    exit /b
)

echo ✅ Update descarcat cu succes!
echo ==========================================
echo Pornesc POS Bridge...
echo.
node index.js
pause
