@echo off
title Configurare Smart Kiosk — Autostart Fullscreen Windows
color 0B
chcp 65001 >nul

echo.
echo  ╔═════════════════════════════════════════════════════════════╗
echo  ║       SMART KIOSK — CONFIGURARE AUTOSTART FULLSCREEN        ║
echo  ║       Ascunde complet bara de jos si porneste la boot       ║
echo  ╚═════════════════════════════════════════════════════════════╝
echo.

:: 1. Detectare automata Google Chrome sau Edge
set "BROWSER_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

if "%BROWSER_EXE%"=="" (
    color 0C
    echo  [EROARE] Nu s-a gasit Google Chrome sau Edge instalat pe acest PC!
    echo  Te rugam sa instalezi Google Chrome si sa reiei rularea.
    echo.
    pause
    exit /b 1
)

echo  [OK] Browser detectat: %BROWSER_EXE%
echo.

:: 2. Selectare Locatie Kiosk
echo  Alege locatia pentru acest ecran:
echo   [1] Cluj Kiosk 1 (cluj1) -- IMPLICIT
echo   [2] Cluj Kiosk 2 (cluj2)
echo   [3] Brasov (sm-brasov)
echo   [4] Introdu alt URL manual
echo.
set "LOC_CHOICE=1"
set /p LOC_CHOICE="Alege optiunea (1-4, apasa Enter pentru [1]): "

if "%LOC_CHOICE%"=="2" (
    set "TARGET_URL=https://kiosk-smashme.netlify.app/?loc=cluj2"
    set "LOC_NAME=Cluj-2"
) else if "%LOC_CHOICE%"=="3" (
    set "TARGET_URL=https://kiosk-smashme.netlify.app/?loc=sm-brasov"
    set "LOC_NAME=Brasov"
) else if "%LOC_CHOICE%"=="4" (
    set /p TARGET_URL="Introdu adresa URL completa: "
    set "LOC_NAME=Custom"
) else (
    set "TARGET_URL=https://kiosk-smashme.netlify.app/?loc=cluj1"
    set "LOC_NAME=Cluj-1"
)

echo.
echo  [INFO] URL Kiosk: %TARGET_URL%
echo.

:: 3. Parametri Kiosk Fullscreen
set "KIOSK_ARGS=--kiosk ^"%TARGET_URL%^" --incognito --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-session-crashed-bubble --check-for-update-interval=31536000"

:: 4. Creare scurtaturi in Autostart (Startup) si pe Desktop
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"

echo  [INFO] Instalez scurtatura in Windows Startup (Autostart la aprindere)...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s1 = $ws.CreateShortcut('%STARTUP_DIR%\SmartKiosk_Fullscreen.lnk'); $s1.TargetPath = '%BROWSER_EXE%'; $s1.Arguments = '%KIOSK_ARGS%'; $s1.WindowStyle = 3; $s1.Save(); $s2 = $ws.CreateShortcut('%DESKTOP_DIR%\Smart Kiosk (%LOC_NAME%).lnk'); $s2.TargetPath = '%BROWSER_EXE%'; $s2.Arguments = '%KIOSK_ARGS%'; $s2.WindowStyle = 3; $s2.Save();"

echo.
echo  ╔═════════════════════════════════════════════════════════════╗
echo  ║      [SUCCES] KIOSKUL A FOST CONFIGURAT CU AUTOSTART!       ║
echo  ╚═════════════════════════════════════════════════════════════╝
echo.
echo   - La fiecare aprindere a PC-ului, Kioskul va porni AUTOMAT.
echo   - Va rula 100%% in Full Screen (fara bara de jos, fara taburi).
echo   - A fost creata si o scurtatura pe Desktop:
echo     'Smart Kiosk (%LOC_NAME%).lnk'
echo.

set "RUN_NOW=D"
set /p RUN_NOW="Vrei sa pornesti ecranul chiar acum in Fullscreen? (D/N, apasa Enter pentru D): "
if /i "%RUN_NOW%"=="N" (
    echo.
    echo  Configurare finalizata cu succes!
    timeout /t 3 >nul
    exit /b 0
)

start "" "%BROWSER_EXE%" --kiosk "%TARGET_URL%" --incognito --disable-pinch --overscroll-history-navigation=0 --noerrdialogs --disable-session-crashed-bubble
exit /b 0
