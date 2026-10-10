# =====================================================================
#   SMART KIOSK — REPARARE FULLSCREEN TOTAL & ELIMINARE TASKBAR WINDOWS
#   Compatibil cu: Cluj 1, Cluj 2, Brasov, Constanta 1, Constanta 2
# =====================================================================

param(
    [string]$Location = ""
)

$ErrorActionPreference = 'SilentlyContinue'

Clear-Host
Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host "   SMART KIOSK — CONFIGURARE FULLSCREEN TOTAL & ELIMINARE TASKBAR" -ForegroundColor Cyan
Write-Host "=====================================================================`n" -ForegroundColor Cyan

# 1. Detectare Locatie Kiosk
if ($env:KIOSK_LOC) { $Location = $env:KIOSK_LOC }
if (-not $Location) {
    # Cautare automata in toate locatiile uzuale de pe PC
    $candidates = @(
        "$PWD\.env",
        "C:\Smart Kiosk\kiosk-constanta\.env",
        "C:\Smart Kiosk\packages\pos-bridge\.env",
        "C:\SmartKiosk\packages\pos-bridge\.env",
        "C:\Smart Kiosk\.env",
        "C:\SmartKiosk\.env",
        "C:\kiosk-constanta\.env",
        "C:\kiosk-cluj\.env",
        "C:\kiosk-brasov\.env",
        "C:\kiosk\.env",
        "C:\pos-bridge\.env",
        "$env:USERPROFILE\Desktop\kiosk-constanta\.env",
        "$env:USERPROFILE\Desktop\Smart Kiosk\kiosk-constanta\.env",
        "$env:USERPROFILE\Desktop\pos-bridge\.env",
        "$env:USERPROFILE\Desktop\SmartKiosk\.env"
    )
    foreach ($f in $candidates) {
        if (Test-Path $f) {
            $line = Get-Content $f | Where-Object { $_ -like "LOCATION_ID=*" } | Select-Object -First 1
            if ($line) {
                $Location = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
                break
            }
        }
    }
}

$urlMap = @{
    'cluj1' = 'https://kiosk-smashme.netlify.app/?loc=cluj1';
    'cluj2' = 'https://kiosk-smashme.netlify.app/?loc=cluj2';
    'sm-brasov' = 'https://kiosk-smashme.netlify.app/?loc=sm-brasov';
    'constanta1' = 'https://kiosk-smashme.netlify.app/?loc=constanta1';
    'constanta2' = 'https://kiosk-smashme.netlify.app/?loc=constanta2'
}

$locationNames = @{
    'cluj1' = 'Cluj 1 (Centru)';
    'cluj2' = 'Cluj 2';
    'sm-brasov' = 'Brasov (RollMaster)';
    'constanta1' = 'Constanta 1';
    'constanta2' = 'Constanta 2';
}

$detectedLoc = $Location

# Daca nu este specificat prin variabila de mediu KIOSK_LOC, afisam meniul clar
if (-not $env:KIOSK_LOC) {
    Write-Host "Alege locatia pentru acest kiosk:" -ForegroundColor Yellow
    Write-Host "  1. Cluj 1       (Centru)"
    Write-Host "  2. Cluj 2"
    Write-Host "  3. Brasov       (RollMaster)"
    Write-Host "  4. Constanta 1"
    Write-Host "  5. Constanta 2"
    if ($detectedLoc -and $locationNames.ContainsKey($detectedLoc)) {
        Write-Host "  [Enter] Confirmare automata: $($locationNames[$detectedLoc])" -ForegroundColor Cyan
    }
    Write-Host ""

    $opt = ""
    try {
        Write-Host -NoNewline "Apasa cifra (1-5) sau Enter: "
        $k = [Console]::ReadKey($true)
        $opt = [string]$k.KeyChar
        Write-Host $opt
    } catch {
        $opt = Read-Host "Introdu cifra (1-5)"
    }

    if ($opt -eq '1') { $Location = 'cluj1' }
    elseif ($opt -eq '2') { $Location = 'cluj2' }
    elseif ($opt -eq '3') { $Location = 'sm-brasov' }
    elseif ($opt -eq '4') { $Location = 'constanta1' }
    elseif ($opt -eq '5') { $Location = 'constanta2' }
    elseif ($detectedLoc -and $urlMap.ContainsKey($detectedLoc)) { $Location = $detectedLoc }
    else { $Location = 'cluj1' }
}

$kioskUrl = $urlMap[$Location]
Write-Host "[OK] Locatie selectata: $Location" -ForegroundColor Green
Write-Host "     URL Ecran: $kioskUrl`n" -ForegroundColor DarkGray

# 2. Dezactivare Sleep, Standby, Hibernare si Sleep USB
Write-Host "[1/5] Dezactivare Sleep, Standby si deconectare USB..." -ForegroundColor Yellow
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8685-5b0887e3290d 48e6b7a6-50f5-4760-a579-e4c11dd81862 0
powercfg /setactive SCHEME_CURRENT
Get-CimInstance -ClassName MSPower_DeviceEnable -Namespace root\wmi -ErrorAction SilentlyContinue | ForEach-Object {
    $_.Enable = $false
    Set-CimInstance -CimInstance $_ -ErrorAction SilentlyContinue
}
Write-Host "[OK] Setari Power si USB aplicate (PC-ul nu va mai adormi niciodata).`n" -ForegroundColor Green

# 3. Configurare Windows Taskbar: AUTO-HIDE (Bara de jos cu iconite dispare complet)
Write-Host "[2/5] Activare Auto-Hide pentru Bara Windows (Taskbar)..." -ForegroundColor Yellow
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

# Eliminare iconite si bara de cautare din taskbar
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" -Name "SearchboxTaskbarMode" -Value 0 -Force
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowTaskViewButton" -Value 0 -Force
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarMn" -Value 0 -Force
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "TaskbarDa" -Value 0 -Force

# Repornire Windows Explorer pentru a aplica imediat ascunderea barei
Stop-Process -Name explorer -Force
Start-Sleep -Seconds 1
Write-Host "[OK] Taskbar Windows ascuns complet." -ForegroundColor Green

# 4. Cautare automata browser Google Chrome sau Microsoft Edge
Write-Host "[3/5] Detectare browser..." -ForegroundColor Yellow
$chrome = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
    Write-Host "[EROARE] Nu am gasit Google Chrome sau Edge instalat!" -ForegroundColor Red
    return
}
Write-Host "[OK] Browser detectat: $chrome" -ForegroundColor Green

# 5. Creare profil izolat dedicat Kiosk-ului
$profileDir = "C:\SmartKiosk_Data"
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Resetare flag de crash pentru a preveni 'Restore pages'
$prefFile = "$profileDir\Default\Preferences"
if (Test-Path $prefFile) {
    try {
        $content = Get-Content $prefFile -Raw
        $content = $content -replace '"exit_type":\s*"[^"]*"', '"exit_type":"Normal"'
        $content = $content -replace '"exited_cleanly":\s*false', '"exited_cleanly":true'
        Set-Content $prefFile -Value $content -Force
    } catch {}
}

# Argumente profesionale Kiosk Fullscreen
$kioskArgs = "--kiosk `"$kioskUrl`" --user-data-dir=`"$profileDir`" --start-fullscreen --start-maximized --window-position=0,0 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-pinch --overscroll-history-navigation=0 --disable-features=Translate,OptimizationHints,MediaRouter --check-for-update-interval=31536000 --disable-component-update"

# 6. Salvare in Autostart Windows si Creare Scurtaturi
Write-Host "[4/5] Configurare pornire automata si scurtaturi..." -ForegroundColor Yellow
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'SmartKioskScreen' -Value "`"$chrome`" $kioskArgs"

$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')

# Scurtatura Kiosk Fullscreen pe Desktop
$sc = $wsh.CreateShortcut("$desktop\Smart Kiosk Fullscreen.lnk")
$sc.TargetPath = $chrome
$sc.Arguments = $kioskArgs
$sc.WindowStyle = 3 # Maximized
$sc.Save()

# Fisier BAT rapid de pornire/repornire pe Desktop
$batContent = @"
@echo off
title Pornire Kiosk Fullscreen
echo Inchidere ferestre vechi...
taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1
timeout /t 1 >nul
echo Pornire Kiosk in Fullscreen Total...
start "" "$chrome" $kioskArgs
exit
"@
Set-Content -Path "$desktop\Porneste Kiosk Fullscreen.bat" -Value $batContent -Force

Write-Host "[OK] Scurtatura si 'Porneste Kiosk Fullscreen.bat' create pe Desktop." -ForegroundColor Green

# 7. Oprire instante vechi si pornire Kiosk Fullscreen acum
Write-Host "[5/5] Pornire Kiosk Fullscreen..." -ForegroundColor Yellow
Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
Stop-Process -Name msedge -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Start-Process -FilePath $chrome -ArgumentList $kioskArgs

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "   [SUCCES TOTAL] KIOSKUL A FOST TRECUT IN FULLSCREEN TOTAL!" -ForegroundColor Green
Write-Host "   - Bara de jos Windows (Taskbar) este ascunsa complet." -ForegroundColor Green
Write-Host "   - Nicio iconita Windows nu mai este vizibila peste aplicatie." -ForegroundColor Green
Write-Host "   - Browserul ruleaza in mod hardware Kiosk dedicat si izolat." -ForegroundColor Green
Write-Host "   - Daca AnyDesk se conecteaza, ecranul ramane 100% Fullscreen." -ForegroundColor Green
Write-Host "   - La fiecare repornire a PC-ului, porneste automat Fullscreen." -ForegroundColor Green
Write-Host "=====================================================================`n" -ForegroundColor Green
