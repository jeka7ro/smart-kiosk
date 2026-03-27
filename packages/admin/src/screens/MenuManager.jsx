import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthProvider';

const BRAND_COLORS = { smashme: '#ef4444', sushimaster: '#3b82f6', ikura: '#f97316', welovesushi: '#8b5cf6' };

function BrandLogo({ brandId, size = 18 }) {
  const logos = {
    smashme: '/brands/smashme-logo.png',
    sushimaster: '/brands/sushimaster-logo.png',
    welovesushi: '/brands/welovesushi-logo.png',
    ikura: '/brands/ikura-logo.png'
  };
  const src = logos[brandId] || logos.smashme; // fallback
  return <img src={src} alt={brandId} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }} />;
}

export default function MenuManager({ backend }) {
  const { fetchWithAuth } = useAuth();
  const [menuStatus, setMenuStatus] = useState(null);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfileForBrand, setEditingProfileForBrand] = useState(null);

  const fetchMenuStatus = useCallback(() => {
    fetchWithAuth(`${backend}/api/menu/status`)
      .then(r => r.json())
      .then(d => setMenuStatus(d))
      .catch(() => {});
  }, [backend, fetchWithAuth]);

  const fetchBrands = useCallback(() => {
    fetchWithAuth(`${backend}/api/brands`)
      .then(r => r.json())
      .then(d => {
        setBrands(d.brands || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [backend, fetchWithAuth]);

  useEffect(() => {
    fetchMenuStatus();
    fetchBrands();
  }, [fetchMenuStatus, fetchBrands]);

  const saveBrandData = async (brandObj) => {
    try {
      await fetchWithAuth(`${backend}/api/brands/${brandObj.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandObj),
      });
      fetchBrands();
    } catch (e) {
      console.error('Failed to save brand', e);
    }
  };

  const createProfile = (brandId) => {
    const brand = brands.find(b => b.id === brandId);
    if (!brand) return;
    const name = window.prompt("Nume profil (ex: Meniu Terasă):");
    if (!name) return;
    
    const newProfile = {
      id: `profile_${Date.now()}`,
      name,
      rootFolderId: null,
      hiddenItems: {}
    };

    const updatedData = {
      ...brand.data,
      menuProfiles: [...(brand.data?.menuProfiles || []), newProfile]
    };

    saveBrandData({ ...brand, data: updatedData });
  };

  const deleteProfile = (brandId, profileId) => {
    if (!window.confirm("Sigur ștergi acest profil?")) return;
    const brand = brands.find(b => b.id === brandId);
    const updatedData = {
      ...brand.data,
      menuProfiles: (brand.data?.menuProfiles || []).filter(p => p.id !== profileId)
    };
    saveBrandData({ ...brand, data: updatedData });
  };

  if (loading) return <p className="loading-text">Se încarcă managerul de meniu...</p>;

  return (
    <div className="admin-section">
      <div className="section-header" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Status SincRONIZARE POS</h2>
        <button className="um-btn" onClick={fetchMenuStatus} style={{ borderRadius: 30 }}>Re-sincronizare Check</button>
      </div>

      {!menuStatus ? (
        <p className="loading-text">Se încarcă...</p>
      ) : menuStatus.error ? (
        <div className="error-box">{menuStatus.error}</div>
      ) : (
        <div className="menu-status-grid" style={{ marginBottom: 40 }}>
          {menuStatus.brands?.map(b => (
            <div key={b.brandId} className="menu-status-card"
                 style={{ '--bc': BRAND_COLORS[b.brandId] || 'var(--primary)' }}>
              <div className="ms-header">
                <span className="ms-brand" style={{display:'flex', alignItems:'center', gap:'8px'}}>
                  <BrandLogo brandId={b.brandId} size={20} /> {b.name || b.brandId}
                </span>
                <span className="ms-badge">{b.source}</span>
              </div>
              <div className="ms-stats" style={{ display: 'flex', gap: 16 }}>
                <div className="ms-stat"><span>Categorii</span><strong>{b.categories}</strong></div>
                <div className="ms-stat"><span>Produse</span><strong>{b.products}</strong></div>
              </div>
              <div className="ms-sync" style={{ fontSize: '0.8rem', marginTop: 12, opacity: 0.7 }}>
                Ultima Modificare POS: {b.syncedAt ? new Date(b.syncedAt).toLocaleTimeString('ro-RO') : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MENU PROFILES SECTION */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Șabloane & Profile de Meniu</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
        Creează "Profile de Meniu" pe fiecare Brand. Poți ascunde din POS foldere sau produse specifice. Ulterior, aloci aceste profile individual pe fiecare Kiosk în parte (ex: Kiosk Terasă - Doar Băuturi).
      </p>

      {menuStatus?.brands?.map(mb => {
        const brand = brands.find(b => b.id === mb.brandId);
        if (!brand) return null;
        const profiles = brand.data?.menuProfiles || [];

        return (
          <div key={brand.id} style={{ background: 'var(--surface)', padding: 24, borderRadius: 16, border: '1px solid var(--border)', marginBottom: 24, boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <BrandLogo brandId={brand.id} size={32} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>Profile {brand.name}</h3>
              </div>
              <button 
                className="um-btn" 
                style={{ background: 'var(--text)', color: 'var(--bg)', borderRadius: 30 }}
                onClick={() => createProfile(brand.id)}
              >
                + Adaugă Profil
              </button>
            </div>

            {profiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', background: 'var(--bg-surface)', borderRadius: 12, border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                Niciun profil de meniu creat pentru {brand.name}. Fiecare Kiosk va afișa meniul 100% complet implicit.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {profiles.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <div>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--text)', display: 'block', marginBottom: 4 }}>{p.name}</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {Object.keys(p.hiddenItems || {}).length} elemente debifate (ascunse)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        className="um-btn um-btn--ghost" 
                        style={{ borderRadius: 30, padding: '8px 16px', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none' }}
                        onClick={() => setEditingProfileForBrand({ brand, profile: p })}
                      >
                        Editează Arborele
                      </button>
                      <button 
                        className="um-btn um-btn--ghost" 
                        style={{ borderRadius: '50%', width: 34, height: 34, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', background: '#fee2e2' }}
                        onClick={() => deleteProfile(brand.id, p.id)}
                        title="Șterge Profile"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editingProfileForBrand && (
        <MenuProfileEditorModal 
          backend={backend}
          brand={editingProfileForBrand.brand}
          profile={editingProfileForBrand.profile}
          onClose={() => setEditingProfileForBrand(null)}
          onSave={(updatedProfile) => {
            const b = editingProfileForBrand.brand;
            const updatedData = {
              ...b.data,
              menuProfiles: b.data.menuProfiles.map(p => p.id === updatedProfile.id ? updatedProfile : p)
            };
            saveBrandData({ ...b, data: updatedData });
            setEditingProfileForBrand(null);
          }}
        />
      )}
    </div>
  );
}

// Fullscreen Modal for editing the Menu Tree visibility
export function MenuProfileEditorModal({ backend, brand, profile, onClose, onSave, localHiddenItemsOverride = null }) {
  const { fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState({ categories: [], products: [] });
  // Map of hidden IDs (true = hidden) - Either Local Overrides OR the Profile Native Settings
  const [hiddenItems, setHiddenItems] = useState(localHiddenItemsOverride || profile.hiddenItems || {});
  const [rootFolderId, setRootFolderId] = useState(profile.rootFolderId || '');

  useEffect(() => {
    // Note: We bypass kiosk filters here and get the raw full synced menu for this brand
    fetchWithAuth(`${backend}/api/menu?brandId=${brand.id}`)
      .then(r => r.json())
      .then(d => {
        setMenu({ categories: d.categories || [], products: d.products || [] });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [backend, brand.id, fetchWithAuth]);

  // Support local overriding mode vs Template editing mode
  useEffect(() => {
    if (localHiddenItemsOverride !== null) {
      setHiddenItems(localHiddenItemsOverride);
    }
  }, [localHiddenItemsOverride]);

  const handleToggleHide = (id, hidden) => {
    setHiddenItems(prev => {
      const next = { ...prev };
      if (hidden) next[id] = true;
      else if (localHiddenItemsOverride !== null) next[id] = false; // if local override, false means explicit UNHIDE
      else delete next[id]; // if template, missing means default (visible)
      return next;
    });
  };

  const renderCategoryTree = (categories, parentId) => {
    const children = categories.filter(c => c.parentGroup === parentId);
    if (!children.length) return null;

    return (
      <div style={{ marginLeft: parentId ? 24 : 0, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children.map(cat => {
          // If we're in template edit, we check hiddenItems directly.
          // If in kiosk edit, hiddenItems is merged local overrides. true = hidden, false = explicit visible.
          // Let's rely on the base profile to figure out if it's hidden by template.
          const isHiddenByTemplate = profile.hiddenItems?.[cat.id] === true;
          const isLocallyHidden = hiddenItems[cat.id] === true;
          const isLocallyVisible = hiddenItems[cat.id] === false;
          
          let effectivelyHidden = isHiddenByTemplate;
          if (localHiddenItemsOverride !== null) {
             effectivelyHidden = isLocallyHidden || (isHiddenByTemplate && !isLocallyVisible);
          } else {
             effectivelyHidden = isLocallyHidden;
          }

          const hasProds = menu.products.filter(p => p.categoryId === cat.id);
          
          return (
            <div key={cat.id} style={{ padding: '8px 12px', background: parentId ? 'rgba(0,0,0,0.02)' : '#f8f9fa', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasProds.length ? 8 : 0 }}>
                <strong style={{ opacity: effectivelyHidden ? 0.4 : 1, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', gap: 8, fontSize: parentId ? '0.9rem' : '1.05rem' }}>
                   📁 {cat.name}
                </strong>
                <label className="pc-toggle" style={{ margin: 0, transform: 'scale(0.85)' }}>
                  <input type="checkbox" checked={!effectivelyHidden} onChange={e => handleToggleHide(cat.id, !e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Prod items */}
              {hasProds.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
                  {hasProds.map(p => {
                    const isPHiddenByTemplate = profile.hiddenItems?.[p.id] === true;
                    const isPLocallyHidden = hiddenItems[p.id] === true;
                    const isPLocallyVisible = hiddenItems[p.id] === false;
                    
                    let pEffectivelyHidden = isPHiddenByTemplate;
                    if (localHiddenItemsOverride !== null) {
                      pEffectivelyHidden = isPLocallyHidden || (isPHiddenByTemplate && !isPLocallyVisible);
                    } else {
                      pEffectivelyHidden = isPLocallyHidden;
                    }

                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#fff', borderRadius: 8, border: '1px solid var(--border)', opacity: (effectivelyHidden || pEffectivelyHidden) ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                        <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>{p.name}</span>
                        <input type="checkbox" checked={!pEffectivelyHidden} disabled={effectivelyHidden} onChange={e => handleToggleHide(p.id, !e.target.checked)} style={{ cursor: effectivelyHidden ? 'not-allowed' : 'pointer', width: 16, height: 16, accentColor: 'var(--primary)', flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              )}

              {renderCategoryTree(categories, cat.id)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 24, border: '1px solid var(--border)', width: '100%', maxWidth: 1000, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--surface)', borderRadius: '24px 24px 0 0', zIndex: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{localHiddenItemsOverride !== null ? 'Personalizare Meniu Kiosk' : `Editare Profil: ${profile.name}`}</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>Brand: {brand.name}</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="um-btn um-btn--ghost" onClick={onClose} style={{ borderRadius: 30 }}>Anulează</button>
            <button className="um-btn" onClick={() => onSave({ ...profile, hiddenItems, rootFolderId: rootFolderId === '' ? null : rootFolderId })} style={{ borderRadius: 30, background: 'var(--primary)', color: '#fff' }}>{localHiddenItemsOverride !== null ? 'Salvează Vizibilitatea Kiosk' : 'Salvează Profilul'}</button>
          </div>
        </div>

        <div style={{ padding: 32 }}>
          {loading ? (
            <p className="loading-text">Se descarcă arborele meniului...</p>
          ) : (
            <>
              {/* Optional Root Folder is only editable when editing the base Profile */}
              {localHiddenItemsOverride === null && (
                <div style={{ marginBottom: 24, padding: 20, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Sursă / Mapa Principală Rădăcină (Opțional)</label>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
                    Prin selectarea unei mape rădăcină, Kiosk-ul va ignora ABSOLUT TOT meniul cu excepția acestei mape și a sub-categoriilor ei. Util dacă vrei să restrângi Kioskul doar la folderul "Meniu Exterior".
                  </p>
                  <select className="um-input" value={rootFolderId || ''} onChange={e => setRootFolderId(e.target.value)} style={{ borderRadius: 30, width: '100%', maxWidth: 400 }}>
                    <option value="">-- Ignoră (Extrage complet tot) --</option>
                    {menu.categories.map(c => (
                       <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <h4 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Arbore Vizibilitate (Debifează pentru a ascunde)</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>Dacă debifezi un folder principal, absolut toate produsele de sub el vor fi ascunse automat.</p>
              
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', maxHeight: '55vh', overflowY: 'auto' }}>
                 {renderCategoryTree(menu.categories, null)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
