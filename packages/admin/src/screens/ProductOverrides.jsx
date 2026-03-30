import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthProvider';
import './UsersManager.css';

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
  { id: 'sushimaster', label: 'Sushi Master',color: '#3b82f6' },
  { id: 'welovesushi', label: 'WeLoveSushi', color: '#f59e0b' },
  { id: 'ikura',       label: 'Ikura',       color: '#10b981' }
];

export default function ProductOverrides() {
  const { fetchWithAuth } = useAuth();
  const [products,    setProducts]    = useState([]);
  const [categories,  setCategories]  = useState({});
  const [overrides,   setOverrides]   = useState({});
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [activeBrand, setActiveBrand] = useState('smashme');
  const [toast,       setToast]       = useState(null);
  const [filterDiet,  setFilterDiet]  = useState(null); // null | 'veg' | 'spicy'
  const [previewImage,setPreviewImage]= useState(null);
  const [previewDesc, setPreviewDesc] = useState(null);
  
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

  const filtered = useMemo(() => {
    let list = products.filter(p => {
      const q = search.toLowerCase();
      const catName = categories[p.categoryId] || '';
      return p.name?.toLowerCase().includes(q) || catName.toLowerCase().includes(q);
    });
    if (filterDiet === 'veg')   list = list.filter(p => !!(overrides[p.id]?.is_vegetarian));
    if (filterDiet === 'spicy') list = list.filter(p => !!(overrides[p.id]?.is_spicy));
    return list;
  }, [products, search, categories, filterDiet, overrides]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleTag = async (productId, tagType) => {
    const currentOver = overrides[productId] || {};
    const payload = {
      is_vegetarian: tagType === 'veg' ? !currentOver.is_vegetarian : !!currentOver.is_vegetarian,
      is_spicy: tagType === 'spicy' ? !currentOver.is_spicy : !!currentOver.is_spicy,
    };

    setOverrides(prev => ({
      ...prev,
      [productId]: { ...prev[productId], ...payload }
    }));

    try {
      await fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${productId}/tags`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('✅ Preferință salvată');
    } catch (e) {
      showToast('❌ Eraore la salvare: ' + e.message, 'err');
      fetchAll(); // rollback
    }
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
    showToast('Încărcare...", "info"');

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
    if (!confirm('Ștergi poza Custom și revii la cea din Syrve?')) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/products/overrides/${activeBrand}/${productId}/image`, { method: 'DELETE' });
      showToast('🗑 Ștearsă! A revenit la baza Syrve.', 'ok');
      fetchAll();
    } catch (err) {
      showToast('❌ Eroare: ' + err.message, 'err');
    }
  };

  return (
    <div className="um-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Produse & Etichete</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Meniul sincronizat din Syrve. Aici poți adăuga manual supra-scrieri (poză HD proprie, filtru Vegetarian).</p>
        </div>
      </div>

      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/png, image/jpeg, image/webp" onChange={onFileChange} />

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="um-toolbar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {BRANDS.map(b => {
            const isActive = activeBrand === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setActiveBrand(b.id)}
                title={b.label}
                style={{
                  width: 38, height: 38, borderRadius: '50%', padding: 0,
                  border: isActive ? `2px solid ${b.color}` : '1px solid var(--border)',
                  background: '#fff', cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: isActive ? `0 4px 10px ${b.color}40` : 'none',
                  opacity: isActive ? 1 : 0.5,
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                }}
              >
                <img src={`/brands/${b.id}-logo.png`} alt={b.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none'; }} />
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 200, position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input 
            className="um-search" 
            placeholder="🔍 Caută produs sau categorie..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); }} 
            style={{ flex: 1, boxSizing: 'border-box' }} 
          />
          <button
            onClick={() => { setFilterDiet(filterDiet === 'veg' ? null : 'veg'); setPage(1); }}
            style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 40, border: filterDiet === 'veg' ? 'none' : '1px solid #10b981', background: filterDiet === 'veg' ? '#10b981' : 'transparent', color: filterDiet === 'veg' ? '#fff' : '#10b981', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
          >
            🍃 Vegetarian
          </button>
          <button
            onClick={() => { setFilterDiet(filterDiet === 'spicy' ? null : 'spicy'); setPage(1); }}
            style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 40, border: filterDiet === 'spicy' ? 'none' : '1px solid #ef4444', background: filterDiet === 'spicy' ? '#ef4444' : 'transparent', color: filterDiet === 'spicy' ? '#fff' : '#ef4444', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
          >
            🌶️ Picant
          </button>
        </div>
      </div>

      {/* ── Main Table ───────────────────────────────────────── */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>Se încarcă catalogul sincronizat...</p>
      ) : (
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th style={{ width: 80 }}>Imagine</th>
                <th>Sursă Imagine</th>
                <th>Produs</th>
                <th>Categorie</th>
                <th>Preț</th>
                <th style={{ textAlign: 'center' }}>🍃 Vegetarian</th>
                <th style={{ textAlign: 'center' }}>🌶️ Picant</th>
                <th style={{ textAlign: 'right' }}>Editează Poză</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((prod, i) => {
                const over = overrides[prod.id] || {};
                
                // Which image is actually displayed?
                const displayImage = over.custom_image_url || over.local_image_url || over.syrve_image_url || prod.image;
                const hasCustom = !!over.custom_image_url;
                
                return (
                  <tr key={prod.id}>
                    <td className="um-cell--muted">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td>
                      {displayImage
                        ? <img 
                            src={proxySyrveImage(displayImage)} 
                            alt="" 
                            onClick={() => setPreviewImage(proxySyrveImage(displayImage))}
                            title="Click pentru a mări imaginea"
                            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: hasCustom ? '2px solid #8b5cf6' : '1px solid var(--border)', cursor: 'pointer', transition: 'transform 0.1s' }} 
                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                            onError={e => { e.target.style.display='none'; }} 
                          />
                        : <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: '1.2rem' }}>?</div>
                      }
                    </td>
                    <td>
                      {hasCustom 
                        ? <span className="um-badge" style={{ background: '#ede9fe', color: '#6d28d9', borderColor: '#c4b5fd' }}>🛠️ Custom Upload</span>
                        : over.local_image_url 
                          ? <span className="um-badge" style={{ background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }}>⚡ Cache Local (Automat)</span>
                          : displayImage
                            ? <span className="um-badge" style={{ background: '#f3f4f6', color: '#4b5563' }}>🇷🇺 Syrve Cloud</span>
                            : <span className="um-badge" style={{ background: '#fef2f2', color: '#991b1b' }}>Fără poză</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong>{prod.name}</strong>
                        {prod.description && (
                          <button 
                            onClick={() => setPreviewDesc(prod)}
                            title="Vezi descrierea produsului"
                            style={{ 
                              background: 'transparent', border: 'none', padding: 0, margin: 0,
                              cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s',
                              display: 'flex', alignItems: 'center'
                            }}
                            onMouseOver={e => e.currentTarget.style.opacity = 1}
                            onMouseOut={e => e.currentTarget.style.opacity = 0.5}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="um-cell--muted">{categories[prod.categoryId] || 'Necunoscută'}</td>
                    <td><span style={{ fontWeight: 600 }}>{prod.price} lei</span></td>
                    
                    <td style={{ textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', cursor: 'pointer', padding: 8 }}>
                        <input type="checkbox" checked={!!over.is_vegetarian} onChange={() => toggleTag(prod.id, 'veg')} style={{ transform: 'scale(1.4)', margin: 0, accentColor: '#10b981' }} />
                      </label>
                    </td>
                    
                    <td style={{ textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', cursor: 'pointer', padding: 8 }}>
                        <input type="checkbox" checked={!!over.is_spicy} onChange={() => toggleTag(prod.id, 'spicy')} style={{ transform: 'scale(1.4)', margin: 0, accentColor: '#ef4444' }} />
                      </label>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button title="Upload Poză Custom" onClick={() => handleImageUploadClick(prod.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', width: 34, height: 34, padding: 0, borderRadius: '50%', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </button>
                        {hasCustom && (
                          <button title="Șterge Custom (Revine la Syrve)" onClick={() => deleteCustomImage(prod.id)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', width: 34, height: 34, padding: 0, borderRadius: '50%', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', opacity: 0.4 }}>Niciun produs găsit.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="um-pagination">
          <span className="um-page-info">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} din {filtered.length}</span>
          <div className="um-page-btns">
            <button className="um-btn um-btn--ghost" disabled={page===1} onClick={() => setPage(1)}>«</button>
            <button className="um-btn um-btn--ghost" disabled={page===1} onClick={() => setPage(p => p-1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k+1)
              .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=2)
              .map((p, idx, arr) => (
                <span key={`p-${p}`}>
                  {idx>0 && arr[idx-1]!==p-1 && <span className="um-page-ellipsis">…</span>}
                  <button className={`um-btn ${p===page?'um-btn--active':'um-btn--ghost'}`} onClick={() => setPage(p)}>{p}</button>
                </span>
              ))}
            <button className="um-btn um-btn--ghost" disabled={page===totalPages} onClick={() => setPage(p => p+1)}>›</button>
            <button className="um-btn um-btn--ghost" disabled={page===totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`um-toast ${toast.type==='err'?'um-toast--err':''}`}>{toast.msg}</div>}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 40, backdropFilter: 'blur(4px)'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex', justifyContent: 'center' }}>
            <img 
              src={previewImage} 
              alt="Preview" 
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }} 
            />
            <div style={{ position: 'absolute', top: -40, right: -40, color: 'white', fontSize: '2.5rem', fontWeight: 300, cursor: 'pointer', userSelect: 'none' }}>&times;</div>
          </div>
        </div>
      )}

      {/* Description Preview Modal */}
      {previewDesc && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewDesc(null); }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 40, backdropFilter: 'blur(2px)'
          }}
        >
          <div style={{ position: 'relative', width: 500, maxWidth: '100%', background: 'var(--card)', borderRadius: 16, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setPreviewDesc(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'var(--bg)', border: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              &times;
            </button>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: '1.25rem' }}>{previewDesc.name}</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
              {previewDesc.description || 'Acest produs nu are o descriere setată în sistem.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
