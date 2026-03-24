const fs = require('fs');
const path = require('path');
const axios = require('axios');

const env = {
  SYRVE_API_URL: 'https://api-eu.syrve.live',
  SYRVE_API_KEY: '124d0880f4b44717b69ee21d45fc2656',
  SYRVE_ORG_IDS: '9c63cff6-1d66-442d-a98d-2302656e3943',
  SYRVE_API_KEY_SUSHI: '56597d13165c49c49c10e351b5eac617',
  SYRVE_ORG_ID_SUSHI: 'adddb5a0-26e5-4d50-b472-1c74726c3f72'
};

const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f43f5e', '#14b8a6', '#d946ef'];

async function getIikoToken(apiKey) {
  const { data } = await axios.post(`${env.SYRVE_API_URL}/api/1/access_token`, { apiLogin: apiKey });
  return data.token;
}

async function getIikoMenu(token, orgId) {
  const { data } = await axios.post(`${env.SYRVE_API_URL}/api/1/nomenclature`, { organizationId: orgId }, { headers: { Authorization: `Bearer ${token}` } });
  return data.products.filter(p => p.type === 'Dish');
}

async function run() {
  const initData = {
    smashme: { active: true, config: { title: 'Din partea casei!', rules: { minOrderValue: 45, maxSpinsPerOrder: 1 }, slices: [] } },
    welovesushi: { active: true, config: { title: 'Îți oferim cu drag!', rules: { minOrderValue: 80, maxSpinsPerOrder: 1 }, slices: [] } }
  };

  try {
    console.log('Fetching SmashMe...');
    let t1 = await getIikoToken(env.SYRVE_API_KEY);
    let items1 = await getIikoMenu(t1, env.SYRVE_ORG_IDS);
    items1 = items1.slice(0, 12);
    
    items1.forEach((item, idx) => {
      initData.smashme.config.slices.push({
        id: `sm_p${idx}`,
        name: item.name,
        type: 'product',
        productId: item.id,
        image: item.imageLinks?.[0] || 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png',
        probability: 100/12,
        bg: colors[idx % colors.length]
      });
    });

    console.log('Fetching Sushi...');
    let t2 = await getIikoToken(env.SYRVE_API_KEY_SUSHI);
    let items2 = await getIikoMenu(t2, env.SYRVE_ORG_ID_SUSHI);
    items2 = items2.slice(0, 12);
    
    items2.forEach((item, idx) => {
      initData.welovesushi.config.slices.push({
        id: `ws_p${idx}`,
        name: item.name,
        type: 'product',
        productId: item.id,
        image: item.imageLinks?.[0] || 'https://cdn-icons-png.flaticon.com/512/3173/3173369.png',
        probability: 100/12,
        bg: colors[idx % colors.length]
      });
    });

    const DATA_FILE = path.join(__dirname, '../data/promotions.json');
    fs.writeFileSync(DATA_FILE, JSON.stringify(initData, null, 2));
    
    // Touch index.js to force backend nodemon restart!
    const indexFile = path.join(__dirname, '../src/index.js');
    if (fs.existsSync(indexFile)) {
      const stamp = `// touched at ${Date.now()}\n`;
      fs.appendFileSync(indexFile, stamp);
    }
    
    console.log('Seed FULLY replaced with 100% genuine Iiko products.');
  } catch(e) { console.error('Error:', e.message); }
}

run();
