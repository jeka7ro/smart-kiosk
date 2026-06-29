import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { QRCodeCanvas } from 'qrcode.react';

const QR_WEB_BASE = 'https://qr-restaurants.netlify.app';

const BRANDS = [
  { id: 'smashme',     name: 'SmashMe',      color: '#ef4444', logo: '/brands/smashme-logo.png' },
  { id: 'rollmaster', name: 'Roll Master', color: '#3b82f6', logo: '/brands/sushimaster-logo.png' },
  { id: 'lovesushi', name: 'Love Sushi', color: '#ec4899', logo: '/brands/welovesushi-logo.png' },
  { id: 'pokiwoki', name: 'Poki-Woki', color: '#f97316', logo: '/brands/sushimaster-logo.png' },
  { id: 'crunch', name: 'Crunch', color: '#eab308', logo: '/brands/smashme-logo.png' },
  { id: 'ikura',       name: 'Ikura',         color: '#f97316', logo: '/brands/ikura-logo.png' },
  { id: 'welovesushi', name: 'We Love Sushi', color: '#8b5cf6', logo: '/brands/welovesushi-logo.png' },
];

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
   LOCATION LIST — identical style to Kiosk list
═══════════════════════════════════════════════════════ */
function LocationList({ locations, onSelect }) {
  const [search, setSearch] = useState('');
  const filtered = locations.filter(l =>
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 animate-in fade-in duration-300">
      <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm leading-relaxed">
        Generează coduri QR pentru mese. Clienții scanează QR-ul și comandă direct de pe telefon.
        Selectează o locație pentru a gestiona QR-urile și setările mobile.
      </p>

      <div className="relative max-w-sm mb-6">
        <input 
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-shadow" 
          placeholder="Caută locație..."
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(loc => {
          const totalQr = Object.values(loc.data?.qrConfig || {}).reduce((s, v) => s + v, 0);
          const hasMob = !!(loc.data?.mobileConfig?.topBannerUrl || loc.data?.mobileConfig?.posterUrl || loc.data?.mobileConfig?.bottomBannerUrl);
          return (
            <button key={loc.id} onClick={() => onSelect(loc)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-left cursor-pointer transition-all hover:-translate-y-1 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 flex flex-col gap-2 group"
            >
              <div className="flex justify-between items-start">
                <span className="text-base font-bold text-slate-900 dark:text-white">{loc.name}</span>
                <div className="flex gap-1.5">
                  {totalQr > 0 && <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full px-2 py-0.5 text-xs font-bold">{totalQr} QR</span>}
                  {hasMob && <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full px-2 py-0.5 text-xs font-bold">MOB</span>}
                </div>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 self-start px-2 py-0.5 rounded-md">{loc.id}</span>
              <span className="text-sm text-blue-600 dark:text-blue-500 font-bold mt-1 group-hover:translate-x-1 transition-transform">Configurare →</span>
            </button>
          );
        })}
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
    <div className="w-full max-w-7xl mx-auto pb-10 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <button onClick={onBack}
          className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-sm cursor-pointer flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
          ← Înapoi
        </button>
        <div className="flex-1">
          <h1 className="m-0 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {loc.name}
          </h1>
          <p className="m-0 mt-1 text-sm text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded">ID: {loc.id}</p>
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-8">
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
                      <img src={b.logo} alt="" className="w-4 h-4 rounded-sm object-contain" onError={e => e.target.style.display = 'none'} />
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Nr. mese</label>
                <input type="number" min="1" max="200" value={tableCount}
                  onChange={e => setTableCount(parseInt(e.target.value) || 1)}
                  className="w-24 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div className="ml-auto">
                <button className="px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-sm hover:brightness-110 transition-all" onClick={handleGenerate} disabled={savingQr}
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
                  <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col items-center">
                    <div className="w-full py-3 text-center text-white font-bold text-lg" style={{ background: selectedBrand.color }}>Masa {n}</div>
                    <div className="p-6 bg-white w-full flex justify-center">
                      <QRCodeCanvas id={`qr-canvas-${n}`} value={qrUrl} size={180} level="H" includeMargin={true}
                        imageSettings={{ src: selectedBrand.logo, height: 42, width: 42, excavate: true }} />
                    </div>
                    <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 font-mono truncate text-center border-t border-slate-100 dark:border-slate-800">{qrUrl}</div>
                    <button className="w-full py-3 bg-transparent border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors flex items-center justify-center gap-2" onClick={() => downloadQr(n)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Descarcă PNG
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
              className="w-32 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6" />

            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">URL Video / Imagine Screensaver</label>
            <input type="url" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6" placeholder="https://... MP4 sau imagine"
              value={mob.posterUrl} onChange={e => hm('posterUrl', e.target.value)} />

            {mob.posterUrl ? (
              <div className="flex justify-center mt-2">
                <div className="w-[140px] h-[250px] rounded-[24px] overflow-hidden border-[8px] border-slate-800 bg-black relative shadow-xl">
                  {renderPreview(mob.posterUrl)}
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/90 text-slate-900 px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap shadow-sm">Atinge pentru a începe</div>
                </div>
              </div>
            ) : (
              <div className="h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 text-sm font-medium">Fără screensaver.</div>
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
                <input type="url" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6" placeholder="URL Video MP4 sau Imagine..."
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
            <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                <span>Înălțime Banner</span><span className="text-slate-900 dark:text-white">Nivel {mob.topBannerHeight} / 5</span>
              </label>
              <input type="range" min="1" max="5" step="1" value={mob.topBannerHeight}
                onChange={e => hm('topBannerHeight', parseInt(e.target.value))} className="w-full cursor-pointer accent-blue-600" />
              
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                {[['topBannerRadiusTop','Colțuri Sus Rotunde'],['topBannerRadiusBottom','Colțuri Jos Rotunde']].map(([key, lbl]) => (
                  <label key={key} className="flex-1 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer shadow-sm">
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
                <input type="url" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6" placeholder="https://... URL video sau imagine"
                  value={mob.bottomBannerUrl} onChange={e => hm('bottomBannerUrl', e.target.value)} />

                <h4 className="m-0 mb-2 text-sm font-bold text-slate-900 dark:text-white">2. Text Derulant</h4>
                <textarea className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-4 min-h-[80px] resize-y leading-relaxed" placeholder="Ex: Burger -20% azi! Gratis cartofi la orice combo!"
                  value={mob.bottomBannerText} onChange={e => hm('bottomBannerText', e.target.value)} />

                {mob.bottomBannerText.length > 0 && (
                  <div className="mb-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Mod Afișare Text</label>
                    <div className="flex gap-2 mb-6">
                      {[['false','Rulant'],['true','Fix']].map(([v, l]) => {
                        const isA = String(mob.bottomBannerTextFixed) === v;
                        return <button key={v} type="button" onClick={() => hm('bottomBannerTextFixed', v === 'true')}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${isA ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>{l}</button>;
                      })}
                    </div>
                    
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Poziție Text</label>
                    <div className="flex gap-2">
                      {[['left','Stânga'],['center','Centru'],['right','Dreapta']].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => hm('bottomBannerTextAlign', v)}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${mob.bottomBannerTextAlign === v ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Design — mereu vizibil */}
            <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                <span>Înălțime Banner</span><span className="text-slate-900 dark:text-white">Nivel {mob.bottomBannerHeight} / 5</span>
              </label>
              <input type="range" min="1" max="5" step="1" value={mob.bottomBannerHeight}
                onChange={e => hm('bottomBannerHeight', parseInt(e.target.value))} className="w-full cursor-pointer accent-blue-600 mb-6" />
              
              <div className="flex flex-col sm:flex-row gap-3">
                {[['bottomBannerRadiusTop','Colțuri Sus Rotunde'],['bottomBannerRadiusBottom','Colțuri Jos Rotunde']].map(([key, lbl]) => (
                  <label key={key} className="flex-1 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer shadow-sm">
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
    <div className="p-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
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
