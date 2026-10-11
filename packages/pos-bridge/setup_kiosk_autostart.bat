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

set "LOC_ID=cluj2"
set "LOC_NAME=Cluj 2"
set "URL=https://kiosk-smashme.netlify.app/?loc=cluj2"

if "%CHOICE%"=="1" (
    set "LOC_ID=cluj1"
    set "LOC_NAME=Cluj 1"
    set "URL=https://kiosk-smashme.netlify.app/?loc=cluj1"
)
if "%CHOICE%"=="2" (
    set "LOC_ID=cluj2"
    set "LOC_NAME=Cluj 2"
    set "URL=https://kiosk-smashme.netlify.app/?loc=cluj2"
)
if "%CHOICE%"=="3" (
    set "LOC_ID=sm-brasov"
    set "LOC_NAME=Brasov"
    set "URL=https://kiosk-smashme.netlify.app/?loc=sm-brasov"
)
if "%CHOICE%"=="4" (
    set "LOC_ID=constanta1"
    set "LOC_NAME=Constanta 1"
    set "URL=https://kiosk-smashme.netlify.app/?loc=constanta1"
)
if "%CHOICE%"=="5" (
    set "LOC_ID=constanta2"
    set "LOC_NAME=Constanta 2"
    set "URL=https://kiosk-smashme.netlify.app/?loc=constanta2"
)

echo.
echo [INFO] Ai selectat: %LOC_NAME% (%URL%)
echo.

:: 1. Inchidere instante vechi browser
echo [1/6] Inchidere ferestre browser existente...
taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1

:: 2. Dezactivare Sleep, Standby si Oprire Monitor (Anti-Sleep)
echo [2/6] Dezactivare Sleep, Standby si Oprire Monitor in Windows...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8685-5b0887e3290d 48e6b7a6-50f5-4760-a579-e4c11dd81862 0 >nul 2>&1
powercfg /setactive SCHEME_CURRENT >nul 2>&1

:: 3. Activare permanenta Auto-Hide Taskbar in Windows Settings si reincarcare Explorer
echo [3/6] Activare automata 'Auto-Hide Taskbar' in setarile Windows...
powershell -NoProfile -Command "$keys = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects2', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\MMStuckRects3'); foreach($k in $keys){ if(Test-Path $k){ $v=(Get-ItemProperty $k).Settings; if($v -and $v.Length -gt 8){ $v[8]=3; Set-ItemProperty $k Settings $v } } }; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' SearchboxTaskbarMode 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' ShowTaskViewButton 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' TaskbarDa 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' TaskbarMn 0 -Force -ErrorAction SilentlyContinue; taskkill /f /im explorer.exe; start explorer.exe" >nul 2>&1

:: 4. Gasire Google Chrome sau Microsoft Edge
echo [4/6] Cautare browser Chrome / Edge...
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

:: 5. Creare folder profil Kiosk izolat
if not exist "C:\SmartKiosk_Data" mkdir "C:\SmartKiosk_Data" >nul 2>&1

:: 6. Salvare Autostart si Scurtaturi Desktop
echo [5/6] Configurare Autostart la pornirea Windows si creare scurtaturi...
powershell -NoProfile -Command "$w=New-Object -Com WScript.Shell; $d=[Environment]::GetFolderPath('Desktop'); $s=$w.CreateShortcut(\"$d\Smart Kiosk (%LOC_NAME%).lnk\"); $s.TargetPath='%BROWSER%'; $s.Arguments='--kiosk %URL% --user-data-dir=C:\SmartKiosk_Data --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000'; $s.WindowStyle=3; $s.Save(); $u=[Environment]::GetFolderPath('Startup'); $s2=$w.CreateShortcut(\"$u\SmartKiosk.lnk\"); $s2.TargetPath='%BROWSER%'; $s2.Arguments='--kiosk %URL% --user-data-dir=C:\SmartKiosk_Data --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000'; $s2.WindowStyle=3; $s2.Save()" >nul 2>&1

:: 7. Lansare Kiosk Fullscreen
echo [6/6] Pornire ecran Kiosk in Fullscreen Total...
timeout /t 2 >nul
start "" "%BROWSER%" --kiosk "%URL%" --user-data-dir="C:\SmartKiosk_Data" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000

echo.
echo =============================================================
echo   [SUCCES TOTAL] KIOSKUL A FOST CONFIGURAT COMPLET!
echo =============================================================
echo   - Locatie activa: %LOC_NAME% (%URL%)
echo   - Auto-Hide Taskbar activat definitiv in Windows.
echo   - Sleep si Standby dezactivate (ecranul ramane mereu aprins).
echo   - Modul Fullscreen Kiosk a fost pornit.
echo   - Scurtatura creata pe Desktop si in Autostart.
echo =============================================================
echo.
echo Aceasta fereastra NU se inchide automat pentru a putea citi mesajul.
echo Apasa orice tasta cand doresti sa o inchizi...
pause
