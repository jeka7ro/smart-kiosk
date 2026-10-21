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
if not "%~1"=="" set "CHOICE=%~1"
if "%~1"=="brasov" set "CHOICE=3"
if "%~1"=="sm-brasov" set "CHOICE=3"
if "%~1"=="cluj1" set "CHOICE=1"
if "%~1"=="cluj2" set "CHOICE=2"
if "%~1"=="constanta1" set "CHOICE=4"
if "%~1"=="constanta2" set "CHOICE=5"

:: Detectie automata dupa hostname PC daca nu a fost dat parametru
if "%CHOICE%"=="" (
    if /i "%COMPUTERNAME%"=="DESKTOP-44PEN14" set "CHOICE=1"
    if /i "%COMPUTERNAME%"=="DESKTOP-VNTDBO0" set "CHOICE=2"
    if /i "%COMPUTERNAME%"=="DESKTOP-FT5PA0E" set "CHOICE=3"
    if /i "%COMPUTERNAME%"=="DESKTOP-19BUSUH" set "CHOICE=4"
)

if "%CHOICE%"=="" (
    set /p "CHOICE=Introdu cifra locatiei (1-5) si apasa ENTER: "
)

set "SCRIPT_VERSION=2.4.0"
set "LOC_ID=cluj2"
set "LOC_NAME=Cluj 2"
set "URL=https://kiosk-smashme.netlify.app/?loc=cluj2&universal=true&v=%SCRIPT_VERSION%"
set "PRINTER_NAME=EPSON"
set "COM_PORT=COM5"
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
    set "COM_PORT=COM5"
    set "POS_GATEWAY=raiffeisen"
)
if "%CHOICE%"=="3" (
    set "LOC_ID=sm-brasov"
    set "LOC_NAME=Brasov"
    set "URL=https://kiosk-smashme.netlify.app/?loc=sm-brasov&universal=true&v=%SCRIPT_VERSION%"
    set "PRINTER_NAME=EPSON TM-T20"
    set "COM_PORT=COM3"
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

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
cd /d "%APP_DIR%"

if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
if exist "%AppData%\npm" set "PATH=%AppData%\npm;%PATH%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Node.js nu este instalat. Se instaleaza automat Node.js LTS...
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    )
    if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
    if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
)

:: Salvare / actualizare automata .env pentru POS Bridge
echo [INFO] Salvez configuratia hardware in %APP_DIR%\.env...
(
    echo # Configurare automata Smart Kiosk - %LOC_NAME%
    echo RENDER_URL=https://smart-kiosk-ttut.onrender.com
    echo COM_PORT=%COM_PORT%
    echo BAUD_RATE=9600
    echo LOCATION_ID=%LOC_ID%
    echo BRIDGE_KEY=pos-bridge-2024
    echo POS_GATEWAY=%POS_GATEWAY%
    echo PRINTER_NAME=%PRINTER_NAME%
) > "%APP_DIR%\.env"

:: 1. Inchidere instante vechi browser si node + Curatare foldere si scurtaturi legacy
echo [1/7] Inchidere ferestre browser, procese vechi si curatare fisiere legacy...
taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM wscript.exe >nul 2>&1
timeout /t 1 >nul

:: Curatare task-uri vechi din Windows Task Scheduler
schtasks /delete /tn "SmartKiosk_POS_Watchdog" /f >nul 2>&1
schtasks /delete /tn "SmartKiosk_Boot" /f >nul 2>&1

:: Curatare foldere legacy duplicate
if exist "C:\Smart Kiosk" rmdir /s /q "C:\Smart Kiosk" >nul 2>&1
if exist "C:\SmartKiosk_Data" rmdir /s /q "C:\SmartKiosk_Data" >nul 2>&1
if exist "C:\POSNEW" rmdir /s /q "C:\POSNEW" >nul 2>&1
if exist "C:\kiosk_jk" rmdir /s /q "C:\kiosk_jk" >nul 2>&1
if exist "C:\KIOSKV2" rmdir /s /q "C:\KIOSKV2" >nul 2>&1
if exist "C:\POSINTEGRAT" rmdir /s /q "C:\POSINTEGRAT" >nul 2>&1

:: Curatare fisiere descarcate accidental in folderul utilizatorului
del /f /q "%USERPROFILE%\.env" "%USERPROFILE%\index.js*" "%USERPROFILE%\start-windows.bat" "%USERPROFILE%\run-hidden.vbs" >nul 2>&1

:: Curatare scurtaturi legacy orfane din Startup
powershell -NoProfile -Command "$u=[Environment]::GetFolderPath('Startup'); @('start-pos.bat.lnk', 'Kiosk.lnk', 'start-windows.lnk', 'bridge.lnk', 'start-pos.lnk') | ForEach-Object { $p = Join-Path $u $_; if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue } }" >nul 2>&1

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
powershell -NoProfile -Command "$keys = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects2', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\MMStuckRects3'); foreach($k in $keys){ if(Test-Path $k){ $v=(Get-ItemProperty -Path $k).Settings; if($v -and $v.Length -gt 8){ $v[8]=3; Set-ItemProperty -Path $k -Name Settings -Value $v -Force -ErrorAction SilentlyContinue } } }; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' SearchboxTaskbarMode 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' ShowTaskViewButton 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' TaskbarDa 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' TaskbarMn 0 -Force -ErrorAction SilentlyContinue; Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800; if(-not (Get-Process explorer -ErrorAction SilentlyContinue)){ Start-Process explorer.exe -ErrorAction SilentlyContinue }" >nul 2>&1

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

:: 6. Descarcare fisiere POS Bridge si configurare Autostart
echo [6/7] Actualizare fisiere POS Bridge in %APP_DIR%...
curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\start-windows.bat" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/start-windows.bat"
curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\run-hidden.vbs" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/run-hidden.vbs"
curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\watchdog.vbs" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/watchdog.vbs"
curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\package.json" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/package.json"
curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\index.js" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js"
curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\printer.js" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/printer.js"
curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\rawprint.ps1" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/rawprint.ps1"
curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\scan_port_pc.js" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/scan_port_pc.js"
curl -s -L -H "Cache-Control: no-cache" -o "%APP_DIR%\brandLogos.js" "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/brandLogos.js"

where node >nul 2>nul
if %errorlevel% neq 0 goto :skip_npm
if exist "%APP_DIR%\node_modules\dotenv" goto :skip_npm

echo [INFO] Instalez dependentele npm pentru POS si imprimanta...
cd /d "%APP_DIR%"
call npm install --no-audit --no-fund >nul 2>&1

:skip_npm

echo [INFO] Configurare Autostart (Ecran + POS Bridge)...
echo Set w = CreateObject("WScript.Shell") > "%TEMP%\kiosk_sc.vbs"
echo Set s = w.CreateShortcut(w.SpecialFolders("Startup") ^& "\SmartKiosk.lnk") >> "%TEMP%\kiosk_sc.vbs"
echo s.TargetPath = "%BROWSER%" >> "%TEMP%\kiosk_sc.vbs"
echo s.Arguments = "--kiosk %URL% --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000" >> "%TEMP%\kiosk_sc.vbs"
echo s.WindowStyle = 3 >> "%TEMP%\kiosk_sc.vbs"
echo s.Save >> "%TEMP%\kiosk_sc.vbs"
echo Set s2 = w.CreateShortcut(w.SpecialFolders("Startup") ^& "\POSBridge.lnk") >> "%TEMP%\kiosk_sc.vbs"
echo s2.TargetPath = "wscript.exe" >> "%TEMP%\kiosk_sc.vbs"
echo s2.Arguments = """%APP_DIR%\run-hidden.vbs""" >> "%TEMP%\kiosk_sc.vbs"
echo s2.WorkingDirectory = "%APP_DIR%" >> "%TEMP%\kiosk_sc.vbs"
echo s2.WindowStyle = 0 >> "%TEMP%\kiosk_sc.vbs"
echo s2.Save >> "%TEMP%\kiosk_sc.vbs"
echo Set s3 = w.CreateShortcut(w.SpecialFolders("Desktop") ^& "\Smart Kiosk.lnk") >> "%TEMP%\kiosk_sc.vbs"
echo s3.TargetPath = "%BROWSER%" >> "%TEMP%\kiosk_sc.vbs"
echo s3.Arguments = "--kiosk %URL% --start-fullscreen --start-maximized" >> "%TEMP%\kiosk_sc.vbs"
echo s3.WindowStyle = 3 >> "%TEMP%\kiosk_sc.vbs"
echo s3.Save >> "%TEMP%\kiosk_sc.vbs"
cscript //nologo "%TEMP%\kiosk_sc.vbs" >nul 2>&1
del /f /q "%TEMP%\kiosk_sc.vbs" >nul 2>&1

if not exist "%APP_DIR%\watchdog.vbs" goto :skip_watchdog
echo [INFO] Inregistrez Watchdog pasiv in Windows Task Scheduler (la fiecare 5 minute)...
schtasks /create /tn "SmartKiosk_Watchdog" /tr "wscript.exe \"%APP_DIR%\watchdog.vbs\"" /sc MINUTE /mo 5 /f /rl HIGHEST >nul 2>&1
:skip_watchdog

echo [INFO] Pornesc POS Bridge in fundal...
if exist "%APP_DIR%\run-hidden.vbs" goto :start_hidden
start "" /min cmd /k "%APP_DIR%\start-windows.bat"
goto :bridge_started
:start_hidden
start "" wscript.exe "%APP_DIR%\run-hidden.vbs"
:bridge_started

:: 7. Lansare Kiosk Fullscreen
echo [7/7] Pornire ecran Kiosk in Fullscreen Total...
timeout /t 2 >nul
start "" "%BROWSER%" --kiosk "%URL%" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000
timeout /t 2 >nul
powershell -NoProfile -Command "(New-Object -Com WScript.Shell).AppActivate('Google Chrome')" >nul 2>&1

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
echo [OK] Kiosk si POS lansate cu succes! Inchidere automata consola...
timeout /t 1 >nul
exit
