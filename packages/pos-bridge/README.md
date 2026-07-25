# Smart Kiosk — POS Bridge

Conectează **Raiffeisen POS** (serial COM + GPRS) cu serverul **Render** (cloud).

## Setup pe PC Windows

### 1. Instalează Node.js (o singură dată)
Descarcă: https://nodejs.org/en/download → versiunea LTS, 64-bit  
Instalează cu opțiunile default.

### 2. Copiază folderul pe PC
Plasează conținutul în: **`C:\kiosk_jk\pos-bridge\`**

### 3. Creează fișierul `.env`
În `C:\kiosk_jk\pos-bridge\` creează fișierul `.env`:

```
RENDER_URL=https://smart-kiosk-ttut.onrender.com
COM_PORT=auto
BAUD_RATE=9600
LOCATION_ID=brasov
BRIDGE_KEY=pos-bridge-2024
```

> **Notă:** `COM_PORT=auto` detectează automat portul.  
> Dacă nu funcționează, pune manual ex: `COM_PORT=COM3`

**Cum afli portul COM:**  
Device Manager → Ports (COM & LPT) → caută "USB Serial Port"

### 4. Pornire
**Dublu-click** pe `C:\kiosk_jk\pos-bridge\start-windows.bat`

Fereastra neagră trebuie să afișeze:
```
✅ Conectat la Render (socket_xxx)
```

### 5. Pornire automată cu Windows
1. `Win+R` → `shell:startup` → Enter
2. Click dreapta în folder → New → Shortcut
3. Destination: `C:\kiosk_jk\pos-bridge\start-windows.bat`
4. Finish

---

## Locații multiple
Dacă ai mai multe kioskuri, copiază folderul `pos-bridge` și schimbă `LOCATION_ID` în `.env` pentru fiecare locație.

## Testare
La o plată pe kiosk, în consolă apare:
```
💳 Cerere plată: 45.00 RON (orderId=kiosk-xxx)
✅ APROBAT — ABC123
```
