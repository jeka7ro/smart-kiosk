const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kioskElectron', {
  isElectron: true,
  isArmoredTank: true,
  platform: process.platform,
  reload: () => ipcRenderer.send('kiosk-reload'),
  requestFullscreen: () => ipcRenderer.send('kiosk-fullscreen'),
  exitKiosk: (pin) => ipcRenderer.send('kiosk-exit-attempt', pin),
  getVersion: () => ipcRenderer.invoke('kiosk-get-version')
});
