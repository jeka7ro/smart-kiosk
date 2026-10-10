@echo off
chcp 65001 >nul
title Smart Kiosk - POS Bridge Constanta (COM7 + XP-80)
color 0A
echo.
echo =========================================================
echo   SMART KIOSK - POS & PRINTER BRIDGE CONSTANTA
echo   POS: COM7 ^| Imprimanta: XP-80 ^| Locatie: constanta1
echo =========================================================
echo.

cd /d "%~dp0"

if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"

:: Verifica daca Node.js e instalat
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [EROARE CRITICA] Node.js nu este gasit in sistem!
    echo Te rugam sa instalezi Node.js de la https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Verifica daca exista fisierul .env
if not exist ".env" (
    color 0E
    echo [ATENTIE] Creez fisierul .env pentru Constanta...
    (
        echo RENDER_URL=https://smart-kiosk-ttut.onrender.com
        echo COM_PORT=COM7
        echo BAUD_RATE=9600
        echo LOCATION_ID=constanta1
        echo BRIDGE_KEY=pos-bridge-2024
        echo POS_GATEWAY=raiffeisen
        echo PRINTER_NAME=XP-80
    ) > .env
    echo [OK] Fisierul .env a fost creat!
    echo.
)

:: Instaleaza dependentele daca lipsesc
if not exist "node_modules\dotenv" (
    echo [INFO] Instalez dependentele necesare (serialport, dotenv, socket.io-client)...
    call npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        color 0C
        echo [EROARE] Instalarea dependentelor npm a esuat!
        pause
    )
    echo.
)

:: Curatare procese vechi si deblocare coada imprimanta XP-80
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*index.js*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue; if ($_.Name -like '*XP-80*' -or $_.Name -like '*POS-80*' -or $_.Name -like '*EPSON*') { Set-Printer -Name $_.Name -Paused $false -ErrorAction SilentlyContinue } }"

echo [INFO] Pornesc POS Bridge pentru Constanta...
echo [INFO] Aceasta fereastra trebuie lasata deschisa in permanenta!
echo.

:loop
node index.js
echo.
echo [ATENTIE] Node s-a oprit cu codul %errorlevel%. Repornesc in 5 secunde...
timeout /t 5
goto loop
