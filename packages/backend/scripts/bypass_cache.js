const fs = require('fs');
const axios = require('axios');

async function run() {
  try {
    // 1. Login Admin
    const loginRes = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'admin@kiosk.ro',
      password: 'admin123'
    });
    const token = loginRes.data.token;
    console.log('Logged in to backend. Token:', token.substring(0, 10) + '...');

    // 2. Read the fully real Iiko JSON
    const data = JSON.parse(fs.readFileSync('./packages/backend/data/promotions.json', 'utf8'));

    // 3. Push via authorized PUT
    for (const brand of ['smashme', 'welovesushi']) {
      if (data[brand]) {
        await axios.put(`http://localhost:4000/api/promotions/${brand}`, {
          active: data[brand].active,
          config: data[brand].config
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Pushed 100% REAL iiko products for ${brand} directly into active memory.`);
      }
    }
  } catch(e) {
    console.error('Failed to memory push', e.response?.data || e.message);
  }
}
run();
