require('dotenv').config({path: './packages/backend/.env'});
const fetch = require('node-fetch');

async function getRoots() {
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
  if(!data.groups) return console.log(data);
  const roots = data.groups.filter(g => !g.parentGroup);
  console.log('Mape principale in Sushi Account (Branduri posibile):');
  roots.forEach(r => console.log('- ' + r.name + ' (ID: ' + r.id + ')'));
  
  const tokenRes2 = await fetch('https://api-eu.syrve.live/api/1/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiLogin: process.env.SYRVE_API_KEY })
  });
  const tokenData2 = await tokenRes2.json();
  const res2 = await fetch('https://api-eu.syrve.live/api/1/nomenclature', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + tokenData2.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: process.env.SYRVE_ORG_IDS.split(',')[0] })
  });
  const data2 = await res2.json();
  if(!data2.groups) return console.log(data2);
  const roots2 = data2.groups.filter(g => !g.parentGroup);
  console.log('\nMape principale in SmashMe Account (Branduri posibile):');
  roots2.forEach(r => console.log('- ' + r.name + ' (ID: ' + r.id + ')'));
}
getRoots().catch(console.error);
