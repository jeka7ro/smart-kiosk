const fs = require('fs');
const path = './packages/backend/data/locations.json';
const locs = JSON.parse(fs.readFileSync(path, 'utf8'));

locs.forEach(loc => {
  loc.brands = ['smashme', 'crunch', 'rollmaster', 'lovesushi', 'pokiwoki'];
  loc.orgIds = {
    "smashme": "9c63cff6-1d66-442d-a98d-2302656e3943",
    "crunch": "9c63cff6-1d66-442d-a98d-2302656e3943",
    "rollmaster": loc.orgIds?.sushimaster || "adddb5a0-26e5-4d50-b472-1c74726c3f72",
    "lovesushi": loc.orgIds?.welovesushi || "adddb5a0-26e5-4d50-b472-1c74726c3f72",
    "pokiwoki": loc.orgIds?.sushimaster || "adddb5a0-26e5-4d50-b472-1c74726c3f72"
  };
});

fs.writeFileSync(path, JSON.stringify(locs, null, 2));
console.log('Locations updated!');
