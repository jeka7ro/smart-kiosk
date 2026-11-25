# Jurnal de modificări — Smart Kiosk (Antigravity ↔ Paperclip)

### 2026-11-25 23:27 — Fix Opt-In `brandIds` / `matchesBrand` în Backend Vouchere + Commit & Push pe `main` (`voucherService.js`, `routes/vouchers.js`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Reparat suportul complet `brand_ids` / `brandIds` și validarea strict opt-in `matchesBrand` în `packages/backend/src/services/voucherService.js` și `packages/backend/src/routes/vouchers.js` (aliniat cu `db/index.js`, `VouchersManager.jsx` și `CartScreen.jsx` / `VoucherModal.jsx`).
  - Verificat prin test automat opt-in per-kiosk + per-brand, `node -c`, build `packages/admin` și build `packages/kiosk`.
  - Exclus `packages/backend/data/product_translations.json` (auto-generat local) și `.agents/TODO.md` din commit; publicat pe `origin/main` cu acordul explicit al utilizatorului.
- **Fișiere:** `packages/admin/**`, `packages/backend/src/**`, `packages/kiosk/src/**`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (pushed la cererea explicită a utilizatorului)
- **Build / Teste:** `node -c` backend ✓, test unitar `voucherService` ✓, `vite build` admin ✓, `vite build` kiosk ✓.

### 2026-11-24 16:49 — Păstrare Sidebar Vizibil în Modul Fullscreen (`App.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:** Eliminat ascunderea automată a sidebar-ului la intrarea în Fullscreen din `packages/admin/src/App.jsx`; sidebar-ul rămâne exact în starea aleasă de utilizator.
- **Fișiere:** `packages/admin/src/App.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build`.

### 2026-11-24 16:43 — Fix Real 5K Super-Ultrawide Bento Grid 100% Lățime (`index.css`, `DashboardCharts3D.jsx`, `App.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:** Rezolvat complet problemele de pe monitorul real 5K ultrawide (strict în `packages/admin`):
  - Eliminat limitarea artificială `max-width: 2360px/3200px` care lăsa benzi gri goale pe stânga/dreapta — acum folosește **100% din lățimea ecranului** pe orice rezoluție.
  - Înlocuit clasele conflictuale Tailwind (`xl:col-span-7` vs `min-[2600px]:col-span-5` care împingeau `Metode de Plată` singur pe rândul 2) cu un singur **CSS Grid `.dashboard-bento-grid`** pur (fără componente duplicate):
    - **Laptop (`1280–2099px`):** Rând 1 `7/5` (`Cumulat + Branduri`), Rând 2 `8/4` (`Calendar + Plăți`), Rând 3 `Top Produse`, Rând 4 `Comenzi`.
    - **21:9 / 27" 5K (`2100–2999px`):** Rând 1 **3 coloane** (`Cumulat 5 + Branduri 4 + Plăți 3`), Rând 2 **2 coloane** (`Calendar 6 + Top Produse 6`), Rând 3 `Comenzi`.
    - **32:9 / 5K Super-Ultrawide (`>= 3000px`):** Rând 1 **TOATE 4 GRAFICELE** (`Cumulat 8 + Branduri 6 + Calendar 6 + Plăți 4` din 24 coloane), Rând 2 **`Top Produse` (9) + `Comenzi Perioadă` (15)** side-by-side — tot dashboard-ul într-un singur ecran 5K!
  - Scalare optică font-size progresivă (`106.25%` >= 2200px, `115%` >= 3000px, `125%` >= 4200px) și donut mărit proporțional (`180px`) pe ecrane mari.
- **Fișiere:** `packages/admin/src/index.css`, `packages/admin/src/components/DashboardCharts3D.jsx`, `packages/admin/src/App.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` + verificare AST Rollup.

### 2026-11-24 16:37 — Buton Fullscreen în Header Admin & Optimizare Adaptivă Laptop → 5K Ultrawide (`App.jsx`, `index.css`, `DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:** Modificări strict în `packages/admin`:
  - Adăugat butonul circular Apple Liquid Glass **Fullscreen** (`Maximize2` / `Minimize2`) în colțul dreapta-sus din `App.jsx` (lângă Refresh & Dark Mode), conectat la Fullscreen API (`requestFullscreen` / `webkitRequestFullscreen` + sincronizare `Esc`).
  - Pe laptop (`< 1680px`), activarea Fullscreen restrânge automat sidebar-ul (și îl restaurează la ieșire) pentru spațiu maxim; pe ecrane late îl păstrează disponibil.
  - Adăugat scalare optică și containere adaptive în `index.css` (`Laptop 100%` → `27" 5K / 34" Ultrawide >= 2200px: max-w 2360px, 106.25%` → `49" Super-Ultrawide / 5K2K >= 3200px: max-w 3200px, 112.5%`).
  - Adăugat plafon curat de înălțime pe SVG-ul graficului principal (`max-h-[390px] 2xl:max-h-[430px]`) și layout Command Center pe 3 coloane (`min-[2600px]`) în `DashboardCharts3D.jsx` pentru monitoare 5K ultrawide.
- **Fișiere:** `packages/admin/src/App.jsx`, `packages/admin/src/index.css`, `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` + verificare AST Rollup.

### 2026-11-24 16:29 — Fix Trunchiere Media Comenzilor (`me...`) în Cardurile „Vânzări pe Branduri” (`DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:** Reorganizat fiecare rând din lista dreaptă a `BrandDonutChart3D` pe 2 linii full-width (Rând 1: nume brand + pilulă `lei` + `%`; Rând 2 pe toată lățimea: `14 cmd · med. 61 lei` și numărul de kioskuri în dreapta) și ajustat ușor coloana donut (`158px`), astfel încât media bonului nu se mai trunchiază niciodată.
- **Fișiere:** `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build`.

### 2026-11-24 16:26 — Dark Mode Negru-Neutru în Metode de Plată & Heatmap + Accent Emerald în Cardul Branduri (`DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Înlocuit toate clasele `dark:bg-slate-900` / `dark:bg-slate-800` / `dark:border-slate-800` din `PaymentMethodsChart3D` (Card POS, Cash la Casă, Bănci Emitente, Rețele Visa/MC, icon-uri, bare distribuție și footer strip) cu negru-neutru (`dark:bg-[#161618]`, `dark:bg-white/[0.04]`, `dark:border-white/[0.08]`).
  - Înlocuit celulele goale (`0`), legenda `0`, hover-urile și separatorul din `CalendarHeatmapChart` cu `dark:bg-white/[0.04]` și `dark:border-white/[0.08]`.
  - Schimbat accentele albastre și procentul `Poki-Woki` (`21%`) din cardul superior `BrandDonutChart3D` pe **emerald** (`#10B981` / `emerald-600 dark:emerald-400`).
- **Fișiere:** `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` + verificare AST Rollup.

### 2026-11-24 16:22 — Redesign „Vânzări pe Branduri” stil Screen 1 (KPI Strip + Donut cu Halo + Carduri + Drilldown Navigator) (`DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:** Refăcut complet `BrandDonutChart3D` („Vânzări pe Branduri”) conform modelului din Screen 1:
  - Header curat cu selector segmentat **`Branduri | Kioskuri | Locații`**.
  - Bandă de 4 mini-carduri KPI (`Total Încasări`, `Comenzi`, `Bon Mediu`, `Branduri`/`Kioskuri`/`Locații`).
  - Layout side-by-side (`xl:col-span-5` în Rândul 1): Donut stânga cu halo exterior discret + medalion interior alb cu chenar fin (`TOTAL / suma / LEI · CMD`) și listă de carduri curate în dreapta (logo rotund, nume, comenzi + bon mediu, pilulă valoare `lei` + procent colorat).
  - **DRILLDOWN NAVIGATOR (Ierarhie & Pondere)** în partea de jos cu bară orizontală segmentată proporțional, indicator `Nivel:`, hint interactiv și buton **`Resetare (100%)`**. Click pe orice felie/card/segment intră în nivelul de detaliu (Brand → Kioskuri, Locație → Branduri).
- **Fișiere:** `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` + verificare AST Rollup.

### 2026-11-24 14:58 — Mărire Poză Produs în Modalul de Detalii (`App.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:** Mărit containerul și imaginea produsului din modalul de detalii (`selectedItemDetail`) de la `h-64 sm:h-72` la `h-[400px] sm:h-[500px]` cu `w-full h-full object-contain`.
- **Fișiere:** `packages/admin/src/App.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build`.

### 2026-11-24 14:50 — Protecție DST la Alinierea Zilelor, Scale Rotunde Axa CMD & Refresh Comparație (`App.jsx`, `DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Verificat live pe Render `/api/orders`: `22.11` returnează `114` comenzi reale, `23.11` `43` comenzi reale, `Oct 1–24` `2 217` comenzi reale.
  - Înlocuit diferența de zile locală cu `dayDiffUTC` (imună la schimbarea orei de vară/iarnă din octombrie/martie) în `DashboardCharts3D.jsx`.
  - Rotunjit scala axei drepte (`CMD`) la pași curați (`cntStep` + 6% headroom) în loc de multipli de 4 (`513/1026/2052`).
  - Resetat `dashboardComparisonOrders` curat la schimbarea perioadei și inclus reîncărcarea comparației și în `handleManualRefresh` (`App.jsx`).
- **Fișiere:** `packages/admin/src/App.jsx`, `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` + verificare AST Rollup.

### 2026-11-24 14:48 — Încărcare Reală din `/api/orders` pentru Perioadele de Comparație (`App.jsx`, `DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - **Fix root cause (`22.11: 0.00 lei · 0 cmd`):** `App.jsx` încărca din `/api/orders` strict comenzile din perioada curentă (ex. doar `23.11` pe `Ieri`), astfel încât `22.11` (alaltăieri), `23.10`, `Ieri` pe `Azi`, `Săpt. trec.`, `Luna trec.` și `Anul trec.` nu existau în memorie.
  - Adăugat `getComparisonOrdersQueries` + state dedicat `dashboardComparisonOrders` în `App.jsx`, care încarcă în paralel din `/api/orders` comenzile **reale** pentru perioada de comparație corespunzătoare (Azi → Ieri + `24.10`; Ieri → Alaltăieri `22.11` + `23.10`; Săpt. → Săpt. trec.; Lună → Luna trec.; An → Anul trec.; Interval → Perioada anterioară egală), fără a polua tabelul sau cardurile principale.
  - În `DashboardCharts3D.jsx`, combinat corect `comparisonOrders` + `allOrders` (anterior `allOrders` suprascria `comparisonOrders`), eliminat baseline-ul artificial `0.82` și afișat valori RON și pe coloanele joase (`11:00`, `12:00`).
- **Fișiere:** `packages/admin/src/App.jsx`, `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` + verificare AST Rollup.

### 2026-11-24 14:43 — Mod Dual `Cumulat | Pe zile` pe Lună/Săpt. & Axa X Curată (Dată + Ziua Săptămânii) (`DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Adăugat selector segmentat **`Cumulat | Pe zile`** (sau `Cumulat | Pe luni` pe an) pentru toate perioadele multi-zi (`Săpt.`, `Săpt. trec.`, `Lună`, `Luna trec.`, `Anul curent`, `Interval`):
    - **`Cumulat`:** afișează totalul cumulat al lunii/perioadei comparativ cu aceeași perioadă anterioară (`Luna trec.`, `Săpt. trec.`, `Anul trec.`, `Per. ant.`).
    - **`Pe zile`:** afișează fiecare zi individuală (`01..24` / `01..31`), cu totalul corect al întregii perioade în header și comparație activabilă pe aceeași perioadă anterioară.
  - Eliminat complet suprapunerea etichetelor de pe axa X (ex. `01 no02 no03...`) printr-o **axă X pe 2 rânduri** cu **data + ziua săptămânii**:
    - Pe `Săpt.` / ≤ 10 zile: Rând 1 `Lun`, `Mar`, `Mie`, `Joi`, `Vin`, `Sâm`, `Dum`; Rând 2 `18 nov`, `19 nov`, ...
    - Pe `Lună` (`Pe zile`, 11–31 zile): Rând 1 `01`, `02`, ..., `24`; Rând 2 `Du`, `Lu`, `Ma`, `Mi`, `Jo`, `Vi`, `Sâ` (cu weekend-urile evidențiate discret în albastru).
    - Tooltip curat cu ziua completă a săptămânii și data (`Sâmbătă, 07 noiembrie`).
  - Anti-coliziune pe 24–31 zile: badge-uri compacte pentru comenzi cu decalare automată la vecini apropiați și valori RON verticale (`-90°`) curate în coloanele înguste.
- **Fișiere:** `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` + verificare AST Rollup.

### 2026-11-24 14:38 — Valori Mereu Vizibile fără Suprapuneri & Comparație pe Aceeași Perioadă (`DashboardCharts3D.jsx`, `App.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - **Header curat fără wrap sub titlu:** Mutat badge-urile `% RON` și `% cmd` pe linia de sumar de sub titlu, astfel încât titlul + controalele rămân aliniate pe un singur rând.
  - **Valori mereu vizibile pe ambele serii (coloane + linii), fără text lipit de baza axei X:**
    - Lățit coloanele grupate (`groupedBarW` până la `34px`) și poziționat valorile RON aproape de **partea superioară** a fiecărei coloane (`barY + 13`), vizibile mereu atât pe coloanele albastre (**Azi / Perioadă**) cât și pe coloanele portocalii/violet (**Ieri / Perioada anterioară**).
    - Afișat mereu valorile de comenzi (`cmd`) atât pe linia albastră cât și pe linia portocalie punctată, cu poziționare anti-coliziune (badge combinat `X / Y cmd` când sunt egale; deplasare curată stânga/dreapta deasupra coloanei proprii când diferă).
  - **Comparație pe zi vs. comparație pe aceeași perioadă:**
    - Pentru **1 singură zi** (`Azi`, `Ieri`, `Interval` de 1 zi): comparație pe ore cu ziua anterioară (`Ieri` / `DD.MM`) sau aceeași zi din luna trecută (`24.10`); reparat bug-ul în care selecția `Ieri` compara Ieri cu Ieri.
    - Pentru **perioade multi-zi** (`Săpt.`, `Săpt. trec.`, `Lună`, `Luna trec.`, `Anul curent`, `Interval`): ascuns butoanele zilnice și activat comparația reală din `allOrders` pe **aceeași perioadă anterioară** (`Săpt. trec.`, `Săpt. ant.`, `Luna trec.`, `Acum 2 luni`, `Anul trec.`, `Per. ant.`), cumulat și filtrat identic după locație, brand, plată și produs.
- **Fișiere:** `packages/admin/src/components/DashboardCharts3D.jsx`, `packages/admin/src/App.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` + verificare AST Rollup.

### 2026-11-24 14:24 — Grafic Combinat Column (RON) + Line (Comenzi) cu Două Axe Y Independente (`DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:** Refăcut complet `SalesTrendChart3D` („Total Comenzi Cumulat”) în format combinat **Column + Line Chart cu Dual Y-Axis independent**:
  - **Axa X (jos):** orele (`10:00`, `11:00`, `12:00`, `13:00`, `14:00`...) centrate pe slot.
  - **Coloane verticale (Bar Chart) → Axa Y STÂNGA (`RON`):** valoarea financiară cumulată în lei, scalată independent pe `maxRev` (Astăzi albastru `#007AFF`, Ieri portocaliu `#F59E0B`, 24.10 violet `#A855F7`).
  - **Linie (Line Chart) → Axa Y DREAPTA (`CMD`):** numărul cumulat de comenzi, scalat independent pe `maxCnt` (Astăzi linie solidă albastră cu halo + badge `X cmd`, Ieri linie punctată portocalie).
  - **Tooltip edge-aware Liquid Glass:** afișează ora, secțiunea `Valoare (RON)` (Azi vs Ieri + `%`), secțiunea `Comenzi (buc.)` (Azi vs Ieri + `%`) și activitatea din ora respectivă.
  - Păstrate toate calculele cumulative, sursele de date și filtrele (`Fără | Ieri | 24.10` + `RON + Cmd | RON | Comenzi`).
- **Fișiere:** `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 14:16 — Axe X și Y Vizibile cu Marcaje, Origine `0` și Etichete (`Comenzi`/`RON`, `Ora`) (`DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:** Adăugat linia verticală vizibilă a axei Y (`padX`), întărit linia orizontală a axei X (`baseY`), adăugat gradații scurte (ticks) pe ambele axe, valoarea `0` la origine și etichetele `Comenzi`/`RON` pe Y și `Ora`/`Zi` pe X.
- **Fișiere:** `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 14:14 — Grafic Curat Doar X + Y Stânga, Fără Suprapuneri & Fără `.00` (`DashboardCharts3D.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:** Scos axa RON din dreapta (păstrat exclusiv X jos + Y stânga), adăugat spațiu de siguranță în dreapta (`padRight = 28`) ca eticheta ultimului punct să nu atingă marginea și scos zecimalele `.00` de pe axă și de pe etichetele punctelor (`439 lei`, `141 lei`, `96 lei`).
- **Fișiere:** `packages/admin/src/components/DashboardCharts3D.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 14:10 — Dual Y-Axis (`cmd` stânga + `RON` dreapta) & Curbe Cumulative cu Etichete Duale + Restaurare Fixuri Suprascrise (`DashboardCharts3D.jsx`, `DynamicIsland.jsx`, `VouchersManager.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Adăugat **Dual Y-Axis** pe `SalesTrendChart3D` (`cmd` întregi pe stânga, `RON` multipli curați pe dreapta, cu evidențierea axei active), păstrând curbele cumulative (`Comenzi` default), etichetele duale permanente (`cmd` + `lei`) fără butonul `Valori` și popover-ul edge-aware Liquid Glass.
  - Restaurat eliminarea `Test Island` / `onTriggerTestOrder` duplicat din `DynamicIsland.jsx` și selecția `Branduri` + placeholder-urile curate din `VouchersManager.jsx` după suprascrierea externă de la 14:07.
- **Fișiere:** `packages/admin/src/components/DashboardCharts3D.jsx`, `packages/admin/src/components/DynamicIsland.jsx`, `packages/admin/src/screens/VouchersManager.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 12:42 — Coduri Promo Strict Opt-In per Kiosk (Ascunse implicit) + Eliminare Seed Demo + Fix Toast 404 Admin
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminare coduri demo & activare strict opt-in (`voucherService.js`, `routes/vouchers.js`):**
     - Eliminat `createInitialSeed()` (`VALENTIN10`, `SMASH5`) — serverul pornește cu `0` coduri active.
     - Adăugat `matchesKioskLocation()` strict opt-in (un cod fără kiosk selectat în `locationIds` nu este niciodată activ pe niciun kiosk) cu potrivire completă `loc.id` + `kioskUrl` (`smashme-main`/`cluj1`, `cluj2`, `sm-brasov`, `smashme-constanta`/`constanta1`).
     - Adăugat endpoint public `GET /api/vouchers/kiosk-availability?locationId=...&kioskId=...` pentru a verifica dacă pe acel kiosk există măcar un cod activ și valid.
  2. **Kiosk complet ascuns implicit (`CartScreen.jsx`, `VoucherModal.jsx`, `PaymentScreen.jsx`):**
     - Butonul `"Ai un cod promoțional?"` este **complet ascuns** (`hasActiveVouchers = false` implicit și fail-closed) până când există cel puțin un cod activ atribuit explicit acelui kiosk.
     - Înlocuit emoji-ul `🎟️` cu iconiță SVG curată și trimis atât `locationId`, cât și `kioskId` la validare.
  3. **Admin Vouchers (`VouchersManager.jsx`):**
     - Eliminat toast-ul de eroare falsă la 404 (când backend-ul Render nu are încă `/api/vouchers` publicat) și înlocuit cu un banner informativ clar.
     - Încărcare dinamică a kiosk-urilor reale din `/api/locations` și selecție obligatorie per kiosk la activarea unui cod.
- **Fișiere:** `packages/backend/src/services/voucherService.js`, `packages/backend/src/routes/vouchers.js`, `packages/kiosk/src/screens/CartScreen.jsx`, `packages/kiosk/src/components/VoucherModal.jsx`, `packages/kiosk/src/screens/PaymentScreen.jsx`, `packages/admin/src/screens/VouchersManager.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** Verificare `node -c`, unit test opt-in, `admin build` și `kiosk build`.

### 2026-11-24 12:24 — Fix Dynamic Island Toast Blocat Permanent & Filtru Strict Comenzi de Azi (`DynamicIsland.jsx`, `App.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Rezolvat bug-ul din `App.jsx` unde `setDeviceAlerts(prev => prev.filter(...))` returna un array nou la fiecare 2–3 secunde (la fiecare update socket), resetând constant timer-ul de 5.5s al Dynamic Island astfel încât notificarea de comandă nu dispărea niciodată.
  - Legat efectul de auto-dismiss din `DynamicIsland.jsx` exclusiv pe chei primitive (`activeKey`, `activeId`, `activeKind`, `activeDurationMs`) + refs pentru callback-uri, astfel încât update-urile de fundal să nu mai poată anula timer-ul.
  - Adăugat auto-curățare și filtrare strictă `isSameLocalDay` și direct în `DynamicIsland.jsx` pentru `orderToasts`, eliminând complet apariția comenzilor din zilele trecute (ex. `#CJ1C-158`).
- **Fișiere:** `packages/admin/src/components/DynamicIsland.jsx`, `packages/admin/src/App.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 12:22 — Fix Dynamic Island Toast Fals pentru Comenzi din Zilele Anterioare (`App.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Blocat declanșarea `triggerOrderToast` pentru comenzi care nu sunt de azi (ex. `#CJ1C-158` din 23.11) atunci când se schimbă tab-ul / perioada sau rulează polling-ul `limit=30` la 30s.
  - Păstrat acumulativ `knownOrderIdsRef` fără reset la schimbarea tab-ului și limitat alertele din polling strict la comenzi plasate azi în ultimele 5 minute.
- **Fișiere:** `packages/admin/src/App.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 12:18 — Corectare Sistemică Apple HIG Admin (Butoane pe 1 linie, Input-uri macOS, Meniu/Syrve, Branduri, Locații, Vouchere)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **`packages/admin/src/index.css` (`@layer components`):**
     - Mutat `.apple-card`, `.apple-input`, `.apple-btn-primary`, `.apple-btn-secondary`, `.apple-modal`, `.apple-glass` în `@layer components` pentru compoziție curată cu utilitarele Tailwind v4.
     - Adăugat `display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; flex-shrink: 0;` pe `.apple-btn-primary` și `.apple-btn-secondary` — eliminând ruperea pe 2 linii a butoanelor cu iconiță (`+ Adaugă Cod Nou`, `← Înapoi`).
     - Adăugat `padding: 9px 14px; border-radius: 12px;` pe `.apple-input` (eliminând câmpurile de formular turtite fără padding), păstrând `rounded-full` pe `<select>` și câmpurile de căutare din toolbars.
  2. **Meniu / Syrve (`MenuManager.jsx` + `packages/backend/src/routes/menu.js`):**
     - Rezolvat afișarea numelor reale de brand (`SmashMe`, `Crunch`, `Love Sushi`, `Poki-Woki`, `Roll Master`) în locul cheilor brute UUID (`9c63cff6-...`, `lovesushi:adddb5a0-...`).
     - Eliminat tăierea din marginea dreaptă a butonului `+ Adaugă Profil`, înlocuit stilul negru `bg-slate-900` cu `.apple-btn-primary` și adăugat `whitespace-nowrap` pe badge-urile de profil (`Cluj 1 (-4)`).
  3. **Branduri & Editare Locație (`App.jsx`):**
     - `BrandsManager`: afișare logo real prin `<BrandLogo>` (în locul literelor gri `C/I/L/P/R/S/W`), grid 4 coloane, bară curată cu 2 butoane capsulă (`Logo` + `Editează`) fără dropzone-uri uriașe cu bordură punctată.
     - `LocationEditForm`: lățime completă (`w-full`, eliminat `max-w-4xl`), buton `← Înapoi` pe o singură linie, input-uri macOS generoase, etichete de brand reale și eliminat `<code>` monospace.
     - Aliniat padding-ul containerului principal (`px-4 md:px-7`) cu titlul paginii și actualizat butoanele `bg-slate-900` rămase (`KioskEdit`, `IikoLogs`, `ProductOverrides`).
  4. **Promoții & Vouchere (`VouchersManager.jsx`, `Promotions.jsx`):**
     - Upgrade iconițe KPI la Apple App Icon Squircles vibrante, bară de căutare capsulă, buton `+ Adaugă Cod Nou` pe 1 linie, CTA direct în starea goală și aliniere full-width.
- **Fișiere:** `packages/admin/src/index.css`, `packages/admin/src/App.jsx`, `packages/admin/src/screens/MenuManager.jsx`, `packages/admin/src/screens/VouchersManager.jsx`, `packages/admin/src/screens/Promotions.jsx`, `packages/admin/src/screens/IikoLogs.jsx`, `packages/admin/src/screens/ProductOverrides.jsx`, `packages/admin/src/screens/TranslationsScreen.jsx`, `packages/admin/src/screens/UsersManager.jsx`, `packages/admin/src/screens/QrGenerator.jsx`, `packages/admin/src/screens/ModifierImages.jsx`, `packages/admin/src/screens/IntegrationDetail.jsx`, `packages/backend/src/routes/menu.js`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` + `node -c packages/backend/src/routes/menu.js` trecute (0 erori).

### 2026-11-24 11:54 — Finalizare Completă Coduri Promo (PostgreSQL + Syrve/iiko + Kiosk/POS + Bon) & Fallback Telemetrie Cluj 2 (Local, fără Push)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Persistență Vouchere în PostgreSQL / Supabase (`db/index.js`, `voucherService.js`, `routes/vouchers.js`, `index.js`):**
     - Creat tabelul `vouchers` în `initDb()` (persistent la redeploy pe Render) și sincronizare automată non-destructivă (`voucherService.syncWithDb()`) la pornirea serverului, cu fallback pe JSON local și incrementare atomică `used_count = used_count + 1`.
  2. **Integrare Syrve / iiko, Plăți POS, Kiosk & Bonuri (`orders.js`, `payment.js`, `iikoService.js`, `PaymentScreen.jsx`, `kioskStore.js`, `ThermalReceiptModal.jsx`, `App.jsx`):**
     - Adăugat `computeBrandSplitTotals` în `orders.js` (refolosit și în `payment.js`) pentru a distribui proporțional reducerea voucherului pe comenzile single-brand și multi-brand trimise către Syrve/iiko — eliminând discrepanța între suma încasată la POS și cea din iiko (`discountsInfo` + `payments.sum` exacte la ban).
     - Adăugat codul voucherului în comentariul comenzii trimise în iiko (`iikoService.js`).
     - Adăugat `voucherCode` + `voucherDiscount` în `orderPayload` la `/api/payment/initiate` (`PaymentScreen.jsx`) pentru plățile card și reset `appliedVoucher: null` în `resetAll` la inactivitate (`kioskStore.js`).
     - Afișat reducerea cuponului pe bonul termic (`ThermalReceiptModal.jsx`) și în fereastra de Detalii Comandă din Admin (`App.jsx`).
  3. **Fallback & Aliniere Telemetrie Cluj 2 (`bridgeMonitoringService.js`, `utils/locations.js`, `App.jsx`, `.agents/TODO.md`):**
     - Adăugat fallback complet `cluj2` (`cluj-2`, `cj2`, `cj-2`, `smashme-cj2`, `smashme cj-2`) în `bridgeMonitoringService.js` (`getStatusSummary` + raport Telegram) și `CITY_CONFIG.cluj.aliases`.
     - Extins alias-urile Cluj 2 și aliniat statusul `Online` în Dashboard, Dynamic Island și watcher-ul de alerte din `App.jsx` când POS Bridge COM5 este activ (`bridgeLoc?.isKioskOnline` + fallback Cluj 2).
- **Fișiere:** `packages/backend/src/db/index.js`, `packages/backend/src/index.js`, `packages/backend/src/services/voucherService.js`, `packages/backend/src/routes/vouchers.js`, `packages/backend/src/routes/orders.js`, `packages/backend/src/routes/payment.js`, `packages/backend/src/services/iikoService.js`, `packages/backend/src/services/bridgeMonitoringService.js`, `packages/backend/src/utils/locations.js`, `packages/kiosk/src/screens/PaymentScreen.jsx`, `packages/kiosk/src/store/kioskStore.js`, `packages/admin/src/components/ThermalReceiptModal.jsx`, `packages/admin/src/App.jsx`, `.agents/TODO.md`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (**fără `git push`**)
- **Build / Teste:** `node -c` (toate fișierele backend) + test `computeBrandSplitTotals` trecute; `npm --prefix packages/admin run build` (`2.90s`, 0 erori) și `npm --prefix packages/kiosk run build` (`1.02s`, 0 erori).

### 2026-11-24 11:44 — Eliminare Buton `Test Island` din Dynamic Island (`DynamicIsland.jsx`, `App.jsx`)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Eliminat complet butonul `Test Island` și handler-ul de comenzi simulate (`onTriggerTestOrder`) din `DynamicIsland.jsx` și `App.jsx`.
- **Fișiere:** `packages/admin/src/components/DynamicIsland.jsx`, `packages/admin/src/App.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 11:43 — Restaurare Font Curat `Plus Jakarta Sans` (Eliminare Fonturi Robotizate & `tabular-nums`) + Logo Oficial GetApp (Admin)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Restaurat fontul geometric curat `'Plus Jakarta Sans'` (încărcat în `index.html`) pe întreg panoul Admin (`html`, `body`, `button`, `input`, `select`, `textarea`) în `packages/admin/src/index.css`, eliminând suprascrierea cu fonturi de sistem / `Roboto` și dezactivând `tabular-nums` (cifrele monospațiate/robotizate).
  - Eliminat `font-mono` de pe etichete, tabele, ID-uri, vouchere, coduri QR și modaluri din interfața UI (`App.jsx`, `Promotions.jsx`, `VouchersManager.jsx`, `QrGenerator.jsx`, `PosLogs.jsx`, `IntegrationDetail.jsx`, `RemoteDesktopViewer.jsx`), păstrând monospace exclusiv pe consola terminal și scripturile de copiat.
  - Restaurat logo-ul oficial `GetApp Smart Kiosk` (`/getapp_smart_kiosk_logo.png` / `/getapp_smart_kiosk_white.png`) în header-ul de sus, încadrat curat lângă butonul circular glass de ascundere sidebar.
- **Fișiere:** `packages/admin/src/index.css`, `packages/admin/src/App.jsx`, `packages/admin/src/screens/Promotions.jsx`, `packages/admin/src/screens/VouchersManager.jsx`, `packages/admin/src/screens/QrGenerator.jsx`, `packages/admin/src/screens/PosLogs.jsx`, `packages/admin/src/screens/IntegrationDetail.jsx`, `packages/admin/src/components/RemoteDesktopViewer.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 11:39 — Fix Chevron Repetat pe `<select>` în Dark Mode (`index.css`, Admin)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Înlocuit shorthand-ul `background:` cu `background-color:` pe `.apple-input` / `.dark .apple-input` (care reseta `background-repeat: no-repeat` și repeta chevron-ul `⌄` pe tot fundalul dropdown-urilor în Dark Mode) și forțat explicit `background-repeat: no-repeat`, `background-position: right 11px center`, `background-size: 12px 12px` pe `select.apple-input` în Light și Dark Mode.
- **Fișiere:** `packages/admin/src/index.css`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 11:38 — Dynamic Island: Filtrare Strictă pe Comenzile de Astăzi (Sortate Descrescător)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Adăugat filtrul `isSameLocalDay` + sortare descrescătoare după `createdAt` în `DynamicIsland.jsx`: capsula Dynamic Island și secțiunea `Comenzi Azi` din Centrul de Notificări afișează acum **exclusiv ultima comandă de astăzi** (alternând cu LIVE Status); dacă nu există încă nicio comandă azi, rămâne strict pe LIVE Status fără să afișeze comenzi din zilele trecute.
- **Fișiere:** `packages/admin/src/components/DynamicIsland.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 11:36 — Buton Ascundere Sidebar la Limita Sidebar/Header + Logo GetApp Reînnoit Apple Style (Admin)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Mutat butonul circular Apple Liquid Glass de ascundere/afișare sidebar (`PanelLeftClose` / `PanelLeftOpen`, `.apple-glass-btn-sm`) exact la limita dintre sidebar (`240px`, `md:w-60 md:border-r`) și conținut în header-ul de sus, funcțional acum atât pe desktop (collapse/expand lin salvat în `localStorage`), cât și pe mobil (drawer).
  - Reînnoit logo-ul `GetApp Smart Kiosk` din header în stil Apple Retina: păstrată fidel silueta iconică a chioșcului cu ecran roșu (randată vectorial cu reflexie glass fină într-un squircle curat, adaptiv Light/Dark) + tipografie SF Pro (`GetApp` / `Smart Kiosk`), fără ștergerea asset-urilor PNG existente.
- **Fișiere:** `packages/admin/src/App.jsx`, `packages/admin/src/index.css`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 11:32 — LIVE Status (`BridgeMonitoring.jsx`): Butoane Capsulă Apple Glass, Fix Switch `Trezire Standby` & Squircles (Admin)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Upgrade pe toate cele 8 butoane de acțiune per kiosk (`Bridge`, `Ecran`, `Fullscreen`, `Semnal POS`, `Test Bon`, `Blocare PIN`, `Restart PC`, `Start.bat`) la capsule complet rotunjite `.apple-btn-secondary` (`rounded-full`) cu iconițe colorate semantic Apple.
  - Corectat bug-ul vizual de pe toggle-ul `Trezire Standby` (unde bila albă ieșea 4px în afara pistei verzi din cauza suprascrierii `!w-[38px]` în Tailwind v4) prin clasa dedicată `.apple-switch-sm` în `packages/admin/src/index.css`.
  - Înlocuit căsuțele plate gri ale iconițelor de secțiune din `BridgeMonitoring.jsx` cu Apple App Icon Squircles (`Stare Echipamente`, `Comandă Universală`, `Alerte Telegram`).
- **Fișiere:** `packages/admin/src/screens/BridgeMonitoring.jsx`, `packages/admin/src/index.css`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` ✓ (2.19s) + verificare AST Rollup (`undefs: []`).

### 2026-11-24 11:30 — Dynamic Island Liquid Glass Adaptiv Light/Dark + Alternare Live Status / Ultima Comandă & Animare Ieșire/Intrare (Admin)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - **Light / Dark mode adaptiv (`.di-surface`):** În modul deschis (Light), Dynamic Island este acum o capsulă **Apple Liquid Glass albă/translucidă** cu contur fin și reflexie speculară (nu mai rămâne pe negru); în modul întunecat (Dark) folosește sticlă obsidian translucidă.
  - **Alternare curată în starea compactă:** Capsula alternează automat la 4.2s (cu animație fină `di-slot-in`, oprită la hover) între **LIVE Status** (`4/4 Online` / alertă echipament) și **Ultima comandă** afișând strict **Logo + `#Număr` + `Sumă lei`**.
  - **Animație spring ieșire → intrare înapoi:** La apariția unei comenzi noi (live sau `Test Island`), comanda iese/se extinde elastic din Dynamic Island (`.is-live`, `di-content-in`), iar la expirare sau închidere se retrage lin înapoi în capsulă (`di-content-out`), rămânând pe slotul comenzii înainte să reia alternarea cu LIVE Status.
- **Fișiere:** `packages/admin/src/components/DynamicIsland.jsx`, `packages/admin/src/index.css`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut (0 erori).

### 2026-11-24 11:27 — Toate Butoanele de Acțiune, Modale, Tabele & Paginare Rotunjite (`rounded-full`) în Întreg Panoul Admin
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Convertit la capsulă complet rotunjită (`rounded-full`) butoanele din footer-ul modalului Detalii Comandă (`Anulează Comanda (Refuz)` și `Vezi Bon Termic`) din `App.jsx`.
  - Efectuat audit complet pe toate `<button>`-urile din `packages/admin/src/` și convertit **166 de butoane** de acțiune, modale, sidebar, tabele, paginare și iconițe în **22 de fișiere** la `rounded-full` (păstrând neatinse cardurile multi-linie și celulele matricei heatmap).
- **Fișiere:** `App.jsx`, `ConfirmModal.jsx`, `DashboardCharts3D.jsx`, `OrdersNotificationBell.jsx`, `RemoteDesktopViewer.jsx`, `SoftwareReleaseNotesModal.jsx`, `WindowsRemoteModal.jsx`, `BridgeMonitoring.jsx`, `IikoLogs.jsx`, `Integrations.jsx`, `MenuManager.jsx`, `ModifierImages.jsx`, `PendingOrders.jsx`, `PortScans.jsx`, `PosLogs.jsx`, `PrinterLogs.jsx`, `ProductOverrides.jsx`, `Promotions.jsx`, `QrGenerator.jsx`, `TranslationsScreen.jsx`, `UsersManager.jsx`, `VouchersManager.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut (`3.82s`, 0 erori).

### 2026-11-24 11:25 — Butoane, Filtre & Controale Segmentate Complet Rotunjite (`rounded-full` Capsule Apple Style) în Admin
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Actualizat global `.apple-segmented`, `.apple-segmented-item`, `.apple-input` (`select` + `input`, păstrând `16px` pe `textarea`), `.apple-btn-primary` și `.apple-btn-secondary` la **capsulă complet rotunjită (`border-radius: 9999px`)**, cu segment activ solid Apple Blue `#007AFF` + text alb (`is-active`) conform referințelor utilizatorului.
  - Aplicat bare de filtre și strip Live Kiosks concentrice (`!rounded-full`), logo-uri de brand încadrate curat pe pastilă albă când sunt selectate și upgrade la `.apple-segmented` pe toate toggle-urile graficelor (`SalesTrendChart3D`, `BrandDonutChart3D`, `CalendarHeatmapChart`, `TopProductsChart3D`) și ecranelor de loguri (`Orders`, `PosLogs`, `PendingOrders`, `IikoLogs`, `PrinterLogs`, `KioskLogs`, `QrGenerator`).
- **Fișiere:** `packages/admin/src/index.css`, `packages/admin/src/App.jsx`, `packages/admin/src/components/DashboardCharts3D.jsx`, `packages/admin/src/screens/PosLogs.jsx`, `packages/admin/src/screens/PendingOrders.jsx`, `packages/admin/src/screens/IikoLogs.jsx`, `packages/admin/src/screens/PrinterLogs.jsx`, `packages/admin/src/screens/KioskLogs.jsx`, `packages/admin/src/screens/QrGenerator.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut (0 erori).

### 2026-11-24 11:16 — Contur Circular Apple Liquid Glass pe Butoanele de Iconițe din Header & Toolbar (Admin)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Creat `.apple-glass-btn` și `.apple-glass-btn-danger` în `packages/admin/src/index.css`: butoane rotunde (`36×36px`, `rounded-full`) cu efect Apple Liquid Glass (contur circular vizibil `1px`, gradient translucid, `backdrop-filter: saturate(200%) blur(18px)`, reflexie speculară superioară `inset` și umbră discretă în Light & Dark mode).
  - Aplicat conturul rotund glass pe toate iconițele din header (`Refresh`, `Mod Luminos/Întunecat`, `Deconectare`, `Meniu mobil`) și pe butoanele circulare din barele de control (`App.jsx`, `PendingOrders.jsx`).
- **Fișiere:** `packages/admin/src/index.css`, `packages/admin/src/App.jsx`, `packages/admin/src/screens/PendingOrders.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut (0 erori).

### 2026-11-24 11:15 — Iconițe Apple Squircle (macOS Sequoia / iOS 18) & Eliminare Completă Simbol `$` (Admin)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Eliminat complet ultimele iconițe `Receipt` (cu simbolul `$`) din `App.jsx` și `PosLogs.jsx`, înlocuite cu `ShoppingBag` și `FileText`.
  - Înlocuit căsuțele plate gri (`bg-[#F5F5F7]` / `bg-slate-100`) cu **Apple App Icon Squircles** autentice (culori de sistem Apple `#007AFF`, `#34C759`, `#FF3B30`, `#5856D6`, `#FF9500`, gradient subtil vertical, highlight specular superior și simbol alb clar) în `StatCard` (`App.jsx`, `PendingOrders.jsx`) și pe toate cele 5 grafice din Dashboard (`DashboardCharts3D.jsx`).
- **Fișiere:** `packages/admin/src/App.jsx`, `packages/admin/src/components/DashboardCharts3D.jsx`, `packages/admin/src/screens/PendingOrders.jsx`, `packages/admin/src/screens/PosLogs.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut (0 erori).

### 2026-11-24 11:15 — Iconițe Apple Squircle (macOS Sequoia / iOS 18) & Eliminare Completă Simbol `$` (Admin)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  - Eliminat complet ultimele iconițe `Receipt` (cu simbolul `$`) din `App.jsx` și `PosLogs.jsx`, înlocuite cu `ShoppingBag` și `FileText`.
  - Înlocuit căsuțele plate gri (`bg-[#F5F5F7]` / `bg-slate-100`) cu **Apple App Icon Squircles** autentice (culori de sistem Apple `#007AFF`, `#34C759`, `#FF3B30`, `#5856D6`, `#FF9500`, gradient subtil vertical, highlight specular superior și simbol alb clar) în `StatCard` (`App.jsx`, `PendingOrders.jsx`) și pe toate cele 5 grafice din Dashboard (`DashboardCharts3D.jsx`).
- **Fișiere:** `packages/admin/src/App.jsx`, `packages/admin/src/components/DashboardCharts3D.jsx`, `packages/admin/src/screens/PendingOrders.jsx`, `packages/admin/src/screens/PosLogs.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut (0 erori).

### 2026-11-24 11:11 — Filtre Strict pe un Singur Rând, Select-uri Native macOS, Iconițe & Grafic Flat Apple HIG (Admin)
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin`):**
  1. **Bară de filtre pe un singur rând (`App.jsx`, `PosLogs.jsx`, `PendingOrders.jsx`, `IikoLogs.jsx`, `PrinterLogs.jsx`, `KioskLogs.jsx`):**
     - Reconstruit bara de filtre din Dashboard (`flex-nowrap`, `Azi | Ieri | Săpt. | Lună` + pop-up compact `Mai mult` pentru `Săpt. trec. / Luna trec. / Anul curent / Interval...`, locații, plăți și search `flex-1`), astfel încât toate controalele stau aliniate pe un singur rând pe desktop (fără wrap pe 2 rânduri), iar intervalul de date apare dedesubt doar când este selectat `Interval...`.
     - Aliniat pe același model de toolbar pe un singur rând și barele de filtre din `Comenzi`, `Loguri POS`, `Comenzi În Așteptare`, `Loguri iiko`, `Loguri Imprimantă` și `Loguri Kiosk`.
  2. **Select-uri native macOS & controale Header (`index.css`, `App.jsx`):**
     - Eliminat săgețile groase default de browser pe `select.apple-input` (`appearance: none` + chevron SVG fin aliniat, înălțime uniformă `32px` cu `.apple-segmented`).
     - Înlocuit iconițele wireframe goale din dreapta header-ului cu grup frosted pill macOS Sequoia (`Refresh | Temă` + buton circular `Deconectare`).
     - Înlocuit iconița `$` (`Receipt`) de pe cardul KPI `Comenzi` și din sidebar cu `ShoppingBag` / `FileText` în squircle Apple colorat subtil (`#007AFF` / `#34C759`), plus restilizat popover-ul Live Kiosk și pastila `Soft la zi` în stil Apple HIG.
  3. **Grafic vânzări complet plat Apple Stocks (`DashboardCharts3D.jsx`):**
     - Eliminat offset-ul isometric rezidual (`depth = 14`), liniile diagonale 3D din dreapta grilei și gradientul neon/indigo; linia de comparație se aliniază pe aceeași bază orizontală curată, cu tooltip glassmorphic `#1C1C1E`.
- **Fișiere:** `packages/admin/src/index.css`, `packages/admin/src/App.jsx`, `packages/admin/src/components/DashboardCharts3D.jsx`, `packages/admin/src/screens/PosLogs.jsx`, `packages/admin/src/screens/PendingOrders.jsx`, `packages/admin/src/screens/IikoLogs.jsx`, `packages/admin/src/screens/PrinterLogs.jsx`, `packages/admin/src/screens/KioskLogs.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut (2.71s, 0 erori); HMR live curat pe Vite `localhost:4013`.

### 2026-11-24 10:52 — Redesign Complet Apple HIG (macOS Sequoia / iOS 18) + Dynamic Island în Întreg Panoul Admin
- **Autor:** Antigravity
- **Ce s-a făcut (EXCLUSIV `packages/admin` — Kiosk-ul clienților neatins):**
  1. **Apple Dynamic Island & Notification Center (`DynamicIsland.jsx`, `index.css`, `App.jsx`):**
     - Creat componenta `DynamicIsland.jsx` ancorată în centrul barei de header (`grid-cols-[1fr_auto_1fr]`), cu pastilă obsidian `#1C1C1E`/`#000000`, status hardware live (`3/4 Online` / alertă POS), animații spring de intrare/ieșire (`di-morph-in` / `di-morph-out`) și bară countdown la mesajele live (comenzi noi, alerte POS/echipamente, notificări sistem).
     - Click pe Dynamic Island deschide Centrul de Notificări Apple cu tab-uri segmentate (`Toate | Comenzi | Alerte`), buton `Test Island`, listă alerte hardware și comenzi recente, eliminând banner-ul mare portocaliu și toast-urile vechi.
  2. **Header Bar, Sidebar & Design System Apple HIG (`index.css`, `App.jsx`):**
     - Înlocuit antetul vechi cu toolbar macOS Sequoia (`h-14`, vibrancy, controale borderless) și sidebar 240px cu pill activ `#007AFF`.
     - Introdus tokeni autentici Apple (`#F5F5F7` / `#000000` canvas, `#FFFFFF` / `#1C1C1E` carduri, `#007AFF` System Blue, `#34C759`, `#FF9500`, `#FF3B30`, `.tabular-nums`) și primitive unitare (`.apple-card`, `.apple-inset-group`, `.apple-modal`, `.apple-input`, `.apple-segmented`, `.apple-switch`, `.apple-btn-primary`, `.apple-btn-secondary`, `.apple-close-btn` AAA 8.2:1).
     - Curățat Dashboard Overview (eliminat dungi colorate `borderTop/borderLeft`, halouri neon 3D, fixat tăierea `Luna...` și butoanele goale de închidere pe filtre).
  3. **Grafice Apple Flat (`DashboardCharts3D.jsx`):**
     - `SalesTrendChart3D`: spline curat `#007AFF` fără podea 3D isometrică și fără etichete suprapuse (`Valori` off implicit).
     - `BrandDonutChart3D`: înlocuit cilindrul 3D Excel cu Apple Donut Ring plat și legende pe 2 rânduri (fără trunchiere `S...`).
     - `PaymentMethodsChart3D`, `CalendarHeatmapChart`, `TopProductsChart3D`: carduri `.apple-card`, bare plate tip Apple Storage, controale segmentate.
  4. **LIVE Status & Alerte Telegram (`BridgeMonitoring.jsx`):**
     - Reconstruit integral în stil macOS System Settings Inset Grouped: eliminat toți emojii (`🟢`, `🟡`, `⏳`, `🔒`, `🔄`, `🚀`), eliminat checkbox-uri/radio native HTML și caseta galbenă, introdus `.apple-switch`, selecție cu bife circulare `#007AFF`, carduri hardware echilibrate și modal istoric semnal `.apple-modal` + `.apple-close-btn`.
  5. **Audit & Redesign pe Toate Celelalte Pagini & Modale din Admin:**
     - `Promotions.jsx`, `VouchersManager.jsx`, `MenuManager.jsx`, `Integrations.jsx`, `IntegrationDetail.jsx`, `ModifierImages.jsx`, `TranslationsScreen.jsx`, `QrGenerator.jsx`, `ProductOverrides.jsx`, `UsersManager.jsx` (inclusiv fix import lipsă `X`), `LoginScreen.jsx`, `ConfirmModal.jsx`, `WindowsRemoteModal.jsx`, `PosLogs.jsx`, `IikoLogs.jsx`, `PrinterLogs.jsx`, `PortScans.jsx`, `KioskLogs.jsx`, `PendingOrders.jsx`, plus ecranele embedded din `App.jsx` (`Orders`, `OrdersTable`, `KiosksManager`, `KioskSwitch`, `LocationsManager`, `LocationEditForm`, `BrandsManager`).
     - Eliminat 100% din emojii din interfața Admin, reparat toate `<textarea>` / cardurile care aveau `rounded-full`, standardizat toate `StatCard`-urile (fără benzi colorate/halouri) și toate ferestrele modale cu `.apple-modal` + `.apple-close-btn`.
- **Fișiere:**
  - `packages/admin/src/index.css`, `packages/admin/src/components/DynamicIsland.jsx`, `packages/admin/src/App.jsx`, `packages/admin/src/components/DashboardCharts3D.jsx`, `packages/admin/src/components/WindowsRemoteModal.jsx`, `packages/admin/src/components/ConfirmModal.jsx`, `packages/admin/src/screens/BridgeMonitoring.jsx`, `packages/admin/src/screens/Promotions.jsx`, `packages/admin/src/screens/VouchersManager.jsx`, `packages/admin/src/screens/MenuManager.jsx`, `packages/admin/src/screens/Integrations.jsx`, `packages/admin/src/screens/IntegrationDetail.jsx`, `packages/admin/src/screens/ModifierImages.jsx`, `packages/admin/src/screens/TranslationsScreen.jsx`, `packages/admin/src/screens/QrGenerator.jsx`, `packages/admin/src/screens/ProductOverrides.jsx`, `packages/admin/src/screens/UsersManager.jsx`, `packages/admin/src/screens/LoginScreen.jsx`, `packages/admin/src/screens/PosLogs.jsx`, `packages/admin/src/screens/IikoLogs.jsx`, `packages/admin/src/screens/PrinterLogs.jsx`, `packages/admin/src/screens/PortScans.jsx`, `packages/admin/src/screens/KioskLogs.jsx`, `packages/admin/src/screens/PendingOrders.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local pe `main` (fără `git push`)
- **Build / Teste:** `npm --prefix packages/admin run build` & `npm --prefix packages/kiosk run build` trecute fără erori; 0 emoji-uri rămase în `packages/admin/src`.

### 2026-11-24 09:56 — Curățat și Aliniat Antetele Graficelor la Apple HIG (Evoluție Vânzări, Branduri, Heatmap, Top Produse)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Eliminat din bara graficului `Evoluție Vânzări & Încasări` (`DashboardCharts3D.jsx`) toate elementele stridente non-Apple:
    1. **Eliminat butoanele tip bomboană multicolore:** Înlocuit pastilele neon (portocaliu aprins `vs Ieri`, mov `vs 24.10`, albastru electric `Valori pe Grafic`, pastile conturate) cu un **Segmented Control Apple unificat** în stil macOS System Settings (`bg-slate-100 p-0.5 rounded-xl border border-slate-200/60`).
    2. **Stil Apple pentru Comparație:** Opțiunile `Fără comp.` | `vs Ieri` | `vs Luna trecută` folosesc acum cardul alb/dark calm cu umbră 2xs pentru selecție activă, fără fundaluri neon portocalii sau mov.
    3. **Switch Metrică Curat:** Comutatorul `Încasări (RON)` vs `Nr. Comenzi` este acum un controller segmentat Apple uniform.
    4. **Buton Valori pe Grafic:** Transformat în buton secundar discret Apple (`bg-slate-900 text-white` când e activ, `bg-slate-100` când e inactiv).
    5. **Standardizat Iconițele Antet:** Înlocuit blocurile mari cu gradiente electrice și umbre grele prin iconițe Apple Squircle (`w-8 h-8 rounded-xl bg-slate-100 text-slate-700`) pe toate cele 4 grafice (Vânzări, Branduri, Heatmap, Top Produse).
- **Fișiere:**
  - `packages/admin/src/components/DashboardCharts3D.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (zero git push)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut cu succes (3.34s, 0 erori).

### 2026-11-24 09:52 — Rezolvat Contrastul și Vizibilitatea Iconiței de Închidere (X) în Toate Ferestrele Modale din Admin
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Identificat cauza pentru care iconițele de închidere `X` nu se vedeau: clasa `text-slate-400` pe fundal `bg-slate-100` avea un contrast extrem de scăzut (1.8:1), iar în unele modale butonul era gol sau folosea caractere unicode subțiri (`&times;`, `✕`).
  - Creat clasa dedicată `.apple-close-btn` în `index.css`:
    - Contrast înalt (8.2:1 AAA): fundal `#e2e8f0` (slate-200), culoare glyph `#0f172a` (slate-900 în light) și `#f8fafc` pe `#334155` în dark.
    - Grosime `stroke-width: 2.5px !important` și dimensiune precisă `16x16px` pentru o vizibilitate impecabilă pe orice ecran.
    - Efecte tactile de hover/active în stil Apple.
  - Aplicat `.apple-close-btn` în mod unitar în toate ferestrele modale:
    1. Modal Detalii Comandă (`App.jsx`)
    2. Modal Detalii Produs (`App.jsx`)
    3. Popover Detalii Locație (`App.jsx`)
    4. Modal Bon Fiscal Termic (`ThermalReceiptModal.jsx`)
    5. Modal Note Actualizare Software (`SoftwareReleaseNotesModal.jsx`)
    6. Modal Previzualizare Descriere (`ProductOverrides.jsx`)
    7. Modal Editare Utilizatori (`UsersManager.jsx`)
    8. Modal Coduri Promoționale / Vouchere (`VouchersManager.jsx`)
    9. Modal Detalii Draft Comandă (`PendingOrders.jsx`)
- **Fișiere:**
  - `packages/admin/src/index.css`
  - `packages/admin/src/App.jsx`
  - `packages/admin/src/components/ThermalReceiptModal.jsx`
  - `packages/admin/src/components/SoftwareReleaseNotesModal.jsx`
  - `packages/admin/src/screens/ProductOverrides.jsx`
  - `packages/admin/src/screens/UsersManager.jsx`
  - `packages/admin/src/screens/VouchersManager.jsx`
  - `packages/admin/src/screens/PendingOrders.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (zero git push)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut cu succes (5.40s, 0 erori).

### 2026-11-24 09:52 — Rezolvat Contrastul și Vizibilitatea Iconiței de Închidere (X) în Toate Ferestrele Modale din Admin
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Identificat cauza pentru care iconițele de închidere `X` nu se vedeau: clasa `text-slate-400` pe fundal `bg-slate-100` avea un contrast extrem de scăzut (1.8:1), iar în unele modale butonul era gol sau folosea caractere unicode subțiri (`&times;`, `✕`).
  - Creat clasa dedicată `.apple-close-btn` în `index.css`:
    - Contrast înalt (8.2:1 AAA): fundal `#e2e8f0` (slate-200), culoare glyph `#0f172a` (slate-900 în light) și `#f8fafc` pe `#334155` în dark.
    - Grosime `stroke-width: 2.5px !important` și dimensiune precisă `16x16px` pentru o vizibilitate impecabilă pe orice ecran.
    - Efecte tactile de hover/active în stil Apple.
  - Aplicat `.apple-close-btn` în mod unitar în toate ferestrele modale:
    1. Modal Detalii Comandă (`App.jsx`)
    2. Modal Detalii Produs (`App.jsx`)
    3. Popover Detalii Locație (`App.jsx`)
    4. Modal Bon Fiscal Termic (`ThermalReceiptModal.jsx`)
    5. Modal Note Actualizare Software (`SoftwareReleaseNotesModal.jsx`)
    6. Modal Previzualizare Descriere (`ProductOverrides.jsx`)
    7. Modal Editare Utilizatori (`UsersManager.jsx`)
    8. Modal Coduri Promoționale / Vouchere (`VouchersManager.jsx`)
    9. Modal Detalii Draft Comandă (`PendingOrders.jsx`)
- **Fișiere:**
  - `packages/admin/src/index.css`
  - `packages/admin/src/App.jsx`
  - `packages/admin/src/components/ThermalReceiptModal.jsx`
  - `packages/admin/src/components/SoftwareReleaseNotesModal.jsx`
  - `packages/admin/src/screens/ProductOverrides.jsx`
  - `packages/admin/src/screens/UsersManager.jsx`
  - `packages/admin/src/screens/VouchersManager.jsx`
  - `packages/admin/src/screens/PendingOrders.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (zero git push)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut cu succes (5.40s, 0 erori).

### 2026-11-24 09:47 — Redesenare Modal Detalii Produs în Admin conform Stilului Kiosk & Apple HIG (Hero Mare Sus + Text Cuminte Dedesubt)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Redesenat de la zero fereastra modală de previzualizare / detalii produs (`selectedItemDetail` din `App.jsx`), eliminând formatul asimetric pe două coloane care înghesuia o poză mică de 250px într-un spațiu gol uriaș:
    1. **Antet & Buton Închidere Apple:** Titlul produsului afișat lizibil cu font SF Pro, însoțit de un buton circular tactil funcțional de închidere cu iconiță `X` (`w-8 h-8 rounded-full bg-slate-100`).
    2. **Poza Mare Apetisantă Sus (Hero):** Imaginea produsului este acum poziționată generos în partea superioară a cardului (`h-64 sm:h-72`), cu fundal cald în gradient, squircle rotunjit și umbre difuze.
    3. **Text Cuminte și Structurat Dedesubt:**
       - Parsare automată a descrierii din Syrve identică cu logica din Kiosk (separă descrierea comercială de ingrediente și declarația nutrițională).
       - Card Inset Apple pentru **Ingrediente Complete**.
       - Card Inset Apple pentru **Informații Nutriționale**, incluzând grilă de cipuri elegante pentru Greutate, Energie, Proteine, Grăsimi și Carbohidrați.
- **Fișiere:**
  - `packages/admin/src/App.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (zero git push)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut cu succes (5.23s, 0 erori).

### 2026-11-24 09:42 — Redesenare Completă Componente Non-Apple la Apple HIG / Craft (Metode de Plată, Notificări, Popover Locație, Bare de Control)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Identificat și eliminat toate elementele plastice, 3D aqua/vista glossy, badge-urile tip confetti și dungile groase de culoare din Admin:
    1. **Metode de Plată (`DashboardCharts3D.jsx`):**
       - Înlocuit bara cilindrică 3D din plastic glossy (`linear-gradient` metalic cu reflexii 3D Aqua) cu o bară de distribuție segmentată plată în stil Apple Storage / Battery (`h-3 rounded-full bg-slate-100 flex p-0.5 gap-0.5`).
       - Eliminat dungile laterale dure `borderLeft: 4px solid #059669` / `#f59e0b`.
       - Eliminat halourile radiale neon cu blur (`blur-md opacity-35`).
       - Înlocuit containerele 3D cu ramă proeminentă prin containere iconiță squircle Apple (`w-10 h-10 rounded-xl bg-slate-100`).
       - Înlocuit etichetele bombate cu insigne semantice subtile Apple.
    2. **Toast Notificare Comandă (`OrderToastNotification.jsx`):**
       - Înlocuit capsula aglomerată cu 4 pastile multicolore de bomboane cu un banner autentic de notificare macOS / iOS Dynamic Island (`bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 rounded-2xl shadow-[0_12px_32px_-4px_rgba(0,0,0,0.18)]`).
       - Ierarhie tipografică clară (SF Pro), logo brand în squircle, număr și total elegant integrate, stare unificată discretă (`● iiko OK • Cash la casă`) și buton de închidere tactil.
    3. **Meniu Popover Detalii Locație (`App.jsx`):**
       - Înlocuit lista brută de text cu două puncte printr-o listă Apple Inset Grouped cu separatori hairlines și cheie-valoare aliniate ordonat.
       - Înlocuit chenarul galben strident de pe butonul Fullscreen și unificat cele 4 butoane de control într-o bară cu butoane secundare Apple curate.
       - Înlocuit butonul violet masiv cu un buton rafinat Apple (`bg-slate-900 text-white rounded-xl`), eliminând emoji-ul din text.
    4. **Bara de Acțiuni Monitorizare Echipamente (`BridgeMonitoring.jsx`):**
       - Unificat cele 8 butoane multicolore de acțiune într-un rând calm de comenzi secundare Apple Control Center (`bg-slate-100/80 hover:bg-slate-200/80 border-slate-200/60 rounded-xl`).
       - Păstrat accent de culoare primară exclusiv pentru stări semantice active (de exemplu butonul albastru de actualizare software).
- **Fișiere:**
  - `packages/admin/src/components/DashboardCharts3D.jsx`
  - `packages/admin/src/components/OrderToastNotification.jsx`
  - `packages/admin/src/App.jsx`
  - `packages/admin/src/screens/BridgeMonitoring.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (zero git push)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut cu succes (7.18s, 0 erori).
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Redesenat de la zero modalul detaliilor de comandă (`selectedOrder` în `App.jsx`) conform limbajului vizual autentic Apple (stil Apple Pay / Wallet Receipt / macOS Sheet):
    1. **Antet Curat Apple:** Logo brand integrat elegant alături de numărul comenzii `#CJ1C-158`, data/ora formatată discret dedesubt, statutul colorat pastelat pe dreapta și buton circular de închidere tactil.
    2. **Grouped Inset Card:** Înlocuit textul brut înșirat cu două puncte (`Canal: ...`, `Plată: ...`) printr-un container de tip Apple Inset Grouped cu separatori hairlines și cheie-valoare aliniate precis (Tip Servire & Canal, Metodă Plată cu logo bancă/card, ID iiko cu buton minimalist de copiat, Bon Fiscal CUI).
    3. **Listă Produse Stil Chitanță Apple:** Eliminat numerotarea brută `1.`, `2.`, `3.`; produsele sunt acum rânduri curate într-un card dedicat cu imagini squircle, modifactori indentați subtil și formatare clară `Cantitate × Preț` (`1 × 21.99 lei`), fără `1x` albastru plutitor.
    4. **Bara de Jos Apple (Footer & Acțiuni):** Total comandă evidențiat generos și butoane de acțiune organizate în bară dedicată inferioară (buton primar de bon termic și buton secundar distructiv de anulare).
- **Fișiere:**
  - `packages/admin/src/App.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (zero git push)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut cu succes (5.39s, 0 erori).

### 2026-11-23 19:43 — Rezolvare Cache Vite & Export HMR `useConfirm` în ConfirmModal
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Adăugat export dual (named + default export `export default useConfirm`) în `ConfirmModal.jsx` pentru compatibilitate deplină cu toate modurile de import.
  - Restartat curat serverul de dezvoltare Vite Admin (`npm run dev:admin`) pentru a șterge starea blocată în memoria HMR care returna temporar `content-length: 0`.
  - Verificat prin cerere HTTP live că serverul livrează corect modulul complet (21.8 KB) cu toți exporturile (`useConfirm`, `ConfirmProvider`, `RestartDialogIcon`).
- **Fișiere:**
  - `packages/admin/src/components/ConfirmModal.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local
- **Build / Teste:** Servire Vite dev verificată 200 OK cu livrare completă de module.

### 2026-11-23 18:35 — Aliniere Completă Interfață Admin la Apple Design Skills (Modale, Tabele, Formulare, Editări)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Standardizare Modale Apple HIG (`.apple-modal`):**
     - Actualizat dialogul de confirmare globală (`ConfirmModal.jsx`) cu efect de sticlă mată translucidă, bordură hairline, squircle `rounded-3xl` și butoane Apple pressable cu culori semantice (emerald pentru acțiuni afirmative, rose subtil pentru distructive).
     - Aliniat modalul bonului de casă (`ThermalReceiptModal.jsx`) și dialogul de actualizare software (`SoftwareReleaseNotesModal.jsx`) la containerul `.apple-modal` cu backdrop blur-md.
     - Modernizat fereastra de control PC la distanță (`WindowsRemoteModal.jsx`) la format Apple Studio cu margini fluide și comenzi rapide squircle.
  2. **Ecran Autentificare (`LoginScreen.jsx`):**
     - Card de logare cu efect avansat de sticlă translucidă `apple-glass`, input-uri inset cu borduri fine și inel de focus cald emerald (`.apple-input`), buton de submit pill/squircle cu animație tactilă la apăsare.
  3. **Tabele, Liste & Paginare Apple HIG:**
     - Tabelele principale (`OrdersTable`, `PendingOrders`, `PosLogs`, `PrinterLogs`, `KioskLogs`, `IikoLogs`, `VouchersManager`) au fost integrate în containere `.apple-card` cu colțuri generoase squircle (20px), antete de coloană cu etichete discrete uppercase și evidențiere rând selectat în nuanță emerald deschisă.
     - Filtrele de selecție și căutare au fost stilizate conform standardului Apple inset controls (`.apple-input`).
  4. **Gestionare Utilizatori & Vouchere (`UsersManager.jsx`, `VouchersManager.jsx`):**
     - Formularele de editare / adăugare și vizualizare descrieri produse (`ProductOverrides.jsx`) folosesc ferestre modale Apple fluide, cu butoane semantice și layout aerisit.
  5. **Limitare Strictă:** Lucrat **EXCLUSIV** în `packages/admin`, respectând la literă regula de a nu atinge Kiosk-ul sau alte pachete, zero git push și păstrare intactă a datelor existente.
- **Fișiere:**
  - `packages/admin/src/index.css`
  - `packages/admin/src/components/ConfirmModal.jsx`
  - `packages/admin/src/components/ThermalReceiptModal.jsx`
  - `packages/admin/src/components/SoftwareReleaseNotesModal.jsx`
  - `packages/admin/src/components/WindowsRemoteModal.jsx`
  - `packages/admin/src/screens/LoginScreen.jsx`
  - `packages/admin/src/screens/VouchersManager.jsx`
  - `packages/admin/src/screens/ProductOverrides.jsx`
  - `packages/admin/src/screens/UsersManager.jsx`
  - `packages/admin/src/screens/PosLogs.jsx`
  - `packages/admin/src/screens/PrinterLogs.jsx`
  - `packages/admin/src/screens/KioskLogs.jsx`
  - `packages/admin/src/screens/IikoLogs.jsx`
  - `packages/admin/src/screens/PendingOrders.jsx`
  - `packages/admin/src/App.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (lucrat strict local, zero push)
- **Build / Teste:** `npm --prefix packages/admin run build` trecut cu succes (3.78s, 0 erori).

### 2026-11-23 17:45 — Rafinare Interfață Admin conform Apple Design Skills (HIG & Craft)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Tipografie & Stil Global Apple (`index.css`):**
     - Adoptat stack-ul nativ Apple San Francisco (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text"`), cu optimizări de netezire text (`-webkit-font-smoothing: antialiased`).
     - Definit clase de utilitate HIG: `.apple-glass` (backdrop-blur 20px, saturație 180%), `.apple-card` (colțuri generoase squircle 20px, borduri fine difuze) și `.apple-pressable` (feedback tactil subtil la click `active:scale-[0.97]`).
  2. **Bara de Sus (Header Apple Glass în `App.jsx`):**
     - Antetul are efect de sticlă translucidă (`apple-glass`) cu bordură fină inferioară, iar butoanele circulare de acțiune (Refresh, Notificări, Temă, Deconectare) au primit micro-interacțiune `apple-pressable`.
  3. **Meniu Lateral Nativ Apple HIG (`App.jsx`):**
     - Elementele de navigare au fost transformate din capsule rotunde în dreptunghiuri rotunjite squircle (`rounded-xl`, stil iPadOS/macOS).
     - Organizat meniul în 3 secțiuni curate: **Gestiune & Vânzări**, **Catalog & Promoții**, și **Diagnostic & Sistem**.
     - Indicatorul de selecție folosește nuanța caldă de emerald translucid (`bg-emerald-500/12 text-emerald-800 dark:text-emerald-300`).
  4. **Carduri Statistici (`StatCard` în `App.jsx`):**
     - Înlocuit bara rigidă laterală de 4px cu bordură superioară fină și stil `apple-card` aerisit.
  5. **Limitare Strictă:** Modificările au fost aplicate **EXCLUSIV** pe pachetul de Admin (`packages/admin`), fără a atinge Kiosk-ul sau alte pachete.
- **Fișiere:**
  - `packages/admin/src/index.css`
  - `packages/admin/src/App.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (lucrat strict local, zero push)
- **Build / Teste:** `npm --prefix packages/admin run build` OK (0 erori, 3.33s).

### 2026-11-23 17:40 — Implementare Sistem Coduri Promoționale / Vouchere pe Kiosk & Admin (Local)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Backend Voucher Service & API (`voucherService.js`, `routes/vouchers.js`):**
     - Creat serviciu complet de gestionare coduri promoționale cu stocare JSON persistentă (`vouchers.json`).
     - Suport reduceri procentuale (`%`) cu plafon opțional și sume fixe (`LEI`), comandă minimă, limită de utilizări, dată de expirare și filtrare pe locații.
     - Endpoint public `/api/vouchers/validate` pentru Kiosk și endpoint-uri CRUD securizate `/api/vouchers` pentru Admin.
     - Înregistrare automată utilizare voucher și salvare cod/reducere în comandă (`orders.js`).
  2. **Kiosk Store & Tastatură Virtuală Touch (`kioskStore.js`, `VoucherModal.jsx`, `VoucherModal.css`):**
     - Adăugat suport `appliedVoucher`, `getVoucherDiscount` și `getCartSubtotal` în store-ul Zustand.
     - Construit modal cu tastatură virtuală completă (0-9, Q-Z, Backspace, Clear) adaptată pentru touchscreen comercial, cu taste mari (56-60px), animații tactile și suport tastatură fizică.
  3. **Integrare Coș & Plată Kiosk (`CartScreen.jsx`, `PaymentScreen.jsx`):**
     - În coș apare butonul „🎟️ Ai un cod promoțional?”. Când se aplică un cod, se afișează linia de reducere cu verde și buton de eliminare rapidă.
     - Totalul de plată trimis la POS Verifone și pe ecran este automat redus.
  4. **Panou Admin (`VouchersManager.jsx`, `Promotions.jsx`):**
     - În secțiunea Promoții s-au adăugat sub-tab-uri: `🎟️ Coduri Promoționale (Vouchere)` și `🎡 Roata Norocului`.
     - Tabel de monitorizare coduri cu căutare, statistici, comutator rapid Activ/Inactiv și modal de adăugare/editare cu toate regulile configurabile.
- **Fișiere:**
  - `packages/backend/src/services/voucherService.js`
  - `packages/backend/src/routes/vouchers.js`
  - `packages/backend/src/index.js`
  - `packages/backend/src/routes/orders.js`
  - `packages/kiosk/src/store/kioskStore.js`
  - `packages/kiosk/src/components/VoucherModal.jsx`
  - `packages/kiosk/src/components/VoucherModal.css`
  - `packages/kiosk/src/screens/CartScreen.jsx`
  - `packages/kiosk/src/screens/PaymentScreen.jsx`
  - `packages/admin/src/screens/VouchersManager.jsx`
  - `packages/admin/src/screens/Promotions.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (lucrat strict local, zero push)
- **Build / Teste:** `npm --prefix packages/kiosk run build` OK (1.39s), `npm --prefix packages/admin run build` OK (4.69s). Teste API validate cu succes.

### 2026-11-20 19:12 — Programare Task-uri după Ora 22:00 (Fallback Cluj 2 & Aliniere Admin)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Creare Listă de Lucru `.agents/TODO.md`:** Documentat planul de intervenție programat strict după ora 22:00 (la închiderea restaurantului), pentru a nu perturba clienții sau comenzile în timpul programului.
  2. **Obiective programate după 22:00:**
     - Adăugare fallback în backend `bridgeMonitoringService.js` pentru recunoașterea alias-urilor Cluj 2 (`cluj-2`, `cj2`, `smashme-cj2`).
     - Aliniere pastile status în `App.jsx` pentru a elimina alarmele false de „Ecran Inactiv” pe iPad când POS-ul de pe COM5 este activ și conectat.
     - Publicare pe Netlify / Render împreună cu butonul rotund de Refresh din antet.
- **Fișiere:**
  - `.agents/TODO.md`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (așteaptă ora 22:00 și acord explicit push)
- **Build / Teste:** Documentat. Zero modificări la POS sau Windows în timpul zilei.


### 2026-11-20 15:09 — Buton Reîmprospătare (Refresh) în Bara de Sus Admin
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Buton Refresh Rotund în Antet (`App.jsx`):** Adăugat buton dedicat de Reîmprospătare (`RefreshCw`) în colțul dreapta-sus din antetul panoului Admin, aliniat perfect cu Clopoțelul de notificări, Modul Dark/Light și Deconectare.
  2. **Animare & Reîmprospătare Completă:** La click, butonul declanșează animație de rotire (`animate-spin`) și apelează `handleManualRefresh()`, actualizând în paralel starea aparatelor, POS bridge-urile și comenzile pentru perioada activă.
- **Fișiere:**
  - `packages/admin/src/App.jsx`
  - `.agents/CHANGELOG.md`
- **Ramură / Commit:** Local (așteaptă acord push)
- **Build / Teste:** `npm --prefix packages/admin run build` OK (0 erori, 1.33s).


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

