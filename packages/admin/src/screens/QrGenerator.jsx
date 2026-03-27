import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { QRCodeCanvas } from 'qrcode.react';

const QR_WEB_BASE = 'https://qr-restaurants.netlify.app';

const BRANDS = [
  { id: 'smashme', name: 'SmashMe', color: '#ef4444', logo: '/brands/smashme-logo.png' },
  { id: 'sushimaster', name: 'Sushi Master', color: '#3b82f6', logo: '/brands/sushimaster-logo.png' },
  { id: 'ikura', name: 'Ikura', color: '#f97316', logo: '/brands/ikura-logo.png' },
  { id: 'welovesushi', name: 'We Love Sushi', color: '#8b5cf6', logo: '/brands/welovesushi-logo.png' },
];

function BrandPill({ brand, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s',
        border: `1.5px solid ${active ? brand.color : 'var(--border)'}`,
        background: active ? brand.color : 'var(--surface)',
        color: active ? '#fff' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      <img src={brand.logo} alt={brand.name} style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'contain' }}
        onError={e => e.target.style.display = 'none'} />
      {brand.name}
    </button>
  );
}

export default function QrGenerator({ backend }) {
  const { fetchWithAuth } = useAuth();
  const [brandId, setBrandId] = useState('smashme');
  const [locId, setLocId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loadingLocs, setLoadingLocs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableCount, setTableCount] = useState(10);
  const [confirmClear, setConfirmClear] = useState(false);
  const [locSearch, setLocSearch] = useState('');

  useEffect(() => {
    fetchWithAuth(`${backend}/api/locations`)
      .then(res => res.json())
      .then(data => {
        const locs = (data.locations || data || [])
          .filter(l => !l.id?.includes('main') && !l.id?.includes('template'));
        setLocations(locs);
        // NO auto-selection: user must choose explicitly
        setLoadingLocs(false);
      })
      .catch(() => setLoadingLocs(false));
  }, [backend, fetchWithAuth]);

  const selectedLoc = locations.find(l => l.id === locId);
  const selectedBrand = BRANDS.find(b => b.id === brandId) || BRANDS[0];
  const savedCount = selectedLoc?.data?.qrConfig?.[brandId] || 0;

  useEffect(() => {
    if (savedCount > 0) setTableCount(savedCount);
    else setTableCount(10);
  }, [brandId, locId, savedCount]);

  const filteredLocs = locations.filter(l =>
    l.name?.toLowerCase().includes(locSearch.toLowerCase()) ||
    l.id?.toLowerCase().includes(locSearch.toLowerCase())
  );

  const handleGenerate = async () => {
    if (!selectedLoc) return;
    setSaving(true);
    try {
      const updatedData = {
        ...selectedLoc.data,
        qrConfig: { ...(selectedLoc.data?.qrConfig || {}), [brandId]: tableCount },
      };
      const res = await fetchWithAuth(`${backend}/api/locations/${locId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedLoc, data: updatedData }),
      });
      if (res.ok) {
        setLocations(prev => prev.map(l => l.id === locId ? { ...l, data: updatedData } : l));
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedLoc) return;
    setSaving(true);
    setConfirmClear(false);
    try {
      const qrConfig = { ...(selectedLoc.data?.qrConfig || {}) };
      delete qrConfig[brandId];
      const updatedData = { ...selectedLoc.data, qrConfig };
      const res = await fetchWithAuth(`${backend}/api/locations/${locId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedLoc, data: updatedData }),
      });
      if (res.ok) setLocations(prev => prev.map(l => l.id === locId ? { ...l, data: updatedData } : l));
    } catch (err) {}
    setSaving(false);
  };

  const downloadQr = (n) => {
    const canvas = document.getElementById(`qr-canvas-${n}`);
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${brandId}-${locId}-masa-${n}.png`;
    a.click();
  };

  const downloadAll = () => {
    for (let i = 1; i <= savedCount; i++) setTimeout(() => downloadQr(i), i * 200);
  };

  if (loadingLocs) return <p style={{ color: 'var(--text-muted)', padding: 40 }}>Se incarca locatiile...</p>;
  if (!locations.length) return <p style={{ color: 'var(--text-muted)', padding: 40 }}>Nu ai nicio locatie creata.</p>;

  return (
    <div style={{
      display: 'flex', gap: 0, minHeight: '75vh',
      borderRadius: 20, border: '1px solid var(--border)',
      overflow: 'hidden', background: 'var(--surface)',
    }}>
      {/* ── LEFT: Location List ── */}
      <div style={{
        width: 280, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Locatii ({locations.length})
          </p>
          <input
            className="um-search"
            placeholder="Cauta locatie..."
            value={locSearch}
            onChange={e => setLocSearch(e.target.value)}
            style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {filteredLocs.map(l => {
            const hasQr = !!(l.data?.qrConfig?.[brandId]);
            const isActive = locId === l.id;
            return (
              <button
                key={l.id}
                onClick={() => { setLocId(l.id); setConfirmClear(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px',
                  borderRadius: 10, border: 'none', cursor: 'pointer',
                  transition: 'all 0.15s', marginBottom: 2,
                  background: isActive ? 'rgba(15,118,110,0.1)' : 'transparent',
                  borderLeft: isActive ? '3px solid #0f766e' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: '0.875rem', fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#0f766e' : 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{l.name}</span>
                  {hasQr && (
                    <span style={{
                      flexShrink: 0, background: '#dcfce7', color: '#15803d',
                      borderRadius: 20, padding: '2px 7px', fontSize: '0.72rem', fontWeight: 700,
                    }}>{l.data.qrConfig[brandId]} QR</span>
                  )}
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{l.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Config + QR Grid ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedLoc ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', gap: 12,
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
            </svg>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>Selecteaza o locatie din stanga</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>pentru a genera sau vizualiza coduri QR</p>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{selectedLoc.name}</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {selectedLoc.id}</p>
              </div>
              {savedCount > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="um-btn um-btn--ghost" onClick={downloadAll}>Descarca toate</button>
                  {!confirmClear ? (
                    <button className="um-btn um-btn--danger" onClick={() => setConfirmClear(true)}>Sterge QR-urile</button>
                  ) : (
                    <div style={{
                      display: 'flex', gap: 6, alignItems: 'center',
                      background: '#fef2f2', border: '1px solid #fca5a5',
                      borderRadius: 30, padding: '6px 12px',
                      fontSize: '0.85rem', fontWeight: 600,
                    }}>
                      <span style={{ color: '#ef4444' }}>Sigur?</span>
                      <button className="um-btn um-btn--danger um-btn--sm" onClick={handleDelete} disabled={saving}>Da, sterge</button>
                      <button className="um-btn um-btn--ghost um-btn--sm" onClick={() => setConfirmClear(false)}>Nu</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Brand + table count bar */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Brand</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {BRANDS.map(b => <BrandPill key={b.id} brand={b} active={brandId === b.id} onClick={() => setBrandId(b.id)} />)}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Nr. mese</label>
                <input
                  type="number" min="1" max="200" value={tableCount}
                  onChange={e => setTableCount(parseInt(e.target.value) || 1)}
                  className="um-input" style={{ width: 90 }}
                />
              </div>
              <button
                className="qr-gen-btn" onClick={handleGenerate} disabled={saving}
                style={{ background: selectedBrand.color, alignSelf: 'flex-end', marginBottom: 0 }}
              >
                {saving ? 'Se salveaza...' : savedCount > 0 ? `Actualizeaza (${tableCount} mese)` : `Genereaza ${tableCount} QR-uri`}
              </button>
            </div>

            {/* QR grid or empty state */}
            {savedCount > 0 ? (
              <div className="qr-grid">
                {Array.from({ length: savedCount }).map((_, i) => {
                  const n = i + 1;
                  const qrUrl = `${QR_WEB_BASE}/?brand=${brandId}&table=${n}&loc=${locId}`;
                  return (
                    <div key={n} className="qr-card">
                      <div className="qr-card-header" style={{ background: selectedBrand.color }}>Masa {n}</div>
                      <div style={{ padding: 12, display: 'flex', justifyContent: 'center', background: '#fff' }}>
                        <QRCodeCanvas
                          id={`qr-canvas-${n}`}
                          value={qrUrl}
                          size={200}
                          level="H"
                          includeMargin={true}
                          imageSettings={{ src: selectedBrand.logo, height: 48, width: 48, excavate: true }}
                        />
                      </div>
                      <div className="qr-card-url">{qrUrl}</div>
                      <button className="qr-card-dl" onClick={() => downloadQr(n)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
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
                  <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
                  <rect x="18" y="19" width="3" height="2"/>
                </svg>
                <h3 style={{ margin: '0 0 8px', color: 'var(--text)' }}>Niciun QR generat pentru {selectedBrand.name} la {selectedLoc.name}</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 440, display: 'inline-block', lineHeight: 1.6 }}>
                  Alege numarul de mese si apasa <strong>Genereaza</strong>. QR-urile sunt salvate permanent si pot fi sterse doar de administrator.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
