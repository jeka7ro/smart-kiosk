import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { QRCodeCanvas } from 'qrcode.react';

const QR_WEB_BASE = 'https://qr-restaurants.netlify.app';

const BRANDS = [
  { id: 'smashme',     name: 'SmashMe',      color: '#ef4444', logo: '/brands/smashme-logo.png' },
  { id: 'sushimaster', name: 'Sushi Master',  color: '#3b82f6', logo: '/brands/sushimaster-logo.png' },
  { id: 'ikura',       name: 'Ikura',         color: '#f97316', logo: '/brands/ikura-logo.png' },
  { id: 'welovesushi', name: 'We Love Sushi', color: '#8b5cf6', logo: '/brands/welovesushi-logo.png' },
];

function renderPreview(url) {
  if (!url) return null;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url))
    return <video src={url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url))
    return <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  return <iframe src={url} title="Preview" style={{ width: '100%', height: '100%', border: 'none' }} />;
}

function Toggle({ checked, onChange }) {
  return (
    <label className="pc-toggle" style={{ margin: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
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
    <div>
      <div className="section-header" style={{ marginBottom: 8, display: 'none' }}></div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.92rem' }}>
        Genereaza coduri QR pentru mese. Clientii scaneaza QR-ul si comanda direct de pe telefon.
        Selecteaza o locatie pentru a gestiona QR-urile si setarile mobile.
      </p>

      <input className="um-search" placeholder="Cauta locatie..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: 340, marginBottom: 20, display: 'block' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 12 }}>
        {filtered.map(loc => {
          const totalQr = Object.values(loc.data?.qrConfig || {}).reduce((s, v) => s + v, 0);
          const hasMob = !!(loc.data?.mobileConfig?.topBannerUrl || loc.data?.mobileConfig?.posterUrl || loc.data?.mobileConfig?.bottomBannerUrl);
          return (
            <button key={loc.id} onClick={() => onSelect(loc)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
                padding: '18px 20px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#088c8c'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(8,140,140,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{loc.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {totalQr > 0 && <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{totalQr} QR</span>}
                  {hasMob && <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 20, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>MOB</span>}
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{loc.id}</span>
              <span style={{ fontSize: '0.8rem', color: '#088c8c', fontWeight: 600, marginTop: 4 }}>Configurare →</span>
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
    <div>
      {/* Header — identic cu KioskSettingsForm */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={onBack}
          style={{ padding: '8px 18px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          ← Înapoi
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            {loc.name}
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>ID: {loc.id}</p>
        </div>
        {activeTab === 'settings' && (
          <button onClick={saveMobileSettings} disabled={savingMob}
            style={{ padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.3s', background: mobSaved ? '#10b981' : '#0f172a', color: '#fff', boxShadow: mobSaved ? '0 4px 14px rgba(16,185,129,0.4)' : '0 4px 14px rgba(15,23,42,0.2)' }}>
            {mobSaved ? '✓ Salvat!' : savingMob ? 'Se salveaza...' : 'Salveaza Setarile Mobile'}
          </button>
        )}
        {activeTab === 'qr' && savedCount > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="um-btn um-btn--ghost" onClick={downloadAll}>Descarca toate</button>
            {!confirmClear
              ? <button className="um-btn um-btn--danger" onClick={() => setConfirmClear(true)}>Sterge QR-urile</button>
              : <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 30, padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span style={{ color: '#ef4444' }}>Sigur?</span>
                  <button className="um-btn um-btn--danger um-btn--sm" onClick={handleDeleteQr} disabled={savingQr}>Da, sterge</button>
                  <button className="um-btn um-btn--ghost um-btn--sm" onClick={() => setConfirmClear(false)}>Nu</button>
                </div>
            }
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1.5px solid var(--border)', marginBottom: 28 }}>
        {[['qr','Coduri QR'],['settings','Setari Mobile']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '10px 24px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.92rem', transition: 'all 0.15s', background: 'transparent',
              borderBottom: activeTab === tab ? '2.5px solid #088c8c' : '2.5px solid transparent',
              color: activeTab === tab ? '#088c8c' : 'var(--text-muted)', marginBottom: -1.5 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ QR TAB ══════════════════════════════════ */}
      {activeTab === 'qr' && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Brand</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {availableBrands.map(b => (
                  <button key={b.id} onClick={() => setBrandId(b.id)}
                    style={{ padding: '7px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      border: `1.5px solid ${brandId === b.id ? b.color : 'var(--border)'}`,
                      background: brandId === b.id ? b.color : 'var(--surface)',
                      color: brandId === b.id ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={b.logo} alt="" style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Nr. mese</label>
              <input type="number" min="1" max="200" value={tableCount}
                onChange={e => setTableCount(parseInt(e.target.value) || 1)}
                className="um-input" style={{ width: 90 }} />
            </div>
            <button className="qr-gen-btn" onClick={handleGenerate} disabled={savingQr}
              style={{ background: selectedBrand.color, alignSelf: 'flex-end' }}>
              {savingQr ? 'Se salveaza...' : savedCount > 0 ? `Actualizeaza (${tableCount} mese)` : `Genereaza ${tableCount} QR-uri`}
            </button>
          </div>

          {savedCount > 0 ? (
            <div className="qr-grid">
              {Array.from({ length: savedCount }).map((_, i) => {
                const n = i + 1;
                const qrUrl = `${QR_WEB_BASE}/?brand=${brandId}&table=${n}&loc=${loc.id}`;
                return (
                  <div key={n} className="qr-card">
                    <div className="qr-card-header" style={{ background: selectedBrand.color }}>Masa {n}</div>
                    <div style={{ padding: 12, display: 'flex', justifyContent: 'center', background: '#fff' }}>
                      <QRCodeCanvas id={`qr-canvas-${n}`} value={qrUrl} size={200} level="H" includeMargin={true}
                        imageSettings={{ src: selectedBrand.logo, height: 48, width: 48, excavate: true }} />
                    </div>
                    <div className="qr-card-url">{qrUrl}</div>
                    <button className="qr-card-dl" onClick={() => downloadQr(n)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Descarca PNG
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 48, background: 'var(--bg-surface)', borderRadius: 16, border: '1.5px dashed var(--border)', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.4" style={{ marginBottom: 16 }}>
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
              </svg>
              <h3 style={{ margin: '0 0 8px', color: 'var(--text)' }}>Niciun QR generat pentru {selectedBrand.name}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Alege numarul de mese si apasa <strong>Genereaza</strong>. QR-urile sunt salvate permanent.
              </p>
            </div>
          )}
        </>
      )}

      {/* ══ SETTINGS TAB — identic cu KioskSettingsForm ══ */}
      {activeTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px,1fr))', gap: 24 }}>

          {/* ─ Screensaver ─ */}
          <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, border: '1px solid var(--border)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--text)' }}>Screensaver Standby</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>Reclama full-screen daca telefonul sta neatins. Apare la scanarea QR-ului.</p>

            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Timeout inactivitate (secunde)</label>
            <input type="number" min="5" max="300" value={mob.inactivityTimeout}
              onChange={e => hm('inactivityTimeout', parseInt(e.target.value) || 30)}
              className="um-input" style={{ width: 110, marginBottom: 16 }} />

            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>URL Video / Imagine Screensaver</label>
            <input type="url" className="pc-input" placeholder="https://... MP4 sau imagine"
              value={mob.posterUrl} onChange={e => hm('posterUrl', e.target.value)}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 16, boxSizing: 'border-box' }} />

            {mob.posterUrl ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 130, height: 240, borderRadius: 16, overflow: 'hidden', border: '8px solid #1e293b', background: '#000', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                  {renderPreview(mob.posterUrl)}
                  <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.9)', color: '#0f172a', padding: '5px 12px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 800, whiteSpace: 'nowrap' }}>Atinge pentru a incepe</div>
                </div>
              </div>
            ) : (
              <div style={{ height: 80, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fara screensaver.</div>
            )}
          </div>

          {/* ─ Banner Sus ─ */}
          <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>Banner Promo (Sus)</h3>
              <Toggle checked={useBanner} onChange={setUseBanner} />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>Banda in partea de sus a aplicatiei mobile.</p>

            {useBanner && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <input type="url" className="pc-input" placeholder="URL Video MP4 sau Imagine..."
                  value={mob.topBannerUrl} onChange={e => hm('topBannerUrl', e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 16, boxSizing: 'border-box' }} />

                {mob.topBannerUrl && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <div style={{ width: 130, height: 240, borderRadius: 12, overflow: 'hidden', border: '6px solid #1e293b', background: '#e2e8f0', position: 'relative', boxShadow: '0 6px 20px rgba(0,0,0,0.15)' }}>
                      <div style={{ position: 'absolute', inset: 0, padding: 4 }}>
                        {[0,1,2].map(i => <div key={i} style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: 4, marginBottom: 4 }} />)}
                      </div>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${10 + (mob.topBannerHeight - 1) * 5}%`, borderRadius: `${mob.topBannerRadiusTop ? '6px' : '0'} ${mob.topBannerRadiusTop ? '6px' : '0'} ${mob.topBannerRadiusBottom ? '6px' : '0'} ${mob.topBannerRadiusBottom ? '6px' : '0'}`, transition: 'all 0.3s', overflow: 'hidden', background: '#000' }}>
                        {renderPreview(mob.topBannerUrl)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Design — mereu vizibil */}
            <div style={{ marginTop: 8, padding: 16, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
                <span>Inaltime Banner</span><span style={{ color: 'var(--text)' }}>Nivel {mob.topBannerHeight} / 5</span>
              </label>
              <input type="range" min="1" max="5" step="1" value={mob.topBannerHeight}
                onChange={e => hm('topBannerHeight', parseInt(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                {[['topBannerRadiusTop','Colturi Sus Rotunde'],['topBannerRadiusBottom','Colturi Jos Rotunde']].map(([key, lbl]) => (
                  <label key={key} style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{lbl}</span>
                    <Toggle checked={mob[key]} onChange={v => hm(key, v)} />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ─ Banner Jos ─ */}
          <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>Banner Promo (Jos)</h3>
              <Toggle checked={useBottomBanner} onChange={setUseBottomBanner} />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>Apare in josul aplicatiei. Suporta video/imagine sau text derulant.</p>

            {useBottomBanner && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '0.85rem', color: 'var(--text)', fontWeight: 700 }}>1. Reclama (Video / Imagine)</h4>
                <input type="url" className="pc-input" placeholder="https://... URL video sau imagine"
                  value={mob.bottomBannerUrl} onChange={e => hm('bottomBannerUrl', e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 14, boxSizing: 'border-box' }} />

                <h4 style={{ margin: '0 0 6px', fontSize: '0.85rem', color: 'var(--text)', fontWeight: 700 }}>2. Text Derulant</h4>
                <textarea className="pc-input" placeholder="Ex: Burger -20% azi! Gratis cartofi la orice combo!"
                  value={mob.bottomBannerText} onChange={e => hm('bottomBannerText', e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 14, boxSizing: 'border-box', minHeight: 64, resize: 'vertical' }} />

                {mob.bottomBannerText.length > 0 && (
                  <div style={{ marginBottom: 14, padding: 14, background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Mod Afisare Text</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[['false','Rulant'],['true','Fix']].map(([v, l]) => {
                        const isA = String(mob.bottomBannerTextFixed) === v;
                        return <button key={v} type="button" onClick={() => hm('bottomBannerTextFixed', v === 'true')}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${isA ? '#0f172a' : '#cbd5e1'}`, background: isA ? '#0f172a' : '#fff', color: isA ? '#fff' : '#475569', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>{l}</button>;
                      })}
                    </div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', margin: '10px 0 8px' }}>Pozitie Text</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[['left','Stanga'],['center','Centru'],['right','Dreapta']].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => hm('bottomBannerTextAlign', v)}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${mob.bottomBannerTextAlign === v ? '#0f172a' : '#cbd5e1'}`, background: mob.bottomBannerTextAlign === v ? '#0f172a' : '#fff', color: mob.bottomBannerTextAlign === v ? '#fff' : '#475569', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Design — mereu vizibil */}
            <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
                <span>Inaltime Banner</span><span style={{ color: 'var(--text)' }}>Nivel {mob.bottomBannerHeight} / 5</span>
              </label>
              <input type="range" min="1" max="5" step="1" value={mob.bottomBannerHeight}
                onChange={e => hm('bottomBannerHeight', parseInt(e.target.value))} style={{ width: '100%', cursor: 'pointer', marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                {[['bottomBannerRadiusTop','Colturi Sus Rotunde'],['bottomBannerRadiusBottom','Colturi Jos Rotunde']].map(([key, lbl]) => (
                  <label key={key} style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{lbl}</span>
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

  if (loadingLocs) return <p style={{ color: 'var(--text-muted)', padding: 40 }}>Se incarca locatiile...</p>;
  if (!locations.length) return <p style={{ color: 'var(--text-muted)', padding: 40 }}>Nu ai nicio locatie creata.</p>;

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
