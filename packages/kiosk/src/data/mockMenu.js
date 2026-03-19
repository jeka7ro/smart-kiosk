// Mock menu data — SmashMe brand (burgeri reali de pe smashme.ro)
export const SMASHME_CATEGORIES = [
  { id: 'smash-burgers',  name: 'Smash Burgers',  icon: '🍔', color: '#EE3B24' },
  { id: 'pizza',          name: 'Pizza',           icon: '🍕', color: '#FF8C00' },
  { id: 'salate',         name: 'Salate',          icon: '🥗', color: '#2E7D32' },
  { id: 'deserturi',      name: 'Deserturi',       icon: '🍰', color: '#E91E8C' },
  { id: 'bauturi',        name: 'Băuturi',         icon: '🥤', color: '#1565C0' },
];

export const SMASHME_PRODUCTS = [
  {
    id: 'sm1', categoryId: 'smash-burgers',
    name: 'Classic Smash',
    price: 42,
    description: 'Cotlet de vită smash 180g, cheddar topit, salată, roșie, murături, sos special Smash Me',
    image: 'https://smashme.ro/_next/image?url=https%3A%2F%2Fbackend.smashme.ro%2Fuploads%2Fproducts%2Fclassic-smash.jpg&w=640&q=75',
    badge: 'Best Seller',
    allergens: ['gluten', 'lactate', 'ou'],
    modifiers: [
      { id: 'size', name: 'Mărime', required: true, options: [
        { id: 'single', name: 'Single 180g', priceDiff: 0 },
        { id: 'double', name: 'Double 360g', priceDiff: 16 },
        { id: 'triple', name: 'Triple 540g', priceDiff: 30 },
      ]},
      { id: 'side', name: 'Garnitură', required: true, options: [
        { id: 'fries',   name: 'Cartofi prăjiți', priceDiff: 0 },
        { id: 'coleslaw',name: 'Coleslaw',         priceDiff: 0 },
        { id: 'sweet',   name: 'Cartofi dulci',    priceDiff: 7 },
      ]},
    ],
  },
  {
    id: 'sm2', categoryId: 'smash-burgers',
    name: 'BBQ Bacon Smash',
    price: 48,
    description: 'Cotlet de vită 180g, bacon crispy, sos BBQ, ceapă caramelizată, cheddar, castraveți murați',
    image: 'https://smashme.ro/_next/image?url=https%3A%2F%2Fbackend.smashme.ro%2Fuploads%2Fproducts%2Fbbq-bacon-smash.jpg&w=640&q=75',
    badge: 'Nou',
    allergens: ['gluten', 'lactate'],
    modifiers: [
      { id: 'size2', name: 'Mărime', required: true, options: [
        { id: 'single2', name: 'Single 180g', priceDiff: 0 },
        { id: 'double2', name: 'Double 360g', priceDiff: 16 },
      ]},
    ],
  },
  {
    id: 'sm3', categoryId: 'smash-burgers',
    name: 'Crispy Chicken Smash',
    price: 39,
    description: 'Piept de pui pane 180g, sos ranch, varză murată, castraveți, roșie',
    image: '',
    badge: null,
    allergens: ['gluten', 'ou'],
    modifiers: [],
  },
  {
    id: 'sm4', categoryId: 'smash-burgers',
    name: 'Mushroom Swiss Smash',
    price: 44,
    description: 'Cotlet de vită 180g, ciuperci sautéed, brânză elvețiană, maioneză trufe, rucola',
    image: '',
    badge: 'Chef Pick',
    allergens: ['gluten', 'lactate', 'ou'],
    modifiers: [
      { id: 'size3', name: 'Mărime', required: true, options: [
        { id: 'single3', name: 'Single 180g', priceDiff: 0 },
        { id: 'double3', name: 'Double 360g', priceDiff: 16 },
      ]},
    ],
  },
  {
    id: 'sm5', categoryId: 'bauturi',
    name: 'Limonadă Smash',
    price: 18,
    description: 'Lămâie proaspătă, mentă, apă minerală, sirop natural',
    image: '',
    badge: null,
    allergens: [],
    modifiers: [
      { id: 'flavor', name: 'Aromă', required: true, options: [
        { id: 'lemon',   name: 'Lămâie clasic',      priceDiff: 0 },
        { id: 'berry',   name: 'Fructe de pădure',   priceDiff: 0 },
        { id: 'ginger',  name: 'Ghimbir & lemon',    priceDiff: 0 },
      ]},
    ],
  },
  {
    id: 'sm6', categoryId: 'bauturi',
    name: 'Milkshake',
    price: 24,
    description: 'Înghețată artizanală, lapte integral, sirop natural — 400ml',
    image: '',
    badge: null,
    allergens: ['lactate'],
    modifiers: [
      { id: 'shflavor', name: 'Aromă', required: true, options: [
        { id: 'vanilla',    name: 'Vanilie',       priceDiff: 0 },
        { id: 'chocolate',  name: 'Ciocolată',     priceDiff: 0 },
        { id: 'strawberry', name: 'Căpșuni',       priceDiff: 0 },
        { id: 'caramel',    name: 'Caramel sărat', priceDiff: 0 },
      ]},
    ],
  },
  {
    id: 'sm7', categoryId: 'deserturi',
    name: 'Brownie Smash',
    price: 22,
    description: 'Brownie cald de ciocolată, înghețată de vanilie, sos caramel',
    image: '',
    badge: null,
    allergens: ['gluten', 'lactate', 'ou'],
    modifiers: [],
  },
];

// ─── SUSHI MASTER ────────────────────────────────────────────────────────────

export const SUSHIMASTER_CATEGORIES = [
  { id: 'sm-rolls',   name: 'Rulouri',     icon: '🌀', color: '#E31E24' },
  { id: 'sm-sets',    name: 'Seturi',      icon: '🎁', color: '#D4AF37' },
  { id: 'sm-nigiri',  name: 'Nigiri',      icon: '🍣', color: '#FF8C00' },
  { id: 'sm-supe',    name: 'Supe',        icon: '🍜', color: '#1565C0' },
  { id: 'sm-deserturi',name: 'Deserturi',  icon: '🍡', color: '#E91E8C' },
  { id: 'sm-bauturi', name: 'Băuturi',     icon: '🍵', color: '#2E7D32' },
];

export const SUSHIMASTER_PRODUCTS = [
  {
    id: 'su1', categoryId: 'sm-rolls',
    name: 'California Roll',
    price: 38,
    description: '8 buc — Surimi, avocado, castravete, tobiko, maioneză japoneză',
    image: 'https://sushimaster.ro/_next/image?url=https%3A%2F%2Fbackend.sushimaster.ro%2Fuploads%2Fproducts%2Fcalifornia-roll.jpg&w=640&q=75',
    badge: 'Popular',
    allergens: ['crustacee', 'ou', 'soia'],
    modifiers: [
      { id: 'pcs', name: 'Porție', required: true, options: [
        { id: '8pcs',  name: '8 bucăți',  priceDiff: 0 },
        { id: '16pcs', name: '16 bucăți', priceDiff: 32 },
      ]},
    ],
  },
  {
    id: 'su2', categoryId: 'sm-rolls',
    name: 'Philadelphia Roll',
    price: 46,
    description: '8 buc — Somon afumat, cream cheese, castravete, avocado',
    image: '',
    badge: 'Best Seller',
    allergens: ['pește', 'lactate', 'gluten'],
    modifiers: [
      { id: 'pcs2', name: 'Porție', required: true, options: [
        { id: '8pcs2',  name: '8 bucăți',  priceDiff: 0 },
        { id: '16pcs2', name: '16 bucăți', priceDiff: 38 },
      ]},
    ],
  },
  {
    id: 'su3', categoryId: 'sm-rolls',
    name: 'Dragon Roll',
    price: 52,
    description: '8 buc — Creveți tempura, avocado, sos unagi, tobiko portocaliu',
    image: '',
    badge: 'Premium',
    allergens: ['crustacee', 'gluten', 'ou'],
    modifiers: [],
  },
  {
    id: 'su4', categoryId: 'sm-rolls',
    name: 'Spicy Tuna Roll',
    price: 48,
    description: '8 buc — Ton proaspăt, sos picant sriracha, avocado, sesam',
    image: '',
    badge: 'Hot 🌶',
    allergens: ['pește', 'soia', 'sesam'],
    modifiers: [
      { id: 'spice', name: 'Nivel picant', required: false, options: [
        { id: 'mild',   name: 'Mediu',     priceDiff: 0 },
        { id: 'hot',    name: 'Picant',    priceDiff: 0 },
        { id: 'xhot',   name: 'Foarte picant', priceDiff: 0 },
      ]},
    ],
  },
  {
    id: 'su5', categoryId: 'sm-sets',
    name: 'Set Master 48 buc',
    price: 189,
    description: '48 rulouri asortate — California, Philadelphia, Dragon, Tempura. Perfect pentru 2-3 persoane',
    image: '',
    badge: 'Recomandat',
    allergens: ['pește', 'crustacee', 'gluten', 'ou', 'lactate'],
    modifiers: [],
  },
  {
    id: 'su6', categoryId: 'sm-nigiri',
    name: 'Nigiri Somon',
    price: 32,
    description: '6 buc — Orez sushi, felii de somon proaspăt, wasabi',
    image: '',
    badge: null,
    allergens: ['pește', 'gluten'],
    modifiers: [],
  },
  {
    id: 'su7', categoryId: 'sm-supe',
    name: 'Miso Soup',
    price: 18,
    description: 'Supă tradițională japoneză, tofu, alge wakame, ceapă verde',
    image: '',
    badge: null,
    allergens: ['soia', 'gluten'],
    modifiers: [],
  },
  {
    id: 'su8', categoryId: 'sm-bauturi',
    name: 'Ceai Verde Japonez',
    price: 14,
    description: 'Sencha premium, servit cald sau rece — 400ml',
    image: '',
    badge: null,
    allergens: [],
    modifiers: [
      { id: 'temp', name: 'Temperatură', required: true, options: [
        { id: 'hot',  name: 'Cald',   priceDiff: 0 },
        { id: 'cold', name: 'Cu gheață', priceDiff: 0 },
      ]},
    ],
  },
];

// Selector per brand
export function getMenuData(brandId) {
  if (brandId === 'sushimaster') {
    return { categories: SUSHIMASTER_CATEGORIES, products: SUSHIMASTER_PRODUCTS };
  }
  return { categories: SMASHME_CATEGORIES, products: SMASHME_PRODUCTS };
}
