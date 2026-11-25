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
  Monitor,
  Copy,
  Check
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
  const [runningFile, setRunningFile] = useState(null);
  const [taskbarVisible, setTaskbarVisible] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cmdInput, setCmdInput] = useState('');
  const [cmdRunning, setCmdRunning] = useState(false);
  const [terminalLines, setTerminalLines] = useState([]);
  const [copiedTerminal, setCopiedTerminal] = useState(false);
  const [copiedBridgeLogs, setCopiedBridgeLogs] = useState(false);
  const [bridgeLogs, setBridgeLogs] = useState('');
  const terminalEndRef = useRef(null);
  const cmdTimeoutRef = useRef(null);

  const isRunnableFile = (name) => /\.(bat|cmd|vbs|ps1|lnk|exe)$/i.test(String(name || ''));

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
    setRunningFile(null);
    setCmdRunning(false);
    setTerminalLines([
      { type: 'sys', text: `Microsoft Windows [Version 10.0.19045] — Sesiune Remote Silențioasă (${locName})` },
      { type: 'sys', text: isOnline
        ? `Conectat la C:\\SmartKiosk pe ${bridgeLoc?.hostname || 'Kiosk-PC'} (Comenzi live prin POS Bridge)`
        : `POS Bridge este OFFLINE pe ${locName} — comenzile nu pot ajunge la PC până nu pornește bridge-ul.` },
    ]);

    if (socket && socket.connected && isOnline) {
      const reqId = `req_${Date.now()}`;
      socket.emit('pc_remote_request', {
        requestId: reqId,
        locationId: locId,
        action: 'list_files',
      });
    }
  }, [isOpen, locId, isOnline]);

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
        if (typeof res.taskbarVisible === 'boolean') {
          setTaskbarVisible(res.taskbarVisible);
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
      } else if (res.action === 'run_file') {
        setRunningFile(null);
        const msg = res.message || res.error || (res.ok ? `Executat: ${res.fileName}` : 'Eroare la execuție!');
        showNotice(res.ok ? 'success' : 'error', msg);
        setTerminalLines(prev => [
          ...prev,
          { type: res.ok ? 'out' : 'err', text: `[${res.source === 'startup' ? 'Startup' : 'C:\\SmartKiosk'}] ${msg}` }
        ]);
      } else if (res.action === 'toggle_taskbar') {
        if (typeof res.show === 'boolean') setTaskbarVisible(res.show);
        showNotice(res.ok ? 'success' : 'error', res.message || res.error || 'Taskbar actualizat!');
      } else if (res.action === 'fix_startup') {
        setStartupFiles(prev => {
          const exists = prev.some(f => f.name.toLowerCase().includes('smartkiosk'));
          return exists ? prev : [...prev, { name: 'SmartKiosk_Autostart.vbs' }];
        });
        showNotice(res.ok === false ? 'error' : 'success', res.message || res.error || 'Autostart reparat în Windows Startup!');
      } else if (res.action === 'toggle_privacy_shield') {
        showNotice('success', res.message || 'Paravan Mentenanță actualizat!');
      } else if (res.action === 'open_desktop_folder') {
        if (typeof res.taskbarVisible === 'boolean') setTaskbarVisible(res.taskbarVisible);
        showNotice('success', res.message || 'Chrome minimizat și C:\\SmartKiosk deschis pe Desktop!');
      } else if (res.action === 'reboot_pc') {
        showNotice(res.ok === false ? 'error' : 'success', res.message || res.error || 'Comanda de Restart PC Windows a fost lansată.');
        setTerminalLines(prev => [
          ...prev,
          { type: res.ok === false ? 'err' : 'out', text: `[SYSTEM REBOOT] ${res.message || res.error || 'shutdown /r /t 2 /f'}` }
        ]);
      } else if (res.action === 'exec_cmd') {
        if (cmdTimeoutRef.current) {
          clearTimeout(cmdTimeoutRef.current);
          cmdTimeoutRef.current = null;
        }
        setCmdRunning(false);
        setTerminalLines(prev => [
          ...prev,
          { type: res.ok ? 'out' : 'err', text: (res.stdout || res.stderr || 'Comandă executată fără output.').trim() }
        ]);
      }
    };
    socket.on('pc_remote_response', onRemoteRes);
    return () => {
      if (cmdTimeoutRef.current) {
        clearTimeout(cmdTimeoutRef.current);
        cmdTimeoutRef.current = null;
      }
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

  const requireOnlineBridge = (actionLabel = 'această acțiune') => {
    if (!isOnline || !socket || !socket.connected) {
      showNotice('error', `POS Bridge este OFFLINE pe ${locName} — nu pot executa ${actionLabel} până nu revine online (pornește o dată din AnyDesk dacă procesul local s-a oprit).`);
      return false;
    }
    return true;
  };

  const handleSelectFile = (fName) => {
    setSelectedFile(fName);
    setFileContent(getFileTemplate(fName, locId, bridgeLoc));
    if (socket && socket.connected && isOnline) {
      socket.emit('pc_remote_request', {
        requestId: `read_${Date.now()}`,
        locationId: locId,
        action: 'read_file',
        fileName: fName,
      });
    }
  };

  const handleRunFile = (fileName, source = 'smartkiosk') => {
    if (!requireOnlineBridge(`fișierul ${fileName}`)) return;
    setRunningFile(`${source}:${fileName}`);
    const prefix = source === 'startup' ? 'Startup' : 'C:\\SmartKiosk';
    setTerminalLines(prev => [...prev, { type: 'cmd', text: `[EXEC ${prefix}] ${fileName}` }]);
    socket.emit('pc_remote_request', {
      requestId: `run_${Date.now()}`,
      locationId: locId,
      action: 'run_file',
      fileName,
      source,
    });
    setTimeout(() => {
      setRunningFile(prev => (prev === `${source}:${fileName}` ? null : prev));
    }, 8000);
  };

  const handleToggleTaskbar = () => {
    if (!requireOnlineBridge('comutarea bării de Start Windows')) return;
    const nextShow = !taskbarVisible;
    socket.emit('pc_remote_request', {
      requestId: `taskbar_${Date.now()}`,
      locationId: locId,
      action: 'toggle_taskbar',
      show: nextShow,
    });
  };

  const handleSaveFile = async (restartAfter = false) => {
    if (!requireOnlineBridge(`salvarea ${selectedFile}`)) return;
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
    if (!requireOnlineBridge('aplicarea .env')) return;
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
    if (!requireOnlineBridge('repararea Windows Startup')) return;
    socket.emit('pc_remote_request', {
      requestId: `startup_${Date.now()}`,
      locationId: locId,
      action: 'fix_startup',
    });
  };

  const runSilentCommand = async (cmdText) => {
    const command = cmdText || cmdInput;
    if (!command.trim()) return;
    setTerminalLines(prev => [...prev, { type: 'cmd', text: `C:\\SmartKiosk> ${command}` }]);
    if (!cmdText) setCmdInput('');

    if (!isOnline || !socket || !socket.connected) {
      setTerminalLines(prev => [
        ...prev,
        { type: 'err', text: `EROARE: POS Bridge este OFFLINE pe ${locName}. Comanda NU s-a executat pe PC (pornește bridge-ul din AnyDesk dacă s-a oprit complet).` }
      ]);
      showNotice('error', `POS Bridge este OFFLINE — comanda nu s-a executat pe ${locName}!`);
      return;
    }

    setCmdRunning(true);
    if (cmdTimeoutRef.current) clearTimeout(cmdTimeoutRef.current);

    socket.emit('pc_remote_request', {
      requestId: `cmd_${Date.now()}`,
      locationId: locId,
      action: 'exec_cmd',
      cmd: command,
    });

    cmdTimeoutRef.current = setTimeout(() => {
      cmdTimeoutRef.current = null;
      setCmdRunning(prevRunning => {
        if (!prevRunning) return false;
        setTerminalLines(prev => [
          ...prev,
          { type: 'err', text: 'TIMEOUT (16s): PC-ul nu a răspuns la exec_cmd. Verifică versiunea POS Bridge sau conexiunea.' }
        ]);
        return false;
      });
    }, 16000);
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

  const handleCopyTerminalLogs = () => {
    const text = terminalLines.map(l => l.text).join('\n');
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedTerminal(true);
      setTimeout(() => setCopiedTerminal(false), 2000);
    }).catch(() => {});
  };

  const handleCopyBridgeLogs = () => {
    if (!bridgeLogs) return;
    navigator.clipboard?.writeText(bridgeLogs).then(() => {
      setCopiedBridgeLogs(true);
      setTimeout(() => setCopiedBridgeLogs(false), 2000);
    }).catch(() => {});
  };

  const handleToggleMaintenanceMode = (e, withFeedback = false) => {
    const nextState = !isMaintenance;
    if (onToggleMaintenance) onToggleMaintenance(loc, e);
    if (withFeedback) {
      showNotice(
        'success',
        nextState
          ? 'Kiosk-ul a fost trecut în Mod Mentenanță (afișaj animat și blocare comenzi).'
          : 'Modul Mentenanță a fost oprit — Kiosk-ul a revenit la comenzi normale.'
      );
    }
  };

  const handleOpenDesktopFolder = () => {
    if (!requireOnlineBridge('deschiderea Desktopului & C:\\SmartKiosk')) return;
    socket.emit('pc_remote_request', {
      requestId: `desk_${Date.now()}`,
      locationId: locId,
      action: 'open_desktop_folder',
    });
  };

  const handleRebootPc = async () => {
    if (!requireOnlineBridge('restartarea PC-ului Windows')) return;
    const confirmed = window.confirm(
      `Ești sigur că vrei să dai RESTART COMPLET la calculatorul Windows din „${locName}”?\n\nCalculatorul se va închide și va reporni automat în ~1 minut (cu autostart Kiosk + POS Bridge).`
    );
    if (!confirmed) return;

    if (socket && socket.connected) {
      socket.emit('pc_remote_request', {
        requestId: `reboot_${Date.now()}`,
        locationId: locId,
        action: 'reboot_pc',
      });
    }
    try {
      await fetch(`${backend}/api/bridge-monitoring/${locId}/reboot-pc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk-live-2024-secure' },
      });
    } catch (_) {}
    showNotice('success', `Comanda de Restart PC Windows a fost trimisă către ${locName}. Calculatorul repornește acum.`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl apple-modal overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Top Header Bar ─── */}
        <div className="px-5 py-4 bg-white dark:bg-[#1C1C1E] flex items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] truncate m-0">
                  Control PC Windows — {locName}
                </h3>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                  isOnline ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]' : 'bg-[#FF9500]/12 text-[#C93400] dark:text-[#FF9F0A]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#34C759]' : 'bg-[#FF9500]'}`} />
                  {isOnline ? 'Conectat' : 'Offline'}
                </span>
              </div>
              <p className="text-[12px] text-[#86868B] truncate m-0 mt-0.5">
                Sesiune fundal în <code className="text-[#007AFF] font-mono text-[11px]">C:\SmartKiosk</code> — fără impact pe ecranul client
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => handleToggleMaintenanceMode(e, true)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                isMaintenance
                  ? 'bg-[#FF9500] text-white'
                  : 'apple-btn-secondary'
              }`}
              title="Comută Kiosk-ul în Mod Mentenanță"
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>{isMaintenance ? 'Mentenanță: Activ' : 'Mentenanță'}</span>
            </button>

            <button
              type="button"
              onClick={handleRebootPc}
              disabled={!isOnline}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 disabled:opacity-45 text-[#FF3B30]"
              title="Restart complet calculator Windows"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Restart PC</span>
            </button>

            <button
              type="button"
              onClick={(e) => onToggleLock && onToggleLock(loc, e, isLocked)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                isLocked
                  ? 'bg-[#FF3B30] text-white'
                  : 'apple-btn-secondary'
              }`}
              title={isLocked ? 'Deblochează ecranul PIN' : 'Blochează ecranul cu PIN'}
            >
              {isLocked ? <Unlock className="w-3.5 h-3.5 shrink-0" /> : <Lock className="w-3.5 h-3.5 shrink-0" />}
              <span>{isLocked ? 'Deblochează PIN' : 'Blochează PIN'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Închide fereastra"
              className="apple-close-btn ml-1 shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ─── Navigation Tabs ─── */}
        <div className="px-5 py-2.5 bg-[#F5F5F7] dark:bg-[#141416] border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-3 flex-wrap">
          <div className="apple-segmented inline-flex flex-wrap">
            {[
              { id: 'desktop', label: 'Desktop Live', icon: Monitor },
              { id: 'explorer', label: 'Fișiere & .env', icon: FolderOpen },
              { id: 'terminal', label: 'Comenzi & Startup', icon: Terminal },
              { id: 'logs', label: 'Consolă Bridge', icon: Cpu },
            ].map(t => {
              const TabIcon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`apple-segmented-item inline-flex items-center gap-1.5 px-3 ${activeTab === t.id ? 'is-active' : ''}`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D] flex items-center gap-3 tabular-nums">
            <span>Port POS: <b className="text-[#1D1D1F] dark:text-[#F5F5F7]">{quickPort}</b></span>
            <span>Imprimantă: <b className="text-[#1D1D1F] dark:text-[#F5F5F7]">{quickPrinter || 'Nedetectată'}</b></span>
            <span>Soft: <b className="text-[#248A3D] dark:text-[#30D158]">v{bridgeLoc?.bridgeVersion || '3.5.5'}</b></span>
          </div>
        </div>

        {/* ─── Feedback Banner ─── */}
        {feedback && (
          <div className={`mx-5 mt-3 px-3.5 py-2.5 rounded-xl text-[12px] font-medium flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-[#34C759]/10 text-[#248A3D] dark:text-[#30D158] border-[#34C759]/20'
              : 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20'
          }`}>
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer"><X size={14} /></button>
          </div>
        )}

        {/* ─── TAB 0: DESKTOP LIVE (ANYDESK NATIV IN ADMIN) ─── */}
        {activeTab === 'desktop' && (
          <RemoteDesktopViewer
            socket={socket}
            locId={locId}
            locName={locName}
            isOnline={isOnline}
            onOpenDesktopFolder={handleOpenDesktopFolder}
            onRebootPc={handleRebootPc}
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
                  {files.map(f => {
                    const canRun = !f.isDir && isRunnableFile(f.name);
                    const isThisRunning = runningFile === `smartkiosk:${f.name}`;
                    return (
                      <div
                        key={f.name}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectFile(f.name)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectFile(f.name); }}
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
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400">
                            {f.size ? `${Math.max(1, Math.round(f.size / 1024))} KB` : ''}
                          </span>
                          {canRun && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRunFile(f.name, 'smartkiosk'); }}
                              disabled={!isOnline || isThisRunning}
                              title={isOnline ? `Execută ${f.name} pe Windows` : 'PC offline'}
                              className="px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-2.5 h-2.5" />
                              <span>{isThisRunning ? '...' : 'Execută'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Startup Folder Windows */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50/60 dark:bg-slate-800/40">
                <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate flex items-center gap-1.5" title="C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup">
                    <FolderOpen className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
                    <span>Windows Startup (Autostart)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFixStartup}
                    className="px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer shrink-0"
                  >
                    + Adaugă SmartKiosk în Startup
                  </button>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  {startupFiles.map((sf, idx) => {
                    const isThisRunning = runningFile === `startup:${sf.name}`;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60">
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{sf.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">La Boot</span>
                          {isRunnableFile(sf.name) && (
                            <button
                              type="button"
                              onClick={() => handleRunFile(sf.name, 'startup')}
                              disabled={!isOnline || isThisRunning}
                              title={isOnline ? `Pornește acum ${sf.name}` : 'PC offline'}
                              className="px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-2.5 h-2.5" />
                              <span>{isThisRunning ? '...' : 'Execută'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Coloana Dreapta: Configurare Rapidă .env + Editor Text */}
            <div className="lg:col-span-7 space-y-4 flex flex-col">
              {/* Setări rapide .env fără să scrii cod */}
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span>Modificare Rapidă Hardware (.env)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyQuickEnv}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
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
                    {isRunnableFile(selectedFile) && (
                      <button
                        type="button"
                        onClick={() => handleRunFile(selectedFile, 'smartkiosk')}
                        disabled={!isOnline || runningFile === `smartkiosk:${selectedFile}`}
                        className="px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>Execută acum</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSaveFile(false)}
                      disabled={saving}
                      className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      <span>Salvează</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveFile(true)}
                      disabled={saving}
                      className="px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleToggleTaskbar}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  taskbarVisible
                    ? 'border-[#FF9500]/50 bg-[#FF9500]/10'
                    : 'border-black/[0.08] dark:border-white/[0.1] hover:border-[#007AFF]/50 bg-[#F5F5F7] dark:bg-white/[0.04]'
                }`}
              >
                <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                  {taskbarVisible ? 'Ascunde Taskbar Windows' : 'Arată Bara Start / Taskbar'}
                </div>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] m-0">
                  {taskbarVisible
                    ? 'Taskbar-ul e vizibil acum. Click pentru a-l ascunde și reveni la Fullscreen.'
                    : 'Afișează bara de jos Windows (Start Bar) fără auto-ascundere.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleRunFile('start-windows.bat', 'smartkiosk')}
                className="p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] hover:border-[#007AFF]/50 bg-[#F5F5F7] dark:bg-white/[0.04] text-left transition-all cursor-pointer"
              >
                <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">Rulează start-windows.bat</div>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] m-0">
                  Pornește direct <code className="text-[#007AFF]">start-windows.bat</code> în <code className="font-mono">C:\SmartKiosk</code>.
                </p>
              </button>

              <button
                type="button"
                onClick={handleFixStartup}
                className="p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] hover:border-[#007AFF]/50 bg-[#F5F5F7] dark:bg-white/[0.04] text-left transition-all cursor-pointer"
              >
                <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">Repară Autostart în Startup</div>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] m-0">
                  Creează <code className="text-[#007AFF]">SmartKiosk_Autostart.vbs</code> în Startup și Registrul Windows.
                </p>
              </button>

              <button
                type="button"
                onClick={() => triggerBridgeEndpoint('fullscreen-kiosk', 'Comanda Fullscreen (F11 peste Taskbar) a fost aplicată.')}
                className="p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] hover:border-[#007AFF]/50 bg-[#F5F5F7] dark:bg-white/[0.04] text-left transition-all cursor-pointer"
              >
                <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">Forțează Kiosk Fullscreen (F11)</div>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] m-0">
                  Ascunde bara de jos din Windows și aduce Chrome-ul pe tot ecranul.
                </p>
              </button>

              <button
                type="button"
                onClick={() => triggerBridgeEndpoint('test-pos-signal', 'Testul de semnal UART către POS a fost trimis.')}
                className="p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] hover:border-[#007AFF]/50 bg-[#F5F5F7] dark:bg-white/[0.04] text-left transition-all cursor-pointer"
              >
                <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">Testează Portul COM POS (UART)</div>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] m-0">
                  Trimite impuls ENQ pe <code className="text-[#007AFF]">{quickPort}</code> și verifică răspunsul ACK.
                </p>
              </button>

              <button
                type="button"
                onClick={() => runSilentCommand('mode')}
                className="p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] hover:border-[#007AFF]/50 bg-[#F5F5F7] dark:bg-white/[0.04] text-left transition-all cursor-pointer"
              >
                <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">Listează Porturile COM</div>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] m-0">
                  Rulează <code className="text-[#007AFF]">mode</code> în fundal și afișează porturile COM conectate.
                </p>
              </button>

              <button
                type="button"
                onClick={() => runSilentCommand('wmic printer get name,portname')}
                className="p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] hover:border-[#007AFF]/50 bg-[#F5F5F7] dark:bg-white/[0.04] text-left transition-all cursor-pointer"
              >
                <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">Vezi Imprimantele Instalate</div>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] m-0">
                  Afișează numele exact al imprimantei din Windows (ex. EPSON TM-T20).
                </p>
              </button>

              <button
                type="button"
                onClick={() => triggerBridgeEndpoint('resolve-duplicate', 'Instanțele dublură au fost închise.')}
                className="p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] hover:border-[#007AFF]/50 bg-[#F5F5F7] dark:bg-white/[0.04] text-left transition-all cursor-pointer"
              >
                <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">Curăță Procese Dublură Node.js</div>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] m-0">
                  Închide orice proces POS Bridge secundar care blochează portul COM.
                </p>
              </button>

              <button
                type="button"
                onClick={handleRebootPc}
                className="p-3.5 rounded-xl border border-[#FF3B30]/30 hover:border-[#FF3B30]/60 bg-[#FF3B30]/8 text-left transition-all cursor-pointer"
              >
                <div className="text-[12px] font-semibold text-[#FF3B30] mb-1">Restart Complet PC Windows</div>
                <p className="text-[11px] text-[#FF3B30]/80 m-0">
                  Execută <code className="font-mono font-semibold">shutdown /r /t 2 /f</code> — repornește calculatorul Windows.
                </p>
              </button>
            </div>

            {/* Consola CMD interactivă */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Administrator: Command Prompt (Silențios — windowsHide: true)</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyTerminalLogs}
                    className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
                    title="Copiază tot textul din consolă în clipboard"
                  >
                    {copiedTerminal ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copiat!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
                        <span>Copiază logurile</span>
                      </>
                    )}
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setTerminalLines([])}
                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer transition-colors"
                  >
                    Curăță ecranul
                  </button>
                </div>
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
                  className="px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
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
                  onClick={handleCopyBridgeLogs}
                  className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Copiază tot jurnalul POS Bridge în clipboard"
                >
                  {copiedBridgeLogs ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copiat!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiază Logul</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFile('pos-bridge.log')}
                  className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizează Log</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerBridgeEndpoint('restart-bridge', 'Comanda de restart POS Bridge a fost trimisă!')}
                  className="px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
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

