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
  const [actionModal, setActionModal] = useState(null);
  const [inputValue, setInputValue] = useState('');

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

  const createProfile = (brandId, name) => {
    const brand = brands.find(b => b.id === brandId);
    if (!brand || !name.trim()) return;
    
    const newProfile = {
      id: `profile_${Date.now()}`,
      name: name.trim(),
      rootFolderId: null,
      hiddenItems: {}
    };

    const updatedData = {
      ...brand.data,
      menuProfiles: [...(brand.data?.menuProfiles || []), newProfile]
    };

    saveBrandData({ ...brand, data: updatedData });
  };

  const deleteProfileConfirmed = (brandId, profileId) => {
    const brand = brands.find(b => b.id === brandId);
    if (!brand) return;
    const updatedData = {
      ...brand.data,
      menuProfiles: (brand.data?.menuProfiles || []).filter(p => p.id !== profileId)
    };
    saveBrandData({ ...brand, data: updatedData });
  };

  if (editingProfileForBrand) {
    return (
      <div className="admin-section" style={{ padding: 0 }}>
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
      </div>
    );
  }

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
                onClick={() => { setInputValue(''); setActionModal({ type: 'create', brandId: brand.id, brandName: brand.name }); }}
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
                        onClick={() => setActionModal({ type: 'delete', brandId: brand.id, profileId: p.id, profileName: p.name })}
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


      {/* CUSTOM PROMPT MODALS TO AVOID NATIVE BROWSER POPUPS BLOCKING */}
      {actionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 450, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
            
            {actionModal.type === 'create' && (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.4rem' }}>Creează Profil Nou</h3>
                <p style={{ margin: '0 0 24px', color: 'var(--text-muted)' }}>Introdu un nume pentru noul profil al brandului <strong>{actionModal.brandName}</strong>.</p>
                <input 
                  autoFocus
                  type="text" 
                  value={inputValue} 
                  onChange={e => setInputValue(e.target.value)} 
                  placeholder="ex: Meniu Terasă"
                  style={{ width: '100%', padding: '14px 16px', fontSize: '1.1rem', borderRadius: 12, border: '2px solid var(--border)', marginBottom: 32, background: 'var(--bg-surface)', outline: 'none' }}
                  onKeyDown={e => { if (e.key === 'Enter' && inputValue.trim()) { createProfile(actionModal.brandId, inputValue); setActionModal(null); } }}
                />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button className="um-btn um-btn--ghost" onClick={() => setActionModal(null)} style={{ borderRadius: 30 }}>Anulează</button>
                  <button className="um-btn" onClick={() => { createProfile(actionModal.brandId, inputValue); setActionModal(null); }} style={{ borderRadius: 30, background: 'var(--primary)', color: '#fff' }} disabled={!inputValue.trim()}>Creează Profil</button>
                </div>
              </>
            )}

            {actionModal.type === 'delete' && (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.4rem' }}>Ștergere Profil</h3>
                <p style={{ margin: '0 0 32px', color: 'var(--text-muted)' }}>Sigur dorești să ștergi profilul de meniu <strong>{actionModal.profileName}</strong>? Kiosk-urile care folosesc acest profil vor reveni la meniul complet standard, deci va trebui să le reatribui.</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button className="um-btn um-btn--ghost" onClick={() => setActionModal(null)} style={{ borderRadius: 30 }}>Anulează</button>
                  <button className="um-btn" onClick={() => { deleteProfileConfirmed(actionModal.brandId, actionModal.profileId); setActionModal(null); }} style={{ borderRadius: 30, background: '#ef4444', color: '#fff' }}>Da, Șterge Definitiv</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// Fullscreen Modal for editing the Menu Tree visibility
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
function proxySyrveImage(url) {
  if (!url) return '';
  return `${BACKEND_URL}/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export function MenuProfileEditorModal({ backend, brand, profile, onClose, onSave, localHiddenItemsOverride = null }) {
  const { fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState({ categories: [], products: [] });
  const [hiddenItems, setHiddenItems] = useState(localHiddenItemsOverride || profile.hiddenItems || {});
  const [rootFolderId, setRootFolderId] = useState(profile.rootFolderId || '');
  const [activeTab, setActiveTab] = useState(null); // Category ID for sidebar navigation

  useEffect(() => {
    fetchWithAuth(`${backend}/api/menu?brandId=${brand.id}`)
      .then(r => r.json())
      .then(d => {
        setMenu({ categories: d.categories || [], products: d.products || [] });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [backend, brand.id, fetchWithAuth]);

  useEffect(() => {
    if (localHiddenItemsOverride !== null) setHiddenItems(localHiddenItemsOverride);
  }, [localHiddenItemsOverride]);

  const handleToggleHide = (id, hidden) => {
    setHiddenItems(prev => {
      const next = { ...prev };
      if (hidden) next[id] = true;
      else if (localHiddenItemsOverride !== null) next[id] = false; 
      else delete next[id]; 
      return next;
    });
  };

  const renderCategoryTree = (categories, parentId) => {
    const children = categories.filter(c => {
      if (!parentId) return !c.parentGroup || c.parentGroup === null || c.parentGroup === "null";
      return c.parentGroup === parentId;
    });
    // For the main render block, if we don't have children but the parent itself matches activeTab, we STILL want to render the parent container!
    // But our recursive tree always renders children. If activeTab has NO subfolders but has products, we must render them.
    if (!children.length && !parentId) return null;

    // Wait, if activeTab is selected, parentId === activeTab. If activeTab has NO children, children.length is 0.
    // To fix this, if parentId === activeTab and activeTab has NO children, we just render the activeTab ITSELF.
    // We achieve this logically before calling renderCategoryTree, by including the active node if needed, 
    // but the recursive nature handles it fine if we just render the node that matches!
    const nodesToRender = parentId === activeTab ? categories.filter(c => c.id === activeTab) : children;

    if (!nodesToRender.length) return null;

    return (
      <div style={{ marginLeft: (parentId && parentId !== activeTab) ? 24 : 0, marginTop: parentId ? 16 : 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {nodesToRender.map(cat => {
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
          const hasChildren = categories.some(c => c.parentGroup === cat.id);
          
          return (
            <div key={cat.id} style={{ padding: '16px 20px', background: '#fff', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasProds.length ? 16 : 0 }}>
                <strong style={{ opacity: effectivelyHidden ? 0.4 : 1, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', gap: 12, fontSize: '1.15rem', color: '#1e293b' }}>
                   📁 {cat.name}
                </strong>
                <label className="pc-toggle" style={{ margin: 0, transform: 'scale(1)' }}>
                  <input type="checkbox" checked={!effectivelyHidden} onChange={e => handleToggleHide(cat.id, !e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              {hasProds.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
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
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', opacity: (effectivelyHidden || pEffectivelyHidden) ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                          {p.image && (
                            <img src={proxySyrveImage(p.image)} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,0.05)' }} />
                          )}
                          <span style={{ fontSize: '0.95rem', lineHeight: '1.3', fontWeight: 500, color: '#334155' }}>{p.name}</span>
                        </div>
                        <input type="checkbox" checked={!pEffectivelyHidden} disabled={effectivelyHidden} onChange={e => handleToggleHide(p.id, !e.target.checked)} style={{ cursor: effectivelyHidden ? 'not-allowed' : 'pointer', width: 22, height: 22, accentColor: 'var(--primary)', flexShrink: 0, marginLeft: 12 }} />
                      </div>
                    );
                  })}
                </div>
              )}

              {hasChildren && renderCategoryTree(categories, cat.id)}
            </div>
          );
        })}
      </div>
    );
  };

  // Derive root Level Items for the Horizontal Navigation Tabs!
  let rootMenuItems = menu.categories.filter(c => {
     const startNode = rootFolderId || null;
     if (!startNode) return !c.parentGroup || c.parentGroup === null || c.parentGroup === "null";
     return c.parentGroup === startNode;
  });

  // If a root folder is selected but has NO sub-categories (it's a leaf category),
  // make the folder itself the only available tab so its products can be edited!
  if (rootFolderId && rootMenuItems.length === 0) {
     const selfCategory = menu.categories.find(c => c.id === rootFolderId);
     if (selfCategory) {
        rootMenuItems = [selfCategory];
     }
  }

  // Auto-select first tab when available and not already set
  useEffect(() => {
    if (!activeTab && rootMenuItems.length > 0) {
      setActiveTab(rootMenuItems[0].id);
    }
  }, [rootMenuItems, activeTab]);

  return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 24, border: '1px solid var(--border)', padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
      
      {/* Header Area */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="um-btn um-btn--ghost" onClick={onClose} style={{ borderRadius: '50%', width: 44, height: 44, padding: 0, background: 'var(--surface)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text)' }}>{localHiddenItemsOverride !== null ? 'Personalizare Meniu Kiosk' : `Editare Profil: ${profile.name}`}</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: 4 }}>Brand: {brand.name}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="um-btn um-btn--ghost" onClick={onClose} style={{ borderRadius: 30, padding: '0 24px' }}>Renunță</button>
          <button className="um-btn" onClick={() => onSave({ ...profile, hiddenItems, rootFolderId: rootFolderId === '' ? null : rootFolderId })} style={{ borderRadius: 30, background: 'var(--primary)', color: '#fff', padding: '0 32px' }}>
            {localHiddenItemsOverride !== null ? 'Salvează Vizibilitate' : 'Salvează Profilul'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Se încarcă structura meniului din integrări POS...</div>
      ) : (
        <>
          {/* Top Config Root Folder */}
          {localHiddenItemsOverride === null ? (
            <div style={{ padding: 24, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontWeight: 600, fontSize: '1.05rem', margin: 0 }}>Sursă / Mapa Principală Rădăcină (Opțional)</label>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, maxWidth: 800 }}>Prin selectarea unei mape, Kiosk-ul va extrage structura meniului strict pornind din acel dosar. Ideal dacă dorești ca profilul să controleze, de exemplu, doar un meniu de Terasă sau Bar.</p>
              <select className="um-input" value={rootFolderId || ''} onChange={e => { setRootFolderId(e.target.value); setActiveTab(null); }} style={{ borderRadius: 12, width: '100%', maxWidth: 400, marginTop: 8 }}>
                <option value="">-- Extrage Tot (Fără Rădăcină Specifică) --</option>
                {menu.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ padding: 20, background: 'rgba(59, 130, 246, 0.08)', borderRadius: 16, border: '1px solid rgba(59, 130, 246, 0.2)', color: '#1e3a8a', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Modifici vizibilitatea meniului în regim <strong>suprascriere locală Kiosk</strong>. Toate ascunderile debifate aici se aplică exclusiv pe acest aparat, adăugându-se peste restricțiile care ar veni din Profilul de Bază.
            </div>
          )}

          <div>
            <h4 style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categorii</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
               {rootMenuItems.map(c => (
                 <button 
                   key={c.id}
                   onClick={() => setActiveTab(c.id)}
                   style={{
                     padding: '8px 18px', borderRadius: 20,
                     background: activeTab === c.id ? '#0f172a' : 'var(--surface)',
                     border: `1.5px solid ${activeTab === c.id ? '#0f172a' : 'var(--border)'}`,
                     color: activeTab === c.id ? '#fff' : 'var(--text)',
                     fontWeight: activeTab === c.id ? 700 : 500,
                     fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s',
                     whiteSpace: 'nowrap',
                   }}
                 >
                    {c.name}
                 </button>
               ))}
               {rootMenuItems.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nu a fost găsită nicio categorie.</span>}
            </div>
          </div>

          {/* Render Area */}
          <div style={{ flex: 1, minHeight: 400 }}>
            {activeTab && renderCategoryTree(menu.categories, activeTab)}
          </div>
        </>
      )}
    </div>
  );
}
