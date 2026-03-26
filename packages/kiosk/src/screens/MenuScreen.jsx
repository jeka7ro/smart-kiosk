import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { useBrand } from '../context/BrandContext.js';
import { BRANDS } from '../config/brands.js';
import { t } from '../i18n/translations.js';
import { getMenuData } from '../data/mockMenu.js';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout.js';
import ProductCard from '../components/ProductCard.jsx';
import ModifierModal from '../components/ModifierModal.jsx';
import { proxySyrveImage } from '../utils/imageUtils.js';
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

  const setMenuProducts = useKioskStore(s => s.setMenuProducts);

  const [categories, setCategories] = useState([]);
  const [products,   setProducts]   = useState([]);
  const [allProducts, setAllProducts] = useState([]); // all brands combined (for global search)
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [flyAnim, setFlyAnim] = useState(null);
  const [favorites, setFavorites] = useState([]); // ♡ wishlist bar
  const [modifierModalProduct, setModifierModalProduct] = useState(null);
  const cartBarRef = useRef(null);

  // Multi-brand state
  const activeBrandId = useKioskStore(s => s.activeBrandId);
  const setActiveBrandId = useKioskStore(s => s.setActiveBrandId);
  const [locationBrands, setLocationBrands] = useState([brand.id]); // brands at this location
  const [locationOrgIds, setLocationOrgIds]  = useState({});         // brandId → orgId from location

  const toggleFavorite = useCallback((product) => {
    setFavorites(prev =>
      prev.find(p => p.id === product.id)
        ? prev.filter(p => p.id !== product.id)
        : [...prev, product]
    );
  }, []);

  const handleFavQuickAdd = useCallback((product) => {
    // Fix: Use product._brand if it came from cross-brand wishlist
    const actualBrandId = product._brand || activeBrandId;
    addToCart(product, 1, [], product.price, actualBrandId);
    setFavorites(prev => prev.filter(p => p.id !== product.id)); // auto-remove from wishlist
  }, [addToCart, activeBrandId]);

  const handleAddAllFavorites = useCallback(() => {
    let requiresConfig = false;
    let addedCount = 0;

    favorites.forEach(product => {
      const hasReqMods = (product.modifierGroups?.length > 0 && product.modifierGroups.some(m => m.required)) || product.modifiers?.length > 0;
      if (hasReqMods) {
        requiresConfig = true;
      } else {
        const actualBrandId = product._brand || activeBrandId;
        addToCart(product, 1, [], product.price, actualBrandId);
        addedCount++;
      }
    });

    if (requiresConfig) {
      showToast(addedCount > 0 ? `Adăugate ${addedCount}. Unele necesită configurare separată!` : 'Toate produsele favorite necesită configurare separată!');
    } else {
      showToast('Toate produsele favorite au fost adăugate!');
    }
    
    // Auto-remove those that were successfully added without config
    setFavorites(prev => prev.filter(p => {
      const hasReqMods = (p.modifierGroups?.length > 0 && p.modifierGroups.some(m => m.required)) || p.modifiers?.length > 0;
      return hasReqMods; // keep only those that still need config
    }));
  }, [favorites, addToCart, activeBrandId]);

  // Fetch location to discover multi-brand capability
  useEffect(() => {
    const locId = new URLSearchParams(window.location.search).get('loc');
    if (!locId) return; // no location → single brand mode
    fetch(`${BACKEND}/api/locations/${locId}`, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY || 'sk-live-2024-secure' },
    })
      .then(r => r.json())
      .then(loc => {
        if (loc.brands && loc.brands.length > 0) {
          setLocationBrands(loc.brands);
          setLocationOrgIds(loc.orgIds || {});
          // Keep active brand if it's in the list, otherwise pick first
          if (!loc.brands.includes(activeBrandId)) {
            setActiveBrandId(loc.brands[0]);
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
    const orgId = locationOrgIds[activeBrandId] || BRAND_ORG_MAP[activeBrandId];

    const pickDefault = (cats, prods) => {
      // For SmashMe: prefer a category named 'New', 'Noi', 'Nou', 'Noutăți' etc.
      if (activeBrandId === 'smashme') {
        const newCat = cats.find(c =>
          /^(new|noi|nou|nout[ăa]|nout[ăa][tț]i)/i.test(c.name.trim())
        );
        if (newCat && prods.some(p => p.categoryId === newCat.id)) return newCat.id;
      }
      // Default: first category that actually HAS products in it
      const catWithProds = cats.find(c => prods.some(p => p.categoryId === c.id));
      return catWithProds?.id || cats[0]?.id || null;
    };

    if (!orgId) {
      const { categories: cats, products: prods } = getMenuData(activeBrandId);
      setCategories(cats);
      setProducts(prods);
      setActiveCategory(pickDefault(cats, prods));
      setLoading(false);
      return;
    }

    fetch(`${BACKEND}/api/menu?brandId=${activeBrandId}&orgId=${orgId}`, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY || 'sk-live-2024-secure' },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        const cats = data.categories || [];
        setCategories(cats);
        const prods = (data.products || []).filter(p => p.price > 0).map(p => ({ ...p, _brand: activeBrandId }));
        setProducts(prods);
        setMenuProducts(prods);
        setActiveCategory(pickDefault(cats, prods));
        // Merge into allProducts for cross-brand global search
        setAllProducts(prev => {
          const existingIds = new Set(prev.filter(p => p._brand !== activeBrandId).map(p => p.id));
          return [...prev.filter(p => p._brand !== activeBrandId), ...prods];
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('[MenuScreen] API fetch failed, falling back to mock:', err);
        const { categories: cats, products: rawProds } = getMenuData(activeBrandId);
        const prods = rawProds.map(p => ({ ...p, _brand: activeBrandId }));
        setCategories(cats);
        setProducts(prods);
        setMenuProducts(prods);
        setActiveCategory(pickDefault(cats, prods));
        setLoading(false);
      });
  }, [activeBrandId, locationOrgIds]);

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
  // When searching: search globally across ALL brands, ignore active category
  const filteredProducts = useMemo(() => {
    if (search) {
      const q = search.toLowerCase();
      const matched = allProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
      // Sort: current brand + current category first → current brand other cats → other brands
      return matched.sort((a, b) => {
        const scoreA =
          (a._brand === activeBrandId && a.categoryId === activeCategory) ? 3 :
          (a._brand === activeBrandId) ? 2 : 1;
        const scoreB =
          (b._brand === activeBrandId && b.categoryId === activeCategory) ? 3 :
          (b._brand === activeBrandId) ? 2 : 1;
        return scoreB - scoreA;
      });
    }
    return products.filter(p =>
      !activeCategory || p.categoryId === activeCategory
    );
  }, [search, products, allProducts, activeCategory, activeBrandId]);

  // Quick add to cart with fly animation
  const handleQuickAdd = useCallback((product, cardEl) => {
    // If product has required modifier groups, show the modifier selection modal
    const hasRequiredModifiers = (product.modifierGroups || []).some(gm => gm.required && gm.options?.length > 0);
    if (hasRequiredModifiers) {
      setModifierModalProduct(product);
      return;
    }
    // Fix: Use product._brand for cross-brand search results
    const actualBrandId = product._brand || activeBrandId;
    addToCart(product, 1, [], product.price, actualBrandId);

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
  }, [addToCart, activeBrandId]);

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
          {locationBrands.length <= 1 && (BRANDS[activeBrandId]?.logoImg
            ? <img src={BRANDS[activeBrandId].logoImg} alt={BRANDS[activeBrandId]?.name} className="menu-logo" />
            : <span className="menu-brand-name">{BRANDS[activeBrandId]?.name || brand.name}</span>
          )}
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
            const brandConfig = BRANDS[bId];
            const isActive = activeBrandId === bId;
            return (
              <button
                key={bId}
                className={`brand-tab ${isActive ? 'brand-tab--active' : ''}`}
                style={{ '--brand-color': info.color, flex: `1 1 ${100 / locationBrands.length}%` }}
                onClick={() => { setActiveBrandId(bId); setSearch(''); import('../config/brands.js').then(m => m.applyBrandTheme(bId)); }}
              >
                <img 
                  src={`/brands/${bId}-logo.png`} 
                  alt={info.label} 
                  className="brand-tab-logo" 
                  style={{ maxHeight: '28px', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display='none'; }} 
                />
                <span className="brand-tab-label" style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{info.label}</span>
              </button>
            );
          })}
        </div>
      )}


      {/* ─── FAVORITES / WISHLIST BAR ─── */}
      {favorites.length > 0 && (
        <div className="favorites-bar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
            <span className="fav-bar-label">❤️ Salvate</span>
            <button 
              onClick={handleAddAllFavorites}
              style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.3)', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
            >
              + Adaugă toate
            </button>
          </div>
          <div className="fav-bar-items">
            {favorites.map(fav => (
              <div key={fav.id} className="fav-item">
                <div className="fav-item-img">
                  {fav.image
                    ? <img src={`${BACKEND}/api/image-proxy?url=${encodeURIComponent(fav.image)}`} alt={fav.name} onError={e => e.target.style.display='none'} />
                    : <span style={{fontSize:'1.2rem'}}>🍽️</span>
                  }
                </div>
                <div className="fav-item-info">
                  <span className="fav-item-name">{fav.name}</span>
                  <span className="fav-item-price">{fav.price} lei</span>
                </div>
                <div className="fav-item-actions">
                  <button className="fav-add-btn" title="Adaugă în coș" onClick={() => handleFavQuickAdd(fav)}>+ Coș</button>
                  <button className="fav-del-btn" title="Șterge" onClick={() => toggleFavorite(fav)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      <div className="menu-body">
        {/* ─── SIDEBAR CATEGORIES ────────────────────── */}
        <aside className="category-sidebar">
          {categories.map(cat => {
            // Caută imaginea primului produs din această categorie dacă categoria nu are poză
            const firstProdWithImage = allProducts.find(p => p.categoryId === cat.id && p.image);
            const displayImage = cat.image || firstProdWithImage?.image;

            return (
              <button
                key={cat.id}
                className={`cat-btn ${activeCategory === cat.id ? 'cat-btn--active' : ''}`}
                onClick={() => { setActiveCategory(cat.id); setSearch(''); }}
              >
                {displayImage ? (
                  <img src={proxySyrveImage(displayImage)} alt={cat.name} className="cat-btn-img" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="cat-btn-img" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
                )}
                <span className="cat-btn-label">{cat.name}</span>
              </button>
            );
          })}
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
                  activeBrand={activeBrandId}
                  onQuickAdd={handleQuickAdd}
                  onInfo={() => setSelectedProduct(product)}
                  isFavorited={favorites.some(f => f.id === product.id)}
                  onToggleFavorite={toggleFavorite}
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
        <div className="cart-bar" ref={cartBarRef} onClick={() => goTo('cart')} style={{ display: 'flex', alignItems: 'center', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 18C5.9 18 5.01 18.9 5.01 20C5.01 21.1 5.9 22 7 22C8.1 22 9 21.1 9 20C9 18.9 8.1 18 7 18ZM1 2V4H3L6.6 11.59L5.24 14.04C5.09 14.32 5 14.65 5 15C5 16.1 5.9 17 7 17H19V15H7.42C7.28 15 7.17 14.89 7.17 14.75L7.2 14.63L8.1 13H15.55C16.3 13 16.96 12.59 17.3 11.97L20.88 5.48C20.96 5.34 21 5.17 21 5C21 4.45 20.55 4 20 4H5.21L4.27 2H1ZM17 18C15.9 18 15.01 18.9 15.01 20C15.01 21.1 15.9 22 17 22C18.1 22 19 21.1 19 20C19 18.9 18.1 18 17 18Z"/>
            </svg>
            <span className="cart-bar-count" style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '16px', fontSize: '0.9rem', fontWeight: 600 }}>{cartCount} {cartCount > 1 ? t('items_many', lang) : t('item_one', lang)}</span>
          </div>
          <span className="cart-bar-label" style={{ flex: 1, textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}>{t('my_cart', lang)}</span>
          <span className="cart-bar-total" style={{ fontSize: '1.4rem', fontWeight: 800 }}>{cartTotal.toFixed(0)} {t('lei', lang)}</span>
        </div>
      )}
      {/* invisible cart ref when cart is empty (for fly target) */}
      {cartCount === 0 && <div ref={cartBarRef} style={{position:'fixed',bottom:16,left:'50%'}} />}

      {/* ─── MODIFIER MODAL (bottom-sheet for required options) ─── */}
      {modifierModalProduct && (
        <ModifierModal
          product={modifierModalProduct}
          activeBrandId={modifierModalProduct._brand || activeBrandId}
          onConfirm={(product, qty, mods, unitPrice, brandId) => {
            addToCart(product, qty, mods, unitPrice, brandId);
            // Fly animation from center screen to cart
            if (cartBarRef.current) {
              const cartRect = cartBarRef.current.getBoundingClientRect();
              setFlyAnim({
                id: Date.now(),
                img: product.image,
                startX: window.innerWidth / 2,
                startY: window.innerHeight / 2,
                endX: cartRect.left + cartRect.width / 2,
                endY: cartRect.top,
              });
              setTimeout(() => setFlyAnim(null), 850);
            }
            setModifierModalProduct(null);
          }}
          onClose={() => setModifierModalProduct(null)}
        />
      )}
    </div>
  );
}


