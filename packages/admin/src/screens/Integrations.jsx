import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import './UsersManager.css';

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const PAGE_SIZE = 25;

const STATUS_STYLE = {
  active:  { bg: '#dcfce7', color: '#166534', label: 'Activ' },
  error:   { bg: '#fef2f2', color: '#991b1b', label: 'Eroare' },
  pending: { bg: '#f3f4f6', color: '#374151', label: 'Neptestat' },
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
    if (!confirm(`Ștergi integrarea „${integ.name}"?`)) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/integrations/${integ.id}`, { method: 'DELETE' });
      showToast('🗑 Șters'); fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const bulkDelete = async () => {
    if (!selected.size || !confirm(`Ștergi ${selected.size} integrări?`)) return;
    try {
      await Promise.all([...selected].map(id => fetchWithAuth(`${BACKEND}/api/integrations/${id}`, { method: 'DELETE' })));
      setSelected(new Set()); showToast(`🗑 ${selected.size} integrări șterse`); fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const providerMeta = (key) => providers.find(p => p.key === key) || { label: key, color: '#6b7280' };

  return (
    <div className="um-page">

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="um-toolbar">
        <input className="um-search" placeholder="🔍 Caută integrare..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }} />
        {selected.size > 0 ? (
          <div className="um-bulk-actions">
            <span className="um-bulk-label">{selected.size} selectate</span>
            <button className="um-btn um-btn--danger" onClick={bulkDelete}>🗑 Șterge ({selected.size})</button>
            <button className="um-btn um-btn--ghost" onClick={() => setSelected(new Set())}>Deselectează</button>
          </div>
        ) : (
          <button className="um-btn um-btn--primary" onClick={openAdd}>+ Adaugă Integrare</button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>Se încarcă...</p>
      ) : (
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={allSel} onChange={toggleAll} /></th>
                <th style={{ width: 48 }}>#</th>
                <th>Nume Integrare</th>
                <th>Provider POS</th>
                <th>Brand</th>
                <th>Status</th>
                <th>Ultima Sincronizare</th>
                <th style={{ textAlign: 'right' }}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((integ, i) => {
                const pm = providerMeta(integ.provider);
                const st = STATUS_STYLE[integ.status] || STATUS_STYLE.pending;
                return (
                  <tr key={integ.id} className={selected.has(integ.id) ? 'um-row--selected' : ''}>
                    <td><input type="checkbox" checked={selected.has(integ.id)} onChange={() => toggleOne(integ.id)} /></td>
                    <td className="um-cell--muted">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td><strong>{integ.name}</strong></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {PROVIDER_LOGOS[integ.provider]
                          ? <img src={PROVIDER_LOGOS[integ.provider]} alt={pm.label} style={{ width: 16, height: 16, borderRadius: 3, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.target.style.display='none'; }} />
                          : <span style={{ width: 8, height: 8, borderRadius: '50%', background: pm.color, flexShrink: 0 }} />
                        }
                        {pm.label}
                      </span>
                    </td>
                    <td className="um-cell--muted">{integ.brand_id || '—'}</td>
                    <td>
                      <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>
                        {st.label}
                      </span>
                      {integ.last_error && (
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={integ.last_error}>
                          {integ.last_error}
                        </div>
                      )}
                    </td>
                    <td className="um-cell--muted um-cell--sm">
                      {integ.last_sync_at
                        ? new Date(integ.last_sync_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="um-btn um-btn--ghost um-btn--sm" onClick={() => openEdit(integ)}>Editează</button>
                      <button
                        className="um-btn um-btn--ghost um-btn--sm"
                        style={{ marginLeft: 6 }}
                        onClick={() => testConnection(integ.id)}
                        disabled={testing === integ.id}
                      >
                        {testing === integ.id ? '...' : '⚡ Test'}
                      </button>
                      <button
                        className="um-btn um-btn--ghost um-btn--sm"
                        style={{ marginLeft: 6 }}
                        onClick={() => syncMenu(integ.id, integ.name)}
                        disabled={syncing === integ.id}
                      >
                        {syncing === integ.id ? '...' : '🔄 Sync'}
                      </button>
                      <button className="um-btn um-btn--danger um-btn--sm" style={{ marginLeft: 6 }} onClick={() => deleteOne(integ)}>Șterge</button>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔌</div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Nicio integrare configurată</div>
                    <div style={{ opacity: 0.5, fontSize: '0.88rem' }}>Adaugă primul POS pentru a conecta meniul și comenzile</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="um-pagination">
          <span className="um-page-info">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} din {filtered.length}</span>
          <div className="um-page-btns">
            <button className="um-btn um-btn--ghost" disabled={page===1} onClick={() => setPage(1)}>«</button>
            <button className="um-btn um-btn--ghost" disabled={page===1} onClick={() => setPage(p => p-1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k+1)
              .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=2)
              .map((p, idx, arr) => (
                <>
                  {idx>0 && arr[idx-1]!==p-1 && <span key={`e${p}`} className="um-page-ellipsis">…</span>}
                  <button key={p} className={`um-btn ${p===page?'um-btn--active':'um-btn--ghost'}`} onClick={() => setPage(p)}>{p}</button>
                </>
              ))}
            <button className="um-btn um-btn--ghost" disabled={page===totalPages} onClick={() => setPage(p => p+1)}>›</button>
            <button className="um-btn um-btn--ghost" disabled={page===totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ───────────────────────────────────── */}
      {modal && (
        <div className="um-modal-overlay" onClick={closeModal}>
          <div className="um-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <h3 className="um-modal-title">{editId ? 'Editează Integrare' : 'Adaugă Integrare POS'}</h3>

            {/* Base fields */}
            <div className="um-modal-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="um-field" style={{ gridColumn: '1 / -1' }}>
                <span className="um-field-label">Nume afișat *</span>
                <input className="um-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder='ex: "SmashMe - Syrve Brașov"' />
              </label>

              <label className="um-field" style={{ gridColumn: '1 / -1' }}>
                <span className="um-field-label">Provider POS *</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {providers.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, provider: p.key, credentials: {} }))}
                      style={{
                        padding: '10px 16px', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                        border: `2px solid ${form.provider === p.key ? p.color : 'var(--border, #e5e7eb)'}`,
                        background: form.provider === p.key ? `${p.color}15` : 'transparent',
                        color: form.provider === p.key ? p.color : 'var(--text, #374151)',
                        transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      {PROVIDER_LOGOS[p.key]
                        ? <img src={PROVIDER_LOGOS[p.key]} alt={p.label} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain' }} onError={e => { e.target.style.display='none'; }} />
                        : <span style={{ width: 20, height: 20, borderRadius: 4, background: p.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#fff', fontWeight: 800 }}>?</span>
                      }
                      {p.label}
                    </button>
                  ))}
                </div>
                {currentProvider && (
                  <p style={{ fontSize: '0.8rem', opacity: 0.55, margin: '6px 0 0' }}>{currentProvider.description}</p>
                )}
              </label>

              <label className="um-field">
                <span className="um-field-label">Brand ID (kiosk)</span>
                <input className="um-input" value={form.brand_id} onChange={e => setForm(p => ({ ...p, brand_id: e.target.value }))} placeholder="smashme / sushimaster" />
              </label>
              <label className="um-field">
                <span className="um-field-label">Location ID</span>
                <input className="um-input" value={form.location_id} onChange={e => setForm(p => ({ ...p, location_id: e.target.value }))} placeholder="(opțional)" />
              </label>
            </div>

            {/* Dynamic credential fields per provider */}
            {currentProvider?.fields?.length > 0 && (
              <>
                <div className="um-section-divider"><span>Credentiale {currentProvider.label}</span></div>
                <div className="um-modal-grid">
                  {currentProvider.fields.map(f => (
                    <label key={f.key} className="um-field" style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                      <span className="um-field-label">{f.label}</span>
                      {f.type === 'textarea' ? (
                        <textarea
                          className="um-input"
                          rows={3}
                          value={form.credentials[f.key] || ''}
                          onChange={e => setCredField(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                        />
                      ) : (
                        <input
                          className="um-input"
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
              <div style={{ padding: '10px 14px', borderRadius: 10, marginTop: 12, background: testResult.ok ? '#dcfce7' : '#fef2f2', color: testResult.ok ? '#166534' : '#991b1b', fontSize: '0.88rem', fontWeight: 500 }}>
                {testResult.ok ? '✅' : '❌'} {testResult.msg}
              </div>
            )}

            <div className="um-modal-footer" style={{ marginTop: 24 }}>
              <button className="um-btn um-btn--ghost" onClick={closeModal}>Anulează</button>
              {editId && (
                <button
                  className="um-btn um-btn--ghost"
                  onClick={() => testConnection(editId)}
                  disabled={testing === editId}
                  style={{ borderColor: '#0f766e', color: '#0f766e' }}
                >
                  {testing === editId ? '...' : '⚡ Test Conexiune'}
                </button>
              )}
              <button className="um-btn um-btn--primary" onClick={save} disabled={saving}>
                {saving ? 'Se salvează...' : editId ? '💾 Salvează' : '+ Adaugă'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`um-toast ${toast.type==='err'?'um-toast--err':''}`}>{toast.msg}</div>}
    </div>
  );
}
