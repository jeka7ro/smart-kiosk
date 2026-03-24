import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthProvider';
import './ModifierImages.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const BRAND_COLORS = {
  smashme: '#EE3B24',
  sushimaster: '#E31E24',
  ikura: '#7c3aed',
  welovesushi: '#ec4899',
};

export default function ModifierImages() {
  const { fetchWithAuth } = useAuth();
  const [modifiers, setModifiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { id, imageUrl }
  const [saving, setSaving] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchModifiers = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/admin/modifier-images`);
      const data = await res.json();
      setModifiers(data.modifiers || []);
    } catch (e) {
      showToast('Eroare la încărcare: ' + e.message, 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchModifiers(); }, []);

  const startEdit = (mod) => {
    setEditing({ id: mod.id, name: mod.name, brandId: mod.brandId, imageUrl: mod.imageUrl || '' });
  };

  const saveImage = async () => {
    if (!editing?.imageUrl?.trim()) {
      showToast('Introdu un URL de imagine valid', 'err');
      return;
    }
    setSaving(editing.id);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ imageUrl: editing.imageUrl, name: editing.name, brandId: editing.brandId }),
      });
      if (!res.ok) throw new Error('Salvare eșuată');
      showToast(`✅ Imaginea pentru „${editing.name}" a fost salvată!`);
      setEditing(null);
      fetchModifiers();
    } catch (e) {
      showToast('❌ ' + e.message, 'err');
    } finally {
      setSaving(null);
    }
  };

  const deleteImage = async (mod) => {
    if (!confirm(`Ștergi imaginea pentru „${mod.name}"?`)) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${mod.id}`, { method: 'DELETE' });
      showToast('🗑 Imaginea ștearsă');
      fetchModifiers();
    } catch (e) {
      showToast('❌ ' + e.message, 'err');
    }
  };

  // Group by brand
  const filtered = modifiers.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.groupName?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, m) => {
    const key = m.brandId || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  if (loading) return <div className="mi-loading">Se încarcă modificatorii din Syrve...</div>;

  return (
    <div className="mi-page">
      {/* Header */}
      <div className="mi-header">
        <div>
          <h1 className="mi-title">🖼 Imagini Modificatori</h1>
          <p className="mi-subtitle">Adaugă poze pentru opțiunile de meniu (cartofi, băuturi, etc.) — apar automat în kiosk</p>
        </div>
        <input
          className="mi-search"
          placeholder="🔍 Caută modificator..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Groups */}
      {Object.entries(grouped).map(([brandId, mods]) => (
        <div key={brandId} className="mi-brand-section">
          <div className="mi-brand-header" style={{ borderLeftColor: BRAND_COLORS[brandId] || '#6b7280' }}>
            <span className="mi-brand-label">{brandId.toUpperCase()}</span>
            <span className="mi-brand-count">{mods.length} modificatori</span>
          </div>

          <div className="mi-grid">
            {mods.map(mod => (
              <div key={mod.id} className={`mi-card ${mod.imageUrl ? 'mi-card--has-img' : ''}`}>
                {/* Image preview */}
                <div className="mi-img-wrap">
                  {mod.imageUrl ? (
                    <img src={mod.imageUrl} alt={mod.name} className="mi-img" onError={e => { e.target.style.display='none'; }} />
                  ) : (
                    <div className="mi-img-placeholder">
                      <span>📷</span>
                      <small>Fără poză</small>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="mi-card-body">
                  <p className="mi-mod-name">{mod.name}</p>
                  <p className="mi-mod-group">{mod.groupName} {mod.price > 0 ? `· +${mod.price.toFixed(2)} lei` : '· Inclus'}</p>
                </div>

                {/* Actions */}
                <div className="mi-card-actions">
                  <button className="mi-btn-edit" onClick={() => startEdit(mod)}>
                    {mod.imageUrl ? '✏️ Schimbă' : '+ Adaugă Poză'}
                  </button>
                  {mod.imageUrl && (
                    <button className="mi-btn-del" onClick={() => deleteImage(mod)}>🗑</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="mi-empty">
          {search ? `Niciun modificator găsit pentru „${search}"` : 'Niciun modificator în cache. Meniul Syrve trebuie încărcat întâi.'}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="mi-modal-overlay" onClick={() => setEditing(null)}>
          <div className="mi-modal" onClick={e => e.stopPropagation()}>
            <h2 className="mi-modal-title">Imagine pentru:<br /><span>{editing.name}</span></h2>

            {/* Preview */}
            {editing.imageUrl && (
              <div className="mi-modal-preview">
                <img src={editing.imageUrl} alt="preview" onError={e => { e.target.style.display='none'; }} />
              </div>
            )}

            <label className="mi-modal-label">URL Imagine (https://...)</label>
            <input
              className="mi-modal-input"
              type="url"
              placeholder="https://example.com/cartofi.jpg"
              value={editing.imageUrl}
              onChange={e => setEditing(prev => ({ ...prev, imageUrl: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveImage()}
              autoFocus
            />

            <div className="mi-modal-actions">
              <button className="mi-btn-cancel" onClick={() => setEditing(null)}>Anulează</button>
              <button
                className="mi-btn-save"
                onClick={saveImage}
                disabled={saving === editing.id}
              >
                {saving === editing.id ? 'Se salvează...' : '💾 Salvează'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`mi-toast ${toast.type === 'err' ? 'mi-toast--err' : ''}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
