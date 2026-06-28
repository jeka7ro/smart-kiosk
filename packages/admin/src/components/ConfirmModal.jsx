import { createContext, useContext, useRef, useState, useCallback } from 'react';

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
        <div style={{
          position:'fixed', inset:0, zIndex:99999,
          background:'rgba(0,0,0,0.35)', backdropFilter:'blur(3px)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{
            background:'#ffffff',
            border:'1px solid #e2e8f0',
            borderRadius:'16px', padding:'32px 36px',
            minWidth:'320px', maxWidth:'440px',
            boxShadow:'0 8px 40px rgba(0,0,0,0.15)',
            color:'#1e293b', textAlign:'center',
          }}>
            <div style={{ fontSize:'2.2rem', marginBottom:'10px' }}>
              {state.opts?.icon || '⚠️'}
            </div>
            {state.opts?.title && (
              <h3 style={{ margin:'0 0 8px', fontSize:'1.05rem', fontWeight:700, color:'#0f172a' }}>
                {state.opts.title}
              </h3>
            )}
            <p style={{ margin:'0 0 24px', color:'#64748b', lineHeight:1.6, fontSize:'0.95rem' }}>
              {state.message}
            </p>
            <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
              <button onClick={handleCancel} style={{
                flex:1, padding:'10px 20px', borderRadius:'9px',
                border:'1px solid #e2e8f0',
                background:'#f8fafc', color:'#64748b',
                cursor:'pointer', fontSize:'0.9rem', fontWeight:500,
                transition:'background 0.15s',
              }}
              onMouseEnter={e => e.target.style.background='#f1f5f9'}
              onMouseLeave={e => e.target.style.background='#f8fafc'}
              >
                {state.opts?.cancelLabel || 'Anulează'}
              </button>
              <button onClick={handleOk} style={{
                flex:1, padding:'10px 20px', borderRadius:'9px', border:'none',
                background: state.opts?.danger ? '#ef4444' : '#6366f1',
                color:'#fff', cursor:'pointer', fontSize:'0.9rem', fontWeight:600,
                boxShadow: state.opts?.danger ? '0 2px 8px rgba(239,68,68,0.3)' : '0 2px 8px rgba(99,102,241,0.3)',
                transition:'opacity 0.15s',
              }}
              onMouseEnter={e => e.target.style.opacity='0.88'}
              onMouseLeave={e => e.target.style.opacity='1'}
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
