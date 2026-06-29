import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthProvider';

const BRAND_COLORS = { smashme: '#ef4444', crunch: '#eab308', rollmaster: '#3b82f6', lovesushi: '#ec4899', pokiwoki: '#f97316' };

function BrandLogo({ brandId, size = 18 }) {
  const logos = {
    smashme: '/brands/smashme-logo.png',
    crunch: '/brands/crunch-logo.png',
    rollmaster: '/brands/rollmaster-logo.png',
    lovesushi: '/brands/lovesushi-logo.png',
    pokiwoki: '/brands/pokiwoki-logo.png',
    ikura: '/brands/ikura-logo.png'
  };
  const src = logos[brandId] || logos.smashme; // fallback
  return (
    <>
      <img src={src} alt={brandId} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline-block'; }} />
      <span style={{ display: 'none', fontSize: size * 0.8, fontWeight: 700, opacity: 0.6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{brandId}</span>
    </>
  );
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

  if (loading) return <p className="text-slate-500 font-medium py-10 text-center animate-pulse">Se încarcă managerul de meniu...</p>;

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button className="px-5 h-10 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors" onClick={fetchMenuStatus}>
          Re-sincronizare Check
        </button>
      </div>

      {!menuStatus ? (
        <p className="text-slate-500 font-medium py-10 text-center animate-pulse">Se încarcă...</p>
      ) : menuStatus.error ? (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800 font-medium">{menuStatus.error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {menuStatus.brands?.map(b => (
            <div key={b.brandId} className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
                 style={{ borderTop: `4px solid ${BRAND_COLORS[b.brandId] || '#3b82f6'}` }}>
              <div className="flex items-center justify-between mb-6">
                <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-lg">
                  <BrandLogo brandId={b.brandId} size={24} /> {b.name || b.brandId}
                </span>
                <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 uppercase tracking-wider">{b.source}</span>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Categorii</span>
                  <strong className="text-2xl text-slate-900 dark:text-white">{b.categories}</strong>
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Produse</span>
                  <strong className="text-2xl text-slate-900 dark:text-white">{b.products}</strong>
                </div>
              </div>
              <div className="text-xs font-medium text-slate-400 mt-4 text-center">
                Ultima Modificare POS: {b.syncedAt ? new Date(b.syncedAt).toLocaleTimeString('ro-RO') : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MENU PROFILES SECTION */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Șabloane & Profile de Meniu</h2>
        <p className="text-slate-500 text-sm mb-8 max-w-3xl">
          Creează "Profile de Meniu" pe fiecare Brand. Poți ascunde din POS foldere sau produse specifice. Ulterior, aloci aceste profile individual pe fiecare Kiosk în parte (ex: Kiosk Terasă - Doar Băuturi).
        </p>

        <div className="space-y-6">
          {menuStatus?.brands?.map(mb => {
            const brand = brands.find(b => b.id === mb.brandId);
            if (!brand) return null;
            const profiles = brand.data?.menuProfiles || [];

            return (
              <div key={brand.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 gap-4">
                  <div className="flex items-center gap-3">
                    <BrandLogo brandId={brand.id} size={32} />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Profile {brand.name}</h3>
                  </div>
                  <button 
                    className="shrink-0 px-5 h-10 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-sm font-bold transition-colors shadow-sm" 
                    onClick={() => { setInputValue(''); setActionModal({ type: 'create', brandId: brand.id, brandName: brand.name }); }}
                  >
                    + Adaugă Profil
                  </button>
                </div>

                <div className="p-6">
                  {profiles.length === 0 ? (
                    <div className="text-center py-10 px-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-sm font-medium">
                      Niciun profil de meniu creat pentru {brand.name}.<br/>Fiecare Kiosk va afișa meniul 100% complet implicit.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {profiles.map(p => (
                        <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 gap-4 transition-colors hover:border-slate-300 dark:hover:border-slate-600">
                          <div>
                            <strong className="block text-base text-slate-900 dark:text-white mb-1">{p.name}</strong>
                            <span className="text-sm font-medium text-slate-500">
                              {Object.keys(p.hiddenItems || {}).length} elemente debifate (ascunse)
                            </span>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button 
                              className="px-4 h-9 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-bold transition-colors" 
                              onClick={() => setEditingProfileForBrand({ brand, profile: p })}
                            >
                              Editează Arborele
                            </button>
                            <button 
                              className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors"
                              onClick={() => setActionModal({ type: 'delete', brandId: brand.id, profileId: p.id, profileName: p.name })}
                              title="Șterge Profile"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CUSTOM PROMPT MODALS TO AVOID NATIVE BROWSER POPUPS BLOCKING */}
      {actionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800">
            
            {actionModal.type === 'create' && (
              <>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Creează Profil Nou</h3>
                <p className="text-sm text-slate-500 mb-6">Introdu un nume pentru noul profil al brandului <strong className="text-slate-900 dark:text-white">{actionModal.brandName}</strong>.</p>
                <input 
                  autoFocus
                  type="text" 
                  value={inputValue} 
                  onChange={e => setInputValue(e.target.value)} 
                  placeholder="ex: Meniu Terasă"
                  className="w-full px-4 h-12 text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all mb-8 shadow-inner"
                  onKeyDown={e => { if (e.key === 'Enter' && inputValue.trim()) { createProfile(actionModal.brandId, inputValue); setActionModal(null); } }}
                />
                <div className="flex gap-3 justify-end">
                  <button className="px-5 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors" onClick={() => setActionModal(null)}>Anulează</button>
                  <button className="px-5 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => { createProfile(actionModal.brandId, inputValue); setActionModal(null); }} disabled={!inputValue.trim()}>Creează Profil</button>
                </div>
              </>
            )}

            {actionModal.type === 'delete' && (
              <>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ștergere Profil</h3>
                <p className="text-sm text-slate-500 mb-8">
                  Sigur dorești să ștergi profilul de meniu <strong className="text-slate-900 dark:text-white">{actionModal.profileName}</strong>? Kiosk-urile care folosesc acest profil vor reveni la meniul complet standard, deci va trebui să le reatribui.
                </p>
                <div className="flex gap-3 justify-end">
                  <button className="px-5 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors" onClick={() => setActionModal(null)}>Anulează</button>
                  <button className="px-5 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm transition-all" onClick={() => { deleteProfileConfirmed(actionModal.brandId, actionModal.profileId); setActionModal(null); }}>Da, Șterge Definitiv</button>
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
  if (url.startsWith('/uploads')) {
    const base = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
    return `${base}${url}`;
  }
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
      <div className={`flex flex-col gap-3 ${parentId && parentId !== activeTab ? 'ml-6' : ''} ${parentId ? 'mt-4' : ''}`}>
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
            <div key={cat.id} className="p-4 sm:p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
              <div className={`flex items-center justify-between ${hasProds.length ? 'mb-4' : ''}`}>
                <strong className={`flex items-center gap-3 text-lg text-slate-900 dark:text-white transition-opacity duration-200 ${effectivelyHidden ? 'opacity-40' : 'opacity-100'}`}>
                   📁 {cat.name}
                </strong>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" className="sr-only peer" checked={!effectivelyHidden} onChange={e => handleToggleHide(cat.id, !e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {hasProds.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
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
                      <div key={p.id} className={`flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 transition-opacity duration-200 ${effectivelyHidden || pEffectivelyHidden ? 'opacity-40' : 'opacity-100'}`}>
                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                          {p.image && (
                            <img src={proxySyrveImage(p.image)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
                          )}
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                        </div>
                        <input type="checkbox" checked={!pEffectivelyHidden} disabled={effectivelyHidden} onChange={e => handleToggleHide(p.id, !e.target.checked)} className={`w-5 h-5 ml-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0 ${effectivelyHidden ? 'cursor-not-allowed' : 'cursor-pointer'}`} />
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
    <div className="bg-slate-50 dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-8 w-full max-w-6xl mx-auto shadow-2xl overflow-y-auto max-h-[90vh]">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
        <div className="flex items-center gap-4">
          <button className="shrink-0 w-11 h-11 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white m-0 leading-tight">
              {localHiddenItemsOverride !== null ? 'Personalizare Meniu Kiosk' : `Editare Profil: ${profile.name}`}
            </h2>
            <p className="text-slate-500 text-sm mt-1 m-0">Brand: {brand.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button className="px-6 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors" onClick={onClose}>Renunță</button>
          <button className="px-8 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all" onClick={() => onSave({ ...profile, hiddenItems, rootFolderId: rootFolderId === '' ? null : rootFolderId })}>
            {localHiddenItemsOverride !== null ? 'Salvează Vizibilitate' : 'Salvează Profilul'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 font-medium animate-pulse">Se încarcă structura meniului din integrări POS...</div>
      ) : (
        <>
          {/* Top Config Root Folder */}
          {localHiddenItemsOverride === null ? (
            <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-3 shadow-sm">
              <label className="font-bold text-slate-900 dark:text-white text-base m-0">Sursă / Mapa Principală Rădăcină (Opțional)</label>
              <p className="m-0 text-slate-500 text-sm leading-relaxed max-w-3xl">Prin selectarea unei mape, Kiosk-ul va extrage structura meniului strict pornind din acel dosar. Ideal dacă dorești ca profilul să controleze, de exemplu, doar un meniu de Terasă sau Bar.</p>
              <select className="mt-2 w-full max-w-md px-4 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={rootFolderId || ''} onChange={e => { setRootFolderId(e.target.value); setActiveTab(null); }}>
                <option value="">-- Extrage Tot (Fără Rădăcină Specifică) --</option>
                {menu.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300 text-sm leading-relaxed">
              Modifici vizibilitatea meniului în regim <strong className="font-bold">suprascriere locală Kiosk</strong>. Toate ascunderile debifate aici se aplică exclusiv pe acest aparat, adăugându-se peste restricțiile care ar veni din Profilul de Bază.
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Categorii</h4>
            <div className="flex flex-wrap gap-2">
               {rootMenuItems.map(c => (
                 <button 
                   key={c.id}
                   onClick={() => setActiveTab(c.id)}
                   className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${activeTab === c.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm border border-transparent' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                 >
                    {c.name}
                 </button>
               ))}
               {rootMenuItems.length === 0 && <span className="text-slate-500 text-sm">Nu a fost găsită nicio categorie.</span>}
            </div>
          </div>

          {/* Render Area */}
          <div className="flex-1 min-h-[400px]">
            {activeTab && renderCategoryTree(menu.categories, activeTab)}
          </div>
        </>
      )}
    </div>
  );
}
