const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function run() {
  try {
    const DATA_FILE = path.join(__dirname, '../data/promotions.json');
    const initData = {
      smashme: { active: true, config: { title: 'Roata Norocului', rules: { minOrderValue: 45, maxSpinsPerOrder: 1 }, slices: [] } },
      welovesushi: { active: true, config: { title: 'Roata Norocului', rules: { minOrderValue: 100, maxSpinsPerOrder: 1 }, slices: [] } }
    };

    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f43f5e', '#14b8a6', '#d946ef'];

    for (let brand of ['smashme', 'welovesushi']) {
      console.log('Fetching', brand);
      let items = [];
      try {
        const res = await axios.get(`http://localhost:4000/api/menu/items?brand=${brand}&limit=50`, {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        });
        if (res.data && res.data.items) items = res.data.items.slice(0, 5);
        else if (Array.isArray(res.data)) items = res.data.slice(0, 5);
      } catch(e) {
         console.error('Failed fetch', e.message);
      }

      const slices = [];
      let cIdx = 0;
      
      // Add 5 real products
      items.forEach((item, idx) => {
        let finalImage = item.imageLinks?.[0] || item.image || '';
        // Un-proxy if needed or just use as is
        
        slices.push({
          id: `${brand}_p${idx}`,
          name: item.name,
          type: 'product',
          productId: item.id,
          image: finalImage,
          probability: 5,
          bg: colors[cIdx++]
        });
        
        // Add a "nada" slice after each product
        slices.push({
           id: `${brand}_n${idx}`,
           name: 'Mai încearcă altă dată',
           type: 'nada',
           probability: 15,
           bg: colors[cIdx++]
        });
      });
      
      // If menu was empty, just put 12 nadas
      while(slices.length < 12) {
         slices.push({
           id: `${brand}_n_extra_${slices.length}`,
           name: 'Mai încearcă altă dată',
           type: 'nada',
           probability: 10,
           bg: colors[cIdx++]
         });
      }

      initData[brand].config.slices = slices.slice(0, 12);
      
      // Recalculate probabilities to exactly 100%
      let totalProb = initData[brand].config.slices.reduce((acc, s) => acc + s.probability, 0);
      let diff = 100 - totalProb;
      if (diff > 0) initData[brand].config.slices[11].probability += diff;
      else if (diff < 0) initData[brand].config.slices[1].probability += diff;
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(initData, null, 2));
    console.log('Seed reset successfully using real products.');
  } catch (err) {
    console.error(err);
  }
}
run();
