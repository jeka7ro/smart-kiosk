import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const PAGE_SIZE = 25;

const BRANDS = [
  { id: 'smashme',     label: 'SmashMe',     color: '#ef4444' },
  { id: 'rollmaster', label: 'Roll Master', color: '#3b82f6' },
  { id: 'lovesushi', label: 'Love Sushi', color: '#ec4899' },
  { id: 'pokiwoki', label: 'Poki-Woki', color: '#f97316' },
  { id: 'crunch', label: 'Crunch', color: '#eab308' },
  { id: 'welovesushi', label: 'WeLoveSushi', color: '#f59e0b' },
  { id: 'ikura',       label: 'Ikura',       color: '#10b981' }
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
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
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
      showToast('✅ Imagine salvată!');
      setEditingId(null);
      fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setSaving(null); }
  };

  const deleteImage = async (modId) => {
    const ok = await confirm('Ștergi imaginea?', { icon: '🖼️', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      await fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${modId}`, { method: 'DELETE' });
      showToast('🗑 Șters'); fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = await confirm(`Ștergi imaginile la ${ids.length} modificatori?`, { title: 'Ștergere multiple', icon: '🖼️', okLabel: 'Șterge', danger: true });
    if (!ok) return;
    try {
      await Promise.all(ids.map(id => fetchWithAuth(`${BACKEND}/api/admin/modifier-images/${id}`, { method: 'DELETE' })));
      setSelected(new Set()); showToast(`🗑 ${ids.length} imagini șterse`); fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
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
      showToast(`✅ ${toAccept.length} imagini acceptate!`);
      setSelectedSugs(new Set());
      fetchAll();
    } catch (e) { showToast('❌ ' + e.message, 'err'); }
    finally { setAcceptingAll(false); }
  };
  const acceptAllSugs = () => bulkAcceptSugs(new Set(suggestions.map(s => s.modifier.id)));
  const acceptSelectedSugs = () => bulkAcceptSugs(selectedSugs);

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 animate-in fade-in duration-300">

      {/* ── Sugestii Automate ────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="m-0 text-base font-bold text-slate-900 dark:text-white">✨ Sugestii Automate</h2>
            <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-300">{suggestions.length}</span>
            <div className="ml-auto flex gap-2">
              {selectedSugs.size > 0 && (
                <button className="px-3 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all" onClick={acceptSelectedSugs} disabled={acceptingAll}>
                  {acceptingAll ? '...' : `✓ Acceptă Selectate (${selectedSugs.size})`}
                </button>
              )}
              <button className="px-4 h-8 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all" onClick={acceptAllSugs} disabled={acceptingAll}>
                {acceptingAll ? 'Se procesează...' : `✓ Acceptă Tot (${suggestions.length})`}
              </button>
              <button className="px-3 h-8 rounded-full bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 text-xs font-bold transition-all" onClick={() => setSuggestions([])}>Ignoră Toate</button>
            </div>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-400 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-amber-200 dark:border-amber-900/30 bg-amber-100/50 dark:bg-amber-900/20">
                    <th className="px-4 py-3 w-12 text-center"><input type="checkbox" className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" checked={allSugsSelected} onChange={toggleAllSugs} /></th>
                    <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider w-12">#</th>
                    <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider">Modificator</th>
                    <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider">Grup</th>
                    <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider">Produs Sugerat</th>
                    <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider">Imagine</th>
                    <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider">Potrivire</th>
                    <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200/50 dark:divide-amber-900/20">
                  {suggestions.map((sug, i) => (
                    <tr key={sug.modifier.id} className={`transition-colors hover:bg-amber-100/30 dark:hover:bg-amber-900/30 ${selectedSugs.has(sug.modifier.id) ? 'bg-amber-100/50 dark:bg-amber-900/40' : ''}`}>
                      <td className="px-4 py-3 text-center"><input type="checkbox" className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" checked={selectedSugs.has(sug.modifier.id)} onChange={() => toggleOneSug(sug.modifier.id)} /></td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <strong className="text-sm text-slate-900 dark:text-white block">{sug.modifier.name}</strong>
                        {sug.modifier.brandId ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <img src={`/brands/${sug.modifier.brandId.toLowerCase()}-logo.png`} alt={sug.modifier.brandId} className="w-4 h-4 rounded-full object-cover border border-slate-200 dark:border-slate-700" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                            <small className="hidden text-xs text-slate-500 font-medium uppercase tracking-wider">{sug.modifier.brandId}</small>
                          </div>
                        ) : <small className="text-slate-500">—</small>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{sug.modifier.groupName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{sug.suggestedProduct.name}</td>
                      <td className="px-4 py-3">
                        <img src={sug.suggestedProduct.image} alt="" className="w-12 h-12 object-cover rounded-xl" onError={e => { e.target.style.display='none'; }} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${sug.confidence >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {sug.confidence}%
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button title="Acceptă" onClick={() => acceptSuggestion(sug)} disabled={saving === sug.modifier.id} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors">
                            {saving === sug.modifier.id ? '...' : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </button>
                          <button title="Ignoră" onClick={() => dismissSuggestion(sug.modifier.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <button
            onClick={() => setActiveBrand('ALL')}
            className={`flex-shrink-0 px-4 h-10 rounded-full text-sm font-bold transition-all flex items-center ${activeBrand === 'ALL' ? 'bg-teal-600 text-white border border-teal-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >Toate</button>
          {BRANDS.map(b => {
            const isActive = activeBrand === b.id;
            return (
              <button
                key={b.id}
                onClick={() => { setActiveBrand(b.id); setPage(1); }}
                title={b.label}
                className={`flex-shrink-0 w-10 h-10 rounded-full p-0 flex items-center justify-center overflow-hidden transition-all bg-white shadow-sm hover:scale-105`}
                style={{
                  border: isActive ? `2px solid ${b.color}` : '1px solid var(--tw-prose-th-borders, #e2e8f0)',
                  boxShadow: isActive ? `0 4px 10px ${b.color}40` : '',
                  opacity: isActive ? 1 : 0.6,
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <img src={`/brands/${b.id}-logo.png`} alt={b.label} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
              </button>
            );
          })}
        </div>
        
        <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
          <input 
            className="w-full pl-11 pr-16 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow shadow-sm"
            placeholder="Caută modificator..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }} 
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          {search && (
            <span className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center justify-center bg-blue-600 text-white rounded-full px-3 text-xs font-bold pointer-events-none">
              {filtered.filter(m => m.imageUrl).length}/{filtered.length}
            </span>
          )}
        </div>
        
        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 animate-in slide-in-from-right-4">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{selected.size} selectați</span>
            <button className="px-4 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-500 text-sm font-bold transition-colors" onClick={bulkDelete}>🗑 Șterge imagini ({selected.size})</button>
            <button className="px-4 py-1.5 rounded-full bg-transparent hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-bold transition-colors" onClick={() => setSelected(new Set())}>Deselectează</button>
          </div>
        )}
      </div>

      {/* ── Main Table ───────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm font-medium">Se încarcă modificatorii...</span>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 w-12 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={allPageSelected} onChange={toggleAll} /></th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">Imagine</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Modificator</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Grup</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Brand</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Preț Extra</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pageItems.map((mod, i) => (
                  <tr key={mod.id} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected.has(mod.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <td className="px-4 py-3 text-center"><input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={selected.has(mod.id)} onChange={() => toggleOne(mod.id)} /></td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-medium">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3">
                      {mod.imageUrl
                        ? <img src={mod.imageUrl} alt="" className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" onError={e => { e.target.style.display='none'; }} />
                        : <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-medium text-lg border border-slate-200 dark:border-slate-700">?</div>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">{mod.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{mod.groupName}</td>
                    <td className="px-4 py-3">
                      {mod.brandId ? (
                        <div className="flex items-center gap-2">
                          <img src={`/brands/${mod.brandId.toLowerCase()}-logo.png`} alt={mod.brandId} className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                          <span className="hidden text-xs font-bold text-slate-500 uppercase tracking-wider">{mod.brandId}</span>
                        </div>
                      ) : <span className="text-sm text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {mod.price > 0
                        ? <span className="text-red-600 dark:text-red-400">+{mod.price.toFixed(2)} lei</span>
                        : <span className="text-slate-500">Inclus</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${mod.imageUrl ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
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
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                          <button title="OK" onClick={() => saveImage(mod.id, mod.name, mod.brandId, editUrl)} disabled={saving === mod.id} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-colors">
                            {saving === mod.id ? '...' : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </button>
                          <button title="✕" onClick={() => setEditingId(null)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button title={mod.imageUrl ? 'Schimbă' : '+ URL'} onClick={() => { setEditingId(mod.id); setEditUrl(mod.imageUrl || ''); }} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </button>
                          {mod.imageUrl && (
                            <button title="Șterge" onClick={() => deleteImage(mod.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-500 border border-red-100 dark:border-red-900/50 transition-colors shadow-sm">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-500 font-medium">Niciun modificator găsit.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
          <span>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} din {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page===1} onClick={() => setPage(1)}>«</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page===1} onClick={() => setPage(p => p-1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k+1)
              .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=2)
              .map((p, idx, arr) => (
                <div key={p} className="flex items-center">
                  {idx>0 && arr[idx-1]!==p-1 && <span className="w-8 text-center text-slate-400">…</span>}
                  <button className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold transition-colors ${p === page ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} onClick={() => setPage(p)}>{p}</button>
                </div>
              ))}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page===totalPages} onClick={() => setPage(p => p+1)}>›</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors" disabled={page===totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-2xl text-sm font-bold shadow-xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 ${toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
