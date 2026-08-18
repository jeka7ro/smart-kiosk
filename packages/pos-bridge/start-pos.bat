@echo off
color 0A
title Smart Kiosk POS Bridge
echo ==========================================
echo    UPDATE AUTOMAT POS BRIDGE (SMART KIOSK)
echo ==========================================
echo.
echo Se descarca ultima versiune din Cloud...
echo.

:: Descarcă ultima versiune a fișierului index.js
curl -s -L -o index.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js"

:: Crează folderul viva dacă nu există și descarcă serviciul
if not exist "viva" mkdir viva
curl -s -L -o viva/VivaPosService.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/viva/VivaPosService.js"
curl -s -L -o viva/PrinterServiceDatecsFP950.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/viva/PrinterServiceDatecsFP950.js"

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
