# Setări și Cunoștințe Critice - Smart Kiosk POS Bridge (Printec ECR)

## Configurație Serială (VeriFone V200t / VX Series)
- **Baud Rate**: 9600
- **Data Bits**: 8
- **Parity**: none
- **Stop Bits**: 1
- **Flow Control**: none
- **Protocol**: Printec ECR v3.9.3 (Documentație oficială: `Protocol ECR-POS-vers3.9.3.pdf`)

## Secvență Protocol Printec ECR (Conform Documentației Oficiale)
1. **La pornire / conectare port**:
   - Se trimite comanda **LOGIN**: `[0x06, 0x00, 0x00]`.
   - POS răspunde cu `80 00 00` (OK).
   - Terminalul este gata pentru tranzacții. Conform pag. 10 din documentație, LOGIN se execută **o singură dată** la boot/startup, nu la fiecare bon!

2. **La inițiere plată (SALE)**:
   - Trimitem direct comanda **SALE**: `0x06, 0x01, 0x15, <amount12>, '000', '000000'` încadrat în `DLE STX ... DLE ETX LRC`.
   - POS răspunde cu cadrul intermediar: `80 00 00` (*Response for received message*, pag. 18).
   - POS activează ecranul și cititorul de carduri: „Apropiați cardul”.
   - La tranzacții cu PIN: POS trimite notificarea `05 01 00` (PIN Entry).
   - La comunicare cu banca: POS trimite notificarea `05 02 00` (Begin Auth).
   - Rezultat final:
     - Aprobare: `06 0F XX ...` (cu cod `0000`).
     - Refuz / Anulare: `06 1E 01 [cod]` (ex: `06 1E 01 A0`).

## Codul 0xA0 (Refuz / Anulare Standard)
Conform Paginii 18 din documentația oficială Printec v3.9.3:
- Cadrul `06 1E 01 A0` este codul standard de refuz/anulare al terminalului Verifone (trimis când clientul apasă tasta roșie X/Cancel pe POS sau când expiră timpul de citire a cardului).
- Protocolul este Half-Duplex: PC-ul trimite strict `ACK`, POS-ul trimite `EOT`, iar terminalul revine imediat în stare de standby gata pentru următoarea tranzacție.

## Anularea din Kiosk
- Dacă un client apasă „Anulează” pe ecranul Kiosk-ului, portul serial este reciclat controlat (300ms carrier drop).
- Aceasta taie semnalele DTR/RTS pe Verifone V200t, forțând terminalul să iasă imediat din ecranul de citire card înapoi în standby.
- Bridge-ul execută automat `LOGIN` și lasă POS-ul sincronizat pentru următorul client.

## Setări Imprimantă Termică (Kiosk)
- **Modul**: `node-thermal-printer` (cu driver nativ `@thiagoelg/node-printer`).
- **Nume Imprimantă Windows**: Preia din `.env` (ex: `EPSON TM-T20II`).
- **Atenție la payload**: Serverul trimite via Socket.io comanda `print_ticket` trimițând obiectul sub forma `{ order: {...} }`. Nu modificați destructuring-ul altfel bridge-ul va încerca să citească din `undefined` și va eșua silențios.
