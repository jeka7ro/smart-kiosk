require('dotenv').config();
const { syrvePost } = require('./src/services/iikoService');

(async () => {
  const brandId = 'sushimaster';
  const orgId = process.env.SYRVE_ORG_ID_SUSHI;
  const raw = await syrvePost('/api/1/nomenclature', { organizationId: orgId }, brandId);
  const { groups = [] } = raw;

  const groupMap = {};
  for (const g of groups) {
    if (!g.isGroupModifier) groupMap[g.id] = g;
  }

  function isCategoryBlocked(catId) {
    let current = groupMap[catId];
    const catName = (current?.name || '').toLowerCase();
    
    if (brandId === 'sushimaster') {
      if (catName.includes('ikura') || catName.includes('wls') || catName.includes('love')) return true;
    }
    return false;
  }

  const ikuraGroups = groups.filter(g => g.name.toLowerCase().includes('ikura'));
  console.log("Found Ikura groups count:", ikuraGroups.length);
  const blockedCount = ikuraGroups.filter(g => isCategoryBlocked(g.id)).length;
  console.log("Blocked by isCategoryBlocked count:", blockedCount);
})();
