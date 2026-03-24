import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import './UsersManager.css'; // Refolosim stilurile generale din Users/Integrations (tabele, butoane, modale)

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const BRANDS = [
  { id: 'smashme',     label: 'SmashMe',     color: '#ef4444' },
  { id: 'sushimaster', label: 'Sushi Master',color: '#3b82f6' },
  { id: 'welovesushi', label: 'WeLoveSushi', color: '#f59e0b' },
  { id: 'ikura',       label: 'Ikura',       color: '#10b981' }
];

const EMPTY_SLICE = { id: '', name: '', type: 'nada', probability: 10, bg: '#f1f5f9', image: '', productId: '' };
const DEFAULT_WHEEL = { title: 'Învârte Roata Norocului!', slices: [] };

export default function Promotions() {
  const { fetchWithAuth } = useAuth();
  
  const [activeBrand, setActiveBrand] = useState('smashme');
  const [configList, setConfigList]   = useState({}); // { brandId: { active, config } }
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);
  
  // Products from iiko Menu
  const [menuProducts, setMenuProducts] = useState([]);

  // Edit State
  const [localActive, setLocalActive] = useState(false);
  const [localConfig, setLocalConfig] = useState({ ...DEFAULT_WHEEL });

  // Modal State
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingSlice, setEditingSlice] = useState(null);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/promotions`);
      const data = await res.json();
      setConfigList(data || {});
    } catch (e) {
      showToast('❌ Eoare fetch', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPromos(); }, []);

  // Update local state when switching brand or when data loads
  useEffect(() => {
    const actData = configList[activeBrand];
    setLocalActive(actData?.active || false);
    setLocalConfig(actData?.config?.slices ? actData.config : { ...DEFAULT_WHEEL });
  }, [activeBrand, configList]);

  // Fetch menu products for active brand
  useEffect(() => {
    if (!activeBrand) return;
    fetchWithAuth(`${BACKEND}/api/menu/items?brand=${activeBrand}&limit=1500`)
      .then(res => res.json())
      .then(data => setMenuProducts(data.items || data || []))
      .catch(() => setMenuProducts([]));
  }, [activeBrand]);

  const handleSaveAll = async () => {
    // Validate probabilities
    const sum = (localConfig.slices || []).reduce((acc, s) => acc + (s.probability || 0), 0);
    if (sum !== 100 && localConfig.slices?.length > 0) {
      return showToast(`❌ Total procente trebuie să fie 100% (curent: ${sum}%)`, 'err');
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/promotions/${activeBrand}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: localActive, config: localConfig })
      });
      if (!res.ok) throw new Error('Failed to save');
      showToast('✅ Salvat cu succes');
      await fetchPromos();
    } catch (e) {
      showToast('❌ Eroare la salvare', 'err');
    } finally {
      setSaving(false);
    }
  };

  const openSliceModal = (slice = null) => {
    setEditingSlice(slice ? { ...slice } : { ...EMPTY_SLICE, id: Date.now().toString() });
    setModalOpen(true);
  };

  const closeSliceModal = () => {
    setEditingSlice(null);
    setModalOpen(false);
  };

  const saveSlice = () => {
    if (!editingSlice.name) return showToast('Nume obligatoriu', 'err');
    
    let slices = [...(localConfig.slices || [])];
    const idx = slices.findIndex(s => s.id === editingSlice.id);
    if (idx >= 0) {
      slices[idx] = editingSlice;
    } else {
      slices.push(editingSlice);
    }
    setLocalConfig({ ...localConfig, slices });
    closeSliceModal();
  };

  const deleteSlice = (id) => {
    if (!confirm('Ștergi această felie?')) return;
    setLocalConfig({ ...localConfig, slices: localConfig.slices.filter(s => s.id !== id) });
  };

  // UI Helpers
  const totalProb = (localConfig.slices || []).reduce((acc, s) => acc + (s.probability || 0), 0);
  const pbColor   = totalProb === 100 ? '#10b981' : totalProb > 100 ? '#ef4444' : '#f59e0b';

  if (loading && Object.keys(configList).length === 0) return <div style={{ padding: 40, color: 'var(--text)' }}>Loading...</div>;

  return (
    <div className="um-page" style={{ position: 'relative' }}>
      
      {/* Brand Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {BRANDS.map(b => {
          const isActive = activeBrand === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setActiveBrand(b.id)}
              style={{
                background: isActive ? b.color : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                border: `1px solid ${isActive ? b.color : 'var(--border)'}`,
                padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: isActive ? `0 4px 12px ${b.color}40` : 'none'
              }}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Main Form Area */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text)' }}>Promoții / Roata Norocului ({BRANDS.find(b=>b.id===activeBrand)?.label})</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configurează premiile de pe roată. Când Kiosk-ul este multi-brand, roata va conține proporțional feliile de la ambele branduri.</p>
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--bg-surface)', padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Roată Activă</span>
            <input type="checkbox" style={{ transform: 'scale(1.2)' }} checked={localActive} onChange={e => setLocalActive(e.target.checked)} />
          </label>
        </div>

        {/* Global Settings */}
        <div style={{ marginBottom: 32, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 250 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Titlu Modal Roată</label>
            <input 
              type="text" 
              value={localConfig.title || ''} 
              onChange={e => setLocalConfig({...localConfig, title: e.target.value})} 
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
              placeholder="Învârte roata și câștigă!"
            />
          </div>
        </div>

        {/* Slices List */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>Felii Roată ({localConfig.slices?.length || 0})</h3>
          <button className="um-btn um-btn--primary" onClick={() => openSliceModal()}>+ Adaugă Felie</button>
        </div>

        <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>PREMIU</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>TIP</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>BACKGROUND</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>PROBABILITATE</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textAlign: 'right' }}>ACȚIUNI</th>
              </tr>
            </thead>
            <tbody>
              {(!localConfig.slices || localConfig.slices.length === 0) ? (
                <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Nicio felie adăugată.</td></tr>
              ) : localConfig.slices.map(slice => (
                <tr key={slice.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {slice.image ? (
                        <img src={slice.image} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: '#fff', border: '1px solid var(--border)' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: slice.bg || '#ccc', border: '1px solid var(--border)' }} />
                      )}
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{slice.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text)' }}>
                    <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 6, fontSize: '0.8rem' }}>
                      {slice.type === 'product' ? 'Produs Gratuit' : slice.type === 'discount' ? 'Reducere' : 'Ghinion'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      <span style={{ width: 14, height: 14, borderRadius: 3, background: slice.bg, border: '1px solid var(--border)', display: 'inline-block' }} />
                      {slice.bg}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text)' }}>{slice.probability}%</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openSliceModal(slice)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: 6, borderRadius: 6, cursor: 'pointer', marginRight: 6 }}>Editează</button>
                    <button onClick={() => deleteSlice(slice.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: 6, borderRadius: 6, cursor: 'pointer' }}>Șterge</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '14px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>* Asigurați-vă că totalul este fix 100%.</span>
            <span style={{ fontWeight: 800, color: pbColor, background: `${pbColor}22`, padding: '4px 10px', borderRadius: 8 }}>Total: {totalProb}%</span>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="um-btn um-btn--primary" onClick={handleSaveAll} disabled={saving} style={{ padding: '12px 32px', fontSize: '1rem', borderRadius: 12 }}>
            {saving ? 'Se salvează...' : 'Salvează Configurarea'}
          </button>
        </div>
      </div>

      {/* Modal adăugare/editare felie */}
      {modalOpen && editingSlice && (
        <div className="um-modal-overlay">
          <div className="um-modal" style={{ maxWidth: 440 }}>
            <h3 className="um-modal-title" style={{ marginTop: 0 }}>{editingSlice.id.length > 10 ? 'Adaugă' : 'Editează'} Felie</h3>
            
            <div className="um-form-group">
              <label>Tip Premiu</label>
              <select value={editingSlice.type} onChange={e => setEditingSlice({...editingSlice, type: e.target.value})} className="um-input">
                <option value="product">Produs din Meniu (iiko)</option>
                <option value="discount">Discount / Cod Promo</option>
                <option value="nada">Necâștigător (Mai încearcă)</option>
              </select>
            </div>

            {editingSlice.type === 'product' && menuProducts.length > 0 && (
              <div className="um-form-group">
                <label>Alege Produsul Reale (iiko)</label>
                <select 
                  className="um-input" 
                  value={editingSlice.productId || ''}
                  onChange={e => {
                    const prodId = e.target.value;
                    const prod = menuProducts.find(p => p.id === prodId);
                    if (prod) {
                      setEditingSlice({
                        ...editingSlice,
                        productId: prod.id,
                        name: prod.name,
                        image: (prod.imageLinks && prod.imageLinks[0]) || prod.image || ''
                      });
                    } else {
                      setEditingSlice({ ...editingSlice, productId: '' });
                    }
                  }}
                >
                  <option value="">-- Caută/Alege produs --</option>
                  {menuProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.price ? p.price + ' RON' : '-'})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="um-form-group">
              <label>Nume Afișat pe Roată {editingSlice.type === 'product' && '(completat automat)'}</label>
              <input type="text" value={editingSlice.name} onChange={e => setEditingSlice({...editingSlice, name: e.target.value})} className="um-input" />
            </div>

            <div className="um-form-group">
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>Background (Hex)</label>
                  <input type="text" value={editingSlice.bg} onChange={e => setEditingSlice({...editingSlice, bg: e.target.value})} className="um-input" placeholder="#ff0000" />
                </div>
                <div style={{ width: 44, display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
                  <input type="color" value={editingSlice.bg} onChange={e => setEditingSlice({...editingSlice, bg: e.target.value})} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                </div>
              </div>
            </div>

            <div className="um-form-group">
              <label>Șansă Câștig (%) - Probabilitate</label>
              <input type="number" min="0" max="100" value={editingSlice.probability} onChange={e => setEditingSlice({...editingSlice, probability: Number(e.target.value)})} className="um-input" />
            </div>

            <div className="um-form-group" style={{ marginBottom: 24 }}>
              <label>Imagine Premiu (URL)</label>
              <input type="text" value={editingSlice.image} onChange={e => setEditingSlice({...editingSlice, image: e.target.value})} className="um-input" placeholder="https://...png" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avatar mic renderizat pe roată (opțional)</span>
            </div>

            <div className="um-modal-footer">
              <button className="um-btn um-btn--ghost" onClick={closeSliceModal}>Anulează</button>
              <button className="um-btn um-btn--primary" onClick={saveSlice}>Gata</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`um-toast ${toast.type === 'err' ? 'um-toast--err' : ''}`}>{toast.msg}</div>}
    </div>
  );
}
