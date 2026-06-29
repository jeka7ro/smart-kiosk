import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';

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
  const confirm = useConfirm();
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
    const ok = await confirm(`Ștergi „${u.name || u.email}"?`, { title: 'Ștergere utilizator', icon: '🗑️', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/users/${u.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('🗑 Șters'); fetchData();
    } catch (err) { showToast('❌ ' + err.message, 'err'); }
  };

  const bulkDelete = async () => {
    const ids = [...selected].filter(id => id !== 'env-admin' && id !== 'u-admin');
    if (!ids.length) return;
    const ok = await confirm(`Ștergi ${ids.length} utilizatori selectați?`, { title: 'Ștergere multiple', icon: '🗑️', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      await Promise.all(ids.map(id => fetchWithAuth(`${BACKEND}/api/users/${id}`, { method: 'DELETE' })));
      setSelected(new Set()); showToast(`🗑 ${ids.length} utilizatori șterși`); fetchData();
    } catch (err) { showToast('❌ ' + err.message, 'err'); }
  };

  const locName = (id) => locations.find(l => l.id === id)?.name || id;

  if (loggedUser?.role !== 'admin') return <div className="p-10">Doar administratorii au acces.</div>;
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
        <span className="text-slate-500 text-sm font-medium">Se încarcă...</span>
      </div>
    );
  }
  if (error) return <div className="p-10 text-red-600 font-medium">{error}</div>;

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 animate-in fade-in duration-300">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input 
            className="w-full pl-11 pr-16 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow shadow-sm"
            placeholder="Caută utilizator..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }} 
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          {search && (
            <span className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center justify-center bg-blue-600 text-white rounded-full px-3 text-xs font-bold pointer-events-none">
              {filtered.length}/{users.length}
            </span>
          )}
        </div>

        {selected.size > 0 ? (
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 animate-in slide-in-from-right-4">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{selected.size} selectați</span>
            <button className="px-4 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-500 text-sm font-bold transition-colors" onClick={bulkDelete}>🗑 Șterge ({selected.size})</button>
            <button className="px-4 py-1.5 rounded-full bg-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-bold transition-colors" onClick={() => setSelected(new Set())}>Deselectează</button>
          </div>
        ) : (
          <button className="px-5 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all flex items-center gap-2" onClick={openAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Adaugă Utilizator
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 w-12 text-center">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={allPageSelected} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nume</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Telefon</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Rol</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Locații Alocate</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {pageUsers.map((u, i) => (
                <tr key={u.id} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected.has(u.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 font-medium">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">{u.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${u.role === 'admin' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : u.role === 'manager' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">
                    {u.role === 'admin' ? 'Toate locațiile' : u.locations?.length ? u.locations.map(locName).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button title="Editează" onClick={() => openEdit(u)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      {u.id !== 'env-admin' && u.id !== 'u-admin' && (
                        <button title="Șterge" onClick={() => deleteOne(u)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-500 border border-red-100 dark:border-red-900/50 transition-colors shadow-sm">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pageUsers.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500 font-medium">Niciun utilizator găsit.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} din {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <div key={p} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="w-8 text-center text-slate-400">…</span>}
                  <button className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold transition-colors ${p === page ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} onClick={() => setPage(p)}>{p}</button>
                </div>
              ))
            }
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto" onClick={closeModal}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[24px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white m-0">{form.id ? 'Editează Utilizator' : 'Utilizator Nou'}</h3>
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 transition-colors" onClick={closeModal}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Nume Complet', key: 'name', type: 'text', placeholder: 'Ion Popescu', full: true },
                  { label: 'Email *', key: 'email', type: 'email', placeholder: 'ion@firma.ro', full: true },
                  { label: 'Telefon', key: 'phone', type: 'tel', placeholder: '+40 700 000 000', full: false },
                ].map(f => (
                  <div key={f.key} className={`space-y-1.5 ${f.full ? 'sm:col-span-2' : ''}`}>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{f.label}</label>
                    <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full px-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-shadow" />
                  </div>
                ))}
                <div className="space-y-1.5 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Rol</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full px-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-shadow appearance-none">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                  </select>
                </div>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                <div className="relative flex justify-start"><span className="pr-3 bg-white dark:bg-slate-900 text-xs font-bold text-slate-400 uppercase tracking-wider">{form.id ? 'Schimbare Parolă (opțional)' : 'Parolă *'}</span></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Parolă Nouă</label>
                  <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className="w-full px-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Confirmare Parolă</label>
                  <input type="password" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="••••••••"
                    className={`w-full px-4 h-11 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition-shadow ${form.password && form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'}`} />
                </div>
              </div>
              {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-red-500 text-sm font-medium m-0 flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Parolele nu coincid</p>
              )}

              {form.role === 'manager' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="relative py-2 mb-2">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                    <div className="relative flex justify-start"><span className="pr-3 bg-white dark:bg-slate-900 text-xs font-bold text-slate-400 uppercase tracking-wider">Locații Alocate</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {locations.map(l => {
                      const isSelected = form.locations.includes(l.id);
                      return (
                        <label key={l.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => handleToggleLoc(l.id)} className="hidden" />
                          {l.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button className="px-6 h-11 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors" onClick={closeModal}>Anulează</button>
              <button className="px-8 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50" onClick={saveUser} disabled={saving}>
                {saving ? 'Se salvează...' : form.id ? 'Salvează' : '+ Adaugă'}
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
