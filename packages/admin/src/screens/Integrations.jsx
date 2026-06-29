import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';
import IntegrationDetail from './IntegrationDetail';

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const PAGE_SIZE = 25;

const STATUS_STYLE = {
  active:  { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Activ' },
  error:   { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', label: 'Eroare' },
  pending: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Nou' },
};

const EMPTY_FORM = { name: '', provider: '', brand_id: '', location_id: '', credentials: {} };

// Real logos via Google Favicon API (uses each POS system's official domain)
const PROVIDER_LOGOS = {
  syrve:   'https://www.google.com/s2/favicons?domain=syrve.com&sz=128',
  freya:   'https://www.google.com/s2/favicons?domain=freyapos.ro&sz=128',
  boogit:  'https://www.google.com/s2/favicons?domain=boogit.ro&sz=128',
  ebriza:  'https://www.google.com/s2/favicons?domain=ebriza.com&sz=128',
  posnet:  'https://www.google.com/s2/favicons?domain=posnet.ro&sz=128',
  custom:  null, // no logo for generic
};

export default function Integrations() {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [integrations, setIntegrations] = useState([]);
  const [providers,    setProviders]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [editId,       setEditId]       = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [testing,      setTesting]      = useState(null);
  const [testResult,   setTestResult]   = useState(null);
  const [syncing,      setSyncing]      = useState(null);
  const [selected,     setSelected]     = useState(new Set());
  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [toast,        setToast]        = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [iRes, pRes] = await Promise.all([
        fetchWithAuth(`${BACKEND}/api/integrations`),
        fetchWithAuth(`${BACKEND}/api/integrations/providers/list`),
      ]);
      const iData = await iRes.json();
      const pData = await pRes.json();
      setIntegrations(iData.integrations || []);
      setProviders(pData.providers || []);
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const currentProvider = providers.find(p => p.key === form.provider);

  // Filtered + paginated
  const filtered = useMemo(() =>
    integrations.filter(i =>
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.provider?.toLowerCase().includes(search.toLowerCase()) ||
      i.brand_id?.toLowerCase().includes(search.toLowerCase())
    ), [integrations, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allSel     = pageItems.length > 0 && pageItems.every(i => selected.has(i.id));

  const toggleAll = () => setSelected(prev => { const n = new Set(prev); allSel ? pageItems.forEach(i => n.delete(i.id)) : pageItems.forEach(i => n.add(i.id)); return n; });
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setTestResult(null);
    setModal(true);
  };

  const openEdit = async (integ) => {
    try {
      const res  = await fetchWithAuth(`${BACKEND}/api/integrations/${integ.id}`);
      const data = await res.json();
      const item = data.integration;
      setForm({ name: item.name, provider: item.provider, brand_id: item.brand_id || '', location_id: item.location_id || '', credentials: item.credentials || {} });
      setEditId(item.id);
      setTestResult(null);
      setModal(true);
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const closeModal = () => { setModal(false); setForm(EMPTY_FORM); setEditId(null); setTestResult(null); };

  const setCredField = (key, value) => setForm(prev => ({ ...prev, credentials: { ...prev.credentials, [key]: value } }));

  const save = async () => {
    if (!form.name || !form.provider) return showToast('Nume și Provider obligatorii', 'err');
    setSaving(true);
    try {
      const url    = editId ? `${BACKEND}/api/integrations/${editId}` : `${BACKEND}/api/integrations`;
      const method = editId ? 'PUT' : 'POST';
      const res    = await fetchWithAuth(url, { method, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(editId ? '✅ Integrare actualizată!' : '✅ Integrare adăugată!');
      closeModal(); fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setSaving(false); }
  };

  const testConnection = async (id) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res  = await fetchWithAuth(`${BACKEND}/api/integrations/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { setTestResult({ ok: true, msg: data.detail }); showToast('✅ ' + data.detail); }
      else { setTestResult({ ok: false, msg: data.error }); showToast('❌ ' + data.error, 'err'); }
    } catch (e) { setTestResult({ ok: false, msg: e.message }); showToast('❌ ' + e.message, 'err'); }
    finally { setTesting(null); fetchAll(); }
  };

  const syncMenu = async (id, name) => {
    setSyncing(id);
    try {
      const res  = await fetchWithAuth(`${BACKEND}/api/integrations/${id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) showToast(`🔄 ${data.detail}`);
      else showToast('❌ ' + data.error, 'err');
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setSyncing(null); fetchAll(); }
  };

  const deleteOne = async (integ) => {
    const ok = await confirm(`Ștergi integrarea „${integ.name}"?`, { title: 'Confirmare ștergere', icon: '🗑️', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/integrations/${integ.id}`, { method: 'DELETE' });
      showToast('🗑 Șters'); fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    const ok = await confirm(`Ștergi ${selected.size} integrări?`, { title: 'Confirmare ștergere multiple', icon: '🗑️', okLabel: 'Șterge tot', danger: true });
    if (!ok) return;
    try {
      await Promise.all([...selected].map(id => fetchWithAuth(`${BACKEND}/api/integrations/${id}`, { method: 'DELETE' })));
      setSelected(new Set()); showToast(`🗑 ${selected.size} integrări șterse`); fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const importSyrve = async () => {
    try {
      const res  = await fetchWithAuth(`${BACKEND}/api/integrations/import-from-env`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) { showToast(`✅ ${data.detail}`); fetchAll(); }
      else showToast('❌ ' + (data.error || 'Eroare import'), 'err');
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const providerMeta = (key) => providers.find(p => p.key === key) || { label: key, color: '#6b7280' };

  if (selectedDetail) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <IntegrationDetail 
          integ={selectedDetail} 
          onBack={() => { setSelectedDetail(null); fetchAll(); }}
          onTest={testConnection}
          onSync={syncMenu}
          testing={testing}
          syncing={syncing}
        />
        {toast && (
          <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-2xl text-sm font-bold shadow-xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <input 
            className="w-full pl-11 pr-16 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow shadow-sm"
            placeholder="Caută integrare..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }} 
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          {search && (
            <span className="absolute right-1 top-1 bottom-1 flex items-center justify-center bg-blue-600 text-white rounded-full px-3 text-xs font-bold pointer-events-none">
              {filtered.length}/{integrations.length}
            </span>
          )}
        </div>
        
        {selected.size > 0 ? (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 px-4 h-11 rounded-full border border-red-100 dark:border-red-900/50">
            <span className="text-red-600 dark:text-red-400 text-sm font-bold">{selected.size} selectate</span>
            <button className="px-4 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all" onClick={bulkDelete}>Șterge ({selected.size})</button>
            <button className="px-4 h-8 rounded-full bg-white/50 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 text-xs font-bold transition-colors" onClick={() => setSelected(new Set())}>Deselectează</button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button className="px-5 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors flex items-center gap-2" onClick={importSyrve} title="Import Syrve">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Import Syrve
            </button>
            <button className="px-6 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all flex items-center gap-2" onClick={openAdd}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Adaugă Integrare
            </button>
          </div>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
           <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
           <span className="text-slate-500 text-sm font-medium">Se încarcă...</span>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 w-12 text-center">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={allSel} onChange={toggleAll} />
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nume Integrare</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Provider POS</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Brand</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Ultima Sincronizare</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pageItems.map((integ, i) => {
                  const pm = providerMeta(integ.provider);
                  const st = STATUS_STYLE[integ.status] || STATUS_STYLE.pending;
                  return (
                    <tr key={integ.id} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected.has(integ.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={selected.has(integ.id)} onChange={() => toggleOne(integ.id)} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-medium">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3">
                        <strong
                          className="cursor-pointer text-blue-600 dark:text-blue-400 font-bold hover:underline"
                          onClick={() => setSelectedDetail(integ)}
                        >{integ.name}</strong>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                          {PROVIDER_LOGOS[integ.provider]
                            ? <img src={PROVIDER_LOGOS[integ.provider]} alt={pm.label} className="w-4 h-4 rounded object-contain shrink-0 bg-white" onError={e => { e.target.style.display='none'; }} />
                            : <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pm.color }} />
                          }
                          {pm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {integ.brand_id ? (
                          <div className="flex items-center gap-2">
                            <img src={`/brands/${integ.brand_id.toLowerCase()}-logo.png`} alt={integ.brand_id} className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-white shadow-sm" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                            <span className="hidden text-xs font-bold text-slate-500 uppercase">{integ.brand_id}</span>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border" style={{ backgroundColor: st.bg, color: st.color, borderColor: st.color.replace(')', ', 0.2)').replace('rgb', 'rgba') }}>
                          {st.label}
                        </span>
                        {integ.status === 'error' && integ.last_error && (
                          <div className="text-[11px] text-red-500 mt-1 max-w-[200px] truncate" title={integ.last_error}>
                            {integ.last_error}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {integ.last_sync_at
                          ? new Date(integ.last_sync_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button title="Editează" onClick={() => openEdit(integ)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </button>
                          {/* Test */}
                          <button title="Test conexiune" disabled={testing === integ.id} onClick={() => testConnection(integ.id)}
                            className={`w-8 h-8 inline-flex items-center justify-center rounded-full transition-colors ${testing === integ.id ? 'bg-slate-100 text-slate-400 dark:bg-slate-800' : 'bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 dark:text-amber-500'}`}>
                            {testing === integ.id
                              ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 13 9 20 9"/><path d="M3 21L13 11 17 15 21 11M7 11L3 21"/></svg>
                            }
                          </button>
                          {/* Sync */}
                          <button title="Sincronizează meniu" disabled={syncing === integ.id} onClick={() => syncMenu(integ.id, integ.name)}
                            className={`w-8 h-8 inline-flex items-center justify-center rounded-full transition-colors ${syncing === integ.id ? 'bg-slate-100 text-slate-400 dark:bg-slate-800' : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-600 dark:bg-cyan-900/20 dark:hover:bg-cyan-900/40 dark:text-cyan-500'}`}>
                            {syncing === integ.id
                               ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                               : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            }
                          </button>
                          {/* Delete */}
                          <button title="Șterge" onClick={() => deleteOne(integ)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-500 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageItems.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="text-4xl mb-4">🔌</div>
                      <div className="text-slate-900 dark:text-white font-bold mb-2">Nicio integrare configurată</div>
                      <div className="text-slate-500 text-sm">Adaugă primul POS pentru a conecta meniul și comenzile</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} din {filtered.length}
          </span>
          <div className="flex gap-1.5">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium" disabled={page===1} onClick={() => setPage(1)}>«</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium" disabled={page===1} onClick={() => setPage(p => p-1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k+1)
              .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=2)
              .map((p, idx, arr) => (
                <React.Fragment key={`frag-${p}`}>
                  {idx>0 && arr[idx-1]!==p-1 && <span key={`e${p}`} className="px-2 py-1 text-slate-400">…</span>}
                  <button key={p} className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg border font-bold transition-colors ${p === page ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`} onClick={() => setPage(p)}>{p}</button>
                </React.Fragment>
              ))}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium" disabled={page===totalPages} onClick={() => setPage(p => p+1)}>›</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium" disabled={page===totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ───────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto" onClick={closeModal}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[24px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white m-0 leading-tight">{editId ? 'Editează Integrare' : 'Adaugă Integrare POS'}</h3>
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 transition-colors" onClick={closeModal}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[70vh]">
              {/* Base fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <label className="col-span-1 sm:col-span-2 block">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nume afișat *</span>
                  <input className="w-full px-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder='ex: "SmashMe - Syrve Brașov"' />
                </label>

                <label className="col-span-1 sm:col-span-2 block">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Provider POS *</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {providers.map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, provider: p.key, credentials: {} }))}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${form.provider === p.key ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                      >
                        {PROVIDER_LOGOS[p.key]
                          ? <img src={PROVIDER_LOGOS[p.key]} alt={p.label} className="w-5 h-5 rounded bg-white object-contain" onError={e => { e.target.style.display='none'; }} />
                          : <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-white font-bold bg-slate-500">?</span>
                        }
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {currentProvider && (
                    <p className="text-sm text-slate-500 mt-2 m-0">{currentProvider.description}</p>
                  )}
                </label>

                <label className="block">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Brand ID (kiosk)</span>
                  <input className="w-full px-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" value={form.brand_id} onChange={e => setForm(p => ({ ...p, brand_id: e.target.value }))} placeholder="smashme / sushimaster" />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location ID</span>
                  <input className="w-full px-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" value={form.location_id} onChange={e => setForm(p => ({ ...p, location_id: e.target.value }))} placeholder="(opțional)" />
                </label>
              </div>

              {/* Dynamic credential fields per provider */}
              {currentProvider?.fields?.length > 0 && (
                <>
                  <div className="flex items-center gap-4 my-8">
                     <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Credentiale {currentProvider.label}</span>
                     <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {currentProvider.fields.map(f => (
                      <label key={f.key} className={`block ${f.type === 'textarea' ? 'col-span-1 sm:col-span-2' : ''}`}>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{f.label}</span>
                        {f.type === 'textarea' ? (
                          <textarea
                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-mono text-sm resize-y"
                            rows={3}
                            value={form.credentials[f.key] || ''}
                            onChange={e => setCredField(f.key, e.target.value)}
                            placeholder={f.placeholder}
                          />
                        ) : (
                          <input
                            className="w-full px-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-mono text-sm"
                            type={f.type}
                            value={form.credentials[f.key] || ''}
                            onChange={e => setCredField(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            autoComplete="off"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </>
              )}

              {/* Test result */}
              {testResult && (
                <div className={`mt-6 p-4 rounded-xl border font-medium flex items-center gap-3 ${testResult.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50'}`}>
                  <span className="text-xl">{testResult.ok ? '✅' : '❌'}</span>
                  <span>{testResult.msg}</span>
                </div>
              )}
            </div>

            <div className="px-8 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3">
              <button className="px-6 h-11 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors" onClick={closeModal}>Anulează</button>
              {editId && (
                <button
                  className="px-6 h-11 rounded-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-bold transition-colors disabled:opacity-50"
                  onClick={() => testConnection(editId)}
                  disabled={testing === editId}
                >
                  {testing === editId ? 'Se testează...' : 'Test Conexiune'}
                </button>
              )}
              <button className="px-8 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50" onClick={save} disabled={saving}>
                {saving ? 'Se salvează...' : editId ? 'Salvează' : '+ Adaugă'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-2xl text-sm font-bold shadow-xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
