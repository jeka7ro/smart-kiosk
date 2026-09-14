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
echo   4. Alt URL personalizat
echo.
set "CHOICE=1"
set /p "CHOICE=Selecteaza 1-4 si apasa Enter (implicit 1): "

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
    set /p "KIOSK_URL=Introdu URL-ul complet: "
    set "LOC_NAME=Custom"
)

echo.
echo [INFO] URL configurat: !KIOSK_URL!
echo [INFO] Instalez scurtaturile in Autostart si pe Desktop...
echo.

:: 3. Creare scurtaturi prin PowerShell folosind folderele de sistem oficiale
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $target = '!CHROME_PATH!'; $args = '--kiosk \"!KIOSK_URL!\" --incognito --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-session-crashed-bubble'; $startup = [Environment]::GetFolderPath('Startup') + '\SmartKiosk.lnk'; $s1 = $ws.CreateShortcut($startup); $s1.TargetPath = $target; $s1.Arguments = $args; $s1.WindowStyle = 3; $s1.Save(); $desktop = [Environment]::GetFolderPath('Desktop') + '\Smart Kiosk (!LOC_NAME!).lnk'; $s2 = $ws.CreateShortcut($desktop); $s2.TargetPath = $target; $s2.Arguments = $args; $s2.WindowStyle = 3; $s2.Save();"

echo =============================================================
echo   [SUCCES] KIOSKUL A FOST CONFIGURAT CU SUCCES!
echo =============================================================
echo.
echo  - La pornirea Windows, chioscul va porni automat Fullscreen.
echo  - Bara de jos si taburile browserului sunt ascunse complet.
echo  - Scurtatura este salvata si pe Desktop: Smart Kiosk (!LOC_NAME!).lnk
echo.

set "RUN_NOW=D"
set /p "RUN_NOW=Pornesc ecranul acum in Fullscreen? (D/N, Enter = Da): "
if /i "!RUN_NOW!"=="N" (
    echo Gata! Poti inchide aceasta fereastra.
    timeout /t 3 >nul
    exit /b 0
)

start "" "!CHROME_PATH!" --kiosk "!KIOSK_URL!" --incognito --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-session-crashed-bubble
exit /b 0
