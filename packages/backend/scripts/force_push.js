const axios = require('axios');
const fs = require('fs');

async function run() {
  try {
     const data = JSON.parse(fs.readFileSync('./packages/backend/data/promotions.json', 'utf8'));
     
     for (const brand of ['smashme', 'welovesushi']) {
        if (data[brand]) {
           await axios.put(`http://localhost:4000/api/promotions/${brand}`, {
             active: data[brand].active,
             config: data[brand].config
           });
           console.log(`Pushed to ${brand} backend memory`);
        }
     }
  } catch(e) {
     console.error('Failed to memory push', e.message);
  }
}
run();
