import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';
import { Trash2, X, Search, Plus, Pencil, AlertTriangle } from 'lucide-react';

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
      showToast(form.id ? 'Actualizat!' : 'Adăugat!');
      closeModal(); fetchData();
    } catch (err) { showToast(err.message, 'err'); }
    finally { setSaving(false); }
  };

  const deleteOne = async (u) => {
    const ok = await confirm(`Ștergi „${u.name || u.email}"?`, { title: 'Ștergere utilizator', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/users/${u.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Șters'); fetchData();
    } catch (err) { showToast(err.message, 'err'); }
  };

  const bulkDelete = async () => {
    const ids = [...selected].filter(id => id !== 'env-admin' && id !== 'u-admin');
    if (!ids.length) return;
    const ok = await confirm(`Ștergi ${ids.length} utilizatori selectați?`, { title: 'Ștergere multiple', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      await Promise.all(ids.map(id => fetchWithAuth(`${BACKEND}/api/users/${id}`, { method: 'DELETE' })));
      setSelected(new Set()); showToast(`${ids.length} utilizatori șterși`); fetchData();
    } catch (err) { showToast(err.message, 'err'); }
  };

  const locName = (id) => locations.find(l => l.id === id)?.name || id;

  if (loggedUser?.role !== 'admin') return <div className="p-10">Doar administratorii au acces.</div>;
  if (loading) {
    return (
      <div className="apple-card flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-6 h-6 border-2 border-black/10 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
        <span className="text-[#86868B] text-[13px] font-medium">Se încarcă echipa...</span>
      </div>
    );
  }
  if (error) return <div className="apple-card p-8 text-[#FF3B30] text-[13px] font-medium">{error}</div>;

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 space-y-5 animate-in fade-in duration-300">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="apple-card p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
          <input
            className="apple-input rounded-full w-full pl-9 pr-14 py-1.5 text-[13px]"
            placeholder="Caută utilizator..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }}
          />
          {search && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-[#007AFF]/12 text-[#007AFF] text-[11px] font-semibold tabular-nums pointer-events-none">
              {filtered.length}/{users.length}
            </span>
          )}
        </div>

        {selected.size > 0 ? (
          <div className="flex items-center gap-2 bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 rounded-xl">
            <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">{selected.size} selectați</span>
            <button className="px-3 py-1 rounded-full bg-[#FF3B30]/12 hover:bg-[#FF3B30]/20 text-[#FF3B30] text-[12px] font-semibold transition-colors flex items-center gap-1 cursor-pointer" onClick={bulkDelete}>
              <Trash2 size={13} /> Șterge
            </button>
            <button className="px-2 py-1 text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white text-[12px] font-medium cursor-pointer" onClick={() => setSelected(new Set())}>Anulează</button>
          </div>
        ) : (
          <button className="apple-btn-primary px-4 py-2 text-[13px]" onClick={openAdd}>
            <Plus size={15} strokeWidth={2.5} />
            <span>Adaugă Utilizator</span>
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider">
                <th className="px-4 py-3 w-12 text-center">
                  <input type="checkbox" className="w-4 h-4 rounded accent-[#007AFF] cursor-pointer" checked={allPageSelected} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Nume</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Telefon</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Locații Alocate</th>
                <th className="px-4 py-3 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {pageUsers.map((u, i) => (
                <tr key={u.id} className={`transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${selected.has(u.id) ? 'bg-[#007AFF]/[0.05]' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" className="w-4 h-4 rounded accent-[#007AFF] cursor-pointer" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} />
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#86868B] tabular-nums">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{u.name || '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-[#6E6E73] dark:text-[#98989D]">{u.email}</td>
                  <td className="px-4 py-3 text-[13px] text-[#6E6E73] dark:text-[#98989D] tabular-nums">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      u.role === 'admin'
                        ? 'bg-[#007AFF]/12 text-[#007AFF]'
                        : u.role === 'manager'
                          ? 'bg-[#AF52DE]/12 text-[#8944AB] dark:text-[#BF5AF2]'
                          : 'bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#98989D]'
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#6E6E73] dark:text-[#98989D] max-w-xs truncate">
                    {u.role === 'admin' ? 'Toate locațiile' : u.locations?.length ? u.locations.map(locName).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button title="Editează" onClick={() => openEdit(u)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer">
                        <Pencil size={13} />
                      </button>
                      {u.id !== 'env-admin' && u.id !== 'u-admin' && (
                        <button title="Șterge" onClick={() => deleteOne(u)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] transition-colors cursor-pointer">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pageUsers.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-[#86868B] text-[13px] font-medium">Niciun utilizator găsit.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#6E6E73] dark:text-[#98989D] font-medium">
          <span className="tabular-nums">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} din {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors cursor-pointer" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors cursor-pointer" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <div key={p} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="w-8 text-center text-[#86868B]">…</span>}
                  <button className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold tabular-nums transition-colors cursor-pointer ${p === page ? 'bg-[#007AFF] text-white' : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'}`} onClick={() => setPage(p)}>{p}</button>
                </div>
              ))
            }
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors cursor-pointer" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors cursor-pointer" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150" onClick={closeModal}>
          <div className="apple-modal w-full max-w-lg overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">{form.id ? 'Editează Utilizator' : 'Utilizator Nou'}</h3>
              <button type="button" className="apple-close-btn" onClick={closeModal} title="Închide">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  { label: 'Nume Complet', key: 'name', type: 'text', placeholder: 'Ion Popescu', full: true },
                  { label: 'Email *', key: 'email', type: 'email', placeholder: 'ion@firma.ro', full: true },
                  { label: 'Telefon', key: 'phone', type: 'tel', placeholder: '+40 700 000 000', full: false },
                ].map(f => (
                  <div key={f.key} className={`space-y-1.5 ${f.full ? 'sm:col-span-2' : ''}`}>
                    <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">{f.label}</label>
                    <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="apple-input w-full text-[13px]" />
                  </div>
                ))}
                <div className="space-y-1.5 sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Rol</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="apple-input w-full text-[13px] cursor-pointer">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-4 space-y-3">
                <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  {form.id ? 'Schimbare Parolă (opțional)' : 'Parolă *'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Parolă Nouă</label>
                    <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className="apple-input w-full text-[13px]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Confirmare Parolă</label>
                    <input type="password" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="••••••••"
                      className={`apple-input w-full text-[13px] ${form.password && form.confirmPassword && form.password !== form.confirmPassword ? 'border-[#FF3B30]' : ''}`} />
                  </div>
                </div>
                {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-[#FF3B30] text-[12px] font-medium m-0 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Parolele nu coincid
                  </p>
                )}
              </div>

              {form.role === 'manager' && (
                <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-4 space-y-2.5 animate-in fade-in duration-200">
                  <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Locații Alocate</div>
                  <div className="flex flex-wrap gap-1.5">
                    {locations.map(l => {
                      const isSelected = form.locations.includes(l.id);
                      return (
                        <label key={l.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${isSelected ? 'bg-[#007AFF] text-white' : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08]'}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => handleToggleLoc(l.id)} className="hidden" />
                          {l.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.015] dark:bg-white/[0.02] flex justify-end gap-2.5">
              <button className="apple-btn-secondary px-4 py-2 text-[13px]" onClick={closeModal}>Anulează</button>
              <button className="apple-btn-primary px-5 py-2 text-[13px]" onClick={saveUser} disabled={saving}>
                {saving ? 'Se salvează...' : form.id ? 'Salvează' : 'Adaugă'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-[#1C1C1E] dark:bg-[#2C2C2E] text-white text-[13px] font-medium shadow-2xl border border-white/10 flex items-center gap-2.5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className={`w-2 h-2 rounded-full ${toast.type === 'err' ? 'bg-[#FF3B30]' : 'bg-[#34C759]'}`} />
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
