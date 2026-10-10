@echo off
chcp 65001 >nul
title Smart Kiosk - POS Bridge Constanta (COM7 + XP-80)
color 0A

cd /d "%~dp0"

if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [EROARE CRITICA] Node.js nu este gasit in sistem!
    echo Te rugam sa instalezi Node.js de la https://nodejs.org
    pause
    exit /b 1
)

if not exist ".env" (
    echo [INFO] Creez fisierul .env...
    (
        echo RENDER_URL=https://smart-kiosk-ttut.onrender.com
        echo COM_PORT=COM7
        echo BAUD_RATE=9600
        echo LOCATION_ID=constanta1
        echo BRIDGE_KEY=pos-bridge-2024
        echo POS_GATEWAY=raiffeisen
        echo PRINTER_NAME=XP-80
    ) > .env
)

if not exist "node_modules\dotenv" (
    echo [INFO] Instalez dependentele necesare...
    call npm install --no-audit --no-fund
)

:loop
echo.
echo =========================================================
echo   SMART KIOSK - POS ^& PRINTER BRIDGE CONSTANTA
echo   POS: COM7 ^| Imprimanta: XP-80 ^| Locatie: constanta1
echo =========================================================
echo [INFO] Pornesc POS Bridge...
node index.js
echo.
echo [ATENTIE] Node.js s-a oprit (cod %errorlevel%). Repornesc in 3 secunde...
timeout /t 3 /nobreak >nul
goto loop
