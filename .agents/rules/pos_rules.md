# Reguli Stricte și Specificații Tehnice: POS Printec ECR v3.9.3 (Raiffeisen / Verifone)

> [!CRITICAL]
> Documentația oficială de referință este în rădăcina proiectului: `Protocol ECR-POS-vers3.9.3.pdf` (Printec Group România, 22 pagini).
> Nicio modificare în `packages/pos-bridge/` sau în serviciile seriale backend nu se va face fără respectarea cu strictețe a acestor reguli.

---

## 1. REGULA STRICTĂ HALF-DUPLEX (Cine trimite EOT)
- **Când ECR (PC-ul) inițiază** (comenzile `SALE`, `LOGIN`, `SETTLEMENT`):
  ```
  ECR -> ENQ (0x05)
  POS -> ACK (0x06) (timeout 0.6s)
  ECR -> DLE STX <Frame> DLE ETX LRC
  POS -> ACK (0x06) (timeout 0.2s)
  ECR -> EOT (0x04)
  ```
- **Când POS-ul inițiază** (Răspunsuri, `80 00 00`, PIN Entry `05 01 00`, Begin Auth `05 02 00`, Rezultat `06 0F XX`, Refuz `06 1E 01`):
  ```
  POS -> ENQ (0x05)
  ECR -> ACK (0x06) (timeout 0.2s)
  POS -> DLE STX <Frame> DLE ETX LRC
  ECR -> ACK (0x06) (timeout 0.6s)
  POS -> EOT (0x04)  <--- DOAR POS-UL TRIMITE EOT!
  ```
- **ESTE STRICT INTERZIS** ca ECR să trimită `EOT` după ce a primit și confirmat cu `ACK` un cadru de la POS!
- Trimiterea de `EOT` de la PC când POS-ul este cel care transmite produce coliziuni pe magistrala serială și blochează terminalul Verifone.

---

## 2. CADRUL INTERMEDIAR DE CONFIRMARE VÂNZARE `80 00 00` (Anexa A, Pag. 18)
- Imediat după ce ECR trimite `SALE` și `EOT`, POS-ul răspunde cu cadrul intermediar:
  `<DLE><STX> 80 00 00 <DLE><ETX> LRC` (sau `84 XX 00`) (*Response for received message*).
- Acest cadru confirmă oficial că POS-ul a acceptat suma și a pornit cititorul de carduri („Apropiați cardul”).
- ECR trebuie:
  1. Să confirme cu `ACK`.
  2. Să aștepte `EOT`-ul de la POS.
  3. Să activeze cronometrul de citire a cardului de 120 secunde (2 minute conform documentației oficiale).

---

## 3. LOGIN SE EXECUTĂ O SINGURĂ DATĂ (LA PORNIRE/BOOT)
- Conform Secțiunii 5.2.1, pag. 10 din documentația oficială:
  *„The Login command should be sent (by the ECR to terminal) at least once: either after the terminal boots up, either after a Logout command was previously sent.”*
- **NU trimiteți `LOGIN` înainte de fiecare tranzacție!**
- Bridge-ul execută `LOGIN` o singură dată la deschiderea/reinițializarea portului serial.
- Tranzacția `SALE` pleacă direct și instant când clientul apasă pe ecran.
- Dacă vreodată POS-ul returnează `APRW = 0x02` (*ECR has not executed login*), doar atunci se reia `LOGIN` și se reîncearcă `SALE`.

---

## 4. ANULAREA DIN KIOSK ȘI CARACTERUL ILEGAL `CAN` (0x18)
- Caracterul `CAN` (`0x18`) **NU EXISTĂ** în protocolul Printec ECR v3.9.3 (vezi caracterele permise în Anexa D). Nu trimiteți niciodată `CAN` pe serială!
- Pentru a elibera instantaneu ecranul terminalului Verifone V200t când clientul apasă „Anulează” pe Kiosk:
  1. Se notifică instant Kiosk-ul (`CANCELLED_BY_USER`) pentru ca interfața să fie liberă.
  2. Portul serial se închide și se redeschide controlat timp de 300ms (`forceReopenPort`). Aceasta taie semnalele hardware DTR/RTS, forțând terminalul Verifone să iasă imediat din ecranul de plată înapoi pe standby.
  3. Bridge-ul execută automat `LOGIN` și lasă POS-ul gata pentru următoarea comandă.

---

## 5. CADRUL DE REFUZ/ANULARE `06 1E 01 A0`
- Cadrul `06 1E 01 A0` este definit oficial în Anexa A (pag. 18-19) ca refuzul/anularea standard raportată de POS (când clientul apasă tasta roșie X pe POS sau când expiră timpul de 2 minute).
- Codul `0xA0` **NU înseamnă defect sau memorie plină și NU necesită Închidere de Zi**.
- Confirmarea corectă cu `ACK` și așteptarea `EOT`-ului readuc automat terminalul în repaus.

---

## 6. PARAMETRI SERIALI (Anexa C, Pag. 22)
- Baud Rate: **9600**
- Data bits: **8**
- Parity: **None**
- Stop bits: **1**
- Flow control: **None**
- Delimitatori cadre: `DLE` (0x10) `STX` (0x02) ... `DLE` (0x10) `ETX` (0x03) `LRC` (XOR pe octeții comenzii).
