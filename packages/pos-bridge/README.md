# Smart Kiosk — POS Bridge

Conectează terminalul **Raiffeisen POS** (local, TCP/IP) cu serverul **Render** (cloud).

## Setup pe PC Windows (o singură dată)

### 1. Instalează Node.js
Descarcă de la: https://nodejs.org/en/download  
(alege versiunea LTS, 64-bit)

### 2. Copiază folderul `pos-bridge` pe PC
Plasează-l oriunde, ex: `C:\SmartKiosk\pos-bridge\`

### 3. Configurează `.env`
Deschide `C:\SmartKiosk\pos-bridge\.env.example`  
Copiază-l și salvează ca `.env`:

```
RENDER_URL=https://smart-kiosk-ttut.onrender.com
POS_IP=192.168.1.100        ← IP-ul POS-ului Raiffeisen în rețea locală
POS_PORT=1000               ← portul ECR (de obicei 1000)
LOCATION_ID=brasov          ← ID-ul locației din Admin Panel
BRIDGE_KEY=pos-bridge-2024
```

**Cum afli IP-ul POS-ului Raiffeisen:**
- De obicei e setat fix în rețea locală (ex: 192.168.1.50)
- Verifică în setările terminalului sau în router

### 4. Pornire
**Dublu-click** pe `start-windows.bat`  
Fereastra neagră rămâne deschisă — nu o închide!

## Pornire automată cu Windows

1. Apasă `Win+R` → scrie `shell:startup` → Enter
2. Pune un shortcut la `start-windows.bat` în acel folder
3. Bridge-ul pornește automat la fiecare restart

## Verificare funcționare

Când bridge-ul e conectat corect vei vedea în consolă:
```
✅ Conectat la Render (socket_id_xxx)
```

La o plată:
```
💳 Cerere plată: orderId=kiosk-xxx amount=45.00 RON
✅ Plată APROBATĂ: ABC123
```
