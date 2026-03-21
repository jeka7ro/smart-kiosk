import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { useBrand } from '../App';
import { BRANDS } from '../config/brands.js';
import { t } from '../i18n/translations.js';
import { getMenuData } from '../data/mockMenu.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import './MenuScreen.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// Fallback org ID map (used when no location is loaded)
const BRAND_ORG_MAP = {
  smashme:     '9c63cff6-1d66-442d-a98d-2302656e3943',
  sushimaster: 'adddb5a0-26e5-4d50-b472-1c74726c3f72',
};

// Brand display info for tabs
const BRAND_TAB_INFO = {
  smashme:     { label: 'SmashMe',      color: '#EE3B24', emoji: '🍔' },
  sushimaster: { label: 'Sushi Master', color: '#E31E24', emoji: '🍣' },
  ikura:       { label: 'Ikura',        color: '#8b5cf6', emoji: '🍱' },
  welovesushi: { label: 'WeLoveSushi',  color: '#ec4899', emoji: '🍣' },
};

export default function MenuScreen() {
  useInactivityTimeout(90);
  const goTo              = useKioskStore((s) => s.goTo);
  const setSelectedProduct= useKioskStore((s) => s.setSelectedProduct);
  const addToCart          = useKioskStore((s) => s.addToCart);
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
  const [search, setSearch]   = useState('');
  const [flyAnim, setFlyAnim] = useState(null);
  const cartBarRef = useRef(null);

  // Multi-brand state
  const [locationBrands, setLocationBrands] = useState([brand.id]); // brands at this location
  const [activeBrand, setActiveBrand]       = useState(brand.id);   // currently viewed brand
  const [locationOrgIds, setLocationOrgIds]  = useState({});         // brandId → orgId from location

  // Fetch location to discover multi-brand capability
  useEffect(() => {
    const locId = new URLSearchParams(window.location.search).get('loc');
    if (!locId) return; // no location → single brand mode
    fetch(`${BACKEND}/api/locations/${locId}`)
      .then(r => r.json())
      .then(loc => {
        if (loc.brands && loc.brands.length > 0) {
          setLocationBrands(loc.brands);
          setLocationOrgIds(loc.orgIds || {});
          // Keep active brand if it's in the list, otherwise pick first
          if (!loc.brands.includes(activeBrand)) {
            setActiveBrand(loc.brands[0]);
          }
        }
      })
      .catch(() => {}); // silently fail — use single brand mode
  }, []);

  // Fetch menu for active brand
  useEffect(() => {
    setLoading(true);
    setError(null);
    // Prefer location's orgId, fallback to hardcoded map
    const orgId = locationOrgIds[activeBrand] || BRAND_ORG_MAP[activeBrand];

    const pickDefault = (cats) => {
      const burger = cats.find(c => /burger/i.test(c.name));
      return burger?.id || cats[0]?.id || null;
    };

    if (!orgId) {
      const { categories: cats, products: prods } = getMenuData(activeBrand);
      setCategories(cats);
      setProducts(prods);
      setActiveCategory(pickDefault(cats));
      setLoading(false);
      return;
    }

    fetch(`${BACKEND}/api/menu?brandId=${activeBrand}&orgId=${orgId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        const cats = data.categories || [];
        setCategories(cats);
        setProducts((data.products || []).filter(p => p.price > 0));
        setActiveCategory(pickDefault(cats));
        setLoading(false);
      })
      .catch(err => {
        console.error('[MenuScreen] API fetch failed, falling back to mock:', err);
        const { categories: cats, products: prods } = getMenuData(activeBrand);
        setCategories(cats);
        setProducts(prods);
        setActiveCategory(pickDefault(cats));
        setLoading(false);
      });
  }, [activeBrand, locationOrgIds]);

  // Build category → first product image map
  const catImages = useMemo(() => {
    const map = {};
    categories.forEach(cat => {
      const prod = products.find(p => p.categoryId === cat.id && p.image);
      if (prod) map[cat.id] = prod.image;
    });
    return map;
  }, [categories, products]);

  // Filter products by category + search
  const filteredProducts = products.filter(p => {
    const matchesCat = !activeCategory || p.categoryId === activeCategory;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Quick add to cart with fly animation
  const handleQuickAdd = useCallback((product, cardEl) => {
    addToCart(product, 1, [], product.price, activeBrand);

    // Fly animation: get card position and cart bar position
    if (cardEl && cartBarRef.current) {
      const cardRect = cardEl.getBoundingClientRect();
      const cartRect = cartBarRef.current.getBoundingClientRect();
      setFlyAnim({
        id: Date.now(),
        img: product.image,
        startX: cardRect.left + cardRect.width / 2,
        startY: cardRect.top + cardRect.height / 3,
        endX: cartRect.left + cartRect.width / 2,
        endY: cartRect.top,
      });
      setTimeout(() => setFlyAnim(null), 850);
    }
  }, [addToCart, activeBrand]);

  if (loading) {
    return (
      <div className="menu-screen screen">
        <div className="menu-loading">
          <div className="spinner" />
          <p>{t('loading', lang)}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="menu-screen screen">
        <div className="menu-loading">
          <p>{t('error_loading', lang)}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>{t('retry', lang)}</button>
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

        <div className="menu-search">
          <input
            type="text"
            placeholder={t('search', lang) + '...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="menu-search-input"
          />
          {search && (
            <button className="menu-search-clear" onClick={() => setSearch('')}>x</button>
          )}
        </div>

        <div className="menu-order-info">
          {orderType === 'dine-in'
            ? <span>{t('table', lang)} #{tableNumber}</span>
            : <span>{t('takeaway', lang)}</span>
          }
        </div>
      </header>

      {/* ─── BRAND TABS (multi-brand locations only) ─── */}
      {locationBrands.length > 1 && (
        <div className="brand-tabs">
          {locationBrands.map(bId => {
            const info = BRAND_TAB_INFO[bId] || { label: bId, color: '#6b7a99', emoji: '' };
            const isActive = activeBrand === bId;
            return (
              <button
                key={bId}
                className={`brand-tab ${isActive ? 'brand-tab--active' : ''}`}
                style={{ '--brand-color': info.color }}
                onClick={() => { setActiveBrand(bId); setSearch(''); }}
              >
                <span className="brand-tab-emoji">{info.emoji}</span>
                <span className="brand-tab-label">{info.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="menu-body">
        {/* ─── SIDEBAR CATEGORIES ────────────────────── */}
        <aside className="category-sidebar">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`cat-btn ${activeCategory === cat.id ? 'cat-btn--active' : ''}`}
              onClick={() => { setActiveCategory(cat.id); setSearch(''); }}
            >
              {(cat.image || catImages[cat.id]) && <img src={cat.image || catImages[cat.id]} alt="" className="cat-btn-img" />}
              <span className="cat-btn-label">{cat.name}</span>
            </button>
          ))}
        </aside>

        {/* ─── PRODUCTS GRID ───────────────────────── */}
        <main className="products-area">
          {filteredProducts.length === 0 ? (
            <div className="empty-cat">
              <p>{t('cart_empty', lang)}</p>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  delay={i * 0.03}
                  lang={lang}
                  onQuickAdd={handleQuickAdd}
                  onInfo={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ─── FLY ANIMATION ──────────────────────────── */}
      {flyAnim && (
        <div
          className="fly-thumb"
          key={flyAnim.id}
          style={{
            '--fly-sx': `${flyAnim.startX}px`,
            '--fly-sy': `${flyAnim.startY}px`,
            '--fly-ex': `${flyAnim.endX}px`,
            '--fly-ey': `${flyAnim.endY}px`,
          }}
        >
          {flyAnim.img && <img src={flyAnim.img} alt="" />}
        </div>
      )}

      {/* ─── FLOATING CART BAR ──────────────────────── */}
      {cartCount > 0 && (
        <div className="cart-bar" ref={cartBarRef} onClick={() => goTo('cart')}>
          <span className="cart-bar-count">{cartCount} {cartCount > 1 ? t('items_many', lang) : t('item_one', lang)}</span>
          <span className="cart-bar-label">🛒 {t('my_cart', lang)}</span>
          <span className="cart-bar-total">{cartTotal.toFixed(0)} {t('lei', lang)}</span>
        </div>
      )}
      {/* invisible cart ref when cart is empty (for fly target) */}
      {cartCount === 0 && <div ref={cartBarRef} style={{position:'fixed',bottom:16,left:'50%'}} />}
    </div>
  );
}

function ProductCard({ product, delay, lang, onQuickAdd, onInfo }) {
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef(null);

  return (
    <div
      ref={cardRef}
      className="product-card fade-in"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Info button */}
      <button className="product-info-btn" onClick={(e) => { e.stopPropagation(); onInfo(); }} title="Info">
        i
      </button>

      {/* Main card — click = add to cart */}
      <div className="product-card-body" onClick={() => onQuickAdd(product, cardRef.current)}>
        <div className="product-img">
          {product.image && !imgError ? (
            <img
              src={product.image}
              alt={product.name}
              className="product-photo"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="product-emoji-placeholder"></span>
          )}
        </div>
        <div className="product-info">
          {product.badge && <span className="product-badge">{product.badge}</span>}
          <h3 className="product-name">{product.name}</h3>
          <div className="product-footer">
            <span className="price price-lg">{product.price} {t('lei', lang)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
