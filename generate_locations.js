require('dotenv').config({path: './packages/backend/.env'});
const fs = require('fs');
const iiko = require('./packages/backend/src/services/iikoService');

async function run() {
  const smashOrgs = await iiko.getOrganizations('smashme');
  const sushiOrgs = await iiko.getOrganizations('rollmaster');

  const locations = [];

  // Add SmashMe / Crunch locations
  for (const org of smashOrgs.organizations) {
    locations.push({
      id: org.id,
      name: org.name,
      brands: ['smashme', 'crunch'],
      orgIds: {
        smashme: org.id,
        crunch: org.id
      },
      kiosks: [],
      tables: 20,
      active: true,
      isMultiBrand: true
    });
  }

  // Add Sushi Master (Rollmaster, Lovesushi, Pokiwoki) locations
  for (const org of sushiOrgs.organizations) {
    locations.push({
      id: org.id,
      name: org.name,
      brands: ['rollmaster', 'lovesushi', 'pokiwoki'],
      orgIds: {
        rollmaster: org.id,
        lovesushi: org.id,
        pokiwoki: org.id
      },
      kiosks: [],
      tables: 20,
      active: true,
      isMultiBrand: true
    });
  }

  // Sort locations by name
  locations.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync('./packages/backend/data/locations.json', JSON.stringify(locations, null, 2));
  console.log('Successfully generated clean locations.json with ' + locations.length + ' locations.');
}

run().catch(console.error);
