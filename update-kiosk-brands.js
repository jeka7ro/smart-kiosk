const fs = require('fs');
const path = './packages/kiosk/src/config/brands.js';
let content = fs.readFileSync(path, 'utf8');

// Replace the BRANDS object completely
const newBrands = `
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
    logoImg: '/brands/smashme-logo.png', // Temporary
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
    logoImg: '/brands/sushimaster-logo.png', // Temporary
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
    logoImg: '/brands/sushimaster-logo.png', // Temporary
    logoHeight: 80,
    colors: { primary: '#F97316', primaryDark: '#EA580C', primaryLight: '#FB923C', accent: '#10B981', bgDark: '#F5F5F5', bgCard: '#FFFFFF', bgCard2: '#F9F9F9', surface: '#F2F2F2', textMain: '#1A1A1A', textMuted: '#6E6F84', borderColor: '#E8E8E8' },
    font: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    fontWeight: 700,
    welcomeSlides: [{ headline: 'Poki-Woki', sub: 'Sănătos', emoji: '🥗' }],
    categoryEmojis: { bowls: '🥗', woks: '🍜' }
  }
};
`;

content = content.replace(/export const BRANDS = \{[\s\S]*?\};\n/, newBrands);
fs.writeFileSync(path, content);
console.log('Kiosk brands updated.');
