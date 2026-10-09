@echo off
title Smart Kiosk — POS Bridge Constanta (COM7 + XP-80)
color 0A
echo.
echo  ╔═════════════════════════════════════════════════════════╗
echo  ║   SMART KIOSK — POS ^& PRINTER BRIDGE CONSTANTA         ║
echo  ║   POS: COM7 ^| Imprimanta: XP-80 ^| Locatie: constanta1 ║
echo  ╚═════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"

:: Verifica daca Node.js e instalat
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo  [EROARE] Node.js nu este instalat!
    echo  Descarca si instaleaza de la: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Instaleaza dependentele daca lipsesc
if not exist "node_modules\dotenv" (
    echo  [INFO] Instalez dependentele necesare...
    call npm install --no-audit --no-fund
    echo.
)

:: Curatare procese vechi si deblocare coada imprimanta XP-80
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*index.js*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue; if ($_.Name -like '*XP-80*' -or $_.Name -like '*POS-80*' -or $_.Name -like '*EPSON*') { Set-Printer -Name $_.Name -Paused $false -ErrorAction SilentlyContinue } }"

echo  [INFO] Pornesc POS Bridge pentru Constanta...
echo  [INFO] Apasa Ctrl+C pentru a opri.
echo.

:loop
node index.js
echo.
echo  [WARN] Bridge oprit - repornesc in 5 secunde...
timeout /t 5 /nobreak >nul
goto loop
