require('dotenv').config();
const { fetchMenu } = require('./src/services/iikoService');

(async () => {
  try {
    const orgId = process.env.SYRVE_ORG_ID_SUSHI;
    console.log("Fetching for sushimaster...");
    const menu = await fetchMenu(orgId, 'sushimaster');
    console.log("Returned categories containing ikura:");
    const kCats = menu.categories.filter(c => c.name.toLowerCase().includes('ikura'));
    console.log(kCats);
  } catch(e) {
    console.error(e);
  }
})();
