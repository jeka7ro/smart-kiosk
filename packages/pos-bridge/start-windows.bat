@echo off
chcp 65001 >nul
title Smart Kiosk - POS Bridge Raiffeisen
color 0A
echo.
echo ============================================
echo   SMART KIOSK - POS Bridge Raiffeisen
echo ============================================
echo.

cd /d "%~dp0"

:: Configurare automata PATH pentru Node.js daca e instalat in locatii standard
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
if exist "%AppData%\npm" set "PATH=%AppData%\npm;%PATH%"

:: Verifica daca Node.js e instalat
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [EROARE] Node.js nu este gasit in PATH!
    echo Se verifica locatiile standard C:\Program Files\nodejs...
    exit /b 1
)

echo  [INFO] Verific actualizari din Cloud...
curl -s -L -H "Cache-Control: no-cache" -o index.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js?ts=%random%%random%"
curl -s -L -H "Cache-Control: no-cache" -o printer.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/printer.js?ts=%random%%random%"
curl -s -L -H "Cache-Control: no-cache" -o rawprint.ps1 "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/rawprint.ps1?ts=%random%%random%"
curl -s -L -H "Cache-Control: no-cache" -o scan_port_pc.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/scan_port_pc.js?ts=%random%%random%"
curl -s -L -H "Cache-Control: no-cache" -o PrinterServiceDatecsFP950.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/PrinterServiceDatecsFP950.js?ts=%random%%random%"
curl -s -L -H "Cache-Control: no-cache" -o VivaPosService.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/VivaPosService.js?ts=%random%%random%"
curl -s -L -H "Cache-Control: no-cache" -o package.json "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/package.json?ts=%random%%random%"
if not exist "run-hidden.vbs" curl -s -L -H "Cache-Control: no-cache" -o run-hidden.vbs "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/run-hidden.vbs"
echo  [INFO] Fisiere actualizate cu succes!

:: Verifica daca exista .env (creeaza automat daca lipseste)
if not exist ".env" (
    echo  [EROARE] Fisierul .env lipseste in acest folder!
    echo  Rulati configuratorul setup_kiosk_autostart.bat pentru a alege locatia corecta.
    pause
    exit /b 1
)

:: Instaleaza dependentele daca lipsesc
if not exist "node_modules\dotenv" (
    echo  [INFO] Instalez dependentele necesare...
    call npm install --no-audit --no-fund
    echo.
)

:: Inchide orice instanta anterioara blocata de node.exe pentru a elibera portul COM
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 >nul

echo  [INFO] Pornesc POS Bridge din folderul curent: %~dp0
echo  [INFO] Apasa Ctrl+C pentru a opri
echo.

:loop
curl -s -L -H "Cache-Control: no-cache" -o index.js.tmp "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/index.js?ts=%random%%random%"
if exist "index.js.tmp" (
    for %%A in ("index.js.tmp") do if "%%~zA" neq "" if %%~zA GTR 10000 move /y "index.js.tmp" "index.js" >nul 2>&1
    if exist "index.js.tmp" del /f /q "index.js.tmp" >nul 2>&1
)
curl -s -L -H "Cache-Control: no-cache" -o printer.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/printer.js?ts=%random%%random%"
curl -s -L -H "Cache-Control: no-cache" -o rawprint.ps1 "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/rawprint.ps1?ts=%random%%random%"
curl -s -L -H "Cache-Control: no-cache" -o scan_port_pc.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/scan_port_pc.js?ts=%random%%random%"
curl -s -L -H "Cache-Control: no-cache" -o watchdog.vbs "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/watchdog.vbs?ts=%random%%random%"
start "" /b wscript.exe watchdog.vbs
node index.js
if %errorlevel% equ 42 (
    echo.
    echo  [INFO] O instanta activa a POS Bridge ruleaza deja pe acest PC.
    echo  [INFO] Aceasta fereastra ramane in standby (reverificare in 5 secunde)...
    ping 127.0.0.1 -n 6 >nul
    goto loop
)
echo.
echo  [WARN] Procesul s-a oprit - repornesc automat in 1 secunda...
ping 127.0.0.1 -n 2 >nul
goto loop
