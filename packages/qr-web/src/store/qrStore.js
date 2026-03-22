import { create } from 'zustand';

export const useQrStore = create((set, get) => ({
  brandId:     'smashme',
  tableNum:    null,
  locationId:  null,
  screen:      'landing',   // landing | menu | product | cart | checkout | success

  cartItems:   [],
  selectedProduct: null,

  // Navigation
  goTo: (screen) => set({ screen }),

  // Init from URL
  init: (brandId, tableNum, locationId) => set({ brandId, tableNum, locationId, screen: 'menu' }),

  // Selected product
  setSelectedProduct: (p) => set({ selectedProduct: p, screen: 'product' }),

  // Cart
  addToCart: (product, quantity, mods, unitPrice) => {
    set(s => {
      const existingItemIndex = s.cartItems.findIndex(i => {
        if (i.productId !== product.id) return false;
        const modsA = i.selectedModifiers || [];
        const modsB = mods || [];
        if (modsA.length !== modsB.length) return false;
        
        const strA = JSON.stringify([...modsA].sort((a,b) => (a.modId || '').localeCompare(b.modId || '')));
        const strB = JSON.stringify([...modsB].sort((a,b) => (a.modId || '').localeCompare(b.modId || '')));
        return strA === strB;
      });

      if (existingItemIndex > -1) {
        const newCart = [...s.cartItems];
        const item = newCart[existingItemIndex];
        item.quantity += quantity;
        item.totalPrice += (unitPrice * quantity);
        return { cartItems: newCart };
      }

      const item = {
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        image: product.image || null,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        selectedModifiers: mods,
      };
      return { cartItems: [...s.cartItems, item] };
    });
  },

  updateCartItem: (id, qty) => {
    if (qty <= 0) {
      set(s => ({ cartItems: s.cartItems.filter(i => i.id !== id) }));
    } else {
      set(s => ({
        cartItems: s.cartItems.map(i =>
          i.id === id ? { ...i, quantity: qty, totalPrice: i.unitPrice * qty } : i
        ),
      }));
    }
  },

  removeFromCart: (id) => set(s => ({ cartItems: s.cartItems.filter(i => i.id !== id) })),

  getCartTotal: () => get().cartItems.reduce((sum, i) => sum + i.totalPrice, 0),
  getCartCount: () => get().cartItems.reduce((sum, i) => sum + i.quantity, 0),

  clearCart: () => set({ cartItems: [], screen: 'landing' }),
}));
