import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const PAGE_SIZE = 25;

// Proxy image URLs — same logic as kiosk
const proxySyrveImage = (url) => {
  if (!url) return null;
  if (url.startsWith('/uploads')) return `${BACKEND}${url}`;
  if (url.startsWith('http')) return url;
  return `${BACKEND}${url}`;
};

const BRANDS = [
  { id: 'smashme',     label: 'SmashMe',     color: '#ef4444' },
  { id: 'rollmaster', label: 'Roll Master', color: '#3b82f6' },
  { id: 'lovesushi', label: 'Love Sushi', color: '#ec4899' },
  { id: 'pokiwoki', label: 'Poki-Woki', color: '#f97316' },
  { id: 'crunch', label: 'Crunch', color: '#eab308' },
  { id: 'welovesushi', label: 'WeLoveSushi', color: '#f59e0b' },
  { id: 'ikura',       label: 'Ikura',       color: '#10b981' }
];

export default function ProductOverrides() {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [products,    setProducts]    = useState([]);
  const [categories,  setCategories]  = useState({});
  const [overrides,   setOverrides]   = useState({});
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [activeBrand, setActiveBrand] = useState('smashme');
  const [toast,       setToast]       = useState(null);
  const [filterDiet,  setFilterDiet]  = useState(null); // null | 'veg' | 'spicy'
  const [filterCategory, setFilterCategory] = useState(''); // empty = all
  const [previewImage,setPreviewImage]= useState(null);
  const [previewDesc, setPreviewDesc] = useState(null);
  const [locations,   setLocations]   = useState([]);
  const [activeLocation, setActiveLocation] = useState(() => localStorage.getItem('admin_active_location') || '');
  const [activeKiosk, setActiveKiosk] = useState(() => localStorage.getItem('admin_active_kiosk') || '');
  const [promoOverrides, setPromoOverrides] = useState({});
  const [savedPromos, setSavedPromos] = useState({});
  
  const fileInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch fresh menu directly from our API (which has syrve items)
      // We pass orgId=null to force brand fallback
      const mRes = await fetchWithAuth(`${BACKEND}/api/menu?brandId=${activeBrand}&orgId=null`);
      const mData = await mRes.json();
      
      const catMap = {};
      (mData.categories || []).forEach(c => catMap[c.id] = c.name);
      setCategories(catMap);
      setProducts(mData.products || []);

      // Fetch the raw overrides to know exactly what is custom and what is not
      const oRes = await fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}`);
      const oData = await oRes.json();
      const oMap = {};
      (oData.overrides || []).forEach(o => oMap[o.id] = o);
      setOverrides(oMap);

    } catch (e) { showToast('❌ Eroare la încărcare: ' + e.message, 'err'); }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    setSearch('');
    setPage(1);
    fetchAll(); 
  }, [activeBrand]);

  // Fetch locations for promo scoping
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`${BACKEND}/api/locations`);
        const data = await res.json();
        const locs = (data.locations || data || []).filter(l => l.active !== false);
        setLocations(locs);
        const savedLoc = localStorage.getItem('admin_active_location');
        if (savedLoc && locs.some(l => l.id === savedLoc)) {
          setActiveLocation(savedLoc);
        }
      } catch (_) {}
    })();
  }, []);

  // Fetch promo overrides for selected location and kiosk
  useEffect(() => {
    if (!activeLocation) return;
    localStorage.setItem('admin_active_location', activeLocation);
    (async () => {
      try {
        const res = await fetchWithAuth(`${BACKEND}/api/locations/${activeLocation}`);
        const loc = await res.json();
        const kPromos = loc.kioskPromos || {};
        
        // Deduce known kiosks without forcing user to define them in Kiosks tab
        let known = loc.kiosks?.length > 0 ? [...loc.kiosks] : [];
        if (known.length === 0 && loc.kioskUrl) {
          known.push({ kioskId: loc.kioskUrl, name: loc.kioskUrl });
        }
        Object.keys(kPromos).forEach(kid => {
          if (!known.find(k => k.kioskId === kid)) known.push({ kioskId: kid, name: kid });
        });

        // Auto-select first kiosk to save user a click
        let currentKiosk = activeKiosk || localStorage.getItem('admin_active_kiosk');
        if (known.length > 0 && (!currentKiosk || !known.find(k => k.kioskId === currentKiosk))) {
          currentKiosk = known[0].kioskId;
          setActiveKiosk(currentKiosk);
        }
        if (currentKiosk) localStorage.setItem('admin_active_kiosk', currentKiosk);

        const pData = kPromos[currentKiosk] || {};
        setPromoOverrides(pData);
        setSavedPromos(pData);
      } catch (_) {}
    })();
  }, [activeLocation, activeKiosk]);

  const uniqueCategories = useMemo(() => {
    const set = new Set();
    products.forEach(p => {
      const name = categories[p.categoryId];
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [products, categories]);

  const filtered = useMemo(() => {
    let list = products.filter(p => {
      const q = search.toLowerCase();
      const catName = categories[p.categoryId] || '';
      if (filterCategory && catName !== filterCategory) return false;
      return p.name?.toLowerCase().includes(q) || catName.toLowerCase().includes(q);
    });
    if (filterDiet === 'veg')   list = list.filter(p => !!(overrides[p.id]?.is_vegetarian));
    if (filterDiet === 'spicy') list = list.filter(p => !!(overrides[p.id]?.is_spicy));
    if (filterDiet === 'promo') list = list.filter(p => !!(promoOverrides[p.id]?.price));
    if (filterDiet === 'featured') list = list.filter(p => !!(overrides[p.id]?.is_featured));
    return list;
  }, [products, search, categories, filterDiet, overrides, promoOverrides, filterCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleTag = async (productId, tagType) => {
    const currentOver = overrides[productId] || {};
    const payload = {
      is_vegetarian: tagType === 'veg' ? !currentOver.is_vegetarian : !!currentOver.is_vegetarian,
      is_spicy: tagType === 'spicy' ? !currentOver.is_spicy : !!currentOver.is_spicy,
      is_hidden: tagType === 'hidden' ? !currentOver.is_hidden : !!currentOver.is_hidden,
      is_featured: tagType === 'featured' ? !currentOver.is_featured : !!currentOver.is_featured,
    };

    setOverrides(prev => ({
      ...prev,
      [productId]: { ...prev[productId], ...payload }
    }));

    try {
      const res = await fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${productId}/tags`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Eroare de la server');
      showToast('✅ Preferință salvată');
    } catch (e) {
      showToast('❌ Eroare la salvare: ' + e.message, 'err');
      fetchAll(); // rollback
    }
  };

  const handleBulkToggle = async (tagType, newValue) => {
    if (filtered.length === 0) return;
    const ok = await confirm(`Aplici modificarea pe toate cele ${filtered.length} produse afișate?`, { title: 'Modificare în masă', icon: '⚠️', okLabel: 'Aplică', danger: false });
    if (!ok) return;
    
    setLoading(true);
    let successCount = 0;
    
    // Optistic UI bulk update
    const updates = {};
    const fieldName = tagType === 'veg' ? 'is_vegetarian' : tagType === 'spicy' ? 'is_spicy' : tagType === 'featured' ? 'is_featured' : 'is_hidden';
    filtered.forEach(p => {
       const currentOver = overrides[p.id] || {};
       updates[p.id] = { ...currentOver, [fieldName]: newValue };
    });
    setOverrides(prev => ({ ...prev, ...updates }));

    // Send requests
    for (const p of filtered) {
       const payload = updates[p.id];
       try {
         await fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${p.id}/tags`, {
           method: 'PUT',
           body: JSON.stringify(payload),
         });
         successCount++;
       } catch(e) { console.error('Failed to bulk update', p.id); }
    }
    setLoading(false);
    showToast(`✅ Au fost marcate ${successCount} produse.`);
  };

  const handleImageUploadClick = (productId) => {
    setUploadingId(productId);
    fileInputRef.current.click();
  };

  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingId) {
      setUploadingId(null);
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    const targetId = uploadingId;
    setUploadingId(null);
    showToast('Încărcare...', 'info');

    try {
      const res = await fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${targetId}/image`, {
        method: 'POST',
        body: formData, // fetchWithAuth handles FormData automatically (removes Content-Type for boundary generation)
      }, true); // pass true for isFormData if needed, but our context handles it if we don't stringify

      if (!res.ok) throw new Error('Nu s-a putut salva');
      showToast('📸 Poză Custom salvată!', 'ok');
      fetchAll();
    } catch (err) {
      showToast('❌ Eroare: ' + err.message, 'err');
    }
  };

  const deleteCustomImage = async (productId) => {
    const ok = await confirm('Ștergi poza Custom și revii la cea din Syrve?', { icon: '🗑️', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${productId}/image`, { method: 'DELETE' });
      showToast('🗑 Ștearsă! A revenit la baza Syrve.', 'ok');
      fetchAll();
    } catch (err) {
      showToast('❌ Eroare: ' + err.message, 'err');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="m-0 text-slate-500 dark:text-slate-400">Meniul sincronizat din Syrve. Aici poți adăuga manual supra-scrieri (poză HD proprie, filtru Vegetarian).</p>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/webp" onChange={onFileChange} />

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {BRANDS.map(b => {
            const isActive = activeBrand === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setActiveBrand(b.id)}
                title={b.label}
                className={`flex-shrink-0 w-10 h-10 rounded-full p-0 flex items-center justify-center overflow-hidden transition-all bg-white shadow-sm hover:scale-105`}
                style={{
                  border: isActive ? `2px solid ${b.color}` : '1px solid var(--tw-prose-th-borders, #e2e8f0)',
                  boxShadow: isActive ? `0 4px 10px ${b.color}40` : '',
                  opacity: isActive ? 1 : 0.6,
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <img src={`/brands/${b.id}-logo.png`} alt={b.label} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
              </button>
            );
          })}
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          {locations.length > 0 && (
            <select
              value={activeLocation}
              onChange={e => setActiveLocation(e.target.value)}
              className="px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-sm outline-none bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer focus:ring-2 focus:ring-blue-500/50 appearance-none"
            >
              <option value="" disabled>📍 Alege locația...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>📍 {loc.name}</option>
              ))}
            </select>
          )}

          {activeLocation && (() => {
            const selectedLocObj = locations.find(l => l.id === activeLocation);
            let knownKiosks = selectedLocObj?.kiosks?.length > 0 ? [...selectedLocObj.kiosks] : [];
            if (knownKiosks.length === 0 && selectedLocObj?.kioskUrl) {
              knownKiosks.push({ kioskId: selectedLocObj.kioskUrl, name: selectedLocObj.kioskUrl });
            }
            if (selectedLocObj?.kioskPromos) {
              Object.keys(selectedLocObj.kioskPromos).forEach(kid => {
                if (!knownKiosks.find(k => k.kioskId === kid)) knownKiosks.push({ kioskId: kid, name: kid });
              });
            }

            return (
              <select
                value={activeKiosk}
                onChange={e => setActiveKiosk(e.target.value)}
                className="px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-sm outline-none bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 cursor-pointer focus:ring-2 focus:ring-indigo-500/50 appearance-none min-w-[120px]"
              >
                <option value="" disabled>🖥️ Alege Kiosk...</option>
                {knownKiosks.length === 0 && (
                  <option value="" disabled>⚠️ Adaugă Kiosk-uri din tab-ul 'Kioskuri'!</option>
                )}
                {knownKiosks.map(k => (
                  <option key={k.kioskId} value={k.kioskId}>🖥️ {k.name}</option>
                ))}
              </select>
            );
          })()}

          <select 
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-sm outline-none bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer max-w-[180px] focus:ring-2 focus:ring-blue-500/50 appearance-none"
          >
            <option value="">🗂️ Toate categoriile</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="relative flex-1 min-w-[150px]">
            <input 
              className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow shadow-sm"
              placeholder="Caută produs..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }} 
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          
          <button
            onClick={() => { setFilterDiet(filterDiet === 'veg' ? null : 'veg'); setPage(1); }}
            className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${filterDiet === 'veg' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-transparent border border-emerald-500 text-emerald-600 dark:text-emerald-400'}`}
          >
            🍃 Vegetarian
          </button>
          <button
            onClick={() => { setFilterDiet(filterDiet === 'spicy' ? null : 'spicy'); setPage(1); }}
            className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${filterDiet === 'spicy' ? 'bg-red-500 text-white shadow-sm' : 'bg-transparent border border-red-500 text-red-600 dark:text-red-400'}`}
          >
            🌶️ Picant
          </button>
          <button
            onClick={() => { setFilterDiet(filterDiet === 'promo' ? null : 'promo'); setPage(1); }}
            className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${filterDiet === 'promo' ? 'bg-blue-500 text-white shadow-sm' : 'bg-transparent border border-blue-500 text-blue-600 dark:text-blue-400'}`}
          >
            💰 Doar Promo
          </button>
          <button
            onClick={() => { setFilterDiet(filterDiet === 'featured' ? null : 'featured'); setPage(1); }}
            className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${filterDiet === 'featured' ? 'bg-amber-500 text-white shadow-sm' : 'bg-transparent border border-amber-500 text-amber-600 dark:text-amber-400'}`}
          >
            ⭐ Prima Pagină
          </button>
        </div>
      </div>

      {/* ── Main Table ───────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm font-medium">Se încarcă catalogul sincronizat...</span>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">Imagine</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Sursă Imagine</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Produs</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Categorie</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Preț</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">🏷️ Promoție</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                    <div className="inline-flex items-center justify-center gap-1.5 cursor-pointer px-2 py-1 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 transition-colors" onClick={() => handleBulkToggle('hidden', !(filtered.length > 0 && filtered.every(p => !overrides[p.id]?.is_hidden)))} title="Bifează/Debifează pe Toate (Disponibil = Neascuns)">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 pointer-events-none" checked={filtered.length > 0 && filtered.every(p => !overrides[p.id]?.is_hidden)} readOnly />
                      <span>👁️ Disponibil</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                    <div className="inline-flex items-center justify-center gap-1.5 cursor-pointer px-2 py-1 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors" onClick={() => handleBulkToggle('veg', !(filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_vegetarian)))} title="Bifează/Debifează pe Toate">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 pointer-events-none" checked={filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_vegetarian)} readOnly />
                      <span>🍃 Veg</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                    <div className="inline-flex items-center justify-center gap-1.5 cursor-pointer px-2 py-1 rounded bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 transition-colors" onClick={() => handleBulkToggle('spicy', !(filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_spicy)))} title="Bifează/Debifează pe Toate">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-red-300 text-red-600 focus:ring-red-500 pointer-events-none" checked={filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_spicy)} readOnly />
                      <span>🌶️ Picant</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                    <div className="inline-flex items-center justify-center gap-1.5 cursor-pointer px-2 py-1 rounded bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 transition-colors" onClick={() => handleBulkToggle('featured', !(filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_featured)))} title="Bifează/Debifează pe Toate (Afișează pe prima pagină)">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 pointer-events-none" checked={filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_featured)} readOnly />
                      <span>⭐ Prima Pagină</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Editează Poză</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pageItems.map((prod, i) => {
                  const over = overrides[prod.id] || {};
                  
                  // Which image is actually displayed?
                  const displayImage = over.custom_image_url || over.local_image_url || over.syrve_image_url || prod.image;
                  const hasCustom = !!over.custom_image_url;
                  
                  return (
                    <tr key={prod.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-sm text-slate-500 font-medium">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3">
                        {displayImage
                          ? <img 
                              src={proxySyrveImage(displayImage)} 
                              alt="" 
                              onClick={() => setPreviewImage(proxySyrveImage(displayImage))}
                              title="Click pentru a mări imaginea"
                              className={`w-16 h-16 object-cover rounded-xl cursor-pointer transition-transform hover:scale-105 shadow-sm ${hasCustom ? 'border-2 border-violet-500' : 'border border-slate-200 dark:border-slate-700'}`} 
                              onError={e => { e.target.style.display='none'; }} 
                            />
                          : <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-medium text-xl opacity-50 border border-slate-200 dark:border-slate-700">?</div>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {hasCustom 
                          ? <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:border-violet-800 dark:text-violet-300">🛠️ Custom Upload</span>
                          : over.local_image_url 
                            ? <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300">⚡ Cache Local</span>
                            : displayImage
                              ? <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">🇷🇺 Syrve Cloud</span>
                              : <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">Fără poză</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-slate-900 dark:text-white">{prod.name}</strong>
                          {prod.description && (
                            <button 
                              onClick={() => setPreviewDesc(prod)}
                              title="Vezi descrierea produsului"
                              className="w-6 h-6 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{categories[prod.categoryId] || 'Necunoscută'}</td>
                      <td className="px-4 py-3"><span className="font-bold text-slate-900 dark:text-white">{prod.price} lei</span></td>
                      
                      {/* Promo Price Column */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="—"
                              value={promoOverrides[prod.id]?.price || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPromoOverrides(prev => ({ ...prev, [prod.id]: { ...prev[prod.id], price: val } }));
                              }}
                              style={{ width: 70, padding: '4px 6px', fontSize: '0.85rem', borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', color: 'var(--text, #111)', textAlign: 'center' }}
                            />
                            {!savedPromos[prod.id]?.price ? (
                              <button
                                title="Salvează preț promoțional"
                                onClick={async () => {
                                  if (!activeLocation) return showToast('Alege locația mai întâi', 'err');
                                  if (!activeKiosk) return showToast('Scrie ID-ul Kiosk-ului mai întâi! (ex: cluj1)', 'err');
                                  try {
                                    const po = promoOverrides[prod.id] || {};
                                    if (!po.price) return showToast('Introdu un preț!', 'err');
                                    const payload = {
                                      productId: prod.id,
                                      price: parseFloat(po.price),
                                      start: po.start || null,
                                      end: po.end || null,
                                      popupStart: po.popupStart !== undefined ? po.popupStart : true,
                                      kioskId: activeKiosk
                                    };
                                    const res = await fetchWithAuth(`${BACKEND}/api/locations/${activeLocation}/promos`, {
                                      method: 'PUT',
                                      body: JSON.stringify(payload),
                                    });
                                    if (!res.ok) throw new Error('Eroare');
                                    setSavedPromos(prev => ({ ...prev, [prod.id]: payload }));
                                    showToast(`✅ Promoție salvată pe Kiosk ${activeKiosk}`);
                                  } catch (e) { showToast('❌ ' + e.message, 'err'); }
                                }}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 transition-colors"
                              >✓</button>
                            ) : (
                              <button
                                title="Șterge promoția"
                                onClick={async () => {
                                  if (!activeLocation) return;
                                  try {
                                    const res = await fetchWithAuth(`${BACKEND}/api/locations/${activeLocation}/promos`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ productId: prod.id, price: null, start: null, end: null, kioskId: activeKiosk }),
                                    });
                                    if (!res.ok) throw new Error('Eroare');
                                    const newPromo = { ...promoOverrides };
                                    delete newPromo[prod.id];
                                    setPromoOverrides(newPromo);
                                    const newSaved = { ...savedPromos };
                                    delete newSaved[prod.id];
                                    setSavedPromos(newSaved);
                                    showToast('🗑️ Promoție ștearsă');
                                  } catch (e) { showToast('❌ ' + e.message, 'err'); }
                                }}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                              >✕</button>
                            )}
                          </div>

                          {/* Checkbox Pop-up la Start */}
                          {savedPromos[prod.id]?.price && (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none" title="Bifează dacă vrei să apară ca fereastră pop-up când clientul începe comanda">
                              <input 
                                type="checkbox" 
                                className="w-3.5 h-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                                checked={promoOverrides[prod.id]?.popupStart !== false}
                                onChange={async (e) => {
                                  const checked = e.target.checked;
                                  setPromoOverrides(prev => ({ ...prev, [prod.id]: { ...prev[prod.id], popupStart: checked } }));
                                  setSavedPromos(prev => ({ ...prev, [prod.id]: { ...prev[prod.id], popupStart: checked } }));
                                  try {
                                    await fetchWithAuth(`${BACKEND}/api/locations/${activeLocation}/promos`, {
                                      method: 'PUT',
                                      body: JSON.stringify({
                                        productId: prod.id,
                                        price: parseFloat(promoOverrides[prod.id]?.price),
                                        popupStart: checked,
                                        kioskId: activeKiosk
                                      })
                                    });
                                    showToast(checked ? '✅ Pop-up la Start activat' : 'ℹ️ Pop-up la Start oprit');
                                  } catch (err) {
                                    showToast('❌ ' + err.message, 'err');
                                  }
                                }}
                              />
                              <span className="text-[11px] font-bold text-red-600 dark:text-red-400 whitespace-nowrap">🔥 Pop-up Start</span>
                            </label>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 text-center">
                        <label className="inline-flex cursor-pointer p-2">
                          <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-500 focus:ring-blue-500" checked={!over.is_hidden} onChange={() => toggleTag(prod.id, 'hidden')} />
                        </label>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <label className="inline-flex cursor-pointer p-2">
                          <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" checked={!!over.is_vegetarian} onChange={() => toggleTag(prod.id, 'veg')} />
                        </label>
                      </td>
                      
                      <td className="px-4 py-3 text-center">
                        <label className="inline-flex cursor-pointer p-2">
                          <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-red-500 focus:ring-red-500" checked={!!over.is_spicy} onChange={() => toggleTag(prod.id, 'spicy')} />
                        </label>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <label className="inline-flex cursor-pointer p-2" title="Afișează pe prima pagină">
                          <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500" checked={!!over.is_featured} onChange={() => toggleTag(prod.id, 'featured')} />
                        </label>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button title="Upload Poză Custom" onClick={() => handleImageUploadClick(prod.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          </button>
                          {hasCustom && (
                            <button title="Șterge Custom (Revine la Syrve)" onClick={() => deleteCustomImage(prod.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-500 border border-red-100 dark:border-red-900/50 transition-colors shadow-sm">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageItems.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-500 font-medium">Niciun produs găsit.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
          <span>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} din {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page===1} onClick={() => setPage(1)}>«</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page===1} onClick={() => setPage(p => p-1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k+1)
              .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=2)
              .map((p, idx, arr) => (
                <div key={p} className="flex items-center">
                  {idx>0 && arr[idx-1]!==p-1 && <span className="w-8 text-center text-slate-400">…</span>}
                  <button className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold transition-colors ${p === page ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} onClick={() => setPage(p)}>{p}</button>
                </div>
              ))}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page===totalPages} onClick={() => setPage(p => p+1)}>›</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page===totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-2xl text-sm font-bold shadow-xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-10 cursor-zoom-out"
        >
          <div className="relative max-w-full max-h-full flex justify-center animate-in zoom-in-95 duration-200">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" 
            />
            <div className="absolute -top-10 -right-10 text-white text-4xl font-light cursor-pointer select-none">&times;</div>
          </div>
        </div>
      )}

      {/* Description Preview Modal */}
      {previewDesc && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewDesc(null); }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-10"
        >
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setPreviewDesc(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center text-xl transition-colors"
            >
              &times;
            </button>
            <h3 className="m-0 mb-4 text-xl font-bold text-slate-900 dark:text-white pr-8">{previewDesc.name}</h3>
            <p className="m-0 text-slate-600 dark:text-slate-400 leading-relaxed text-sm whitespace-pre-wrap">
              {previewDesc.description || 'Acest produs nu are o descriere setată în sistem.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
