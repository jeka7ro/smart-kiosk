/**
 * Brand configurations for white-label multi-brand kiosk
 * Each brand has its own visual identity: colors, fonts, logo, tagline
 * The active brand is determined by VITE_BRAND env variable or URL param ?brand=smashme
 */


export const BRANDS = {
  smashme: {
    id: 'smashme',
    name: 'Smash Me',
    tagline: 'Burgeri smash suculenți',
    emoji: '🍔',
    url: 'smashme.ro',
    logoImg: '/brands/smashme-logo.png',
    logoHeight: 80,
    colors: { primary: '#EE3B24', primaryDark: '#CC2A14', primaryLight: '#FF5540', accent: '#FFB800', bgDark: '#F5F5F5', bgCard: '#FFFFFF', bgCard2: '#F9F9F9', surface: '#F2F2F2', textMain: '#1A1A1A', textMuted: '#6E6F84', borderColor: '#E8E8E8' },
    font: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    fontWeight: 900,
    welcomeSlides: [{ headline: 'Burgeri smash', sub: 'suculenți', emoji: '🍔' }],
    categoryEmojis: { burgers: '🍔', sides: '🍟', drinks: '🥤' }
  },
  crunch: {
    id: 'crunch',
    name: 'Crunch',
    tagline: 'Pui crispy',
    emoji: '🍗',
    url: 'smashme.ro',
    logoImg: '/brands/crunch-logo.png',
    logoHeight: 80,
    colors: { primary: '#FFB800', primaryDark: '#E5A600', primaryLight: '#FFC833', accent: '#EE3B24', bgDark: '#F5F5F5', bgCard: '#FFFFFF', bgCard2: '#F9F9F9', surface: '#F2F2F2', textMain: '#1A1A1A', textMuted: '#6E6F84', borderColor: '#E8E8E8' },
    font: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    fontWeight: 900,
    welcomeSlides: [{ headline: 'Pui crispy', sub: 'delicios', emoji: '🍗' }],
    categoryEmojis: { combo: '🍱', pui: '🍗', drinks: '🥤' }
  },
  rollmaster: {
    id: 'rollmaster',
    name: 'Roll Master',
    tagline: 'Bucătărie japoneză autentică',
    emoji: '🍣',
    url: 'sushimaster.ro',
    logoImg: '/brands/rollmaster-logo.png',
    logoHeight: 80,
    colors: { primary: '#E31E24', primaryDark: '#B81219', primaryLight: '#FF3038', accent: '#D4AF37', bgDark: '#F5F5F5', bgCard: '#FFFFFF', bgCard2: '#F9F9F9', surface: '#F2F2F2', textMain: '#1A1A1A', textMuted: '#6E6F84', borderColor: '#E8E8E8' },
    font: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    fontWeight: 700,
    welcomeSlides: [{ headline: 'Sushi proaspăt', sub: 'autentic', emoji: '🍣' }],
    categoryEmojis: { rolls: '🌀', nigiri: '🍣' }
  },
  lovesushi: {
    id: 'lovesushi',
    name: 'Love Sushi',
    tagline: 'Iubim sushi-ul',
    emoji: '🍣',
    url: 'welovesushi.ro',
    logoImg: '/brands/welovesushi-logo.png',
    logoHeight: 80,
    colors: { primary: '#E31E24', primaryDark: '#B81219', primaryLight: '#FF3038', accent: '#D4AF37', bgDark: '#F5F5F5', bgCard: '#FFFFFF', bgCard2: '#F9F9F9', surface: '#F2F2F2', textMain: '#1A1A1A', textMuted: '#6E6F84', borderColor: '#E8E8E8' },
    font: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    fontWeight: 700,
    welcomeSlides: [{ headline: 'We Love Sushi!', sub: 'proaspăt', emoji: '🍣' }],
    categoryEmojis: { rolls: '🌀', nigiri: '🍣' }
  },
  pokiwoki: {
    id: 'pokiwoki',
    name: 'Poki-Woki',
    tagline: 'Hawaiian Poke Bowls',
    emoji: '🥗',
    url: 'pokiwoki.ro',
    logoImg: '/brands/pokiwoki-logo.png',
    logoHeight: 80,
    colors: { primary: '#F97316', primaryDark: '#EA580C', primaryLight: '#FB923C', accent: '#10B981', bgDark: '#F5F5F5', bgCard: '#FFFFFF', bgCard2: '#F9F9F9', surface: '#F2F2F2', textMain: '#1A1A1A', textMuted: '#6E6F84', borderColor: '#E8E8E8' },
    font: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    fontWeight: 700,
    welcomeSlides: [{ headline: 'Poki-Woki', sub: 'Sănătos', emoji: '🥗' }],
    categoryEmojis: { bowls: '🥗', woks: '🍜' }
  }
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
