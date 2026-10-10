@echo off
setlocal EnableDelayedExpansion
title Smart Kiosk Autostart Setup

echo.
echo =============================================================
echo    SMART KIOSK - CONFIGURARE AUTOSTART FULLSCREEN WINDOWS
echo =============================================================
echo.

:: 1. Cautare automata Google Chrome sau Edge
set "CHROME_PATH="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if not defined CHROME_PATH (
    if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
        set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )
)
if not defined CHROME_PATH (
    if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
        set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
    )
)
if not defined CHROME_PATH (
    if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
        set "CHROME_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    )
)
if not defined CHROME_PATH (
    if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
        set "CHROME_PATH=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    )
)

if not defined CHROME_PATH (
    for /f "tokens=*" %%i in ('where chrome.exe 2^>nul') do (
        set "CHROME_PATH=%%i"
    )
)
if not defined CHROME_PATH (
    for /f "tokens=*" %%i in ('where msedge.exe 2^>nul') do (
        set "CHROME_PATH=%%i"
    )
)

if not defined CHROME_PATH (
    echo [EROARE] Nu am gasit Google Chrome sau Edge instalat!
    echo Te rugam sa instalezi Google Chrome si sa reiei rularea.
    pause
    exit /b 1
)

echo [OK] Browser detectat: !CHROME_PATH!
echo.

:: 2. Selectare Locatie Kiosk
echo Alege locatia pentru acest ecran:
echo   1. Cluj Kiosk 1 (cluj1) [Implicit]
echo   2. Cluj Kiosk 2 (cluj2)
echo   3. Brasov (sm-brasov)
echo   4. Constanta 1 (constanta1)
echo   5. Constanta 2 (constanta2)
echo   6. Alt URL personalizat
echo.
set "CHOICE=1"
set /p "CHOICE=Selecteaza 1-6 si apasa Enter (implicit 1): "

set "KIOSK_URL=https://kiosk-smashme.netlify.app/?loc=cluj1"
set "LOC_NAME=Cluj 1"

if "!CHOICE!"=="2" (
    set "KIOSK_URL=https://kiosk-smashme.netlify.app/?loc=cluj2"
    set "LOC_NAME=Cluj 2"
)
if "!CHOICE!"=="3" (
    set "KIOSK_URL=https://kiosk-smashme.netlify.app/?loc=sm-brasov"
    set "LOC_NAME=Brasov"
)
if "!CHOICE!"=="4" (
    set "KIOSK_URL=https://kiosk-smashme.netlify.app/?loc=constanta1"
    set "LOC_NAME=Constanta 1"
)
if "!CHOICE!"=="5" (
    set "KIOSK_URL=https://kiosk-smashme.netlify.app/?loc=constanta2"
    set "LOC_NAME=Constanta 2"
)
if "!CHOICE!"=="6" (
    set /p "KIOSK_URL=Introdu URL-ul complet: "
    set "LOC_NAME=Custom"
)

echo.
echo [INFO] URL configurat: !KIOSK_URL!
echo [INFO] Instalez scurtaturile in Autostart si pe Desktop...
echo.

:: 3. Creare scurtaturi prin PowerShell folosind folderele de sistem oficiale si ascundere Taskbar
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3'; if(Test-Path $p){$v=(Get-ItemProperty $p).Settings; if($v -and $v.Length -gt 8){$v[8]=3; Set-ItemProperty $p Settings $v}}; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' SearchboxTaskbarMode 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' ShowTaskViewButton 0 -Force -ErrorAction SilentlyContinue; $ws = New-Object -ComObject WScript.Shell; $target = '!CHROME_PATH!'; $args = '--kiosk \"\"!KIOSK_URL!\"\" --user-data-dir=\"\"C:\SmartKiosk_Data\"\" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000'; $startup = [Environment]::GetFolderPath('Startup') + '\SmartKiosk.lnk'; $s1 = $ws.CreateShortcut($startup); $s1.TargetPath = $target; $s1.Arguments = $args; $s1.WindowStyle = 3; $s1.Save(); $desktop = [Environment]::GetFolderPath('Desktop') + '\Smart Kiosk (!LOC_NAME!).lnk'; $s2 = $ws.CreateShortcut($desktop); $s2.TargetPath = $target; $s2.Arguments = $args; $s2.WindowStyle = 3; $s2.Save();"

echo =============================================================
echo   [SUCCES] KIOSKUL A FOST CONFIGURAT CU SUCCES!
echo =============================================================
echo.
echo  - La pornirea Windows, chioscul va porni automat Fullscreen.
echo  - Bara de jos si taburile browserului sunt ascunse complet.
echo  - Scurtatura este salvata si pe Desktop: Smart Kiosk (!LOC_NAME!).lnk
echo.

echo.
echo [INFO] Pornesc Kiosk-ul in Fullscreen...
taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1
timeout /t 1 >nul
start "" "!CHROME_PATH!" --kiosk "!KIOSK_URL!" --user-data-dir="C:\SmartKiosk_Data" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars

echo.
echo [OK] Kiosk pornit cu succes!
echo Aceasta fereastra NU se inchide automat.
echo Apasa orice tasta cand doresti sa o inchizi...
pause >nul

