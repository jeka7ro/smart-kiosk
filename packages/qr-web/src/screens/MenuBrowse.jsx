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
          {filtered.map((p, i) => (
            <button
              key={p.id}
              className="mb-product-card fade-up"
              style={{ animationDelay: `${i * 0.04}s` }}
              onClick={() => setSelectedProduct(p)}
            >
              <div className="mb-prod-img">
                {p.image && !imgErrors[p.id]
                  ? <img src={p.image} alt={p.name} onError={() => setImgErrors(e => ({...e, [p.id]: true}))} />
                  : <span>{p.categoryEmoji || '🍽️'}</span>
                }
              </div>
              <div className="mb-prod-info">
                <h3>{p.name}</h3>
                <p className="mb-desc">{p.description}</p>
                {p.weight && <p className="mb-weight">{p.weight}g</p>}
                <div className="mb-prod-footer">
                  <span className="price price-md">{p.price} lei</span>
                  <span className="mb-add">+ Adaugă</span>
                </div>
              </div>
            </button>
          ))}
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
