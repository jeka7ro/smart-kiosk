import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

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
        <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-[360px] shadow-2xl text-center flex flex-col items-center">
            <div className="mb-3">
              {state.opts?.icon && typeof state.opts.icon !== 'string' ? (
                state.opts.icon
              ) : state.opts?.danger ? (
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <Trash2 size={24} strokeWidth={2} />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AlertTriangle size={24} strokeWidth={2} />
                </div>
              )}
            </div>
            {state.opts?.title && (
              <h3 className="m-0 mb-2 text-lg font-bold text-slate-900 dark:text-white">
                {state.opts.title}
              </h3>
            )}
            <div className="m-0 mb-6 text-slate-500 dark:text-slate-400 leading-relaxed text-[0.95rem]">
              {state.message}
            </div>
            <div className="flex gap-3 justify-center">
              {!state.opts?.hideCancel && (
                <button 
                  onClick={handleCancel}
                  className="flex-1 py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[0.9rem] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  {state.opts?.cancelLabel || 'Anulează'}
                </button>
              )}
              <button 
                onClick={handleOk}
                className={`flex-1 py-2.5 px-5 rounded-xl border-none text-white text-[0.9rem] font-semibold shadow-lg hover:opacity-90 transition-opacity ${
                  state.opts?.danger ? 'bg-red-500 shadow-red-500/30' : 'bg-indigo-500 shadow-indigo-500/30'
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
