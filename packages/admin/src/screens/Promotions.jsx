import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const BRANDS = [
  { id: 'smashme',     label: 'SmashMe',     color: '#ef4444' },
  { id: 'rollmaster', label: 'Roll Master', color: '#3b82f6' },
  { id: 'lovesushi', label: 'Love Sushi', color: '#ec4899' },
  { id: 'pokiwoki', label: 'Poki-Woki', color: '#f97316' },
  { id: 'crunch', label: 'Crunch', color: '#eab308' },
  { id: 'welovesushi', label: 'WeLoveSushi', color: '#f59e0b' },
  { id: 'ikura',       label: 'Ikura',       color: '#10b981' }
];

const EMPTY_SLICE = { id: '', name: '', type: 'nada', probability: 10, bg: '#f1f5f9', image: '', productId: '' };
const DEFAULT_WHEEL = { title: 'Învârte Roata Norocului!', slices: [] };

export default function Promotions() {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  
  const [activeBrand, setActiveBrand] = useState('smashme');
  const [configList, setConfigList]   = useState({}); // { brandId: { active, config } }
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);
  
  // Products from iiko Menu
  const [menuProducts, setMenuProducts] = useState([]);

  // Edit State
  const [localActive, setLocalActive] = useState(false);
  const [localConfig, setLocalConfig] = useState({ ...DEFAULT_WHEEL });

  // Modal State
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingSlice, setEditingSlice] = useState(null);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/promotions`);
      const data = await res.json();
      setConfigList(data || {});
    } catch (e) {
      showToast(' Eoare fetch', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPromos(); }, []);

  // Update local state when switching brand or when data loads
  useEffect(() => {
    const actData = configList[activeBrand];
    setLocalActive(actData?.active || false);
    setLocalConfig(actData?.config?.slices ? actData.config : { ...DEFAULT_WHEEL });
  }, [activeBrand, configList]);

  // Fetch menu products for active brand
  useEffect(() => {
    if (!activeBrand) return;
    fetchWithAuth(`${BACKEND}/api/menu/items?brand=${activeBrand}&limit=1500`)
      .then(res => res.json())
      .then(data => setMenuProducts(data.items || data || []))
      .catch(() => setMenuProducts([]));
  }, [activeBrand]);

  const handleSaveAll = async () => {
    // Validate probabilities
    const sum = (localConfig.slices || []).reduce((acc, s) => acc + (s.probability || 0), 0);
    if (sum !== 100 && localConfig.slices?.length > 0) {
      return showToast(` Total procente trebuie să fie 100% (curent: ${sum}%)`, 'err');
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/promotions/${activeBrand}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: localActive, config: localConfig })
      });
      if (!res.ok) throw new Error('Failed to save');
      showToast(' Salvat cu succes');
      await fetchPromos();
    } catch (e) {
      showToast(' Eroare la salvare', 'err');
    } finally {
      setSaving(false);
    }
  };

  const openSliceModal = (slice = null) => {
    setEditingSlice(slice ? { ...slice } : { ...EMPTY_SLICE, id: Date.now().toString() });
    setModalOpen(true);
  };

  const closeSliceModal = () => {
    setEditingSlice(null);
    setModalOpen(false);
  };

  const saveSlice = () => {
    if (!editingSlice.name) return showToast('Nume obligatoriu', 'err');
    
    let slices = [...(localConfig.slices || [])];
    const idx = slices.findIndex(s => s.id === editingSlice.id);
    if (idx >= 0) {
      slices[idx] = editingSlice;
    } else {
      slices.push(editingSlice);
    }
    setLocalConfig({ ...localConfig, slices });
    closeSliceModal();
  };

  const deleteSlice = async (id) => {
    const ok = await confirm('Ștergi această felie?', { icon: '🔥', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    setLocalConfig({ ...localConfig, slices: localConfig.slices.filter(s => s.id !== id) });
  };

  // UI Helpers
  const totalProb = (localConfig.slices || []).reduce((acc, s) => acc + (s.probability || 0), 0);
  const isTotalOk = totalProb === 100;
  const isTotalOver = totalProb > 100;

  if (loading && Object.keys(configList).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
        <span className="text-slate-500 text-sm font-medium">Se încarcă...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 animate-in fade-in duration-300">
      
      {/* Brand Tabs */}
      <div className="flex flex-wrap gap-3 mb-8">
        {BRANDS.map(b => {
          const isActive = activeBrand === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setActiveBrand(b.id)}
              title={b.label}
              className={`w-12 h-12 rounded-full p-0 bg-white border flex items-center justify-center overflow-hidden transition-all duration-200 ${isActive ? 'border-2 scale-110 shadow-lg' : 'border-slate-200 opacity-50 hover:opacity-100 hover:scale-105'}`}
              style={{
                borderColor: isActive ? b.color : undefined,
                boxShadow: isActive ? `0 8px 24px ${b.color}40` : undefined,
              }}
            >
              <img src={`/brands/${b.id}-logo.png`} alt={b.label} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
            </button>
          );
        })}
      </div>

      {/* Main Form Area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white m-0">Promoții / Roata Norocului <span className="text-slate-500 font-normal">({BRANDS.find(b=>b.id===activeBrand)?.label})</span></h2>
            <p className="text-sm text-slate-500 mt-2 m-0 max-w-2xl">Configurează premiile de pe roată. Când Kiosk-ul este multi-brand, roata va conține proporțional feliile de la ambele branduri.</p>
          </div>
          
          <label className="flex items-center gap-3 cursor-pointer bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
            <span className="text-sm font-bold text-slate-900 dark:text-white">Roată Activă</span>
            <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${localActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${localActive ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
            <input type="checkbox" className="hidden" checked={localActive} onChange={e => setLocalActive(e.target.checked)} />
          </label>
        </div>

        {/* Global Settings */}
        <div className="mb-10 max-w-xl">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Titlu Modal Roată</label>
          <input 
            type="text" 
            value={localConfig.title || ''} 
            onChange={e => setLocalConfig({...localConfig, title: e.target.value})} 
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
            placeholder="Învârte roata și câștigă!"
          />
        </div>

        {/* Slices List */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">Felii Roată ({localConfig.slices?.length || 0})</h3>
          <button className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all flex items-center gap-2" onClick={() => openSliceModal()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Adaugă Felie
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-white/5">
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Premiu</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tip</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Background</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Probabilitate</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {(!localConfig.slices || localConfig.slices.length === 0) ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500 font-medium">Nicio felie adăugată.</td></tr>
                ) : localConfig.slices.map(slice => (
                  <tr key={slice.id} className="transition-colors hover:bg-white dark:hover:bg-slate-800/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {slice.image ? (
                          <img src={slice.image} alt="" className="w-9 h-9 rounded-full object-cover bg-white border border-slate-200 dark:border-slate-600 shadow-sm" />
                        ) : (
                          <div className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm" style={{ backgroundColor: slice.bg || '#ccc' }} />
                        )}
                        <span className="font-bold text-slate-900 dark:text-white">{slice.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm">
                        {slice.type === 'product' ? 'Produs Gratuit' : slice.type === 'discount' ? 'Reducere' : 'Necâștigător'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-sm font-mono text-slate-500 dark:text-slate-400">
                        <span className="w-4 h-4 rounded shadow-inner border border-slate-200 dark:border-slate-600" style={{ backgroundColor: slice.bg }} />
                        {slice.bg}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-black text-slate-900 dark:text-white">{slice.probability}%</span>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button title="Editează" onClick={() => openSliceModal(slice)} className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>
                        <button title="Șterge" onClick={() => deleteSlice(slice.id)} className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-500 transition-colors border border-red-100 dark:border-red-900/50 shadow-sm">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-sm text-slate-500 font-medium">* Asigurați-vă că totalul este fix 100%.</span>
            <span className={`inline-flex items-center px-4 py-1.5 rounded-xl text-sm font-black border ${isTotalOk ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : isTotalOver ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'}`}>
              Total: {totalProb}%
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <button className="px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-sm transition-all disabled:opacity-50" onClick={handleSaveAll} disabled={saving}>
            {saving ? 'Se salvează...' : 'Salvează Configurarea'}
          </button>
        </div>
      </div>

      {/* Modal adăugare/editare felie */}
      {modalOpen && editingSlice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto" onClick={closeSliceModal}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[24px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white m-0 leading-tight">{editingSlice.id.length > 10 ? 'Adaugă' : 'Editează'} Felie</h3>
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 transition-colors" onClick={closeSliceModal}>
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tip Premiu</label>
                <select value={editingSlice.type} onChange={e => {
                  const t = e.target.value;
                  setEditingSlice({...editingSlice, type: t, ...(t === 'nada' ? { name: 'Necâștigător', image: '', productId: '' } : {})});
                }} className="w-full px-4 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-shadow appearance-none">
                  <option value="product">Produs din Meniu (iiko)</option>
                  <option value="discount">Discount / Cod Promo</option>
                  <option value="nada">Necâștigător (Mai încearcă)</option>
                </select>
              </div>

              {editingSlice.type === 'product' && menuProducts.length > 0 && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Alege Produsul Real (iiko)</label>
                  <select 
                    className="w-full px-4 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-shadow" 
                    value={editingSlice.productId || ''}
                    onChange={e => {
                      const prodId = e.target.value;
                      const prod = menuProducts.find(p => p.id === prodId);
                      if (prod) {
                        setEditingSlice({
                          ...editingSlice,
                          productId: prod.id,
                          name: prod.name,
                          image: (prod.imageLinks && prod.imageLinks[0]) || prod.image || ''
                        });
                      } else {
                        setEditingSlice({ ...editingSlice, productId: '' });
                      }
                    }}
                  >
                    <option value="">-- Caută/Alege produs --</option>
                    {menuProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.price ? p.price + ' RON' : '-'})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nume Afișat pe Roată {editingSlice.type === 'product' && <span className="normal-case opacity-70 ml-1 font-medium">(completat automat)</span>}</label>
                <input type="text" value={editingSlice.name} onChange={e => setEditingSlice({...editingSlice, name: e.target.value})} className="w-full px-4 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-shadow" />
              </div>

              <div className="space-y-2">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Background (Hex)</label>
                    <input type="text" value={editingSlice.bg} onChange={e => setEditingSlice({...editingSlice, bg: e.target.value})} className="w-full px-4 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm transition-shadow uppercase" placeholder="#ff0000" />
                  </div>
                  <div className="w-16 flex flex-col justify-end pb-1">
                    <input type="color" value={editingSlice.bg} onChange={e => setEditingSlice({...editingSlice, bg: e.target.value})} className="w-full h-10 p-0 border-0 rounded-lg cursor-pointer bg-transparent overflow-hidden" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Șansă Câștig (%) - Probabilitate</label>
                <div className="relative">
                  <input type="number" min="0" max="100" value={editingSlice.probability} onChange={e => setEditingSlice({...editingSlice, probability: Number(e.target.value)})} className="w-full pl-4 pr-10 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg transition-shadow" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Imagine Premiu (URL)</label>
                <input type="text" value={editingSlice.image} onChange={e => setEditingSlice({...editingSlice, image: e.target.value})} className="w-full px-4 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-shadow text-sm" placeholder="https://...png" />
                <p className="text-xs text-slate-500 m-0">Avatar mic renderizat pe roată (opțional)</p>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button className="px-6 h-11 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors" onClick={closeSliceModal}>Anulează</button>
              <button className="px-8 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all" onClick={saveSlice}>Gata</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-2xl text-sm font-bold shadow-xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
