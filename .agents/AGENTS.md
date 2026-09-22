# Agent Rules

## STRICT RULE: DO NOT DELETE USER DATA
ESTE UN ORDIN! NU AI VOIE SĂ ȘTERGI NIMIC DIN BAZA DE DATE SAU DIN FIȘIERE FĂRĂ ACORDUL EXPLICIT AL UTILIZATORULUI. Dacă utilizatorul nu cere o curățare de date (wipe/delete), nu șterge absolut niciun istoric, mock sau date din locații, fișiere .json, etc. Ești obligat să respecți datele reale și să nu le suprascrii niciodată.

## STRICT RULE: NO PUSH WITHOUT PERMISSION
NICIODATĂ nu vei rula comenzi precum `git push` fără ca utilizatorul să ceară asta în mod explicit!

## STRICT RULE: DO NOT TOUCH FOREIGN FOLDERS OR APPS
NU AI VOIE să navighezi sau să scrii cod în foldere străine de workspace-ul proiectului curent, și nu ai voie să atingi alte aplicații sau proiecte fără cerere expresă!

## STRICT RULE: DO NOT IMPROVISE OR MAKE UNPROMPTED CHANGES
ESTE STRICT INTERZIS SĂ FACI DE CAPUL TĂU, SĂ MODIFICI SAU SĂ IMPROVIZEZI! Vei executa EXCLUSIV și STRICT ceea ce ți se cere de către utilizator, fără să adaugi, să ștergi sau să schimbi funcționalități nesolicitate. Respectă la literă comenzile utilizatorului.

## CRITICAL RULES & PROTOCOL SPECIFICATIONS: POS PRINTEC ECR v3.9.3 (RAIFFEISEN / VERIFONE)
Documentația oficială de referință se află în rădăcina proiectului: `Protocol ECR-POS-vers3.9.3.pdf` (Printec Group România, 22 pagini).
Orice modificare a codului POS Bridge (`packages/pos-bridge/index.js`) sau a serviciului serial (`packages/backend/src/services/verifoneSerialService.js`) TREBUIE să respecte cu strictețe următoarele reguli:

1. **REGULA STRICTĂ HALF-DUPLEX (Cine trimite EOT)**:
   - Când **ECR inițiază** (SALE, LOGIN, SETTLEMENT):
     `ECR -> ENQ` (0x05) -> `POS -> ACK` (0x06) -> `ECR -> Frame` -> `POS -> ACK` -> **`ECR -> EOT` (0x04)**.
   - Când **POS inițiază** (Răspunsuri, PIN, Begin Auth, Rezultat 06 0F, Refuz 06 1E):
     `POS -> ENQ` -> `ECR -> ACK` -> `POS -> Frame` -> `ECR -> ACK` -> **`POS -> EOT`**!
   - **ESTE STRICT INTERZIS** ca ECR (PC-ul) să trimită `EOT` după ce primește un cadru de la POS! ECR trimite strict `ACK`, iar `EOT`-ul de final este trimis exclusiv de către POS. Trimiterea de `EOT` de la PC produce coliziuni UART și desincronizare hardware.

2. **CADRUL DE CONFIRMARE VÂNZARE `80 00 00` (Anexa A, Pag. 18)**:
   - Imediat după ce ECR trimite `SALE` și `EOT`, POS-ul trimite cadrul intermediar `<DLE><STX> 80 00 00 <DLE><ETX> LRC` (*Response for received message*).
   - Acest cadru confirmă că POS-ul a acceptat suma și a pornit ecranul „Apropiați cardul”.
   - ECR trebuie să-l confirme cu `ACK`, să aștepte `EOT`-ul de la POS și să pornească cronometrul de citire a cardului (120 secunde conform pag. 11-12).

3. **LOGIN SE EXECUTĂ O SINGURĂ DATĂ (LA BOOT/STARTUP)**:
   - Conform Secțiunii 5.2.1, pag. 10 din documentația oficială, comanda `LOGIN` (`06 00 00`) se trimite o singură dată la pornirea aplicației/deschiderea portului serial.
   - **NU trimiteți LOGIN înainte de fiecare tranzacție!** Tranzacția `SALE` trebuie să plece direct și instant. Dacă vreodată POS-ul returnează `APRW = 0x02` (*ECR has not executed login*), doar atunci se reia `LOGIN` și se reîncearcă `SALE`.

4. **ANULAREA DIN KIOSK ȘI CARACTERUL ILEGAL `CAN` (0x18)**:
   - Octetul `CAN` (`0x18`) **NU EXISTĂ** în protocolul Printec ECR v3.9.3 (vezi Anexa D). Nu trimiteți niciodată `CAN` pe magistrală!
   - Pentru a elibera instantaneu ecranul POS-ului Verifone V200t când clientul apasă „Anulează” pe Kiosk, portul serial se închide și se redeschide controlat timp de 300ms (`forceReopenPort`). Aceasta taie semnalele de control DTR/RTS, iar terminalul Verifone iese imediat din modul de plată înapoi pe standby. Apoi bridge-ul reia automat `LOGIN`.

5. **CADRUL DE REFUZ/ANULARE `06 1E 01 A0`**:
   - Cadrul `06 1E 01 A0` este definit oficial în Anexa A (pag. 18-19) ca fiind refuzul/anularea standard raportată de POS (când clientul apasă tasta roșie X pe POS sau când expiră timpul de citire a cardului).
   - Codul `0xA0` **NU înseamnă defecțiune de memorie și NU necesită Închidere de Zi**. Confirmarea corectă cu `ACK` și așteptarea `EOT`-ului de la POS readuc terminalul în mod quiescent automat.

