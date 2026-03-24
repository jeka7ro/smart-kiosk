import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { proxySyrveImage } from '../utils/imageUtils.js';// adjust path if needed

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default function ModifierImages() {
  const { fetchWithAuth } = useAuth();
  const [modifiers,    setModifiers]    = useState([]);
  const [suggestions,  setSuggestions]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [sugLoading,   setSugLoading]   = useState(true);
  const [search,       setSearch]       = useState('');
  const [editingId,    setEditingId]    = useState(null);
  const [editUrl,      setEditUrl]      = useState('');
  const [saving,       setSaving]       = useState(null);
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchModifiers = async () => {
    setLoading(true);
    try {
      const res  = await fetchWithAuth(`${BACKEND}/api/admin/modifier-images`);
      const data = await res.json();
      setModifiers(data.modifiers || []);
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setLoading(false); }
  };

  const fetchSuggestions = async () => {
    setSugLoading(true);
    try {
      const res  = await fetchWithAuth(`${BACKEND}/api/admin/modifier-suggestions`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (_) { setSuggestions([]); }
    finally { setSugLoading(false); }
  };

  useEffect(() => { fetchModifiers(); fetchSuggestions(); }, []);

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
      fetchModifiers();
      fetchSuggestions();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setSaving(null); }
  };

  const deleteImage = async (modId) => {
    if (!confirm('Ștergi imaginea?')) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${modId}`, { method: 'DELETE' });
      showToast('🗑 Șters');
      fetchModifiers();
      fetchSuggestions();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const acceptSuggestion = (sug) => {
    saveImage(sug.modifier.id, sug.modifier.name, sug.modifier.brandId, sug.suggestedProduct.image);
  };

  const dismissSuggestion = (modId) => {
    setSuggestions(prev => prev.filter(s => s.modifier.id !== modId));
  };

  const filtered = modifiers.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.groupName?.toLowerCase().includes(search.toLowerCase())
  );

  const th = { padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, borderBottom: '1px solid var(--border, #e5e7eb)', whiteSpace: 'nowrap' };
  const td = { padding: '12px 16px', fontSize: '0.9rem', verticalAlign: 'middle', borderBottom: '1px solid var(--border, #e5e7eb)' };

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* ─── SUGGESTIONS ─────────────────────────────────────────────── */}
      {!sugLoading && suggestions.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
              ✨ Sugestii Automate
            </h2>
            <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.78rem', fontWeight: 600, padding: '2px 10px', borderRadius: 20, border: '1px solid #fcd34d' }}>
              {suggestions.length} detectate
            </span>
            <span style={{ fontSize: '0.82rem', opacity: 0.5 }}>
              — produse existente din meniu cu imagini pot fi asociate modificatorilor cu același nume
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface, #fff)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1.5px solid #fbbf24' }}>
            <thead style={{ background: '#fffbeb' }}>
              <tr>
                <th style={th}>Modificator</th>
                <th style={th}>Grup</th>
                <th style={th}>Sugestie Detectată</th>
                <th style={th}>Imagine</th>
                <th style={th}>Potrivire</th>
                <th style={th}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map(sug => (
                <tr key={sug.modifier.id} style={{ transition: 'background 0.15s' }}>
                  <td style={td}>
                    <strong>{sug.modifier.name}</strong>
                    <div style={{ fontSize: '0.76rem', opacity: 0.5 }}>{sug.modifier.brandId}</div>
                  </td>
                  <td style={{ ...td, opacity: 0.65 }}>{sug.modifier.groupName}</td>
                  <td style={td}>
                    <span style={{ opacity: 0.8 }}>{sug.suggestedProduct.name}</span>
                  </td>
                  <td style={td}>
                    <img
                      src={sug.suggestedProduct.image}
                      alt={sug.suggestedProduct.name}
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10 }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </td>
                  <td style={td}>
                    <span style={{ background: sug.confidence >= 70 ? '#dcfce7' : '#fef9c3', color: sug.confidence >= 70 ? '#166534' : '#854d0e', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700 }}>
                      {sug.confidence}%
                    </span>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => acceptSuggestion(sug)}
                      disabled={saving === sug.modifier.id}
                      style={{ marginRight: 8, padding: '6px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      {saving === sug.modifier.id ? '...' : '✓ Acceptă'}
                    </button>
                    <button
                      onClick={() => dismissSuggestion(sug.modifier.id)}
                      style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', opacity: 0.6 }}
                    >
                      Ignoră
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── ALL MODIFIERS TABLE ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Toți Modificatorii</h2>
        <input
          placeholder="🔍 Caută modificator..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '9px 14px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 10, fontSize: '0.9rem', background: 'var(--surface, #fff)', color: 'var(--text)', outline: 'none', minWidth: 240 }}
        />
        <span style={{ fontSize: '0.82rem', opacity: 0.45 }}>
          {filtered.filter(m => m.imageUrl).length}/{filtered.length} cu imagini
        </span>
      </div>

      {loading ? (
        <p style={{ opacity: 0.5, padding: '40px 0', textAlign: 'center' }}>Se încarcă...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface, #fff)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--border, #e5e7eb)' }}>
          <thead>
            <tr style={{ background: 'var(--bg, #f9fafb)' }}>
              <th style={th}>Imagine</th>
              <th style={th}>Modificator</th>
              <th style={th}>Grup</th>
              <th style={th}>Brand</th>
              <th style={th}>Preț Extra</th>
              <th style={th}>Status</th>
              <th style={th}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(mod => (
              <tr key={mod.id} style={{ transition: 'background 0.12s' }}>
                {/* Imagine */}
                <td style={{ ...td, width: 72 }}>
                  {mod.imageUrl ? (
                    <img src={mod.imageUrl} alt={mod.name} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 10 }} onError={e => { e.target.style.display='none'; }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--bg, #f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', opacity: 0.4 }}>?</div>
                  )}
                </td>
                {/* Name */}
                <td style={td}><strong>{mod.name}</strong></td>
                {/* Group */}
                <td style={{ ...td, opacity: 0.65 }}>{mod.groupName}</td>
                {/* Brand */}
                <td style={{ ...td, opacity: 0.65, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{mod.brandId}</td>
                {/* Price */}
                <td style={td}>{mod.price > 0 ? <span style={{ color: '#d32f2f', fontWeight: 600 }}>+{mod.price.toFixed(2)} lei</span> : <span style={{ opacity: 0.4 }}>Inclus</span>}</td>
                {/* Status */}
                <td style={td}>
                  {mod.imageUrl
                    ? <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600 }}>Cu imagine</span>
                    : <span style={{ background: '#fef2f2', color: '#991b1b', padding: '3px 10px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600 }}>Fără imagine</span>
                  }
                </td>
                {/* Actions */}
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {editingId === mod.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 320 }}>
                      <input
                        autoFocus
                        value={editUrl}
                        onChange={e => setEditUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveImage(mod.id, mod.name, mod.brandId, editUrl)}
                        placeholder="https://..."
                        style={{ flex: 1, padding: '6px 12px', border: '1.5px solid #0f766e', borderRadius: 8, fontSize: '0.85rem', background: 'var(--surface, #fff)', color: 'var(--text)', outline: 'none' }}
                      />
                      <button
                        onClick={() => saveImage(mod.id, mod.name, mod.brandId, editUrl)}
                        disabled={saving === mod.id}
                        style={{ padding: '6px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        {saving === mod.id ? '...' : 'OK'}
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '6px 10px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, background: 'transparent', cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingId(mod.id); setEditUrl(mod.imageUrl || ''); }}
                        style={{ marginRight: 8, padding: '6px 14px', background: 'var(--surface, #fff)', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
                      >
                        {mod.imageUrl ? 'Schimbă' : '+ Adaugă URL'}
                      </button>
                      {mod.imageUrl && (
                        <button
                          onClick={() => deleteImage(mod.id)}
                          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          Șterge
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>Niciun modificator găsit.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'err' ? '#dc2626' : '#111827', color: '#fff', padding: '12px 24px', borderRadius: 20, fontWeight: 500, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
