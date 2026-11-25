import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import BrandLogo from '../components/BrandLogo';
import { Folder, Search, X, ChevronDown, ChevronUp, EyeOff, RotateCcw, Plus, Edit3 } from 'lucide-react';
import { ALL_BRAND_COLORS as BRAND_COLORS, ALL_BRAND_LABELS as BRAND_LABELS } from '../utils/brandTheme';

function resolveBrandDisplayName(b, brandsList = []) {
  const rawId = (b.brandId || '').toString().trim();
  const cleanKey = rawId.includes(':') ? rawId.split(':')[0].toLowerCase() : rawId.toLowerCase();
  const matchedBrand = brandsList.find(br => (br.id || '').toLowerCase() === cleanKey);
  if (matchedBrand?.name) return matchedBrand.name;
  if (BRAND_LABELS[cleanKey]) return BRAND_LABELS[cleanKey];
  const rawName = (b.name || '').toString().trim();
  // Never display raw UUIDs or composite org keys like "lovesushi:adddb5a0-..."
  const looksLikeKey = /^[0-9a-f-]{20,}$/i.test(rawName) || rawName.includes(':');
  if (rawName && !looksLikeKey) return rawName;
  if (cleanKey && !/^[0-9a-f-]{20,}$/i.test(cleanKey)) {
    return cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1);
  }
  return 'Brand Syrve';
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
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-[#6E6E73] dark:text-[#98989D] text-[13px] m-0">
            Sincronizare live cu Syrve/iiko și profile de meniu per brand.
          </p>
          <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#007AFF]/10 text-[#007AFF] dark:text-[#0A84FF]">
            {menuStatus?.brands?.length || brands.length} branduri
          </span>
        </div>

        <button
          type="button"
          onClick={fetchMenuStatus}
          className="apple-btn-secondary px-4 h-9 text-[13px]"
          title="Verifică starea sincronizării cu POS-ul Syrve"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#86868B]" />
          <span>Re-sincronizare</span>
        </button>
      </div>

      {menuStatus?.error && (
        <div className="bg-[#FF3B30]/10 text-[#FF3B30] p-4 rounded-2xl border border-[#FF3B30]/20 text-[13px] font-medium">
          {menuStatus.error}
        </div>
      )}

      {/* Tabel Business Unificat — Apple Card */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F5F7]/70 dark:bg-[#2C2C2E]/60 border-b border-black/[0.06] dark:border-white/[0.07] whitespace-nowrap">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868B] text-center w-11">#</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Brand</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Stare Syrve</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Date Meniu</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Profile Meniu Active</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868B] text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {menuStatus?.brands?.map((b, index) => {
                const displayName = resolveBrandDisplayName(b, brands);
                const brand = brands.find(br => br.id === b.brandId) || { id: b.brandId, name: displayName, data: {} };
                const profiles = brand.data?.menuProfiles || [];
                const isLive = Boolean(b.categories || b.products);

                return (
                  <tr key={b.brandId} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors group">
                    {/* Nr. Crt. */}
                    <td className="px-4 py-3.5 text-[13px] font-semibold text-[#86868B] text-center whitespace-nowrap">
                      {index + 1}
                    </td>

                    {/* Brand */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <BrandLogo brandId={b.brandId} size={32} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] text-[13.5px] leading-tight">
                            {displayName}
                          </span>
                          <span className="text-[11px] font-medium text-[#86868B] leading-tight mt-0.5">
                            Syrve Live
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Stare Syrve POS */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5 items-start">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isLive ? 'bg-[#34C759]' : 'bg-[#86868B]'}`} />
                          <span className={`text-[12.5px] font-semibold ${isLive ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#86868B]'}`}>
                            {isLive ? 'Sincronizat Live' : 'Neverificat'}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#86868B]">
                          {b.syncedAt ? `Actualizat ${new Date(b.syncedAt).toLocaleTimeString('ro-RO')}` : 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Date Meniu POS */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.07] text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {b.categories} categorii
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.07] text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {b.products} produse
                        </span>
                      </div>
                    </td>

                    {/* Profile Meniu Active */}
                    <td className="px-4 py-3.5">
                      {profiles.length === 0 ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium text-[#86868B] bg-black/[0.035] dark:bg-white/[0.06] whitespace-nowrap">
                          Meniu complet (implicit)
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {profiles.map(p => {
                            const hiddenCount = Object.keys(p.hiddenItems || {}).length;
                            return (
                              <div
                                key={p.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#007AFF]/10 border border-[#007AFF]/20 text-[#007AFF] dark:text-[#64D2FF] whitespace-nowrap"
                              >
                                <span className="font-semibold text-[#1D1D1F] dark:text-white whitespace-nowrap">{p.name}</span>
                                {hiddenCount > 0 ? (
                                  <span className="text-[#C93400] dark:text-[#FF9F0A] text-[11px] font-semibold">
                                    (-{hiddenCount})
                                  </span>
                                ) : (
                                  <span className="text-[#248A3D] dark:text-[#30D158] text-[11px] font-semibold">
                                    (complet)
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setEditingProfileForBrand({ brand, profile: p })}
                                  title="Editează arbore produse profil"
                                  className="w-5 h-5 rounded-full hover:bg-[#007AFF]/20 inline-flex items-center justify-center text-[#007AFF] dark:text-[#64D2FF] transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActionModal({ type: 'delete', brandId: brand.id, profileId: p.id, profileName: p.name })}
                                  title="Șterge profil"
                                  className="w-5 h-5 rounded-full hover:bg-[#FF3B30]/15 inline-flex items-center justify-center text-[#86868B] hover:text-[#FF3B30] transition-colors cursor-pointer"
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
                    <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => { setInputValue(''); setActionModal({ type: 'create', brandId: brand.id, brandName: displayName }); }}
                        title={`Adaugă profil de meniu pentru ${displayName}`}
                        className="apple-btn-primary px-3.5 py-1.5 text-[12px]"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
                        <span>Adaugă Profil</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#F5F5F7]/60 dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.07] text-[12px] text-[#86868B] font-medium">
          <span>Total branduri sincronizate: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{menuStatus?.brands?.length || 0}</strong></span>
          <span>Sursă date: Syrve Cloud API (iiko)</span>
        </div>
      </div>

      {/* CUSTOM PROMPT MODALS — Apple Modal Style */}
      {actionModal && (
        <div
          onClick={() => setActionModal(null)}
          className="fixed inset-0 bg-black/40 backdrop-blur-md z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="apple-modal p-6 w-full max-w-md animate-in zoom-in-95 duration-150"
          >
            {actionModal.type === 'create' && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Creează Profil Nou</h3>
                  <button type="button" className="apple-close-btn" onClick={() => setActionModal(null)} title="Închide"><X size={16} /></button>
                </div>
                <p className="text-[13px] text-[#86868B] mb-5">Introdu un nume pentru noul profil al brandului <strong className="text-[#1D1D1F] dark:text-white">{actionModal.brandName}</strong>.</p>
                <input 
                  autoFocus
                  type="text" 
                  value={inputValue} 
                  onChange={e => setInputValue(e.target.value)} 
                  placeholder="ex: Meniu Terasă"
                  className="apple-input w-full px-3.5 h-11 text-[14px] mb-6"
                  onKeyDown={e => { if (e.key === 'Enter' && inputValue.trim()) { createProfile(actionModal.brandId, inputValue); setActionModal(null); } }}
                />
                <div className="flex gap-2.5 justify-end">
                  <button type="button" className="apple-btn-secondary px-4 py-2 text-[13px]" onClick={() => setActionModal(null)}>Anulează</button>
                  <button type="button" className="apple-btn-primary px-4 py-2 text-[13px] disabled:opacity-40" onClick={() => { createProfile(actionModal.brandId, inputValue); setActionModal(null); }} disabled={!inputValue.trim()}>Creează Profil</button>
                </div>
              </>
            )}

            {actionModal.type === 'delete' && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Ștergere Profil</h3>
                  <button type="button" className="apple-close-btn" onClick={() => setActionModal(null)} title="Închide"><X size={16} /></button>
                </div>
                <p className="text-[13px] text-[#86868B] mb-6 leading-relaxed">
                  Sigur dorești să ștergi profilul <strong className="text-[#1D1D1F] dark:text-white">{actionModal.profileName}</strong>? Kiosk-urile care folosesc acest profil vor reveni la meniul complet standard.
                </p>
                <div className="flex gap-2.5 justify-end">
                  <button type="button" className="apple-btn-secondary px-4 py-2 text-[13px]" onClick={() => setActionModal(null)}>Anulează</button>
                  <button type="button" className="px-4 py-2 rounded-full bg-[#FF3B30] hover:bg-[#D70015] text-white text-[13px] font-semibold transition-all cursor-pointer" onClick={() => { deleteProfileConfirmed(actionModal.brandId, actionModal.profileId); setActionModal(null); }}>Șterge Definitiv</button>
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

export function MenuProfileEditorModal({ 
  backend, 
  brand, 
  profile, 
  onClose, 
  onSave, 
  localHiddenItemsOverride = null,
  locId = null,
  orgId = null,
  locationName = null
}) {
  const { fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState({ categories: [], products: [] });
  const [profileName, setProfileName] = useState(profile?.name || '');
  const [hiddenItems, setHiddenItems] = useState(localHiddenItemsOverride || profile.hiddenItems || {});
  const [rootFolderId, setRootFolderId] = useState(profile.rootFolderId || '');
  const [activeTab, setActiveTab] = useState(null); // Category ID for sidebar navigation
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState([]);
  const [selectedLocId, setSelectedLocId] = useState(locId || '');
  const [selectedOrgId, setSelectedOrgId] = useState(orgId || '');

  useEffect(() => {
    if (profile?.name) {
      setProfileName(profile.name);
    }
  }, [profile?.name]);

  // Load locations carrying this brand to allow picking/scoping organization menu
  useEffect(() => {
    fetchWithAuth(`${backend}/api/locations?brandId=${brand.id}`)
      .then(r => r.json())
      .then(d => {
        const locs = (d.locations || []).filter(l => l.active !== false);
        setLocations(locs);
        if (locId) {
          setSelectedLocId(locId);
          const found = locs.find(l => l.id === locId);
          if (found?.orgIds?.[brand.id]) {
            setSelectedOrgId(found.orgIds[brand.id]);
          } else if (orgId) {
            setSelectedOrgId(orgId);
          }
        } else if (orgId) {
          setSelectedOrgId(orgId);
          const found = locs.find(l => l.orgIds?.[brand.id] === orgId);
          if (found) setSelectedLocId(found.id);
        } else if (locs.length > 0) {
          const savedLocId = localStorage.getItem(`admin_menu_loc_${brand.id}`);
          const match = locs.find(l => l.id === savedLocId) || locs[0];
          setSelectedLocId(match.id);
          setSelectedOrgId(match.orgIds?.[brand.id] || '');
        }
      })
      .catch(() => {});
  }, [backend, brand.id, locId, orgId, fetchWithAuth]);

  const handleLocationChange = (newLocId) => {
    setSelectedLocId(newLocId);
    localStorage.setItem(`admin_menu_loc_${brand.id}`, newLocId);
    const found = locations.find(l => l.id === newLocId);
    if (found?.orgIds?.[brand.id]) {
      setSelectedOrgId(found.orgIds[brand.id]);
    } else {
      setSelectedOrgId('');
    }
  };

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

    const pNameLower = p.name ? p.name.trim().toLowerCase() : null;
    const isPHiddenByTemplate = profile.hiddenItems?.[p.id] === true || (pNameLower && profile.hiddenItems?.[pNameLower] === true);
    const isPLocallyHidden = hiddenItems[p.id] === true || (pNameLower && hiddenItems[pNameLower] === true);
    const isPLocallyVisible = hiddenItems[p.id] === false || (pNameLower && hiddenItems[pNameLower] === false);
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
    setLoading(true);
    const effectiveOrgId = selectedOrgId || orgId || '';
    const effectiveLocId = selectedLocId || locId || '';
    const orgParam = effectiveOrgId ? `&orgId=${encodeURIComponent(effectiveOrgId)}` : '';
    const locParam = effectiveLocId ? `&locId=${encodeURIComponent(effectiveLocId)}` : '';
    fetchWithAuth(`${backend}/api/menu?brandId=${brand.id}${orgParam}${locParam}&includeHidden=true`)
      .then(r => r.json())
      .then(d => {
        setMenu({ categories: d.categories || [], products: d.products || [] });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [backend, brand.id, selectedOrgId, selectedLocId, orgId, locId, fetchWithAuth]);

  useEffect(() => {
    if (localHiddenItemsOverride !== null) setHiddenItems(localHiddenItemsOverride);
  }, [localHiddenItemsOverride]);

  const handleToggleHide = (id, hidden) => {
    const prod = menu.products.find(p => p.id === id);
    const prodNameLower = prod?.name ? prod.name.trim().toLowerCase() : null;
    setHiddenItems(prev => {
      const next = { ...prev };
      if (hidden) {
        next[id] = true;
        if (prodNameLower) next[prodNameLower] = true;
      } else if (localHiddenItemsOverride !== null) {
        next[id] = false; 
        if (prodNameLower) next[prodNameLower] = false;
      } else {
        delete next[id]; 
        if (prodNameLower) delete next[prodNameLower];
      }
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

  // Auto-select first tab when available and not already set, or if current tab not in categories
  useEffect(() => {
    if (rootMenuItems.length > 0) {
      if (!activeTab || !menu.categories.some(c => c.id === activeTab)) {
        setActiveTab(rootMenuItems[0].id);
      }
    }
  }, [rootMenuItems, activeTab, menu.categories]);

  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-8 w-full max-w-6xl mx-auto shadow-2xl overflow-y-auto max-h-[90vh]">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
        <div className="flex items-center gap-4 flex-1">
          <button className="shrink-0 w-11 h-11 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <div className="flex-1 max-w-xl">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {localHiddenItemsOverride !== null ? 'Personalizare Meniu Kiosk' : 'Editare Profil Meniu'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                Brand: {brand.name}
              </span>
              {locationName && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                  Locație Kiosk: {locationName}
                </span>
              )}
              {locations.length > 1 && (
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-xs text-slate-400 font-medium">Sursă meniu:</span>
                  <select
                    value={selectedLocId}
                    onChange={e => handleLocationChange(e.target.value)}
                    className="text-xs px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                    className="text-xs px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-full hover:bg-amber-200 font-semibold transition-colors"
                  >
                    Resetează la Tot Meniul
                  </button>
                )}
              </div>
              <p className="m-0 text-slate-500 text-sm leading-relaxed max-w-3xl">
                <strong className="text-slate-700 dark:text-slate-200">Atenție:</strong> Lăsați <strong>gol</strong> pentru a afișa întregul meniu normal. Dacă selectați o categorie aici, Kiosk-ul va afișa <span className="text-amber-600 font-bold">DOAR acea categorie</span> și va ascunde tot restul restaurantului. Pentru a ascunde doar un desert sau alt produs, lăsați câmpul pe „-- Întreg Meniul --” și folosiți butoanele de ochi (Ascunde) de mai jos.
              </p>
              <select className="mt-2 w-full max-w-md px-4 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" value={rootFolderId || ''} onChange={e => { setRootFolderId(e.target.value); setActiveTab(null); }}>
                <option value="">-- Întreg Meniul (Recomandat - Fără restricție) --</option>
                {menu.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {rootFolderId && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                  <span></span>
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
                              </div>
                          )}
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={p.name}>
                              {p.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {cat && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md truncate">
                                  {cat.name}
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
                         className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all inline-flex items-center gap-2 cursor-pointer ${activeTab === c.id ? 'bg-[#007AFF] text-white shadow-sm' : 'bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.03] dark:hover:bg-white/[0.08]'}`}
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
