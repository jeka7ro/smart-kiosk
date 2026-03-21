import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import './UsersManager.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default function UsersManager() {
  const { fetchWithAuth, user: loggedUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ id: null, email: '', password: '', role: 'demo', name: '', locations: [] });
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const uRes = await fetchWithAuth(`${BACKEND}/api/users`);
      if (!uRes.ok) throw new Error('Nu se pot aduce utilizatorii');
      setUsers(await uRes.json());

      const lRes = await fetchWithAuth(`${BACKEND}/api/locations`);
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

  const handleToggleLoc = (locId) => {
    setForm(prev => {
      const locs = prev.locations.includes(locId)
        ? prev.locations.filter(id => id !== locId)
        : [...prev.locations, locId];
      return { ...prev, locations: locs };
    });
  };

  const saveUser = async () => {
    if (!form.email || (!form.id && !form.password)) {
      alert('Email și Parolă obligatorii!');
      return;
    }
    try {
      const url = form.id ? `${BACKEND}/api/users/${form.id}` : `${BACKEND}/api/users`;
      const method = form.id ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setShowAdd(false);
      setForm({ id: null, email: '', password: '', role: 'demo', name: '', locations: [] });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const editUser = (u) => {
    setForm({ id: u.id, email: u.email, password: u.password, role: u.role, name: u.name || '', locations: u.locations || [] });
    setShowAdd(true);
  };

  const deleteUser = async (uId) => {
    if (!confirm('Ești sigur că vrei să ștergi acest utilizator?')) return;
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/users/${uId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loggedUser?.role !== 'admin') {
    return <div style={{padding: 40}}>Doar administratorii au acces aici.</div>;
  }

  if (loading) return <p style={{padding: 40}}>Se încarcă lista de colegi...</p>;
  if (error) return <p style={{padding: 40, color:'red'}}>{error}</p>;

  return (
    <div className="users-manager">
      <div className="um-header">
        <h2 className="section-title">Echipă & Permisiuni</h2>
        <button className="btn-save" onClick={() => { setForm({id:null,email:'',password:'',role:'demo',name:'',locations:[]}); setShowAdd(!showAdd); }}>
          {showAdd ? 'Inapoi' : '+ Adaugă Utilizator'}
        </button>
      </div>

      {showAdd && (
        <div className="um-add-panel">
          <div className="um-form-grid">
            <label>Nume:<input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></label>
            <label>Email:<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></label>
            <label>Parolă:<input type="text" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={form.id ? "Lasă gol pt același" : ""} /></label>
            <label>Permisiune:
              <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                <option value="admin">Admin (Full Access)</option>
                <option value="manager">Manager (Locații selectate)</option>
                <option value="demo">Demo (Read-Only)</option>
              </select>
            </label>
          </div>
          
          {form.role === 'manager' && (
            <div className="um-loc-assign">
              <h4>Permite accesul pe:</h4>
              <div className="loc-grid-mini">
                {locations.map(l => (
                  <label key={l.id} className="loc-check">
                    <input type="checkbox" checked={form.locations.includes(l.id)} onChange={() => handleToggleLoc(l.id)} />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{marginTop: 20}}>
            <button className="btn-save" onClick={saveUser}>💾 Salvează Utilizator</button>
          </div>
        </div>
      )}

      <table className="orders-table">
        <thead>
          <tr>
            <th>Nume / Email</th>
            <th>Rol</th>
            <th>Locații Alocate</th>
            <th>Acțiuni</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td><strong>{u.name || 'Fără Nume'}</strong><br/><small style={{opacity:0.6}}>{u.email}</small></td>
              <td><span className={`tag role-${u.role}`}>{u.role.toUpperCase()}</span></td>
              <td>{u.role === 'admin' ? '🔥 Toate' : u.locations.length ? Object.values(locations).filter(l => u.locations.includes(l.id)).map(l => l.name).join(', ') : 'Niciuna'}</td>
              <td>
                <button style={{marginRight: 10, background:'var(--surface)', border:'1px solid var(--border)', padding:'6px 12px', borderRadius:8}} onClick={() => editUser(u)}>Editează</button>
                {u.id !== 'env-admin' && u.id !== 'u-admin' && (
                  <button style={{background:'var(--surface)', border:'1px solid #ef4444', color:'#ef4444', padding:'6px 12px', borderRadius:8}} onClick={() => deleteUser(u.id)}>Șterge</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
