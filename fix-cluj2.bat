@echo off
chcp 65001 >nul
title Smart Kiosk - Configurare Cluj 2 Fullscreen
color 0A
cls
echo =============================================================
echo   SMART KIOSK — CONFIGURARE CLUJ 2 FULLSCREEN TOTAL
echo =============================================================
echo.

:: 1. Inchidere instante vechi de Chrome si Edge
echo [1/5] Inchidere procese vechi...
taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1

:: 2. Dezactivare Sleep, Standby si USB Sleep
echo [2/5] Dezactivare Sleep si Standby PC / USB...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8685-5b0887e3290d 48e6b7a6-50f5-4760-a579-e4c11dd81862 0 >nul 2>&1
powercfg /setactive SCHEME_CURRENT >nul 2>&1

:: 3. Ascundere Taskbar Windows (Auto-Hide) prin PowerShell
echo [3/5] Ascundere Taskbar Windows (Auto-Hide)...
powershell -NoProfile -Command "$p='HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3'; if(Test-Path $p){$v=(Get-ItemProperty $p).Settings; if($v -and $v.Length -gt 8){$v[8]=3; Set-ItemProperty $p Settings $v}}; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' SearchboxTaskbarMode 0 -Force -ErrorAction SilentlyContinue; Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' ShowTaskViewButton 0 -Force -ErrorAction SilentlyContinue; Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue"

:: 4. Gasire Google Chrome sau Edge
echo [4/5] Cautare browser Chrome/Edge...
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
    echo [EROARE] Nu am gasit Google Chrome sau Edge instalat pe acest PC!
    echo Te rugam sa instalezi Google Chrome si sa reiei rularea.
    pause
    exit /b 1
)
echo [OK] Browser detectat: %BROWSER%

:: 5. Creare folder profil Kiosk izolat
if not exist "C:\SmartKiosk_Data" mkdir "C:\SmartKiosk_Data" >nul 2>&1

set "URL=https://kiosk-smashme.netlify.app/?loc=cluj2"
set "ARGS=--kiosk "%URL%" --user-data-dir="C:\SmartKiosk_Data" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --check-for-update-interval=31536000"

:: 6. Salvare Autostart si creare scurtatura Desktop
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Smart Kiosk (Cluj 2).lnk'); $sc.TargetPath = '%BROWSER%'; $sc.Arguments = '%ARGS%'; $sc.WindowStyle = 3; $sc.Save(); Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' 'SmartKioskScreen' '\"%BROWSER%\" %ARGS%'"

:: 7. Creare fisier de pornire rapida pe Desktop
(
echo @echo off
echo taskkill /F /IM chrome.exe ^>nul 2^>^&1
echo taskkill /F /IM msedge.exe ^>nul 2^>^&1
echo timeout /t 1 ^>nul
echo start "" "%BROWSER%" %ARGS%
echo exit
) > "%USERPROFILE%\Desktop\Porneste Kiosk Cluj 2.bat"

echo.
echo [5/5] Pornire Cluj 2 in Fullscreen...
timeout /t 2 >nul
start "" "%BROWSER%" %ARGS%

echo.
echo =============================================================
echo   [SUCCES] KIOSKUL CLUJ 2 A FOST PORNIT IN FULLSCREEN TOTAL!
echo   - Scurtatura si 'Porneste Kiosk Cluj 2.bat' create pe Desktop.
echo   - La restart de PC porneste automat.
echo =============================================================
echo.
timeout /t 5
