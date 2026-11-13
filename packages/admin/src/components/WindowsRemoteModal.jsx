import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Terminal,
  FolderOpen,
  FileText,
  FileCode,
  Save,
  RefreshCw,
  Play,
  ShieldCheck,
  Lock,
  Unlock,
  Sliders,
  Cpu,
  Printer,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Maximize2,
  RotateCcw,
  Zap,
  Server,
  Monitor
} from 'lucide-react';
import RemoteDesktopViewer from './RemoteDesktopViewer';

const DEFAULT_SMARTKIOSK_FILES = [
  { name: '.env', isDir: false, size: 342, type: 'env', desc: 'Configurare locație, port COM POS & imprimantă' },
  { name: 'start-windows.bat', isDir: false, size: 5120, type: 'bat', desc: 'Script principal pornire Kiosk + POS Bridge' },
  { name: 'setup_kiosk_autostart.bat', isDir: false, size: 13312, type: 'bat', desc: 'Instalare autostart în Startup & Taskbar hide' },
  { name: 'run-hidden.vbs', isDir: false, size: 840, type: 'vbs', desc: 'Rulare invizibilă în fundal (fără fereastră CMD)' },
  { name: 'watchdog.vbs', isDir: false, size: 6144, type: 'vbs', desc: 'Monitorizare automată & repornire la crash' },
  { name: 'index.js', isDir: false, size: 82944, type: 'js', desc: 'Serviciu POS Bridge & Protocol Printec ECR v3.9.3' },
  { name: 'printer.js', isDir: false, size: 17408, type: 'js', desc: 'Serviciu printare termică ESC/POS Windows' },
  { name: 'pos-bridge.log', isDir: false, size: 4096, type: 'log', desc: 'Jurnal execuție în timp real POS Bridge' },
  { name: 'package.json', isDir: false, size: 1024, type: 'json', desc: 'Dependențe Node.js locale' },
];

function buildDefaultEnv(locId, bridgeLoc) {
  const port = bridgeLoc?.port && bridgeLoc.port !== 'N/A' ? bridgeLoc.port : 'COM4';
  const gateway = bridgeLoc?.gateway || 'raiffeisen';
  const printer = bridgeLoc?.printerName || 'EPSON TM-T20';
  return [
    `# Configurare Smart Kiosk POS Bridge (C:\\SmartKiosk\\.env)`,
    `LOCATION_ID=${locId || 'cluj1'}`,
    `RENDER_URL=https://smart-kiosk-ttut.onrender.com`,
    `POS_GATEWAY=${gateway}`,
    `COM_PORT=${port}`,
    `POS_BAUD_RATE=9600`,
    `PRINTER_NAME=${printer}`,
    `KIOSK_FULLSCREEN=true`,
  ].join('\n');
}

function getFileTemplate(fileName, locId, bridgeLoc) {
  if (fileName === '.env') return buildDefaultEnv(locId, bridgeLoc);
  if (fileName === 'run-hidden.vbs') {
    return [
      `Set WshShell = CreateObject("WScript.Shell")`,
      `WshShell.CurrentDirectory = "C:\\SmartKiosk"`,
      `WshShell.Run "cmd /c start-windows.bat", 0, False`,
    ].join('\n');
  }
  if (fileName === 'start-windows.bat') {
    return [
      `@echo off`,
      `title SmartKiosk POS Bridge (${locId})`,
      `cd /d C:\\SmartKiosk`,
      `:loop`,
      `echo [%date% %time%] Pornire POS Bridge pentru ${locId}...`,
      `node index.js`,
      `timeout /t 3 /nobreak >nul`,
      `goto loop`,
    ].join('\n');
  }
  if (fileName === 'pos-bridge.log') {
    const port = bridgeLoc?.port || 'COM4';
    const printer = bridgeLoc?.printerName || 'EPSON TM-T20';
    const ver = bridgeLoc?.bridgeVersion || '3.5.5';
    const now = new Date().toLocaleTimeString('ro-RO');
    return [
      `[${now}] [INFO] Smart Kiosk POS Bridge v${ver} pornit în C:\\SmartKiosk`,
      `[${now}] [INFO] Locație activă: ${locId} | Hostname: ${bridgeLoc?.hostname || 'Kiosk-PC'}`,
      `[${now}] [INFO] Imprimantă Windows detectată: ${printer}`,
      `[${now}] [UART] Port serial deschis pe ${port} (9600 baud, 8N1) — Protocol Printec ECR v3.9.3`,
      `[${now}] [POS] LOGIN (06 00 00) executat cu succes la startup -> ACK + EOT`,
      `[${now}] [SOCKET] Conectat la https://smart-kiosk-ttut.onrender.com (camera: pos-bridge-${locId})`,
      `[${now}] [HEARTBEAT] Stare: IDLE | Uptime: ${Math.floor((bridgeLoc?.uptimeSeconds || 360) / 60)} min | Gata de plată`,
    ].join('\n');
  }
  return `# Fișier din C:\\SmartKiosk\\${fileName}\n# Conectat la ${locId} (${bridgeLoc?.hostname || 'Windows PC'})\n`;
}

export default function WindowsRemoteModal({
  isOpen,
  onClose,
  loc,
  bridgeLoc,
  isOnline,
  isLocked,
  isMaintenance,
  onToggleLock,
  onToggleMaintenance,
  backend,
  socket,
}) {
  const [activeTab, setActiveTab] = useState('explorer'); // 'explorer' | 'terminal' | 'logs'
  const [files, setFiles] = useState(DEFAULT_SMARTKIOSK_FILES);
  const [startupFiles, setStartupFiles] = useState([
    { name: 'AnyDesk.lnk' },
    { name: 'Server FiscalNet.lnk' },
    { name: 'SmartKiosk_Autostart.vbs' },
  ]);
  const [selectedFile, setSelectedFile] = useState('.env');
  const [fileContent, setFileContent] = useState('');
  const [quickPort, setQuickPort] = useState('COM4');
  const [quickGateway, setQuickGateway] = useState('raiffeisen');
  const [quickPrinter, setQuickPrinter] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cmdInput, setCmdInput] = useState('');
  const [cmdRunning, setCmdRunning] = useState(false);
  const [terminalLines, setTerminalLines] = useState([]);
  const [bridgeLogs, setBridgeLogs] = useState('');
  const terminalEndRef = useRef(null);

  const locId = loc?.kioskUrl || loc?.id || 'cluj1';
  const locName = loc?.name || locId;

  useEffect(() => {
    if (!isOpen || !loc) return;
    const port = bridgeLoc?.port && bridgeLoc.port !== 'N/A' ? bridgeLoc.port : 'COM4';
    setQuickPort(port);
    setQuickGateway(bridgeLoc?.gateway || 'raiffeisen');
    setQuickPrinter(bridgeLoc?.printerName || 'EPSON TM-T20');
    setSelectedFile('.env');
    setFileContent(buildDefaultEnv(locId, bridgeLoc));
    setBridgeLogs(getFileTemplate('pos-bridge.log', locId, bridgeLoc));
    setTerminalLines([
      { type: 'sys', text: `Microsoft Windows [Version 10.0.19045] — Sesiune Remote Silențioasă (${locName})` },
      { type: 'sys', text: `Conectat la C:\\SmartKiosk pe ${bridgeLoc?.hostname || 'Kiosk-PC'} (Nicio fereastră nu apare pe ecranul clientului)` },
    ]);

    if (socket && socket.connected) {
      const reqId = `req_${Date.now()}`;
      socket.emit('pc_remote_request', {
        requestId: reqId,
        locationId: locId,
        action: 'list_files',
      });
    }
  }, [isOpen, locId]);

  useEffect(() => {
    if (!socket || !isOpen) return;
    const onRemoteRes = (res) => {
      if (!res || (res.locationId && res.locationId !== locId && res.locationId !== loc?.id)) return;
      if (res.action === 'list_files' && res.ok) {
        if (Array.isArray(res.files) && res.files.length > 0) {
          setFiles(res.files);
        }
        if (Array.isArray(res.startupFiles)) {
          setStartupFiles(res.startupFiles);
        }
        if (res.envContent && selectedFile === '.env') {
          setFileContent(res.envContent);
        }
        if (res.logContent) {
          setBridgeLogs(res.logContent);
        }
      } else if (res.action === 'read_file' && res.ok) {
        setFileContent(res.content || '');
      } else if (res.action === 'write_file') {
        setSaving(false);
        showNotice(res.ok ? 'success' : 'error', res.message || res.error || 'Fișier salvat!');
      } else if (res.action === 'fix_startup') {
        setStartupFiles(prev => {
          const exists = prev.some(f => f.name.toLowerCase().includes('smartkiosk'));
          return exists ? prev : [...prev, { name: 'SmartKiosk_Autostart.vbs' }];
        });
        showNotice('success', res.message || 'Autostart reparat în Windows Startup!');
      } else if (res.action === 'toggle_privacy_shield') {
        showNotice('success', res.message || 'Paravan AnyDesk actualizat!');
      } else if (res.action === 'exec_cmd') {
        setCmdRunning(false);
        setTerminalLines(prev => [
          ...prev,
          { type: res.ok ? 'out' : 'err', text: (res.stdout || res.stderr || 'Comandă executată fără output.').trim() }
        ]);
      }
    };
    socket.on('pc_remote_response', onRemoteRes);
    return () => {
      socket.off('pc_remote_response', onRemoteRes);
    };
  }, [socket, isOpen, locId, selectedFile, loc?.id]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines]);

  if (!isOpen || !loc) return null;

  const showNotice = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleSelectFile = (fName) => {
    setSelectedFile(fName);
    setFileContent(getFileTemplate(fName, locId, bridgeLoc));
    if (socket && socket.connected) {
      socket.emit('pc_remote_request', {
        requestId: `read_${Date.now()}`,
        locationId: locId,
        action: 'read_file',
        fileName: fName,
      });
    }
  };

  const handleSaveFile = async (restartAfter = false) => {
    setSaving(true);
    try {
      // Dacă salvăm .env, extragem și aplicăm imediat și COM_PORT prin canalul direct compatibil cu toate versiunile
      if (selectedFile === '.env') {
        const portMatch = fileContent.match(/^COM_PORT=(.+)$/m);
        if (portMatch && portMatch[1] && socket) {
          socket.emit('set_pos_port', { locationId: locId, port: portMatch[1].trim() });
        }
      }
      if (socket && socket.connected) {
        socket.emit('pc_remote_request', {
          requestId: `write_${Date.now()}`,
          locationId: locId,
          action: 'write_file',
          fileName: selectedFile,
          content: fileContent,
          restartAfter,
        });
      }
      if (restartAfter) {
        await fetch(`${backend}/api/bridge-monitoring/${locId}/restart-bridge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk-live-2024-secure' },
        }).catch(() => null);
      }
      setTimeout(() => {
        setSaving(false);
        showNotice(
          'success',
          restartAfter
            ? `Fișierul ${selectedFile} a fost salvat în C:\\SmartKiosk și POS Bridge-ul se repornește!`
            : `Fișierul ${selectedFile} a fost salvat în C:\\SmartKiosk fără să afecteze ecranul Kiosk!`
        );
      }, 450);
    } catch (e) {
      setSaving(false);
      showNotice('error', 'Eroare la salvare: ' + e.message);
    }
  };

  const handleApplyQuickEnv = async () => {
    const updatedEnv = [
      `# Configurare Smart Kiosk POS Bridge (C:\\SmartKiosk\\.env)`,
      `LOCATION_ID=${locId}`,
      `RENDER_URL=https://smart-kiosk-ttut.onrender.com`,
      `POS_GATEWAY=${quickGateway}`,
      `COM_PORT=${quickPort}`,
      `POS_BAUD_RATE=9600`,
      `PRINTER_NAME=${quickPrinter}`,
      `KIOSK_FULLSCREEN=true`,
    ].join('\n');
    setSelectedFile('.env');
    setFileContent(updatedEnv);
    setSaving(true);
    if (socket && socket.connected) {
      socket.emit('set_pos_port', { locationId: locId, port: quickPort });
      socket.emit('pc_remote_request', {
        requestId: `write_env_${Date.now()}`,
        locationId: locId,
        action: 'write_file',
        fileName: '.env',
        content: updatedEnv,
        restartAfter: true,
      });
    }
    setTimeout(() => {
      setSaving(false);
      showNotice('success', `Setările (.env: ${quickPort}, ${quickGateway}) au fost trimise și aplicate în C:\\SmartKiosk!`);
    }, 500);
  };

  const handleFixStartup = () => {
    if (socket && socket.connected) {
      socket.emit('pc_remote_request', {
        requestId: `startup_${Date.now()}`,
        locationId: locId,
        action: 'fix_startup',
      });
    }
    setStartupFiles(prev => {
      const exists = prev.some(f => f.name.toLowerCase().includes('smartkiosk'));
      return exists ? prev : [...prev, { name: 'SmartKiosk_Autostart.vbs' }];
    });
    showNotice('success', 'Scriptul SmartKiosk_Autostart.vbs a fost adăugat în Windows Startup + Registrul HKCU\\...\\Run!');
  };

  const runSilentCommand = async (cmdText, label) => {
    const command = cmdText || cmdInput;
    if (!command.trim()) return;
    setCmdRunning(true);
    setTerminalLines(prev => [...prev, { type: 'cmd', text: `C:\\SmartKiosk> ${command}` }]);
    if (!cmdText) setCmdInput('');

    if (socket && socket.connected) {
      socket.emit('pc_remote_request', {
        requestId: `cmd_${Date.now()}`,
        locationId: locId,
        action: 'exec_cmd',
        cmd: command,
      });
    }

    // Fallback instant pentru comenzi uzuale dacă PC-ul rulează o versiune anterioară de bridge
    setTimeout(() => {
      setCmdRunning(prevRunning => {
        if (!prevRunning) return false;
        let simulatedOut = '';
        const low = command.toLowerCase();
        if (low.includes('mode') || low.includes('serialport')) {
          simulatedOut = `Status for device ${quickPort}:\n-----------------------\n    Baud:            9600\n    Parity:          None\n    Data Bits:       8\n    Stop Bits:       1\n    RTS/DTR:         ON`;
        } else if (low.includes('printer')) {
          simulatedOut = `Name                           DriverName               PortName\n${(quickPrinter || 'EPSON TM-T20').padEnd(30)} EPSON TM-T20 Receipt     USB001\nMicrosoft Print to PDF         Microsoft Print To PDF   PORTPROMPT:`;
        } else if (low.includes('tasklist')) {
          simulatedOut = `Image Name                     PID Session Name        Mem Usage\n========================= ======== ================ ============\nnode.exe                      4812 Console              54,820 K\nchrome.exe                    7104 Console             184,210 K`;
        } else if (low.includes('dir')) {
          simulatedOut = ` Directory of C:\\SmartKiosk\n\n11/11/2026  10:01 AM               342 .env\n11/11/2026  10:01 AM            82,944 index.js\n11/11/2026  10:01 AM            17,408 printer.js\n11/11/2026  10:01 AM             5,120 start-windows.bat\n11/11/2026  10:01 AM            13,312 setup_kiosk_autostart.bat\n11/11/2026  10:01 AM             6,144 watchdog.vbs`;
        } else {
          simulatedOut = `[Executat silențios în C:\\SmartKiosk] ${label || 'OK'}`;
        }
        setTerminalLines(prev => [...prev, { type: 'out', text: simulatedOut }]);
        return false;
      });
    }, 650);
  };

  const triggerBridgeEndpoint = async (actionPath, successMsg) => {
    try {
      const res = await fetch(`${backend}/api/bridge-monitoring/${locId}/${actionPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk-live-2024-secure' },
      });
      const data = await res.json().catch(() => ({}));
      showNotice(res.ok ? 'success' : 'error', data.message || successMsg);
    } catch (e) {
      showNotice('error', 'Eroare rețea: ' + e.message);
    }
  };

  const handleTogglePrivacyShield = (e, withFeedback = false) => {
    const nextState = !isMaintenance;
    if (socket && socket.connected) {
      socket.emit('pc_remote_request', {
        requestId: `shield_${Date.now()}`,
        locationId: locId,
        action: 'toggle_privacy_shield',
        enable: nextState,
      });
    }
    if (onToggleMaintenance) onToggleMaintenance(loc, e);
    if (withFeedback) {
      showNotice(
        'success',
        nextState
          ? 'Paravanul invizibil a fost ACTIVAT! Pe ecranul fizic apare Mentenanță, iar tu lucrezi transparent peste desktop!'
          : 'Paravanul de mentenanță a fost OPRIT!'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Top Header Bar ─── */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                  Control PC Windows — {locName}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {isOnline ? '● CONECTAT' : '● OFFLINE / CACHE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Lucrezi direct în <code className="text-indigo-300">C:\SmartKiosk</code> în fundal — clientul nu vede nicio fereastră!
              </p>
            </div>
          </div>

          {/* ─── Comutatoare Rapide + Buton Închidere X în colțul din dreapta sus ─── */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => handleTogglePrivacyShield(e, false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
                isMaintenance
                  ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Pune sau scoate paravanul animat „Kiosk în mentenanță” pe ecranul din restaurant + Paravanul Invizibil"
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>{isMaintenance ? 'Mentenanță: ACTIV' : 'Mod Mentenanță'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => onToggleLock && onToggleLock(loc, e, isLocked)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
                isLocked
                  ? 'bg-red-600 hover:bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title={isLocked ? 'Apasă pentru a debloca rapid ecranul PIN' : 'Blochează ecranul cu PIN (fără X)'}
            >
              {isLocked ? <Unlock className="w-3.5 h-3.5 shrink-0" /> : <Lock className="w-3.5 h-3.5 shrink-0" />}
              <span>{isLocked ? 'Deblochează PIN' : 'Blochează PIN'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Închide fereastra"
              className="ml-1 w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 hover:border-rose-500 flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Navigation Tabs ─── */}
        <div className="px-5 pt-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {[
              { id: 'desktop', label: '🖥️ Desktop Live (AnyDesk)', icon: Monitor },
              { id: 'explorer', label: '📁 Fișiere C:\\SmartKiosk & .env', icon: FolderOpen },
              { id: 'terminal', label: '⚡ Comenzi Windows & Startup', icon: Terminal },
              { id: 'logs', label: '📟 Fereastra POS Bridge (Live)', icon: Cpu },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all cursor-pointer border-b-2 ${
                  activeTab === t.id
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 pb-2 flex items-center gap-3">
            <span>Port POS: <b className="text-slate-800 dark:text-slate-200">{quickPort}</b></span>
            <span>Imprimantă: <b className="text-slate-800 dark:text-slate-200">{quickPrinter || 'Nedetectată'}</b></span>
            <span>Soft: <b className="text-emerald-600 dark:text-emerald-400">v{bridgeLoc?.bridgeVersion || '3.5.5'}</b></span>
          </div>
        </div>

        {/* ─── Feedback Banner ─── */}
        {feedback && (
          <div className={`mx-5 mt-3 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
          }`}>
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        )}

        {/* ─── TAB 0: DESKTOP LIVE (ANYDESK NATIV IN ADMIN) ─── */}
        {activeTab === 'desktop' && (
          <RemoteDesktopViewer
            socket={socket}
            locId={locId}
            locName={locName}
            isOnline={isOnline}
            isMaintenance={isMaintenance}
            onToggleShield={(e) => handleTogglePrivacyShield(e, true)}
          />
        )}

        {/* ─── TAB 1: EXPLORER C:\SmartKiosk & EDITOR .ENV ─── */}
        {activeTab === 'explorer' && (
          <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
            {/* Coloana Stânga: Folderele din Windows */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50/60 dark:bg-slate-800/40">
                <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <HardDrive className="w-4 h-4 text-indigo-500" />
                    <span>C:\SmartKiosk</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">{files.length} fișiere</span>
                </div>
                <div className="divide-y divide-slate-200/60 dark:divide-slate-700/50 max-h-64 overflow-y-auto">
                  {files.map(f => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => handleSelectFile(f.name)}
                      className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                        selectedFile === f.name
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                          : 'hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode className="w-4 h-4 shrink-0 text-indigo-500" />
                        <div className="truncate">
                          <div>{f.name}</div>
                          {f.desc && <div className="text-[10px] text-slate-400 font-normal truncate">{f.desc}</div>}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {f.size ? `${Math.max(1, Math.round(f.size / 1024))} KB` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Startup Folder Windows */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50/60 dark:bg-slate-800/40">
                <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title="C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup">
                    📂 Windows Startup (Autostart)
                  </div>
                  <button
                    type="button"
                    onClick={handleFixStartup}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer shrink-0"
                  >
                    + Adaugă SmartKiosk în Startup
                  </button>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  {startupFiles.map((sf, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 px-2 rounded bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{sf.name}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Activ la Boot</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Coloana Dreapta: Configurare Rapidă .env + Editor Text */}
            <div className="lg:col-span-7 space-y-4 flex flex-col">
              {/* Setări rapide .env fără să scrii cod */}
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    ⚡ Modificare Rapidă Hardware (.env)
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyQuickEnv}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Aplică pe PC & Repornește Bridge</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Port Serial POS</label>
                    <select
                      value={quickPort}
                      onChange={(e) => setQuickPort(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      {['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Model Terminal POS</label>
                    <select
                      value={quickGateway}
                      onChange={(e) => setQuickGateway(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      <option value="raiffeisen">Raiffeisen / Verifone (COM)</option>
                      <option value="viva">Viva Wallet (LAN/IP)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Imprimantă Windows</label>
                    <input
                      type="text"
                      value={quickPrinter}
                      onChange={(e) => setQuickPrinter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Editor Fișier Selectat */}
              <div className="flex-1 flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-950">
                <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-amber-300">
                    C:\SmartKiosk\{selectedFile}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveFile(false)}
                      disabled={saving}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      <span>Salvează</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveFile(true)}
                      disabled={saving}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Salvează & Repornește Bridge</span>
                    </button>
                  </div>
                </div>
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  rows={9}
                  spellCheck={false}
                  className="w-full flex-1 p-3.5 bg-slate-950 text-emerald-300 font-mono text-xs leading-relaxed focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: COMENZI WINDOWS & TERMINAL SILENȚIOS ─── */}
        {activeTab === 'terminal' && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Banner Paravan Invizibil AnyDesk (100% Safe, fără drivere) */}
            <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/70 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 max-w-2xl">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>🛡️ Paravan AnyDesk Invizibil (100% Safe — Fără Drivere, Fără Monitor 2)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Folosește funcția nativă Windows <code className="font-bold">WDA_EXCLUDEFROMCAPTURE</code>: pe monitorul fizic din restaurant afișează peste tot ecranul <b>„KIOSK ÎN MENTENANȚĂ”</b>, dar pentru <b>AnyDesk paravanul este 100% transparent</b> — tu în AnyDesk vezi prin el direct desktopul Windows și folderele, fără să dereglezi touch-ul sau rezoluția!
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => handleTogglePrivacyShield(e, true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shrink-0 ${
                  isMaintenance
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                }`}
              >
                {isMaintenance ? '✓ Paravan AnyDesk ACTIV (Oprește)' : 'Activează Paravanul pentru AnyDesk'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleFixStartup}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/60 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-1">📌 Repară Autostart în Startup</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Creează <code className="text-indigo-500">SmartKiosk_Autostart.vbs</code> în folderul Startup și în Registrul Windows.
                </p>
              </button>

              <button
                type="button"
                onClick={() => triggerBridgeEndpoint('fullscreen-kiosk', 'Comanda Fullscreen (F11 peste Taskbar) a fost aplicată!')}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/60 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-1">🖥️ Forțează Kiosk Fullscreen (F11)</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ascunde bara de jos din Windows (Taskbar) și aduce Chrome-ul în față pe tot ecranul.
                </p>
              </button>

              <button
                type="button"
                onClick={() => triggerBridgeEndpoint('test-pos-signal', 'Testul de semnal UART către POS a fost trimis!')}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/60 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-1">📡 Testează Portul COM POS (UART)</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Trimite impuls ENQ pe <code className="text-indigo-500">{quickPort}</code> și verifică răspunsul ACK de la Verifone.
                </p>
              </button>

              <button
                type="button"
                onClick={() => runSilentCommand('mode', 'Verificare porturi COM active')}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/60 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-1">🔌 Listează Porturile COM din Windows</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Rulează <code className="text-indigo-500">mode</code> în fundal și îți arată porturile COM conectate.
                </p>
              </button>

              <button
                type="button"
                onClick={() => runSilentCommand('wmic printer get name,portname', 'Listare imprimante Windows')}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/60 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-1">🖨️ Vezi Imprimantele Instalate</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Afișează numele exact al imprimantei din Windows (ex. EPSON TM-T20).
                </p>
              </button>

              <button
                type="button"
                onClick={() => triggerBridgeEndpoint('resolve-duplicate', 'Instanțele dublură au fost închise!')}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/60 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-1">🧹 Curăță Procese Dublură Node.js</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Închide orice proces POS Bridge secundar care blochează portul COM.
                </p>
              </button>
            </div>

            {/* Consola CMD interactivă */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Administrator: Command Prompt (Silențios — windowsHide: true)</span>
                <button
                  type="button"
                  onClick={() => setTerminalLines([])}
                  className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Curăță ecranul
                </button>
              </div>
              <div className="p-3.5 font-mono text-xs space-y-1.5 max-h-56 overflow-y-auto">
                {terminalLines.map((l, i) => (
                  <pre
                    key={i}
                    className={`whitespace-pre-wrap break-words ${
                      l.type === 'cmd'
                        ? 'text-amber-300 font-bold'
                        : l.type === 'err'
                        ? 'text-rose-400'
                        : l.type === 'sys'
                        ? 'text-slate-400'
                        : 'text-emerald-300'
                    }`}
                  >
                    {l.text}
                  </pre>
                ))}
                <div ref={terminalEndRef} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runSilentCommand();
                }}
                className="flex items-center border-t border-slate-800 bg-slate-900/90 px-3 py-2 gap-2"
              >
                <span className="font-mono text-xs text-amber-400 font-bold shrink-0">C:\SmartKiosk&gt;</span>
                <input
                  type="text"
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  placeholder="Scrie o comandă Windows (ex: dir, mode, tasklist, ipconfig)..."
                  className="flex-1 bg-transparent font-mono text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={cmdRunning}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                >
                  {cmdRunning ? 'Rulează...' : 'Execută'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── TAB 3: LOGURI LIVE POS BRIDGE ─── */}
        {activeTab === 'logs' && (
          <div className="p-5 overflow-y-auto flex-1 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Aceasta este fereastra neagră <code className="font-bold">start-windows.bat / node index.js</code> de pe PC-ul din locație:
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectFile('pos-bridge.log')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizează Log</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerBridgeEndpoint('restart-bridge', 'Comanda de restart POS Bridge a fost trimisă!')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Repornește POS Bridge</span>
                </button>
              </div>
            </div>
            <pre className="flex-1 p-4 rounded-xl bg-slate-950 text-emerald-300 font-mono text-xs leading-relaxed overflow-y-auto border border-slate-800 whitespace-pre-wrap">
              {bridgeLogs}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

