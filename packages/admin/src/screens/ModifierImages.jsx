import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import './UsersManager.css'; // reuse same table CSS

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const PAGE_SIZE = 25;

export default function ModifierImages() {
  const { fetchWithAuth } = useAuth();
  const [modifiers,   setModifiers]   = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(new Set());
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [editingId,   setEditingId]   = useState(null);
  const [editUrl,     setEditUrl]     = useState('');
  const [saving,      setSaving]      = useState(null);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        fetchWithAuth(`${BACKEND}/api/admin/modifier-images`),
        fetchWithAuth(`${BACKEND}/api/admin/modifier-suggestions`),
      ]);
      const mData = await mRes.json();
      const sData = await sRes.json();
      setModifiers(mData.modifiers || []);
      setSuggestions(sData.suggestions || []);
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() =>
    modifiers.filter(m =>
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.groupName?.toLowerCase().includes(search.toLowerCase()) ||
      m.brandId?.toLowerCase().includes(search.toLowerCase())
    ), [modifiers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPageSelected = pageItems.length > 0 && pageItems.every(m => selected.has(m.id));

  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev);
    allPageSelected ? pageItems.forEach(m => n.delete(m.id)) : pageItems.forEach(m => n.add(m.id));
    return n;
  });
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const saveImage = async (modId, modName, brandId, url) => {
    if (!url?.trim()) return showToast('URL invalid', 'err');
    setSaving(modId);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${modId}`, {
        method: 'PUT',
        body: JSON.stringify({ imageUrl: url, name: modName, brandId }),
      });
      if (!res.ok) throw new Error('Salvare eșuată');
      showToast('✅ Imagine salvată!');
      setEditingId(null);
      fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setSaving(null); }
  };

  const deleteImage = async (modId) => {
    if (!confirm('Ștergi imaginea?')) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${modId}`, { method: 'DELETE' });
      showToast('🗑 Șters'); fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length || !confirm(`Ștergi imaginile la ${ids.length} modificatori?`)) return;
    try {
      await Promise.all(ids.map(id => fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${id}`, { method: 'DELETE' })));
      setSelected(new Set()); showToast(`🗑 ${ids.length} imagini șterse`); fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const acceptSuggestion = (sug) => saveImage(sug.modifier.id, sug.modifier.name, sug.modifier.brandId, sug.suggestedProduct.image);
  const dismissSuggestion = (id) => setSuggestions(prev => prev.filter(s => s.modifier.id !== id));

  const th = 'um-th';

  return (
    <div className="um-page">

      {/* ── Sugestii Automate ────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>✨ Sugestii Automate</h2>
            <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, border: '1px solid #fcd34d' }}>{suggestions.length}</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>— produse din meniu cu imagini sugerate pentru modificatori cu același nume</span>
          </div>

          <div className="um-table-wrap" style={{ border: '1.5px solid #fbbf24' }}>
            <table className="um-table">
              <thead style={{ background: '#fffbeb' }}>
                <tr>
                  <th>#</th>
                  <th>Modificator</th>
                  <th>Grup</th>
                  <th>Produs Sugerat</th>
                  <th>Imagine</th>
                  <th>Potrivire</th>
                  <th>Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((sug, i) => (
                  <tr key={sug.modifier.id}>
                    <td className="um-cell--muted">{i + 1}</td>
                    <td><strong>{sug.modifier.name}</strong><br /><small className="um-cell--muted">{sug.modifier.brandId}</small></td>
                    <td className="um-cell--muted">{sug.modifier.groupName}</td>
                    <td className="um-cell--muted">{sug.suggestedProduct.name}</td>
                    <td>
                      <img src={sug.suggestedProduct.image} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 10 }} onError={e => { e.target.style.display='none'; }} />
                    </td>
                    <td>
                      <span style={{ background: sug.confidence >= 70 ? '#dcfce7' : '#fef9c3', color: sug.confidence >= 70 ? '#166534' : '#854d0e', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>
                        {sug.confidence}%
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="um-btn um-btn--primary um-btn--sm" onClick={() => acceptSuggestion(sug)} disabled={saving === sug.modifier.id}>
                        {saving === sug.modifier.id ? '...' : '✓ Acceptă'}
                      </button>
                      <button className="um-btn um-btn--ghost um-btn--sm" style={{ marginLeft: 6 }} onClick={() => dismissSuggestion(sug.modifier.id)}>Ignoră</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="um-toolbar">
        <input className="um-search" placeholder="🔍 Caută modificator..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }} />
        {selected.size > 0 ? (
          <div className="um-bulk-actions">
            <span className="um-bulk-label">{selected.size} selectați</span>
            <button className="um-btn um-btn--danger" onClick={bulkDelete}>🗑 Șterge imagini ({selected.size})</button>
            <button className="um-btn um-btn--ghost" onClick={() => setSelected(new Set())}>Deselectează</button>
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>
            {filtered.filter(m => m.imageUrl).length}/{filtered.length} cu imagini
          </span>
        )}
      </div>

      {/* ── Main Table ───────────────────────────────────────── */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>Se încarcă modificatorii...</p>
      ) : (
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={allPageSelected} onChange={toggleAll} /></th>
                <th style={{ width: 48 }}>#</th>
                <th style={{ width: 72 }}>Imagine</th>
                <th>Modificator</th>
                <th>Grup</th>
                <th>Brand</th>
                <th>Preț Extra</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((mod, i) => (
                <tr key={mod.id} className={selected.has(mod.id) ? 'um-row--selected' : ''}>
                  <td><input type="checkbox" checked={selected.has(mod.id)} onChange={() => toggleOne(mod.id)} /></td>
                  <td className="um-cell--muted">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td>
                    {mod.imageUrl
                      ? <img src={mod.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} onError={e => { e.target.style.display='none'; }} />
                      : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bg,#f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: '1.2rem' }}>?</div>
                    }
                  </td>
                  <td><strong>{mod.name}</strong></td>
                  <td className="um-cell--muted">{mod.groupName}</td>
                  <td className="um-cell--muted um-cell--sm" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{mod.brandId}</td>
                  <td>
                    {mod.price > 0
                      ? <span style={{ color: '#d32f2f', fontWeight: 600 }}>+{mod.price.toFixed(2)} lei</span>
                      : <span className="um-cell--muted">Inclus</span>}
                  </td>
                  <td>
                    <span className={`um-badge ${mod.imageUrl ? 'um-badge--manager' : 'um-badge--demo'}`} style={mod.imageUrl ? { background: '#dcfce7', color: '#166534' } : { background: '#fef2f2', color: '#991b1b' }}>
                      {mod.imageUrl ? 'Cu imagine' : 'Fără imagine'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editingId === mod.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', minWidth: 280 }}>
                        <input
                          autoFocus
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveImage(mod.id, mod.name, mod.brandId, editUrl)}
                          placeholder="https://..."
                          className="um-input"
                          style={{ flex: 1, padding: '6px 10px', borderColor: '#0f766e' }}
                        />
                        <button className="um-btn um-btn--primary um-btn--sm" onClick={() => saveImage(mod.id, mod.name, mod.brandId, editUrl)} disabled={saving === mod.id}>
                          {saving === mod.id ? '...' : 'OK'}
                        </button>
                        <button className="um-btn um-btn--ghost um-btn--sm" onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="um-btn um-btn--ghost um-btn--sm" onClick={() => { setEditingId(mod.id); setEditUrl(mod.imageUrl || ''); }}>
                          {mod.imageUrl ? 'Schimbă' : '+ URL'}
                        </button>
                        {mod.imageUrl && (
                          <button className="um-btn um-btn--danger um-btn--sm" onClick={() => deleteImage(mod.id)}>Șterge</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>Niciun modificator găsit.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────── */}
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

      {/* Toast */}
      {toast && <div className={`um-toast ${toast.type==='err'?'um-toast--err':''}`}>{toast.msg}</div>}
    </div>
  );
}
