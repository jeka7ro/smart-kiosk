# Ascundere automata si permanenta a barei de activitati Windows (Taskbar)
$p = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3'
if (Test-Path $p) {
    $v = (Get-ItemProperty $p).Settings
    if ($v -and $v.Length -gt 8) {
        $v[8] = 3
        Set-ItemProperty -Path $p -Name Settings -Value $v
    }
}

$p2 = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects2'
if (Test-Path $p2) {
    $v2 = (Get-ItemProperty $p2).Settings
    if ($v2 -and $v2.Length -gt 8) {
        $v2[8] = 3
        Set-ItemProperty -Path $p2 -Name Settings -Value $v2
    }
}

# Restart curat Explorer pentru a incarca noua setare Auto-Hide
taskkill /f /im explorer.exe >$null 2>&1
Start-Process explorer.exe

Write-Host "`n[SUCCES] Taskbar-ul Windows a fost setat pe Auto-Hide si ascuns definitiv!" -ForegroundColor Green
