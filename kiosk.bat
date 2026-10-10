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
echo [1/5] Inchidere ferestre browser existente...
taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1

:: 2. Dezactivare Sleep si Standby PC / Monitor
echo [2/5] Dezactivare Sleep, Standby si Oprire Monitor...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1

:: 3. Ascundere completa Taskbar Windows prin Win32 API (fara restart explorer)
echo [3/5] Ascundere Taskbar Windows...
powershell -NoProfile -Command "$c='[DllImport(\"user32.dll\")] public static extern IntPtr FindWindow(string c, string n); [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h, int m);'; Add-Type -MemberDefinition $c -Name U -Namespace W -ErrorAction SilentlyContinue; [W.U]::ShowWindow([W.U]::FindWindow('Shell_TrayWnd',$null), 0); [W.U]::ShowWindow([W.U]::FindWindow('Shell_SecondaryTrayWnd',$null), 0); $p='HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3'; if(Test-Path $p){$v=(Get-ItemProperty $p).Settings; if($v -and $v.Length -gt 8){$v[8]=3; Set-ItemProperty $p Settings $v}}" >nul 2>&1

:: 4. Gasire Google Chrome sau Microsoft Edge
echo [4/5] Cautare browser Chrome / Edge...
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

:: 6. Salvare Autostart si Scurtatura Desktop
echo [5/5] Salvare scurtaturi Desktop si Autostart la pornirea Windows...
powershell -NoProfile -Command "$w=New-Object -Com WScript.Shell; $d=[Environment]::GetFolderPath('Desktop'); $s=$w.CreateShortcut(\"$d\Smart Kiosk (%LOC_NAME%).lnk\"); $s.TargetPath='%BROWSER%'; $s.Arguments='--kiosk %URL% --user-data-dir=C:\SmartKiosk_Data --start-fullscreen'; $s.Save(); $u=[Environment]::GetFolderPath('Startup'); $s2=$w.CreateShortcut(\"$u\SmartKiosk.lnk\"); $s2.TargetPath='%BROWSER%'; $s2.Arguments='--kiosk %URL% --user-data-dir=C:\SmartKiosk_Data --start-fullscreen'; $s2.Save()" >nul 2>&1

:: 7. Lansare Kiosk Fullscreen
echo.
echo Pornire ecran Kiosk in Fullscreen Total...
timeout /t 1 >nul
start "" "%BROWSER%" --kiosk "%URL%" --user-data-dir="C:\SmartKiosk_Data" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000

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
pause
