/**
 * QR Web App brand config — mirrors kiosk brands but simpler
 */
export const QR_BRANDS = {
  smashme: {
    id: 'smashme', name: 'Smash Me', emoji: '🍔', url: 'smashme.ro',
    logoImg: '/brands/smashme-logo.png',
    primary: '#EE3B24', accent: '#FFB800',
    bg: '#F5F5F5', card: '#FFFFFF',
  },
  sushimaster: {
    id: 'sushimaster', name: 'Sushi Master', emoji: '🍣', url: 'sushimaster.ro',
    logoImg: '/brands/sushimaster-logo.png',
    primary: '#E31E24', accent: '#D4AF37',
    bg: '#F5F5F5', card: '#FFFFFF',
  },
};

export function applyQrBrandTheme(brandId) {
  const b = QR_BRANDS[brandId] || QR_BRANDS.smashme;
  const r = document.documentElement;
  r.style.setProperty('--primary', b.primary);
  r.style.setProperty('--accent',  b.accent);
  r.style.setProperty('--bg',      b.bg);
  r.style.setProperty('--card',    b.card);
}

export function getQrBrand(brandId) {
  return QR_BRANDS[brandId] || QR_BRANDS.smashme;
}
