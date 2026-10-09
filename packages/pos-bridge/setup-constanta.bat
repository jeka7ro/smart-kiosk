@echo off
setlocal EnableDelayedExpansion
title Smart Kiosk - Configurare Constanta (COM7 + XP-80)
color 0A

echo.
echo =====================================================================
echo    INSTALARE AUTOMATA SMART KIOSK SI POS BRIDGE - CONSTANTA
echo    Configuratie: POS pe COM7 ^| Imprimanta XP-80 ^| Locatie constanta1
echo =====================================================================
echo.

cd /d "%~dp0"

:: 1. Verificare Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [EROARE] Node.js NU este instalat!
    echo Te rugam sa instalezi Node.js LTS de la: https://nodejs.org
    echo Asigura-te ca bifezi "Add to PATH" in timpul instalarii.
    pause
    exit /b 1
)
echo [OK] Node.js detectat:
node -v
echo.

:: 2. Generare fisier .env pentru Constanta
echo [INFO] Creez configuratia .env pentru Constanta (COM7 + XP-80)...
(
echo RENDER_URL=https://smart-kiosk-ttut.onrender.com
echo COM_PORT=COM7
echo BAUD_RATE=9600
echo LOCATION_ID=constanta1
echo BRIDGE_KEY=pos-bridge-2024
echo POS_GATEWAY=raiffeisen
echo PRINTER_NAME=XP-80
) > .env

echo [OK] Fisierul .env a fost configurat cu succes!
echo.

:: 3. Verificare Port COM7
echo [INFO] Verific daca portul COM7 este conectat in Windows...
powershell -NoProfile -Command "$ports = [System.IO.Ports.SerialPort]::GetPortNames(); if ($ports -contains 'COM7') { Write-Host '  [OK] Portul COM7 a fost gasit in sistem!' -ForegroundColor Green } else { Write-Host '  [ATENTIE] COM7 NU apare inca in lista de porturi active (' ($ports -join ', ') ')! Verifica daca adaptorul USB-Serial al POS-ului este conectat.' -ForegroundColor Yellow }"
echo.

:: 4. Verificare Imprimanta XP-80
echo [INFO] Verific imprimanta XP-80 in Windows...
powershell -NoProfile -Command "$printers = Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name; $found = $printers | Where-Object { $_ -like '*XP-80*' -or $_ -like '*POS-80*' -or $_ -like '*Xprinter*' }; if ($found) { Write-Host '  [OK] Imprimanta detectata:' ($found -join ', ') -ForegroundColor Green } else { Write-Host '  [ATENTIE] Nicio imprimanta cu numele XP-80 nu a fost gasita in Windows! Imprimante gasite: ' ($printers -join ', ') -ForegroundColor Yellow; Write-Host '  (Daca imprimanta are alt nume in Windows, modificati PRINTER_NAME in fisierul .env)' -ForegroundColor Yellow }"
echo.

:: 5. Instalare dependente npm daca lipsesc
if not exist "node_modules\dotenv" (
    echo [INFO] Instalez dependentele Node.js (serialport, dotenv, socket.io-client)...
    call npm install --no-audit --no-fund
    echo [OK] Dependente instalate!
    echo.
)

:: 6. Cautare Chrome sau Edge pentru Kiosk Fullscreen
set "CHROME_PATH="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "CHROME_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not defined CHROME_PATH if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "CHROME_PATH=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

set "KIOSK_URL=https://kiosk-smashme.netlify.app/?loc=constanta1"
set "BRIDGE_BAT=%~dp0start-windows.bat"

:: 7. Creare scurtaturi Autostart (Startup) si Desktop
echo [INFO] Creez scurtaturile in Autostart (Startup) si pe Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $startup = [Environment]::GetFolderPath('Startup'); $desktop = [Environment]::GetFolderPath('Desktop'); if ('!CHROME_PATH!' -ne '') { $sKiosk = $ws.CreateShortcut($startup + '\SmartKiosk.lnk'); $sKiosk.TargetPath = '!CHROME_PATH!'; $sKiosk.Arguments = '--kiosk \"\"!KIOSK_URL!\"\" --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check'; $sKiosk.WindowStyle = 3; $sKiosk.Save(); $dKiosk = $ws.CreateShortcut($desktop + '\Smart Kiosk Constanta.lnk'); $dKiosk.TargetPath = '!CHROME_PATH!'; $dKiosk.Arguments = '--kiosk \"\"!KIOSK_URL!\"\" --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check'; $dKiosk.WindowStyle = 3; $dKiosk.Save(); Write-Host '  [OK] Scurtatura Kiosk Chrome creata!' -ForegroundColor Green }; $sBridge = $ws.CreateShortcut($startup + '\POS-Bridge.lnk'); $sBridge.TargetPath = '!BRIDGE_BAT!'; $sBridge.WorkingDirectory = '%~dp0'; $sBridge.WindowStyle = 7; $sBridge.Save(); $dBridge = $ws.CreateShortcut($desktop + '\Porneste POS Bridge.lnk'); $dBridge.TargetPath = '!BRIDGE_BAT!'; $dBridge.WorkingDirectory = '%~dp0'; $dBridge.WindowStyle = 1; $dBridge.Save(); Write-Host '  [OK] Scurtatura POS Bridge creata!' -ForegroundColor Green;"

echo.
echo =====================================================================
echo   [SUCCES] KIOSKUL SI POS BRIDGE CONSTANTA SUNT CONFIGURATE!
echo =====================================================================
echo.
echo  1. POS Bridge este setat pe COM7, Raiffeisen, imprimanta XP-80.
echo  2. Scurtaturile au fost puse in Windows Startup (Autostart).
echo     - La fiecare pornire sau restart de Windows, atat ecranul Kiosk
echo       cat si POS Bridge vor porni automat!
echo  3. Pe Desktop aveti scurtaturile:
echo     - "Smart Kiosk Constanta"
echo     - "Porneste POS Bridge"
echo.

set "RUN_NOW=D"
set /p "RUN_NOW=Doriti sa porniti POS Bridge si Kiosk acum? (D/N, Enter = Da): "
if /i "!RUN_NOW!"=="N" (
    echo Gata! O zi buna.
    timeout /t 3 >nul
    exit /b 0
)

echo [INFO] Pornesc POS Bridge in fundal...
start "" "!BRIDGE_BAT!"

if defined CHROME_PATH (
    echo [INFO] Pornesc Kiosk Fullscreen...
    start "" "!CHROME_PATH!" --kiosk "!KIOSK_URL!" --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check
)

echo.
echo [OK] Totul a fost pornit!
timeout /t 5 >nul
exit /b 0
