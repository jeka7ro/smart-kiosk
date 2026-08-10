# Setări și Cunoștințe Critice - Smart Kiosk POS Bridge (Printec ECR)

## Configurație Serială (VeriFone V200t)
- **Baud Rate**: 9600
- **Data Bits**: 8
- **Parity**: none
- **Stop Bits**: 1
- **Protocol**: Printec ECR v3.9.3

## Secvență Plată (Flux)
1. Trimitem **WakeUp (0x04 / EOT)**
2. Trimitem Frame-ul **LOGIN**: `[0x06, 0x00, 0x00]`
3. Așteptăm răspuns (ACK / FS)
4. Așteptăm 500ms
5. Trimitem Frame-ul **SALE** (Suma în format string, ex: `000` + FS + `100.50`)
6. Așteptăm mesajul de succes/eroare de la POS (timeout 120 secunde pentru plata efectivă).

## EROAREA A0 (Tranzacție Refuzată de Terminal) - DETALII CRITICE
Dacă POS-ul dă direct "A0" după ce afișează "Apropiați cardul":
- **Problema NU este din cod!** Codul Bridge-ului funcționează corect (dovadă că trezește POS-ul).
- **Cauza**: Unele carduri (mai ales cele străine) necesită introducerea PIN-ului și **verificarea semnăturii**.
- Deoarece Kiosk-ul este nesupravegheat (Unattended), clientul nu apasă butonul **Verde** pentru confirmarea semnăturii pe POS, iar POS-ul rămâne blocat.
- Când POS-ul rămâne blocat cu o cerere de semnătură neconfirmată, el va respinge **automat** cu A0 orice viitoare cerere de plată trimisă din Kiosk.

### Rezolvare Eroare A0:
1. Închideți fereastra neagră a Bridge-ului (ca POS-ul să iasă din modul ECR).
2. Faceți **"Închidere de Zi" (Settlement)** manual, direct din butoanele POS-ului.
3. Această acțiune curăță memoria POS-ului și deblochează terminalul.
4. Redeschideți `start-windows.bat`.

*Notă pentru bancă (Raiffeisen)*: Pentru a preveni definitiv această problemă, banca trebuie să dezactiveze cererea de verificare a semnăturii din setările terminalului VeriFone, menționând că aparatul este folosit în regim nesupravegheat (Kiosk).

## Setări Imprimantă Termică (Kiosk)
- **Modul**: `node-thermal-printer` (cu driver nativ `@thiagoelg/node-printer`).
- **Nume Imprimantă Windows**: Preia din `.env` (ex: `EPSON TM-T20II`).
- **Atenție la payload**: Serverul trimite via Socket.io comanda `print_ticket` trimițând obiectul sub forma `{ order: {...} }`. Nu modificați destructuring-ul altfel bridge-ul va încerca să citească din `undefined` și va eșua silențios.
