# Plan de Mentenanță și Curățare Constanța 1 (După ora 22:00)

> **Creat la cererea utilizatorului pentru intervenția de după închiderea restaurantului.**
> **Scop:** Eliminarea definitivă a ferestrelor multiple (File Manager, Chrome Restore) și pornirea 100% automată & invizibilă a POS Bridge-ului fără riscul ca angajații să-l oprească.

---

## 1. Problema Identificată Dimineața (09:17 - 10:18)
1. **Ferestre parazite la pornire Windows**:
   - File Manager (foldere de fișiere) deschise automat pe ecran din cauza setărilor Windows *„PersistBrowsers”* / *„RestartApps”*.
   - Multiple instanțe de Chrome apărute din cauza mecanismului *„Restore Session / Restore pages after crash”* după oprirea forțată a PC-ului seara.
2. **POS Bridge Oprit timp de 1 oră**:
   - Angajatul a văzut talmeș-balmeș de ferestre, a dat click pe Chrome (care a arătat meniul cu burgeri) și a crezut că totul merge.
   - Fie consola neagră de POS Bridge nu pornise, fie angajatul a dat `X` pe ea crezând că e o eroare.
   - Abia la 10:18 cineva a repornit manual scriptul de bridge.

---

## 2. Checklist de Execuție (Pas cu Pas - după ora 22:00)

### Pasul 1: Dezactivare redeschidere automată foldere și aplicații în Windows
Rulare în PowerShell / CMD ca Administrator pe PC-ul din Constanța:
```cmd
:: Opreste redeschiderea folderelor dupa restart
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v "PersistBrowsers" /t REG_DWORD /d 0 /f
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v "RestartApps" /t REG_DWORD /d 0 /f

:: Dezactivare Sleep, Standby si oprire USB/COM
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8685-5b0887e3290d 48e6b7a6-50f5-4760-a579-e4c11dd81862 0
powercfg /setactive SCHEME_CURRENT
```

### Pasul 2: Curățare porniri duplicate (Startup & Registry)
```cmd
:: Curata scurtaturi duplicate din folderul Startup
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SmartKiosk*.lnk" 2>nul
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\POSBridge*.lnk" 2>nul

:: Asigura pornirea POS Bridge exclusiv ascunsa in fundal (fara fereastra neagra)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "POSBridge" /t REG_SZ /d "wscript.exe \"C:\Users\Administrator\Downloads\dev_office\smart_kiosk\packages\pos-bridge\run-hidden.vbs\"" /f
```
*(Se va adapta calea folderului dacă e diferită pe PC-ul din Constanța).*

### Pasul 3: Configurare Chrome Kiosk Anti-Restore
Comanda din `SmartKioskScreen` să conțină flag-urile care blochează mesajele de sesiune veche:
```cmd
--kiosk https://kiosk-smashme.netlify.app/?loc=constanta1 --start-fullscreen --start-maximized --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --overscroll-history-navigation=0
```

### Pasul 4: Înregistrare Watchdog în Windows Task Scheduler (la fiecare 1 minut)
Garanția supremă că POS Bridge este mereu sus:
```cmd
schtasks /create /tn "SmartKiosk_POS_Watchdog" /tr "wscript.exe \"C:\...\packages\pos-bridge\watchdog.vbs\"" /sc minute /mo 1 /f /rl highest
schtasks /create /tn "SmartKiosk_POS_OnLogon" /tr "wscript.exe \"C:\...\packages\pos-bridge\watchdog.vbs\"" /sc onlogon /f
```

### Pasul 5: Rulare script unificat actualizat
Se rulează noul [`setup-constanta.bat`](file:///Users/eugeniucazmal/Downloads/dev_office/smart_kiosk/packages/pos-bridge/setup-constanta.bat) care aplică toate aceste setări automat și unifică scurtătura de pe Desktop.

### Pasul 6: Test Restart complet
1. Se dă `Restart` la calculatorul din Constanța.
2. Se verifică la reaprindere:
   - Nu se mai deschide niciun folder de fișiere (File Manager).
   - Nu apare nicio fereastră de consolă neagră (bridge-ul rulează invizibil).
   - Chrome intră direct în modul Fullscreen Kiosk fără întrebări de restore.
   - În Dashboard-ul de Admin, Constanța 1 este Verde `La zi (v3.5.2)`, `COM7`, iar latența sub 500ms.
