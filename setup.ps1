# =====================================================================
#   SMART KIOSK — INSTALATOR UNIVERSAL PENTRU TOATE LOCATIILE
#   Constanta | Cluj 1 | Cluj 2 | Brasov
# =====================================================================

param(
    [string]$Location = ""
)

$ErrorActionPreference = 'SilentlyContinue'

Clear-Host
Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host "       SMART KIOSK — INSTALARE SI CONFIGURARE AUTOMATA TOTALA" -ForegroundColor Cyan
Write-Host "=====================================================================`n" -ForegroundColor Cyan

if ($env:KIOSK_LOC) { $Location = $env:KIOSK_LOC }

# Daca nu este specificata locatia prin parametru, afisam meniu simplu
if (-not $Location) {
    Write-Host "Alege locatia pentru acest calculator:" -ForegroundColor Yellow
    Write-Host "  1. Constanta 1  (COM7 | XP-80)"
    Write-Host "  2. Cluj 1       (Centru - COM4 | EPSON)"
    Write-Host "  3. Cluj 2       (COM1 | EPSON)"
    Write-Host "  4. Brasov       (RollMaster - COM3 | EPSON)"
    Write-Host "  5. Constanta 2  (COM7 | XP-80)"
    Write-Host ""
    $opt = Read-Host "Introdu numarul locatiei (1-5, implicit 1 pentru Constanta)"
    if ($opt -eq '2') { $Location = 'cluj1' }
    elseif ($opt -eq '3') { $Location = 'cluj2' }
    elseif ($opt -eq '4') { $Location = 'sm-brasov' }
    elseif ($opt -eq '5') { $Location = 'constanta2' }
    else { $Location = 'constanta1' }
}

$configs = @{
    'constanta1' = @{
        Name = 'Constanta 1'; Port = 'COM7'; Printer = 'XP-80'; Gateway = 'raiffeisen'; Url = 'https://kiosk-smashme.netlify.app/?loc=constanta1'
    };
    'cluj1' = @{
        Name = 'Cluj 1 (Centru)'; Port = 'COM4'; Printer = 'EPSON TM-T20'; Gateway = 'raiffeisen'; Url = 'https://kiosk-smashme.netlify.app/?loc=cluj1'
    };
    'cluj2' = @{
        Name = 'Cluj 2'; Port = 'COM1'; Printer = 'EPSON TM-T20III Receipt'; Gateway = 'raiffeisen'; Url = 'https://kiosk-smashme.netlify.app/?loc=cluj2'
    };
    'sm-brasov' = @{
        Name = 'Brasov (RollMaster)'; Port = 'COM3'; Printer = 'EPSON TM-T20'; Gateway = 'raiffeisen'; Url = 'https://kiosk-smashme.netlify.app/?loc=sm-brasov'
    };
    'constanta2' = @{
        Name = 'Constanta 2'; Port = 'COM7'; Printer = 'XP-80'; Gateway = 'raiffeisen'; Url = 'https://kiosk-smashme.netlify.app/?loc=constanta2'
    }
}

$cfg = $configs[$Location]
if (-not $cfg) { $cfg = $configs['constanta1']; $Location = 'constanta1' }

Write-Host "`n[CONFIGURARE SELECTATA: $($cfg.Name)]" -ForegroundColor Green
Write-Host "  - Port POS: $($cfg.Port)"
Write-Host "  - Imprimanta: $($cfg.Printer)"
Write-Host "  - Ecran Kiosk: $($cfg.Url)`n"

# 1. Determinare folder tinta
$targetDir = $PWD.Path
if (-not (Test-Path "$targetDir\index.js")) {
    $candidates = @(
        'C:\Smart Kiosk\kiosk-constanta',
        'C:\Smart Kiosk\packages\pos-bridge',
        'C:\SmartKiosk\packages\pos-bridge',
        'C:\Smart Kiosk',
        'C:\SmartKiosk',
        'C:\pos-bridge',
        'C:\kiosk-constanta',
        'C:\kiosk-cluj',
        'C:\kiosk-brasov',
        'C:\kiosk',
        "$env:USERPROFILE\Desktop\kiosk-constanta",
        "$env:USERPROFILE\Desktop\Smart Kiosk\kiosk-constanta",
        "$env:USERPROFILE\Desktop\pos-bridge",
        "$env:USERPROFILE\Desktop\SmartKiosk",
        "$env:USERPROFILE\Downloads\kiosk-constanta"
    )
    $found = $candidates | Where-Object { Test-Path "$_\index.js" } | Select-Object -First 1
    if (-not $found) {
        $found = (Get-ChildItem -Path @('C:\', "$env:USERPROFILE\Desktop") -Filter 'index.js' -Recurse -Depth 3 -ErrorAction SilentlyContinue | Where-Object { Test-Path "$($_.DirectoryName)\package.json" } | Select-Object -First 1).DirectoryName
    }
    if ($found) { $targetDir = $found }
}
Set-Location $targetDir
Write-Host "[1/6] Folder aplicatie: $targetDir" -ForegroundColor Green

# 2. Salvare / Actualizare .env
$envContent = @"
# Configurare POS Bridge si Imprimanta $($cfg.Name)
RENDER_URL=https://smart-kiosk-ttut.onrender.com
COM_PORT=$($cfg.Port)
BAUD_RATE=9600
LOCATION_ID=$Location
BRIDGE_KEY=pos-bridge-2024
POS_GATEWAY=$($cfg.Gateway)
PRINTER_NAME=$($cfg.Printer)
"@
Set-Content -Path "$targetDir\.env" -Value $envContent -Force
Write-Host "[2/6] Fisier .env salvat cu succes." -ForegroundColor Green

# 3. Dezactivare Sleep, Standby si Hibernare
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
Write-Host "[3/6] Sleep si Standby PC dezactivate complet." -ForegroundColor Green

# 4. Dezactivare USB Selective Suspend si Power Saving la USB Root Hub
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8685-5b0887e3290d 48e6b7a6-50f5-4760-a579-e4c11dd81862 0
powercfg /setactive SCHEME_CURRENT
Get-CimInstance -ClassName MSPower_DeviceEnable -Namespace root\wmi | ForEach-Object {
    $_.Enable = $false
    Set-CimInstance -CimInstance $_
}
Write-Host "[4/6] USB Selective Suspend si Power Saving la USB dezactivate." -ForegroundColor Green

# 5. Descarcare fisiere VBS optimizate cu suport pentru spatii in cale
curl.exe -s -O https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/kiosk-constanta/watchdog.vbs
curl.exe -s -O https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/kiosk-constanta/run-hidden.vbs
if (-not (Test-Path "$targetDir\start-windows.bat")) {
    curl.exe -s -O https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/start-windows.bat
}

# Inregistrare Watchdog in Windows Task Scheduler (la fiecare 1 minut)
schtasks /create /tn "SmartKiosk_POS_Watchdog" /tr "wscript.exe `"$targetDir\watchdog.vbs`"" /sc minute /mo 1 /f
schtasks /create /tn "SmartKiosk_POS_OnLogon" /tr "wscript.exe `"$targetDir\watchdog.vbs`"" /sc onlogon /f
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'POSBridge' -Value "wscript.exe `"$targetDir\run-hidden.vbs`""

# 5. Configurare Windows Taskbar Auto-Hide (elimina definitiv bara cu iconite Windows)
$p3 = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3"
if (Test-Path $p3) {
    $v3 = (Get-ItemProperty -Path $p3).Settings
    if ($v3 -and $v3.Length -gt 8) {
        $v3[8] = 3
        Set-ItemProperty -Path $p3 -Name "Settings" -Value $v3
    }
}
$p2 = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects2"
if (Test-Path $p2) {
    $v2 = (Get-ItemProperty -Path $p2).Settings
    if ($v2 -and $v2.Length -gt 8) {
        $v2[8] = 3
        Set-ItemProperty -Path $p2 -Name "Settings" -Value $v2
    }
}
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" -Name "SearchboxTaskbarMode" -Value 0 -Force
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowTaskViewButton" -Value 0 -Force
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarMn" -Value 0 -Force
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarDa" -Value 0 -Force
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue

# Configurare Chrome Kiosk in Autostart si Desktop cu profil izolat dedicat
$chrome = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    $profileDir = "C:\SmartKiosk_Data"
    if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }
    $kioskArgs = "--kiosk `"$($cfg.Url)`" --user-data-dir=`"$profileDir`" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --disable-features=Translate,OptimizationHints,MediaRouter --check-for-update-interval=31536000 --disable-component-update"
    
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'SmartKioskScreen' -Value "`"$chrome`" $kioskArgs"
    
    $wsh = New-Object -ComObject WScript.Shell
    $desktop = [Environment]::GetFolderPath('Desktop')
    $sc = $wsh.CreateShortcut("$desktop\Smart Kiosk Fullscreen.lnk")
    $sc.TargetPath = $chrome
    $sc.Arguments = $kioskArgs
    $sc.WindowStyle = 3
    $sc.Save()

    $batContent = @"
@echo off
title Pornire Kiosk Fullscreen
taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1
timeout /t 1 >nul
start "" "$chrome" $kioskArgs
exit
"@
    Set-Content -Path "$desktop\Porneste Kiosk Fullscreen.bat" -Value $batContent -Force
    Set-Content -Path "$targetDir\reporneste_fullscreen.bat" -Value $batContent -Force

    Write-Host "[5/6] Taskbar Auto-Hide, Task Scheduler si Chrome Kiosk Fullscreen configurate." -ForegroundColor Green
} else {
    Write-Host "[5/6] Task Scheduler configurat." -ForegroundColor Green
}

# 6. Pornire imediata a POS Bridge-ului in fundal
Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"`"$targetDir\start-windows.bat`"`"" -WindowStyle Hidden
Write-Host "[6/6] POS Bridge pornit pe loc in fundal pe $($cfg.Port)." -ForegroundColor Green

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "   [SUCCES TOTAL] $($cfg.Name.ToUpper()) ESTE ACTIVAT SI CONFIGURAT!" -ForegroundColor Green
Write-Host "   1. POS Bridge ruleaza in fundal pe $($cfg.Port)." -ForegroundColor Green
Write-Host "   2. Watchdog-ul automat ruleaza la fiecare 1 minut prin Task Scheduler." -ForegroundColor Green
Write-Host "   3. Porturile USB si PC-ul nu vor mai intra NICIODATA in Sleep." -ForegroundColor Green
Write-Host "   4. La fiecare restart de PC, totul porneste automat singur." -ForegroundColor Green
Write-Host "=====================================================================`n" -ForegroundColor Green
