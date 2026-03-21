import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import { useAuth } from './context/AuthProvider';
import LoginScreen from './screens/LoginScreen';
import UsersManager from './screens/UsersManager';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const BRAND_COLORS = { smashme: '#ef4444', sushimaster: '#3b82f6' };

function BrandLogo({ brandId, size = 18 }) {
  const logos = {
    smashme: '/brands/smashme-logo.png',
    sushimaster: '/brands/sushimaster-logo.png',
    welovesushi: '/brands/welovesushi-logo.png',
    ikura: '/brands/ikura-logo.png'
  };
  const src = logos[brandId];
  if (src) return <img src={src} alt={brandId} style={{ height: size, maxWidth: '80px', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }} />;
  return <span style={{ fontSize: size * 0.8, fontWeight: 700, opacity: 0.6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{brandId}</span>;
}

const STATUS_LABELS = {
  pending:   { label: 'Nou',       color: '#f59e0b' },
  preparing: { label: 'Pregătire', color: '#3b82f6' },
  ready:     { label: 'Gata',      color: '#10b981' },
  delivered: { label: 'Livrat',    color: '#8b5cf6' },
};

export default function AdminApp() {
  const { token, user, fetchWithAuth, logout } = useAuth();
  const [tab,       setTab]       = useState('orders'); // orders | menu | kiosks | stats
  const [orders,    setOrders]    = useState([]);
  const [menuStatus,setMenuStatus]= useState(null);
  const [connected, setConnected] = useState(false);
  const [brandFilter, setBrandFilter] = useState('all');
  const [notifications, setNotifs]= useState([]);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('admin-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  });
  const socketRef = useRef(null);

  /* ─── Theme Sync ─────────────────────────────────── */
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('admin-theme', theme);
  }, [theme]);

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
      if (!token) return <LoginScreen />;

  return () => socket.disconnect();
  }, []);

  /* ─── Load initial orders ────────────────────────── */
  useEffect(() => {
    fetchWithAuth(`${BACKEND}/api/orders?limit=100`)
      .then(r => r.json())
      .then(d => setOrders(d.orders || []))
      .catch(() => {});
  }, []);

  /* ─── Load menu status ───────────────────────────── */
  const fetchMenuStatus = useCallback(() => {
    fetchWithAuth(`${BACKEND}/api/menu/status`)
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
            { id: 'locations', icon: '📍', label: 'Locatii' },
            { id: 'kiosks',    icon: '📺', label: 'Kioskuri' },
            { id: 'qrcodes',   icon: '📱', label: 'QR Coduri' },
            { id: 'menu',      icon: '🍽',  label: 'Meniu / Syrve' },
            ...(user?.role === 'admin' ? [{ id: 'users', icon: '👥', label: 'Echipă' }] : []),
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

        {/* Theme Toggle */}
        <div style={{ padding: '0 10px', marginTop: 'auto' }}>
          <button 
            className="anav-btn"
            style={{ justifyContent: 'center', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️ Mod Luminos' : '🌙 Mod Întunecat'}
          </button>
        </div>

        <div className="admin-links">
          <button onClick={logout} style={{background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'none', padding:'8px 12px', borderRadius:'8px', cursor:'pointer', marginBottom:'10px', width:'100%'}}>🚪 Deconectare</button>
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
              <StatCard icon={<BrandLogo brandId="smashme" size={32} />} label="SmashMe comenzi"   value={stats.smashme} color={BRAND_COLORS.smashme} />
              <StatCard icon={<BrandLogo brandId="sushimaster" size={32} />} label="SushiMaster comenzi" value={stats.sushimaster} color={BRAND_COLORS.sushimaster} />
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
                    style={{ ...(b !== 'all' ? { '--bc': BRAND_COLORS[b] } : {}), display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setBrandFilter(b)}
                  >
                    {b === 'all' ? 'Toate' : <><BrandLogo brandId={b} size={14} /> {b === 'smashme' ? 'SmashMe' : 'SushiMaster'}</>}
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
                      <span className="ms-brand" style={{display:'flex', alignItems:'center', gap:'8px'}}><BrandLogo brandId={b.brandId} size={20} /> {b.name || b.brandId}</span>
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

        {/* ─── LOCATIONS ─── */}
        {tab === 'locations' && (
          <div className="admin-section">
            <h2 className="section-title">Locatii</h2>
            <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Gestioneaza locatiile si kioskurile alocate. Locatiile cu mai multe branduri permit comenzi mixte.</p>
            <LocationsManager backend={BACKEND} />
          </div>
        )}

        {/* ─── KIOSKS / SCREENSAVER ─── */}
        {tab === 'kiosks' && (
          <div className="admin-section">
            <h2 className="section-title">📺 Kioskuri — Link-uri și Screensaver</h2>
            <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Copiază link-ul necesar pentru tabletă sau setează screensaver-ul (imagine/video completă care rulează înainte de comandă).</p>
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
        {/* ─── USERS MANAGER ─── */}
        {tab === 'users' && <UsersManager />}
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
                  <span style={{ color: BRAND_COLORS[o.brand], display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BrandLogo brandId={o.brand} size={16} /> {o.brand}
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
  const { fetchWithAuth } = useAuth();
  const [url, setUrl]         = useState('');
  const [type, setType]       = useState('image');
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing config
  useEffect(() => {
    fetchWithAuth(`${backend}/api/admin/kiosk-config/${brandId}`)
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
      await fetchWithAuth(`${backend}/api/admin/kiosk-config/${brandId}`, {
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
    await fetchWithAuth(`${backend}/api/admin/kiosk-config/${brandId}`, { method: 'DELETE' });
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
        <span className="pc-brand" style={{display:'flex', alignItems:'center', gap:'8px'}}><BrandLogo brandId={brandId} size={20} /> {brandName}</span>
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
  const { fetchWithAuth } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expandedBrand, setExpandedBrand] = useState(null);
  const [selectedLoc, setSelectedLoc]     = useState(null);
  const [brandFilter, setBrandFilter]     = useState('all');

  useEffect(() => {
    fetchWithAuth(`${backend}/api/locations`)
      .then(r => r.json())
      .then(d => {
        setLocations(d.locations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [backend]);

  if (loading) return <p className="loading-text">Se încarcă locațiile...</p>;

  const brandMeta = {
    smashme:     { name: 'SmashMe',       color: '#ef4444' },
    sushimaster: { name: 'Sushi Master',  color: '#3b82f6' },
    ikura:       { name: 'Ikura',         color: '#d4af37' },
    welovesushi: { name: 'WeLoveSushi',   color: '#ec4899' },
  };

  const allBrandIds = new Set();
  locations.forEach(l => {
     if (l.brands && Array.isArray(l.brands)) l.brands.forEach(b => allBrandIds.add(b));
     else if (l.brandId) allBrandIds.add(l.brandId);
  });
  const brandIds = [...allBrandIds];

  const filtered = brandFilter === 'all' 
    ? locations 
    : locations.filter(l => (l.brands && l.brands.includes(brandFilter)) || l.brandId === brandFilter);

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
          const m = brandMeta[bid] || { name: bid, color: '#6b7a99' };
          const count = locations.filter(l => (l.brands && l.brands.includes(bid)) || l.brandId === bid).length;
          return (
            <button
              key={bid}
              className={`kl-filter-btn ${brandFilter === bid ? 'active' : ''}`}
              style={{ '--bc': m.color, display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setBrandFilter(bid)}
            >
              <BrandLogo brandId={bid} size={14} /> {m.name} ({count})
            </button>
          );
        })}
      </div>

      <div className="kl-brand-group">
        <div className="kl-locations" style={{ borderTop: 'none' }}>
           {filtered.map(loc => {
             const locBrand = (loc.brands?.[0]) || loc.brandId || 'smashme';
             return (
               <div key={loc.id} className="kl-location-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div className="kl-loc-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`kl-status ${loc.active ? 'kl-online' : 'kl-offline'}`} />
                      <span className="kl-loc-name" style={{fontSize: '1.05rem', fontWeight: 600}}>{loc.name}</span>
                      <span className="kl-loc-id" style={{opacity: 0.4, fontSize: '0.8rem'}}>({loc.id})</span>
                      <div style={{display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '6px'}}>
                        {(loc.brands && loc.brands.length > 0 ? loc.brands : [locBrand]).map(b => b ? <BrandLogo key={b} brandId={b} size={20} /> : null)}
                      </div>
                    </div>
                    <button
                      className="kl-poster-btn"
                      onClick={() => setSelectedLoc(selectedLoc?.id === loc.id ? null : loc)}
                    >
                      📺 Screensaver
                    </button>
                 </div>
                 
                 <div style={{ width: '100%', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Link Tabletă:</span>
                    <input 
                      type="text" 
                      readOnly 
                      value={loc.kioskUrl || `https://kiosk-smashme.netlify.app/?brand=${locBrand}&loc=${loc.id}`}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--primary)', outline: 'none' }}
                    />
                    <button 
                      style={{ background: 'var(--primary)', border: 'none', padding: '4px 12px', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}
                      onClick={() => {
                        navigator.clipboard.writeText(loc.kioskUrl || `https://kiosk-smashme.netlify.app/?brand=${locBrand}&loc=${loc.id}`);
                        alert('Link-ul a fost copiat!');
                      }}
                    >
                      Copiază
                    </button>
                 </div>

                 {selectedLoc?.id === loc.id && (
                   <div className="kl-poster-panel" style={{ width: '100%', marginTop: '8px' }}>
                     <KioskPosterCard
                       brandId={selectedLoc.id}
                       brandName={selectedLoc.name}
                       emoji=""
                       backend={backend}
                     />
                   </div>
                 )}
               </div>
             )
           })}
        </div>
      </div>
    </div>
  );
}

/* ─── QR GENERATOR ──────────────────────────────────────────────────── */
function QrGenerator({ backend }) { 
  const { fetchWithAuth } = useAuth();
  const [brand, setBrand] = useState('smashme');
  const [loc, setLoc] = useState('1');
  const [tableCount, setTableCount] = useState(10);
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(false);

  const QR_WEB_BASE = 'https://loquacious-madeleine-ed11d3.netlify.app';

  const brands = [
    { id: 'smashme', name: 'SmashMe', color: '#ef4444' },
    { id: 'sushimaster', name: 'Sushi Master', color: '#3b82f6' },
    { id: 'ikura', name: 'Ikura', color: '#f97316' },
    { id: 'welovesushi', name: 'We Love Sushi', color: '#8b5cf6' },
  ];

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${backend}/api/qr/location/${loc}?brand=${brand}&tables=${tableCount}`);
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
                style={{ ...(brand === b.id ? { background: b.color, borderColor: b.color } : {}), display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setBrand(b.id)}
              >
                <BrandLogo brandId={b.id} size={14} /> {b.name}
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

/* ─── LOCATIONS MANAGER ──────────────────────────────────── */
const BRAND_LABELS = { smashme: 'SmashMe', sushimaster: 'Sushi Master', ikura: 'Ikura', welovesushi: 'WeLoveSushi' };
const BRAND_PILL_COLORS = { smashme: '#ef4444', sushimaster: '#3b82f6', ikura: '#8b5cf6', welovesushi: '#ec4899' };

function LocationsManager({ backend }) { 
  const { fetchWithAuth } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [newName, setNewName] = useState('');
  const [newBrands, setNewBrands] = useState([]);
  const [newTables, setNewTables] = useState(10);
  const [filter, setFilter] = useState('all');

  const fetchLocs = () => {
    setLoading(true);
    fetchWithAuth(`${backend}/api/locations`)
      .then(r => r.json())
      .then(d => { setLocations(d.locations || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(fetchLocs, [backend]);

  const toggleBrand = (b) => {
    setNewBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  };

  const createLocation = () => {
    if (!newName.trim()) return;
    fetchWithAuth(`${backend}/api/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, brands: newBrands, tables: newTables }),
    })
      .then(r => r.json())
      .then(() => { setNewName(''); setNewBrands([]); setNewTables(10); setShowAdd(false); fetchLocs(); });
  };

  const toggleActive = (loc) => {
    fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !loc.active }),
    }).then(() => fetchLocs());
  };

  const deleteLoc = (id) => {
    if (!confirm('Stergi aceasta locatie?')) return;
    fetchWithAuth(`${backend}/api/locations/${id}`, { method: 'DELETE' })
      .then(() => fetchLocs());
  };

  const filtered = filter === 'all' ? locations : locations.filter(l => l.brands?.includes(filter));

  if (loading) return <p style={{color:'var(--text-muted)'}}>Se incarca...</p>;

  if (editingLoc) {
    return <LocationEditForm loc={editingLoc} backend={backend} onBack={() => setEditingLoc(null)} onSave={fetchLocs} />;
  }

  return (
    <div className="loc-manager">
      {/* Filters + Add button */}
      <div className="loc-controls">
        <div className="loc-filters">
          <button className={`loc-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            Toate ({locations.length})
          </button>
          {Object.entries(BRAND_LABELS).map(([k, v]) => {
            const count = locations.filter(l => l.brands?.includes(k)).length;
            if (!count) return null;
            return (
              <button
                key={k}
                className={`loc-filter-btn ${filter === k ? 'active' : ''}`}
                style={{ '--pill-color': BRAND_PILL_COLORS[k], display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setFilter(k)}
              >
                <BrandLogo brandId={k} size={14} /> {v} ({count})
              </button>
            );
          })}
        </div>
        <button className="loc-add-btn" onClick={() => setShowAdd(!showAdd)}>+ Adauga locatie</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="loc-add-form">
          <input
            type="text"
            placeholder="Nume locatie (ex: SM Brasov)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="loc-input"
          />
          <div className="loc-brand-select">
            {Object.entries(BRAND_LABELS).map(([k, v]) => (
              <button
                key={k}
                className={`loc-brand-pill ${newBrands.includes(k) ? 'active' : ''}`}
                style={{ '--pill-color': BRAND_PILL_COLORS[k], display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => toggleBrand(k)}
              ><BrandLogo brandId={k} size={14} /> {v}</button>
            ))}
          </div>
          <input
            type="number"
            min="1" max="100"
            value={newTables}
            onChange={e => setNewTables(Number(e.target.value))}
            className="loc-input loc-input-sm"
            placeholder="Nr. mese"
          />
          <button className="loc-save-btn" onClick={createLocation}>Salveaza</button>
        </div>
      )}

      {/* Locations table */}
      <div className="loc-grid">
        {filtered.map(loc => (
          <div key={loc.id} className={`loc-card ${!loc.active ? 'loc-card--inactive' : ''}`}>
            <div className="loc-card-header">
              <h3 className="loc-card-name" style={{cursor: 'pointer'}} onClick={() => setEditingLoc(loc)}>{loc.name}</h3>
              <div className="loc-card-actions">
                <button
                  className="loc-edit"
                  onClick={() => setEditingLoc(loc)}
                  title="Editeaza setarile"
                >✏️</button>
                <button
                  className={`loc-toggle ${loc.active ? 'loc-toggle--on' : ''}`}
                  onClick={() => toggleActive(loc)}
                  title={loc.active ? 'Dezactiveaza' : 'Activeaza'}
                >{loc.active ? 'ON' : 'OFF'}</button>
                <button className="loc-del" onClick={() => deleteLoc(loc.id)} title="Sterge">x</button>
              </div>
            </div>
            <div className="loc-card-brands" onClick={() => setEditingLoc(loc)} style={{cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
              {(loc.brands || []).map(b => (
                <BrandLogo key={b} brandId={b} size={28} />
              ))}
            </div>
            <div className="loc-card-stats" onClick={() => setEditingLoc(loc)} style={{cursor: 'pointer'}}>
              <span>{loc.tables || 0} mese</span>
              <span>{(loc.kiosks || []).length} kioskuri</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocationEditForm({ loc, backend, onBack, onSave }) {
  const [formData, setFormData] = useState({
    name: loc.name || '',
    brands: loc.brands || [],
    isMultiBrand: loc.isMultiBrand || false,
    kioskUrl: loc.kioskUrl || '',
    screensaverUrl: loc.screensaverUrl || '',
    showLogoOnScreensaver: loc.showLogoOnScreensaver !== false,
    orgIds: loc.orgIds || {},
    tables: loc.tables || 0
  });

  const handleChange = (field, val) => setFormData(prev => ({ ...prev, [field]: val }));
  
  const handleOrgChange = (brandId, val) => {
    setFormData(prev => ({ ...prev, orgIds: { ...prev.orgIds, [brandId]: val } }));
  };

  const toggleBrand = (b) => {
    setFormData(prev => {
      const newBrands = prev.brands.includes(b) ? prev.brands.filter(x => x !== b) : [...prev.brands, b];
      return { ...prev, brands: newBrands };
    });
  };

  const generateLink = () => {
    if (formData.brands.length === 0) return;
    const base = 'https://kiosk-smashme.netlify.app';
    const activeBrand = formData.brands[0];
    const newUrl = `${base}/?brand=${activeBrand}&loc=${loc.id}`;
    handleChange('kioskUrl', newUrl);
  };

  const saveLoc = async () => {
    await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    onSave();
    onBack();
  };

  return (
    <div className="loc-edit-form">
      <div className="loc-edit-header">
        <button className="loc-back-btn" onClick={onBack}>← Inapoi</button>
        <h2>Editare Locatie: {loc.id}</h2>
        <button className="loc-save-btn" onClick={saveLoc}>💾 Salvează Toate</button>
      </div>

      <div className="loc-edit-grid">
        {/* Generaly Config */}
        <div className="loc-edit-card">
          <h3>Setări Generale</h3>
          <label>Nume Locație</label>
          <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} className="pc-input" />
          
          <label>Număr Mese</label>
          <input type="number" value={formData.tables} onChange={e => handleChange('tables', Number(e.target.value))} className="pc-input" />

          <label>Branduri Active</label>
          <div className="loc-brand-select">
            {Object.entries(BRAND_LABELS).map(([k, v]) => (
              <button
                key={k} className={`loc-brand-pill ${formData.brands.includes(k) ? 'active' : ''}`}
                style={{ '--pill-color': BRAND_PILL_COLORS[k] }}
                onClick={() => toggleBrand(k)}
              >{v}</button>
            ))}
          </div>

          <label className="pc-toggle" style={{marginTop: 15}}>
            <input type="checkbox" checked={formData.isMultiBrand} onChange={e => handleChange('isMultiBrand', e.target.checked)} />
            <span className="toggle-slider" />
            <span>Multi-brand mode (afișare tab-uri restaurant)</span>
          </label>
        </div>

        {/* Syrve / Org ID */}
        <div className="loc-edit-card">
          <h3>Integrare Syrve (API)</h3>
          <p style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Completează Organization ID (orgId) de la Syrve pentru fiecare brand activ în această locație.</p>
          {formData.brands.length === 0 && <p className="empty-text">Selectează un brand mai întâi.</p>}
          {formData.brands.map(b => (
            <div key={b} className="org-input-group">
              <label>{BRAND_LABELS[b]} orgId</label>
              <input type="text" value={formData.orgIds[b] || ''} onChange={e => handleOrgChange(b, e.target.value)} className="pc-input" placeholder="ex: f4742901-..." />
            </div>
          ))}
        </div>

        {/* Kiosk URL & Screensaver */}
        <div className="loc-edit-card">
          <h3>Afișaj Kiosk</h3>
          
          <label>Link Acces Kiosk (pentru browsere)</label>
          <div style={{display:'flex', gap: 10, marginBottom: 20}}>
            <input type="text" value={formData.kioskUrl} onChange={e => handleChange('kioskUrl', e.target.value)} className="pc-input" style={{marginBottom:0}} placeholder="https://..." />
            <button className="btn-secondary" onClick={generateLink} style={{whiteSpace:'nowrap'}}>🔄 Generează</button>
            <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(formData.kioskUrl)} style={{whiteSpace:'nowrap'}}>📋 Copiază</button>
          </div>

          <label>Screensaver URL (Imagine mp4/jpg inactivitate)</label>
          <input type="url" value={formData.screensaverUrl} onChange={e => handleChange('screensaverUrl', e.target.value)} className="pc-input" placeholder="https://...mp4" />
          
          <label className="pc-toggle" style={{marginTop: 15, marginBottom: 15}}>
            <input type="checkbox" checked={formData.showLogoOnScreensaver} onChange={e => handleChange('showLogoOnScreensaver', e.target.checked)} />
            <span className="toggle-slider" />
            <span>Afișează logo brand pe butonul "Începe comanda"</span>
          </label>

          {formData.screensaverUrl && (
            <div className="pc-preview-box" style={{height: 150}}>
              {/\.(mp4|webm)(\?|$)/i.test(formData.screensaverUrl)
                ? <video src={formData.screensaverUrl} autoPlay muted loop />
                : <img src={formData.screensaverUrl} alt="Screensaver" />
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

