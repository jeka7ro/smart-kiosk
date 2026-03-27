import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import './UsersManager.css'; // reuse same table CSS

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const PAGE_SIZE = 25;

const BRANDS = [
  { id: 'smashme',     label: 'SmashMe',     color: '#ef4444' },
  { id: 'sushimaster', label: 'Sushi Master',color: '#3b82f6' },
  { id: 'welovesushi', label: 'WeLoveSushi', color: '#f59e0b' },
  { id: 'ikura',       label: 'Ikura',       color: '#10b981' }
];

export default function ModifierImages() {
  const { fetchWithAuth } = useAuth();
  const [modifiers,   setModifiers]   = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(new Set());
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [activeBrand, setActiveBrand] = useState('ALL');
  const [editingId,   setEditingId]   = useState(null);
  const [editUrl,     setEditUrl]     = useState('');
  const [saving,      setSaving]      = useState(null);
  const [toast,       setToast]       = useState(null);
  const [selectedSugs, setSelectedSugs] = useState(new Set()); // for suggestions bulk

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
    modifiers.filter(m => {
      if (activeBrand !== 'ALL' && m.brandId?.toLowerCase() !== activeBrand) return false;
      return m.name?.toLowerCase().includes(search.toLowerCase()) ||
             m.groupName?.toLowerCase().includes(search.toLowerCase()) ||
             m.brandId?.toLowerCase().includes(search.toLowerCase());
    }), [modifiers, search, activeBrand]);

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

  // Bulk accept suggestions
  const allSugsSelected = suggestions.length > 0 && suggestions.every(s => selectedSugs.has(s.modifier.id));
  const toggleAllSugs = () => setSelectedSugs(prev => {
    if (allSugsSelected) return new Set();
    return new Set(suggestions.map(s => s.modifier.id));
  });
  const toggleOneSug = (id) => setSelectedSugs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [acceptingAll, setAcceptingAll] = useState(false);
  const bulkAcceptSugs = async (ids) => {
    const toAccept = suggestions.filter(s => ids.has(s.modifier.id));
    if (!toAccept.length) return;
    setAcceptingAll(true);
    try {
      await Promise.all(toAccept.map(sug =>
        fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${sug.modifier.id}`, {
          method: 'PUT',
          body: JSON.stringify({ imageUrl: sug.suggestedProduct.image, name: sug.modifier.name, brandId: sug.modifier.brandId }),
        })
      ));
      showToast(`✅ ${toAccept.length} imagini acceptate!`);
      setSelectedSugs(new Set());
      fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setAcceptingAll(false); }
  };
  const acceptAllSugs = () => bulkAcceptSugs(new Set(suggestions.map(s => s.modifier.id)));
  const acceptSelectedSugs = () => bulkAcceptSugs(selectedSugs);

  const th = 'um-th';

  return (
    <div className="um-page">

      {/* ── Sugestii Automate ────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>✨ Sugestii Automate</h2>
            <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, border: '1px solid #fcd34d' }}>{suggestions.length}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {selectedSugs.size > 0 && (
                <button className="um-btn um-btn--primary um-btn--sm" onClick={acceptSelectedSugs} disabled={acceptingAll}>
                  {acceptingAll ? '...' : `✓ Acceptă Selectate (${selectedSugs.size})`}
                </button>
              )}
              <button className="um-btn um-btn--primary" onClick={acceptAllSugs} disabled={acceptingAll} style={{ background: '#0f766e', fontWeight: 700 }}>
                {acceptingAll ? 'Se procesează...' : `✓ Acceptă Tot (${suggestions.length})`}
              </button>
              <button className="um-btn um-btn--ghost um-btn--sm" onClick={() => setSuggestions([])} style={{ opacity: 0.5 }}>Ignoră Toate</button>
            </div>
          </div>

          <div className="um-table-wrap" style={{ border: '1.5px solid #fbbf24' }}>
            <table className="um-table">
              <thead style={{ background: '#fffbeb' }}>
                <tr>
                  <th style={{ width: 40 }}><input type="checkbox" checked={allSugsSelected} onChange={toggleAllSugs} /></th>
                  <th style={{ width: 48 }}>#</th>
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
                  <tr key={sug.modifier.id} className={selectedSugs.has(sug.modifier.id) ? 'um-row--selected' : ''}>
                    <td><input type="checkbox" checked={selectedSugs.has(sug.modifier.id)} onChange={() => toggleOneSug(sug.modifier.id)} /></td>
                    <td className="um-cell--muted">{i + 1}</td>
                    <td>
                      <strong>{sug.modifier.name}</strong><br />
                      {sug.modifier.brandId ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <img src={`/brands/${sug.modifier.brandId.toLowerCase()}-logo.png`} alt={sug.modifier.brandId} style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                          <small className="um-cell--muted" style={{ display: 'none' }}>{sug.modifier.brandId}</small>
                        </div>
                      ) : <small className="um-cell--muted">—</small>}
                    </td>
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
      <div className="um-toolbar" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setActiveBrand('ALL')}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              background: activeBrand === 'ALL' ? '#0f766e' : 'var(--surface)',
              color: activeBrand === 'ALL' ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeBrand === 'ALL' ? '#0f766e' : 'var(--border)'}`,
              height: 38, display: 'flex', alignItems: 'center'
            }}
          >Toate</button>
          {BRANDS.map(b => {
            const isActive = activeBrand === b.id;
            return (
              <button
                key={b.id}
                onClick={() => { setActiveBrand(b.id); setPage(1); }}
                title={b.label}
                style={{
                  width: 38, height: 38, borderRadius: '50%', padding: 0,
                  border: isActive ? `2px solid ${b.color}` : '1px solid var(--border)',
                  background: '#fff', cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: isActive ? `0 4px 10px ${b.color}40` : 'none',
                  opacity: isActive ? 1 : 0.5,
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                }}
              >
                <img src={`/brands/${b.id}-logo.png`} alt={b.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none'; }} />
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input 
            className="um-search" 
            placeholder="🔍 Caută modificator..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }} 
            style={{ width: '100%', boxSizing: 'border-box', paddingRight: 80 }} 
          />
          <span style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: '#0f766e', color: '#fff', borderRadius: 12, padding: '2px 8px', 
            fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none'
          }}>
            {filtered.filter(m => m.imageUrl).length}/{filtered.length}
          </span>
        </div>
        {selected.size > 0 && (
          <div className="um-bulk-actions">
            <span className="um-bulk-label">{selected.size} selectați</span>
            <button className="um-btn um-btn--danger" onClick={bulkDelete}>🗑 Șterge imagini ({selected.size})</button>
            <button className="um-btn um-btn--ghost" onClick={() => setSelected(new Set())}>Deselectează</button>
          </div>
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
                  <td>
                    {mod.brandId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={`/brands/${mod.brandId.toLowerCase()}-logo.png`} alt={mod.brandId} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                        <span style={{ display: 'none', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{mod.brandId}</span>
                      </div>
                    ) : <span className="um-cell--muted">—</span>}
                  </td>
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
