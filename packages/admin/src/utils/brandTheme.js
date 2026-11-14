/**
 * Regula unică de culori și denumiri pentru branduri în tot panoul Admin.
 * Toate culorile sunt extrase fidel din logo-ul (avatarul) fiecărui brand:
 * - SmashMe: Roșu aprins (#ef4444)
 * - Roll Master: Roșu crimson (#dc2626)
 * - Poki-Woki: Verde lime/frunză (#65a30d)
 * - Crunch: Chihlimbar / Portocaliu cald (#d97706)
 * - Love Sushi / WeLoveSushi: Somon portocaliu (#f97316)
 */

export const BRAND_COLORS = {
  smashme: '#ef4444',
  crunch: '#d97706',
  rollmaster: '#dc2626',
  lovesushi: '#f97316',
  pokiwoki: '#65a30d',
};

export const ALL_BRAND_COLORS = {
  ...BRAND_COLORS,
  sushimaster: '#dc2626',
  ikura: '#dc2626',
  welovesushi: '#f97316',
  'poki-woki': '#65a30d',
  'roll-master': '#dc2626',
  'love-sushi': '#f97316',
  'smash-me': '#ef4444',
};

export const BRAND_LABELS = {
  smashme: 'SmashMe',
  crunch: 'Crunch',
  rollmaster: 'Roll Master',
  lovesushi: 'Love Sushi',
  pokiwoki: 'Poki-Woki',
};

export const ALL_BRAND_LABELS = {
  ...BRAND_LABELS,
  sushimaster: 'Roll Master',
  ikura: 'Roll Master',
  welovesushi: 'WeLoveSushi',
  'poki-woki': 'Poki-Woki',
  'roll-master': 'Roll Master',
  'love-sushi': 'Love Sushi',
  'smash-me': 'SmashMe',
};

export const BRAND_KIOSK_PALETTES = {
  smashme: [
    '#ef4444', // Kiosk 1 (SmashMe Red)
    '#f43f5e', // Kiosk 2 (Rose Red)
    '#b91c1c', // Kiosk 3 (Deep Red)
    '#fb7185', // Kiosk 4 (Soft Rose)
    '#fda4af',
  ],
  rollmaster: [
    '#dc2626', // Kiosk 1 (Roll Master Crimson)
    '#b91c1c', // Kiosk 2 (Deep Crimson)
    '#991b1b', // Kiosk 3 (Dark Ruby)
    '#e11d48', // Kiosk 4 (Ruby)
    '#f87171',
  ],
  crunch: [
    '#d97706', // Kiosk 1 (Crunch Amber)
    '#f59e0b', // Kiosk 2 (Gold Amber)
    '#b45309', // Kiosk 3 (Brown Amber)
    '#fbbf24', // Kiosk 4 (Light Gold)
  ],
  lovesushi: [
    '#f97316', // Kiosk 1 (Salmon Orange)
    '#ea580c', // Kiosk 2 (Deep Salmon)
    '#fb923c', // Kiosk 3 (Light Salmon)
    '#c2410c', // Kiosk 4 (Terracotta)
  ],
  pokiwoki: [
    '#65a30d', // Kiosk 1 (Poki-Woki Leaf Green)
    '#16a34a', // Kiosk 2 (Emerald Green)
    '#84cc16', // Kiosk 3 (Lime Green)
    '#15803d', // Kiosk 4 (Forest Green)
    '#4ade80',
  ],
};

export function normalizeBrandKey(brand) {
  const raw = String(brand || '').toLowerCase().trim();
  if (!raw) return 'smashme';
  const compact = raw.replace(/[\s\-_]+/g, '');
  if (compact.includes('poki')) return 'pokiwoki';
  if (compact.includes('crunch')) return 'crunch';
  if (compact.includes('welove') || compact.includes('lovesushi')) return 'lovesushi';
  if (compact.includes('roll') || compact.includes('sushi') || compact.includes('ikura')) return 'rollmaster';
  if (compact.includes('smash')) return 'smashme';
  return compact;
}

export function getBrandColor(brand) {
  const key = normalizeBrandKey(brand);
  return ALL_BRAND_COLORS[key] || '#ef4444';
}

export function getBrandLabel(brand) {
  if (!brand) return 'SmashMe';
  const raw = String(brand).toLowerCase().trim();
  if (ALL_BRAND_LABELS[raw]) return ALL_BRAND_LABELS[raw];
  const key = normalizeBrandKey(brand);
  return ALL_BRAND_LABELS[key] || String(brand);
}

