import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';

const LANGUAGES = ['en', 'fr', 'hu', 'ru', 'bg', 'de', 'es', 'uk'];

const BRAND_LOGOS = {
  smashme: '/brands/smashme-logo.png',
  welovesushi: '/brands/welovesushi-logo.png',
  ikura: '/brands/ikura-logo.png',
  sushimaster: '/brands/sushimaster-logo.png'
};

const BRAND_META = {
  smashme:     { name: 'SmashMe',      color: '#ef4444' },
  rollmaster: { name: 'Roll Master', color: '#3b82f6' }, lovesushi: { name: 'Love Sushi', color: '#ec4899' }, pokiwoki: { name: 'Poki-Woki', color: '#f97316' }, crunch: { name: 'Crunch', color: '#eab308' },
  welovesushi: { name: 'WeLoveSushi',  color: '#f97316' },
  ikura:       { name: 'Ikura',        color: '#1e293b' },
};

export default function TranslationsScreen({ backend }) {
  const { fetchWithAuth } = useAuth();
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [editData, setEditData] = useState({});

  // Table state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [activeBrands, setActiveBrands] = useState(new Set()); // empty = all

  const toggleBrand = (bLower) => {
    setActiveBrands(prev => {
      const next = new Set(prev);
      if (next.has(bLower)) next.delete(bLower);
      else next.add(bLower);
      return next;
    });
    setPage(1);
  };

  useEffect(() => {
    fetchTranslations();
  }, [backend, fetchWithAuth]);

  const fetchTranslations = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetchWithAuth(`${backend}/api/admin/translations/`, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      setTranslations(data || {});
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessage({ type: 'error', text: 'Server-ul nu răspunde (posibil adormit pe Render). Apasă Refresh peste 30 secunde.' });
      } else {
        setMessage({ type: 'error', text: 'Eroare la încărcarea traducerilor.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const confirm = useConfirm();

  const handleForceTranslate = async () => {
    const ok = await confirm('Va dura câteva minute în fundal.', { title: 'Auto-Traducere', icon: '🌐', okLabel: 'Pornește', danger: false });
    if (!ok) return;
    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`${backend}/api/admin/translations/auto-translate`, { method: 'POST' });
      const data = await res.json();
      setMessage({ type: 'success', text: data.message || 'Job-ul de traducere a fost inițiat.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Eroare la inițierea traducerii.' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditor = (productId, item) => {
    setExpandedId(productId);
    setEditData({ ...item.translations });
  };

  const handleSave = async (productId) => {
    try {
      setSubmitting(true);
      setMessage(null);
      const payload = { productId, translations: editData };
      await fetchWithAuth(`${backend}/api/admin/translations/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setMessage({ type: 'success', text: 'Traducerea a fost salvată cu succes!' });
      setTranslations(prev => ({
        ...prev,
        [productId]: { ...prev[productId], translations: { ...prev[productId].translations, ...editData } }
      }));
      setExpandedId(null);
    } catch (err) {
      setMessage({ type: 'error', text: 'Eroare la salvare. Reîncearcă.' });
    } finally {
      setSubmitting(false);
    }
  };

  const productsArray = useMemo(() =>
    Object.entries(translations).map(([id, data]) => ({ id, ...data })),
  [translations]);

  const availableBrands = useMemo(() => {
    const set = new Set(productsArray.map(p => p.brandId).filter(Boolean));
    return Array.from(set).sort();
  }, [productsArray]);

  const filteredProducts = useMemo(() =>
    productsArray.filter(p => {
      if (activeBrands.size > 0 && !activeBrands.has((p.brandId || '').toLowerCase())) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(p.name || '').toLowerCase().includes(q) && !(p.originalDescription || '').toLowerCase().includes(q)) return false;
      }
      return true;
    }),
  [productsArray, activeBrands, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const pageProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <span className="text-slate-500 text-sm font-medium">Încărcare dicționar... (poate dura 30s dacă serverul a adormit)</span>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Subtitle + action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-slate-500 text-sm m-0">
          Ajustează descrierile produselor pe limbi disponibile.
        </p>
        <div className="flex gap-2">
          <button className="px-4 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors disabled:opacity-50" onClick={fetchTranslations} disabled={submitting}>Refresh</button>
          <button className="px-4 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50" onClick={handleForceTranslate} disabled={submitting}>Auto-Traducere</button>
        </div>
      </div>

      {/* Brand filter pills + search */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Toate */}
        <button
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeBrands.size === 0 ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          onClick={() => { setActiveBrands(new Set()); setPage(1); }}
        >
          Toate ({productsArray.length})
        </button>

        {/* Brand pills */}
        {availableBrands.map(b => {
          const bLower = b.toLowerCase();
          const meta = BRAND_META[bLower] || { name: b, color: '#6b7a99' };
          const isActive = activeBrands.has(bLower);
          const count = productsArray.filter(p => (p.brandId || '').toLowerCase() === bLower).length;
          return (
            <button
              key={b}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${isActive ? 'text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              style={isActive ? { backgroundColor: meta.color } : {}}
              onClick={() => toggleBrand(bLower)}
            >
              {BRAND_LOGOS[bLower] && (
                <img
                  src={BRAND_LOGOS[bLower]}
                  alt={b}
                  className="w-4 h-4 rounded-full object-cover shrink-0 bg-white"
                />
              )}
              {meta.name} ({count})
            </button>
          );
        })}

        {/* Search pushed right */}
        <div className="ml-auto relative min-w-[220px] max-w-[320px] flex-1">
          <input
            type="text"
            placeholder="Caută produs sau ingredient..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-4 pr-16 py-2 border border-slate-200 dark:border-slate-700 rounded-full text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
          />
          {search && (
            <span className="absolute right-1 top-1 bottom-1 flex items-center justify-center bg-blue-600 text-white rounded-full px-3 text-xs font-bold pointer-events-none">
              {filteredProducts.length}/{productsArray.length}
            </span>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border font-medium ${message.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'}`}>
          {message.text}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">DENUMIRE PRODUS</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-32">BRAND</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">STARE TRADUCERI</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">ACȚIUNI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-medium">
                    Nu au fost găsite produse cu aceste filtre.
                  </td>
                </tr>
              ) : (
                pageProducts.map((item, index) => {
                  const pid = item.id;
                  const isExpanded = expandedId === pid;
                  const missingLangs = LANGUAGES.filter(l => !item.translations[l]).length;
                  const brandLower = (item.brandId || '').toLowerCase();
                  const logoSrc = BRAND_LOGOS[brandLower];

                  return (
                    <React.Fragment key={pid}>
                      <tr className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isExpanded ? 'bg-blue-50 dark:bg-slate-800' : ''}`}>
                        <td className="px-4 py-3 text-sm text-slate-500 font-medium">
                          {(page - 1) * pageSize + index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                          {item.name || 'Produs Necunoscut'}
                        </td>
                        <td className="px-4 py-3">
                          {logoSrc
                            ? <img src={logoSrc} alt={item.brandId} className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-white" />
                            : <span className="text-xs font-bold text-slate-500">{(item.brandId || 'NEDEFINIT').toUpperCase()}</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {missingLangs === 0
                            ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">Tradus Complet</span>
                            : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">Lipsesc {missingLangs} limbi</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button title={isExpanded ? 'Închide Editor' : 'Editează Limbi'}
                            onClick={() => isExpanded ? setExpandedId(null) : openEditor(pid, item)}
                            className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${isExpanded ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {isExpanded 
                              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            }
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                          <td colSpan="5" className="p-6">
                            <div className="flex flex-col xl:flex-row gap-6">
                              <div className="xl:w-1/3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-fit">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descriere Originală (Syrve):</label>
                                <p className="text-sm text-slate-900 dark:text-white m-0 leading-relaxed">{item.originalDescription || <em className="text-slate-400">Fără descriere la bază.</em>}</p>
                              </div>
                              <div className="xl:w-2/3 flex-1 flex flex-col gap-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {LANGUAGES.map(lang => (
                                    <div key={lang} className="flex flex-col gap-1.5">
                                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                        <img
                                          src={`https://flagsapi.com/${lang === 'en' ? 'GB' : lang === 'uk' ? 'UA' : lang.toUpperCase()}/flat/24.png`}
                                          alt={lang}
                                          className="w-5 h-5 rounded-sm object-cover"
                                        />
                                        {lang}
                                      </label>
                                      <textarea
                                        value={editData[lang] || ''}
                                        onChange={e => setEditData({ ...editData, [lang]: e.target.value })}
                                        placeholder={`Traducerea în ${lang}...`}
                                        rows={3}
                                        className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow resize-none"
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-3 mt-2">
                                  <button title="Anulează" onClick={() => setExpandedId(null)} className="px-5 h-10 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors">
                                    Anulează
                                  </button>
                                  <button title="Salvează" onClick={() => handleSave(pid)} disabled={submitting} className="px-6 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center min-w-[100px]">
                                    {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Salvează'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-3">
          <span>Rânduri pe pagină:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="font-medium text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700 pl-3 ml-1">
            {filteredProducts.length > 0
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredProducts.length)} din ${filteredProducts.length}`
              : '0 rezultate'}
          </span>
        </div>
        
        {totalPages > 1 && (
          <div className="flex gap-1.5">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <React.Fragment key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-2 py-1 text-slate-400">…</span>}
                  <button
                    className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg border font-bold transition-colors ${p === page ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        )}
      </div>

    </div>
  );
}
