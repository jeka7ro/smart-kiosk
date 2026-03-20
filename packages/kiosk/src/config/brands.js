/**
 * Brand configurations for white-label multi-brand kiosk
 * Each brand has its own visual identity: colors, fonts, logo, tagline
 * The active brand is determined by VITE_BRAND env variable or URL param ?brand=smashme
 */

export const BRANDS = {
  smashme: {
    id: 'smashme',
    name: 'Smash Me',
    tagline: 'Burgeri smash suculenți cu gust memorabil',
    emoji: '🍔',
    url: 'smashme.ro',

    // Logo
    logoImg:    '/brands/smashme-logo.png',
    logoHeight: 80,

    // Colors — LIGHT theme matching smashme.ro (white/cream bg, red accent)
    colors: {
      primary:      '#EE3B24',   // Exact red from site
      primaryDark:  '#CC2A14',
      primaryLight: '#FF5540',
      accent:       '#FFB800',
      bgDark:       '#F5F5F5',   // Light grey — matching site bg
      bgCard:       '#FFFFFF',   // White cards
      bgCard2:      '#F9F9F9',
      surface:      '#F2F2F2',   // From site: #F2F2F2
      textMain:     '#1A1A1A',   // Dark text
      textMuted:    '#6E6F84',   // From site CSS
      borderColor:  '#E8E8E8',
    },

    // Font
    font: "'Outfit', sans-serif",
    fontWeight: 900,

    // Welcome screen
    welcomeSlides: [
      { headline: 'Burgeri smash,', sub: 'suculenți și memorabili', heroImage: 'https://smashme.ro/_next/image?url=https%3A%2F%2Fbackend.smashme.ro%2Fuploads%2Fproducts%2Fclassic-smash.jpg&w=640&q=75' },
      { headline: 'Ingrediente fresh,', sub: 'gătite la comandă', heroImage: 'https://smashme.ro/_next/image?url=https%3A%2F%2Fbackend.smashme.ro%2Fuploads%2Fproducts%2Fbbq-bacon-smash.jpg&w=640&q=75' },
      { headline: 'Plată rapidă', sub: 'cu cardul sau contactless', heroImage: 'https://smashme.ro/_next/image?url=https%3A%2F%2Fbackend.smashme.ro%2Fuploads%2Fproducts%2Fclassic-smash.jpg&w=640&q=75' },
    ],

    // Category style
    categoryEmojis: {
      burgers: '🍔',
      sides:   '🍟',
      drinks:  '🥤',
      desserts:'🍰',
      shakes:  '🥛',
    },
  },

  sushimaster: {
    id: 'sushimaster',
    name: 'Sushi Master',
    tagline: 'Bucătărie japoneză autentică',
    emoji: '🍣',
    url: 'sushimaster.ro',

    // Logo
    logoImg:    '/brands/sushimaster-logo.png',
    logoHeight: 80,

    // Colors — LIGHT theme matching sushimaster.ro (white bg, red accent)
    colors: {
      primary:      '#E31E24',   // Exact red from site
      primaryDark:  '#B81219',
      primaryLight: '#FF3038',
      accent:       '#D4AF37',   // Gold
      bgDark:       '#F5F5F5',   // Light grey
      bgCard:       '#FFFFFF',   // White cards
      bgCard2:      '#F9F9F9',
      surface:      '#F2F2F2',   // From site: #F2F2F2
      textMain:     '#1A1A1A',
      textMuted:    '#6E6F84',
      borderColor:  '#E8E8E8',
    },

    // Font — more refined
    font: "'Outfit', sans-serif",
    fontWeight: 700,

    // Welcome screen
    welcomeSlides: [
      { headline: 'Sushi proaspăt,', sub: 'pregătit la comandă', heroImage: 'https://sushimaster.ro/_next/image?url=https%3A%2F%2Fbackend.sushimaster.ro%2Fuploads%2Fproducts%2Fcalifornia-roll.jpg&w=640&q=75' },
      { headline: 'Rețete japoneze', sub: 'autentice și rafinate', heroImage: 'https://sushimaster.ro/_next/image?url=https%3A%2F%2Fbackend.sushimaster.ro%2Fuploads%2Fproducts%2Fcalifornia-roll.jpg&w=640&q=75' },
      { headline: 'Plată rapidă', sub: 'cu cardul sau contactless', heroImage: 'https://sushimaster.ro/_next/image?url=https%3A%2F%2Fbackend.sushimaster.ro%2Fuploads%2Fproducts%2Fcalifornia-roll.jpg&w=640&q=75' },
    ],

    categoryEmojis: {
      rolls:   '🌀',
      nigiri:  '🍣',
      sashimi: '🐟',
      soups:   '🍜',
      drinks:  '🍵',
      desserts:'🍡',
    },
  },
};

// Default brand
export const DEFAULT_BRAND = 'smashme';

/**
 * Detect brand from:
 * 1. URL search param: ?brand=sushimaster
 * 2. VITE env variable: VITE_BRAND=sushimaster
 * 3. Fallback to default
 */
export function detectBrand() {
  const urlParam = new URLSearchParams(window.location.search).get('brand');
  if (urlParam && BRANDS[urlParam]) return urlParam;

  const envBrand = import.meta.env.VITE_BRAND;
  if (envBrand && BRANDS[envBrand]) return envBrand;

  return DEFAULT_BRAND;
}

/**
 * Apply brand CSS variables to :root
 */
export function applyBrandTheme(brandId) {
  const brand = BRANDS[brandId] || BRANDS[DEFAULT_BRAND];
  const { colors } = brand;
  const root = document.documentElement;

  root.style.setProperty('--primary',       colors.primary);
  root.style.setProperty('--primary-dark',  colors.primaryDark);
  root.style.setProperty('--primary-light', colors.primaryLight);
  root.style.setProperty('--accent',        colors.accent);
  root.style.setProperty('--bg-dark',       colors.bgDark);
  root.style.setProperty('--bg-card',       colors.bgCard);
  root.style.setProperty('--bg-card2',      colors.bgCard2 || colors.bgCard);
  root.style.setProperty('--surface',       colors.surface);
  root.style.setProperty('--text',          colors.textMain || '#1A1A1A');
  root.style.setProperty('--text-muted',    colors.textMuted || '#6E6F84');
  root.style.setProperty('--border',        colors.borderColor || '#E8E8E8');
  root.style.setProperty('--shadow-btn',    `0 4px 20px ${colors.primary}44`);
  root.style.setProperty('--shadow-card',   `0 2px 12px rgba(0,0,0,0.08)`);
  // light/dark mode flag
  root.setAttribute('data-theme', colors.bgDark.startsWith('#F') ? 'light' : 'dark');
}

export function getBrand(brandId) {
  return BRANDS[brandId] || BRANDS[DEFAULT_BRAND];
}
