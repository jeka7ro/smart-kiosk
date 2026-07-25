@echo off
title Smart Kiosk — POS Bridge Raiffeisen
color 0A
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   SMART KIOSK — POS Bridge Raiffeisen   ║
echo  ╚══════════════════════════════════════════╝
echo.

cd /d C:\kiosk_jk\pos-bridge

:: Verifica daca Node.js e instalat
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo  [EROARE] Node.js nu este instalat!
    echo  Descarca de la: https://nodejs.org/en/download
    echo.
    pause
    exit /b 1
)

:: Verifica daca exista .env
if not exist ".env" (
    color 0E
    echo  [ATENTIE] Fisierul .env nu exista!
    echo  Copiaza .env.example ca .env si configureaza-l.
    echo.
    pause
    exit /b 1
)

:: Instaleaza dependentele daca lipsesc
if not exist "node_modules" (
    echo  [INFO] Prima pornire - instalez dependentele...
    npm install
    echo.
)

echo  [INFO] Pornesc POS Bridge din C:\kiosk_jk\pos-bridge
echo  [INFO] Apasa Ctrl+C pentru a opri
echo.

:loop
node index.js
echo.
echo  [WARN] Bridge oprit - repornesc in 5 secunde...
timeout /t 5 /nobreak >nul
goto loop
