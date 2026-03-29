import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import './UsersManager.css';

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const PAGE_SIZE = 25;

const ROLES = [
  { value: 'admin',   label: 'Admin',   desc: 'Acces complet la tot' },
  { value: 'manager', label: 'Manager', desc: 'Locații selectate' },
  { value: 'demo',    label: 'Demo',    desc: 'Read-only' },
];

const EMPTY_FORM = { id: null, name: '', email: '', phone: '', role: 'demo', password: '', confirmPassword: '', locations: [] };

export default function UsersManager() {
  const { fetchWithAuth, user: loggedUser } = useAuth();
  const [users,     setUsers]     = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState(null);

  // Table state
  const [selected, setSelected] = useState(new Set());
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, lRes] = await Promise.all([
        fetchWithAuth(`${BACKEND}/api/users`),
        fetchWithAuth(`${BACKEND}/api/locations`),
      ]);
      if (!uRes.ok) throw new Error('Nu se pot aduce utilizatorii');
      setUsers(await uRes.json());
      if (lRes.ok) { const d = await lRes.json(); setLocations(d.locations || []); }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // Filtered + paginated
  const filtered = useMemo(() =>
    users.filter(u =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase())
    ), [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageUsers  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Select all on current page
  const allPageSelected = pageUsers.length > 0 && pageUsers.every(u => selected.has(u.id));
  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageUsers.forEach(u => next.delete(u.id));
      else pageUsers.forEach(u => next.add(u.id));
      return next;
    });
  };
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openAdd = () => { setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (u) => {
    setForm({ id: u.id, name: u.name || '', email: u.email || '', phone: u.phone || '', role: u.role || 'demo', password: '', confirmPassword: '', locations: u.locations || [] });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setForm(EMPTY_FORM); };

  const handleToggleLoc = (locId) =>
    setForm(prev => ({ ...prev, locations: prev.locations.includes(locId) ? prev.locations.filter(id => id !== locId) : [...prev.locations, locId] }));

  const saveUser = async () => {
    if (!form.email) return showToast('Email obligatoriu', 'err');
    if (!form.id && !form.password) return showToast('Parola obligatorie la adăugare', 'err');
    if (form.password && form.password !== form.confirmPassword) return showToast('Parolele nu coincid!', 'err');
    setSaving(true);
    try {
      const payload = { name: form.name, email: form.email, phone: form.phone, role: form.role, locations: form.locations, ...(form.password ? { password: form.password } : {}) };
      const res = await fetchWithAuth(form.id ? `${BACKEND}/api/users/${form.id}` : `${BACKEND}/api/users`, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(form.id ? '✅ Actualizat!' : '✅ Adăugat!');
      closeModal(); fetchData();
    } catch (err) { showToast('❌ ' + err.message, 'err'); }
    finally { setSaving(false); }
  };

  const deleteOne = async (u) => {
    if (!confirm(`Ștergi „${u.name || u.email}"?`)) return;
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/users/${u.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('🗑 Șters'); fetchData();
    } catch (err) { showToast('❌ ' + err.message, 'err'); }
  };

  const bulkDelete = async () => {
    const ids = [...selected].filter(id => id !== 'env-admin' && id !== 'u-admin');
    if (!ids.length) return;
    if (!confirm(`Ștergi ${ids.length} utilizatori selectați?`)) return;
    try {
      await Promise.all(ids.map(id => fetchWithAuth(`${BACKEND}/api/users/${id}`, { method: 'DELETE' })));
      setSelected(new Set()); showToast(`🗑 ${ids.length} utilizatori șterși`); fetchData();
    } catch (err) { showToast('❌ ' + err.message, 'err'); }
  };

  const locName = (id) => locations.find(l => l.id === id)?.name || id;

  if (loggedUser?.role !== 'admin') return <div style={{ padding: 40 }}>Doar administratorii au acces.</div>;
  if (loading) return <div style={{ padding: 40, opacity: 0.5 }}>Se încarcă...</div>;
  if (error)   return <div style={{ padding: 40, color: 'red' }}>{error}</div>;

  return (
    <div className="um-page">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="um-toolbar">
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320, position: 'relative' }}>
          <input 
            className="um-search" 
            placeholder="🔍 Caută utilizator..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }} 
            style={{ width: '100%', boxSizing: 'border-box', paddingRight: search ? 64 : 14 }} 
          />
          {search && (
            <span style={{
              position: 'absolute', right: 4, top: 4, bottom: 4, 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#088c8c', color: '#fff', borderRadius: 20, padding: '0 12px', 
              fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none'
            }}>
              {filtered.length}/{users.length}
            </span>
          )}
        </div>

        {selected.size > 0 ? (
          <div className="um-bulk-actions">
            <span className="um-bulk-label">{selected.size} selectați</span>
            <button className="um-btn um-btn--danger" onClick={bulkDelete}>🗑 Șterge ({selected.size})</button>
            <button className="um-btn um-btn--ghost" onClick={() => setSelected(new Set())}>Deselectează</button>
          </div>
        ) : (
          <button className="um-btn um-btn--primary" onClick={openAdd}>+ Adaugă Utilizator</button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="um-table-wrap">
        <table className="um-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} /></th>
              <th style={{ width: 48 }}>#</th>
              <th>Nume</th>
              <th>Email</th>
              <th>Telefon</th>
              <th>Rol</th>
              <th>Locații Alocate</th>
              <th style={{ textAlign: 'right' }}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((u, i) => (
              <tr key={u.id} className={selected.has(u.id) ? 'um-row--selected' : ''}>
                <td><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} /></td>
                <td className="um-cell--muted">{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td><strong>{u.name || '—'}</strong></td>
                <td className="um-cell--muted">{u.email}</td>
                <td className="um-cell--muted">{u.phone || '—'}</td>
                <td>
                  <span className={`um-badge um-badge--${u.role}`}>{u.role.toUpperCase()}</span>
                </td>
                <td className="um-cell--muted um-cell--sm">
                  {u.role === 'admin' ? 'Toate locațiile' : u.locations?.length ? u.locations.map(locName).join(', ') : '—'}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn-business-icon" title="Editează" onClick={() => openEdit(u)}
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                  ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                  {u.id !== 'env-admin' && u.id !== 'u-admin' && (
                    <button className="btn-business-icon" title="Șterge" style={{ marginLeft: 6, background: '#fff5f5', border: '1px solid #fecaca', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onClick={() => deleteOne(u)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {pageUsers.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>Niciun utilizator găsit.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="um-pagination">
          <span className="um-page-info">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} din {filtered.length}
          </span>
          <div className="um-page-btns">
            <button className="um-btn um-btn--ghost" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="um-btn um-btn--ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span key={`ellipsis-${p}`} className="um-page-ellipsis">…</span>}
                  <button key={p} className={`um-btn ${p === page ? 'um-btn--active' : 'um-btn--ghost'}`} onClick={() => setPage(p)}>{p}</button>
                </>
              ))
            }
            <button className="um-btn um-btn--ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="um-btn um-btn--ghost" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────── */}
      {modal && (
        <div className="um-modal-overlay" onClick={closeModal}>
          <div className="um-modal" onClick={e => e.stopPropagation()}>
            <h3 className="um-modal-title">{form.id ? 'Editează Utilizator' : 'Utilizator Nou'}</h3>

            <div className="um-modal-grid">
              {[
                { label: 'Nume Complet', key: 'name', type: 'text', placeholder: 'Ion Popescu' },
                { label: 'Email *', key: 'email', type: 'email', placeholder: 'ion@firma.ro' },
                { label: 'Telefon', key: 'phone', type: 'tel', placeholder: '+40 700 000 000' },
              ].map(f => (
                <label key={f.key} className="um-field">
                  <span className="um-field-label">{f.label}</span>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="um-input" />
                </label>
              ))}
              <label className="um-field">
                <span className="um-field-label">Rol</span>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="um-input">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                </select>
              </label>
            </div>

            <div className="um-section-divider">
              <span>{form.id ? 'Schimbare Parolă (opțional)' : 'Parolă *'}</span>
            </div>
            <div className="um-modal-grid">
              <label className="um-field">
                <span className="um-field-label">Parolă Nouă</span>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className="um-input" />
              </label>
              <label className="um-field">
                <span className="um-field-label">Confirmare Parolă</span>
                <input type="password" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="••••••••"
                  className={`um-input ${form.password && form.confirmPassword && form.password !== form.confirmPassword ? 'um-input--error' : ''}`} />
              </label>
            </div>
            {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
              <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 4 }}>⚠️ Parolele nu coincid</p>
            )}

            {form.role === 'manager' && (
              <>
                <div className="um-section-divider"><span>Locații Alocate</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {locations.map(l => (
                    <label key={l.id} className={`um-loc-pill ${form.locations.includes(l.id) ? 'um-loc-pill--active' : ''}`}>
                      <input type="checkbox" checked={form.locations.includes(l.id)} onChange={() => handleToggleLoc(l.id)} style={{ display: 'none' }} />
                      {l.name}
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="um-modal-footer">
              <button className="um-btn um-btn--ghost" onClick={closeModal}>Anulează</button>
              <button className="um-btn um-btn--primary" onClick={saveUser} disabled={saving}>
                {saving ? 'Se salvează...' : form.id ? '💾 Salvează' : '+ Adaugă'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`um-toast ${toast.type === 'err' ? 'um-toast--err' : ''}`}>{toast.msg}</div>
      )}
    </div>
  );
}
