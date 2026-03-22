import { useState, useEffect } from 'react';
import { useQrStore } from '../store/qrStore.js';
import './MenuBrowse.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// Mock sushi data for brands without Syrve org
const SUSHI_CATS = [
  { id: 'sm-rolls',  name: 'Rulouri',   emoji: '🌀' },
  { id: 'sm-sets',   name: 'Seturi',    emoji: '🎁' },
  { id: 'sm-nigiri', name: 'Nigiri',    emoji: '🍣' },
  { id: 'sm-supe',   name: 'Supe',      emoji: '🍜' },
  { id: 'sm-bauturi',name: 'Băuturi',   emoji: '🍵' },
];
const SUSHI_PRODUCTS = [
  { id:'su1', categoryId:'sm-rolls',  name:'California Roll',   price:38, description:'8 buc — Surimi, avocado, castravete, tobiko', image:'' },
  { id:'su2', categoryId:'sm-rolls',  name:'Philadelphia Roll', price:46, description:'8 buc — Somon afumat, cream cheese, avocado', image:'' },
  { id:'su3', categoryId:'sm-rolls',  name:'Dragon Roll',       price:52, description:'8 buc — Creveți tempura, avocado, sos unagi', image:'' },
  { id:'su4', categoryId:'sm-rolls',  name:'Spicy Tuna Roll',   price:48, description:'8 buc — Ton, sos picant, avocado, sesam', image:'' },
  { id:'su5', categoryId:'sm-sets',   name:'Set Master 48 buc', price:189,description:'48 rulouri asortate', image:'' },
  { id:'su6', categoryId:'sm-nigiri', name:'Nigiri Somon',      price:32, description:'6 buc — Orez sushi, somon proaspăt', image:'' },
  { id:'su7', categoryId:'sm-supe',   name:'Miso Soup',         price:18, description:'Tofu, alge wakame, ceapă verde', image:'' },
  { id:'su8', categoryId:'sm-bauturi',name:'Ceai Verde Japonez',price:14, description:'Sencha premium 400ml', image:'' },
];

// null = no Syrve org yet, use local mock
const BRAND_ORG_MAP = {
  smashme:     '9c63cff6-1d66-442d-a98d-2302656e3943',
  sushimaster: 'adddb5a0-26e5-4d50-b472-1c74726c3f72', // SM BRASOV
};

export default function MenuBrowse({ brand }) {
  const cartCount          = useQrStore((s) => s.getCartCount());
  const cartTotal          = useQrStore((s) => s.getCartTotal());
  const goTo               = useQrStore((s) => s.goTo);
  const setSelectedProduct = useQrStore((s) => s.setSelectedProduct);
  const tableNum           = useQrStore((s) => s.tableNum);

  const [categories,     setCategories]     = useState([]);
  const [products,       setProducts]       = useState([]);
  const [activecat,      setActivecat]      = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [imgErrors,      setImgErrors]      = useState({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    const orgId = BRAND_ORG_MAP[brand.id];

    if (!orgId) {
      // No Syrve org — use local mock (SushiMaster)
      const cats = brand.id === 'sushimaster' ? SUSHI_CATS : [];
      const prods = brand.id === 'sushimaster' ? SUSHI_PRODUCTS : [];
      setCategories(cats);
      setProducts(prods);
      setActivecat(cats[0]?.id || null);
      setLoading(false);
      return;
    }

    fetch(`${BACKEND}/api/menu?brandId=${brand.id}&orgId=${orgId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        const cats = data.categories || [];
        setCategories(cats);
        setProducts(data.products || []);
        setActivecat(cats[0]?.id || null);
        setLoading(false);
      })
      .catch(err => {
        console.error('[MenuBrowse] fetch failed:', err);
        setError('Meniul nu e disponibil momentan.');
        setLoading(false);
      });
  }, [brand.id]);

  const filtered = activecat
    ? products.filter(p => p.categoryId === activecat)
    : products;

  return (
    <div className="mb-screen safe-top">
      {/* Header */}
      <header className="mb-header">
        <div className="mb-brand">
          {brand.logoImg
            ? <img src={brand.logoImg} alt={brand.name} className="mb-logo" />
            : <span>{brand.emoji} {brand.name}</span>
          }
        </div>
        <span className="mb-table">🪑 Masa {tableNum}</span>
      </header>

      {/* Category pills */}
      {!loading && !error && (
        <nav className="mb-cats">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`mb-cat-pill ${activecat === cat.id ? 'active' : ''}`}
              onClick={() => setActivecat(cat.id)}
            >
              {cat.emoji || '🍽️'} {cat.name}
            </button>
          ))}
        </nav>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12 }}>
          <div style={{ width:44, height:44, border:'4px solid var(--border)', borderTopColor:'var(--primary)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
          <p style={{ color:'var(--text-muted)' }}>Se încarcă meniul...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign:'center', padding:'40px 20px' }}>
          <p>⚠️ {error}</p>
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => window.location.reload()}>Reîncearcă</button>
        </div>
      )}

      {/* Products list */}
      {!loading && !error && (
        <main className="mb-products">
          {filtered.map((p, i) => {
            const cartEntry = cartItems.find(item => item.productId === p.id);
            const cartQty = cartEntry ? cartEntry.quantity : 0;
            
            return (
            <div
              key={p.id}
              className="mb-product-card fade-up"
              style={{ animationDelay: `${i * 0.04}s`, display: 'flex', flexDirection: 'column', padding: 16, background: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', margin: 0, textAlign: 'left' }}
            >
              {/* Header: Name and Price */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }} onClick={() => setSelectedProduct(p)}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#111827', width: '70%', lineHeight: 1.2 }}>{p.name}</h3>
                <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.05rem' }}>{p.price}RON</span>
              </div>

              {/* Image & Description */}
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => cartQty === 0 ? useQrStore.getState().addToCart(p, 1, [], p.price) : null}>
                <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', background: '#f9fafb', marginBottom: 12, position: 'relative' }}>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedProduct(p); }} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', color: '#374151', fontSize: '1rem', fontWeight: 'bold', fontStyle: 'italic', fontFamily: 'serif', zIndex: 10 }}>i</button>
                  {p.image && !imgErrors[p.id] ? (
                    <img src={p.image} alt={p.name} onError={() => setImgErrors(e => ({...e, [p.id]: true}))} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, fontSize: '3rem' }}>{p.categoryEmoji || '🍽️'}</div>
                  )}
                </div>
                {p.description && (
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#6b7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>{p.description}</p>
                )}
              </div>

              {/* Action Bar (Footer) */}
              <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
                <button 
                  style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  ♡
                </button>

                {cartQty === 0 ? (
                  <button 
                    style={{ 
                      flex: 1, height: 44, borderRadius: 22, border: 'none', background: '#d32f2f', 
                      color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
                      boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)'
                    }}
                    onClick={(e) => { e.stopPropagation(); useQrStore.getState().addToCart(p, 1, [], p.price); }}
                  >
                    <span>+ Adaugă</span>
                    <span>{p.price} lei</span>
                  </button>
                ) : (
                  <div style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid #fca5a5', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }} onClick={e => e.stopPropagation()}>
                    <button style={{ width: 40, height: '100%', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.4rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => { if (cartQty <= 1) { useQrStore.getState().removeFromCart(cartEntry.id); } else { useQrStore.getState().updateCartItem(cartEntry.id, cartQty - 1); } }}>−</button>
                    <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>{cartQty} buc.</span>
                    <button style={{ width: 40, height: '100%', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.4rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => useQrStore.getState().updateCartItem(cartEntry.id, cartQty + 1)}>+</button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)' }}>
              <p>🍽️ Niciun produs în această categorie</p>
            </div>
          )}
        </main>
      )}

      {/* Cart sticky bar */}
      {cartCount > 0 && (
        <div className="sticky-bottom">
          <button className="btn btn-primary btn-lg btn-full" onClick={() => goTo('cart')}>
            <span className="badge" style={{ marginRight: 4 }}>{cartCount}</span>
            <span>Coșul meu</span>
            <span style={{ marginLeft: 'auto', fontWeight: 800 }}>{cartTotal.toFixed(0)} lei</span>
          </button>
        </div>
      )}
    </div>
  );
}
