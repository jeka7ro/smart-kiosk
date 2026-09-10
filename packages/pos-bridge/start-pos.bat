@echo off
color 0A
title Smart Kiosk POS Bridge
echo ==========================================
echo    UPDATE AUTOMAT POS BRIDGE (SMART KIOSK)
echo ==========================================
echo.
echo Se descarca ultima versiune din Cloud...
echo.

:: Descarcă ultima versiune a fișierelor
curl -s -L -o index.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js"
curl -s -L -o PrinterServiceDatecsFP950.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/PrinterServiceDatecsFP950.js"
curl -s -L -o VivaPosService.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/VivaPosService.js"

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
