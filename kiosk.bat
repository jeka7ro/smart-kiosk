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

if "%CHOICE%"=="1" (
    set "LOC_ID=cluj1"
    set "LOC_NAME=Cluj 1"
    set "URL=https://kiosk-smashme.netlify.app/?loc=cluj1"
) else if "%CHOICE%"=="2" (
    set "LOC_ID=cluj2"
    set "LOC_NAME=Cluj 2"
    set "URL=https://kiosk-smashme.netlify.app/?loc=cluj2"
) else if "%CHOICE%"=="3" (
    set "LOC_ID=sm-brasov"
    set "LOC_NAME=Brasov"
    set "URL=https://kiosk-smashme.netlify.app/?loc=sm-brasov"
) else if "%CHOICE%"=="4" (
    set "LOC_ID=constanta1"
    set "LOC_NAME=Constanta 1"
    set "URL=https://kiosk-smashme.netlify.app/?loc=constanta1"
) else if "%CHOICE%"=="5" (
    set "LOC_ID=constanta2"
    set "LOC_NAME=Constanta 2"
    set "URL=https://kiosk-smashme.netlify.app/?loc=constanta2"
) else (
    echo.
    echo Optiune invalida sau neintrodusa! Setat implicit pe Cluj 2.
    set "LOC_ID=cluj2"
    set "LOC_NAME=Cluj 2"
    set "URL=https://kiosk-smashme.netlify.app/?loc=cluj2"
)

echo.
echo [INFO] Ai selectat: %LOC_NAME% (%URL%)
echo.

:: 1. Inchidere instante vechi browser
echo [1/5] Inchidere ferestre browser existente...
taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1

:: 2. Dezactivare Sleep si Standby PC / Monitor
echo [2/5] Dezactivare Sleep, Standby si Oprire Monitor...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8685-5b0887e3290d 48e6b7a6-50f5-4760-a579-e4c11dd81862 0 >nul 2>&1
powercfg /setactive SCHEME_CURRENT >nul 2>&1

:: 3. Ascundere automata Taskbar Windows (fara a forta oprirea explorer care inchide CMD)
echo [3/5] Configurare bara Windows (Auto-Hide Taskbar)...
powershell -NoProfile -Command "$p='HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3'; if(Test-Path $p){$v=(Get-ItemProperty $p).Settings; if($v -and $v.Length -gt 8){$v[8]=3; Set-ItemProperty $p Settings $v}}; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' SearchboxTaskbarMode 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' ShowTaskViewButton 0 -Force -ErrorAction SilentlyContinue" >nul 2>&1

:: 4. Gasire Google Chrome sau Microsoft Edge
echo [4/5] Cautare browser Chrome / Edge...
set "BROWSER="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "BROWSER=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "BROWSER=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "BROWSER=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "BROWSER=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER (
    for /f "tokens=*" %%i in ('where chrome.exe 2^>nul') do set "BROWSER=%%i"
)
if not defined BROWSER (
    for /f "tokens=*" %%i in ('where msedge.exe 2^>nul') do set "BROWSER=%%i"
)

if not defined BROWSER (
    color 0C
    echo.
    echo [EROARE] Nu s-a gasit Google Chrome sau Edge instalat!
    echo Te rugam sa instalezi Google Chrome si sa reiei rularea.
    echo.
    pause
    exit /b 1
)

echo [OK] Browser gasit: %BROWSER%

:: 5. Creare folder profil Kiosk izolat
if not exist "C:\SmartKiosk_Data" mkdir "C:\SmartKiosk_Data" >nul 2>&1

set "ARGS=--kiosk "%URL%" --user-data-dir="C:\SmartKiosk_Data" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000"

:: 6. Salvare Autostart si Scurtatura Desktop
echo [5/5] Salvare scurtaturi Desktop si Autostart la pornirea Windows...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $sc = $ws.CreateShortcut(\"$desktop\Smart Kiosk (%LOC_NAME%).lnk\"); $sc.TargetPath = '%BROWSER%'; $sc.Arguments = '%ARGS%'; $sc.WindowStyle = 3; $sc.Save(); $startup = [Environment]::GetFolderPath('Startup'); $sc2 = $ws.CreateShortcut(\"$startup\SmartKiosk.lnk\"); $sc2.TargetPath = '%BROWSER%'; $sc2.Arguments = '%ARGS%'; $sc2.WindowStyle = 3; $sc2.Save(); Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' 'SmartKioskScreen' '\"%BROWSER%\" %ARGS%'" >nul 2>&1

:: Creare fisier pornire rapida pe Desktop
(
echo @echo off
echo taskkill /F /IM chrome.exe ^>nul 2^>^&1
echo taskkill /F /IM msedge.exe ^>nul 2^>^&1
echo timeout /t 1 ^>nul
echo start "" "%BROWSER%" %ARGS%
echo exit
) > "%USERPROFILE%\Desktop\Porneste Kiosk (%LOC_NAME%).bat"

:: 7. Lansare Kiosk Fullscreen
echo.
echo Pornire ecran Kiosk in Fullscreen Total...
timeout /t 1 >nul
start "" "%BROWSER%" %ARGS%

echo.
echo =============================================================
echo   [SUCCES] KIOSKUL A FOST CONFIGURAT SI LANSAT CU SUCCES!
echo =============================================================
echo   - Locatie activa: %LOC_NAME% (%URL%)
echo   - Modul Fullscreen Kiosk a fost pornit.
echo   - Standby si Sleep au fost dezactivate pe PC.
echo   - Scurtatura a fost creata pe Desktop si in Autostart.
echo =============================================================
echo.
echo Aceasta fereastra NU se inchide automat pentru a putea verifica statusul.
echo Apasa orice tasta cand doresti sa o inchizi...
pause >nul
