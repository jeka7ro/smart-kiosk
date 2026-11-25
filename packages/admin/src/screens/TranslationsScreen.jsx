import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal';
import { RefreshCw, Sparkles, Search, Pencil, X } from 'lucide-react';

const LANGUAGES = ['en', 'fr', 'hu', 'ru', 'bg', 'de', 'es', 'uk'];

const BRAND_LOGOS = {
  smashme: '/brands/smashme-logo.png',
  crunch: '/brands/crunch-logo.png',
  rollmaster: '/brands/rollmaster-logo.png',
  lovesushi: '/brands/lovesushi-logo.png',
  pokiwoki: '/brands/pokiwoki-logo.png',
  welovesushi: '/brands/welovesushi-logo.png'
};

const BRAND_META = {
  smashme:     { name: 'SmashMe',      color: '#ef4444' },
  crunch:      { name: 'Crunch',       color: '#d97706' },
  rollmaster:  { name: 'Roll Master',  color: '#dc2626' },
  lovesushi:   { name: 'Love Sushi',   color: '#f97316' },
  pokiwoki:    { name: 'Poki-Woki',    color: '#65a30d' },
  welovesushi: { name: 'WeLoveSushi',  color: '#f97316' }
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
    const ok = await confirm('Va dura câteva minute în fundal.', { title: 'Auto-Traducere', icon: '', okLabel: 'Pornește', danger: false });
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
    <div className="apple-card flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-6 h-6 border-2 border-black/10 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
      <span className="text-[#86868B] text-[13px] font-medium">Încărcare dicționar...</span>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Subtitle + action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[#6E6E73] dark:text-[#98989D] text-[13px] m-0">
          Ajustează descrierile produselor pentru toate limbile disponibile pe kiosk.
        </p>
        <div className="flex items-center gap-2">
          <button className="apple-btn-secondary text-[13px] px-3.5 py-2" onClick={fetchTranslations} disabled={submitting}>
            <RefreshCw size={14} /> Reîncarcă
          </button>
          <button className="apple-btn-primary text-[13px] px-4 py-2" onClick={handleForceTranslate} disabled={submitting}>
            <Sparkles size={14} /> Auto-Traducere
          </button>
        </div>
      </div>

      {/* Brand filter pills + search */}
      <div className="apple-card p-3 flex flex-wrap items-center gap-2">
        <button
          className={`px-3.5 h-8 rounded-full text-[12px] font-semibold transition-all cursor-pointer tabular-nums ${
            activeBrands.size === 0
              ? 'bg-[#007AFF] text-white'
              : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
          }`}
          onClick={() => { setActiveBrands(new Set()); setPage(1); }}
        >
          Toate ({productsArray.length})
        </button>

        {availableBrands.map(b => {
          const bLower = b.toLowerCase();
          const meta = BRAND_META[bLower] || { name: b, color: '#007AFF' };
          const isActive = activeBrands.has(bLower);
          const count = productsArray.filter(p => (p.brandId || '').toLowerCase() === bLower).length;
          return (
            <button
              key={b}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-semibold transition-all cursor-pointer tabular-nums ${
                isActive
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
              }`}
              onClick={() => toggleBrand(bLower)}
            >
              {BRAND_LOGOS[bLower] && (
                <img
                  src={BRAND_LOGOS[bLower]}
                  alt={b}
                  className="w-4 h-4 rounded-full object-cover shrink-0 bg-white"
                />
              )}
              <span>{meta.name}</span>
              <span className={isActive ? 'text-white/80' : 'text-[#86868B]'}>({count})</span>
            </button>
          );
        })}

        <div className="ml-auto relative min-w-[220px] max-w-[300px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
          <input
            type="text"
            placeholder="Caută produs sau ingredient..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="apple-input rounded-full w-full pl-9 pr-14 py-1.5 text-[13px]"
          />
          {search && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-[#007AFF]/12 text-[#007AFF] text-[11px] font-semibold tabular-nums pointer-events-none">
              {filteredProducts.length}/{productsArray.length}
            </span>
          )}
        </div>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl border text-[13px] font-medium flex items-center justify-between gap-3 ${
          message.type === 'error'
            ? 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20'
            : 'bg-[#34C759]/10 text-[#248A3D] dark:text-[#30D158] border-[#34C759]/20'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100 cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* Table */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Denumire Produs</th>
                <th className="px-4 py-3 w-32">Brand</th>
                <th className="px-4 py-3">Stare Traduceri</th>
                <th className="px-4 py-3 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[#86868B] text-[13px] font-medium">
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
                      <tr className={`transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${isExpanded ? 'bg-[#007AFF]/[0.04]' : ''}`}>
                        <td className="px-4 py-3 text-[13px] text-[#86868B] tabular-nums">
                          {(page - 1) * pageSize + index + 1}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {item.name || 'Produs Necunoscut'}
                        </td>
                        <td className="px-4 py-3">
                          {logoSrc
                            ? <img src={logoSrc} alt={item.brandId} className="w-6 h-6 rounded-full object-cover border border-black/[0.08] dark:border-white/[0.1] bg-white" />
                            : <span className="text-[11px] font-semibold text-[#86868B]">{(item.brandId || 'NEDEFINIT').toUpperCase()}</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {missingLangs === 0
                            ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]"><span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />Tradus complet</span>
                            : <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/12 text-[#C93400] dark:text-[#FF9F0A] tabular-nums"><span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />Lipsesc {missingLangs} limbi</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            title={isExpanded ? 'Închide editor' : 'Editează limbi'}
                            onClick={() => isExpanded ? setExpandedId(null) : openEditor(pid, item)}
                            className={isExpanded ? 'apple-close-btn' : 'w-8 h-8 inline-flex items-center justify-center rounded-lg bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer'}
                          >
                            {isExpanded ? <X size={14} /> : <Pencil size={14} />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#F5F5F7]/70 dark:bg-white/[0.02] border-b border-black/[0.06] dark:border-white/[0.08]">
                          <td colSpan="5" className="p-5">
                            <div className="flex flex-col xl:flex-row gap-5">
                              <div className="xl:w-1/3 apple-inset-group p-4 h-fit">
                                <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Descriere Originală (Syrve)</div>
                                <p className="text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] m-0 leading-relaxed">{item.originalDescription || <em className="text-[#86868B]">Fără descriere la bază.</em>}</p>
                              </div>
                              <div className="xl:w-2/3 flex-1 flex flex-col gap-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                  {LANGUAGES.map(lang => (
                                    <div key={lang} className="flex flex-col gap-1.5">
                                      <label className="flex items-center gap-2 text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider">
                                        <img
                                          src={`https://flagsapi.com/${lang === 'en' ? 'GB' : lang === 'uk' ? 'UA' : lang.toUpperCase()}/flat/24.png`}
                                          alt={lang}
                                          className="w-4 h-4 rounded-sm object-cover"
                                        />
                                        {lang}
                                      </label>
                                      <textarea
                                        value={editData[lang] || ''}
                                        onChange={e => setEditData({ ...editData, [lang]: e.target.value })}
                                        placeholder={`Traducerea în ${lang}...`}
                                        rows={3}
                                        className="apple-input w-full text-[13px] resize-y leading-relaxed"
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2.5 pt-1">
                                  <button onClick={() => setExpandedId(null)} className="apple-btn-secondary text-[13px] px-4 py-2">
                                    Anulează
                                  </button>
                                  <button onClick={() => handleSave(pid)} disabled={submitting} className="apple-btn-primary text-[13px] px-5 py-2 min-w-[100px]">
                                    {submitting ? 'Se salvează...' : 'Salvează'}
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#6E6E73] dark:text-[#98989D]">
        <div className="flex items-center gap-2.5">
          <span>Rânduri pe pagină</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="apple-input py-1 px-2.5 text-[13px] font-medium cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] border-l border-black/[0.08] dark:border-white/[0.1] pl-3 ml-1 tabular-nums">
            {filteredProducts.length > 0
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredProducts.length)} din ${filteredProducts.length}`
              : '0 rezultate'}
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer transition-colors" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer transition-colors" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, k) => k + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <React.Fragment key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1.5 text-[#86868B]">…</span>}
                  <button
                    className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-full font-semibold tabular-nums cursor-pointer transition-colors ${p === page ? 'bg-[#007AFF] text-white' : 'bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.08]'}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))}
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer transition-colors" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer transition-colors" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        )}
      </div>

    </div>
  );
}
