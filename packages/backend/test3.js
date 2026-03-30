require('dotenv').config();
const fs = require('fs');

(async () => {
  // Grab raw json from the live backend
  const res = await fetch('https://smart-kiosk-v7ws.onrender.com/api/menu?brandId=sushimaster&orgId=adddb5a0-26e5-4d50-b472-1c74726c3f72', {
    headers: { 'x-api-key': 'sk-live-2024-secure' }
  });
  const data = await res.json();
  const cats = data.categories;
  console.log("Found Ikura categories:", cats.filter(c => c.name.toLowerCase().includes('ikura')).length);
})();
