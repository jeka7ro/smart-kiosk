import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';
import BrandLogo from '../components/BrandLogo';
import { Search, Upload, RotateCcw, Info, Check, X } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// Proxy image URLs — direct Syrve CDN loading with local upload fallback
const proxySyrveImage = (url) => {
  if (!url) return null;
  if (url.startsWith('/uploads')) {
    const base = BACKEND.endsWith('/') ? BACKEND.slice(0, -1) : BACKEND;
    return `${base}${url}`;
  }
  return url;
};

function ProductThumbnail({ product, override, onClick }) {
  const [useFallback, setUseFallback] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setUseFallback(false);
    setHasError(false);
  }, [product.id, override?.custom_image_url, override?.syrve_image_url]);

  const hasCustom = !!override?.custom_image_url;
  // Priority: custom uploaded HD photo > original Syrve product image > override syrve image > local upload path
  const primary = override?.custom_image_url || product.image || override?.syrve_image_url || override?.local_image_url;
  const fallback = (primary !== product.image && product.image) ? product.image : (override?.syrve_image_url || null);

  const activeSrc = useFallback && fallback ? proxySyrveImage(fallback) : (primary ? proxySyrveImage(primary) : null);

  if (!activeSrc || hasError) {
    return (
      <div 
        className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs uppercase shrink-0 select-none shadow-xs"
        title="Fără imagine"
      >
        {(product.name || 'P').slice(0, 2)}
      </div>
    );
  }

  return (
    <div className="relative shrink-0 w-12 h-12">
      <img
        src={activeSrc}
        alt={product.name}
        onClick={onClick}
        title="Click pentru a mări imaginea"
        className={`w-12 h-12 object-cover rounded-xl cursor-pointer transition-transform hover:scale-105 shadow-xs ${
          hasCustom ? 'border-2 border-violet-500' : 'border border-slate-200 dark:border-slate-700'
        }`}
        onError={() => {
          if (!useFallback && fallback && fallback !== primary) {
            setUseFallback(true);
          } else {
            setHasError(true);
          }
        }}
      />
      {hasCustom && (
        <span 
          className="absolute -top-1 -right-1 w-3 h-3 bg-violet-600 rounded-full border-2 border-white dark:border-slate-900 shadow-xs" 
          title="Poză Custom HD"
        />
      )}
    </div>
  );
}

const BRANDS = [
  { id: 'smashme',     label: 'SmashMe',     color: '#ef4444' },
  { id: 'rollmaster',  label: 'Roll Master', color: '#e31e24' },
  { id: 'lovesushi',   label: 'Love Sushi',  color: '#ec4899' },
  { id: 'pokiwoki',    label: 'Poki-Woki',   color: '#f97316' },
  { id: 'crunch',      label: 'Crunch',      color: '#eab308' },
  { id: 'welovesushi', label: 'WeLoveSushi', color: '#8b5cf6' }
];

export default function ProductOverrides() {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [products,    setProducts]    = useState([]);
  const [categories,  setCategories]  = useState({});
  const [overrides,   setOverrides]   = useState({});
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(25);
  const [search,      setSearch]      = useState('');
  const [activeBrand, setActiveBrand] = useState(() => localStorage.getItem('admin_active_brand') || 'smashme');
  const [toast,       setToast]       = useState(null);
  const [filterDiet,  setFilterDiet]  = useState(() => localStorage.getItem('admin_product_filter_diet') || null); // null | 'veg' | 'spicy' | 'promo' | 'featured'
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
      // If activeLocation is selected, scope orgId and locId to show exact location items
      const activeLocObj = locations.find(l => l.id === activeLocation);
      const locOrgId = (activeLocObj?.orgIds && activeLocObj.orgIds[activeBrand]) || '';
      const orgParam = locOrgId ? `&orgId=${encodeURIComponent(locOrgId)}` : '';
      const locParam = activeLocation ? `&locId=${encodeURIComponent(activeLocation)}` : '';
      const mRes = await fetchWithAuth(`${BACKEND}/api/menu?brandId=${activeBrand}${orgParam}${locParam}&includeHidden=true`);
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

    } catch (e) { showToast('Eroare la încărcare: ' + e.message, 'err'); }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    setSearch('');
    setPage(1);
    fetchAll(); 
  }, [activeBrand, activeLocation, locations.length]);

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

  // Filter locations strictly by activeBrand (only locations that belong to this brand)
  const brandLocations = useMemo(() => {
    return locations.filter(loc => {
      const bList = loc.brands || [];
      const orgs = loc.orgIds || {};
      return bList.includes(activeBrand) || !!orgs[activeBrand];
    });
  }, [locations, activeBrand]);

  // When activeBrand changes, ensure activeLocation belongs to that brand
  useEffect(() => {
    if (brandLocations.length > 0) {
      if (!brandLocations.some(l => l.id === activeLocation)) {
        setActiveLocation(brandLocations[0].id);
      }
    } else {
      setActiveLocation('');
    }
  }, [activeBrand, brandLocations]);

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
        if (loc.kioskUrl && !known.find(k => k.kioskId === loc.kioskUrl)) {
          known.push({ kioskId: loc.kioskUrl, name: loc.kioskUrl });
        }
        if (loc.id && !known.find(k => k.kioskId === loc.id)) {
          known.push({ kioskId: loc.id, name: loc.name || loc.id });
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
        const formattedPromos = {};
        Object.keys(pData).forEach(id => {
          const item = pData[id];
          if (item && item.price !== undefined && item.price !== null) {
            const num = parseFloat(String(item.price).replace(',', '.'));
            formattedPromos[id] = {
              ...item,
              price: !isNaN(num) ? num.toFixed(2) : item.price
            };
          }
        });
        setPromoOverrides(formattedPromos);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems  = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleTag = async (productId, tagType) => {
    const prod = products.find(p => p.id === productId);
    const currentOver = overrides[productId] || {};
    const payload = {
      product_name: prod?.name || '',
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
      showToast('Preferință salvată');
    } catch (e) {
      showToast('Eroare la salvare: ' + e.message, 'err');
      fetchAll(); // rollback
    }
  };

  const handleBulkToggle = async (tagType, newValue) => {
    if (filtered.length === 0) return;
    const ok = await confirm(`Aplici modificarea pe toate cele ${filtered.length} produse afișate?`, { title: 'Modificare în masă', icon: '', okLabel: 'Aplică', danger: false });
    if (!ok) return;
    
    setLoading(true);
    let successCount = 0;
    
    // Optistic UI bulk update
    const updates = {};
    const fieldName = tagType === 'veg' ? 'is_vegetarian' : tagType === 'spicy' ? 'is_spicy' : tagType === 'featured' ? 'is_featured' : 'is_hidden';
    filtered.forEach(p => {
       const currentOver = overrides[p.id] || {};
       updates[p.id] = { ...currentOver, [fieldName]: newValue, product_name: p.name || '' };
    });
    setOverrides(prev => ({ ...prev, ...updates }));

    // Send requests
    for (const p of filtered) {
       const payload = { ...updates[p.id], product_name: p.name || '' };
       try {
         await fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${p.id}/tags`, {
           method: 'PUT',
           body: JSON.stringify(payload),
         });
         successCount++;
       } catch(e) { console.error('Failed to bulk update', p.id); }
    }
    setLoading(false);
    showToast(`Au fost marcate ${successCount} produse.`);
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
      showToast('Poză Custom salvată!', 'ok');
      fetchAll();
    } catch (err) {
      showToast('Eroare: ' + err.message, 'err');
    }
  };

  const deleteCustomImage = async (productId) => {
    const ok = await confirm('Ștergi poza Custom și revii la cea din Syrve?', { icon: '', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${productId}/image`, { method: 'DELETE' });
      showToast('Ștearsă! A revenit la baza Syrve.', 'ok');
      fetchAll();
    } catch (err) {
      showToast('Eroare: ' + err.message, 'err');
    }
  };

  const handleSavePromo = async (prodId, explicitPrice) => {
    if (!activeLocation) return showToast('Alege locația mai întâi', 'err');
    if (!activeKiosk) return showToast('Scrie ID-ul Kiosk-ului mai întâi! (ex: cluj1)', 'err');
    try {
      const prod = products.find(p => p.id === prodId);
      const po = promoOverrides[prodId] || {};
      const rawVal = String(explicitPrice !== undefined ? explicitPrice : (po.price || '')).replace(',', '.').trim();
      if (!rawVal) return;
      const parsedPrice = parseFloat(rawVal);
      if (isNaN(parsedPrice) || parsedPrice <= 0) return showToast('Introdu un preț valid (ex: 32.99)!', 'err');
      const numPrice = Math.round(parsedPrice * 100) / 100;
      const payload = {
        productId: prodId,
        productName: prod?.name || '',
        price: numPrice,
        start: po.start || null,
        end: po.end || null,
        popupStart: po.popupStart !== undefined ? !!po.popupStart : false,
        kioskId: activeKiosk
      };
      const res = await fetchWithAuth(`${BACKEND}/api/locations/${activeLocation}/promos`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Eroare la salvare');

      // Mirror promo price into global product_overrides table as durable backup
      fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${prodId}/promo`, {
        method: 'PUT',
        body: JSON.stringify({
          promo_price: numPrice,
          promo_start: po.start || null,
          promo_end: po.end || null,
          product_name: prod?.name || ''
        }),
      }).catch(() => {});

      setSavedPromos(prev => ({ ...prev, [prodId]: payload }));
      setPromoOverrides(prev => ({ ...prev, [prodId]: { ...prev[prodId], price: numPrice.toFixed(2), productName: prod?.name || '' } }));
      showToast(`Promoție salvată: ${numPrice.toFixed(2)} lei pe Kiosk ${activeKiosk}`);
    } catch (e) {
      showToast('Eroare: ' + e.message, 'err');
    }
  };

  const handleDeletePromo = async (prodId) => {
    if (!activeLocation) return;
    try {
      const prod = products.find(p => p.id === prodId);
      const res = await fetchWithAuth(`${BACKEND}/api/locations/${activeLocation}/promos`, {
        method: 'PUT',
        body: JSON.stringify({ productId: prodId, productName: prod?.name || '', price: null, start: null, end: null, kioskId: activeKiosk }),
      });
      if (!res.ok) throw new Error('Eroare la ștergere');

      // Also reset in product_overrides
      fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${prodId}/promo`, {
        method: 'PUT',
        body: JSON.stringify({ promo_price: null, promo_start: null, promo_end: null, product_name: prod?.name || '' }),
      }).catch(() => {});

      setPromoOverrides(prev => {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      });
      setSavedPromos(prev => {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      });
      showToast('Promoție ștearsă');
    } catch (e) {
      showToast('Eroare: ' + e.message, 'err');
    }
  };

  const returnKioskId = localStorage.getItem('admin_return_to_kiosk');
  const returnKioskName = localStorage.getItem('admin_return_to_kiosk_name');

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] m-0">Produse & Etichete</h2>
          <p className="m-0 text-[13px] text-[#6E6E73] dark:text-[#98989D] mt-0.5">
            Meniul sincronizat din Syrve. Adaugă poze HD proprii, preț promoțional sau oferte Pop-up Start.
          </p>
        </div>
        {returnKioskId && (
          <button
            type="button"
            onClick={() => {
              window.location.hash = 'kiosks';
            }}
            className="apple-btn-secondary text-[12px] px-3.5 py-1.5 shrink-0"
          >
            <span>← Înapoi la Setări Kiosk</span>
            {returnKioskName && (
              <span className="px-2 py-0.5 rounded-md bg-[#007AFF]/12 text-[#007AFF] font-semibold text-[11px]">
                {returnKioskName}
              </span>
            )}
          </button>
        )}
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/webp" onChange={onFileChange} />

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="apple-card p-3.5 flex flex-col gap-3">
        {/* Brand Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {BRANDS.map(b => {
            const isActive = activeBrand === b.id;
            return (
              <button
                key={b.id}
                onClick={() => {
                  setActiveBrand(b.id);
                  localStorage.setItem('admin_active_brand', b.id);
                }}
                className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-semibold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
                }`}
              >
                <BrandLogo brandId={b.id} size={15} />
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap gap-2 items-center">
          {brandLocations.length > 0 && (
            <select
              value={activeLocation}
              onChange={e => setActiveLocation(e.target.value)}
              className="apple-input py-1.5 px-3 text-[12px] font-medium cursor-pointer"
            >
              <option value="" disabled>Locație...</option>
              {brandLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
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
                className="apple-input py-1.5 px-3 text-[12px] font-medium cursor-pointer min-w-[110px]"
              >
                <option value="" disabled>Kiosk...</option>
                {knownKiosks.length === 0 && (
                  <option value="" disabled>Fără kiosk-uri</option>
                )}
                {knownKiosks.map(k => (
                  <option key={k.kioskId} value={k.kioskId}>{k.name}</option>
                ))}
              </select>
            );
          })()}

          <select
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
            className="apple-input py-1.5 px-3 text-[12px] font-medium cursor-pointer max-w-[180px]"
          >
            <option value="">Toate categoriile</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="relative flex-1 min-w-[180px]">
            <input
              className="apple-input rounded-full w-full pl-8 pr-3 py-1.5 text-[12px]"
              placeholder="Caută produs..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {[
              { id: 'veg', label: 'Vegetarian' },
              { id: 'spicy', label: 'Picant' },
              { id: 'promo', label: 'Doar Promo' },
              { id: 'featured', label: 'Prima Pagină' },
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => {
                  const next = filterDiet === pill.id ? null : pill.id;
                  setFilterDiet(next);
                  if (next) localStorage.setItem('admin_product_filter_diet', next);
                  else localStorage.removeItem('admin_product_filter_diet');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer ${
                  filterDiet === pill.id
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Table ───────────────────────────────────────── */}
      {loading ? (
        <div className="apple-card flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-6 h-6 border-2 border-black/10 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
          <span className="text-[#86868B] text-[13px] font-medium">Se încarcă catalogul sincronizat...</span>
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
                  <th className="w-12 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">#</th>
                  <th className="w-16 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Imagine</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Produs & Categorie</th>
                  <th className="w-28 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preț</th>
                  <th className="w-40 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Promoție</th>
                  <th className="w-28 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" title="Bifează/Debifează pe Toate">
                      <input 
                        type="checkbox" 
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400 cursor-pointer" 
                        checked={filtered.length > 0 && filtered.every(p => !overrides[p.id]?.is_hidden)} 
                        onChange={() => {
                          const allAvailable = filtered.length > 0 && filtered.every(p => !overrides[p.id]?.is_hidden);
                          handleBulkToggle('hidden', allAvailable);
                        }} 
                      />
                      <span>Disponibil</span>
                    </label>
                  </th>
                  <th className="w-24 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" title="Bifează/Debifează pe Toate">
                      <input 
                        type="checkbox" 
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400 cursor-pointer" 
                        checked={filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_vegetarian)} 
                        onChange={() => {
                          const allVeg = filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_vegetarian);
                          handleBulkToggle('veg', !allVeg);
                        }} 
                      />
                      <span>Veg</span>
                    </label>
                  </th>
                  <th className="w-24 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" title="Bifează/Debifează pe Toate">
                      <input 
                        type="checkbox" 
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400 cursor-pointer" 
                        checked={filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_spicy)} 
                        onChange={() => {
                          const allSpicy = filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_spicy);
                          handleBulkToggle('spicy', !allSpicy);
                        }} 
                      />
                      <span>Picant</span>
                    </label>
                  </th>
                  <th className="w-28 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" title="Bifează/Debifează pe Toate">
                      <input 
                        type="checkbox" 
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400 cursor-pointer" 
                        checked={filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_featured)} 
                        onChange={() => {
                          const allFeatured = filtered.length > 0 && filtered.every(p => overrides[p.id]?.is_featured);
                          handleBulkToggle('featured', !allFeatured);
                        }} 
                      />
                      <span>Prima Pagină</span>
                    </label>
                  </th>
                  <th className="w-24 px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageItems.map((prod, i) => {
                  const over = overrides[prod.id] || {};
                  const hasCustom = !!over.custom_image_url;
                  
                  return (
                    <tr key={prod.id} className="transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-3 text-center text-xs text-slate-400 font-medium">
                        {(page - 1) * pageSize + i + 1}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex justify-center">
                          <ProductThumbnail 
                            product={prod} 
                            override={over} 
                            onClick={(src) => setPreviewImage(src)} 
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 min-w-0 max-w-[320px]">
                          <strong className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {prod.name}
                          </strong>
                          {prod.description && (
                            <button 
                              onClick={() => setPreviewDesc(prod)}
                              title="Vezi descrierea"
                              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded transition-colors"
                            >
                              <Info size={13} />
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {categories[prod.categoryId] || 'Fără categorie'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {prod.price} lei
                        </span>
                      </td>
                      
                      {/* Promo Price Column */}
                      <td className="px-4 py-3">
                        {(() => {
                          const rawCurrent = promoOverrides[prod.id]?.price;
                          const numCurrent = (rawCurrent !== undefined && rawCurrent !== null && rawCurrent !== '') ? parseFloat(String(rawCurrent).replace(',', '.')) : null;
                          const savedItem = savedPromos[prod.id];
                          const numSaved = (savedItem?.price !== undefined && savedItem?.price !== null && savedItem?.price !== '') ? parseFloat(String(savedItem.price).replace(',', '.')) : null;

                          const isDirty = numCurrent !== null && !isNaN(numCurrent) && (numSaved === null || Math.abs(numCurrent - numSaved) > 0.001);
                          const hasSaved = numSaved !== null && !isNaN(numSaved) && numSaved > 0;

                          return (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="—"
                                  value={rawCurrent !== undefined && rawCurrent !== null ? rawCurrent : ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPromoOverrides(prev => ({ ...prev, [prod.id]: { ...prev[prod.id], price: val } }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSavePromo(prod.id);
                                    }
                                  }}
                                  onBlur={() => {
                                    if (rawCurrent !== undefined && rawCurrent !== null && rawCurrent !== '') {
                                      const num = parseFloat(String(rawCurrent).replace(',', '.'));
                                      if (!isNaN(num) && num > 0) {
                                        const formatted = (Math.round(num * 100) / 100).toFixed(2);
                                        setPromoOverrides(prev => ({ ...prev, [prod.id]: { ...prev[prod.id], price: formatted } }));
                                        if (isDirty) {
                                          handleSavePromo(prod.id, formatted);
                                        }
                                      }
                                    }
                                  }}
                                  className={`w-20 px-2 py-1 text-xs font-semibold text-center rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                                    isDirty ? 'border-emerald-500' : 'border-slate-200 dark:border-slate-700'
                                  }`}
                                />
                                {isDirty && (
                                  <button
                                    title="Salvează preț (Enter)"
                                    onClick={() => handleSavePromo(prod.id)}
                                    className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                                  >
                                    <Check size={12} />
                                  </button>
                                )}
                                {hasSaved && (
                                  <button
                                    title="Șterge promoția"
                                    onClick={() => handleDeletePromo(prod.id)}
                                    className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>

                              {/* Checkbox Pop-up la Start */}
                              {hasSaved && (
                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" title="Afișează pop-up la începerea comenzii">
                                  <input 
                                    type="checkbox" 
                                    className="w-3 h-3 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400"
                                    checked={promoOverrides[prod.id]?.popupStart === true}
                                    onChange={async (e) => {
                                      const checked = e.target.checked;
                                      setPromoOverrides(prev => ({ ...prev, [prod.id]: { ...prev[prod.id], popupStart: checked } }));
                                      setSavedPromos(prev => ({ ...prev, [prod.id]: { ...prev[prod.id], popupStart: checked } }));
                                      try {
                                        await fetchWithAuth(`${BACKEND}/api/locations/${activeLocation}/promos`, {
                                          method: 'PUT',
                                          body: JSON.stringify({
                                            productId: prod.id,
                                            productName: prod.name || '',
                                            price: parseFloat(promoOverrides[prod.id]?.price),
                                            popupStart: checked,
                                            kioskId: activeKiosk
                                          })
                                        });
                                        showToast(checked ? 'Pop-up la Start activat' : 'Pop-up la Start oprit');
                                      } catch (err) {
                                        showToast('Eroare: ' + err.message, 'err');
                                      }
                                    }}
                                  />
                                  <span className="whitespace-nowrap">Pop-up Start</span>
                                </label>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      
                      {/* Disponibil */}
                      <td className="px-3 py-3 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400 cursor-pointer" 
                            checked={!over.is_hidden} 
                            onChange={() => toggleTag(prod.id, 'hidden')} 
                          />
                        </label>
                      </td>

                      {/* Veg */}
                      <td className="px-3 py-3 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400 cursor-pointer" 
                            checked={!!over.is_vegetarian} 
                            onChange={() => toggleTag(prod.id, 'veg')} 
                          />
                        </label>
                      </td>
                      
                      {/* Spicy */}
                      <td className="px-3 py-3 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400 cursor-pointer" 
                            checked={!!over.is_spicy} 
                            onChange={() => toggleTag(prod.id, 'spicy')} 
                          />
                        </label>
                      </td>

                      {/* Prima Pagină */}
                      <td className="px-3 py-3 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer" title="Afișează pe prima pagină">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400 cursor-pointer" 
                            checked={!!over.is_featured} 
                            onChange={() => toggleTag(prod.id, 'featured')} 
                          />
                        </label>
                      </td>

                      {/* Acțiuni */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            title="Upload Poză Custom HD" 
                            onClick={() => handleImageUploadClick(prod.id)} 
                            className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            <Upload size={13} />
                          </button>
                          {hasCustom && (
                            <button 
                              title="Șterge Custom (Revine la Syrve)" 
                              onClick={() => deleteCustomImage(prod.id)} 
                              className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/30 text-slate-500 hover:text-red-600 transition-colors"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500 font-medium text-xs">
                      Niciun produs găsit conform filtrelor selectate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination Footer ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <div>
          {filtered.length > 0 ? (
            <span>
              Afișare <span className="font-bold text-slate-700 dark:text-slate-200">{(page - 1) * pageSize + 1}</span>–
              <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(page * pageSize, filtered.length)}</span> din{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{filtered.length}</span> produse
            </span>
          ) : (
            <span>0 produse</span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span>Rânduri pe pagină:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                disabled={page === 1}
                onClick={() => setPage(1)}
                title="Prima pagină"
              >
                «
              </button>
              <button
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                title="Pagina precedentă"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, k) => k + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => (
                  <div key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="w-5 text-center text-slate-400">…</span>}
                    <button
                      className={`w-7 h-7 flex items-center justify-center rounded-full font-bold transition-colors ${
                        p === page
                          ? 'bg-[#007AFF] text-white shadow-[0_2px_6px_rgba(0,122,255,0.3)]'
                          : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                      }`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  </div>
                ))}
              <button
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                title="Pagina următoare"
              >
                ›
              </button>
              <button
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
                title="Ultima pagină"
              >
                »
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-[#1C1C1E] dark:bg-[#2C2C2E] text-white text-[13px] font-medium shadow-2xl border border-white/10 flex items-center gap-2.5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className={`w-2 h-2 rounded-full ${toast.type === 'err' ? 'bg-[#FF3B30]' : 'bg-[#34C759]'}`} />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-6 sm:p-10 cursor-zoom-out animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full max-h-full flex justify-center animate-in zoom-in-95 duration-200"
          >
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="apple-close-btn absolute top-3 right-3 shadow-lg"
              title="Închide"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Description Preview Modal */}
      {previewDesc && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewDesc(null); }}
          className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-10 animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg apple-modal p-6 sm:p-7 animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setPreviewDesc(null)}
              className="apple-close-btn absolute top-4 right-4"
              title="Închide"
            >
              <X size={16} />
            </button>
            <h3 className="m-0 mb-3 text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] pr-10">{previewDesc.name}</h3>
            <p className="m-0 text-[#6E6E73] dark:text-[#98989D] leading-relaxed text-[13px] whitespace-pre-wrap">
              {previewDesc.description || 'Acest produs nu are o descriere setată în sistem.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
