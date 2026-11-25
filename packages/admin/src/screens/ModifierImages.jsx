import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';
import { Sparkles, Trash2, Check, Search, Pencil, X, Image as ImageIcon } from 'lucide-react';

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const PAGE_SIZE = 25;

const BRANDS = [
  { id: 'smashme',     label: 'SmashMe',     color: '#ef4444' },
  { id: 'rollmaster', label: 'Roll Master', color: '#e31e24' },
  { id: 'lovesushi', label: 'Love Sushi', color: '#ec4899' },
  { id: 'pokiwoki', label: 'Poki-Woki', color: '#f97316' },
  { id: 'crunch', label: 'Crunch', color: '#eab308' },
  { id: 'welovesushi', label: 'WeLoveSushi', color: '#f59e0b' }
];

export default function ModifierImages() {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [modifiers,   setModifiers]   = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(new Set());
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [activeBrand, setActiveBrand] = useState('ALL');
  const [editingId,   setEditingId]   = useState(null);
  const [editUrl,     setEditUrl]     = useState('');
  const [saving,      setSaving]      = useState(null);
  const [toast,       setToast]       = useState(null);
  const [selectedSugs, setSelectedSugs] = useState(new Set());

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        fetchWithAuth(`${BACKEND}/api/admin/modifier-images`),
        fetchWithAuth(`${BACKEND}/api/admin/modifier-suggestions`),
      ]);
      const mData = await mRes.json();
      const sData = await sRes.json();
      setModifiers(mData.modifiers || []);
      setSuggestions(sData.suggestions || []);
    } catch (e) { showToast(e.message, 'err'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() =>
    modifiers.filter(m => {
      if (activeBrand !== 'ALL' && m.brandId?.toLowerCase() !== activeBrand) return false;
      return m.name?.toLowerCase().includes(search.toLowerCase()) ||
             m.groupName?.toLowerCase().includes(search.toLowerCase()) ||
             m.brandId?.toLowerCase().includes(search.toLowerCase());
    }), [modifiers, search, activeBrand]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPageSelected = pageItems.length > 0 && pageItems.every(m => selected.has(m.id));

  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev);
    allPageSelected ? pageItems.forEach(m => n.delete(m.id)) : pageItems.forEach(m => n.add(m.id));
    return n;
  });
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const saveImage = async (modId, modName, brandId, url) => {
    if (!url?.trim()) return showToast('URL invalid', 'err');
    setSaving(modId);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${modId}`, {
        method: 'PUT',
        body: JSON.stringify({ imageUrl: url, name: modName, brandId }),
      });
      if (!res.ok) throw new Error('Salvare eșuată');
      showToast('Imagine salvată!');
      setEditingId(null);
      fetchAll();
    } catch (e) { showToast(e.message, 'err'); }
    finally { setSaving(null); }
  };

  const deleteImage = async (modId) => {
    const ok = await confirm('Ștergi imaginea?', { okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${modId}`, { method: 'DELETE' });
      showToast('Șters'); fetchAll();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = await confirm(`Ștergi imaginile la ${ids.length} modificatori?`, { title: 'Ștergere multiple', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      await Promise.all(ids.map(id => fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${id}`, { method: 'DELETE' })));
      setSelected(new Set()); showToast(`${ids.length} imagini șterse`); fetchAll();
    } catch (e) { showToast(e.message, 'err'); }
  };

  const acceptSuggestion = (sug) => saveImage(sug.modifier.id, sug.modifier.name, sug.modifier.brandId, sug.suggestedProduct.image);
  const dismissSuggestion = (id) => setSuggestions(prev => prev.filter(s => s.modifier.id !== id));

  // Bulk accept suggestions
  const allSugsSelected = suggestions.length > 0 && suggestions.every(s => selectedSugs.has(s.modifier.id));
  const toggleAllSugs = () => setSelectedSugs(prev => {
    if (allSugsSelected) return new Set();
    return new Set(suggestions.map(s => s.modifier.id));
  });
  const toggleOneSug = (id) => setSelectedSugs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [acceptingAll, setAcceptingAll] = useState(false);
  const bulkAcceptSugs = async (ids) => {
    const toAccept = suggestions.filter(s => ids.has(s.modifier.id));
    if (!toAccept.length) return;
    setAcceptingAll(true);
    try {
      await Promise.all(toAccept.map(sug =>
        fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${sug.modifier.id}`, {
          method: 'PUT',
          body: JSON.stringify({ imageUrl: sug.suggestedProduct.image, name: sug.modifier.name, brandId: sug.modifier.brandId }),
        })
      ));
      showToast(`${toAccept.length} imagini acceptate!`);
      setSelectedSugs(new Set());
      fetchAll();
    } catch (e) { showToast(e.message, 'err'); }
    finally { setAcceptingAll(false); }
  };
  const acceptAllSugs = () => bulkAcceptSugs(new Set(suggestions.map(s => s.modifier.id)));
  const acceptSelectedSugs = () => bulkAcceptSugs(selectedSugs);

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 space-y-6 animate-in fade-in duration-300">

      {/* ── Sugestii Automate ────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div className="apple-card overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-[#FF9500]/12 text-[#FF9500] flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Sugestii Automate</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/12 text-[#FF9500] tabular-nums">{suggestions.length}</span>
              </div>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#98989D] m-0">Imagini identificate automat din produsele meniului</p>
            </div>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {selectedSugs.size > 0 && (
                <button className="apple-btn-primary text-[12px] px-3.5 py-1.5" onClick={acceptSelectedSugs} disabled={acceptingAll}>
                  <Check size={13} />
                  {acceptingAll ? '...' : `Acceptă selectate (${selectedSugs.size})`}
                </button>
              )}
              <button className="apple-btn-primary text-[12px] px-3.5 py-1.5" onClick={acceptAllSugs} disabled={acceptingAll}>
                <Check size={13} />
                {acceptingAll ? 'Se procesează...' : `Acceptă tot (${suggestions.length})`}
              </button>
              <button className="apple-btn-secondary text-[12px] px-3 py-1.5" onClick={() => setSuggestions([])}>Ignoră toate</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider">
                  <th className="px-4 py-3 w-12 text-center"><input type="checkbox" className="w-4 h-4 rounded accent-[#007AFF] cursor-pointer" checked={allSugsSelected} onChange={toggleAllSugs} /></th>
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3">Modificator</th>
                  <th className="px-4 py-3">Grup</th>
                  <th className="px-4 py-3">Produs Sugerat</th>
                  <th className="px-4 py-3">Imagine</th>
                  <th className="px-4 py-3">Potrivire</th>
                  <th className="px-4 py-3 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {suggestions.map((sug, i) => (
                  <tr key={sug.modifier.id} className={`transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${selectedSugs.has(sug.modifier.id) ? 'bg-[#007AFF]/[0.05]' : ''}`}>
                    <td className="px-4 py-3 text-center"><input type="checkbox" className="w-4 h-4 rounded accent-[#007AFF] cursor-pointer" checked={selectedSugs.has(sug.modifier.id)} onChange={() => toggleOneSug(sug.modifier.id)} /></td>
                    <td className="px-4 py-3 text-[13px] text-[#86868B] tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{sug.modifier.name}</div>
                      {sug.modifier.brandId ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <img src={`/brands/${sug.modifier.brandId.toLowerCase()}-logo.png`} alt={sug.modifier.brandId} className="w-4 h-4 rounded-full object-cover border border-black/[0.08] dark:border-white/[0.1]" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                          <small className="hidden text-[11px] text-[#86868B] font-medium uppercase tracking-wider">{sug.modifier.brandId}</small>
                        </div>
                      ) : <small className="text-[#86868B]">—</small>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6E6E73] dark:text-[#98989D]">{sug.modifier.groupName}</td>
                    <td className="px-4 py-3 text-[13px] text-[#6E6E73] dark:text-[#98989D]">{sug.suggestedProduct.name}</td>
                    <td className="px-4 py-3">
                      <img src={sug.suggestedProduct.image} alt="" className="w-11 h-11 object-cover rounded-xl border border-black/[0.06] dark:border-white/[0.08]" onError={e => { e.target.style.display='none'; }} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${sug.confidence >= 70 ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]' : 'bg-[#FF9500]/12 text-[#C93400] dark:text-[#FF9F0A]'}`}>
                        {sug.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button title="Acceptă" onClick={() => acceptSuggestion(sug)} disabled={saving === sug.modifier.id} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-[#007AFF] hover:bg-[#0066D6] text-white transition-colors cursor-pointer">
                          {saving === sug.modifier.id ? '...' : <Check size={14} strokeWidth={2.5} />}
                        </button>
                        <button title="Ignoră" onClick={() => dismissSuggestion(sug.modifier.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] transition-colors cursor-pointer">
                          <X size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="apple-card p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          <button
            onClick={() => { setActiveBrand('ALL'); setPage(1); }}
            className={`shrink-0 px-3.5 h-8 rounded-full text-[12px] font-semibold transition-all cursor-pointer ${
              activeBrand === 'ALL'
                ? 'bg-[#007AFF] text-white'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
            }`}
          >
            Toate
          </button>
          {BRANDS.map(b => {
            const isActive = activeBrand === b.id;
            return (
              <button
                key={b.id}
                onClick={() => { setActiveBrand(b.id); setPage(1); }}
                title={b.label}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 h-8 rounded-full text-[12px] font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
                }`}
              >
                <img src={`/brands/${b.id}-logo.png`} alt={b.label} className="w-5 h-5 rounded-full object-cover bg-white shrink-0" onError={e => { e.target.style.display='none'; }} />
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 md:ml-auto">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1 rounded-xl">
              <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">{selected.size} selectați</span>
              <button className="px-2.5 py-1 rounded-full bg-[#FF3B30]/12 hover:bg-[#FF3B30]/20 text-[#FF3B30] text-[12px] font-semibold transition-colors flex items-center gap-1 cursor-pointer" onClick={bulkDelete}>
                <Trash2 size={13} /> Șterge
              </button>
              <button className="px-2 py-1 rounded-full text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white text-[12px] font-medium transition-colors cursor-pointer" onClick={() => setSelected(new Set())}>Anulează</button>
            </div>
          )}

          <div className="relative min-w-[210px] max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
            <input
              className="apple-input rounded-full w-full pl-9 pr-14 py-1.5 text-[13px]"
              placeholder="Caută modificator..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }}
            />
            {search && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-[#007AFF]/12 text-[#007AFF] text-[11px] font-semibold tabular-nums pointer-events-none">
                {filtered.filter(m => m.imageUrl).length}/{filtered.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Table ───────────────────────────────────────── */}
      {loading ? (
        <div className="apple-card flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-6 h-6 border-2 border-black/10 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
          <span className="text-[#86868B] text-[13px] font-medium">Se încarcă modificatorii...</span>
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider">
                  <th className="px-4 py-3 w-12 text-center"><input type="checkbox" className="w-4 h-4 rounded accent-[#007AFF] cursor-pointer" checked={allPageSelected} onChange={toggleAll} /></th>
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3 w-20">Imagine</th>
                  <th className="px-4 py-3">Modificator</th>
                  <th className="px-4 py-3">Grup</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Preț Extra</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {pageItems.map((mod, i) => (
                  <tr key={mod.id} className={`transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${selected.has(mod.id) ? 'bg-[#007AFF]/[0.05]' : ''}`}>
                    <td className="px-4 py-3 text-center"><input type="checkbox" className="w-4 h-4 rounded accent-[#007AFF] cursor-pointer" checked={selected.has(mod.id)} onChange={() => toggleOne(mod.id)} /></td>
                    <td className="px-4 py-3 text-[13px] text-[#86868B] tabular-nums">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3">
                      {mod.imageUrl
                        ? <img src={mod.imageUrl} alt="" className="w-11 h-11 object-cover rounded-xl border border-black/[0.06] dark:border-white/[0.08]" onError={e => { e.target.style.display='none'; }} />
                        : <div className="w-11 h-11 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-[#86868B]"><ImageIcon size={16} /></div>
                      }
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{mod.name}</td>
                    <td className="px-4 py-3 text-[13px] text-[#6E6E73] dark:text-[#98989D]">{mod.groupName}</td>
                    <td className="px-4 py-3">
                      {mod.brandId ? (
                        <div className="flex items-center gap-2">
                          <img src={`/brands/${mod.brandId.toLowerCase()}-logo.png`} alt={mod.brandId} className="w-6 h-6 rounded-full object-cover border border-black/[0.08] dark:border-white/[0.1] bg-white" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                          <span className="hidden text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">{mod.brandId}</span>
                        </div>
                      ) : <span className="text-[13px] text-[#86868B]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium tabular-nums">
                      {mod.price > 0
                        ? <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">+{mod.price.toFixed(2)} lei</span>
                        : <span className="text-[#86868B]">Inclus</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${mod.imageUrl ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]' : 'bg-[#FF3B30]/10 text-[#FF3B30]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${mod.imageUrl ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`} />
                        {mod.imageUrl ? 'Cu imagine' : 'Fără imagine'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === mod.id ? (
                        <div className="flex items-center justify-end gap-1.5 min-w-[280px]">
                          <input
                            autoFocus
                            value={editUrl}
                            onChange={e => setEditUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveImage(mod.id, mod.name, mod.brandId, editUrl)}
                            placeholder="https://..."
                            className="apple-input flex-1 py-1.5 text-[13px]"
                          />
                          <button title="Salvează" onClick={() => saveImage(mod.id, mod.name, mod.brandId, editUrl)} disabled={saving === mod.id} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-[#007AFF] hover:bg-[#0066D6] text-white transition-colors cursor-pointer">
                            {saving === mod.id ? '...' : <Check size={14} strokeWidth={2.5} />}
                          </button>
                          <button title="Anulează" onClick={() => setEditingId(null)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] transition-colors cursor-pointer">
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button title={mod.imageUrl ? 'Schimbă URL' : 'Adaugă URL'} onClick={() => { setEditingId(mod.id); setEditUrl(mod.imageUrl || ''); }} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer">
                            <Pencil size={13} />
                          </button>
                          {mod.imageUrl && (
                            <button title="Șterge imagine" onClick={() => deleteImage(mod.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] transition-colors cursor-pointer">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-[#86868B] text-[13px] font-medium">Niciun modificator găsit.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#6E6E73] dark:text-[#98989D] font-medium">
          <span className="tabular-nums">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} din {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors cursor-pointer" disabled={page===1} onClick={() => setPage(1)}>«</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors cursor-pointer" disabled={page===1} onClick={() => setPage(p => p-1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k+1)
              .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=2)
              .map((p, idx, arr) => (
                <div key={p} className="flex items-center">
                  {idx>0 && arr[idx-1]!==p-1 && <span className="w-8 text-center text-[#86868B]">…</span>}
                  <button className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold tabular-nums transition-colors cursor-pointer ${p === page ? 'bg-[#007AFF] text-white' : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'}`} onClick={() => setPage(p)}>{p}</button>
                </div>
              ))}
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors cursor-pointer" disabled={page===totalPages} onClick={() => setPage(p => p+1)}>›</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors cursor-pointer" disabled={page===totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-[#1C1C1E] dark:bg-[#2C2C2E] text-white text-[13px] font-medium shadow-2xl border border-white/10 flex items-center gap-2.5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className={`w-2 h-2 rounded-full ${toast.type === 'err' ? 'bg-[#FF3B30]' : 'bg-[#34C759]'}`} />
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
