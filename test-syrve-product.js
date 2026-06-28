require('dotenv').config({path: './packages/backend/.env'});
const fetch = require('node-fetch');

async function getProduct() {
  const tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiLogin: process.env.SYRVE_API_KEY_SUSHI })
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.token;

  const res = await fetch('https://api-eu.syrve.live/api/1/nomenclature', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: process.env.SYRVE_ORG_ID_SUSHI })
  });
  const data = await res.json();
  if(!data.products) return console.log(data);
  const p = data.products.find(p => p.type === 'Dish');
  console.log(JSON.stringify(p, null, 2));
}
getProduct().catch(console.error);
