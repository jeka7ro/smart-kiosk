const fs = require('fs');

// 1. Update App.css for KDS
let css = fs.readFileSync('src/App.css', 'utf8');

css = css.replace(/border-radius: 12px;/g, 'border-radius: 9999px;');
css = css.replace(/border-radius: 8px;/g, 'border-radius: 9999px;');
css = css.replace(/border-radius: 9px;/g, 'border-radius: 9999px;');
css = css.replace(/border-radius: 16px;/g, 'border-radius: 32px;'); // cards
css = css.replace(/border-radius: 5px;/g, 'border-radius: 9999px;');
css = css.replace(/border-radius: 6px;/g, 'border-radius: 9999px;');
css = css.replace(/border-radius: 10px;/g, 'border-radius: 9999px;');

fs.writeFileSync('src/App.css', css);
console.log('Updated KDS App.css');
