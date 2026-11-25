import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';
import VouchersManager from './VouchersManager';
import { Ticket, Disc3, Plus, Pencil, Trash2, X } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const BRANDS = [
  { id: 'smashme',     label: 'SmashMe',     color: '#ef4444' },
  { id: 'rollmaster', label: 'Roll Master', color: '#dc2626' },
  { id: 'lovesushi', label: 'Love Sushi', color: '#f97316' },
  { id: 'pokiwoki', label: 'Poki-Woki', color: '#65a30d' },
  { id: 'crunch', label: 'Crunch', color: '#d97706' },
  { id: 'welovesushi', label: 'WeLoveSushi', color: '#f97316' }
];

const EMPTY_SLICE = { id: '', name: '', type: 'nada', probability: 10, bg: '#f1f5f9', image: '', productId: '' };
const DEFAULT_WHEEL = { title: 'Învârte Roata Norocului!', slices: [] };

export default function Promotions() {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  
  const [subTab, setSubTab]           = useState('vouchers'); // 'vouchers' | 'wheel'
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
    const ok = await confirm('Ștergi această felie?', { icon: '', okLabel: 'Șterge', danger: true });
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
    <div className="w-full pb-10 animate-in fade-in duration-200">
      
      {/* Apple Segmented Sub-Tabs: Vouchere vs Roata Norocului */}
      <div className="mb-5">
        <div className="apple-segmented">
          <button
            type="button"
            onClick={() => setSubTab('vouchers')}
            className={`apple-segmented-item inline-flex items-center gap-2 !px-4 !py-1.5 ${subTab === 'vouchers' ? 'is-active' : ''}`}
          >
            <Ticket size={14} />
            <span>Coduri Promoționale</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('wheel')}
            className={`apple-segmented-item inline-flex items-center gap-2 !px-4 !py-1.5 ${subTab === 'wheel' ? 'is-active' : ''}`}
          >
            <Disc3 size={14} />
            <span>Roata Norocului</span>
          </button>
        </div>
      </div>

      {subTab === 'vouchers' ? (
        <VouchersManager />
      ) : (
        <>
          {/* Brand Tabs */}
          <div className="flex flex-wrap gap-2.5 mb-5">
        {BRANDS.map(b => {
          const isActive = activeBrand === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBrand(b.id)}
              title={b.label}
              className={`h-10 px-3 rounded-full bg-white dark:bg-[#1C1C1E] border flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-[#007AFF] ring-2 ring-[#007AFF]/20 text-[#1D1D1F] dark:text-white font-semibold'
                  : 'border-black/[0.06] dark:border-white/[0.08] text-[#6E6E73] opacity-75 hover:opacity-100'
              }`}
            >
              <img src={`/brands/${b.id}-logo.png`} alt={b.label} className="w-6 h-6 rounded-md object-cover" onError={e => { e.target.style.display='none'; }} />
              <span className="text-[12.5px]">{b.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Form Area */}
      <div className="apple-card p-6 md:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">
              Roata Norocului · {BRANDS.find(b=>b.id===activeBrand)?.label}
            </h2>
            <p className="text-[12.5px] text-[#86868B] mt-1 m-0 max-w-2xl">
              Configurează premiile de pe roată. Când kiosk-ul este multi-brand, feliile se combină proporțional.
            </p>
          </div>
          
          <div className="apple-inset-group px-4 py-2.5 flex items-center gap-3 shrink-0">
            <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Roată Activă</span>
            <button
              type="button"
              role="switch"
              aria-checked={localActive}
              onClick={() => setLocalActive(v => !v)}
              className={`apple-switch ${localActive ? 'is-on' : ''}`}
            >
              <span className="apple-switch-thumb" />
            </button>
          </div>
        </div>

        {/* Global Settings */}
        <div className="mb-7 max-w-lg">
          <label className="block text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] mb-1.5">Titlu Modal Roată</label>
          <input 
            type="text" 
            value={localConfig.title || ''} 
            onChange={e => setLocalConfig({...localConfig, title: e.target.value})} 
            className="apple-input w-full px-3.5 py-2.5 text-[13.5px]"
            placeholder="Învârte roata și câștigă!"
          />
        </div>

        {/* Slices List */}
        <div className="flex items-center justify-between gap-4 mb-3.5">
          <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">
            Felii Roată ({localConfig.slices?.length || 0})
          </h3>
          <button type="button" className="apple-btn-primary px-3.5 py-2 text-[12.5px] flex items-center gap-1.5" onClick={() => openSliceModal()}>
            <Plus size={15} strokeWidth={2.4} />
            <span>Adaugă Felie</span>
          </button>
        </div>

        <div className="apple-inset-group overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.07]">
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Premiu</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Tip</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Culoare</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Probabilitate</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06] bg-white dark:bg-[#1C1C1E]">
                {(!localConfig.slices || localConfig.slices.length === 0) ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-[#86868B] text-[13px]">Nicio felie adăugată.</td></tr>
                ) : localConfig.slices.map(slice => (
                  <tr key={slice.id} className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {slice.image ? (
                          <img src={slice.image} alt="" className="w-8 h-8 rounded-lg object-cover bg-white border border-black/[0.06]" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg border border-black/[0.08]" style={{ backgroundColor: slice.bg || '#E5E5EA' }} />
                        )}
                        <span className="font-semibold text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7]">{slice.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-black/[0.05] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {slice.type === 'product' ? 'Produs Gratuit' : slice.type === 'discount' ? 'Reducere' : 'Necâștigător'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 text-[12px] text-[#6E6E73] dark:text-[#98989D]">
                        <span className="w-3.5 h-3.5 rounded border border-black/10" style={{ backgroundColor: slice.bg }} />
                        {slice.bg}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">{slice.probability}%</span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" title="Editează" onClick={() => openSliceModal(slice)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer">
                          <Pencil size={14} />
                        </button>
                        <button type="button" title="Șterge" onClick={() => deleteSlice(slice.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] transition-colors cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[12px] text-[#86868B]">Asigură-te că suma probabilităților este fix 100%.</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[12px] font-semibold tabular-nums ${isTotalOk ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]' : isTotalOver ? 'bg-[#FF3B30]/12 text-[#D70015] dark:text-[#FF453A]' : 'bg-[#FF9500]/15 text-[#C96B00] dark:text-[#FF9F0A]'}`}>
              Total: {totalProb}%
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button type="button" className="apple-btn-primary px-5 py-2.5 text-[13px] disabled:opacity-50" onClick={handleSaveAll} disabled={saving}>
            {saving ? 'Se salvează...' : 'Salvează Configurarea'}
          </button>
        </div>
      </div>

      {/* Modal adăugare/editare felie */}
      {modalOpen && editingSlice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150" onClick={closeSliceModal}>
          <div className="apple-modal w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">{editingSlice.id.length > 10 ? 'Adaugă Felie' : 'Editează Felie'}</h3>
              <button type="button" className="apple-close-btn" onClick={closeSliceModal} title="Închide">
                 <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D]">Tip Premiu</label>
                <select value={editingSlice.type} onChange={e => {
                  const t = e.target.value;
                  setEditingSlice({...editingSlice, type: t, ...(t === 'nada' ? { name: 'Necâștigător', image: '', productId: '' } : {})});
                }} className="apple-input w-full px-3.5 h-10 text-[13px]">
                  <option value="product">Produs din Meniu (iiko)</option>
                  <option value="discount">Discount / Cod Promo</option>
                  <option value="nada">Necâștigător (Mai încearcă)</option>
                </select>
              </div>

              {editingSlice.type === 'product' && menuProducts.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D]">Alege Produsul (iiko)</label>
                  <select 
                    className="apple-input w-full px-3.5 h-10 text-[13px]" 
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
                    <option value="">Selectează produs...</option>
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
                    <input type="text" value={editingSlice.bg} onChange={e => setEditingSlice({...editingSlice, bg: e.target.value})} className="w-full px-4 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-shadow uppercase" placeholder="#ff0000" />
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
      </>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-2xl text-sm font-bold shadow-xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
