@echo off
chcp 65001 >nul
title Smart Kiosk - Configurare Universala Fullscreen
color 0A
cls

echo =============================================================
echo               SMART KIOSK - CONFIGURARE UNIVERSALA
echo =============================================================
echo.
echo Selecteaza locatia pentru acest Kiosk:
echo.
echo   1. Cluj Kiosk 1 (Centru)
echo   2. Cluj Kiosk 2
echo   3. Brasov       (RollMaster)
echo   4. Constanta 1
echo   5. Constanta 2
echo.
echo =============================================================
echo.

set "CHOICE="
set /p "CHOICE=Introdu cifra locatiei (1-5) si apasa ENTER: "

set "SCRIPT_VERSION=2.4.0"
set "LOC_ID=cluj2"
set "LOC_NAME=Cluj 2"
set "URL=https://kiosk-smashme.netlify.app/?loc=cluj2&universal=true&v=%SCRIPT_VERSION%"
set "PRINTER_NAME=EPSON"
set "COM_PORT=auto"
set "POS_GATEWAY=raiffeisen"

if "%CHOICE%"=="1" (
    set "LOC_ID=cluj1"
    set "LOC_NAME=Cluj 1"
    set "URL=https://kiosk-smashme.netlify.app/?loc=cluj1&universal=true&v=%SCRIPT_VERSION%"
    set "PRINTER_NAME=EPSON"
    set "COM_PORT=COM4"
    set "POS_GATEWAY=raiffeisen"
)
if "%CHOICE%"=="2" (
    set "LOC_ID=cluj2"
    set "LOC_NAME=Cluj 2"
    set "URL=https://kiosk-smashme.netlify.app/?loc=cluj2&universal=true&v=%SCRIPT_VERSION%"
    set "PRINTER_NAME=EPSON"
    set "COM_PORT=auto"
    set "POS_GATEWAY=raiffeisen"
)
if "%CHOICE%"=="3" (
    set "LOC_ID=sm-brasov"
    set "LOC_NAME=Brasov"
    set "URL=https://kiosk-smashme.netlify.app/?loc=sm-brasov&universal=true&v=%SCRIPT_VERSION%"
    set "PRINTER_NAME=EPSON TM-T20"
    set "COM_PORT=auto"
    set "POS_GATEWAY=raiffeisen"
)
if "%CHOICE%"=="4" (
    set "LOC_ID=constanta1"
    set "LOC_NAME=Constanta 1"
    set "URL=https://kiosk-smashme.netlify.app/?loc=constanta1&universal=true&v=%SCRIPT_VERSION%"
    set "PRINTER_NAME=XP-80"
    set "COM_PORT=COM7"
    set "POS_GATEWAY=raiffeisen"
)
if "%CHOICE%"=="5" (
    set "LOC_ID=constanta2"
    set "LOC_NAME=Constanta 2"
    set "URL=https://kiosk-smashme.netlify.app/?loc=constanta2&universal=true&v=%SCRIPT_VERSION%"
    set "PRINTER_NAME=XP-80"
    set "COM_PORT=auto"
    set "POS_GATEWAY=raiffeisen"
)

echo.
echo [INFO] Ai selectat: %LOC_NAME%
echo [INFO] URL: "%URL%"
echo [INFO] POS Bridge: %POS_GATEWAY% pe port %COM_PORT% ^| Imprimanta: %PRINTER_NAME%
echo.

set "APP_DIR=C:\SmartKiosk"
if not exist "%APP_DIR%" mkdir "%APP_DIR%" >nul 2>&1
cd /d "%APP_DIR%"

if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"

:: Salvare / actualizare automata .env pentru POS Bridge
echo [INFO] Salvez configuratia hardware in %APP_DIR%\.env...
(
    echo # Configurare automata Smart Kiosk - %LOC_NAME%
    echo RENDER_URL=https://smart-kiosk-v7ws.onrender.com
    echo COM_PORT=%COM_PORT%
    echo BAUD_RATE=9600
    echo LOCATION_ID=%LOC_ID%
    echo BRIDGE_KEY=pos-bridge-2024
    echo POS_GATEWAY=%POS_GATEWAY%
    echo PRINTER_NAME=%PRINTER_NAME%
) > "%APP_DIR%\.env"

:: 1. Inchidere instante vechi browser
echo [1/7] Inchidere ferestre browser existente...
taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1

:: 2. Dezactivare Sleep, Standby si Oprire Monitor (Anti-Sleep)
echo [2/7] Dezactivare Sleep, Standby si Oprire Monitor in Windows...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8685-5b0887e3290d 48e6b7a6-50f5-4760-a579-e4c11dd81862 0 >nul 2>&1
powercfg /setactive SCHEME_CURRENT >nul 2>&1

:: 3. Dezactivare alerte si popup-uri Windows Firewall (Allow Access) si autorizare trafic Kiosk
echo [3/7] Dezactivare popup-uri Windows Defender Firewall...
netsh advfirewall set allprofiles settings inboundusernotification disable >nul 2>&1
for /f "tokens=*" %%i in ('where node.exe 2^>nul') do (
    netsh advfirewall firewall add rule name="Smart Kiosk Node" dir=in action=allow program="%%i" enable=yes >nul 2>&1
)

:: 4. Activare permanenta Auto-Hide Taskbar in Windows Settings si reincarcare Explorer
echo [4/7] Activare automata 'Auto-Hide Taskbar' in setarile Windows...
powershell -NoProfile -Command "$keys = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects2', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\MMStuckRects3'); foreach($k in $keys){ if(Test-Path $k){ $v=(Get-ItemProperty $k).Settings; if($v -and $v.Length -gt 8){ $v[8]=3; Set-ItemProperty $k Settings $v } } }; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' SearchboxTaskbarMode 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' ShowTaskViewButton 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' TaskbarDa 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' TaskbarMn 0 -Force -ErrorAction SilentlyContinue; taskkill /f /im explorer.exe; start explorer.exe" >nul 2>&1

:: 5. Gasire Google Chrome sau Microsoft Edge
echo [5/7] Cautare browser Chrome / Edge...
set "BROWSER=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" set "BROWSER=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if not exist "%BROWSER%" (
    for /f "tokens=*" %%i in ('where chrome.exe 2^>nul') do set "BROWSER=%%i"
)
if not exist "%BROWSER%" (
    for /f "tokens=*" %%i in ('where msedge.exe 2^>nul') do set "BROWSER=%%i"
)

if not exist "%BROWSER%" (
    color 0C
    echo.
    echo [EROARE] Nu s-a gasit Google Chrome sau Edge instalat!
    echo.
    pause
    exit /b 1
)

echo [OK] Browser gasit: %BROWSER%
netsh advfirewall firewall add rule name="Smart Kiosk Browser" dir=in action=allow program="%BROWSER%" enable=yes >nul 2>&1

:: Creare folder profil Kiosk izolat
if not exist "C:\SmartKiosk_Data" mkdir "C:\SmartKiosk_Data" >nul 2>&1

:: 6. Salvare Autostart si Scurtaturi Desktop (Ecran + POS Bridge)
echo [6/7] Configurare Autostart la pornirea Windows si creare scurtaturi...
powershell -NoProfile -Command "$w=New-Object -Com WScript.Shell; $d=[Environment]::GetFolderPath('Desktop'); $s=$w.CreateShortcut(\"$d\Smart Kiosk (%LOC_NAME%).lnk\"); $s.TargetPath='%BROWSER%'; $s.Arguments='--kiosk %URL% --user-data-dir=C:\SmartKiosk_Data --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000'; $s.WindowStyle=3; $s.Save(); $u=[Environment]::GetFolderPath('Startup'); $s2=$w.CreateShortcut(\"$u\SmartKiosk.lnk\"); $s2.TargetPath='%BROWSER%'; $s2.Arguments='--kiosk %URL% --user-data-dir=C:\SmartKiosk_Data --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000'; $s2.WindowStyle=3; $s2.Save()" >nul 2>&1

:: Descarcare fisiere necesare POS Bridge daca lipsesc
echo [INFO] Asigur existenta fisierelor POS Bridge in %APP_DIR%...
if not exist "%APP_DIR%\start-windows.bat" curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\start-windows.bat" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/start-windows.bat"
if not exist "%APP_DIR%\run-hidden.vbs" curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\run-hidden.vbs" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/run-hidden.vbs"
if not exist "%APP_DIR%\watchdog.vbs" curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\watchdog.vbs" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/watchdog.vbs"
if not exist "%APP_DIR%\package.json" curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\package.json" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/package.json"
if not exist "%APP_DIR%\index.js" curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\index.js" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js"
if not exist "%APP_DIR%\printer.js" curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\printer.js" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/printer.js"
if not exist "%APP_DIR%\rawprint.ps1" curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\rawprint.ps1" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/rawprint.ps1"
if not exist "%APP_DIR%\scan_port_pc.js" curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\scan_port_pc.js" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/scan_port_pc.js"
if not exist "%APP_DIR%\brandLogos.js" curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\brandLogos.js" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/brandLogos.js"

where node >nul 2>nul
if %errorlevel% equ 0 (
    if not exist "%APP_DIR%\node_modules\dotenv" (
        echo [INFO] Instalez dependentele npm pentru POS si imprimanta...
        cd /d "%APP_DIR%"
        call npm install --no-audit --no-fund >nul 2>&1
    )
)

if exist "%APP_DIR%\run-hidden.vbs" (
    powershell -NoProfile -Command "$w=New-Object -Com WScript.Shell; $u=[Environment]::GetFolderPath('Startup'); $s=$w.CreateShortcut(\"$u\POSBridge.lnk\"); $s.TargetPath='wscript.exe'; $s.Arguments='\"%APP_DIR%\run-hidden.vbs\"'; $s.WorkingDirectory='%APP_DIR%'; $s.WindowStyle=0; $s.Save()" >nul 2>&1
    echo [INFO] Pornesc POS Bridge in fundal (run-hidden.vbs)...
    start "" wscript.exe "%APP_DIR%\run-hidden.vbs"
    goto :bridge_started
)

if exist "%APP_DIR%\start-windows.bat" (
    powershell -NoProfile -Command "$w=New-Object -Com WScript.Shell; $u=[Environment]::GetFolderPath('Startup'); $s=$w.CreateShortcut(\"$u\POSBridge.lnk\"); $s.TargetPath='%APP_DIR%\start-windows.bat'; $s.WorkingDirectory='%APP_DIR%'; $s.WindowStyle=7; $s.Save()" >nul 2>&1
    echo [INFO] Pornesc start-windows.bat...
    start "" /min "%APP_DIR%\start-windows.bat"
)

:bridge_started

:: 7. Lansare Kiosk Fullscreen
echo [7/7] Pornire ecran Kiosk in Fullscreen Total...
timeout /t 2 >nul
start "" "%BROWSER%" --kiosk "%URL%" --user-data-dir="C:\SmartKiosk_Data" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000

echo.
echo =============================================================
echo   [SUCCES TOTAL] KIOSKUL SI POS BRIDGE AU FOST PORNITE!
echo =============================================================
echo   - Locatie activa: %LOC_NAME%
echo   - URL Kiosk: "%URL%"
echo   - Folder instalare: %APP_DIR%
echo   - POS Bridge: lansat in fundal (port: %COM_PORT%, imprimanta: %PRINTER_NAME%)
echo   - Auto-Hide Taskbar activat definitiv in Windows.
echo   - Sleep si Standby dezactivate (ecranul ramane mereu aprins).
echo   - Modul Fullscreen Kiosk a fost pornit.
echo   - Autostart activat atat pentru Ecran cat si pentru POS Bridge!
echo =============================================================
echo.
echo [OK] Kiosk si POS lansate cu succes! Inchidere automata consola in 2 secunde...
timeout /t 2 >nul
exit /b 0
