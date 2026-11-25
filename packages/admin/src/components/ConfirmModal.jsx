import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, HelpCircle, AlertCircle, Info, RefreshCw } from 'lucide-react';

/* Iconiță pentru dialogurile de restart/reîncărcare (în loc de coșul de gunoi) */
export function RestartDialogIcon() {
  return (
    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
      <RefreshCw size={24} strokeWidth={2} />
    </div>
  );
}

/* ── Context ──────────────────────────────────────────────────────────────── */
const ConfirmCtx = createContext(null);

/* ── Provider  ───────────────────────────────────────────────────────────── */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((message, opts = {}) =>
    new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message, opts });
    }), []);

  const handleOk     = () => { setState(null); resolveRef.current?.(true);  };
  const handleCancel = () => { setState(null); resolveRef.current?.(false); };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="apple-modal p-6 w-full max-w-[360px] text-center flex flex-col items-center animate-in zoom-in-95 duration-150">
            <div className="mb-3.5">
              {state.opts?.icon && typeof state.opts.icon !== 'string' ? (
                state.opts.icon
              ) : state.opts?.type === 'info' ? (
                <div className="w-13 h-13 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Info size={26} strokeWidth={2.2} />
                </div>
              ) : state.opts?.type === 'error' || state.opts?.hideCancel ? (
                <div className="w-13 h-13 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <AlertCircle size={26} strokeWidth={2.2} />
                </div>
              ) : state.opts?.danger ? (
                <div className="w-13 h-13 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <Trash2 size={26} strokeWidth={2.2} />
                </div>
              ) : (
                <div className="w-13 h-13 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <AlertTriangle size={26} strokeWidth={2.2} />
                </div>
              )}
            </div>
            {state.opts?.title && (
              <h3 className="m-0 mb-1.5 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                {state.opts.title}
              </h3>
            )}
            <div className="m-0 mb-6 text-slate-500 dark:text-slate-400 leading-relaxed text-[13px] font-normal">
              {state.message}
            </div>
            <div className="flex gap-2.5 justify-center w-full">
              {!state.opts?.hideCancel && (
                <button
                  onClick={handleCancel}
                  className="apple-btn-secondary flex-1 py-2.5 px-4 text-[13px]"
                >
                  {state.opts?.cancelLabel || 'Anulează'}
                </button>
              )}
              <button
                onClick={handleOk}
                className={`flex-1 py-2.5 px-4 rounded-full text-white text-[13px] font-semibold transition-all cursor-pointer ${
                  state.opts?.danger
                    ? 'bg-[#FF3B30] hover:bg-[#E0352B]'
                    : 'bg-[#007AFF] hover:bg-[#0066D6]'
                }`}
              >
                {state.opts?.okLabel || 'Confirmă'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */
export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

export default useConfirm;
