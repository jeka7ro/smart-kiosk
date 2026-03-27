import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { QRCodeCanvas } from 'qrcode.react';

const QR_WEB_BASE = 'https://qr-restaurants.netlify.app';

const BRANDS = [
  { id: 'smashme',    name: 'SmashMe',      color: '#ef4444', logo: '/brands/smashme-logo.png' },
  { id: 'sushimaster',name: 'Sushi Master', color: '#3b82f6', logo: '/brands/sushimaster-logo.png' },
  { id: 'ikura',      name: 'Ikura',        color: '#f97316', logo: '/brands/ikura-logo.png' },
  { id: 'welovesushi',name: 'We Love Sushi',color: '#8b5cf6', logo: '/brands/welovesushi-logo.png' },
];

/* ── helpers ── */
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

/* ══ MAIN COMPONENT ══════════════════════════════════════════════════ */
export default function QrGenerator({ backend }) {
  const { fetchWithAuth } = useAuth();

  // QR state
  const [brandId, setBrandId]       = useState('smashme');
  const [locId, setLocId]           = useState(null);
  const [locations, setLocations]   = useState([]);
  const [loadingLocs, setLoadingLocs] = useState(true);
  const [savingQr, setSavingQr]     = useState(false);
  const [tableCount, setTableCount] = useState(10);
  const [confirmClear, setConfirmClear] = useState(false);
  const [locSearch, setLocSearch]   = useState('');
  const [activeTab, setActiveTab]   = useState('qr'); // 'qr' | 'settings'

  // Mobile Settings state
  const [mob, setMob] = useState({
    posterUrl: '',
    inactivityTimeout: 30,
    topBannerUrl: '', topBannerHeight: 3, topBannerRadiusTop: true, topBannerRadiusBottom: false,
    bottomBannerUrl: '', bottomBannerText: '', bottomBannerHeight: 2,
    bottomBannerRadiusTop: false, bottomBannerRadiusBottom: true,
    bottomBannerTextFixed: false, bottomBannerTextAlign: 'center', bottomBannerBg: '#1e293b',
  });
  const [useBanner, setUseBanner]           = useState(false);
  const [useBottomBanner, setUseBottomBanner] = useState(false);
  const [savingMob, setSavingMob]           = useState(false);
  const [mobSaved, setMobSaved]             = useState(false);

  useEffect(() => {
    fetchWithAuth(`${backend}/api/locations`)
      .then(r => r.json())
      .then(data => {
        const locs = (data.locations || data || [])
          .filter(l => !l.id?.includes('main') && !l.id?.includes('template'));
        setLocations(locs);
        setLoadingLocs(false);
      })
      .catch(() => setLoadingLocs(false));
  }, [backend, fetchWithAuth]);

  const selectedLoc   = locations.find(l => l.id === locId);
  const selectedBrand = BRANDS.find(b => b.id === brandId) || BRANDS[0];
  const savedCount    = selectedLoc?.data?.qrConfig?.[brandId] || 0;

  // Load mobileConfig into form when location changes
  useEffect(() => {
    if (!selectedLoc) return;
    const mc = selectedLoc?.data?.mobileConfig || {};
    setMob({
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
    setUseBanner(!!mc.topBannerUrl);
    setUseBottomBanner(!!(mc.bottomBannerUrl || mc.bottomBannerText));
    setMobSaved(false);
  }, [locId]);

  useEffect(() => {
    if (savedCount > 0) setTableCount(savedCount);
    else setTableCount(10);
  }, [brandId, locId, savedCount]);

  const filteredLocs = locations.filter(l =>
    l.name?.toLowerCase().includes(locSearch.toLowerCase()) ||
    l.id?.toLowerCase().includes(locSearch.toLowerCase())
  );

  /* ── QR actions ── */
  const handleGenerate = async () => {
    if (!selectedLoc) return;
    setSavingQr(true);
    try {
      const updatedData = {
        ...selectedLoc.data,
        qrConfig: { ...(selectedLoc.data?.qrConfig || {}), [brandId]: tableCount },
      };
      const res = await fetchWithAuth(`${backend}/api/locations/${locId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedLoc, data: updatedData }),
      });
      if (res.ok) setLocations(prev => prev.map(l => l.id === locId ? { ...l, data: updatedData } : l));
    } catch (e) { console.error(e); }
    setSavingQr(false);
  };

  const handleDeleteQr = async () => {
    if (!selectedLoc) return;
    setSavingQr(true); setConfirmClear(false);
    try {
      const qrConfig = { ...(selectedLoc.data?.qrConfig || {}) };
      delete qrConfig[brandId];
      const updatedData = { ...selectedLoc.data, qrConfig };
      const res = await fetchWithAuth(`${backend}/api/locations/${locId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedLoc, data: updatedData }),
      });
      if (res.ok) setLocations(prev => prev.map(l => l.id === locId ? { ...l, data: updatedData } : l));
    } catch (e) {}
    setSavingQr(false);
  };

  const downloadQr = (n) => {
    const canvas = document.getElementById(`qr-canvas-${n}`);
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${brandId}-${locId}-masa-${n}.png`;
    a.click();
  };
  const downloadAll = () => { for (let i = 1; i <= savedCount; i++) setTimeout(() => downloadQr(i), i * 200); };

  /* ── Mobile Settings save ── */
  const saveMobileSettings = async () => {
    if (!selectedLoc) return;
    setSavingMob(true);
    const mobileConfig = { ...mob };
    if (!useBanner) { mobileConfig.topBannerUrl = ''; }
    if (!useBottomBanner) { mobileConfig.bottomBannerUrl = ''; mobileConfig.bottomBannerText = ''; }
    const updatedData = { ...selectedLoc.data, mobileConfig };
    try {
      const res = await fetchWithAuth(`${backend}/api/locations/${locId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedLoc, data: updatedData }),
      });
      if (res.ok) {
        setLocations(prev => prev.map(l => l.id === locId ? { ...l, data: updatedData } : l));
        setMobSaved(true);
        setTimeout(() => setMobSaved(false), 3000);
      }
    } catch (e) { console.error(e); }
    setSavingMob(false);
  };

  const hm = (key, val) => setMob(p => ({ ...p, [key]: val }));

  if (loadingLocs) return <p style={{ color: 'var(--text-muted)', padding: 40 }}>Se incarca locatiile...</p>;
  if (!locations.length) return <p style={{ color: 'var(--text-muted)', padding: 40 }}>Nu ai nicio locatie creata.</p>;

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: '75vh', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)' }}>

      {/* ── LEFT: Location List ── */}
      <div style={{ width: 265, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Locatii ({locations.length})
          </p>
          <input className="um-search" placeholder="Cauta locatie..." value={locSearch}
            onChange={e => setLocSearch(e.target.value)}
            style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {filteredLocs.map(l => {
            const hasQr  = !!(l.data?.qrConfig?.[brandId]);
            const hasMob = !!(l.data?.mobileConfig?.topBannerUrl || l.data?.mobileConfig?.posterUrl);
            const isActive = locId === l.id;
            return (
              <button key={l.id} onClick={() => { setLocId(l.id); setConfirmClear(false); setActiveTab('qr'); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 10,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s', marginBottom: 2,
                  background: isActive ? 'rgba(15,118,110,0.1)' : 'transparent',
                  borderLeft: isActive ? '3px solid #0f766e' : '3px solid transparent',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#0f766e' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{l.name}</span>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {hasQr  && <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '2px 6px', fontSize: '0.68rem', fontWeight: 700 }}>{l.data.qrConfig[brandId]} QR</span>}
                    {hasMob && <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 20, padding: '2px 6px', fontSize: '0.68rem', fontWeight: 700 }}>MOB</span>}
                  </div>
                </div>
                <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{l.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedLoc ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
            </svg>
            <p style={{ margin: 0, fontWeight: 600 }}>Selecteaza o locatie din stanga</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>pentru a gestiona QR-urile si setarile mobile</p>
          </div>
        ) : (
          <>
            {/* Location header + tabs */}
            <div style={{ padding: '20px 28px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{selectedLoc.name}</h2>
                  <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>ID: {selectedLoc.id}</p>
                </div>
                {/* Tab actions */}
                {activeTab === 'qr' && savedCount > 0 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="um-btn um-btn--ghost" onClick={downloadAll}>Descarca toate</button>
                    {!confirmClear ? (
                      <button className="um-btn um-btn--danger" onClick={() => setConfirmClear(true)}>Sterge QR-urile</button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 30, padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}>
                        <span style={{ color: '#ef4444' }}>Sigur?</span>
                        <button className="um-btn um-btn--danger um-btn--sm" onClick={handleDeleteQr} disabled={savingQr}>Da, sterge</button>
                        <button className="um-btn um-btn--ghost um-btn--sm" onClick={() => setConfirmClear(false)}>Nu</button>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'settings' && (
                  <button
                    onClick={saveMobileSettings} disabled={savingMob}
                    style={{ padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.3s', background: mobSaved ? '#10b981' : '#0f172a', color: '#fff', boxShadow: mobSaved ? '0 4px 14px rgba(16,185,129,0.4)' : '0 4px 14px rgba(15,23,42,0.2)' }}
                  >
                    {mobSaved ? 'Salvat!' : savingMob ? 'Se salveaza...' : 'Salveaza Setarile Mobile'}
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0 }}>
                {[['qr','Coduri QR'],['settings','Setari Mobile']].map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.15s', borderRadius: 0,
                      borderBottom: activeTab === tab ? '2px solid #0f766e' : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === tab ? '#0f766e' : 'var(--text-muted)',
                    }}>{label}</button>
                ))}
              </div>
            </div>

            {/* TAB CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

              {/* ══ QR TAB ══════════════════════════════════════ */}
              {activeTab === 'qr' && (
                <>
                  {/* Brand + table count bar */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Brand</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {BRANDS.map(b => (
                          <button key={b.id} onClick={() => setBrandId(b.id)}
                            style={{ padding: '7px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: `1.5px solid ${brandId === b.id ? b.color : 'var(--border)'}`, background: brandId === b.id ? b.color : 'var(--surface)', color: brandId === b.id ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <img src={b.logo} alt="" style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                            {b.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Nr. mese</label>
                      <input type="number" min="1" max="200" value={tableCount} onChange={e => setTableCount(parseInt(e.target.value) || 1)} className="um-input" style={{ width: 90 }} />
                    </div>
                    <button className="qr-gen-btn" onClick={handleGenerate} disabled={savingQr} style={{ background: selectedBrand.color, alignSelf: 'flex-end', marginBottom: 0 }}>
                      {savingQr ? 'Se salveaza...' : savedCount > 0 ? `Actualizeaza (${tableCount} mese)` : `Genereaza ${tableCount} QR-uri`}
                    </button>
                  </div>

                  {savedCount > 0 ? (
                    <div className="qr-grid">
                      {Array.from({ length: savedCount }).map((_, i) => {
                        const n = i + 1;
                        const qrUrl = `${QR_WEB_BASE}/?brand=${brandId}&table=${n}&loc=${locId}`;
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
                    <div style={{ padding: 40, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', textAlign: 'center' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                      </svg>
                      <h3 style={{ margin: '0 0 8px', color: 'var(--text)' }}>Niciun QR generat pentru {selectedBrand.name} la {selectedLoc.name}</h3>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 440, display: 'inline-block', lineHeight: 1.6 }}>
                        Alege numarul de mese si apasa <strong>Genereaza</strong>. QR-urile sunt salvate permanent si pot fi sterse doar de administrator.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ══ SETTINGS TAB (identic cu KioskSettingsForm) ══ */}
              {activeTab === 'settings' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px,1fr))', gap: 24 }}>

                  {/* ─ Screensaver ─ */}
                  <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, border: '1px solid rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0, fontSize: '1.05rem', color: 'var(--text)' }}>Screensaver Standby</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>Reclama full-screen daca telefonul sta neatins.</p>

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

                  {/* ─ Banner Top ─ */}
                  <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, border: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>Banner Promo (Sus)</h3>
                      <Toggle checked={useBanner} onChange={setUseBanner} />
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>Banda ingusta in partea de sus a aplicatiei mobile (reclama video/imagine).</p>

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

                        <div style={{ marginTop: 8, padding: 16, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
                            <span>Inaltime Banner</span><span style={{ color: 'var(--text)' }}>Nivel {mob.topBannerHeight} / 5</span>
                          </label>
                          <input type="range" min="1" max="5" step="1" value={mob.topBannerHeight}
                            onChange={e => hm('topBannerHeight', parseInt(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />

                          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                            {[['topBannerRadiusTop','Colturi Sus Rotunde'],['topBannerRadiusBottom','Colturi Jos Rotunde']].map(([key, lbl]) => (
                              <label key={key} className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{lbl}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="checkbox" checked={mob[key]} onChange={e => hm(key, e.target.checked)} />
                                  <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ─ Banner Jos ─ */}
                  <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, border: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>Banner Promo (Jos)</h3>
                      <Toggle checked={useBottomBanner} onChange={setUseBottomBanner} />
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>Apare in partea de jos a aplicatiei mobile. Suporta video/imagine sau text derulant.</p>

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

                        <div style={{ display: 'flex', gap: 10 }}>
                          {[['bottomBannerRadiusTop','Colturi Sus Rotunde'],['bottomBannerRadiusBottom','Colturi Jos Rotunde']].map(([key, lbl]) => (
                            <label key={key} className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{lbl}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={mob[key]} onChange={e => hm(key, e.target.checked)} />
                                <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
}
