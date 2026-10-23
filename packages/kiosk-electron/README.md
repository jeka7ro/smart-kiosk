# 🛡️ Smart Kiosk — Windows Armored Tank (.EXE)

Acest pachet (`packages/kiosk-electron`) este un container nativ dedicat pentru calculatoarele Kiosk cu **Windows 10/11**, care rulează aplicația Smart Kiosk în mod **„Tanc Blindat” (Kiosk Lockdown)**.

---

## ✨ Caracteristici „Tanc Blindat”
- **True Fullscreen Kiosk:** Se deschide direct pe tot ecranul, fără bară de titlu, fără butoane Windows, fără bară de Start.
- **Blocare Taste & Scurtături:** 
  - ❌ `Alt + F4` (interzisă închiderea)
  - ❌ `F11` (blocat)
  - ❌ `F12` / `Ctrl+Shift+I` (DevTools blocat)
  - ❌ `Ctrl+R` / `F5` / `Ctrl+W` / `Ctrl+N` (blocate)
  - ❌ Click dreapta blocat
- **Auto-Recovery la Crash:** Dacă pagina web îngheață sau are crash, Electron reîncarcă automat aplicația în 1 secundă.
- **Auto-Retry Rețea:** Dacă pică internetul, reîncearcă automat la fiecare 5 secunde.
- **Single Instance:** O singură instanță poate rula simultan pe PC.
- **Ieșire Manager Securizată:** Combinația secretă `Ctrl + Alt + Shift + Q` deschide dialogul de ieșire pentru personalul autorizat.

---

## ⚙️ Configurare (`config.json`)
Fișierul `config.json` se află lângă aplicație și poate fi editat manual pe orice PC de restaurant:
```json
{
  "kioskBaseUrl": "https://kiosk-smashme.netlify.app",
  "locationId": "cluj1",
  "kioskLockdown": true,
  "alwaysOnTop": true,
  "autoHideCursor": false,
  "allowDevTools": false,
  "managerPin": "1234",
  "networkRetrySeconds": 5
}
```

---

## 🚀 Comenzi Disponibile

### 1. Testare locală pe Mac / Mod Test:
```bash
npm run dev --workspace=packages/kiosk-electron
# sau cu locație specifică:
npm run dev --workspace=packages/kiosk-electron -- --loc=cluj2
```

### 2. Generare `.EXE` pentru Windows (Installer Setup):
```bash
npm run build:win --workspace=packages/kiosk-electron
```
Rezultatul va fi generat în: `packages/kiosk-electron/dist-win/Smart Kiosk Setup 1.0.0.exe`.

### 3. Generare `.EXE` Portabil (fără instalare, se dă dublu-click direct):
```bash
npm run build:portable --workspace=packages/kiosk-electron
```
Rezultatul: `packages/kiosk-electron/dist-win/Smart Kiosk 1.0.0.exe`.
