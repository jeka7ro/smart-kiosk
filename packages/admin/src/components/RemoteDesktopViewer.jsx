import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor,
  Play,
  Square,
  Maximize2,
  Minimize2,
  Send,
  Keyboard,
  ShieldCheck,
  RefreshCw,
  Wifi,
  AlertTriangle
} from 'lucide-react';

const QUALITY_PRESETS = {
  fast: { label: 'Rapid (960px)', maxWidth: 960, quality: 45, fps: 7 },
  normal: { label: 'Normal (1280px)', maxWidth: 1280, quality: 58, fps: 8 },
  hd: { label: 'Clar Full HD', maxWidth: 1920, quality: 74, fps: 6 },
};

const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || '');

const VK_MAP = {
  Backspace: { vk: 0x08 },
  Tab: { vk: 0x09 },
  Enter: { vk: 0x0D },
  NumpadEnter: { vk: 0x0D, ext: true },
  ShiftLeft: { vk: 0x10 },
  ShiftRight: { vk: 0x10 },
  ControlLeft: { vk: 0x11 },
  ControlRight: { vk: 0x11, ext: true },
  AltLeft: { vk: 0x12 },
  AltRight: { vk: 0x12, ext: true },
  Pause: { vk: 0x13 },
  CapsLock: { vk: 0x14 },
  Escape: { vk: 0x1B },
  Space: { vk: 0x20 },
  PageUp: { vk: 0x21, ext: true },
  PageDown: { vk: 0x22, ext: true },
  End: { vk: 0x23, ext: true },
  Home: { vk: 0x24, ext: true },
  ArrowLeft: { vk: 0x25, ext: true },
  ArrowUp: { vk: 0x26, ext: true },
  ArrowRight: { vk: 0x27, ext: true },
  ArrowDown: { vk: 0x28, ext: true },
  Insert: { vk: 0x2D, ext: true },
  Delete: { vk: 0x2E, ext: true },
  // Pe Mac mapăm Cmd la Ctrl pe Windows ca Cmd+C/V/A/Z să funcționeze natural
  MetaLeft: IS_MAC ? { vk: 0x11 } : { vk: 0x5B, ext: true },
  MetaRight: IS_MAC ? { vk: 0x11, ext: true } : { vk: 0x5C, ext: true },
  F1: { vk: 0x70 }, F2: { vk: 0x71 }, F3: { vk: 0x72 }, F4: { vk: 0x73 },
  F5: { vk: 0x74 }, F6: { vk: 0x75 }, F7: { vk: 0x76 }, F8: { vk: 0x77 },
  F9: { vk: 0x78 }, F10: { vk: 0x79 }, F11: { vk: 0x7A }, F12: { vk: 0x7B },
};

function resolveVkFromEvent(e) {
  if (VK_MAP[e.code]) return VK_MAP[e.code];
  if (e.code?.startsWith('Key') && e.code.length === 4) {
    return { vk: e.code.charCodeAt(3) };
  }
  if (e.code?.startsWith('Digit') && e.code.length === 6) {
    return { vk: e.code.charCodeAt(5) };
  }
  return null;
}

export default function RemoteDesktopViewer({
  socket,
  locId,
  locName,
  isOnline,
  isMaintenance,
  onToggleShield,
}) {
  const [presetKey, setPresetKey] = useState('normal');
  const [streaming, setStreaming] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [nativeRes, setNativeRes] = useState({ w: 1920, h: 1080 });
  const [stats, setStats] = useState({ fps: 0, kb: 0 });
  const [statusError, setStatusError] = useState(null);
  const [streamStale, setStreamStale] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const imgRef = useRef(null);
  const stageRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastBytesRef = useRef(0);
  const lastMoveSentRef = useRef(0);
  const nativeResRef = useRef({ w: 1920, h: 1080 });
  const streamingRef = useRef(false);
  const lastFrameAtRef = useRef(0);
  const lastKfReqRef = useRef(0);
  const presetKeyRef = useRef(presetKey);
  presetKeyRef.current = presetKey;

  const emitRd = useCallback((payload) => {
    if (!socket || !socket.connected || !locId) return;
    socket.emit('rd_control', { locationId: locId, ...payload });
  }, [socket, locId]);

  const startStream = useCallback((overridePresetKey = null) => {
    const key = overridePresetKey || presetKey;
    const preset = QUALITY_PRESETS[key] || QUALITY_PRESETS.normal;
    setStatusError(null);
    setStreamStale(false);
    lastFrameAtRef.current = 0;
    setStreaming(true);
    streamingRef.current = true;
    socket?.emit('rd_join', { locationId: locId });
    emitRd({
      action: 'start',
      maxWidth: preset.maxWidth,
      quality: preset.quality,
      fps: preset.fps,
    });
    setTimeout(() => stageRef.current?.focus(), 60);
  }, [presetKey, socket, locId, emitRd]);

  const stopStream = useCallback(() => {
    setStreaming(false);
    streamingRef.current = false;
    setStreamStale(false);
    setKeyboardFocused(false);
    emitRd({ action: 'stop' });
    socket?.emit('rd_leave', { locationId: locId });
  }, [emitRd, socket, locId]);

  useEffect(() => {
    if (!socket || !locId) return;
    setStreaming(false);
    streamingRef.current = false;
    setHasFrame(false);
    setStreamStale(false);
    lastFrameAtRef.current = 0;
    setStatusError(null);
    if (imgRef.current) imgRef.current.removeAttribute('src');
    socket.emit('rd_join', { locationId: locId });

    const onSocketConnect = () => {
      socket.emit('rd_join', { locationId: locId });
      if (streamingRef.current) {
        const preset = QUALITY_PRESETS[presetKeyRef.current] || QUALITY_PRESETS.normal;
        socket.emit('rd_control', {
          locationId: locId,
          action: 'start',
          maxWidth: preset.maxWidth,
          quality: preset.quality,
          fps: preset.fps,
        });
      }
    };

    const onFrame = (frame) => {
      if (!frame?.data) return;
      if (frame.w && frame.h && (nativeResRef.current.w !== frame.w || nativeResRef.current.h !== frame.h)) {
        nativeResRef.current = { w: frame.w, h: frame.h };
        setNativeRes({ w: frame.w, h: frame.h });
      }
      if (imgRef.current) {
        imgRef.current.src = `data:image/jpeg;base64,${frame.data}`;
      }
      lastFrameAtRef.current = Date.now();
      frameCountRef.current += 1;
      lastBytesRef.current = Math.round((frame.data.length * 0.75) / 1024);
      setHasFrame(true);
      setStreamStale(false);
      setStatusError(null);
    };

    const onStatus = (st) => {
      if (!st) return;
      if (st.width && st.height) {
        nativeResRef.current = { w: st.width, h: st.height };
        setNativeRes({ w: st.width, h: st.height });
      }
      if (st.error) {
        setStatusError(st.error);
        setStreaming(false);
        streamingRef.current = false;
        setStreamStale(false);
        return;
      }
      if (st.active === false) {
        setStreaming(false);
        streamingRef.current = false;
        setStreamStale(false);
        if (st.reason === 'viewer_timeout') {
          setStatusError('Sesiunea Desktop Live s-a închis automat din lipsă de activitate.');
        } else if (st.reason === 'bridge_disconnected' || st.reason === 'socket_disconnect' || st.reason === 'agent_exit') {
          setStatusError('Conexiunea Desktop Live s-a întrerupt (POS Bridge offline sau agent oprit).');
        }
      }
    };

    socket.on('connect', onSocketConnect);
    socket.on('rd_frame', onFrame);
    socket.on('rd_status', onStatus);

    const statsTimer = setInterval(() => {
      const fps = frameCountRef.current;
      frameCountRef.current = 0;
      setStats({ fps, kb: lastBytesRef.current });
    }, 1000);

    return () => {
      clearInterval(statsTimer);
      socket.off('connect', onSocketConnect);
      socket.off('rd_frame', onFrame);
      socket.off('rd_status', onStatus);
      if (streamingRef.current) {
        socket.emit('rd_control', { locationId: locId, action: 'stop' });
      }
      socket.emit('rd_leave', { locationId: locId });
    };
  }, [socket, locId]);

  useEffect(() => {
    if (!isOnline && streamingRef.current) {
      setStreaming(false);
      streamingRef.current = false;
      setStreamStale(false);
      setStatusError('PC-ul a devenit offline — fluxul Desktop Live s-a oprit.');
    }
  }, [isOnline]);

  // Keepalive + detectare îngheț + anti-throttling la schimbare tab / fereastră
  useEffect(() => {
    if (!streaming) return;
    const sendAlive = (withKf = false) => {
      emitRd({ action: 'ping' });
      if (withKf) emitRd({ action: 'keyframe' });
    };
    const pingTimer = setInterval(() => {
      emitRd({ action: 'ping' });
      const lastTs = lastFrameAtRef.current;
      const now = Date.now();
      if (lastTs > 0 && now - lastTs > 6000) {
        setStreamStale(true);
        if (now - lastKfReqRef.current > 6000) {
          lastKfReqRef.current = now;
          emitRd({ action: 'keyframe' });
        }
      }
    }, 5000);
    const noFrameTimer = setTimeout(() => {
      if (!imgRef.current?.getAttribute('src')) {
        setStatusError('Nu a sosit încă niciun cadru. Asigură-te că PC-ul este online și are ultimul update POS Bridge (butonul „Update cod”).');
      }
    }, 5500);
    const onVisibility = () => {
      if (!document.hidden) sendAlive(true);
    };
    const onFocus = () => sendAlive(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(pingTimer);
      clearTimeout(noFrameTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [streaming, emitRd]);

  const getNormCoords = useCallback((clientX, clientY) => {
    const el = imgRef.current;
    if (!el) return { nx: 0.5, ny: 0.5 };
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return { nx: 0.5, ny: 0.5 };

    const { w, h } = nativeResRef.current;
    const imgRatio = (w || 1920) / (h || 1080);
    const boxRatio = rect.width / rect.height;

    let renderW, renderH, offsetX, offsetY;
    if (boxRatio > imgRatio) {
      renderH = rect.height;
      renderW = renderH * imgRatio;
      offsetX = (rect.width - renderW) / 2;
      offsetY = 0;
    } else {
      renderW = rect.width;
      renderH = renderW / imgRatio;
      offsetX = 0;
      offsetY = (rect.height - renderH) / 2;
    }

    const nx = Math.max(0, Math.min(1, (clientX - rect.left - offsetX) / renderW));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top - offsetY) / renderH));
    return { nx, ny };
  }, []);

  // Scroll nativ cu passive: false pentru a nu scrola pagina Admin în spate
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !streaming) return;
    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { nx, ny } = getNormCoords(e.clientX, e.clientY);
      const delta = e.deltaY > 0 ? -120 : 120;
      emitRd({ action: 'mouse', type: 'wheel', delta, nx, ny });
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [streaming, getNormCoords, emitRd]);

  const mapButton = (btn) => (btn === 2 ? 'right' : btn === 1 ? 'middle' : 'left');

  const handlePointerDown = (e) => {
    if (!streaming) return;
    e.preventDefault();
    stageRef.current?.focus();
    setKeyboardFocused(true);
    try {
      if (e.button === 0) e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    const { nx, ny } = getNormCoords(e.clientX, e.clientY);
    emitRd({ action: 'mouse', type: 'down', button: mapButton(e.button), nx, ny });
  };

  const handlePointerUp = (e) => {
    if (!streaming) return;
    e.preventDefault();
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
    const { nx, ny } = getNormCoords(e.clientX, e.clientY);
    emitRd({ action: 'mouse', type: 'up', button: mapButton(e.button), nx, ny });
  };

  const handlePointerMove = (e) => {
    if (!streaming) return;
    const now = Date.now();
    const minInterval = e.buttons > 0 ? 35 : 65;
    if (now - lastMoveSentRef.current < minInterval) return;
    lastMoveSentRef.current = now;
    const { nx, ny } = getNormCoords(e.clientX, e.clientY);
    emitRd({ action: 'mouse', type: 'move', nx, ny });
  };

  const handleKeyDown = (e) => {
    if (!streaming || !keyboardFocused) return;
    if (IS_MAC && (e.code === 'MetaLeft' || e.code === 'MetaRight')) return;

    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    const vkInfo = resolveVkFromEvent(e);

    if (!hasModifier && e.key && e.key.length === 1 && e.code !== 'Space' && !e.code?.startsWith('F')) {
      e.preventDefault();
      e.stopPropagation();
      emitRd({ action: 'text', text: e.key });
      return;
    }
    if (vkInfo) {
      e.preventDefault();
      e.stopPropagation();
      if (IS_MAC && e.metaKey) {
        emitRd({ action: 'hotkey', vks: [0x11, vkInfo.vk] });
        return;
      }
      emitRd({ action: 'key', vk: vkInfo.vk, down: true, ext: Boolean(vkInfo.ext) });
    }
  };

  const handleKeyUp = (e) => {
    if (!streaming || !keyboardFocused) return;
    if (IS_MAC && (e.code === 'MetaLeft' || e.code === 'MetaRight' || e.metaKey)) return;

    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    if (!hasModifier && e.key && e.key.length === 1 && e.code !== 'Space' && !e.code?.startsWith('F')) {
      return;
    }
    const vkInfo = resolveVkFromEvent(e);
    if (vkInfo) {
      e.preventDefault();
      e.stopPropagation();
      emitRd({ action: 'key', vk: vkInfo.vk, down: false, ext: Boolean(vkInfo.ext) });
    }
  };

  const handleSendPasteText = (e) => {
    e.preventDefault();
    if (!pasteText || !streaming) return;
    emitRd({ action: 'text', text: pasteText });
    setPasteText('');
    stageRef.current?.focus();
  };

  const containerCls = isExpanded
    ? 'fixed inset-3 z-[70] bg-slate-950 rounded-2xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden p-3 space-y-2.5'
    : 'p-4 flex-1 flex flex-col space-y-3 overflow-hidden';

  return (
    <div className={containerCls}>
      {/* Bara de control Desktop Live */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 flex-wrap">
          {!streaming ? (
            <button
              type="button"
              onClick={() => startStream()}
              disabled={!isOnline}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Conectează Desktop Live</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopStream}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Oprește Stream</span>
            </button>
          )}

          <select
            value={presetKey}
            onChange={(e) => {
              const next = e.target.value;
              setPresetKey(next);
              if (streaming) startStream(next);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            {Object.entries(QUALITY_PRESETS).map(([k, p]) => (
              <option key={k} value={k}>{p.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={onToggleShield}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              isMaintenance
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50'
            }`}
            title="Pune paravanul KIOSK ÎN MENTENANȚĂ pe ecranul fizic din restaurant; tu lucrezi transparent prin el!"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isMaintenance ? 'Paravan: ACTIV' : 'Paravan Mentenanță'}</span>
          </button>

          {streaming && (
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { label: 'Win+D', vks: [0x5B, 0x44], title: 'Minimizează toate ferestrele (Desktop)' },
                { label: 'Alt+Tab', vks: [0x12, 0x09], title: 'Comută între ferestre' },
                { label: 'TaskMgr', vks: [0x11, 0x10, 0x1B], title: 'Ctrl+Shift+Esc (Task Manager)' },
                { label: 'Alt+F4', vks: [0x12, 0x73], title: 'Închide fereastra activă' },
              ].map(hk => (
                <button
                  key={hk.label}
                  type="button"
                  title={hk.title}
                  onClick={() => {
                    emitRd({ action: 'hotkey', vks: hk.vks });
                    stageRef.current?.focus();
                  }}
                  className="px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 cursor-pointer"
                >
                  {hk.label}
                </button>
              ))}
              <button
                type="button"
                title="Cere cadru proaspăt"
                onClick={() => emitRd({ action: 'keyframe' })}
                className="p-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-indigo-500 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 text-[11px] font-medium">
          {streaming && (
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-bold ${
              streamStale
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            }`}>
              <Wifi className="w-3 h-3" />
              {nativeRes.w}×{nativeRes.h} · {streamStale ? 'Semnal înghețat...' : `${stats.fps} FPS · ${stats.kb} KB`}
            </span>
          )}
          {streaming && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-bold ${
              keyboardFocused
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              <Keyboard className="w-3 h-3" />
              {keyboardFocused ? 'Tastatură: Activă' : 'Click pe ecran pt tastatură'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(v => !v)}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-indigo-400 cursor-pointer"
            title={isExpanded ? 'Micșorează fereastra' : 'Extinde viewer-ul pe tot ecranul'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Eroare / Atenționare */}
      {statusError && (
        <div className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      {/* Suprafața interactivă a ecranului Windows */}
      <div
        ref={stageRef}
        tabIndex={0}
        onFocus={() => setKeyboardFocused(true)}
        onBlur={() => setKeyboardFocused(false)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none', userSelect: 'none' }}
        className={`relative flex-1 min-h-[340px] rounded-xl bg-slate-950 border overflow-hidden flex items-center justify-center outline-none transition-shadow ${
          keyboardFocused && streaming
            ? 'border-indigo-500 ring-2 ring-indigo-500/40 cursor-crosshair'
            : 'border-slate-800'
        }`}
      >
        <img
          ref={imgRef}
          alt={`Ecran live ${locName}`}
          draggable={false}
          className={`w-full h-full object-contain pointer-events-none ${hasFrame ? 'block' : 'hidden'}`}
        />

        {!hasFrame && (
          <div className="text-center px-6 max-w-md space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Monitor className="w-7 h-7" />
            </div>
            <div className="text-sm font-bold text-white">
              {streaming
                ? `Se deschide sesiunea Desktop Live pe ${locName}...`
                : `Desktop Live (AnyDesk integrat) — ${locName}`}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Vezi în timp real ecranul Windows, dai click stânga/dreapta, scroll, drag și scrii de la tastatură direct din Admin. Folosește <b>Paravan Mentenanță</b> dacă vrei să lucrezi fără ca clienții să vadă desktopul.
            </p>
            {!streaming && (
              <button
                type="button"
                onClick={() => startStream()}
                disabled={!isOnline}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isOnline ? 'Pornește Ecranul Live' : 'PC-ul este offline'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bară rapidă pentru trimis text / parole / comenzi (indiferent de layout tastatură) */}
      {streaming && (
        <form onSubmit={handleSendPasteText} className="flex items-center gap-2">
          <input
            type="text"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onFocus={() => setKeyboardFocused(false)}
            placeholder="Scrie text, cale folder (ex: C:\SmartKiosk) sau parolă pentru a o tasta instant în câmpul activ pe Windows..."
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <button
            type="submit"
            disabled={!pasteText}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Trimite Text</span>
          </button>
        </form>
      )}
    </div>
  );
}
