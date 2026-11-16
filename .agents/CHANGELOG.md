# Jurnal de modificări — Smart Kiosk (Antigravity ↔ Paperclip)

### 2026-11-16 14:52 — Optimizare Masivă Consum Supabase Egress (99.5% reducere transfer)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminare Buclă Polling `limit=5000` (`App.jsx`):** Înlocuit descărcarea continuă a 5.000 de comenzi (10.5 MB la fiecare 30 secunde, ~30 GB/zi) cu interogări filtrate pe perioada activă (pentru ecranul principal „Azi” se descarcă doar ~36 KB).
  2. **Poller de Fundal Inteligent (`App.jsx`):** Intervalul de siguranță la 30 secunde solicită strict ultimele 30 de comenzi (`limit=30`, ~50 KB) și le combină în starea locală React fără să șteargă comenzile vechi încărcate.
  3. **Refresh Manual Optimizat (`App.jsx`):** Butonul din antet reîmprospătează strict perioada activă selectată pe ecran (`getOrdersQueryParams`).
  4. **Curățare Query-uri Scriere din GET (`routes/orders.js`):** Eliminate cele 5 `UPDATE` SQL grele din septembrie care rulau inutil pe tabela `orders` la fiecare cerere HTTP GET, eliberând CPU-ul și lock-urile Supabase.
  5. **Zero Impact Kiosk-uri:** Kiosk-urile fizice nu utilizează acest cod și rămân 100% neatinse.
- **Fișiere:**
  - `packages/admin/src/App.jsx`
  - `packages/backend/src/routes/orders.js`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (așteaptă acord push)
- **Build / Teste:** `npm --prefix packages/admin run build` OK (0 erori, 1.46s), `node --check` pe backend OK.


### 2026-11-15 08:50 — Buton Start.bat pe Cardul LIVE Status
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Buton Start.bat în LIVE Status (`BridgeMonitoring.jsx`):** Adăugat buton dedicat „Start.bat” (cu icon Play verde) pe grila de acțiuni rapide a fiecărui card de aparat.
  2. **Lansare Remote & Copiere Comandă:** Când bridge-ul este online, trimite comanda prin socket pentru rularea `start-windows.bat`. Când bridge-ul este deconectat, copiază comanda `cmd /c cd /d C:\SmartKiosk & start-windows.bat` în clipboard și afișează dialog explicativ.
- **Fișiere:**
  - `packages/admin/src/screens/BridgeMonitoring.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local
- **Build / Teste:** `npm --prefix packages/admin run build` OK (0 erori, 1.31s).

### 2026-11-15 08:44 — Buton Restart PC Windows cu Confirmare de Siguranță pe Cardul LIVE Status
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Buton Restart PC Windows în LIVE Status (`BridgeMonitoring.jsx`):** Adăugat buton dedicat „Restart PC” (cu iconiță Power și avertizare roșie) pe grila de acțiuni rapide a fiecărui card de aparat.
  2. **Dialog de Confirmare de Siguranță:** La apăsare, afișează dialog de confirmare cu avertisment clar (timp de restart ~1 min, interzis dacă un client comandă) pentru a preveni apăsarea accidentală pe telefon.
  3. **Execuție Nativă Windows:** Apelează direct `/api/bridge-monitoring/:locationId/reboot-pc`, care transmite către bridge comanda Windows nativă `shutdown /r /t 2 /f`.
- **Fișiere:**
  - `packages/admin/src/screens/BridgeMonitoring.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (fără push)
- **Build / Teste:** `npm --prefix packages/admin run build` OK (0 erori, 1.35s).

### 2026-11-15 08:42 — Optimizare Spațiu Mobil Admin & Buton Rapid Blocare PIN în LIVE Status
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Optimizare Live Kiosks Strip pe Mobil (`App.jsx`):** Eliminat al 3-lea rând risipit de spațiu pe mobil. Cele 4 kiosk-uri rămân pe 2 rânduri (2x2), iar butonul de actualizare cu badge numeric și iconița către LIVE Status au fost așezate compact în coloană verticală chiar în capătul celor 2 rânduri. Pe desktop se păstrează stilul orizontal complet.
  2. **Dropdown Filtru Perioadă pe Mobil (`App.jsx`):** Pastilele orizontale („Azi”, „Ieri”, „Săpt. Curentă” etc.) au fost ascunse pe mobil (`hidden sm:flex`) și înlocuite cu un meniu dropdown `<select>` elegant, aliniat perfect cu filtrele de Locație, Plată și Căutare.
  3. **Grafic Vânzări & Încasări Compact (`DashboardCharts3D.jsx`):** Subtitlul text lung a fost ascuns pe mobil (`hidden sm:flex`), butoanele de comparație și metrici („Fără comp.”, „vs Ieri”, „Valori pe Grafic”, „Încasări (RON)”, „Nr. Comenzi”) au fost așezate pe un singur rând orizontal glisabil (`flex-nowrap overflow-x-auto`), iar padding-ul cardului a fost optimizat la `p-3 sm:p-5`.
  4. **Buton Rapid Blocare PIN în LIVE Status (`BridgeMonitoring.jsx`):** Adăugat butonul „Blocare PIN” / „Deblochează” (cu icon Lock/Unlock și update optimist) pe fiecare card de echipamente, apelând direct endpoint-ul web `/api/locations/:id/lock` fără a atinge Windows sau driverul tactil.
  5. **Verificare și Păstrare Reguli Push:** Toate modificările au fost testate local și verificate (`build` 0 erori). Niciun `git push` nu se execută fără confirmarea expresă a utilizatorului.
- **Fișiere:**
  - `packages/admin/src/App.jsx`
  - `packages/admin/src/components/DashboardCharts3D.jsx`
  - `packages/admin/src/screens/BridgeMonitoring.jsx`
  - `packages/admin/src/data/bridgeReleaseNotes.js`
  - `packages/backend/src/data/bridgeReleaseNotes.js`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (fără push)
- **Build / Teste:** `npm --prefix packages/admin run build` reușit (0 erori, 1.29s), `node --check packages/pos-bridge/index.js` OK.

### 2026-11-14 17:12 — Eliminare Definitivă Paravan Windows (Privacy Shield) & Păstrare Mentenanță Web Curată
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminare Completă Paravan Windows (`privacy_shield`):** Șters codul de generare/rulare a ferestrelor externe PowerShell / Windows Form (`privacy_shield.ps1`) și manipularea HWND-urilor prin `WDA_EXCLUDEFROMCAPTURE` din `packages/pos-bridge/index.js`, prevenind 100% orice risc de furt de focus sau invalidare a driverului tactil Windows HID.
  2. **Curățare UI Admin (Desktop Live):** În `packages/admin/src/components/RemoteDesktopViewer.jsx` s-au eliminat butoanele „Paravan Mentenanță” și comutatorul „Eu (Desktop)” / „Ce vede Clientul”. S-a păstrat fluxul curat nativ: conectare Desktop Live, streaming FPS/Calitate, deschidere `C:\SmartKiosk` și control tastatură/mouse.
  3. **Păstrare Toate Instrumentele de Mentenanță:** Toate celelalte funcționalități din panoul Mentenanță au rămas 100% active și intacte: Mod Mentenanță Web (ecranul animat cu logo de brand din Kiosk React), Restart PC, Restart POS Bridge, Restart Kiosk, Test Semnal POS (UART Ping), scanare porturi și log-uri.
- **Fișiere:**
  - `packages/pos-bridge/index.js`
  - `packages/pos-bridge/start-windows.bat`
  - `packages/admin/src/components/RemoteDesktopViewer.jsx`
  - `packages/admin/src/components/WindowsRemoteModal.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (fără push)
- **Build / Teste:** `npm --prefix packages/admin run build` OK (0 erori), `node --check packages/pos-bridge/index.js` OK.

### 2026-11-14 16:30 — Analiză Post-Mortem & Corecție Critică Touchscreen (Eliminare Bucle Win32 Focus)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Identificare & Eliminare Cauză Rădăcină Blocare Touchscreen (5-10 secunde):** În `packages/pos-bridge/index.js` (bucla de 8s `enforceKioskTaskbar`) și în `packages/pos-bridge/watchdog.vbs` (bucla de 5s `WScript.Sleep 5000`) se executau repetat comenzi Win32 `ShowWindow(..., 9/3)` și `SetForegroundWindow` prin PowerShell. Pe Windows 10/11, apelarea repetată a lui `ShowWindow` peste o fereastră Google Chrome Fullscreen borderless (`--kiosk`) rupea capturarea driverului tactil HID (DirectComposition / WM_POINTERDOWN), făcând ecranul complet insensibil la atingeri fizice deși rămânea vizibil.
  2. **Curățare Completă `watchdog.vbs`:** Rescris `watchdog.vbs` să fie 100% pasiv (verifică doar o dată la 30s dacă `node.exe` există prin WMI), eliminând definitiv orice invocare de PowerShell, compilare C#, apeluri `ShowWindow`, `SetForegroundWindow` sau verificări de taskbar.
  3. **Curățare `index.js`:** Eliminat `setInterval(() => enforceKioskTaskbar(false), 8000)`, iar la boot se execută o singură verificare pasivă fără buclă repetitivă.
  4. **Auto-Recuperare Server în `App.jsx`:** Adăugat timer de auto-reîncercare la 2.5 secunde când datele locației lipsesc (`!locationData`), prevenind blocarea pe ecranul „Se conectează la server...”.
  5. **Aplicat direct pe Cluj 2:** Fișierele `index.js` și `watchdog.vbs` au fost actualizate direct pe discul local `C:\SmartKiosk` al calculatorului Cluj 2, fără `git push`, iar procesele concurente au fost oprite.
- **Fișiere:**
  - `packages/pos-bridge/index.js`
  - `packages/pos-bridge/watchdog.vbs`
  - `packages/kiosk/src/App.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (fără push)
- **Build / Teste:** `npm --prefix packages/kiosk run build` OK, testat pe Cluj 2 live — touchscreen 100% funcțional, POS 108ms.

### 2026-11-14 12:22 — Comutator Live în Desktop Live: „🔧 Eu (Desktop)” vs „👁️ Ce vede Clientul”
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Adăugat comutatorul dublu **„🔧 Eu (Desktop)” | „👁️ Ce vede Clientul”** direct în bara de sus din `Desktop Live` (`packages/admin/src/components/RemoteDesktopViewer.jsx`).
  2. În `packages/pos-bridge/index.js` (`privacy_shield.ps1` + `setPrivacyShieldViewMode` + `handleRdControl` `shield_view`):
     - **🔧 Eu (Desktop):** Setează `SetWindowDisplayAffinity($form.Handle, 0x11)` (`WDA_EXCLUDEFROMCAPTURE`) pe paravanul de mentenanță — pe monitorul din restaurant paravanul rămâne 100% opac, dar în Admin vezi prin el direct Desktopul Windows și folderul `C:\SmartKiosk`.
     - **👁️ Ce vede Clientul:** Setează `SetWindowDisplayAffinity($form.Handle, 0x00)` (`WDA_NONE`) (sau aduce Chrome Kiosk în față dacă paravanul e oprit) + folosește `CopyPixelOperation.SourceCopy | CopyPixelOperation.CaptureBlt` în `SkRdHost`, astfel încât vezi în `Desktop Live` exact imaginea reală de pe monitorul fizic din fața clientului (inclusiv paravanul „KIOSK ÎN MENTENANȚĂ”).
- **Fișiere:**
  - `packages/pos-bridge/index.js`
  - `packages/admin/src/components/RemoteDesktopViewer.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (local, în așteptarea acordului pentru commit & push)
- **Build / Teste:** `node --check packages/pos-bridge/index.js` OK, `npm --prefix packages/admin run build` OK (0 erori).

### 2026-11-13 15:37 — Regulă Unică Culori & Denumiri Branduri (din Avatar Logo) + Favicon Online
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Creat fișierul central `packages/admin/src/utils/brandTheme.js` ca unică sursă de adevăr pentru culori, palete 3D Donut și etichete de brand în toate tabelele și graficele din Admin, extrase fidel din logo-ul (avatarul) fiecărui brand:
     - **Poki-Woki:** Verde (`#65a30d`, paletă 3D `#65a30d` / `#16a34a` / `#84cc16`) + text `Poki-Woki` (înlocuit portocaliul din 3D Donut/Gestionare Comenzi și movul din Coșuri & Comenzi în Curs).
     - **SmashMe:** Roșu (`#ef4444`) + text `SmashMe`.
     - **Roll Master:** Roșu Crimson (`#dc2626`) + text `Roll Master` (înlocuit verdele/albastrul inconsistent).
     - **Crunch:** Chihlimbar (`#d97706`) + text `Crunch`.
     - **Love Sushi / WeLoveSushi:** Somon Portocaliu (`#f97316`) + text `Love Sushi`.
  2. Aplicat regula unică în `DashboardCharts3D.jsx`, `App.jsx` (`Gestionare Comenzi`, modal detalii comandă, Kiosk-uri, Locații, Branduri), `PendingOrders.jsx`, `PosLogs.jsx`, `KioskLogs.jsx`, `OrderToastNotification.jsx`, `OrdersNotificationBell.jsx`, `MenuManager.jsx`, `Promotions.jsx` și `TranslationsScreen.jsx`.
  3. Identificat de ce favicon-ul se vedea doar local: `packages/admin/public/favicon.png`, `favicon.ico`, `apple-touch-icon.png` și `packages/admin/index.html` erau necomise în Git (`??` / `M`). Actualizat cache-buster-ul la `?v=3` în `packages/admin/index.html`, gata de inclus la următorul commit/push.
- **Fișiere:**
  - `packages/admin/src/utils/brandTheme.js`
  - `packages/admin/src/components/DashboardCharts3D.jsx`
  - `packages/admin/src/App.jsx`
  - `packages/admin/src/screens/PendingOrders.jsx`
  - `packages/admin/src/screens/PosLogs.jsx`
  - `packages/admin/src/screens/KioskLogs.jsx`
  - `packages/admin/src/components/OrderToastNotification.jsx`
  - `packages/admin/src/components/OrdersNotificationBell.jsx`
  - `packages/admin/src/screens/MenuManager.jsx`
  - `packages/admin/src/screens/Promotions.jsx`
  - `packages/admin/src/screens/TranslationsScreen.jsx`
  - `packages/admin/index.html`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (fără push — conform instrucțiunii utilizatorului „inca nu”)
- **Build / Teste:** `npm --prefix packages/admin run build` OK (1844 module, 0 erori).

### 2026-11-13 15:09 — POS Bridge v3.5.8: Paravan Mentenanță Invizibil în Admin (Vezi Direct Desktopul + C:\SmartKiosk) & Desktop Live Fluid (14–18 FPS)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Rezolvat problema prin care la activarea Paravanului de Mentenanță în Admin se vedea tot ecranul de mentenanță în `Desktop Live`: deși `privacy_shield.ps1` avea `WDA_EXCLUDEFROMCAPTURE` (`0x11`), fereastra Google Chrome de dedesubt nu era minimizată (și afișa `<MaintenanceScreen />`), iar bucla `enforceKioskTaskbar()` (la 8s) și `kiosk_visibility` din `socketService.js` ridicau Chrome înapoi în Fullscreen imediat ce apăsai `Win+D`.
  2. Acum în `setWindowsPrivacyShield(true)` (`packages/pos-bridge/index.js`): paravanul rămâne 100% opac și `HWND_TOPMOST` pe ecranul fizic din restaurant, dar fiind invizibil la captură (`WDA_EXCLUDEFROMCAPTURE`), scriptul minimizează automat fereastra Chrome (`SW_MINIMIZE = 6`), afișează bara de Start Windows și deschide automat `explorer.exe C:\SmartKiosk`. Astfel, în Admin (`Desktop Live`) vezi direct Desktopul Windows și folderul `C:\SmartKiosk`, în timp ce pe Kiosk-ul fizic din restaurant clienții văd doar „KIOSK ÎN MENTENANȚĂ”. La oprirea Paravanului, `enforceKioskTaskbar(true)` ascunde bara și readuce Chrome în Fullscreen.
  3. Suspendat auto-recovery-ul `enforceKioskTaskbar` și `kiosk_force_fullscreen` automat (`socketService.js`) cât timp `privacyShieldActive`, `taskbarOverrideVisible` sau `remoteDesktopActive` este activ, plus adăugat buton dedicat **📁 Desktop & C:\SmartKiosk** în toolbar-ul `Desktop Live` (`RemoteDesktopViewer.jsx`).
  4. Optimizat motorul `SkRdHost` (`packages/pos-bridge/index.js` & `RemoteDesktopViewer.jsx`) pentru fluiditate fără sacadări: reutilizare persistentă `Bitmap` în format nativ `Format32bppRgb` (fără alocări GC la fiecare cadru), scalare rapidă GDI+ (`InterpolationMode.Low`, `CompositingMode.SourceCopy`), trezire instantanee prin `AutoResetEvent` la fiecare click/dublu-click/tastă/scroll (0ms latență de sleep), handler nativ `onDoubleClick` în viewer și creștere FPS la `14–18 FPS`.
- **Fișiere:**
  - `packages/pos-bridge/index.js`
  - `packages/pos-bridge/package.json`
  - `packages/backend/src/services/socketService.js`
  - `packages/backend/src/routes/bridgeMonitoring.js`
  - `packages/admin/src/components/RemoteDesktopViewer.jsx`
  - `packages/admin/src/components/WindowsRemoteModal.jsx`
  - `packages/admin/src/data/bridgeReleaseNotes.js`
  - `packages/backend/src/data/bridgeReleaseNotes.js`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (fără push — așteaptă confirmarea utilizatorului)
- **Build / Teste:** `node --check` OK pe toate fișierele backend/bridge; `npm --prefix packages/admin run build` OK (0 erori).

### 2026-11-13 12:43 — Adăugare Butoane „Copiază Logurile” în Terminal & Live Logs (Control PC Admin)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Adăugat buton dedicat cu iconiță de copiere (`Copy` / `Check` din `lucide-react`) în bara de sus a ferestrei de Terminal CMD din `packages/admin/src/components/WindowsRemoteModal.jsx`, permițând copierea instantanee cu un singur click a tuturor liniilor din consolă în clipboard (`navigator.clipboard.writeText`) fără selecție manuală.
  2. Adăugat buton similar de copiere rapidă și pe tab-ul de jurnal live POS Bridge (`Fereastra POS Bridge (Live)`).
- **Fișiere:**
  - `packages/admin/src/components/WindowsRemoteModal.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (nemodificat / fără push)
- **Build / Teste:** `npm --prefix packages/admin run build` OK (1843 module, 0 erori).

### 2026-11-13 11:12 — Hotfix Critic v3.5.7 (Crash `paymentInProgress` în v3.5.6 + Desktop Live + Execuție Startup/Taskbar)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Identificat și reparat în `packages/pos-bridge/index.js` crash-ul critic din `v3.5.6` (`ReferenceError: paymentInProgress is not defined` aruncat la nivel global în `wakePosKeepAlive()` și `testPosSignal()` deoarece `let paymentInProgress = false` fusese declarat doar local în `start()`). Mutat `let paymentInProgress = false` la nivel de modul și eliminat declarația locală duplicată din `start()`.
  2. Îmbunătățit Desktop Live (`SkRdHost` în `packages/pos-bridge/index.js` și `packages/admin/src/components/RemoteDesktopViewer.jsx`): scalare proporțională pe latura maximă (`Math.Max(b.Width, b.Height)`) pentru monitoare portret `1080×1920`, solicitare automată `KF` când buffer-ul Socket.IO (`wbLen > 2`) sare cadre la tranziții UI, timeout watchdog mărit la `45s` (`50s` în C#), reconectare automată + ping/keyframe la `visibilitychange`/`focus`, detectare stare înghețată (`>6s` fără cadre -> `Semnal înghețat...`), și oprire imediată a stării „Live” în Admin când PC-ul devine offline sau când `socketService.js` raportează `bridge_disconnected`/`agent_exit`.
  3. Corectat `packages/backend/src/services/socketService.js` și `packages/backend/src/services/bridgeMonitoringService.js`: inclus `codeHash` în evenimentul `pos_bridge_register` (elimină starea falsă „necesită update” în primele 20s după conectare) și notificat viewerii `rd-viewer-*` imediat ce socket-ul activ al bridge-ului se deconectează.
  4. Adăugat execuție reală din interfața Admin (`packages/admin/src/components/WindowsRemoteModal.jsx` + `packages/pos-bridge/index.js`): butoane **▶ Execută** pe scripturile `.bat`/`.cmd`/`.vbs`/`.ps1`/`.lnk`/`.exe` din `C:\SmartKiosk` și din **Windows Startup**, buton **Arată / Ascunde Bara Start / Taskbar Windows** (`setWindowsTaskbarVisible` + pauză `enforceKioskTaskbar`), buton **Rulează `start-windows.bat`** și eliminarea fallback-ului fals din terminal când bridge-ul este offline.
  5. Incrementat versiunea la `v3.5.7` (`packages/pos-bridge/index.js`, `packages/pos-bridge/package.json`) și adăugat Release Notes pentru `v3.5.7` (`packages/admin/src/data/bridgeReleaseNotes.js`, `packages/backend/src/data/bridgeReleaseNotes.js`), incluzând și fix-ul `Paravan Mentenanță`.
- **Fișiere:**
  - `packages/pos-bridge/index.js`
  - `packages/pos-bridge/package.json`
  - `packages/backend/src/services/socketService.js`
  - `packages/backend/src/services/bridgeMonitoringService.js`
  - `packages/admin/src/components/RemoteDesktopViewer.jsx`
  - `packages/admin/src/components/WindowsRemoteModal.jsx`
  - `packages/admin/src/data/bridgeReleaseNotes.js`
  - `packages/backend/src/data/bridgeReleaseNotes.js`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (`v3.5.7`, push confirmat de utilizator)
- **Build / Teste:** `npx eslint --no-config-lookup --rule '{"no-undef":"error"}'` (0 erori pe `packages/pos-bridge/index.js`, `socketService.js`, `bridgeMonitoringService.js`, `bridgeReleaseNotes.js`), `node --check` OK pe toate fișierele JS; `npm --prefix packages/admin run build` OK (`vite build`, 1843 module, `1.84s`, 0 erori); test izolat `ALL_V357_FINAL_TESTS_PASSED`.

### 2026-11-13 10:41 — Fix Paravan Mentenanță Windows (`SetLayeredWindowAttributes` + re-ancorare TopMost)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Corectat în `packages/pos-bridge/index.js` (`setWindowsPrivacyShield`) bug-ul Win32 unde fereastra `privacy_shield.ps1` primea `WS_EX_LAYERED | WS_EX_TRANSPARENT` (`0x80000 | 0x20`) fără `SetLayeredWindowAttributes(..., 0, 255, 2)` și rămânea transparentă (`alpha = 0`) pe monitorul fizic.
  2. Setat `$form.Opacity = 0.996` + `SetLayeredWindowAttributes($form.Handle, 0, 255, 2)` (100% opac pe monitorul fizic din restaurant), acoperire pe tot `VirtualScreen`, stiluri `WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE` + timer `1.5s` cu `SetWindowPos(HWND_TOPMOST, ...)` anti-`Win+D`, `WDA_EXCLUDEFROMCAPTURE` (`0x11`) pentru Desktop Live/AnyDesk, pornire cu `-STA`, curățare procese vechi fără race (`$_.ProcessId -ne $PID`) și logare `stdout`/`stderr` în `bridge.log`.
- **Fișiere:**
  - `packages/pos-bridge/index.js`
- **Ramură / Commit:** `main` (necomis / fără push, la cererea explicită a utilizatorului)
- **Build / Teste:** `node --check packages/pos-bridge/index.js` OK, verificare generare & sintaxă `privacy_shield.ps1` (`PRIVACY_SHIELD_VERIFICATION_PASSED`, 65 linii, 8 perechi `{}`); execuția vizuală reală pe monitorul fizic Windows se va vedea după deploy/push.

### 2026-11-13 10:30 — Fix coliziune UART Wake/Test Semnal + v3.5.6
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Adăugat în `packages/pos-bridge/index.js` cooldown comun `POS_ENQ_PROBE_COOLDOWN_MS = 10000` (`lastPosEnqProbeOkAt` + actualizare `lastActivityTime` în `testPosSignal`, `pos_prewake` și `wakePosKeepAlive`) astfel încât un impuls de wake și un test de semnal (`10:10`/`10:20` sau manual) să nu mai lovească terminalul Verifone la 2–4 secunde distanță.
  2. Adăugat în `wakePosKeepAlive()` o reîncercare discretă după `5s` la un singur timeout izolat în fundal înainte de a raporta roșu `POS în standby (fără răspuns la wake în 3000ms)` în Admin, plus `cancelBackgroundPosProbes()` apelat imediat la `processPrintecPayment`, `forceReopenPort`, `close` și `cancel_pos_payment` (fluxul de plată `SALE` / `ecrSend` a rămas neatins).
  3. Corectat în `packages/admin/src/screens/BridgeMonitoring.jsx` cardul `Ultimul Semnal` din modalul `Istoric Semnal POS & Latență UART` să afișeze `Timeout / Fără răspuns` cu roșu când `lastSuccess === false` în loc de `Normal` cu verde.
  4. Incrementat versiunea POS Bridge de la `3.5.5` la `3.5.6` și adăugat Release Notes pentru `v3.5.6`.
- **Fișiere:**
  - `packages/pos-bridge/index.js`
  - `packages/pos-bridge/package.json`
  - `packages/admin/src/screens/BridgeMonitoring.jsx`
  - `packages/admin/src/data/bridgeReleaseNotes.js`
  - `packages/backend/src/data/bridgeReleaseNotes.js`
- **Ramură / Commit:** `main` (`v3.5.6`)
- **Build / Teste:** `node --check` OK (`packages/pos-bridge/index.js`, `packages/backend/src/data/bridgeReleaseNotes.js`, `packages/backend/src/services/bridgeMonitoringService.js`), `npm --prefix packages/admin run build` (`vite build`, 1843 module, `2.98s`, 0 erori), test izolat `ALL_COOLDOWN_AND_VERSION_TESTS_PASSED`.

### 2026-11-13 10:01 — Desktop Live (clonă AnyDesk nativă integrată în Admin)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Implementat în `packages/pos-bridge/index.js` agentul nativ Windows `.rd-agent.ps1` (C# compilat în memorie via PowerShell cu `SetProcessDPIAware()`, captură desktop + cursor real Windows, skip automat cadre identice prin MD5, backpressure pe socket, control complet mouse click stânga/dreapta/mijloc/drag/scroll și tastatură `keybd_event` + `SendInput` Unicode, plus auto-oprire la 22–25s fără viewer activ).
  2. Adăugat în `packages/backend/src/index.js` (`maxHttpBufferSize: 4MB`) și `packages/backend/src/services/socketService.js` camere dedicate `rd-viewer-<locKey>` (`rd_join`, `rd_leave`, `rd_control`, `rd_frame`, `rd_status`) + oprire automată la disconnect, ca traficul video să meargă strict către browserul Admin care privește sesiunea.
  3. Creat componenta `packages/admin/src/components/RemoteDesktopViewer.jsx` și integrat tab-ul **`🖥️ Desktop Live (AnyDesk)`** în `packages/admin/src/components/WindowsRemoteModal.jsx` (preseturi calitate, hotkey-uri `Win+D`, `Alt+Tab`, `TaskMgr`, `Alt+F4`, mapare Mac `Cmd → Ctrl`, trimitere text/parole Unicode, mod fullscreen și Paravan Mentenanță).
- **Fișiere:**
  - `packages/pos-bridge/index.js`
  - `packages/backend/src/index.js`
  - `packages/backend/src/services/socketService.js`
  - `packages/admin/src/components/RemoteDesktopViewer.jsx`
  - `packages/admin/src/components/WindowsRemoteModal.jsx`
- **Ramură / Commit:** `main` (`v3.5.6`)
- **Build / Teste:** `node --check` pe fișierele backend/bridge OK, `npm --prefix packages/admin run build` (`vite build`, 1843 module, 0 erori), verificare balansare sintaxă C# (217 linii) și test relay Socket.IO (`REMOTE_DESKTOP_VERIFICATION_PASSED`); execuția reală Windows PowerShell se verifică live pe PC după deploy.

### 2026-11-13 09:50 — Verificare amprentă cod real (SHA-256) + Auto-update & restart zilnic POS Bridge la 09:00
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Adăugat `computeLocalBridgeCodeHash()` în `packages/pos-bridge/index.js` (amprentă SHA-256 pe 12 caractere calculată cu normalizare LF/CRLF și BOM din `index.js`, `printer.js`, `watchdog.vbs`), transmisă în `pos_bridge_register` și `pos_bridge_heartbeat`, plus protecție `onlyIfIdle` pe `remote_restart` pentru a nu întrerupe nicio plată activă.
  2. Implementat în `packages/backend/src/services/bridgeMonitoringService.js`:
     - `fetchExpectedBridgeHash()` care preia amprenta oficială din GitHub `main` (cu cache-busting, reîmprospătare la pornire, după 3 min și la fiecare 30 min, plus fallback local dev).
     - `evaluateBridgeFreshness()` folosit în `getStatusSummary()` astfel încât un bridge online cu cod vechi (`codeHash` lipsă sau diferit de cel oficial) să fie marcat exact cu `isBridgeUpToDate: false`, chiar dacă stringul `v3.5.5` este identic.
     - Scheduler zilnic la **09:00 (`Europe/Bucharest`)** (`runDailyBridgeAutoUpdateCheck()`) cu cooldown de 10 minute anti-loop: actualizează și repornește automat (`onlyIfIdle: true`) bridge-urile online rămase în urmă și trimite raportul sumar pe Telegram; actualizat și `/status` + raportul matinal de la `10:10`.
  3. Actualizat `packages/admin/src/screens/BridgeMonitoring.jsx` și `packages/backend/src/routes/bridgeMonitoring.js` ca Admin-ul să afișeze explicit **„Cod vechi”** / **„Update cod”** cu tooltip comparativ `#hashLocal` vs `#hashOficial` în loc de „Soft la zi” fals.
- **Fișiere:**
  - `packages/pos-bridge/index.js`
  - `packages/backend/src/services/bridgeMonitoringService.js`
  - `packages/backend/src/routes/bridgeMonitoring.js`
  - `packages/admin/src/screens/BridgeMonitoring.jsx`
- **Ramură / Commit:** `main` (necomis / fără push, conform regulii; așteaptă acordul utilizatorului)
- **Build / Teste:** `node --check` pe fișierele modificate OK, `npm --prefix packages/admin run build` (`vite build`) — 0 erori, plus test funcțional Node (`ALL_VERIFICATIONS_PASSED`) pentru paritate CRLF/LF, detecție hash vechi, `onlyIfIdle` și cooldown anti-loop.

### 2026-11-12 09:56 — Butoane & comenzi Restart POS Bridge direct în Telegram Bot + confirmare automată la reconectare
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Adăugat în Telegram Bot butonul **`🔄 Restart POS Bridge`** (cu sub-meniu pentru `Cluj 1`, `Cluj 2`, `Brașov`, `Constanța 1`, `Toate Locațiile`), precum și comenzile text `/restart_cluj1`, `/restart_cluj2`, `/restart_brasov`, `/restart_constanta1`.
  2. Atașat automat butonul **`🔄 Restart POS Bridge (<Locație>)`** direct sub alertele de `[PLATĂ RESPINSĂ - POS]` din Telegram, pentru deblocarea dintr-un singur tap a portului USB/COM.
  3. Când bridge-ul repornește și se reconectează la server (în 2–5 secunde), trimite automat mesaj de confirmare în Telegram (`✅ [RESTART REUȘIT]`).
- **Fișiere:**
  - `packages/backend/src/services/bridgeMonitoringService.js`
  - `packages/backend/src/routes/bridgeMonitoring.js`
  - `packages/pos-bridge/index.js`
- **Ramură / Commit:** `main` (pregătit pentru push la confirmarea utilizatorului)
- **Build / Teste:** `node --check` pe backend și `pos-bridge`, plus `vite build` pe `admin` și `kiosk` — 0 erori.

### 2026-11-11 13:29 — Aliniere buton de închidere `X` în colțul dreapta-sus în fereastra Control PC Windows
- **Autor:** Antigravity
- **Ce s-a făcut:** Așezat header-ul pe un singur rând și fixat butonul rotund de închidere `X` în colțul din dreapta-sus al ferestrei `WindowsRemoteModal.jsx`.
- **Fișiere:**
  - `packages/admin/src/components/WindowsRemoteModal.jsx`
- **Ramură / Commit:** `main` (fără push, conform instrucțiunii utilizatorului)
- **Build / Teste:** Vite HMR live pe `http://localhost:4013/` — OK.

### 2026-11-11 11:54 — Paravan Invizibil pentru AnyDesk (`WDA_EXCLUDEFROMCAPTURE` — 100% Safe, fără drivere)
- **Autor:** Antigravity
- **Ce s-a făcut:** În loc de un driver de Monitor 2 Virtual (care ar putea deregla calibrarea touch-ului sau muta Chrome pe alt ecran), s-a implementat `setWindowsPrivacyShield` în `packages/pos-bridge/index.js` folosind funcția nativă Windows `SetWindowDisplayAffinity(hwnd, 0x00000011)` (`WDA_EXCLUDEFROMCAPTURE`) + `WS_EX_TRANSPARENT`. Pe monitorul fizic din restaurant afișează full-screen **„KIOSK ÎN MENTENANȚĂ”**, în timp ce în AnyDesk fereastra este 100% transparentă și click-urile trec direct prin ea către desktopul Windows.
- **Fișiere:**
  - `packages/pos-bridge/index.js`
  - `packages/admin/src/components/WindowsRemoteModal.jsx`
- **Ramură / Commit:** `main` (fără push, conform instrucțiunii utilizatorului)
- **Build / Teste:** Vite HMR live pe `http://localhost:4013/` — OK.

### 2026-11-11 11:32 — Fereastră „Control PC Windows (C:\SmartKiosk)” direct în Admin (fără AnyDesk)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Creat fereastra modală `WindowsRemoteModal.jsx` cu 3 tab-uri:
     - **📁 Fișiere `C:\SmartKiosk` & `.env`**: Explorer pentru `C:\SmartKiosk` + folderul `Windows Startup` (cu buton `+ Adaugă SmartKiosk în Startup`), configurare rapidă port COM / model POS / imprimantă și editor text pentru `.env`, `start-windows.bat`, `run-hidden.vbs`, etc.
     - **⚡ Comenzi Windows & Startup**: 6 butoane rapide + consolă CMD silențioasă (`windowsHide: true`, fără nicio fereastră pe ecranul Kiosk-ului).
     - **📟 Fereastra POS Bridge (Live)**: vizualizarea de la distanță a consolei `start-windows.bat / node index.js`.
  2. Adăugat butonul rotund de Control PC (`<Server />`) în coloana **ACȚIUNI** din **Kiosk-uri & Screensavere** și butonul **„💻 Control PC Windows (C:\SmartKiosk)”** în popover-ul fiecărei locații din **Dashboard Overview**.
  3. Adăugat suportul `pc_remote_request` / `pc_remote_response` în `packages/pos-bridge/index.js` și `packages/backend/src/services/socketService.js`.
- **Fișiere:**
  - `packages/admin/src/components/WindowsRemoteModal.jsx`
  - `packages/admin/src/App.jsx`
  - `packages/pos-bridge/index.js`
  - `packages/backend/src/services/socketService.js`
- **Ramură / Commit:** `main` (fără push, conform instrucțiunii utilizatorului)
- **Build / Teste:** Vite HMR live pe `http://localhost:4013/` — OK.

### 2026-11-11 11:15 — Eliminare flash „Offline” de 1–2 secunde la refresh în Dashboard, Kiosk-uri & LIVE Status
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Inițializarea instantă (din `localStorage`: `admin_cached_kiosks_live_status`, `admin_cached_bridge_summary`, `admin_cached_locations`) a stării Kiosk-urilor și POS Bridge-urilor la încărcarea paginii.
  2. Protejarea îmbinării (merge) între serverele `ttut` și `v7ws` astfel încât un eveniment Socket.IO de pe un singur server să nu suprascrie temporar cu `Offline` o locație activă pe celălalt server.
- **Fișiere:**
  - `packages/admin/src/App.jsx`
  - `packages/admin/src/screens/BridgeMonitoring.jsx`
- **Ramură / Commit:** `main` (fără push, conform instrucțiunii utilizatorului)
- **Build / Teste:** Vite HMR live pe `http://localhost:4013/` — OK.

### 2026-11-11 11:08 — Deblocare rapidă din Admin pe butonul rotund de lacăt (ACȚIUNI)
- **Autor:** Antigravity
- **Ce s-a făcut:** Butonul rotund de lacăt (`🔒`) din coloana **ACȚIUNI** funcționează acum ca **toggle Blochează / Deblochează rapid** din Admin: când este gri, un click blochează imediat Kiosk-ul (devine roșu și afișează ecranul PIN fără `X` pe Kiosk); când este roșu, un click pe el deblochează instant Kiosk-ul din Admin (și pe Kiosk rămâne în continuare fără `X`, putând fi deblocat fizic doar cu PIN Manager sau Casier).
- **Fișiere:**
  - `packages/admin/src/App.jsx`
  - `packages/kiosk/src/App.jsx`
- **Ramură / Commit:** `main` (fără push, conform instrucțiunii utilizatorului)
- **Build / Teste:** Vite HMR live pe `http://localhost:4013/` și `http://localhost:4010/` — OK.

### 2026-11-11 10:59 — Mutare butoane „Blochează acum” și „Mod Mentenanță” în coloana ACȚIUNI
- **Autor:** Antigravity
- **Ce s-a făcut:** Mutat butoanele **„Blochează acum”** (iconiță lacăt) și **„Mod Mentenanță”** (iconiță cheie tehnică) în coloana **ACȚIUNI** ca butoane rotunde (`w-8 h-8 rounded-full`), păstrând coloana **PROGRAM** curată pe 2 rânduri (`Orar` + `PIN`).
- **Fișiere:**
  - `packages/admin/src/App.jsx`
- **Ramură / Commit:** `main` (fără push, conform instrucțiunii utilizatorului)
- **Build / Teste:** Vite HMR live pe `http://localhost:4013/` — OK.

### 2026-11-11 10:49 — Ecran Animat „Mod Mentenanță” cu logo brand + Buton în Admin (Kiosk-uri & Screensavere)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Creat ecranul full-screen animat `MaintenanceScreen.jsx` cu logo-ul brandului în inel orbital luminos, mesaj „Kiosk temporar indisponibil / Mentenanță Tehnică” și fără niciun buton `X` (blochează complet atingerile clienților, cu deblocare de urgență pe Kiosk doar prin 5 atingeri rapide pe logo + PIN Manager/Casier).
  2. Adăugat butonul **„Mod Mentenanță”** / **„În Mentenanță (Oprește)”** în tabelul **Kiosk-uri & Screensavere** (lângă *Blochează acum*).
  3. Pornit și deschis pe localhost atât Admin (`http://localhost:4013/`) cât și Kiosk (`http://localhost:4010/?loc=cluj1`) pentru testare directă.
- **Fișiere:**
  - `packages/kiosk/src/screens/MaintenanceScreen.jsx`
  - `packages/kiosk/src/App.jsx`
  - `packages/admin/src/App.jsx`
- **Ramură / Commit:** `main` (fără push, conform instrucțiunii utilizatorului)
- **Build / Teste:** Dev servere pornite pe `localhost:4013` (Admin) și `localhost:4010` (Kiosk) — OK.

### 2026-11-11 10:33 — Favicon rotund cu iconița Smart Kiosk pentru Panoul Admin
- **Autor:** Antigravity
- **Ce s-a făcut:** Extragerea la rezoluție înaltă (`382x616`) a iconiței chioșcului din logo-ul Smart Kiosk, încadrarea ei pe fundal rotund alb cu contur fin și setarea ca `favicon.png`, `favicon.ico` și `apple-touch-icon.png` în `packages/admin/index.html`.
- **Fișiere:**
  - `packages/admin/index.html`
  - `packages/admin/public/favicon.png`
  - `packages/admin/public/favicon.ico`
  - `packages/admin/public/apple-touch-icon.png`
- **Ramură / Commit:** `main` (fără push, conform instrucțiunii utilizatorului)
- **Build / Teste:** `npm --prefix packages/admin run build` — OK.

### 2026-11-11 10:28 — Buton „Blochează acum” în Admin (Kiosk-uri & Screensavere) cu ecran PIN fără X
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Adăugat butonul **„Blochează acum”** direct în tabelul **Kiosk-uri & Screensavere** (coloana `Program`) și în setările locației (`Blocare Kiosk Instantă`).
  2. La apăsare, chioșcul intră instantaneu în ecranul de blocare cu PIN (`PinScreen.jsx`), identic cu blocarea automată de noapte (fără niciun buton `X` de închidere).
  3. Deblocarea se poate face exclusiv de pe ecranul Kiosk-ului prin introducerea **PIN-ului de Manager** (`kioskPin`) sau a **PIN-ului de Casier** (`vendorPin`), moment în care starea `forceLocked: false` se sincronizează automat înapoi către server și Admin.
- **Fișiere:**
  - `packages/admin/src/App.jsx`
  - `packages/kiosk/src/App.jsx`
  - `packages/backend/src/routes/locations.js`
  - `packages/backend/src/services/socketService.js`
- **Ramură / Commit:** `main` (fără commit/push, conform instrucțiunii utilizatorului `FARA PSUH`)
- **Build / Teste:** `node -c` pe backend + `npm run build` în `packages/kiosk` și `packages/admin` — OK.

### 2026-11-09 15:44 — Inițializare sincronizare Paperclip + Fix SGR duplicat & Cache Terminal Syrve (Constanța)
- **Autor:** Antigravity
- **Ce s-a făcut:** 
  1. Configurat regulile de sincronizare continuă Antigravity ↔ Paperclip (`Dev Smart Kiosk`).
  2. Rezolvat problema raportată de Valentin la Constanța (`CT-A-493`): recunoașterea ID-urilor SGR per brand/oraș (`9866d6c9-cb6f-44f8-a206-9cf7331124ed` / grup `e19aa802-1946-4054-830b-1da8998c303c` la Constanța și `e4b48e28-f52c-49c0-a029-c5cae198de7e` / grup `c15d3fdd-6b8e-487a-b75f-bf2628b5abc5` la Cluj) pentru a preveni atașarea duplicată a garanției SGR (0.50 lei) pe băuturi ambalate.
  3. Adăugat `TERMINAL_GROUP_CACHE` și `TERMINAL_GROUP_FALLBACKS` per organizație în `iikoService.js` (pentru a preveni trimiterea terminalului de Cluj ca fallback la Constanța în caz de lag Syrve).
- **Fișiere:** 
  - `packages/backend/src/services/iikoService.js`
  - `.agents/rules/paperclip-sync.md`
  - `.agents/AGENTS.md`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `59ba94e` (`fix(iiko): cache terminalGroupId per org and use Constanta fallback instead of Cluj`), anterior `e522f1d` (`fix(iiko): prevent duplicate SGR modifier on Constanta drinks by recognizing brand-specific SGR IDs` - pushed). Stare `git status --short`: `M .agents/AGENTS.md`, `?? .agents/CHANGELOG.md`, `?? .agents/rules/paperclip-sync.md`.
- **Build / Teste:** Verificare sintaxă `node -c` și simulare payload `createOrder` pentru `CT-A-493` — OK (1 singur modificator SGR atașat).

