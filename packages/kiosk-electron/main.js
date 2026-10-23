const { app, BrowserWindow, globalShortcut, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Single Instance Lock (Doar o singură instanță de Kiosk poate rula) ───────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Armored Kiosk] O instanță rulează deja. Închid duplicatul...');
  app.quit();
  process.exit(0);
}

// ─── Încărcare Configurație Locală ───────────────────────────────────────────
let config = {
  kioskBaseUrl: 'https://kiosk-smashme.netlify.app',
  locationId: 'cluj1',
  kioskLockdown: true,
  alwaysOnTop: true,
  autoHideCursor: false,
  allowDevTools: false,
  managerPin: '1234',
  networkRetrySeconds: 5,
  checkUpdatesOnStartup: true
};

const configPath = path.join(__dirname, 'config.json');
try {
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    config = { ...config, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('[Armored Kiosk] Eroare citire config.json, folosesc valorile implicite:', e.message);
}

// Detectare mod dev/test (ex: dacă se rulează pe Mac sau cu flag --dev)
const isDev = process.argv.includes('--dev') || !app.isPackaged;
const targetLocation = process.argv.find(arg => arg.startsWith('--loc='))?.split('=')[1] || config.locationId;
const targetUrl = `${config.kioskBaseUrl}?loc=${targetLocation}`;

let mainWindow = null;

function createKioskWindow() {
  const isKioskMode = !isDev && config.kioskLockdown !== false;

  const { screen } = require('electron');
  const targetDisplay = screen.getPrimaryDisplay();
  const { bounds } = targetDisplay;

  console.log(`[Armored Kiosk] 🖥️ Rezoluție nativă Kiosk detectată: ${bounds.width} x ${bounds.height}`);

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    kiosk: isKioskMode,
    fullscreen: true,
    alwaysOnTop: isKioskMode && config.alwaysOnTop,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0f19',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true,
      devTools: isDev || config.allowDevTools
    }
  });

  // Înregistrare pornire automată la boot cu Windows
  if (!isDev && config.autoStartOnBoot !== false) {
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: false,
        name: 'Smart Kiosk'
      });
      console.log('[Armored Kiosk] ✅ Auto-Start la pornirea Windows a fost înregistrat.');
    } catch (e) {
      console.warn('[Armored Kiosk] Nu s-a putut seta Auto-Start:', e.message);
    }
  }

  // Afișează fereastra când e gata, fără flicker alb
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isKioskMode) {
      mainWindow.setKiosk(true);
      mainWindow.setFocusable(true);
      mainWindow.focus();
    }
  });

  // ─── TANC BLINDAT: Interceptare Taste & Blocare Scurtături Windows ────────
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toUpperCase();
    const ctrl = input.control;
    const alt = input.alt;
    const shift = input.shift;
    const meta = input.meta; // Windows key / Cmd

    // 1. BLOCARE Alt + F4 (Închidere accidentală sau frauduloasă)
    if (alt && input.key === 'F4') {
      event.preventDefault();
      console.log('[Shield] Alt+F4 blocat.');
      return;
    }

    // 2. BLOCARE F11 (Ieșire din Fullscreen)
    if (input.key === 'F11' && !isDev) {
      event.preventDefault();
      console.log('[Shield] F11 blocat.');
      return;
    }

    // 3. BLOCARE F12, Ctrl+Shift+I, Ctrl+Shift+J (DevTools)
    if ((input.key === 'F12' || (ctrl && shift && (key === 'I' || key === 'J'))) && !config.allowDevTools && !isDev) {
      event.preventDefault();
      console.log('[Shield] DevTools shortcut blocat.');
      return;
    }

    // 4. BLOCARE Refresh manual: Ctrl+R, F5, Ctrl+Shift+R
    if ((ctrl && key === 'R') || (input.key === 'F5' && !isDev)) {
      event.preventDefault();
      console.log('[Shield] Refresh tastatură blocat.');
      return;
    }

    // 5. BLOCARE Ctrl+W (Închidere tab), Ctrl+N (Fereastră nouă), Ctrl+T
    if (ctrl && (key === 'W' || key === 'N' || key === 'T' || key === 'O' || key === 'P')) {
      event.preventDefault();
      return;
    }

    // 6. SCURTĂTURĂ SECRETĂ DE IEȘIRE PENTRU MANAGER: Ctrl + Alt + Shift + Q
    if (ctrl && alt && shift && key === 'Q') {
      promptManagerExit();
    }
  });

  // 7. BLOCARE Meniu Contextual (Click Dreapta)
  mainWindow.webContents.on('context-menu', (e) => {
    if (!isDev) {
      e.preventDefault();
    }
  });

  // 8. BLOCARE Deschidere ferestre noi (popups / target="_blank")
  mainWindow.webContents.setWindowOpenHandler(() => {
    console.log('[Shield] Fereastră popup externă blocată.');
    return { action: 'deny' };
  });

  // ─── AUTO-RECOVERY (Protecție la crash și căderi) ──────────────────────────
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`[Shield] Procesul web a căzut (${details.reason}). Reîncarc în 1 secundă...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(targetUrl);
      }
    }, 1000);
  });

  mainWindow.on('unresponsive', () => {
    console.warn('[Shield] Fereastra nu mai răspunde. Reîmprospătez...');
    mainWindow.reload();
  });

  // Tratare eroare de rețea (Offline fallback cu auto-retry)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[Shield] Conexiune eșuată (${errorDescription}). Reîncerc în ${config.networkRetrySeconds}s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(targetUrl);
      }
    }, config.networkRetrySeconds * 1000);
  });

  // Încărcare URL Kiosk
  console.log(`[Armored Kiosk] 🚀 Pornește Kiosk pentru locația [${targetLocation}]: ${targetUrl}`);
  mainWindow.loadURL(targetUrl);
}

// ─── Ieșire de Urgență Securizată pentru Manager ─────────────────────────────
function promptManagerExit() {
  if (!mainWindow) return;
  
  dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Da, Închide Kiosk', 'Anulează'],
    defaultId: 1,
    title: '🛡️ Manager Override',
    message: 'Dorești să închizi aplicația Smart Kiosk?',
    detail: 'Aplicația este în mod Kiosk securizat.'
  }).then(result => {
    if (result.response === 0) {
      console.log('[Armored Kiosk] Managerul a confirmat ieșirea.');
      app.isQuitting = true;
      app.quit();
    }
  });
}

// ─── IPC Handlers (Comenzi din interfața Kiosk) ──────────────────────────────
ipcMain.on('kiosk-reload', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[Armored Kiosk] Comandă de reîncărcare primită.');
    mainWindow.reload();
  }
});

ipcMain.on('kiosk-fullscreen', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(true);
  }
});

ipcMain.on('kiosk-exit-attempt', (event, pin) => {
  if (pin === config.managerPin) {
    app.isQuitting = true;
    app.quit();
  }
});

ipcMain.handle('kiosk-get-version', () => {
  return app.getVersion();
});

// ─── Ciclu de Viață Aplicație ────────────────────────────────────────────────
app.whenReady().then(() => {
  createKioskWindow();

  // Re-focus pe fereastra unică dacă se încearcă lansarea din nou
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createKioskWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
