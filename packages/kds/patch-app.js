const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add states
content = content.replace(
  "const [brand, setBrand]         = useState('all');\n  const socketRef = useRef(null);",
  "const [brand, setBrand]         = useState('all');\n  const socketRef = useRef(null);\n  const [menuProducts, setMenuProducts] = useState({});\n  const [selectedItemDetail, setSelectedItemDetail] = useState(null);"
);

// 2. Add useEffect to fetch menu/all
content = content.replace(
  "  // Load ALL orders on mount (including delivered/completed history)",
  `  // Fetch all menu products from iiko for item details
  useEffect(() => {
    fetch(\`\${BACKEND}/api/menu/all\`)
      .then(r => r.json())
      .then(allMenuData => {
         const prodMap = {};
         Object.keys(allMenuData || {}).forEach(b => {
           const brandMenu = allMenuData[b]?.menu?.products || [];
           brandMenu.forEach(p => {
             prodMap[p.id] = p;
             if (p.name) prodMap[p.name.toLowerCase()] = p;
           });
         });
         setMenuProducts(prodMap);
      })
      .catch(() => {});
  }, []);

  // Load ALL orders on mount (including delivered/completed history)`
);

// 3. Make items clickable
content = content.replace(
  /className="oc-item">([\s\S]*?)<span className="oc-item-name">\{item\.name\}<\/span>/,
  \`className="oc-item" 
               style={{ cursor: 'pointer' }}
               onClick={() => {
                 const fullProd = menuProducts[item.productId] || (item.name && menuProducts[item.name.toLowerCase()]);
                 if (fullProd) setSelectedItemDetail({ ...fullProd, originalItem: item });
               }}>
            <span className="oc-qty">{item.quantity}x</span>
            <div className="oc-item-info">
              <span className="oc-item-name">{item.name}</span>\`
);

// 4. Add the Modal JSX at the end of the return statement
const modalCode = \`
      {/* ── Product Detail Modal ── */}
      {selectedItemDetail && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', padding: '20px'
        }} onClick={() => setSelectedItemDetail(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '32px', border: '1px solid var(--border)',
            width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 30px',
              borderBottom: '1px solid var(--border)'
            }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>{selectedItemDetail.name}</h2>
              <button onClick={() => setSelectedItemDetail(null)} style={{
                background: 'var(--bg)', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem',
                width: '40px', height: '40px', borderRadius: '9999px', cursor: 'pointer'
              }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
              {/* LEFT: Image */}
              <div style={{
                width: window.innerWidth < 768 ? '100%' : '40%', background: 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px',
                borderRight: window.innerWidth < 768 ? 'none' : '1px solid var(--border)',
                borderBottom: window.innerWidth < 768 ? '1px solid var(--border)' : 'none',
              }}>
                {(() => {
                  let finalImg = selectedItemDetail.image || (selectedItemDetail.imageLinks && selectedItemDetail.imageLinks[0]);
                  if (finalImg && finalImg.startsWith('/uploads')) finalImg = \`\${BACKEND}\${finalImg}\`;
                  
                  if (finalImg) {
                    return <img src={finalImg} alt={selectedItemDetail.name} style={{ width: '100%', maxWidth: '250px', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '32px' }} />;
                  }
                  return (
                    <div style={{ width: '100%', maxWidth: '250px', aspectRatio: '1/1', borderRadius: '32px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '5rem' }}>🍽️</span>
                    </div>
                  );
                })()}
              </div>
              
              {/* RIGHT: Text Content */}
              <div style={{ width: window.innerWidth < 768 ? '100%' : '60%', padding: '30px', overflowY: 'auto' }}>
                {(() => {
                  const trans = selectedItemDetail.translations || {};
                  const desc = trans.ro || trans.en || selectedItemDetail.description || '';
                  if (!desc) return <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Nicio descriere detaliată disponibilă în Syrve.</p>;
                  return (
                    <div style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: '1.6' }}
                         dangerouslySetInnerHTML={{ __html: desc.replace(/\\n/g, '<br/>') }} />
                  );
                })()}
                
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   {selectedItemDetail.weight != null && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text)' }}>Greutate:</strong> {selectedItemDetail.weight} kg</p>}
                   {selectedItemDetail.energyAmount != null && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text)' }}>Valoare energetică:</strong> {selectedItemDetail.energyAmount} Kcal</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
\`;
`;

content = content.replace(
  '    </div>\n  );\n}',
  modalCode
);

fs.writeFileSync('src/App.jsx', content);
console.log('App.jsx updated with Modal');
