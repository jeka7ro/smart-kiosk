@echo off
chcp 65001 >nul
title Smart Kiosk - POS Bridge Raiffeisen
color 0A
echo.
echo ============================================
echo   SMART KIOSK - POS Bridge Raiffeisen
echo ============================================
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
curl -s -L -H "Cache-Control: no-cache" -o index.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js"
curl -s -L -H "Cache-Control: no-cache" -o printer.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/printer.js"
curl -s -L -H "Cache-Control: no-cache" -o rawprint.ps1 "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/rawprint.ps1"
curl -s -L -H "Cache-Control: no-cache" -o scan_port_pc.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/scan_port_pc.js"
curl -s -L -H "Cache-Control: no-cache" -o PrinterServiceDatecsFP950.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/PrinterServiceDatecsFP950.js"
curl -s -L -H "Cache-Control: no-cache" -o VivaPosService.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/VivaPosService.js"
curl -s -L -H "Cache-Control: no-cache" -o setup_kiosk_autostart.bat "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/setup_kiosk_autostart.bat"
echo  [INFO] Fisiere actualizate cu succes!

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
if not exist "node_modules\dotenv" (
    echo  [INFO] Instalez dependentele necesare...
    call npm install --no-audit --no-fund
    echo.
)

echo  [INFO] Pornesc POS Bridge din folderul curent: %~dp0
echo  [INFO] Apasa Ctrl+C pentru a opri
echo.

:loop
echo  [INFO] Verific actualizari din Cloud...
curl -s -L -H "Cache-Control: no-cache" -o index.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js"
curl -s -L -H "Cache-Control: no-cache" -o printer.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/printer.js"
curl -s -L -H "Cache-Control: no-cache" -o rawprint.ps1 "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/rawprint.ps1"
curl -s -L -H "Cache-Control: no-cache" -o scan_port_pc.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/scan_port_pc.js"
curl -s -L -H "Cache-Control: no-cache" -o PrinterServiceDatecsFP950.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/PrinterServiceDatecsFP950.js"
curl -s -L -H "Cache-Control: no-cache" -o VivaPosService.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/VivaPosService.js"
curl -s -L -H "Cache-Control: no-cache" -o setup_kiosk_autostart.bat "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/setup_kiosk_autostart.bat"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*index.js*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue; if ($_.Name -like '*EPSON*' -or $_.Name -like '*XP-80*') { Set-Printer -Name $_.Name -Paused $false -ErrorAction SilentlyContinue } }"
node index.js
echo.
echo  [WARN] Bridge oprit - repornesc in 5 secunde...
timeout /t 5 /nobreak >nul
goto loop
