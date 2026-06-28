const fs = require('fs');
const glob = require('glob'); // Note: we might not have glob, let's use standard fs recursion

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = require('path').join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const replaceMap = [
  // App.jsx specific replacements
  {
    regex: /\{smashme:'SmashMe',sushimaster:'Sushi Master',welovesushi:'WeLoveSushi',ikura:'Ikura'\}/g,
    replace: "{smashme:'SmashMe', crunch:'Crunch', rollmaster:'Roll Master', lovesushi:'Love Sushi', pokiwoki:'Poki-Woki'}"
  },
  {
    regex: /const BRAND_LABELS = \{ smashme: 'SmashMe', sushimaster: 'Sushi Master', ikura: 'Ikura', welovesushi: 'WeLoveSushi' \};/g,
    replace: "const BRAND_LABELS = { smashme: 'SmashMe', crunch: 'Crunch', rollmaster: 'Roll Master', lovesushi: 'Love Sushi', pokiwoki: 'Poki-Woki' };"
  },
  {
    regex: /const BRAND_PILL_COLORS = \{ smashme: '#ef4444', sushimaster: '#3b82f6', ikura: '#8b5cf6', welovesushi: '#ec4899' \};/g,
    replace: "const BRAND_PILL_COLORS = { smashme: '#ef4444', crunch: '#eab308', rollmaster: '#3b82f6', lovesushi: '#ec4899', pokiwoki: '#f97316' };"
  },
  {
    regex: /smashme: '#ef4444', sushimaster: '#3b82f6', ikura: '#8b5cf6', welovesushi: '#ec4899',/g,
    replace: "smashme: '#ef4444', crunch: '#eab308', rollmaster: '#3b82f6', lovesushi: '#ec4899', pokiwoki: '#f97316',"
  },
  {
    regex: /const BRAND_COLORS = \{ smashme: '#ef4444', sushimaster: '#3b82f6', ikura: '#f97316', welovesushi: '#8b5cf6' \};/g,
    replace: "const BRAND_COLORS = { smashme: '#ef4444', crunch: '#eab308', rollmaster: '#3b82f6', lovesushi: '#ec4899', pokiwoki: '#f97316' };"
  },
  {
    regex: /const BRAND_COLORS = \{ smashme: '#ef4444', sushimaster: '#3b82f6' \};/g,
    replace: "const BRAND_COLORS = { smashme: '#ef4444', crunch: '#eab308', rollmaster: '#3b82f6', lovesushi: '#ec4899', pokiwoki: '#f97316' };"
  },
  // Arrays of objects with brands (in screens)
  {
    regex: /\{\s*id:\s*'sushimaster',\s*label:\s*'Sushi Master',\s*color:\s*'#[a-f0-9]+'\s*\}/g,
    replace: "{ id: 'rollmaster', label: 'Roll Master', color: '#3b82f6' },\n  { id: 'lovesushi', label: 'Love Sushi', color: '#ec4899' },\n  { id: 'pokiwoki', label: 'Poki-Woki', color: '#f97316' },\n  { id: 'crunch', label: 'Crunch', color: '#eab308' }"
  },
  {
    regex: /\{\s*id:\s*'sushimaster',\s*name:\s*'Sushi Master',\s*color:\s*'#[a-f0-9]+',\s*logo:\s*'\/brands\/sushimaster-logo.png'\s*\}/g,
    replace: "{ id: 'rollmaster', name: 'Roll Master', color: '#3b82f6', logo: '/brands/sushimaster-logo.png' },\n  { id: 'lovesushi', name: 'Love Sushi', color: '#ec4899', logo: '/brands/welovesushi-logo.png' },\n  { id: 'pokiwoki', name: 'Poki-Woki', color: '#f97316', logo: '/brands/sushimaster-logo.png' },\n  { id: 'crunch', name: 'Crunch', color: '#eab308', logo: '/brands/smashme-logo.png' }"
  },
  {
    regex: /sushimaster: \{\s*name:\s*'Sushi Master',\s*color:\s*'#[a-f0-9]+'\s*\}/g,
    replace: "rollmaster: { name: 'Roll Master', color: '#3b82f6' }, lovesushi: { name: 'Love Sushi', color: '#ec4899' }, pokiwoki: { name: 'Poki-Woki', color: '#f97316' }, crunch: { name: 'Crunch', color: '#eab308' }"
  }
];

walkDir('./packages/admin/src', (filePath) => {
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    replaceMap.forEach(r => {
      content = content.replace(r.regex, r.replace);
    });
    // Replace standalone string 'sushimaster' with 'rollmaster' in simple arrays
    content = content.replace(/\['all','smashme','sushimaster'\]/g, "['all','smashme','crunch','rollmaster','lovesushi','pokiwoki']");
    content = content.replace(/\{b === 'smashme' \? 'SmashMe' : 'SushiMaster'\}/g, "{b === 'smashme' ? 'SmashMe' : b === 'crunch' ? 'Crunch' : b === 'rollmaster' ? 'Roll Master' : b === 'lovesushi' ? 'Love Sushi' : 'Poki-Woki'}");

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log('Updated', filePath);
    }
  }
});
