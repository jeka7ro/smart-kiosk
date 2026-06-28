const fs = require('fs');
const path = './packages/qr-web/src/config/brands.js';
if (!fs.existsSync(path)) {
  console.log('No qr-web config found, skipping.');
  process.exit(0);
}
let content = fs.readFileSync(path, 'utf8');

// The qr-web config is an array usually
const newBrands = `
export const BRANDS = [
  { id: 'smashme', name: 'Smash Me', emoji: '🍔', url: 'smashme.ro',
    logo: '/brands/smashme-logo.png',
    colors: { primary: '#EE3B24', bg: '#ffffff' } },
  { id: 'crunch', name: 'Crunch', emoji: '🍗', url: 'smashme.ro',
    logo: '/brands/smashme-logo.png',
    colors: { primary: '#FFB800', bg: '#ffffff' } },
  { id: 'rollmaster', name: 'Roll Master', emoji: '🍣', url: 'sushimaster.ro',
    logo: '/brands/sushimaster-logo.png',
    colors: { primary: '#E31E24', bg: '#ffffff' } },
  { id: 'lovesushi', name: 'Love Sushi', emoji: '🍣', url: 'welovesushi.ro',
    logo: '/brands/welovesushi-logo.png',
    colors: { primary: '#E31E24', bg: '#ffffff' } },
  { id: 'pokiwoki', name: 'Poki-Woki', emoji: '🥗', url: 'pokiwoki.ro',
    logo: '/brands/sushimaster-logo.png',
    colors: { primary: '#F97316', bg: '#ffffff' } }
];
`;
content = content.replace(/export const BRANDS = \[[\s\S]*?\];/m, newBrands.trim());
fs.writeFileSync(path, content);
console.log('QR brands updated.');
