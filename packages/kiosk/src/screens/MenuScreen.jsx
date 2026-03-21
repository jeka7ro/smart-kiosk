import { useState, useEffect } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { useBrand } from '../App';
import { t } from '../i18n/translations.js';
import { getMenuData } from '../data/mockMenu.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import './MenuScreen.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// Map brand id → Syrve org ID
const BRAND_ORG_MAP = {
  smashme:     '9c63cff6-1d66-442d-a98d-2302656e3943',
  sushimaster: 'adddb5a0-26e5-4d50-b472-1c74726c3f72', // SM BRASOV
};

export default function MenuScreen() {
  useInactivityTimeout(90);
  const goTo              = useKioskStore((s) => s.goTo);
  const setSelectedProduct= useKioskStore((s) => s.setSelectedProduct);
  const cartCount         = useKioskStore((s) => s.getCartCount());
  const cartTotal         = useKioskStore((s) => s.getCartTotal());
  const orderType         = useKioskStore((s) => s.orderType);
  const tableNumber       = useKioskStore((s) => s.tableNumber);
  const lang              = useKioskStore((s) => s.lang);
  const brand             = useBrand();

  const [categories, setCategories] = useState([]);
  const [products,   setProducts]   = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Fetch menu — Syrve API for brands with org ID, mock data for others
  useEffect(() => {
    setLoading(true);
    setError(null);
    const orgId = BRAND_ORG_MAP[brand.id];

    if (!orgId) {
      // No Syrve org yet — use local mock data
      const { categories: cats, products: prods } = getMenuData(brand.id);
      setCategories(cats);
      setProducts(prods);
      setActiveCategory(cats[0]?.id || null);
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
        setActiveCategory(cats[0]?.id || null);
        setLoading(false);
      })
      .catch(err => {
        console.error('[MenuScreen] API fetch failed, falling back to mock:', err);
        const { categories: cats, products: prods } = getMenuData(brand.id);
        setCategories(cats);
        setProducts(prods);
        setActiveCategory(cats[0]?.id || null);
        setLoading(false);
      });
  }, [brand.id]);

  const filteredProducts = activeCategory
    ? products.filter(p => p.categoryId === activeCategory)
    : products;

  if (loading) {
    return (
      <div className="menu-screen screen">
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16 }}>
          <div className="spinner" style={{ width:56, height:56, border:'5px solid var(--border)', borderTopColor:'var(--primary)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
          <p style={{ color:'var(--text-muted)', fontFamily:'Outfit,sans-serif' }}>Se încarcă meniul...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="menu-screen screen">
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16 }}>
          <span style={{ fontSize:'3rem' }}>⚠️</span>
          <p style={{ color:'var(--text)', fontFamily:'Outfit,sans-serif', textAlign:'center' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reîncearcă</button>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-screen screen">
      {/* ─── TOP BAR ──────────────────────────────── */}
      <header className="menu-header">
        <div className="menu-header-left">
          {brand.logoImg
            ? <img src={brand.logoImg} alt={brand.name} className="menu-logo" />
            : <span className="menu-brand-name">{brand.name}</span>
          }
        </div>
        <div className="menu-order-info">
          {orderType === 'dine-in'
            ? <span>🪑 {t('table', lang)} #{tableNumber}</span>
            : <span>🛍️ {t('takeaway', lang)}</span>
          }
        </div>
        <button className="cart-fab" onClick={() => goTo('cart')} disabled={cartCount === 0}>
          <span className="cart-fab-icon">🛒</span>
          <span className="cart-fab-text">
            {cartCount > 0 ? `${cartCount} ${cartCount > 1 ? t('items_many', lang) : t('item_one', lang)}` : t('cart_empty', lang)}
          </span>
          {cartCount > 0 && (
            <span className="cart-fab-total">{cartTotal.toFixed(0)} {t('lei', lang)}</span>
          )}
          {cartCount > 0 && <span className="badge">{cartCount}</span>}
        </button>
      </header>

      {/* ─── CATEGORY TABS ────────────────────────── */}
      <nav className="category-nav">
        <div className="category-tabs">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`cat-tab ${activeCategory === cat.id ? 'cat-tab--active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="cat-icon">{cat.emoji || '🍽️'}</span>
              <span className="cat-name">{cat.name}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ─── PRODUCTS GRID ───────────────────────── */}
      <main className="products-grid scroll-y">
        {filteredProducts.length === 0 ? (
          <div className="empty-cat">
            <span style={{fontSize:'3rem'}}>🍽️</span>
            <p>{t('cart_empty', lang)}</p>
          </div>
        ) : (
          <div className="products-list">
            {filteredProducts.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                delay={i * 0.04}
                lang={lang}
                onClick={() => setSelectedProduct(product)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProductCard({ product, delay, onClick, lang }) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      className="product-card fade-in"
      style={{ animationDelay: `${delay}s` }}
      onClick={onClick}
    >
      <div className="product-img">
        {product.image && !imgError ? (
          <img
            src={product.image}
            alt={product.name}
            className="product-photo"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="product-emoji">🍽️</span>
        )}
      </div>
      <div className="product-info">
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <h3 className="product-name">{product.name}</h3>
        <p className="product-desc">{product.description}</p>
        {product.allergenGroups?.length > 0 && (
          <div className="product-allergens">
            {product.allergenGroups.map(a => (
              <span key={a.id || a} className="allergen-tag">{a.name || a}</span>
            ))}
          </div>
        )}
        <div className="product-footer">
          <span className="price price-lg">{product.price} {t('lei', lang)}</span>
          <span className="add-btn">+ {t('add_to_cart', lang)}</span>
        </div>
      </div>
    </button>
  );
}
