const fs = require('fs');
let content = fs.readFileSync('packages/kiosk/src/screens/ProductScreen.jsx', 'utf8');

// Replace the right panel logic with bulletproof fallback
content = content.replace(
  /<div className="ps-right scroll-y">[\s\S]*?<\/div>\s*<\/div>/,
  `<div className="ps-right scroll-y" style={{ background: 'var(--bg)', flex: 1, padding: '40px', overflowY: 'auto' }}>
        <div className="suggestions-header" style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid var(--border)' }}>
           <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#111827', margin: '0 0 8px 0' }}>Recomandări Pentru Tine 🔥</h2>
           <p style={{ fontSize: '1.2rem', color: '#4b5563', margin: 0 }}>Ce s-ar mai potrivi cu comanda ta de astăzi?</p>
        </div>
        
        {suggestions.length > 0 ? (
          <div className="suggestions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {suggestions.map((sug, i) => (
               <ProductCard 
                 key={sug.id} 
                 product={sug} 
                 delay={i * 0.05} 
                 lang={lang} 
                 activeBrand={brand?.id || 'smashme'} 
                 onQuickAdd={(p, ref) => handleQuickAddSug(p, ref)}
                 onInfo={() => setSelectedProduct(sug)} 
               />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🍽️</div>
            <h3 style={{ color: '#111827', fontSize: '1.4rem' }}>Fără recomandări momentan.</h3>
          </div>
        )}
      </div>`
);

fs.writeFileSync('packages/kiosk/src/screens/ProductScreen.jsx', content);
