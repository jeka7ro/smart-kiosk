import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { QRCodeCanvas } from 'qrcode.react';
import BrandLogo from '../components/BrandLogo';
import { Search, QrCode, Smartphone, ArrowLeft, Download, Trash2, Check, ExternalLink } from 'lucide-react';

const QR_WEB_BASE = 'https://qr-restaurants.netlify.app';

const BRANDS = [
  { id: 'smashme',     name: 'SmashMe',       color: '#ef4444' },
  { id: 'rollmaster',  name: 'Roll Master',   color: '#e31e24' },
  { id: 'lovesushi',   name: 'Love Sushi',    color: '#ec4899' },
  { id: 'pokiwoki',    name: 'Poki-Woki',     color: '#f97316' },
  { id: 'crunch',      name: 'Crunch',        color: '#eab308' },
  { id: 'welovesushi', name: 'We Love Sushi',  color: '#8b5cf6' },
];

const BRAND_LOGOS = {
  smashme: '/brands/smashme-logo.png',
  crunch: '/brands/crunch-logo.png',
  rollmaster: '/brands/rollmaster-logo.png',
  lovesushi: '/brands/lovesushi-logo.png',
  welovesushi: '/brands/welovesushi-logo.png',
  pokiwoki: '/brands/pokiwoki-logo.png',
};

function getBrandLogoUrl(brandId) {
  let key = (brandId || '').toLowerCase().replace(/[\s\-_]+/g, '');
  if (key === 'sushimaster' || key === 'ikura') key = 'rollmaster';
  const matchedKey = Object.keys(BRAND_LOGOS).find(k => key.includes(k) || k.includes(key));
  return matchedKey ? BRAND_LOGOS[matchedKey] : '/brands/smashme-logo.png';
}

function renderPreview(url) {
  if (!url) return null;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url))
    return <video src={url} autoPlay muted loop playsInline className="w-full h-full object-cover" />;
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url))
    return <img src={url} alt="Preview" className="w-full h-full object-cover" />;
  return <iframe src={url} title="Preview" className="w-full h-full border-none" />;
}

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer m-0">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
    </label>
  );
}

/* ═══════════════════════════════════════════════════════
   LOCATION LIST — TABEL BUSINESS CU FILTRE ȘI PAGINARE
═══════════════════════════════════════════════════════ */
function LocationList({ locations, onSelect }) {
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Descoperă toate brandurile unice din locații
  const allBrandsInLocs = useMemo(() => {
    const s = new Set();
    locations.forEach(l => {
      if (Array.isArray(l.brands)) l.brands.forEach(b => s.add(b));
      else if (l.brandId) s.add(l.brandId);
    });
    return Array.from(s);
  }, [locations]);

  // Filtrare locații
  const filtered = useMemo(() => {
    return locations.filter(l => {
      // Filtru Brand
      if (brandFilter !== 'all') {
        const brands = Array.isArray(l.brands) ? l.brands : (l.brandId ? [l.brandId] : []);
        if (!brands.includes(brandFilter)) return false;
      }
      // Filtru Căutare
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = l.name?.toLowerCase().includes(q);
        const matchId = l.id?.toLowerCase().includes(q);
        const matchUrl = l.kioskUrl?.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchUrl) return false;
      }
      return true;
    });
  }, [locations, brandFilter, search]);

  // Sortare: locațiile cu QR-uri configurate primele, apoi alfabetic
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aQr = Object.values(a.data?.qrConfig || {}).reduce((s, v) => s + v, 0);
      const bQr = Object.values(b.data?.qrConfig || {}).reduce((s, v) => s + v, 0);
      if ((aQr > 0) !== (bQr > 0)) {
        return aQr > 0 ? -1 : 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [filtered]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalQrCountAll = useMemo(() => {
    return locations.reduce((sum, l) => {
      return sum + Object.values(l.data?.qrConfig || {}).reduce((s, v) => s + v, 0);
    }, 0);
  }, [locations]);

  const mobileConfiguredCount = useMemo(() => {
    return locations.filter(l => 
      !!(l.data?.mobileConfig?.topBannerUrl || l.data?.mobileConfig?.posterUrl || l.data?.mobileConfig?.bottomBannerUrl)
    ).length;
  }, [locations]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & KPI Sumar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Coduri QR & Portal Mobil
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Total: {locations.length} locații
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm leading-relaxed">
            Generează coduri QR pentru mese și configurează portalul mobil (screensaver, promoții) pentru comanda clienților de pe telefon.
          </p>
        </div>

        {/* KPI Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
            <QrCode className="w-3.5 h-3.5" />
            <span>{totalQrCountAll} QR-uri active</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-400 text-xs font-bold flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5" />
            <span>{mobileConfiguredCount} portaluri mobile</span>
          </div>
        </div>
      </div>

      {/* Bară Filtre Branduri & Căutare */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Butoane Branduri */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
          <button
            className={`shrink-0 px-4 h-10 rounded-full text-sm font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              brandFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm border-slate-900 dark:border-white'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            onClick={() => { setBrandFilter('all'); setCurrentPage(1); }}
          >
            Toate ({locations.length})
          </button>

          {allBrandsInLocs.map(bid => {
            const count = locations.filter(l => (l.brands && l.brands.includes(bid)) || l.brandId === bid).length;
            const brandInfo = BRANDS.find(b => b.id === bid);
            const name = brandInfo?.name || bid;
            const isSelected = brandFilter === bid;

            return (
              <button
                key={bid}
                className={`shrink-0 px-4 h-10 rounded-full text-sm font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                onClick={() => { setBrandFilter(bid); setCurrentPage(1); }}
              >
                <BrandLogo brandId={bid} size={16} />
                <span>{name}</span>
                <span className="text-xs text-slate-400">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Căutare */}
        <div className="relative min-w-[240px] max-w-xs shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            className="w-full h-10 pl-10 pr-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
            placeholder="Caută locație..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {search && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full px-2 py-0.5 text-[11px] font-bold">
              {filtered.length} / {locations.length}
            </div>
          )}
        </div>
      </div>

      {/* Tabel Business */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center w-[60px]">#</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 min-w-[220px]">Denumire & ID</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Branduri Active</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Statistici (Mese & QR)</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Portal Mobil</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.map((loc, index) => {
                const totalQr = Object.values(loc.data?.qrConfig || {}).reduce((s, v) => s + v, 0);
                const hasMob = !!(loc.data?.mobileConfig?.topBannerUrl || loc.data?.mobileConfig?.posterUrl || loc.data?.mobileConfig?.bottomBannerUrl);
                const brandsArr = loc.brands && loc.brands.length > 0 ? loc.brands : (loc.brandId ? [loc.brandId] : []);
                const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;

                return (
                  <tr
                    key={loc.id}
                    onClick={() => onSelect(loc)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* Nr. Crt. */}
                    <td className="px-6 py-4 text-sm font-bold text-slate-400 dark:text-slate-500 text-center whitespace-nowrap">
                      {rowNumber}
                    </td>

                    {/* Denumire & ID (max 2 rânduri) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${totalQr > 0 ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-slate-300 dark:bg-slate-600'}`} />
                          <span className="font-semibold text-slate-900 dark:text-white text-sm whitespace-nowrap">{loc.name}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 leading-none">
                          ID: {loc.id}
                        </span>
                      </div>
                    </td>

                    {/* Branduri Active */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {brandsArr.length > 0 ? (
                          brandsArr.map(b => (
                            <div key={b} title={b} className="shrink-0">
                              <BrandLogo brandId={b} size={22} />
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 font-normal">Nespecificat</span>
                        )}
                      </div>
                    </td>

                    {/* Statistici (Mese & QR) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Mese: {loc.tables || 10}
                        </span>
                        {totalQr > 0 ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            {totalQr} QR-uri
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-400 border border-slate-200 dark:border-slate-700">
                            0 QR
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Portal Mobil */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {hasMob ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
                          <Smartphone className="w-3 h-3" />
                          Configurat
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                          Standard
                        </span>
                      )}
                    </td>

                    {/* Acțiuni */}
                    <td className="px-6 py-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelect(loc)}
                          title="Configurează codurile QR și portalul mobil"
                          className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer group-hover:scale-[1.02]"
                        >
                          <span>Configurare</span>
                          <span className="text-xs">→</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {sorted.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
            Nu există nicio locație care să corespundă filtrelor selectate.
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rânduri pe pagină:</span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-xs font-medium text-slate-500 ml-2">
              {sorted.length === 0 ? '0' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(sorted.length, currentPage * itemsPerPage)}`} din {sorted.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {[
              { label: '«', action: () => setCurrentPage(1),            disabled: currentPage === 1,          title: 'Prima pagină' },
              { label: '‹', action: () => setCurrentPage(p => p - 1),  disabled: currentPage === 1,          title: 'Anterioară' },
              { label: '›', action: () => setCurrentPage(p => p + 1),  disabled: currentPage === totalPages, title: 'Următoarea' },
              { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages, title: 'Ultima pagină' },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={btn.action}
                disabled={btn.disabled}
                title={btn.title}
                className={`w-8 h-8 rounded-full border text-sm font-bold flex items-center justify-center transition-colors ${
                  btn.disabled
                    ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   LOCATION FORM — full page, identical to KioskSettingsForm
═══════════════════════════════════════════════════════ */
function LocationQrForm({ loc, backend, onBack, onRefresh }) {
  const { fetchWithAuth } = useAuth();

  // Only show brands configured for this location (like Kiosk)
  const availableBrands = loc.brands?.length
    ? BRANDS.filter(b => loc.brands.includes(b.id))
    : BRANDS;

  const [brandId, setBrandId]     = useState(() => {
    const first = loc.brands?.find(id => BRANDS.some(b => b.id === id));
    return first || 'smashme';
  });
  const [tableCount, setTableCount] = useState(10);
  const [savingQr, setSavingQr]   = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeTab, setActiveTab] = useState('qr');

  // mobile settings
  const mc = loc.data?.mobileConfig || {};
  const [mob, setMob] = useState({
    posterUrl:              mc.posterUrl              || '',
    inactivityTimeout:      mc.inactivityTimeout      || 30,
    topBannerUrl:           mc.topBannerUrl           || '',
    topBannerHeight:        mc.topBannerHeight        || 3,
    topBannerRadiusTop:     mc.topBannerRadiusTop     !== undefined ? mc.topBannerRadiusTop    : true,
    topBannerRadiusBottom:  mc.topBannerRadiusBottom  !== undefined ? mc.topBannerRadiusBottom : false,
    bottomBannerUrl:        mc.bottomBannerUrl        || '',
    bottomBannerText:       mc.bottomBannerText       || '',
    bottomBannerHeight:     mc.bottomBannerHeight     || 2,
    bottomBannerRadiusTop:  mc.bottomBannerRadiusTop  !== undefined ? mc.bottomBannerRadiusTop  : false,
    bottomBannerRadiusBottom: mc.bottomBannerRadiusBottom !== undefined ? mc.bottomBannerRadiusBottom : true,
    bottomBannerTextFixed:  mc.bottomBannerTextFixed  || false,
    bottomBannerTextAlign:  mc.bottomBannerTextAlign  || 'center',
    bottomBannerBg:         mc.bottomBannerBg         || '#1e293b',
  });
  const [useBanner,       setUseBanner]       = useState(!!mc.topBannerUrl);
  const [useBottomBanner, setUseBottomBanner] = useState(!!(mc.bottomBannerUrl || mc.bottomBannerText));
  const [savingMob, setSavingMob] = useState(false);
  const [mobSaved,  setMobSaved]  = useState(false);

  const savedCount = loc.data?.qrConfig?.[brandId] || 0;

  useEffect(() => {
    if (savedCount > 0) setTableCount(savedCount);
    else setTableCount(10);
  }, [brandId, savedCount]);

  const hm = (key, val) => setMob(p => ({ ...p, [key]: val }));

  /* ── QR actions ── */
  const handleGenerate = async () => {
    setSavingQr(true);
    try {
      const updatedData = { ...loc.data, qrConfig: { ...(loc.data?.qrConfig || {}), [brandId]: tableCount } };
      await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...loc, data: updatedData }),
      });
      onRefresh();
    } catch (e) { console.error(e); }
    setSavingQr(false);
  };

  const handleDeleteQr = async () => {
    setSavingQr(true); setConfirmClear(false);
    try {
      const qrConfig = { ...(loc.data?.qrConfig || {}) };
      delete qrConfig[brandId];
      const updatedData = { ...loc.data, qrConfig };
      await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...loc, data: updatedData }),
      });
      onRefresh();
    } catch (e) {}
    setSavingQr(false);
  };

  const selectedBrand = BRANDS.find(b => b.id === brandId) || BRANDS[0];
  const downloadQr = (n) => {
    const canvas = document.getElementById(`qr-canvas-${n}`);
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${brandId}-${loc.id}-masa-${n}.png`;
    a.click();
  };
  const downloadAll = () => { for (let i = 1; i <= savedCount; i++) setTimeout(() => downloadQr(i), i * 200); };

  const saveMobileSettings = async () => {
    setSavingMob(true);
    const mobileConfig = { ...mob };
    if (!useBanner)       { mobileConfig.topBannerUrl = ''; }
    if (!useBottomBanner) { mobileConfig.bottomBannerUrl = ''; mobileConfig.bottomBannerText = ''; }
    const updatedData = { ...loc.data, mobileConfig };
    try {
      await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...loc, data: updatedData }),
      });
      setMobSaved(true); setTimeout(() => setMobSaved(false), 3000);
      onRefresh();
    } catch (e) { console.error(e); }
    setSavingMob(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button onClick={onBack}
          className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-sm cursor-pointer flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
          <ArrowLeft className="w-4 h-4" />
          <span>Înapoi</span>
        </button>
        <div className="flex-1">
          <h1 className="m-0 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {loc.name}
          </h1>
          <p className="m-0 mt-1 text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded font-medium">ID: {loc.id}</p>
        </div>
        {activeTab === 'settings' && (
          <button onClick={saveMobileSettings} disabled={savingMob}
            className={`px-6 py-2.5 rounded-full border-none cursor-pointer font-bold text-sm transition-all shadow-sm ${mobSaved ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700'}`}>
            {mobSaved ? '✓ Salvat!' : savingMob ? 'Se salvează...' : 'Salvează Setările Mobile'}
          </button>
        )}
        {activeTab === 'qr' && savedCount > 0 && (
          <div className="flex gap-2">
            <button className="px-5 h-10 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold border border-slate-200 dark:border-slate-800 transition-colors shadow-sm" onClick={downloadAll}>Descarcă toate</button>
            {!confirmClear
              ? <button className="px-5 h-10 rounded-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm font-bold border border-red-100 dark:border-red-900/50 transition-colors shadow-sm" onClick={() => setConfirmClear(true)}>Șterge QR-urile</button>
              : <div className="flex gap-2 items-center bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-full px-4 py-1.5 text-sm font-bold animate-in slide-in-from-right-4">
                  <span className="text-red-600 dark:text-red-400">Sigur?</span>
                  <button className="px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors" onClick={handleDeleteQr} disabled={savingQr}>Da</button>
                  <button className="px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold transition-colors" onClick={() => setConfirmClear(false)}>Nu</button>
                </div>
            }
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-800 mb-8">
        {[['qr','Coduri QR'],['settings','Setări Mobile']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 border-none cursor-pointer font-bold text-sm transition-all bg-transparent -mb-[1px] border-b-2 ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ QR TAB ══════════════════════════════════ */}
      {activeTab === 'qr' && (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-8">
            <div className="flex flex-wrap gap-6 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Brand</label>
                <div className="flex flex-wrap gap-2">
                  {availableBrands.map(b => (
                    <button key={b.id} onClick={() => setBrandId(b.id)}
                      className="px-4 py-2 rounded-full text-sm font-bold cursor-pointer transition-all flex items-center gap-2"
                      style={{
                        border: `1.5px solid ${brandId === b.id ? b.color : 'var(--tw-prose-th-borders, #e2e8f0)'}`,
                        background: brandId === b.id ? b.color : 'transparent',
                        color: brandId === b.id ? '#fff' : 'inherit'
                      }}>
                      <BrandLogo brandId={b.id} size={18} />
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Nr. mese</label>
                <input type="number" min="1" max="200" value={tableCount}
                  onChange={e => setTableCount(parseInt(e.target.value) || 1)}
                  className="w-24 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div className="ml-auto">
                <button className="px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-sm hover:brightness-110 transition-all cursor-pointer" onClick={handleGenerate} disabled={savingQr}
                  style={{ background: selectedBrand.color }}>
                  {savingQr ? 'Se salvează...' : savedCount > 0 ? `Actualizează (${tableCount} mese)` : `Generează ${tableCount} QR-uri`}
                </button>
              </div>
            </div>
          </div>

          {savedCount > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: savedCount }).map((_, i) => {
                const n = i + 1;
                const qrUrl = `${QR_WEB_BASE}/?brand=${brandId}&table=${n}&loc=${loc.id}`;
                return (
                  <div key={n} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col items-center">
                    <div className="w-full py-3 text-center text-white font-bold text-lg" style={{ background: selectedBrand.color }}>Masa {n}</div>
                    <div className="p-6 bg-white w-full flex justify-center">
                      <QRCodeCanvas id={`qr-canvas-${n}`} value={qrUrl} size={180} level="H" includeMargin={true}
                        imageSettings={{ src: getBrandLogoUrl(brandId), height: 42, width: 42, excavate: true }} />
                    </div>
                    <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 truncate text-center border-t border-slate-100 dark:border-slate-800 font-medium">{qrUrl}</div>
                    <button className="w-full py-3 bg-transparent border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer" onClick={() => downloadQr(n)}>
                      <Download className="w-4 h-4" />
                      <span>Descarcă PNG</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-slate-400">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/>
              </svg>
              <h3 className="m-0 mb-2 text-xl font-bold text-slate-900 dark:text-white">Niciun QR generat pentru {selectedBrand.name}</h3>
              <p className="m-0 text-slate-500 max-w-md mx-auto leading-relaxed">
                Alege numărul de mese și apasă <strong>Generează</strong>. QR-urile vor fi salvate permanent și le vei putea descărca oricând.
              </p>
            </div>
          )}
        </>
      )}

      {/* ══ SETTINGS TAB — identic cu KioskSettingsForm ══ */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ─ Screensaver ─ */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="m-0 mb-2 text-lg font-bold text-slate-900 dark:text-white">Screensaver Standby</h3>
            <p className="text-sm text-slate-500 mb-6">Reclamă full-screen dacă telefonul stă neatins. Apare la scanarea QR-ului.</p>

            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Timeout inactivitate (secunde)</label>
            <input type="number" min="5" max="300" value={mob.inactivityTimeout}
              onChange={e => hm('inactivityTimeout', parseInt(e.target.value) || 30)}
              className="w-32 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6" />

            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">URL Video / Imagine Screensaver</label>
            <input type="url" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6" placeholder="https://... MP4 sau imagine"
              value={mob.posterUrl} onChange={e => hm('posterUrl', e.target.value)} />

            {mob.posterUrl ? (
              <div className="flex justify-center mt-2">
                <div className="w-[140px] h-[250px] rounded-[24px] overflow-hidden border-[8px] border-slate-800 bg-black relative shadow-xl">
                  {renderPreview(mob.posterUrl)}
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/90 text-slate-900 px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap shadow-sm">Atinge pentru a începe</div>
                </div>
              </div>
            ) : (
              <div className="h-24 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 text-sm font-medium">Fără screensaver.</div>
            )}
          </div>

          {/* ─ Banner Sus ─ */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="m-0 text-lg font-bold text-slate-900 dark:text-white">Banner Promo (Sus)</h3>
              <Toggle checked={useBanner} onChange={setUseBanner} />
            </div>
            <p className="text-sm text-slate-500 mb-6">Bandă în partea de sus a aplicației mobile.</p>

            {useBanner && (
              <div className="animate-in fade-in duration-300">
                <input type="url" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6" placeholder="URL Video MP4 sau Imagine..."
                  value={mob.topBannerUrl} onChange={e => hm('topBannerUrl', e.target.value)} />

                {mob.topBannerUrl && (
                  <div className="flex justify-center mb-6">
                    <div className="w-[140px] h-[250px] rounded-[24px] overflow-hidden border-[6px] border-slate-800 bg-slate-100 dark:bg-slate-800 relative shadow-xl">
                      <div className="absolute inset-1 flex flex-col gap-1.5 opacity-30">
                        <div className="w-full h-[25%] bg-slate-300 dark:bg-slate-600 rounded-md"></div>
                        <div className="w-full h-[25%] bg-slate-300 dark:bg-slate-600 rounded-md"></div>
                        <div className="w-full h-[25%] bg-slate-300 dark:bg-slate-600 rounded-md"></div>
                      </div>
                      <div className="absolute top-0 left-0 right-0 overflow-hidden bg-black transition-all"
                        style={{ 
                          height: `${10 + (mob.topBannerHeight - 1) * 5}%`, 
                          borderBottomLeftRadius: mob.topBannerRadiusBottom ? '8px' : '0',
                          borderBottomRightRadius: mob.topBannerRadiusBottom ? '8px' : '0',
                          borderTopLeftRadius: mob.topBannerRadiusTop ? '16px' : '0',
                          borderTopRightRadius: mob.topBannerRadiusTop ? '16px' : '0'
                        }}>
                        {renderPreview(mob.topBannerUrl)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Design — mereu vizibil */}
            <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800">
              <label className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                <span>Înălțime Banner</span><span className="text-slate-900 dark:text-white">Nivel {mob.topBannerHeight} / 5</span>
              </label>
              <input type="range" min="1" max="5" step="1" value={mob.topBannerHeight}
                onChange={e => hm('topBannerHeight', parseInt(e.target.value))} className="w-full cursor-pointer accent-blue-600" />
              
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                {[['topBannerRadiusTop','Colțuri Sus Rotunde'],['topBannerRadiusBottom','Colțuri Jos Rotunde']].map(([key, lbl]) => (
                  <label key={key} className="flex-1 bg-white dark:bg-slate-900 px-4 py-3 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer shadow-sm">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{lbl}</span>
                    <Toggle checked={mob[key]} onChange={v => hm(key, v)} />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ─ Banner Jos ─ */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="m-0 text-lg font-bold text-slate-900 dark:text-white">Banner Promo (Jos)</h3>
              <Toggle checked={useBottomBanner} onChange={setUseBottomBanner} />
            </div>
            <p className="text-sm text-slate-500 mb-6">Apare în josul aplicației. Suportă video/imagine sau text derulant.</p>

            {useBottomBanner && (
              <div className="animate-in fade-in duration-300">
                <h4 className="m-0 mb-2 text-sm font-bold text-slate-900 dark:text-white">1. Reclamă (Video / Imagine)</h4>
                <input type="url" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6" placeholder="https://... URL video sau imagine"
                  value={mob.bottomBannerUrl} onChange={e => hm('bottomBannerUrl', e.target.value)} />

                <h4 className="m-0 mb-2 text-sm font-bold text-slate-900 dark:text-white">2. Text Derulant</h4>
                <textarea className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-4 min-h-[80px] resize-y leading-relaxed" placeholder="Ex: Burger -20% azi! Gratis cartofi la orice combo!"
                  value={mob.bottomBannerText} onChange={e => hm('bottomBannerText', e.target.value)} />

                {mob.bottomBannerText.length > 0 && (
                  <div className="mb-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Mod Afișare Text</label>
                    <div className="flex gap-2 mb-6">
                      {[['false','Rulant'],['true','Fix']].map(([v, l]) => {
                        const isA = String(mob.bottomBannerTextFixed) === v;
                        return <button key={v} type="button" onClick={() => hm('bottomBannerTextFixed', v === 'true')}
                          className={`flex-1 py-2 rounded-full text-sm font-bold border-2 transition-colors ${isA ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>{l}</button>;
                      })}
                    </div>
                    
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Poziție Text</label>
                    <div className="flex gap-2">
                      {[['left','Stânga'],['center','Centru'],['right','Dreapta']].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => hm('bottomBannerTextAlign', v)}
                          className={`flex-1 py-2 rounded-full text-sm font-bold border-2 transition-colors ${mob.bottomBannerTextAlign === v ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Design — mereu vizibil */}
            <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800">
              <label className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                <span>Înălțime Banner</span><span className="text-slate-900 dark:text-white">Nivel {mob.bottomBannerHeight} / 5</span>
              </label>
              <input type="range" min="1" max="5" step="1" value={mob.bottomBannerHeight}
                onChange={e => hm('bottomBannerHeight', parseInt(e.target.value))} className="w-full cursor-pointer accent-blue-600 mb-6" />
              
              <div className="flex flex-col sm:flex-row gap-3">
                {[['bottomBannerRadiusTop','Colțuri Sus Rotunde'],['bottomBannerRadiusBottom','Colțuri Jos Rotunde']].map(([key, lbl]) => (
                  <label key={key} className="flex-1 bg-white dark:bg-slate-900 px-4 py-3 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer shadow-sm">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{lbl}</span>
                    <Toggle checked={mob[key]} onChange={v => hm(key, v)} />
                  </label>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ROOT COMPONENT
═══════════════════════════════════════════════════════ */
export default function QrGenerator({ backend }) {
  const { fetchWithAuth } = useAuth();
  const [locations,   setLocations]   = useState([]);
  const [loadingLocs, setLoadingLocs] = useState(true);
  const [selectedLoc, setSelectedLoc] = useState(null);

  const fetchLocations = () => {
    fetchWithAuth(`${backend}/api/locations`)
      .then(r => r.json())
      .then(data => {
        const locs = (data.locations || data || [])
          .filter(l => !l.id?.includes('main') && !l.id?.includes('template'));
        setLocations(locs);
        setLoadingLocs(false);
      })
      .catch(() => setLoadingLocs(false));
  };

  useEffect(() => { fetchLocations(); }, [backend, fetchWithAuth]);

  const handleRefresh = () => {
    fetchWithAuth(`${backend}/api/locations`)
      .then(r => r.json())
      .then(data => {
        const locs = (data.locations || data || []).filter(l => !l.id?.includes('main') && !l.id?.includes('template'));
        setLocations(locs);
        // Update selectedLoc from fresh data
        if (selectedLoc) {
          const fresh = locs.find(l => l.id === selectedLoc.id);
          if (fresh) setSelectedLoc(fresh);
        }
      })
      .catch(() => {});
  };

  if (loadingLocs) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div>
      <span className="text-slate-500 text-sm font-medium">Se încarcă locațiile...</span>
    </div>
  );
  
  if (!locations.length) return (
    <div className="p-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
      Nu ai nicio locație creată.
    </div>
  );

  if (selectedLoc) {
    return (
      <LocationQrForm
        loc={selectedLoc}
        backend={backend}
        onBack={() => setSelectedLoc(null)}
        onRefresh={handleRefresh}
      />
    );
  }

  return <LocationList locations={locations} onSelect={setSelectedLoc} />;
}
