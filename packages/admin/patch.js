const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add menuProducts state
content = content.replace(
  'const [menuImages, setMenuImages] = useState({});',
  'const [menuImages, setMenuImages] = useState({});\n  const [menuProducts, setMenuProducts] = useState({});\n  const [selectedItemDetail, setSelectedItemDetail] = useState(null);'
);

// 2. Add prodMap and setMenuProducts in useEffect
content = content.replace(
  'const imgMap = {};',
  'const imgMap = {};\n         const prodMap = {};'
);

content = content.replace(
  /brandMenu\.forEach\(p => \{/,
  'brandMenu.forEach(p => {\n             prodMap[p.id] = p;\n             if (p.name) prodMap[p.name.toLowerCase()] = p;'
);

content = content.replace(
  'setMenuImages(prev => ({ ...prev, [selectedOrder.brand]: imgMap }));',
  'setMenuImages(prev => ({ ...prev, [selectedOrder.brand]: imgMap }));\n         setMenuProducts(prodMap);'
);

// 3. Make product rows clickable
content = content.replace(
  /let finalImageUrl = item\.imageUrl([^;]+);([^>]+)return \(\n\s*<div key=\{idx\} className=\"([^\"]+)\"/s,
  (match, p1, p2, p3) => {
    return 'let finalImageUrl = item.imageUrl' + p1 + ';\n                const fullProd = menuProducts[item.productId] || (item.name && menuProducts[item.name.toLowerCase()]);' + p2 + 'return (\n                <div key={idx} \n                     className=\"' + p3 + ' ${fullProd ? \'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors\' : \'\'}\"\n                     onClick={() => { if (fullProd) setSelectedItemDetail(fullProd); }}';
  }
);

// 4. Add the Modal
const modalCode = `
    {/* ── Product Detail Modal ── */}
    {selectedItemDetail && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedItemDetail(null)}>
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedItemDetail.name}</h2>
            <button onClick={() => setSelectedItemDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 font-bold">✕</button>
          </div>
          <div className="flex flex-col md:flex-row overflow-hidden flex-1">
            {/* LEFT: Image */}
            <div className="w-full md:w-2/5 shrink-0 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
              {(() => {
                const brandMap = menuImages[selectedOrder?.brand] || {};
                let finalImg = brandMap[selectedItemDetail.id] || (selectedItemDetail.name && brandMap[selectedItemDetail.name.toLowerCase()]) || null;
                if (finalImg && finalImg.startsWith('/uploads')) finalImg = \`\${BACKEND}\${finalImg}\`;
                
                if (finalImg) {
                  return <img src={finalImg} alt={selectedItemDetail.name} className="w-full max-w-[250px] aspect-square object-cover rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700" />;
                }
                return (
                  <div className="w-full max-w-[250px] aspect-square rounded-3xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center border border-slate-300 dark:border-slate-600">
                    <span className="text-6xl">🍽️</span>
                  </div>
                );
              })()}
            </div>
            
            {/* RIGHT: Text Content */}
            <div className="w-full md:w-3/5 p-6 overflow-y-auto space-y-4">
              {(() => {
                const trans = selectedItemDetail.translations || {};
                const desc = trans.ro || trans.en || selectedItemDetail.description || '';
                if (!desc) return <p className="text-sm text-slate-500 italic">Nicio descriere detaliată disponibilă în Syrve.</p>;
                return (
                  <div 
                    className="prose dark:prose-invert prose-sm max-w-none text-slate-700 dark:text-slate-300"
                    dangerouslySetInnerHTML={{ __html: desc.replace(/\\n/g, '<br/>') }}
                  />
                );
              })()}
              
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                 {selectedItemDetail.weight != null && <p className="text-sm text-slate-600 dark:text-slate-400"><strong>Greutate:</strong> {selectedItemDetail.weight} kg</p>}
                 {selectedItemDetail.energyAmount != null && <p className="text-sm text-slate-600 dark:text-slate-400"><strong>Valoare energetică:</strong> {selectedItemDetail.energyAmount} Kcal</p>}
                 {selectedItemDetail.price != null && <p className="text-sm text-slate-600 dark:text-slate-400"><strong>Preț Syrve:</strong> {selectedItemDetail.price} lei</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Cancel Confirmation Modal ── */}
`;

content = content.replace(
  '{/* ── Cancel Confirmation Modal ── */}',
  modalCode
);

fs.writeFileSync('src/App.jsx', content);
console.log('App.jsx successfully updated.');
