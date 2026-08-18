require('dotenv').config();
const { syrveGet, syrvePost } = require('./src/services/iikoService');

async function run() {
  const orgsRes = await syrveGet('/api/1/organizations', 'smashme');
  const orgs = orgsRes.organizations || [];
  const orgId = orgs[0]?.id;
  if (!orgId) return console.log('No org');
  
  const terms = await syrvePost('/api/1/terminal_groups', {organizationIds:[orgId], includeDisabled: false}, 'smashme');
  console.log(JSON.stringify(terms.terminalGroups[0]?.items, null, 2));
}
run();
