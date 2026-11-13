# Jurnal de modificări — Smart Kiosk (Antigravity ↔ Paperclip)

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
- **Ramură / Commit:** `main` (necomis / fără push, așteaptă acordul utilizatorului)
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

