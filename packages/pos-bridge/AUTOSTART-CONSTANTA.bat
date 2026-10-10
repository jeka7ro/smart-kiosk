@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Smart Kiosk Constanta - Configurare Automata 1-Click
color 0A

echo.
echo =====================================================================
echo    CONFIGURARE AUTOMATA 1-CLICK: SMART KIOSK CONSTANTA 1
echo    - POS: COM7 (Raiffeisen Verifone)
echo    - Imprimanta: XP-80 (USB)
echo    - Ecran Kiosk: https://kiosk-smashme.netlify.app/?loc=constanta1
echo =====================================================================
echo.

cd /d "%~dp0"
set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

:: 1. Salvare automata fisier .env pentru Constanta
echo [1/5] Salvez fisierul .env pentru Constanta 1...
(
    echo # Configurare POS Bridge si Imprimanta Constanta 1
    echo RENDER_URL=https://smart-kiosk-ttut.onrender.com
    echo COM_PORT=COM7
    echo BAUD_RATE=9600
    echo LOCATION_ID=constanta1
    echo BRIDGE_KEY=pos-bridge-2024
    echo POS_GATEWAY=raiffeisen
    echo PRINTER_NAME=XP-80
) > "%APP_DIR%\.env"
echo   [OK] Fisierul .env a fost salvat in: "%APP_DIR%\.env"
echo.

:: 2. Detectare Google Chrome (sau Edge fallback)
echo [2/5] Caut browserul Google Chrome...
set "BROWSER_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if not defined BROWSER_EXE (
    for /f "tokens=*" %%i in ('where chrome.exe 2^>nul') do set "BROWSER_EXE=%%i"
)
if not defined BROWSER_EXE (
    for /f "tokens=*" %%i in ('where msedge.exe 2^>nul') do set "BROWSER_EXE=%%i"
)

if not defined BROWSER_EXE (
    set "BROWSER_EXE=chrome.exe"
    echo   [AVERTISMENT] Folosesc comanda implicita chrome.exe.
) else (
    echo   [OK] Browser gasit: "!BROWSER_EXE!"
)
echo.

:: 3. Salvare in Windows Registry Run (Autostart garantat la pornire Windows)
echo [3/5] Configurez pornirea automata in Windows Registry Run...
set "BAT_PATH=%APP_DIR%\start-windows.bat"
set "KIOSK_URL=https://kiosk-smashme.netlify.app/?loc=constanta1"

:: A. Inregistrare POS Bridge
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "POSBridge" /t REG_SZ /d "\"%BAT_PATH%\"" /f >nul
if %errorlevel% equ 0 (
    echo   [OK] POSBridge salvat in Windows Run (start-windows.bat).
) else (
    echo   [EROARE] Nu s-a putut salva POSBridge in Registry!
)

:: B. Inregistrare Smart Kiosk Screen (Chrome Fullscreen)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "SmartKioskScreen" /t REG_SZ /d "\"%BROWSER_EXE%\" --kiosk %KIOSK_URL% --no-first-run --no-default-browser-check" /f >nul
if %errorlevel% equ 0 (
    echo   [OK] SmartKioskScreen salvat in Windows Run (Chrome Kiosk Fullscreen).
) else (
    echo   [EROARE] Nu s-a putut salva SmartKioskScreen in Registry!
)

:: Curatare chei vechi daca existau
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "SmartKioskPOSBridge" /f >nul 2>nul
echo.

:: 4. Creare comenzi rapide pe Desktop
echo [4/5] Creez scurtaturile de pornire pe Desktop...
set "DESKTOP_FOLDER=%USERPROFILE%\Desktop"
(
    echo Set ws = CreateObject("WScript.Shell"^)
    echo Set dBridge = ws.CreateShortcut("%DESKTOP_FOLDER%\Porneste POS Bridge.lnk"^)
    echo dBridge.TargetPath = "%BAT_PATH%"
    echo dBridge.WorkingDirectory = "%APP_DIR%"
    echo dBridge.WindowStyle = 1
    echo dBridge.Save
    echo Set dKiosk = ws.CreateShortcut("%DESKTOP_FOLDER%\Porneste Ecran Kiosk.lnk"^)
    echo dKiosk.TargetPath = "%BROWSER_EXE%"
    echo dKiosk.Arguments = "--kiosk """"%KIOSK_URL%"""" --no-first-run --no-default-browser-check"
    echo dKiosk.WindowStyle = 3
    echo dKiosk.Save
) > "%TEMP%\kiosk_shortcuts.vbs"
cscript //nologo "%TEMP%\kiosk_shortcuts.vbs" >nul 2>nul
del "%TEMP%\kiosk_shortcuts.vbs" >nul 2>nul
echo   [OK] Scurtaturile "Porneste POS Bridge" si "Porneste Ecran Kiosk" create pe Desktop!
echo.

:: 5. Verificare chei inregistrate
echo [5/5] Verificare finala a cheilor active in Windows:
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" | findstr /i "POSBridge SmartKioskScreen"
echo.

echo =====================================================================
echo   [SUCCES] TOTUL ESTE CONFIGURAT AUTOMAT PENTRU CONSTANTA!
echo   La fiecare restart sau pornire PC vor porni automat ambele:
echo     1. POS Bridge (Card Verifone COM7 + Imprimanta XP-80)
echo     2. Ecranul Kiosk in mod Fullscreen (fara bare Windows)
echo =====================================================================
echo.

set "START_NOW=D"
set /p "START_NOW=Vrei sa le pornesc chiar acum pe amandoua? (D/N, apasa Enter pentru Da): "
if /i "!START_NOW!"=="N" (
    echo Gata! Configurarea este salvata.
    timeout /t 4 >nul
    exit /b 0
)

echo.
echo [INFO] Pornesc POS Bridge...
start "" "%BAT_PATH%"
timeout /t 2 >nul

echo [INFO] Pornesc Ecranul Kiosk Fullscreen...
start "" "%BROWSER_EXE%" --kiosk "%KIOSK_URL%" --no-first-run --no-default-browser-check

echo [OK] Ambele aplicatii ruleaza acum!
timeout /t 4 >nul
exit /b 0
