# Setări și Cunoștințe Critice - Smart Kiosk POS Bridge (Printec ECR)

> [!CRITICAL]
> **Documentația oficială de referință**: `Protocol ECR-POS-vers3.9.3.pdf` (Printec Group România, 22 pagini).
> Toate modificările din `packages/pos-bridge/index.js` și `verifoneSerialService.js` TREBUIE să respecte cu strictețe aceste reguli.

---

## 1. Parametri Seriali (Anexa C, Pag. 22)
- **Baud Rate**: `9600`
- **Data Bits**: `8`
- **Parity**: `None`
- **Stop Bits**: `1`
- **Flow Control**: `None`
- **Delimitatori cadre**: `<DLE><STX>` (0x10 0x02) ... `<DLE><ETX>` (0x10 0x03) `<LRC>` (XOR pe octeții de comandă).

---

## 2. Regula Strictă Half-Duplex (Cine trimite EOT)

### A. Când ECR (PC-ul) inițiază transmisia (SALE, LOGIN, SETTLEMENT):
```
ECR -> ENQ (0x05)
POS -> ACK (0x06)               (timeout 0.6s)
ECR -> DLE STX <Frame> DLE ETX LRC
POS -> ACK (0x06)               (timeout 0.2s)
ECR -> EOT (0x04)               <--- ECR încheie sesiunea pe care a inițiat-o
```

### B. Când POS-ul inițiază transmisia (Răspunsuri, `80 00 00`, PIN Entry, Begin Auth, Rezultat `06 0F`, Refuz `06 1E`):
```
POS -> ENQ (0x05)
ECR -> ACK (0x06)               (timeout 0.2s)
POS -> DLE STX <Frame> DLE ETX LRC
ECR -> ACK (0x06)               (timeout 0.6s)
POS -> EOT (0x04)               <--- DOAR POS-UL TRIMITE EOT!
```

> [!CAUTION]
> **ESTE STRICT INTERZIS ca ECR (PC-ul) să trimită `EOT` după ce primește un cadru de la POS!**  
> ECR trimite exclusiv `ACK` (0x06). Încheierea cu `EOT` (0x04) este trimisă exclusiv de către POS. Dacă ECR trimite `EOT`, se produce o coliziune UART cu `EOT`-ul trimis simultan de POS, corupând starea internă a terminalului Verifone.

---

## 3. Cadrul Intermediar de Confirmare `80 00 00` (Anexa A, Pag. 18)
- Imediat după ce ECR trimite tranzacția `SALE` și `EOT`, POS-ul transmite cadrul intermediar:
  `<DLE><STX> 80 00 00 <DLE><ETX> LRC` (sau `84 XX 00`) (*Response for received message*).
- Acest cadru confirmă oficial că POS-ul a recepționat suma corect și a pornit cititorul de carduri („Apropiați cardul”).
- **Comportament ECR**:
  1. Trimite imediat `ACK` (0x06).
  2. Așteaptă `EOT` (0x04) de la POS.
  3. Pornește cronometrul de așteptare a cardului de **120 secunde** (2 minute conform documentației oficiale).

---

## 4. LOGIN se execută o singură dată (La Startup / Boot)
- Conform Secțiunii 5.2.1, pag. 10 din documentația oficială:
  *„The Login command should be sent (by the ECR to terminal) at least once: either after the terminal boots up, either after a Logout command was previously sent.”*
- **NU trimiteți `LOGIN` înainte de fiecare vânzare!**
- La deschiderea portului serial / pornirea aplicației, se apelează `ensurePosLogin()`.
- Comenzile de vânzare `SALE` se trimit direct și instantaneu când clientul apasă pe Kiosk.
- Doar în cazul rar în care POS-ul returnează `APRW = 0x02` (*ECR has not executed login*), doar atunci bridge-ul reia `LOGIN` și reîncearcă `SALE`.

---

## 5. Anularea din Kiosk și Caracterul Ilegal CAN (0x18)
- Octetul `CAN` (`0x18`) **NU EXISTĂ** în protocolul Printec ECR v3.9.3 (vezi caracterele de control permise în Anexa D).
- Nu trimiteți niciodată `CAN` pe magistrala serială!
- Când clientul apasă „Anulează” pe Kiosk:
  1. Kiosk-ul primește imediat răspunsul `CANCELLED_BY_USER` pentru ca interfața să se deblocheze instant.
  2. Bridge-ul execută un toggle controlat de carrier (`forceReopenPort` timp de 300ms). Aceasta resetează semnalele hardware DTR/RTS pe Verifone V200t, scoțând terminalul din ecranul de plată înapoi pe standby.
  3. Bridge-ul trimite apoi automat `LOGIN` pentru a lăsa POS-ul gata de următoarea plată.

---

## 6. Cadrul de Refuz/Anulare `06 1E 01 A0`
- Conform Anexei A (pag. 18-19), `06 1E 01 A0` este codul standard de refuz/anulare emis de POS când:
  - Clientul apasă tasta roșie **X / Cancel** pe terminalul Verifone.
  - Sau expiră timpul de 120s de apropiere a cardului.
- **IMPORTANT**: Codul `0xA0` **NU înseamnă defect hardware și NU necesită Închidere de Zi (Settlement)**!
- Confirmarea cu `ACK` și recepția `EOT`-ului readuc terminalul în mod quiescent automat.

---

## 7. Setări Imprimantă Termică (Kiosk)
- **Modul**: `node-thermal-printer` (cu driver nativ `@thiagoelg/node-printer`).
- **Nume Imprimantă Windows**: Preia din `.env` (ex: `EPSON TM-T20II` sau `POS-80`).
- **Payload Socket.io**: Serverul trimite via Socket.io comanda `print_ticket` sub forma `{ order: {...} }`. Destructuring-ul trebuie să citească `data?.order || data` pentru a preveni erori dacă payload-ul variază.

---

## 8. Timeout ENQ și Retentivitate Linie Serială (Cap. 4, Pag. 6)
- **Timeout ENQ conform specificației**: Timeout-ul pentru răspuns `ACK` la `ENQ` este setat la **3000ms** (3.0s). Aceasta oferă timp suficient terminalului Verifone V200t să se trezească din standby și previne declanșarea prematură a reîncercărilor ce produc coliziuni UART pe linia serială.
- **Evitarea resetărilor inutile**: Portul serial NU trebuie re-deschis / resetat în timpul trimiterii ENQ, pentru a nu întrerupe alimentarea liniei și starea internă a terminalului.
- **Anulare controlată**: Funcția `forceReopenPort` (pauză hardware de 300ms tăind DTR/RTS) se execută exclusiv atunci când clientul solicită explicit anularea tranzacției (`cancel_pos_payment`) din ecranul Kiosk, eliberând instantaneu ecranul POS în standby.


