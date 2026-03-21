import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const BRAND_COLORS = { smashme: '#ef4444', sushimaster: '#3b82f6' };
const BRAND_EMOJI  = { smashme: '🍔', sushimaster: '🍣' };

const STATUS_LABELS = {
  pending:   { label: 'Nou',       color: '#f59e0b' },
  preparing: { label: 'Pregătire', color: '#3b82f6' },
  ready:     { label: 'Gata',      color: '#10b981' },
  delivered: { label: 'Livrat',    color: '#8b5cf6' },
};

export default function AdminApp() {
  const [tab,       setTab]       = useState('orders'); // orders | menu | kiosks | stats
  const [orders,    setOrders]    = useState([]);
  const [menuStatus,setMenuStatus]= useState(null);
  const [connected, setConnected] = useState(false);
  const [brandFilter, setBrandFilter] = useState('all');
  const [notifications, setNotifs]= useState([]);
  const socketRef = useRef(null);

  /* ─── Socket.IO ─────────────────────────────────── */
  useEffect(() => {
    const socket = io(BACKEND, { reconnectionAttempts: 10 });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { role: 'admin' });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('new_order', order => {
      setOrders(prev => [order, ...prev]);
      addNotif(`🆕 Comandă #${order.orderNumber} — ${order.brand} — ${(order.totalAmount||0).toFixed(0)} lei`);
    });
    socket.on('order_status_updated', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status } : o));
    });
    return () => socket.disconnect();
  }, []);

  /* ─── Load initial orders ────────────────────────── */
  useEffect(() => {
    fetch(`${BACKEND}/api/orders?limit=100`)
      .then(r => r.json())
      .then(d => setOrders(d.orders || []))
      .catch(() => {});
  }, []);

  /* ─── Load menu status ───────────────────────────── */
  const fetchMenuStatus = useCallback(() => {
    fetch(`${BACKEND}/api/menu/status`)
      .then(r => r.json())
      .then(d => setMenuStatus(d))
      .catch(() => {});
  }, []);
  useEffect(() => { if (tab === 'menu') fetchMenuStatus(); }, [tab, fetchMenuStatus]);

  const addNotif = (msg) => {
    const id = Date.now();
    setNotifs(prev => [{ id, msg }, ...prev.slice(0, 4)]);
    setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== id)), 6000);
  };

  /* ─── Stats ──────────────────────────────────────── */
  const stats = {
    total:     orders.length,
    pending:   orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
    revenue:   orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
    smashme:   orders.filter(o => o.brand === 'smashme').length,
    sushimaster: orders.filter(o => o.brand === 'sushimaster').length,
  };

  const filteredOrders = brandFilter === 'all'
    ? orders
    : orders.filter(o => o.brand === brandFilter);

  return (
    <div className="admin-app">
      {/* ─── Sidebar ─── */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span className="al-icon">⚙️</span>
          <span className="al-text">Smart Kiosk<br/><small>Admin Panel</small></span>
        </div>
        <nav className="admin-nav">
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'orders',    icon: '📋', label: 'Comenzi' },
            { id: 'kiosks',    icon: '📺', label: 'Kioskuri' },
            { id: 'qrcodes',   icon: '📱', label: 'QR Coduri' },
            { id: 'menu',      icon: '🍽',  label: 'Meniu / Syrve' },
          ].map(item => (
            <button
              key={item.id}
              className={`anav-btn ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className="anav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={`admin-conn ${connected ? 'conn--ok' : 'conn--off'}`}>
          <span className="conn-dot" />
          {connected ? 'Live' : 'Offline'}
        </div>

        <div className="admin-links">
          <a href="http://localhost:4012" target="_blank" rel="noreferrer">📺 Kitchen Display</a>
          <a href="http://localhost:4010/?brand=smashme" target="_blank" rel="noreferrer">🍔 Kiosk SmashMe</a>
          <a href="http://localhost:4010/?brand=sushimaster" target="_blank" rel="noreferrer">🍣 Kiosk Sushi</a>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="admin-main">
        {/* Notifications */}
        <div className="notif-stack">
          {notifications.map(n => (
            <div key={n.id} className="notif">{n.msg}</div>
          ))}
        </div>

        {/* ─── DASHBOARD ─── */}
        {tab === 'dashboard' && (
          <div className="admin-section">
            <h2 className="section-title">📊 Dashboard — Azi</h2>
            <div className="stat-grid">
              <StatCard icon="📋" label="Total comenzi" value={stats.total} color="var(--primary)" />
              <StatCard icon="🟡" label="Noi / Așteptare" value={stats.pending}   color="var(--warning)" />
              <StatCard icon="🔵" label="În pregătire"   value={stats.preparing} color="var(--cyan)" />
              <StatCard icon="🟢" label="Gata ridicare"  value={stats.ready}     color="var(--success)" />
              <StatCard icon="💰" label="Venituri"        value={`${stats.revenue.toFixed(0)} lei`} color="var(--success)" large />
              <StatCard icon={BRAND_EMOJI.smashme} label="SmashMe comenzi"   value={stats.smashme} color={BRAND_COLORS.smashme} />
              <StatCard icon={BRAND_EMOJI.sushimaster} label="SushiMaster comenzi" value={stats.sushimaster} color={BRAND_COLORS.sushimaster} />
            </div>

            <h3 className="sub-title">Ultimele 10 comenzi</h3>
            <OrdersTable orders={orders.slice(0, 10)} />
          </div>
        )}

        {/* ─── ORDERS ─── */}
        {tab === 'orders' && (
          <div className="admin-section">
            <div className="section-header">
              <h2 className="section-title">📋 Comenzi</h2>
              <div className="brand-tabs">
                {['all','smashme','sushimaster'].map(b => (
                  <button
                    key={b}
                    className={`brand-tab ${brandFilter === b ? 'active' : ''}`}
                    style={b !== 'all' ? { '--bc': BRAND_COLORS[b] } : {}}
                    onClick={() => setBrandFilter(b)}
                  >
                    {b === 'all' ? 'Toate' : `${BRAND_EMOJI[b]} ${b === 'smashme' ? 'SmashMe' : 'SushiMaster'}`}
                  </button>
                ))}
              </div>
            </div>
            <OrdersTable orders={filteredOrders} full />
          </div>
        )}

        {/* ─── MENU ─── */}
        {tab === 'menu' && (
          <div className="admin-section">
            <div className="section-header">
              <h2 className="section-title">🍽 Meniu din Syrve</h2>
              <button className="btn-refresh" onClick={fetchMenuStatus}>🔄 Refresh</button>
            </div>
            {!menuStatus ? (
              <p className="loading-text">Se încarcă...</p>
            ) : menuStatus.error ? (
              <div className="error-box">{menuStatus.error}</div>
            ) : (
              <div className="menu-status-grid">
                {menuStatus.brands?.map(b => (
                  <div key={b.brandId} className="menu-status-card"
                       style={{ '--bc': BRAND_COLORS[b.brandId] || 'var(--primary)' }}>
                    <div className="ms-header">
                      <span className="ms-brand">{BRAND_EMOJI[b.brandId]} {b.name || b.brandId}</span>
                      <span className="ms-badge">{b.source}</span>
                    </div>
                    <div className="ms-stats">
                      <div className="ms-stat"><span>Categorii</span><strong>{b.categories}</strong></div>
                      <div className="ms-stat"><span>Produse</span><strong>{b.products}</strong></div>
                    </div>
                    <div className="ms-sync">Sincronizat: {b.syncedAt ? new Date(b.syncedAt).toLocaleTimeString('ro-RO') : 'N/A'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── KIOSKS / POSTER ─── */}
        {tab === 'kiosks' && (
          <div className="admin-section">
            <h2 className="section-title">📺 Kioskuri — Poster Promo</h2>
            <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Setează o imagine, video sau link care apare pe ecranul kiosk-ului când e inactiv. Când clientul atinge ecranul, intră în modul de comandă.</p>
            <KioskLocationList backend={BACKEND} />
          </div>
        )}

        {/* ─── QR CODE GENERATOR ─── */}
        {tab === 'qrcodes' && (
          <div className="admin-section">
            <h2 className="section-title">📱 Generator QR Coduri</h2>
            <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Generează coduri QR pentru mese. Clienții scanează QR-ul și comandă direct de pe telefon.</p>
            <QrGenerator backend={BACKEND} />
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color, large }) {
  return (
    <div className={`stat-card ${large ? 'stat-card--large' : ''}`} style={{ '--sc': color }}>
      <span className="sc-icon">{icon}</span>
      <span className="sc-value">{value}</span>
      <span className="sc-label">{label}</span>
    </div>
  );
}

function OrdersTable({ orders, full }) {
  if (!orders || orders.length === 0)
    return <p className="empty-text">Nicio comandă</p>;

  return (
    <div className="orders-table-wrap">
      <table className="orders-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Brand</th>
            <th>Canal</th>
            <th>Tip</th>
            <th>Produse</th>
            <th>Total</th>
            <th>Status</th>
            <th>Ora</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const sc = STATUS_LABELS[o.status] || { label: o.status, color: '#6b7a99' };
            return (
              <tr key={o._id}>
                <td><strong>#{o.orderNumber}</strong></td>
                <td>
                  <span style={{ color: BRAND_COLORS[o.brand] }}>
                    {BRAND_EMOJI[o.brand]} {o.brand}
                  </span>
                </td>
                <td><span className="tag">{o.channel}</span></td>
                <td>{o.orderType === 'dine-in' ? `🪑 Masa ${o.tableNumber}` : '🛍 Caserie'}</td>
                <td>{(o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ').slice(0, 40)}...</td>
                <td><strong>{(o.totalAmount || 0).toFixed(0)} lei</strong></td>
                <td><span className="status-pill" style={{ background: sc.color + '22', color: sc.color }}>● {sc.label}</span></td>
                <td className="time-col">{o.createdAt ? new Date(o.createdAt).toLocaleTimeString('ro-RO') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KioskPosterCard({ brandId, brandName, emoji, backend }) {
  const [url, setUrl]         = useState('');
  const [type, setType]       = useState('image');
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing config
  useEffect(() => {
    fetch(`${backend}/api/admin/kiosk-config/${brandId}`)
      .then(r => r.json())
      .then(d => {
        if (d.poster) {
          setUrl(d.poster.url || '');
          setType(d.poster.type || 'image');
          setEnabled(d.poster.enabled !== false);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, backend]);

  const save = async () => {
    try {
      await fetch(`${backend}/api/admin/kiosk-config/${brandId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type, enabled }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Save failed:', e);
    }
  };

  const remove = async () => {
    await fetch(`${backend}/api/admin/kiosk-config/${brandId}`, { method: 'DELETE' });
    setUrl('');
    setType('image');
    setEnabled(false);
  };

  if (loading) return <div className="poster-card"><p>Se încarcă...</p></div>;

  // Auto-detect type from URL
  const detectType = (u) => {
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return 'video';
    if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u)) return 'image';
    if (/youtube|vimeo|dailymotion/i.test(u)) return 'iframe';
    return 'image';
  };

  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    if (newUrl) setType(detectType(newUrl));
  };

  return (
    <div className="poster-card" style={{ '--bc': brandId === 'smashme' ? '#ef4444' : '#3b82f6' }}>
      <div className="pc-header">
        <span className="pc-brand">{emoji} {brandName}</span>
        <label className="pc-toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="toggle-slider" />
          <span>{enabled ? 'Activ' : 'Inactiv'}</span>
        </label>
      </div>

      <div className="pc-form">
        <label className="pc-label">Link poster (imagine, video, sau pagină web)</label>
        <input
          className="pc-input"
          type="url"
          placeholder="https://example.com/promo.jpg"
          value={url}
          onChange={handleUrlChange}
        />

        <div className="pc-type-row">
          <label className="pc-label" style={{marginBottom: 0}}>Tip conținut:</label>
          <div className="pc-type-btns">
            {['image', 'video', 'iframe'].map(t => (
              <button
                key={t}
                className={`pc-type-btn ${type === t ? 'active' : ''}`}
                onClick={() => setType(t)}
              >
                {t === 'image' ? '🖼 Imagine' : t === 'video' ? '🎬 Video' : '🌐 Pagină web'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      {url && (
        <div className="pc-preview">
          <span className="pc-label">Preview:</span>
          <div className="pc-preview-box">
            {type === 'image' && <img src={url} alt="Preview" onError={e => e.target.src=''} />}
            {type === 'video' && <video src={url} autoPlay muted loop />}
            {type === 'iframe' && <iframe src={url} title="Preview" />}
          </div>
        </div>
      )}

      <div className="pc-actions">
        <button className="btn-save" onClick={save}>
          {saved ? '✅ Salvat!' : '💾 Salvează'}
        </button>
        {url && <button className="btn-delete" onClick={remove}>🗑 Șterge</button>}
      </div>
    </div>
  );
}

function KioskLocationList({ backend }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expandedBrand, setExpandedBrand] = useState(null);
  const [selectedLoc, setSelectedLoc]     = useState(null);
  const [brandFilter, setBrandFilter]     = useState('all');

  useEffect(() => {
    fetch(`${backend}/api/locations`)
      .then(r => r.json())
      .then(d => {
        setLocations(d.locations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [backend]);

  if (loading) return <p className="loading-text">Se încarcă locațiile...</p>;

  const brandMeta = {
    smashme:     { name: 'SmashMe',       emoji: '🍔', color: '#ef4444' },
    sushimaster: { name: 'Sushi Master',  emoji: '🍣', color: '#3b82f6' },
    ikura:       { name: 'Ikura',         emoji: '🍣', color: '#d4af37' },
    welovesushi: { name: 'WeLoveSushi',   emoji: '❤️', color: '#ec4899' },
  };

  // Unique brands from locations
  const brandIds = [...new Set(locations.map(l => l.brandId))];

  // Filter locations by selected brand
  const filtered = brandFilter === 'all' ? locations : locations.filter(l => l.brandId === brandFilter);

  // Group filtered locations by brandId
  const grouped = {};
  for (const loc of filtered) {
    if (!grouped[loc.brandId]) grouped[loc.brandId] = [];
    grouped[loc.brandId].push(loc);
  }

  return (
    <div className="kiosk-location-list">
      {/* Brand filter */}
      <div className="kl-brand-filter">
        <button
          className={`kl-filter-btn ${brandFilter === 'all' ? 'active' : ''}`}
          onClick={() => setBrandFilter('all')}
        >
          Toate ({locations.length})
        </button>
        {brandIds.map(bid => {
          const m = brandMeta[bid] || { name: bid, emoji: '📍', color: '#6b7a99' };
          const count = locations.filter(l => l.brandId === bid).length;
          return (
            <button
              key={bid}
              className={`kl-filter-btn ${brandFilter === bid ? 'active' : ''}`}
              style={{ '--bc': m.color }}
              onClick={() => setBrandFilter(bid)}
            >
              {m.emoji} {m.name} ({count})
            </button>
          );
        })}
      </div>

      {Object.entries(grouped).map(([brandId, locs]) => {
        const meta = brandMeta[brandId] || { name: brandId, emoji: '📍', color: '#6b7a99' };
        const isExpanded = expandedBrand === brandId;

        return (
          <div key={brandId} className="kl-brand-group">
            <button
              className="kl-brand-header"
              style={{ '--bc': meta.color }}
              onClick={() => setExpandedBrand(isExpanded ? null : brandId)}
            >
              <span className="kl-brand-name">{meta.emoji} {meta.name}</span>
              <span className="kl-brand-count">{locs.length} locații</span>
              <span className="kl-expand">{isExpanded ? '▼' : '▶'}</span>
            </button>

            {isExpanded && (
              <div className="kl-locations">
                {locs.map(loc => (
                  <div key={loc.id} className="kl-location-row">
                    <div className="kl-loc-info">
                      <span className={`kl-status ${loc.active ? 'kl-online' : 'kl-offline'}`} />
                      <span className="kl-loc-name">{loc.name}</span>
                      <span className="kl-loc-id">{loc.id}</span>
                    </div>
                    <button
                      className="kl-poster-btn"
                      onClick={() => setSelectedLoc(selectedLoc?.id === loc.id ? null : loc)}
                    >
                      🖼 Poster
                    </button>
                  </div>
                ))}

                {selectedLoc && grouped[brandId]?.some(l => l.id === selectedLoc.id) && (
                  <div className="kl-poster-panel">
                    <KioskPosterCard
                      brandId={selectedLoc.id}
                      brandName={selectedLoc.name}
                      emoji={meta.emoji}
                      backend={backend}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── QR GENERATOR ──────────────────────────────────────────────────── */
function QrGenerator({ backend }) {
  const [brand, setBrand] = useState('smashme');
  const [loc, setLoc] = useState('1');
  const [tableCount, setTableCount] = useState(10);
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(false);

  const QR_WEB_BASE = 'https://loquacious-madeleine-ed11d3.netlify.app';

  const brands = [
    { id: 'smashme', name: 'SmashMe', emoji: '🍔', color: '#ef4444' },
    { id: 'sushimaster', name: 'Sushi Master', emoji: '🍣', color: '#3b82f6' },
    { id: 'ikura', name: 'Ikura', emoji: '🥢', color: '#f97316' },
    { id: 'welovesushi', name: 'We Love Sushi', emoji: '🍱', color: '#8b5cf6' },
  ];

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backend}/api/qr/location/${loc}?brand=${brand}&tables=${tableCount}`);
      const data = await res.json();
      setQrs(data.qrs || []);
    } catch (err) {
      console.error('QR gen error:', err);
      setQrs([]);
    }
    setLoading(false);
  };

  const downloadQr = (dataUrl, tableNum) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${brand}-masa-${tableNum}.png`;
    a.click();
  };

  const downloadAll = () => {
    qrs.forEach((q, i) => {
      setTimeout(() => downloadQr(q.dataUrl, q.tableNumber), i * 200);
    });
  };

  const selectedBrand = brands.find(b => b.id === brand) || brands[0];

  return (
    <div className="qr-gen">
      {/* Controls */}
      <div className="qr-controls">
        <div className="qr-field">
          <label>Brand</label>
          <div className="qr-brand-pills">
            {brands.map(b => (
              <button
                key={b.id}
                className={`qr-brand-pill ${brand === b.id ? 'active' : ''}`}
                style={brand === b.id ? { background: b.color, borderColor: b.color } : {}}
                onClick={() => setBrand(b.id)}
              >
                {b.emoji} {b.name}
              </button>
            ))}
          </div>
        </div>

        <div className="qr-field-row">
          <div className="qr-field">
            <label>Locație ID</label>
            <input type="text" value={loc} onChange={e => setLoc(e.target.value)} placeholder="ex: 1" />
          </div>
          <div className="qr-field">
            <label>Număr mese</label>
            <input type="number" min="1" max="50" value={tableCount} onChange={e => setTableCount(parseInt(e.target.value) || 1)} />
          </div>
        </div>

        <button className="qr-gen-btn" onClick={generate} disabled={loading} style={{ background: selectedBrand.color }}>
          {loading ? '⏳ Generez...' : `${selectedBrand.emoji} Generează ${tableCount} QR Coduri`}
        </button>
      </div>

      {/* Results */}
      {qrs.length > 0 && (
        <div className="qr-results">
          <div className="qr-results-header">
            <h3>{selectedBrand.emoji} {selectedBrand.name} — {qrs.length} coduri generate</h3>
            <button className="qr-dl-all" onClick={downloadAll}>📥 Descarcă toate</button>
          </div>

          <div className="qr-grid">
            {qrs.map(q => (
              <div key={q.tableNumber} className="qr-card">
                <div className="qr-card-header" style={{ background: selectedBrand.color }}>
                  Masa {q.tableNumber}
                </div>
                <img src={q.dataUrl} alt={`QR Masa ${q.tableNumber}`} className="qr-card-img" />
                <div className="qr-card-url">{QR_WEB_BASE}/?brand={brand}&table={q.tableNumber}&loc={loc}</div>
                <button className="qr-card-dl" onClick={() => downloadQr(q.dataUrl, q.tableNumber)}>
                  📥 Descarcă PNG
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
