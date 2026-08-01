const fs = require('fs');
const files = [
  'src/App.jsx',
  'src/screens/Integrations.jsx',
  'src/screens/TranslationsScreen.jsx',
  'src/screens/QrGenerator.jsx'
];
files.forEach(f => {
  if(fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');

    // 1. Cards / Modals: rounded-2xl -> rounded-3xl
    content = content.replace(/rounded-2xl/g, 'rounded-3xl');

    // 2. Buttons, inputs, spans (except explicitly large squares)
    content = content.replace(/className=([\"\'])([^\"\']+?)([\"\'])/g, (match, q1, cls, q2) => {
        if (!cls.includes('w-16 h-16') && !cls.includes('aspect-video')) {
            cls = cls.replace(/rounded-lg/g, 'rounded-full').replace(/rounded-xl/g, 'rounded-full');
        }
        return `className=${q1}${cls}${q2}`;
    });
    
    // Also handle className={`...`}
    content = content.replace(/className=\{([^\}]+)\}/g, (match, inner) => {
        // inner is like `w-full flex ...`
        if (!inner.includes('w-16 h-16') && !inner.includes('aspect-video')) {
            inner = inner.replace(/rounded-lg/g, 'rounded-full').replace(/rounded-xl/g, 'rounded-full');
        }
        return `className={${inner}}`;
    });

    fs.writeFileSync(f, content);
    console.log('Updated', f);
  }
});
