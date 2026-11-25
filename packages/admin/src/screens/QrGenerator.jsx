import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { QRCodeCanvas } from 'qrcode.react';
import BrandLogo from '../components/BrandLogo';
import { Search, QrCode, Smartphone, ArrowLeft, Download, Trash2, Check, ExternalLink } from 'lucide-react';

const QR_WEB_BASE = 'https://qr-restaurants.netlify.app';

const BRANDS = [
  { id: 'smashme', name: 'SmashMe', color: '#ef4444' },
  { id: 'rollmaster', name: 'Roll Master', color: '#e31e24' },
  { id: 'lovesushi', name: 'Love Sushi', color: '#ec4899' },
  { id: 'pokiwoki', name: 'Poki-Woki', color: '#f97316' },
  { id: 'crunch', name: 'Crunch', color: '#eab308' },
  { id: 'welovesushi', name: 'We Love Sushi', color: '#8b5cf6' },
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      className={`apple-switch ${checked ? 'is-on' : ''}`}
    >
      <span className="apple-switch-thumb" />
    </button>
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
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header & KPI Sumar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-[18px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] m-0">
              Coduri QR & Portal Mobil
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#007AFF]/10 text-[#007AFF] tabular-nums">
              {locations.length} locații
            </span>
          </div>
          <p className="text-[#6E6E73] dark:text-[#98989D] mt-1 text-[13px] m-0">
            Generează coduri QR pentru mese și configurează portalul mobil pentru comanda de pe telefon.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-full bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158] text-[12px] font-semibold flex items-center gap-1.5 tabular-nums">
            <QrCode className="w-3.5 h-3.5" />
            <span>{totalQrCountAll} QR-uri active</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-[#AF52DE]/12 text-[#8944AB] dark:text-[#BF5AF2] text-[12px] font-semibold flex items-center gap-1.5 tabular-nums">
            <Smartphone className="w-3.5 h-3.5" />
            <span>{mobileConfiguredCount} portaluri mobile</span>
          </div>
        </div>
      </div>

      {/* Bară Filtre Branduri & Căutare */}
      <div className="apple-card p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide flex-1">
          <button
            className={`shrink-0 px-3.5 h-8 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer tabular-nums ${brandFilter === 'all'
                ? 'bg-[#007AFF] text-white'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
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
                className={`shrink-0 px-3 h-8 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer tabular-nums ${isSelected
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
                  }`}
                onClick={() => { setBrandFilter(bid); setCurrentPage(1); }}
              >
                <BrandLogo brandId={bid} size={15} />
                <span>{name}</span>
                <span className={isSelected ? 'text-white/80' : 'text-[#86868B]'}>({count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[220px] max-w-xs shrink-0">
          <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            className="apple-input rounded-full w-full pl-9 pr-14 py-1.5 text-[13px]"
            placeholder="Caută locație..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {search && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#007AFF]/12 text-[#007AFF] rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums">
              {filtered.length}/{locations.length}
            </div>
          )}
        </div>
      </div>

      {/* Tabel Business */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.06] dark:border-white/[0.08] whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">
                <th className="px-5 py-3 text-center w-[56px]">#</th>
                <th className="px-5 py-3 min-w-[220px]">Denumire & ID</th>
                <th className="px-5 py-3">Branduri Active</th>
                <th className="px-5 py-3">Statistici (Mese & QR)</th>
                <th className="px-5 py-3">Portal Mobil</th>
                <th className="px-5 py-3 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {paginated.map((loc, index) => {
                const totalQr = Object.values(loc.data?.qrConfig || {}).reduce((s, v) => s + v, 0);
                const hasMob = !!(loc.data?.mobileConfig?.topBannerUrl || loc.data?.mobileConfig?.posterUrl || loc.data?.mobileConfig?.bottomBannerUrl);
                const brandsArr = loc.brands && loc.brands.length > 0 ? loc.brands : (loc.brandId ? [loc.brandId] : []);
                const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;

                return (
                  <tr
                    key={loc.id}
                    onClick={() => onSelect(loc)}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#86868B] text-center whitespace-nowrap tabular-nums">
                      {rowNumber}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${totalQr > 0 ? 'bg-[#34C759]' : 'bg-[#C7C7CC] dark:bg-[#48484A]'}`} />
                          <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] text-[13px]">{loc.name}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono text-[#6E6E73] dark:text-[#98989D] bg-black/[0.04] dark:bg-white/[0.06]">
                          {loc.id}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {brandsArr.length > 0 ? (
                          brandsArr.map(b => (
                            <div key={b} title={b} className="shrink-0">
                              <BrandLogo brandId={b} size={22} />
                            </div>
                          ))
                        ) : (
                          <span className="text-[12px] text-[#86868B]">Nespecificat</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap tabular-nums">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D]">
                          Mese: {loc.tables || 10}
                        </span>
                        {totalQr > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#34C759]/12 text-[11px] font-semibold text-[#248A3D] dark:text-[#30D158] flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            {totalQr} QR-uri
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[11px] font-medium text-[#86868B]">
                            0 QR
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {hasMob ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#AF52DE]/12 text-[#8944AB] dark:text-[#BF5AF2]">
                          <Smartphone className="w-3 h-3" />
                          Configurat
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.04] dark:bg-white/[0.06] text-[#86868B]">
                          Standard
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onSelect(loc)}
                        title="Configurează codurile QR și portalul mobil"
                        className="apple-btn-primary text-[12px] px-3.5 py-1.5"
                      >
                        <span>Configurare</span>
                        <span>→</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 && (
          <div className="p-12 text-center text-[#86868B] text-[13px] font-medium">
            Nu există nicio locație care să corespundă filtrelor selectate.
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-3.5 bg-black/[0.015] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D]">Rânduri pe pagină</span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="apple-input py-1 px-2.5 text-[12px] font-semibold cursor-pointer"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] ml-2 tabular-nums">
              {sorted.length === 0 ? '0' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(sorted.length, currentPage * itemsPerPage)}`} din {sorted.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {[
              { label: '«', action: () => setCurrentPage(1), disabled: currentPage === 1, title: 'Prima pagină' },
              { label: '‹', action: () => setCurrentPage(p => p - 1), disabled: currentPage === 1, title: 'Anterioară' },
              { label: '›', action: () => setCurrentPage(p => p + 1), disabled: currentPage === totalPages, title: 'Următoarea' },
              { label: '»', action: () => setCurrentPage(totalPages), disabled: currentPage === totalPages, title: 'Ultima pagină' },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={btn.action}
                disabled={btn.disabled}
                title={btn.title}
                className="w-8 h-8 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[13px] font-semibold flex items-center justify-center transition-colors cursor-pointer"
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

  const [brandId, setBrandId] = useState(() => {
    const first = loc.brands?.find(id => BRANDS.some(b => b.id === id));
    return first || 'smashme';
  });
  const [tableCount, setTableCount] = useState(10);
  const [savingQr, setSavingQr] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeTab, setActiveTab] = useState('qr');

  // mobile settings
  const mc = loc.data?.mobileConfig || {};
  const [mob, setMob] = useState({
    posterUrl: mc.posterUrl || '',
    inactivityTimeout: mc.inactivityTimeout || 30,
    topBannerUrl: mc.topBannerUrl || '',
    topBannerHeight: mc.topBannerHeight || 3,
    topBannerRadiusTop: mc.topBannerRadiusTop !== undefined ? mc.topBannerRadiusTop : true,
    topBannerRadiusBottom: mc.topBannerRadiusBottom !== undefined ? mc.topBannerRadiusBottom : false,
    bottomBannerUrl: mc.bottomBannerUrl || '',
    bottomBannerText: mc.bottomBannerText || '',
    bottomBannerHeight: mc.bottomBannerHeight || 2,
    bottomBannerRadiusTop: mc.bottomBannerRadiusTop !== undefined ? mc.bottomBannerRadiusTop : false,
    bottomBannerRadiusBottom: mc.bottomBannerRadiusBottom !== undefined ? mc.bottomBannerRadiusBottom : true,
    bottomBannerTextFixed: mc.bottomBannerTextFixed || false,
    bottomBannerTextAlign: mc.bottomBannerTextAlign || 'center',
    bottomBannerBg: mc.bottomBannerBg || '#1e293b',
  });
  const [useBanner, setUseBanner] = useState(!!mc.topBannerUrl);
  const [useBottomBanner, setUseBottomBanner] = useState(!!(mc.bottomBannerUrl || mc.bottomBannerText));
  const [savingMob, setSavingMob] = useState(false);
  const [mobSaved, setMobSaved] = useState(false);

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
    } catch (e) { }
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
    if (!useBanner) { mobileConfig.topBannerUrl = ''; }
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
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={onBack} className="apple-btn-secondary px-3.5 py-2 text-[13px]">
          <ArrowLeft className="w-4 h-4" />
          <span>Înapoi</span>
        </button>
        <div className="flex-1">
          <h1 className="m-0 text-[20px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {loc.name}
          </h1>
          <span className="inline-block mt-1 text-[11px] font-mono text-[#6E6E73] dark:text-[#98989D] bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-md">{loc.id}</span>
        </div>
        {activeTab === 'settings' && (
          <button onClick={saveMobileSettings} disabled={savingMob}
            className={`px-5 py-2 rounded-full font-semibold text-[13px] cursor-pointer transition-all ${mobSaved ? 'bg-[#34C759] text-white' : 'apple-btn-primary'}`}>
            {mobSaved ? 'Salvat' : savingMob ? 'Se salvează...' : 'Salvează Setările Mobile'}
          </button>
        )}
        {activeTab === 'qr' && savedCount > 0 && (
          <div className="flex items-center gap-2">
            <button className="apple-btn-secondary px-4 py-2 text-[13px]" onClick={downloadAll}>
              <Download className="w-3.5 h-3.5" /> Descarcă toate
            </button>
            {!confirmClear
              ? <button className="px-4 py-2 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] text-[13px] font-semibold transition-colors cursor-pointer" onClick={() => setConfirmClear(true)}>Șterge QR-urile</button>
              : <div className="flex gap-2 items-center bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl px-3.5 py-1.5 text-[12px] font-semibold">
                <span className="text-[#FF3B30]">Sigur?</span>
                <button className="px-2.5 py-1 rounded-full bg-[#FF3B30] text-white text-[12px] font-semibold cursor-pointer" onClick={handleDeleteQr} disabled={savingQr}>Da</button>
                <button className="px-2.5 py-1 rounded-full bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] text-[12px] font-semibold cursor-pointer" onClick={() => setConfirmClear(false)}>Nu</button>
              </div>
            }
          </div>
        )}
      </div>

      {/* Segmented Tabs */}
      <div className="apple-segmented inline-flex">
        {[['qr', 'Coduri QR'], ['settings', 'Setări Mobile']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`apple-segmented-item px-5 ${activeTab === tab ? 'is-active' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ QR TAB ══════════════════════════════════ */}
      {activeTab === 'qr' && (
        <>
          <div className="apple-card p-5">
            <div className="flex flex-wrap gap-5 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Brand</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableBrands.map(b => {
                    const isActive = brandId === b.id;
                    return (
                      <button key={b.id} onClick={() => setBrandId(b.id)}
                        className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer transition-all flex items-center gap-2 ${isActive
                            ? 'bg-[#007AFF] text-white'
                            : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08]'
                          }`}>
                        <BrandLogo brandId={b.id} size={16} />
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Nr. mese</label>
                <input type="number" min="1" max="200" value={tableCount}
                  onChange={e => setTableCount(parseInt(e.target.value) || 1)}
                  className="apple-input w-24 text-center font-semibold tabular-nums" />
              </div>
              <div className="ml-auto">
                <button className="apple-btn-primary px-5 py-2.5 text-[13px]" onClick={handleGenerate} disabled={savingQr}>
                  {savingQr ? 'Se salvează...' : savedCount > 0 ? `Actualizează (${tableCount} mese)` : `Generează ${tableCount} QR-uri`}
                </button>
              </div>
            </div>
          </div>

          {savedCount > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: savedCount }).map((_, i) => {
                const n = i + 1;
                const qrUrl = `${QR_WEB_BASE}/?brand=${brandId}&table=${n}&loc=${loc.id}`;
                return (
                  <div key={n} className="apple-card overflow-hidden flex flex-col items-center">
                    <div className="w-full py-2.5 text-center text-white font-semibold text-[15px]" style={{ background: selectedBrand.color }}>Masa {n}</div>
                    <div className="p-5 bg-white w-full flex justify-center">
                      <QRCodeCanvas id={`qr-canvas-${n}`} value={qrUrl} size={172} level="H" includeMargin={true}
                        imageSettings={{ src: getBrandLogoUrl(brandId), height: 40, width: 40, excavate: true }} />
                    </div>
                    <div className="w-full px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] text-[11px] text-[#86868B] truncate text-center border-t border-black/[0.05] dark:border-white/[0.06] font-mono">{qrUrl}</div>
                    <button className="w-full py-2.5 border-t border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-[#007AFF] text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer" onClick={() => downloadQr(n)}>
                      <Download className="w-3.5 h-3.5" />
                      <span>Descarcă PNG</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="apple-card p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-[#86868B] flex items-center justify-center mx-auto mb-3">
                <QrCode size={24} />
              </div>
              <h3 className="m-0 mb-1.5 text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Niciun QR generat pentru {selectedBrand.name}</h3>
              <p className="m-0 text-[13px] text-[#6E6E73] dark:text-[#98989D] max-w-md mx-auto leading-relaxed">
                Alege numărul de mese și apasă <strong>Generează</strong>. QR-urile vor fi salvate permanent și le vei putea descărca oricând.
              </p>
            </div>
          )}
        </>
      )}

      {/* ══ SETTINGS TAB ══ */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ─ Screensaver ─ */}
          <div className="apple-card p-5 space-y-4">
            <div>
              <h3 className="m-0 text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Screensaver Standby</h3>
              <p className="text-[13px] text-[#6E6E73] dark:text-[#98989D] mt-1 mb-0">Reclamă full-screen dacă telefonul stă neatins. Apare la scanarea QR-ului.</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Timeout inactivitate (secunde)</label>
              <input type="number" min="5" max="300" value={mob.inactivityTimeout}
                onChange={e => hm('inactivityTimeout', parseInt(e.target.value) || 30)}
                className="apple-input w-32 font-semibold tabular-nums" />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">URL Video / Imagine Screensaver</label>
              <input type="url" className="apple-input w-full" placeholder="https://... MP4 sau imagine"
                value={mob.posterUrl} onChange={e => hm('posterUrl', e.target.value)} />
            </div>

            {mob.posterUrl ? (
              <div className="flex justify-center pt-2">
                <div className="w-[140px] h-[250px] rounded-[24px] overflow-hidden border-[6px] border-[#1D1D1F] bg-black relative shadow-lg">
                  {renderPreview(mob.posterUrl)}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 text-[#1D1D1F] px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap">Atinge pentru a începe</div>
                </div>
              </div>
            ) : (
              <div className="h-24 rounded-xl border border-dashed border-black/[0.12] dark:border-white/[0.12] flex items-center justify-center text-[#86868B] text-[13px]">Fără screensaver</div>
            )}
          </div>

          {/* ─ Banner Sus ─ */}
          <div className="apple-card p-5 space-y-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="m-0 text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Banner Promo (Sus)</h3>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#98989D] mt-1 mb-0">Bandă afișată în partea de sus a aplicației mobile.</p>
              </div>
              <Toggle checked={useBanner} onChange={setUseBanner} />
            </div>

            {useBanner && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <input type="url" className="apple-input w-full" placeholder="URL Video MP4 sau Imagine..."
                  value={mob.topBannerUrl} onChange={e => hm('topBannerUrl', e.target.value)} />

                {mob.topBannerUrl && (
                  <div className="flex justify-center">
                    <div className="w-[140px] h-[250px] rounded-[24px] overflow-hidden border-[6px] border-[#1D1D1F] bg-[#F5F5F7] dark:bg-[#2C2C2E] relative shadow-lg">
                      <div className="absolute inset-1.5 flex flex-col gap-1.5 opacity-30">
                        <div className="w-full h-[25%] bg-black/20 dark:bg-white/20 rounded-md" />
                        <div className="w-full h-[25%] bg-black/20 dark:bg-white/20 rounded-md" />
                        <div className="w-full h-[25%] bg-black/20 dark:bg-white/20 rounded-md" />
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

            <div className="apple-inset-group p-4 space-y-4">
              <div>
                <div className="flex justify-between text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-2">
                  <span>Înălțime Banner</span>
                  <span className="text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">Nivel {mob.topBannerHeight} / 5</span>
                </div>
                <input type="range" min="1" max="5" step="1" value={mob.topBannerHeight}
                  onChange={e => hm('topBannerHeight', parseInt(e.target.value))} className="w-full cursor-pointer accent-[#007AFF]" />
              </div>

              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08] border-t border-black/[0.06] dark:border-white/[0.08]">
                {[['topBannerRadiusTop', 'Colțuri Sus Rotunde'], ['topBannerRadiusBottom', 'Colțuri Jos Rotunde']].map(([key, lbl]) => (
                  <div key={key} className="py-2.5 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{lbl}</span>
                    <Toggle checked={mob[key]} onChange={v => hm(key, v)} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─ Banner Jos ─ */}
          <div className="apple-card p-5 space-y-4 lg:col-span-2">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="m-0 text-[16px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Banner Promo (Jos)</h3>
                <p className="text-[13px] text-[#6E6E73] dark:text-[#98989D] mt-1 mb-0">Apare în josul aplicației. Suportă video/imagine sau text derulant.</p>
              </div>
              <Toggle checked={useBottomBanner} onChange={setUseBottomBanner} />
            </div>

            {useBottomBanner && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">1. Reclamă (Video / Imagine)</label>
                    <input type="url" className="apple-input w-full" placeholder="https://... URL video sau imagine"
                      value={mob.bottomBannerUrl} onChange={e => hm('bottomBannerUrl', e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">2. Text Derulant</label>
                    <textarea className="apple-input w-full min-h-[88px] resize-y leading-relaxed" placeholder="Ex: Burger -20% azi! Gratis cartofi la orice combo!"
                      value={mob.bottomBannerText} onChange={e => hm('bottomBannerText', e.target.value)} />
                  </div>
                </div>

                {mob.bottomBannerText.length > 0 && (
                  <div className="apple-inset-group p-4 space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Mod Afișare Text</label>
                      <div className="apple-segmented w-full grid grid-cols-2">
                        {[['false', 'Rulant'], ['true', 'Fix']].map(([v, l]) => {
                          const isA = String(mob.bottomBannerTextFixed) === v;
                          return <button key={v} type="button" onClick={() => hm('bottomBannerTextFixed', v === 'true')}
                            className={`apple-segmented-item ${isA ? 'is-active' : ''}`}>{l}</button>;
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Poziție Text</label>
                      <div className="apple-segmented w-full grid grid-cols-3">
                        {[['left', 'Stânga'], ['center', 'Centru'], ['right', 'Dreapta']].map(([v, l]) => (
                          <button key={v} type="button" onClick={() => hm('bottomBannerTextAlign', v)}
                            className={`apple-segmented-item ${mob.bottomBannerTextAlign === v ? 'is-active' : ''}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="apple-inset-group p-4 space-y-4">
              <div>
                <div className="flex justify-between text-[12px] font-semibold text-[#6E6E73] dark:text-[#98989D] mb-2">
                  <span>Înălțime Banner</span>
                  <span className="text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">Nivel {mob.bottomBannerHeight} / 5</span>
                </div>
                <input type="range" min="1" max="5" step="1" value={mob.bottomBannerHeight}
                  onChange={e => hm('bottomBannerHeight', parseInt(e.target.value))} className="w-full cursor-pointer accent-[#007AFF]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                {[['bottomBannerRadiusTop', 'Colțuri Sus Rotunde'], ['bottomBannerRadiusBottom', 'Colțuri Jos Rotunde']].map(([key, lbl]) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{lbl}</span>
                    <Toggle checked={mob[key]} onChange={v => hm(key, v)} />
                  </div>
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
  const [locations, setLocations] = useState([]);
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
      .catch(() => { });
  };

  if (loadingLocs) return (
    <div className="apple-card flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-6 h-6 border-2 border-black/10 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
      <span className="text-[#86868B] text-[13px] font-medium">Se încarcă locațiile...</span>
    </div>
  );

  if (!locations.length) return (
    <div className="apple-card p-12 text-center text-[#86868B] text-[13px]">
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
