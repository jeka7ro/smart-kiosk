@echo off
chcp 65001 >nul
title Smart Kiosk - Configurare Permanenta Constanta
color 0A

echo.
echo =====================================================================
echo    CONFIGURARE PERMANENTA SMART KIOSK CONSTANTA 1
echo    - POS: COM7 (Raiffeisen Verifone)
echo    - Imprimanta: XP-80
echo    - URL: https://kiosk-smashme.netlify.app/?loc=constanta1
echo =====================================================================
echo.

cd /d "%~dp0"
set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"

echo [1/6] Verificare Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [EROARE] Node.js nu este instalat pe acest calculator!
    echo Te rugam sa instalezi Node.js LTS de pe https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo   [OK] Node.js este instalat: %%v

echo.
echo [2/6] Configurare fisier .env pentru Constanta 1...
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
echo   [OK] Fisierul .env a fost salvat.

echo.
echo [3/6] Verificare pachete npm (dotenv, serialport, socket.io-client)...
if not exist "%APP_DIR%\node_modules\dotenv" (
    echo   Instalez pachetele necesare...
    call npm install --no-audit --no-fund
    echo   [OK] Pachetele au fost instalate.
) else (
    echo   [OK] Pachetele sunt deja instalate.
)

echo.
echo [4/6] Dezactivare Windows Sleep si Oprire Ecran...
powercfg /change standby-timeout-ac 0 >nul 2>nul
powercfg /change monitor-timeout-ac 0 >nul 2>nul
powercfg /change hibernate-timeout-ac 0 >nul 2>nul
echo   [OK] PC-ul a fost setat sa ramana activ permanent (fara Sleep/Standby).

schtasks /create /tn "SmartKiosk_POS_Watchdog" /tr "wscript.exe \"%APP_DIR%\watchdog.vbs\"" /sc minute /mo 1 /f >nul 2>nul
schtasks /create /tn "SmartKiosk_POS_OnLogon" /tr "wscript.exe \"%APP_DIR%\watchdog.vbs\"" /sc onlogon /f >nul 2>nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "POSBridge" /t REG_SZ /d "wscript.exe \"%APP_DIR%\run-hidden.vbs\"" /f >nul 2>nul

REM Cautare browser pentru ecran Fullscreen Kiosk
set "CHROME_BIN="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined CHROME_BIN if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_BIN=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not defined CHROME_BIN if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_BIN=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_BIN if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "CHROME_BIN=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not defined CHROME_BIN if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "CHROME_BIN=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if defined CHROME_BIN (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "SmartKioskScreen" /t REG_SZ /d "\"%CHROME_BIN%\" --kiosk https://kiosk-smashme.netlify.app/?loc=constanta1 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check" /f >nul 2>nul
    echo   [OK] Ecranul Kiosk configurat in autostart: %CHROME_BIN%
)

echo.
echo [6/6] Pornesc POS Bridge in fundal chiar acum...
wscript.exe "%APP_DIR%\run-hidden.vbs"
echo   [OK] POS Bridge a fost pornit in fundal!

echo.
echo =====================================================================
echo   [SUCCES TOTAL] CONFIGURARE COMPLETA SI PERMANENTA!
echo =====================================================================
echo.
echo   Ce este activat acum:
echo   1. POS Bridge ruleaza in fundal (pe COM7).
echo   2. Watchdog-ul automat ruleaza la fiecare 1 minut prin Task Scheduler:
echo      - Daca programul se opreste sau e inchis, este repornit automat!
echo      - La orice restart de calculator, porneste automat!
echo   3. Calculatorul nu va mai intra niciodata in Sleep sau Standby.
echo.
echo Apasati orice tasta pentru a finaliza...
pause >nul
