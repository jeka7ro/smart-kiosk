import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import BrandLogo from '../components/BrandLogo';
import { Folder, Search, X, ChevronDown, ChevronUp, EyeOff, RotateCcw, Plus, Edit3 } from 'lucide-react';

const BRAND_COLORS = { smashme: '#ef4444', crunch: '#eab308', rollmaster: '#e31e24', lovesushi: '#ec4899', pokiwoki: '#f97316' };

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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Sincronizare Syrve & Profile Meniu
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Total: {menuStatus?.brands?.length || brands.length} branduri
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm leading-relaxed">
            Monitorizează sincronizarea meniului POS (Syrve/iiko) și configurează profilele de meniu per brand.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchMenuStatus}
            className="px-4 h-10 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            title="Verifică starea sincronizării cu POS-ul Syrve"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>Re-sincronizare Check</span>
          </button>
        </div>
      </div>

      {menuStatus?.error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800 font-medium">
          {menuStatus.error}
        </div>
      )}

      {/* Tabel Business Unificat */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center w-[60px]">#</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 min-w-[200px]">Brand</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 min-w-[180px]">Stare Syrve POS</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 min-w-[190px]">Date Meniu POS</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Profile Meniu Active</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right min-w-[150px]">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {menuStatus?.brands?.map((b, index) => {
                const brand = brands.find(br => br.id === b.brandId) || { id: b.brandId, name: b.name || b.brandId, data: {} };
                const profiles = brand.data?.menuProfiles || [];
                const isLive = Boolean(b.categories || b.products);

                return (
                  <tr key={b.brandId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    {/* Nr. Crt. */}
                    <td className="px-6 py-4 text-sm font-bold text-slate-400 dark:text-slate-500 text-center whitespace-nowrap">
                      {index + 1}
                    </td>

                    {/* Brand */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <BrandLogo brandId={b.brandId} size={28} />
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm">
                            {b.name || b.brandId}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mt-0.5">
                            {b.source || 'SYRVE-LIVE'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Stare Syrve POS */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isLive ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse' : 'bg-slate-400'}`} />
                          <span className={`text-xs font-bold ${isLive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                            {isLive ? 'Sincronizat Live' : 'Neverificat'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Modificare: {b.syncedAt ? new Date(b.syncedAt).toLocaleTimeString('ro-RO') : 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Date Meniu POS */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {b.categories} categorii
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {b.products} produse
                        </span>
                      </div>
                    </td>

                    {/* Profile Meniu Active */}
                    <td className="px-6 py-4">
                      {profiles.length === 0 ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          Meniu 100% complet (implicit)
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          {profiles.map(p => {
                            const hiddenCount = Object.keys(p.hiddenItems || {}).length;
                            return (
                              <div
                                key={p.id}
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 shadow-xs"
                              >
                                <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                                {hiddenCount > 0 ? (
                                  <span className="text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                                    (-{hiddenCount})
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                    (complet)
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setEditingProfileForBrand({ brand, profile: p })}
                                  title="Editează arbore produse profil"
                                  className="w-5 h-5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white transition-colors cursor-pointer ml-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActionModal({ type: 'delete', brandId: brand.id, profileId: p.id, profileName: p.name })}
                                  title="Șterge profil"
                                  className="w-5 h-5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Acțiuni */}
                    <td className="px-6 py-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setInputValue(''); setActionModal({ type: 'create', brandId: brand.id, brandName: brand.name }); }}
                          title={`Adaugă profil de meniu pentru ${brand.name}`}
                          className="px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adaugă Profil</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 font-medium">
          <span>Total branduri sincronizate: <strong>{menuStatus?.brands?.length || 0}</strong></span>
          <span>Sursă date: Syrve Cloud API (iiko)</span>
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
  const [profileName, setProfileName] = useState(profile?.name || '');
  const [hiddenItems, setHiddenItems] = useState(localHiddenItemsOverride || profile.hiddenItems || {});
  const [rootFolderId, setRootFolderId] = useState(profile.rootFolderId || '');
  const [activeTab, setActiveTab] = useState(null); // Category ID for sidebar navigation
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (profile?.name) {
      setProfileName(profile.name);
    }
  }, [profile?.name]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return menu.products.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const cat = menu.categories.find(c => c.id === p.categoryId);
      const catMatch = cat && (cat.name || '').toLowerCase().includes(q);
      const codeMatch = (p.code || '').toLowerCase().includes(q);
      return nameMatch || catMatch || codeMatch;
    });
  }, [menu.products, menu.categories, searchQuery]);

  // Determine if a product is currently hidden/scos
  const isProductHidden = useCallback((p) => {
    const cat = menu.categories.find(c => c.id === p.categoryId);
    let cur = cat;
    while (cur) {
      const isCatHiddenByTemplate = profile.hiddenItems?.[cur.id] === true;
      const isCatLocallyHidden = hiddenItems[cur.id] === true;
      const isCatLocallyVisible = hiddenItems[cur.id] === false;
      let isCurHidden = isCatHiddenByTemplate;
      if (localHiddenItemsOverride !== null) {
        isCurHidden = isCatLocallyHidden || (isCatHiddenByTemplate && !isCatLocallyVisible);
      } else {
        isCurHidden = isCatLocallyHidden;
      }
      if (isCurHidden) return true;
      cur = menu.categories.find(c => c.id === cur.parentGroup);
    }

    const isPHiddenByTemplate = profile.hiddenItems?.[p.id] === true;
    const isPLocallyHidden = hiddenItems[p.id] === true;
    const isPLocallyVisible = hiddenItems[p.id] === false;
    let pSelfHidden = isPHiddenByTemplate;
    if (localHiddenItemsOverride !== null) {
      pSelfHidden = isPLocallyHidden || (isPHiddenByTemplate && !isPLocallyVisible);
    } else {
      pSelfHidden = isPLocallyHidden;
    }
    return pSelfHidden;
  }, [menu.categories, profile.hiddenItems, hiddenItems, localHiddenItemsOverride]);

  const hiddenProducts = useMemo(() => {
    return menu.products.filter(p => isProductHidden(p));
  }, [menu.products, isProductHidden]);

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
                <strong className={`flex items-center gap-2.5 text-lg text-slate-900 dark:text-white transition-opacity duration-200 ${effectivelyHidden ? 'opacity-40' : 'opacity-100'}`}>
                   <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                     <Folder size={15} />
                   </span>
                   {cat.name}
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
        <div className="flex items-center gap-4 flex-1">
          <button className="shrink-0 w-11 h-11 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <div className="flex-1 max-w-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {localHiddenItemsOverride !== null ? 'Personalizare Meniu Kiosk' : 'Editare Profil Meniu'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                Brand: {brand.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Nume profil (ex: Cluj 1 - fără desert)"
                title="Editează numele acestui profil de meniu"
                className="w-full max-w-md px-3.5 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button className="px-6 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors cursor-pointer" onClick={onClose}>Renunță</button>
          <button 
            className="px-8 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all cursor-pointer" 
            onClick={() => onSave({ ...profile, name: profileName.trim() || profile?.name || 'Profil Meniu', hiddenItems, rootFolderId: rootFolderId === '' ? null : rootFolderId })}
          >
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
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-900 dark:text-white text-base m-0">Filtrează meniul doar la o mapă specifică (Opțional / Avansat)</label>
                {rootFolderId && (
                  <button 
                    type="button"
                    onClick={() => { setRootFolderId(''); setActiveTab(null); }}
                    className="text-xs px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-200 font-semibold transition-colors"
                  >
                    Resetează la Tot Meniul
                  </button>
                )}
              </div>
              <p className="m-0 text-slate-500 text-sm leading-relaxed max-w-3xl">
                ⚠️ <strong className="text-slate-700 dark:text-slate-200">Atenție:</strong> Lăsați <strong>gol</strong> pentru a afișa întregul meniu normal. Dacă selectați o categorie aici, Kiosk-ul va afișa <span className="text-amber-600 font-bold">DOAR acea categorie</span> și va ascunde tot restul restaurantului. Pentru a ascunde doar un desert sau alt produs, lăsați câmpul pe „-- Întreg Meniul --” și folosiți butoanele de ochi (Ascunde) de mai jos.
              </p>
              <select className="mt-2 w-full max-w-md px-4 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" value={rootFolderId || ''} onChange={e => { setRootFolderId(e.target.value); setActiveTab(null); }}>
                <option value="">-- Întreg Meniul (Recomandat - Fără restricție) --</option>
                {menu.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {rootFolderId && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Este selectată mapa <strong>{menu.categories.find(c => c.id === rootFolderId)?.name || rootFolderId}</strong>. Kiosk-ul va extrage exclusiv acest dosar.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300 text-sm leading-relaxed">
              Modifici vizibilitatea meniului în regim <strong className="font-bold">suprascriere locală Kiosk</strong>. Toate ascunderile debifate aici se aplică exclusiv pe acest aparat, adăugându-se peste restricțiile care ar veni din Profilul de Bază.
            </div>
          )}

          {/* Search Bar */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Caută rapid un produs după nume sau categorie (ex: Burger, Cola, Rolls, Desert)..."
              className="w-full pl-11 pr-10 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm font-medium transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Șterge căutarea"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {searchQuery.trim() ? (
            <div className="flex flex-col gap-4 flex-1 min-h-[300px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Rezultate căutare:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'produs' : 'produse'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  Resetează căutarea (vezi categorii)
                </button>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500">
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Niciun produs găsit
                  </p>
                  <p className="text-sm text-slate-400">
                    Nu am găsit produse care să conțină „<strong>{searchQuery}</strong>”.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredProducts.map(p => {
                    const cat = menu.categories.find(c => c.id === p.categoryId);
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
                      <div
                        key={p.id}
                        className={`flex items-center justify-between p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 ${
                          pEffectivelyHidden ? 'opacity-40 bg-slate-100 dark:bg-slate-800/40' : 'opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 overflow-hidden min-w-0">
                          {p.image ? (
                            <img
                              src={proxySyrveImage(p.image)}
                              alt=""
                              className="w-11 h-11 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-400 text-xs font-bold">
                              🍽️
                            </div>
                          )}
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={p.name}>
                              {p.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {cat && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md truncate">
                                  📁 {cat.name}
                                </span>
                              )}
                              {p.price > 0 && (
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                  {parseFloat(p.price).toFixed(2)} lei
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer shrink-0 ml-2">
                          <input
                            type="checkbox"
                            checked={!pEffectivelyHidden}
                            onChange={e => handleToggleHide(p.id, !e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>


              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Categorii</h4>
                <div className="flex flex-wrap gap-2">
                   {rootMenuItems.map(c => {
                     const hiddenInCat = hiddenProducts.filter(p => p.categoryId === c.id).length;
                     return (
                       <button 
                         key={c.id}
                         onClick={() => setActiveTab(c.id)}
                         className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === c.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm border border-transparent' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                       >
                          <span>{c.name}</span>
                          {hiddenInCat > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === c.id ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'}`}>
                              -{hiddenInCat}
                            </span>
                          )}
                       </button>
                     );
                   })}
                   {rootMenuItems.length === 0 && <span className="text-slate-500 text-sm">Nu a fost găsită nicio categorie.</span>}
                </div>
              </div>

              {/* Render Area */}
              <div className="flex-1 min-h-[400px]">
                {activeTab && renderCategoryTree(menu.categories, activeTab)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
