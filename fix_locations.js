const fs = require('fs');
const path = './packages/backend/data/locations.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.forEach(loc => {
  // If the location is a Sushi Master location (starts with "SM " or "IKURA"), it should NOT have smashme or crunch
  // Wait, does crunch belong to SmashMe? "crunch" is a separate brand. The user said "smash me au decat 2 locatii".
  
  if (loc.name.startsWith('SM ') || loc.name.startsWith('IKURA')) {
    loc.brands = loc.brands.filter(b => b !== 'smashme' && b !== 'crunch');
    if (loc.orgIds) {
      delete loc.orgIds.smashme;
      delete loc.orgIds.crunch;
    }
  } else {
    // If it's a SmashMe location, it shouldn't have sushi master brands
    loc.brands = loc.brands.filter(b => b === 'smashme' || b === 'crunch');
    if (loc.orgIds) {
      delete loc.orgIds.rollmaster;
      delete loc.orgIds.lovesushi;
      delete loc.orgIds.pokiwoki;
    }
  }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Fixed locations.json');
