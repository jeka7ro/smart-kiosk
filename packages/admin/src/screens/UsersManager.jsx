import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const ROLES = [
  { value: 'admin',   label: 'Admin',   desc: 'Acces complet' },
  { value: 'manager', label: 'Manager', desc: 'Locații selectate' },
  { value: 'demo',    label: 'Demo',    desc: 'Read-only' },
];

const EMPTY_FORM = {
  id: null, name: '', email: '', phone: '', role: 'demo',
  password: '', confirmPassword: '', locations: [],
};

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
      if (lRes.ok) {
        const lData = await lRes.json();
        setLocations(lData.locations || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (u) => {
    setForm({
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'demo',
      password: '',
      confirmPassword: '',
      locations: u.locations || [],
    });
    setModal(true);
  };

  const closeModal = () => { setModal(false); setForm(EMPTY_FORM); };

  const handleToggleLoc = (locId) => {
    setForm(prev => ({
      ...prev,
      locations: prev.locations.includes(locId)
        ? prev.locations.filter(id => id !== locId)
        : [...prev.locations, locId],
    }));
  };

  const saveUser = async () => {
    if (!form.email) return showToast('Email-ul este obligatoriu', 'err');
    if (!form.id && !form.password) return showToast('Parola este obligatorie la adăugare', 'err');
    if (form.password && form.password !== form.confirmPassword)
      return showToast('Parolele nu coincid!', 'err');

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        locations: form.locations,
        ...(form.password ? { password: form.password } : {}),
      };
      const url    = form.id ? `${BACKEND}/api/users/${form.id}` : `${BACKEND}/api/users`;
      const method = form.id ? 'PUT' : 'POST';
      const res    = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(form.id ? '✅ Utilizator actualizat!' : '✅ Utilizator adăugat!');
      closeModal();
      fetchData();
    } catch (err) {
      showToast('❌ ' + err.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (u) => {
    if (!confirm(`Ești sigur că vrei să ștergi utilizatorul „${u.name || u.email}"?`)) return;
    try {
      const res  = await fetchWithAuth(`${BACKEND}/api/users/${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('🗑 Utilizator șters');
      fetchData();
    } catch (err) {
      showToast('❌ ' + err.message, 'err');
    }
  };

  const locName = (id) => locations.find(l => l.id === id)?.name || id;

  if (loggedUser?.role !== 'admin')
    return <div style={{ padding: 40 }}>Doar administratorii au acces.</div>;
  if (loading) return <div style={{ padding: 40 }}>Se încarcă...</div>;
  if (error)   return <div style={{ padding: 40, color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn-save" onClick={openAdd}>+ Adaugă Utilizator</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="orders-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Nume</th>
              <th>Email</th>
              <th>Telefon</th>
              <th>Rol</th>
              <th>Locații Alocate</th>
              <th style={{ textAlign: 'right' }}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><strong>{u.name || '—'}</strong></td>
                <td style={{ opacity: 0.75 }}>{u.email}</td>
                <td style={{ opacity: 0.75 }}>{u.phone || '—'}</td>
                <td>
                  <span className={`tag role-${u.role}`} style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20 }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ opacity: 0.8, fontSize: '0.88rem' }}>
                  {u.role === 'admin'
                    ? 'Toate locațiile'
                    : u.locations?.length
                      ? u.locations.map(locName).join(', ')
                      : '—'}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => openEdit(u)}
                    style={{ marginRight: 8, background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}
                  >
                    Editează
                  </button>
                  {u.id !== 'env-admin' && u.id !== 'u-admin' && (
                    <button
                      onClick={() => deleteUser(u)}
                      style={{ background: 'var(--surface)', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}
                    >
                      Șterge
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={closeModal}>
          <div style={{ background: 'var(--surface, #fff)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 24px', fontSize: '1.2rem', fontWeight: 700 }}>
              {form.id ? 'Editează Utilizator' : 'Adaugă Utilizator Nou'}
            </h3>

            {/* Fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginBottom: 20 }}>
              {[
                { label: 'Nume Complet', key: 'name', type: 'text', placeholder: 'Ion Popescu' },
                { label: 'Email *', key: 'email', type: 'email', placeholder: 'ion@firma.ro' },
                { label: 'Telefon', key: 'phone', type: 'tel', placeholder: '+40 700 000 000' },
              ].map(f => (
                <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</span>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ padding: '10px 14px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 10, fontSize: '0.95rem', background: 'var(--bg, #f9fafb)', color: 'var(--text)', outline: 'none' }}
                  />
                </label>
              ))}

              {/* Role */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rol</span>
                <select
                  value={form.role}
                  onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                  style={{ padding: '10px 14px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 10, fontSize: '0.95rem', background: 'var(--bg, #f9fafb)', color: 'var(--text)', outline: 'none' }}
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Password section */}
            <div style={{ borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: 16, marginBottom: 20 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px' }}>
                {form.id ? 'Schimbare Parolă (lasă gol pentru a nu schimba)' : 'Parolă *'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                {[
                  { label: 'Parolă Nouă', key: 'password' },
                  { label: 'Confirmare Parolă', key: 'confirmPassword' },
                ].map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</span>
                    <input
                      type="password"
                      value={form[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder="••••••••"
                      style={{ padding: '10px 14px', border: `1.5px solid ${form.password && form.confirmPassword && form.password !== form.confirmPassword ? '#ef4444' : 'var(--border, #e5e7eb)'}`, borderRadius: 10, fontSize: '0.95rem', background: 'var(--bg, #f9fafb)', color: 'var(--text)', outline: 'none' }}
                    />
                  </label>
                ))}
              </div>
              {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 6 }}>⚠️ Parolele nu coincid</p>
              )}
            </div>

            {/* Locations (only for manager) */}
            {form.role === 'manager' && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Locații Alocate</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {locations.map(l => (
                    <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 12px', border: `1.5px solid ${form.locations.includes(l.id) ? '#0f766e' : 'var(--border, #e5e7eb)'}`, borderRadius: 20, fontSize: '0.88rem', background: form.locations.includes(l.id) ? 'rgba(15,118,110,0.1)' : 'transparent' }}>
                      <input type="checkbox" checked={form.locations.includes(l.id)} onChange={() => handleToggleLoc(l.id)} style={{ accentColor: '#0f766e' }} />
                      {l.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '12px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 12, background: 'transparent', cursor: 'pointer', fontWeight: 500 }}>
                Anulează
              </button>
              <button onClick={saveUser} disabled={saving} style={{ flex: 2, padding: '12px', border: 'none', borderRadius: 12, background: '#0f766e', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Se salvează...' : (form.id ? '💾 Salvează Modificările' : '+ Adaugă Utilizator')}
              </button>
            </div>
          </div>
        </div>
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
