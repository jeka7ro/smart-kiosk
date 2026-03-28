import { create } from 'zustand';

export const useKioskStore = create((set, get) => ({
  // ─── App state ────────────────────────────────────────────
  screen: 'welcome', // welcome | orderType | brandSelect | menu | product | cart | payment | confirmation
  orderType: null,   // 'dine-in' | 'takeaway'
  tableNumber: null,
  lang: 'ro',
  locationData: null, // { id, brands, orgIds } from backend
  kioskData: null, // Specific config for this tablet

  // ─── Active Brand ──────────────────────────────────────────
  activeBrandId: 'smashme',
  setActiveBrandId: (id) => set({ activeBrandId: id }),

  // ─── Language ──────────────────────────────────────────────
  setLang: (lang) => set({ lang }),
  setLocationData: (data) => set({ locationData: data }),
  setKioskData: (data) => set({ kioskData: data }),

  // ─── Menu Data ─────────────────────────────────────────────
  menuProducts: (() => {
    try { return JSON.parse(localStorage.getItem('kiosk_menuProducts') || '[]'); } catch { return []; }
  })(),
  setMenuProducts: (products) => {
    try { localStorage.setItem('kiosk_menuProducts', JSON.stringify(products)); } catch {}
    set({ menuProducts: products });
  },


  // ─── Cart ─────────────────────────────────────────────────
  cartItems: [],

  // ─── Favorites (wishlist — persists until checkout/reset) ─
  favorites: [],

  toggleFavorite: (product) =>
    set((state) => ({
      favorites: state.favorites.find((p) => p.id === product.id)
        ? state.favorites.filter((p) => p.id !== product.id)
        : [...state.favorites, product],
    })),

  clearFavorites: () => set({ favorites: [] }),

  // ─── Selected product (for detail screen) ─────────────────
  selectedProduct: null,

  // ─── Navigation ───────────────────────────────────────────
  goTo: (screen) => set((state) => {
    if (screen === 'confirmation' && state.screen !== 'confirmation') {
       const count = parseInt(localStorage.getItem('kiosk_orders_count') || '0', 10);
       localStorage.setItem('kiosk_orders_count', String(count + 1));
    }
    return { screen };
  }),

  setOrderType: (type, table = null) => set({
    orderType: type,
    tableNumber: table,
    screen: 'menu',
  }),

  isUnlocking: false,

  // ─── Promo UI State ───────────────────────────────────────
  showWheel: false,
  setShowWheel: (val) => set({ showWheel: val }),
  promoIntendedRoute: null,
  setPromoIntendedRoute: (route) => set({ promoIntendedRoute: route }),
  wonPrize: null,
  setWonPrize: (p) => set({ wonPrize: p }),

  // After welcome: slide up screensaver over half a second
  goAfterWelcome: () => {
    const loc = get().locationData;
    const isMulti = loc && loc.brands && loc.brands.length > 1;
    
    // Start iOS unlock sequence (start slide up CSS but instantly mount next route behind it)
    set({ 
      isUnlocking: true,
      screen: isMulti ? 'brandSelect' : 'orderType' 
    });

    // Remove WelcomeScreen entirely after CSS slide up completes
    setTimeout(() => {
      set({ isUnlocking: false });
    }, 850);
  },

  // Skip order type selection — default is pickup at cashier (takeaway)
  goToMenu: () => set({
    orderType: 'takeaway',
    tableNumber: null,
    screen: 'menu',
  }),

  setSelectedProduct: (product) => set({
    selectedProduct: product,
    screen: 'product',
  }),

  // ─── Cart actions ─────────────────────────────────────────
  addToCart: (product, quantity, selectedModifiers, totalPrice, brandId) => {
    set((state) => {
      const existingItemIndex = state.cartItems.findIndex(i => {
        if (i.productId !== product.id || i.brandId !== brandId) return false;
        const modsA = i.selectedModifiers || [];
        const modsB = selectedModifiers || [];
        if (modsA.length !== modsB.length) return false;
        
        // Deep compare sorted modifiers
        const strA = JSON.stringify([...modsA].sort((a,b) => (a.modId || '').localeCompare(b.modId || '')));
        const strB = JSON.stringify([...modsB].sort((a,b) => (a.modId || '').localeCompare(b.modId || '')));
        return strA === strB;
      });

      if (existingItemIndex > -1) {
        const newCart = [...state.cartItems];
        const item = newCart[existingItemIndex];
        item.quantity += quantity;
        item.totalPrice += (totalPrice * quantity);
        return { cartItems: newCart, screen: 'menu' };
      }

      const cartItem = {
        id: `${product.id}_${Date.now()}`,
        productId: product.id,
        name: product.name,
        image: product.image || null,
        brandId: brandId || null,
        quantity,
        selectedModifiers,
        unitPrice: totalPrice,
        totalPrice: totalPrice * quantity,
      };
      
      return {
        cartItems: [...state.cartItems, cartItem],
        screen: 'menu',
      };
    });
  },

  updateCartItem: (itemId, quantity) => {
    set((state) => ({
      cartItems: quantity === 0
        ? state.cartItems.filter((i) => i.id !== itemId)
        : state.cartItems.map((i) => i.id === itemId
            ? { ...i, quantity, totalPrice: i.unitPrice * quantity }
            : i
          ),
    }));
  },

  removeFromCart: (itemId) => {
    set((state) => ({
      cartItems: state.cartItems.filter((i) => i.id !== itemId),
    }));
  },

  clearCart: () => set({ cartItems: [] }),

  // ─── Computed ─────────────────────────────────────────────
  getCartCount: () => get().cartItems.reduce((sum, i) => sum + i.quantity, 0),
  getCartTotal: () => get().cartItems.reduce((sum, i) => sum + i.totalPrice, 0),

  // ─── Reset ────────────────────────────────────────────────
  resetOrder: () => set({
    cartItems: [],
    favorites: [],
    orderType: null,
    tableNumber: null,
    selectedProduct: null,
    screen: 'welcome',
  }),

  // Alias for inactivity hook
  resetAll: () => set({
    cartItems: [],
    favorites: [],
    orderType: null,
    tableNumber: null,
    selectedProduct: null,
    screen: 'welcome',
  }),
}));
