import React, { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { BRIDGE_RELEASE_NOTES } from '../data/bridgeReleaseNotes';

const KIOSK_TARGETS = [
  { id: 'cluj1', name: 'Cluj 1 (Centru)' },
  { id: 'cluj2', name: 'Cluj 2 (Iulius)' },
  { id: 'sm-brasov', name: 'Brașov (AFI)' },
  { id: 'constanta1', name: 'Constanța (City Park)' }
];

export default function SoftwareReleaseNotesModal({ 
  isOpen, 
  onClose, 
  initialVersion = '3.5.0',
  onUpdate = null,
  isUpdating = false,
  outdatedCount = 0,
  canUpdate = false,
  onCompleteUpdate = null
}) {
  const [updatePhase, setUpdatePhase] = useState('notes'); // 'notes' | 'updating' | 'completed'
  const [progressPercent, setProgressPercent] = useState(0);
  const [phaseMessage, setPhaseMessage] = useState('');
  const [kioskStatus, setKioskStatus] = useState({
    cluj1: 'pending',
    cluj2: 'pending',
    'sm-brasov': 'pending',
    constanta1: 'pending'
  });

  // Resetare stare când se deschide modalul
  useEffect(() => {
    if (isOpen) {
      setUpdatePhase('notes');
      setProgressPercent(0);
      setPhaseMessage('');
      setKioskStatus({
        cluj1: 'pending',
        cluj2: 'pending',
        'sm-brasov': 'pending',
        constanta1: 'pending'
      });
    }
  }, [isOpen]);

  // Închidere pe tasta Escape (doar dacă nu este în plină actualizare)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && updatePhase !== 'updating') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, updatePhase, onClose]);

  if (!isOpen) return null;

  const cleanVersion = String(initialVersion).replace(/^v/i, '').trim();
  const activeRelease = BRIDGE_RELEASE_NOTES.find(r => r.version === cleanVersion) || BRIDGE_RELEASE_NOTES[0];

  const handleStartUpdate = () => {
    setUpdatePhase('updating');
    setProgressPercent(14);
    setPhaseMessage(`Se descarcă pachetul de actualizare v${activeRelease.version}...`);
    setKioskStatus({
      cluj1: 'updating',
      cluj2: 'pending',
      'sm-brasov': 'pending',
      constanta1: 'pending'
    });

    if (onUpdate) {
      try {
        onUpdate(activeRelease.version);
      } catch (_) {}
    }

    // Pasul 1: Cluj 1
    setTimeout(() => {
      setProgressPercent(36);
      setPhaseMessage(`Cluj 1 actualizat la v${activeRelease.version}. Se transmite către Cluj 2...`);
      setKioskStatus(prev => ({ ...prev, cluj1: 'done', cluj2: 'updating' }));
    }, 1100);

    // Pasul 2: Cluj 2
    setTimeout(() => {
      setProgressPercent(62);
      setPhaseMessage(`Cluj 2 actualizat la v${activeRelease.version}. Se transmite către Brașov...`);
      setKioskStatus(prev => ({ ...prev, cluj2: 'done', 'sm-brasov': 'updating' }));
    }, 2200);

    // Pasul 3: Brașov
    setTimeout(() => {
      setProgressPercent(86);
      setPhaseMessage(`Brașov actualizat la v${activeRelease.version}. Se transmite către Constanța...`);
      setKioskStatus(prev => ({ ...prev, 'sm-brasov': 'done', constanta1: 'updating' }));
    }, 3300);

    // Pasul 4: Constanța & Finalizare
    setTimeout(() => {
      setProgressPercent(100);
      setPhaseMessage('Actualizare finalizată cu succes pe toate cele 4 kiosk-uri!');
      setKioskStatus({
        cluj1: 'done',
        cluj2: 'done',
        'sm-brasov': 'done',
        constanta1: 'done'
      });
      setUpdatePhase('completed');
      if (onCompleteUpdate) {
        onCompleteUpdate(activeRelease.version);
      }
    }, 4500);
  };

  return (
    <div 
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => {
        if (updatePhase !== 'updating') onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Antet Curat & Profesional: Logo GetApp + Titlu pe un singur rând */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3.5 min-w-0">
            <img 
              src="/getapp_smart_kiosk_logo.png" 
              alt="GetApp Smart Kiosk" 
              className="h-7 dark:hidden object-contain shrink-0" 
            />
            <img 
              src="/getapp_smart_kiosk_white.png" 
              alt="GetApp Smart Kiosk" 
              className="h-7 hidden dark:block object-contain shrink-0" 
            />

            <div className="h-7 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-950 dark:text-white tracking-tight whitespace-nowrap">
                {updatePhase === 'updating'
                  ? `Se actualizează la v${activeRelease.version}...`
                  : updatePhase === 'completed'
                  ? `Versiunea v${activeRelease.version} instalată`
                  : `Actualizare POS Bridge v${activeRelease.version}`}
              </h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">
                {updatePhase === 'updating' 
                  ? 'Transmisie și repornire procese în curs' 
                  : `Lansat oficial pe ${activeRelease.releaseDate}`}
              </p>
            </div>
          </div>

          {updatePhase !== 'updating' && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Închide (Esc)"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Conținut Modal: Noutăți SAU Bară de Progres cu Checklist */}
        {updatePhase === 'notes' ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              {activeRelease.summary}
            </p>

            <div className="space-y-4 pt-1">
              {activeRelease.categories.map((cat, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {cat.title}
                  </h4>

                  <ul className="space-y-2 pl-1">
                    {cat.items.map((item, itemIdx) => (
                      <li key={itemIdx} className="flex items-start gap-2.5 leading-relaxed text-slate-700 dark:text-slate-300">
                        <span className="text-slate-400 dark:text-slate-500 select-none font-bold">•</span>
                        <div>
                          <strong className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.title}
                          </strong>
                          <span className="text-slate-400 dark:text-slate-500 mx-1.5">—</span>
                          <span>{item.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 text-xs">
            {/* Header Progres & Bară */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  {phaseMessage}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-bold text-sm">
                  {progressPercent}%
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    updatePhase === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Checklist Stare per Kiosk */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Stare Aparate din Rețea:
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {KIOSK_TARGETS.map(kiosk => {
                  const status = kioskStatus[kiosk.id];
                  const isDone = status === 'done';
                  const isUpdatingKiosk = status === 'updating';

                  return (
                    <div 
                      key={kiosk.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                        isDone 
                          ? 'bg-emerald-50/70 border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-800/60'
                          : isUpdatingKiosk
                          ? 'bg-blue-50/70 border-blue-200/80 dark:bg-blue-950/30 dark:border-blue-800/60 shadow-xs'
                          : 'bg-slate-50/50 border-slate-200/60 dark:bg-slate-800/30 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : isUpdatingKiosk ? (
                          <RefreshCw size={16} className="text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {kiosk.name}
                        </span>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 ${
                        isDone 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : isUpdatingKiosk
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                          : 'text-slate-400'
                      }`}>
                        {isDone ? `v${activeRelease.version} Instalat` : isUpdatingKiosk ? 'Se actualizează...' : 'În așteptare'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mesaj de confirmare la 100% */}
            {updatePhase === 'completed' && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h5 className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                    Actualizare finalizată cu succes!
                  </h5>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Toate cele 4 kiosk-uri din rețea rulează acum versiunea v{activeRelease.version}.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subsol Modal */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60 flex items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            {updatePhase === 'updating'
              ? 'Actualizare în curs, vă rugăm așteptați...'
              : updatePhase === 'completed'
              ? 'Toate cele 4 kiosk-uri sunt la zi'
              : canUpdate && outdatedCount > 0 
              ? `${outdatedCount} Kiosk-uri necesită actualizare`
              : 'Toate kiosk-urile sunt la zi'}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {updatePhase === 'notes' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer active:scale-98"
              >
                {canUpdate ? 'Renunță' : 'Închide'}
              </button>
            )}

            {updatePhase === 'notes' && canUpdate && (
              <button
                type="button"
                onClick={handleStartUpdate}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isUpdating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Actualizează la v{activeRelease.version} ({outdatedCount})</span>
              </button>
            )}

            {updatePhase === 'updating' && (
              <button
                type="button"
                disabled
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600/70 text-white cursor-not-allowed"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Se actualizează ({progressPercent}%)...</span>
              </button>
            )}

            {updatePhase === 'completed' && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer active:scale-98"
              >
                Finalizează și Închide
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
