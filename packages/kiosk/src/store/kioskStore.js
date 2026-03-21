import { create } from 'zustand';

export const useKioskStore = create((set, get) => ({
  // ─── App state ────────────────────────────────────────────
  screen: 'welcome', // welcome | orderType | menu | product | cart | payment | confirmation
  orderType: null,   // 'dine-in' | 'takeaway'
  tableNumber: null,
  lang: 'ro',        // 'ro' | 'en' | 'ru' (questionnaire: toate 3 limbi)

  // ─── Language ──────────────────────────────────────────────
  setLang: (lang) => set({ lang }),


  // ─── Cart ─────────────────────────────────────────────────
  cartItems: [],

  // ─── Selected product (for detail screen) ─────────────────
  selectedProduct: null,

  // ─── Navigation ───────────────────────────────────────────
  goTo: (screen) => set({ screen }),

  setOrderType: (type, table = null) => set({
    orderType: type,
    tableNumber: table,
    screen: 'menu',
  }),

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
    set((state) => ({
      cartItems: [...state.cartItems, cartItem],
      screen: 'menu',
    }));
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
    orderType: null,
    tableNumber: null,
    selectedProduct: null,
    screen: 'welcome',
  }),

  // Alias for inactivity hook
  resetAll: () => set({
    cartItems: [],
    orderType: null,
    tableNumber: null,
    selectedProduct: null,
    screen: 'welcome',
  }),
}));
