# =====================================================================
#   SMART KIOSK - SCRIPT UNIC DE INSTALARE SI CONFIGURARE TOTALA
#   Configureaza: Node, Porturi, USB Anti-Sleep, Watchdog, Autostart
# =====================================================================

$ErrorActionPreference = 'SilentlyContinue'
Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host "   INSTALARE SI CONFIGURARE UNICA SMART KIOSK CONSTANTA 1" -ForegroundColor Cyan
Write-Host "=====================================================================`n" -ForegroundColor Cyan

# 1. Determinare folder tinta
$targetDir = $PWD.Path
if (-not (Test-Path "$targetDir\index.js")) {
    $found = @('C:\Smart Kiosk\kiosk-constanta', 'C:\kiosk-constanta', "$env:USERPROFILE\Desktop\kiosk-constanta", "$env:USERPROFILE\Downloads\kiosk-constanta") | Where-Object { Test-Path "$_\index.js" } | Select-Object -First 1
    if ($found) { $targetDir = $found }
}
Set-Location $targetDir
Write-Host "[1/6] Folder aplicatie: $targetDir" -ForegroundColor Green

# 2. Salvare / Actualizare .env
$envContent = @"
# Configurare POS Bridge si Imprimanta Constanta 1
RENDER_URL=https://smart-kiosk-ttut.onrender.com
COM_PORT=COM7
BAUD_RATE=9600
LOCATION_ID=constanta1
BRIDGE_KEY=pos-bridge-2024
POS_GATEWAY=raiffeisen
PRINTER_NAME=XP-80
"@
Set-Content -Path "$targetDir\.env" -Value $envContent -Force
Write-Host "[2/6] Fisier .env salvat pentru COM7 si XP-80." -ForegroundColor Green

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
Write-Host "[4/6] USB Selective Suspend si Power Saving pe USB Root Hub dezactivate." -ForegroundColor Green

# 5. Descarcare fisiere VBS optimizate cu suport pentru spatii in cale
curl.exe -s -O https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/kiosk-constanta/watchdog.vbs
curl.exe -s -O https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/kiosk-constanta/run-hidden.vbs

# Inregistrare Watchdog in Windows Task Scheduler (la fiecare 1 minut)
schtasks /create /tn "SmartKiosk_POS_Watchdog" /tr "wscript.exe `"$targetDir\watchdog.vbs`"" /sc minute /mo 1 /f
schtasks /create /tn "SmartKiosk_POS_OnLogon" /tr "wscript.exe `"$targetDir\watchdog.vbs`"" /sc onlogon /f
Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'POSBridge' -Value "wscript.exe `"$targetDir\run-hidden.vbs`""

# Configurare Chrome Kiosk in Autostart
$chrome = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'SmartKioskScreen' -Value "`"$chrome`" --kiosk https://kiosk-smashme.netlify.app/?loc=constanta1 --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check"
    Write-Host "[5/6] Task Scheduler (1 minut) si Chrome Kiosk configurate." -ForegroundColor Green
} else {
    Write-Host "[5/6] Task Scheduler configurat." -ForegroundColor Green
}

# 6. Pornire imediata a POS Bridge-ului in fundal
Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"`"$targetDir\start-windows.bat`"`"" -WindowStyle Hidden
Write-Host "[6/6] POS Bridge pornit pe loc in fundal (pe COM7)." -ForegroundColor Green

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "   [SUCCES TOTAL] TOTUL A FOST CONFIGURAT SI ACTIVAT AUTOMAT!" -ForegroundColor Green
Write-Host "   1. POS Bridge ruleaza acum in fundal pe COM7." -ForegroundColor Green
Write-Host "   2. Watchdog-ul ruleaza la fiecare 1 minut prin Task Scheduler." -ForegroundColor Green
Write-Host "   3. USB-ul si PC-ul nu vor mai intra NICIODATA in Sleep." -ForegroundColor Green
Write-Host "   4. La fiecare restart de PC, totul porneste automat singur." -ForegroundColor Green
Write-Host "=====================================================================`n" -ForegroundColor Green
