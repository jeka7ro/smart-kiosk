@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Smart Kiosk - Configurare si Instalare Constanta
color 0A

echo.
echo  =====================================================================
echo        INSTALARE COMPLETA SMART KIOSK - LOCATIA CONSTANTA 1
echo   POS: COM7 (Raiffeisen) ^| Imprimanta: XP-80 ^| URL: constanta1
echo  =====================================================================
echo.

cd /d "%~dp0"

:: 1. Verificare Node.js
echo [1/6] Verific Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;!PATH!"
    )
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  ==============================================================
    echo  [ATENTIE] Node.js NU este instalat pe acest PC!
    echo  Node.js este obligatoriu pentru conexiunea cu POS-ul si imprimanta.
    echo  ==============================================================
    echo.
    echo  [INFO] Descarc si pornesc instalatorul oficial Node.js LTS...
    powershell -NoProfile -Command "$dest = '$env:TEMP\node-v20-x64.msi'; Write-Host '  Descarc Node.js LTS de la nodejs.org...'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi', $dest); Write-Host '  Pornesc instalatorul Node.js... Va rugam asteptati.'; Start-Process msiexec.exe -ArgumentList '/i', $dest, '/qb' -Wait; Write-Host '  [OK] Node.js a fost instalat!' -ForegroundColor Green;"
    set "PATH=C:\Program Files\nodejs;!PATH!"
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  [EROARE] Node.js nu a putut fi instalat automat.
    echo  Va rugam descarcati si instalati manual Node.js de la:
    echo  https://nodejs.org
    echo  Dupa instalare, rulati din nou acest script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo   [OK] Node.js este instalat: !NODE_VER!
echo.

:: 2. Instalare dependente npm
echo [2/6] Verific dependentele Node.js...
if not exist "node_modules\dotenv" (
    echo   [INFO] Instalez pachetele necesare (serialport, socket.io-client etc.)...
    call npm install --no-audit --no-fund
    echo   [OK] Pachete instalate cu succes!
) else (
    echo   [OK] Pachetele sunt deja instalate.
)
echo.

:: 3. Verificare Port COM7
echo [3/6] Verific conexiunea POS bancar pe COM7...
powershell -NoProfile -Command "$ports = [System.IO.Ports.SerialPort]::GetPortNames(); if ($ports -contains 'COM7') { Write-Host '  [OK] Portul COM7 este conectat si recunoscut!' -ForegroundColor Green } else { Write-Host '  [AVERTISMENT] Portul COM7 NU apare inca in Windows!' -ForegroundColor Yellow; Write-Host '  Porturi detectate: ' ($ports -join ', ') -ForegroundColor Gray; Write-Host '  Daca POS-ul este conectat pe alt port, modificati COM_PORT in fisierul .env' -ForegroundColor Gray }"
echo.

:: 4. Verificare Imprimanta XP-80
echo [4/6] Verific imprimanta XP-80 in Windows...
powershell -NoProfile -Command "$printers = Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name; $found = $printers | Where-Object { $_ -like '*XP-80*' -or $_ -like '*POS-80*' -or $_ -like '*Xprinter*' }; if ($found) { Write-Host '  [OK] Imprimanta termica gasita:' ($found -join ', ') -ForegroundColor Green } else { Write-Host '  [AVERTISMENT] Nicio imprimanta cu numele XP-80 nu a fost gasita!' -ForegroundColor Yellow; Write-Host '  Imprimante disponibile: ' ($printers -join ', ') -ForegroundColor Gray; Write-Host '  Daca imprimanta are alt nume in Windows, modificati PRINTER_NAME in .env' -ForegroundColor Gray }"
echo.

:: 5. Detectare Google Chrome sau Microsoft Edge
echo [5/6] Detectez browserul pentru Kiosk Fullscreen...
set "CHROME_PATH="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "CHROME_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not defined CHROME_PATH if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "CHROME_PATH=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if defined CHROME_PATH (
    echo   [OK] Browser detectat: !CHROME_PATH!
) else (
    echo   [AVERTISMENT] Google Chrome nu a fost gasit! Va rugam instalati Google Chrome.
)
echo.

:: 6. Configurare Autostart la pornirea Windows
echo [6/6] Configurez pornirea automata la boot Windows (Startup)...
set "KIOSK_URL=https://kiosk-smashme.netlify.app/?loc=constanta1"
set "BRIDGE_BAT=%~dp0start-windows.bat"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $startup = [Environment]::GetFolderPath('Startup'); $desktop = [Environment]::GetFolderPath('Desktop'); if ('!CHROME_PATH!' -ne '') { $sKiosk = $ws.CreateShortcut($startup + '\SmartKiosk.lnk'); $sKiosk.TargetPath = '!CHROME_PATH!'; $sKiosk.Arguments = '--kiosk \"\"!KIOSK_URL!\"\" --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check'; $sKiosk.WindowStyle = 3; $sKiosk.Save(); $dKiosk = $ws.CreateShortcut($desktop + '\Smart Kiosk Constanta.lnk'); $dKiosk.TargetPath = '!CHROME_PATH!'; $dKiosk.Arguments = '--kiosk \"\"!KIOSK_URL!\"\" --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check'; $dKiosk.WindowStyle = 3; $dKiosk.Save(); Write-Host '  [OK] Scurtatura Kiosk Chrome salvata in Startup si pe Desktop!' -ForegroundColor Green }; $sBridge = $ws.CreateShortcut($startup + '\POS-Bridge.lnk'); $sBridge.TargetPath = '!BRIDGE_BAT!'; $sBridge.WorkingDirectory = '%~dp0'; $sBridge.WindowStyle = 7; $sBridge.Save(); $dBridge = $ws.CreateShortcut($desktop + '\Porneste POS Bridge.lnk'); $dBridge.TargetPath = '!BRIDGE_BAT!'; $dBridge.WorkingDirectory = '%~dp0'; $dBridge.WindowStyle = 1; $dBridge.Save(); Write-Host '  [OK] Scurtatura POS Bridge salvata in Startup si pe Desktop!' -ForegroundColor Green;"

echo.
echo =====================================================================
echo   [SUCCES] KIOSKUL CONSTANTA A FOST INSTALAT CU SUCCES!
echo =====================================================================
echo.
echo  Ce s-a configurat:
echo   - La fiecare pornire Windows / restart, Kiosk-ul porneste Fullscreen.
echo   - POS Bridge porneste automat in fundal conectat pe COM7.
echo   - Pe Desktop aveti comenzile rapide de pornire manuala.
echo.

set "RUN_NOW=D"
set /p "RUN_NOW=Pornesc ecranul Kiosk si POS Bridge chiar acum? (D/N, Enter = Da): "
if /i "!RUN_NOW!"=="N" (
    echo Gata! O zi buna.
    timeout /t 3 >nul
    exit /b 0
)

echo.
echo [INFO] Pornesc POS Bridge...
start "" "!BRIDGE_BAT!"

if defined CHROME_PATH (
    echo [INFO] Pornesc ecranul Kiosk Fullscreen...
    start "" "!CHROME_PATH!" --kiosk "!KIOSK_URL!" --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check
)

echo.
echo [OK] Ambele aplicatii ruleaza! Fereastra se va inchide in 5 secunde...
timeout /t 5 >nul
exit /b 0
