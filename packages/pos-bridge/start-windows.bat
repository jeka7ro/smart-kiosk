@echo off
title Smart Kiosk — POS Bridge Raiffeisen
color 0A
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   SMART KIOSK — POS Bridge Raiffeisen   ║
echo  ╚══════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Verifica daca Node.js e instalat
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo  [EROARE] Node.js nu este instalat!
    echo  Descarca de la: https://nodejs.org/en/download
    echo.
    pause
    exit /b 1
)

echo  [INFO] Verific actualizari din Cloud...
curl -s -L -o index.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js"
if not exist "viva" mkdir viva
curl -s -L -o viva/VivaPosService.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/viva/VivaPosService.js"
curl -s -L -o viva/PrinterServiceDatecsFP950.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/viva/PrinterServiceDatecsFP950.js"
echo  [INFO] Fisiere descarcate/actualizate!

:: Verifica daca exista .env
if not exist ".env" (
    color 0E
    echo  [ATENTIE] Fisierul .env nu exista!
    echo  Copiaza .env.example ca .env si configureaza-l.
    echo.
    pause
    exit /b 1
)

:: Instaleaza dependentele daca lipsesc
if not exist "node_modules" (
    echo  [INFO] Prima pornire - instalez dependentele...
    npm install
    echo.
)

echo  [INFO] Pornesc POS Bridge din folderul curent: %~dp0
echo  [INFO] Apasa Ctrl+C pentru a opri
echo.

:loop
node index.js
echo.
echo  [WARN] Bridge oprit - repornesc in 5 secunde...
timeout /t 5 /nobreak >nul
goto loop
