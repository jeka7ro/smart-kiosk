import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import { useAuth } from './context/AuthProvider';
import LoginScreen from './screens/LoginScreen';
import UsersManager from './screens/UsersManager';
import ModifierImages from './screens/ModifierImages';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// ─── Keep-alive: prevent Render.com free tier from sleeping ───────────────────
function useKeepAlive() {
  useEffect(() => {
    const ping = () => fetch(`${BACKEND}/api/health`, { method: 'GET' }).catch(() => {});
    ping(); // immediate ping on load
    const id = setInterval(ping, 4 * 60 * 1000); // every 4 minutes
    return () => clearInterval(id);
  }, []);
}

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
  
  const [tab, setTabState] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'modifiers', 'users'];
    return validTabs.includes(hash) ? hash : 'orders';
  });

  const setTab = (newTab) => {
    window.location.hash = newTab;
    setTabState(newTab);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'modifiers', 'users'];
      if (validTabs.includes(hash)) setTabState(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [orders,    setOrders]    = useState([]);
  const [menuStatus,setMenuStatus]= useState(null);
  const [connected, setConnected] = useState(false);
  const [brandFilter, setBrandFilter] = useState('all');
  const [notifications, setNotifs]= useState([]);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('admin-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  });
  const socketRef = useRef(null);
  useKeepAlive(); // prevent Render backend from sleeping

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
      addNotif(`Comandă nouă #${order.orderNumber} — ${order.brand} — ${(order.totalAmount||0).toFixed(0)} lei`);
    });
    socket.on('order_status_updated', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status } : o));
    });

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!token) return <LoginScreen />;

  return (
    <div className="admin-app">
      {/* ─── Sidebar ─── */}
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="admin-logo" style={{justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img src="/logo_getapp.png" alt="GetApp" style={{ height: '44px', mixBlendMode: 'multiply' }} />
            <span className="al-text" style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.5px', lineHeight: '1.2' }}>Smart Kiosk<br/><small style={{ fontWeight: 400, opacity: 0.7, fontSize: '0.8rem' }}>Admin Panel</small></span>
          </div>
          <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)}>×</button>
        </div>
        <nav className="admin-nav">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> },
            { id: 'orders',    label: 'Comenzi', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
            { id: 'locations', label: 'Locații', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> },
            { id: 'kiosks',    label: 'Kioskuri', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> },
            { id: 'qrcodes',   label: 'QR Coduri', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg> },
            { id: 'menu',      label: 'Meniu / Syrve', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg> },
            { id: 'modifiers', label: 'Imagini Opțiuni', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> },
            ...(user?.role === 'admin' ? [{ id: 'users', label: 'Echipă', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> }] : []),
          ].map(item => (
            <button
              key={item.id}
              className={`anav-btn ${tab === item.id ? 'active' : ''}`}
              onClick={() => { setTab(item.id); setIsSidebarOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span style={{ display: 'flex', opacity: tab === item.id ? 1 : 0.5 }}>{item.icon}</span>
              <span style={{ fontWeight: tab === item.id ? 600 : 400 }}>{item.label}</span>
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
            {theme === 'dark' ? 'Mod Luminos' : 'Mod Întunecat'}
          </button>
        </div>

        <div className="admin-links">
          <button onClick={logout} style={{background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'none', padding:'8px 12px', borderRadius:'8px', cursor:'pointer', marginBottom:'10px', width:'100%', fontWeight: 500}}>Deconectare</button>
          <a href="http://localhost:4012" target="_blank" rel="noreferrer">Kitchen Display</a>
          <a href="http://localhost:4010/?brand=smashme" target="_blank" rel="noreferrer">Kiosk SmashMe</a>
          <a href="http://localhost:4010/?brand=sushimaster" target="_blank" rel="noreferrer">Kiosk Sushi</a>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="admin-main">
        {/* Bara Navigare Mobile (Invizibila pe Desktop) */}
        <div className="mobile-top-bar">
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Smart Kiosk</span>
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </div>

        {/* TOP HEADER BAR */}
        <div className="main-header-bar" style={{ padding: '0 28px', height: '70px', borderBottom: '2px solid #0f766e', display: 'flex', alignItems: 'center', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
           <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f766e', letterSpacing: '-0.3px' }}>
              {tab === 'dashboard' && 'Dashboard Overview'}
              {tab === 'orders' && 'Gestionare Comenzi'}
              {tab === 'locations' && 'Locațiile Noastre'}
              {tab === 'kiosks' && 'Kioskuri'}
              {tab === 'qrcodes' && 'Coduri QR'}
              {tab === 'menu' && 'Sincronizare Syrve'}
              {tab === 'modifiers' && '🖼 Imagini Modificatori Opțiuni'}
              {tab === 'users' && 'Echipă'}
           </h2>
        </div>

        {/* Notifications */}
        <div className="notif-stack">
          {notifications.map(n => (
            <div key={n.id} className="notif">{n.msg}</div>
          ))}
        </div>

        {/* ─── DASHBOARD ─── */}
        {tab === 'dashboard' && (
          <div className="admin-section">
            <div className="stat-grid">
              <StatCard label="Total comenzi" value={stats.total} color="var(--primary)" />
              <StatCard label="Noi / Așteptare" value={stats.pending}   color="var(--warning)" />
              <StatCard label="În pregătire"   value={stats.preparing} color="var(--cyan)" />
              <StatCard label="Gata ridicare"  value={stats.ready}     color="var(--success)" />
              <StatCard label="Venituri"        value={`${stats.revenue.toFixed(0)} lei`} color="var(--success)" large />
              <StatCard label="SmashMe"   value={stats.smashme} color={BRAND_COLORS.smashme} />
              <StatCard label="SushiMaster" value={stats.sushimaster} color={BRAND_COLORS.sushimaster} />
            </div>

            <h3 className="sub-title">Ultimele 10 comenzi</h3>
            <OrdersTable orders={orders.slice(0, 10)} />
          </div>
        )}

        {/* ─── ORDERS ─── */}
        {tab === 'orders' && (
          <div className="admin-section">
            <div className="section-header">
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
            <div className="section-header" style={{ justifyContent: 'flex-end' }}>
              <button className="btn-refresh" onClick={fetchMenuStatus}>Refresh</button>
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
            <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Gestioneaza locatiile si kioskurile alocate. Locatiile cu mai multe branduri permit comenzi mixte.</p>
            <LocationsManager backend={BACKEND} />
          </div>
        )}

        {/* ─── KIOSKS / SCREENSAVER ─── */}
        {tab === 'kiosks' && (
          <div className="admin-section">
            <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Copiază link-ul necesar pentru tabletă sau setează screensaver-ul (imagine/video completă care rulează înainte de comandă).</p>
            <KiosksManager backend={BACKEND} />
          </div>
        )}

        {/* ─── QR CODE GENERATOR ─── */}
        {tab === 'qrcodes' && (
          <div className="admin-section">
            <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Generează coduri QR pentru mese. Clienții scanează QR-ul și comandă direct de pe telefon.</p>
            <QrGenerator backend={BACKEND} />
          </div>
        )}
        {/* ─── USERS MANAGER ─── */}
        {tab === 'modifiers' && <ModifierImages />}
        {tab === 'users' && <UsersManager />}
      </main>
    </div>
  );
}

function StatCard({ label, value, color, large }) {
  return (
    <div className={`stat-card ${large ? 'stat-card--large' : ''}`} style={{ '--sc': color }}>
      <span className="sc-value">{value}</span>
      <span className="sc-label" style={{ opacity: 0.7, fontSize: '0.9rem' }}>{label}</span>
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
                <td>{o.orderType === 'dine-in' ? `Masa ${o.tableNumber}` : 'Caserie'}</td>
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

function KiosksManager({ backend }) {
  const { fetchWithAuth } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState('all');
  const [editingLoc, setEditingLoc] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchLocs = () => {
    setLoading(true);
    fetchWithAuth(`${backend}/api/locations`)
      .then(r => r.json())
      .then(d => { setLocations(d.locations || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(fetchLocs, [backend]);

  if (loading) return <p className="loading-text">Se încarcă kioskurile...</p>;

  if (editingLoc) {
    return <KioskSettingsForm loc={editingLoc} backend={backend} onBack={() => setEditingLoc(null)} onSave={fetchLocs} />;
  }

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

  const sorted = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleFilterClick = (filter) => {
    setBrandFilter(filter);
    setCurrentPage(1);
  };

  return (
    <div className="kiosk-location-list">
      <div className="kl-brand-filter">
        <button
          className={`kl-filter-btn ${brandFilter === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterClick('all')}
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
              onClick={() => handleFilterClick(bid)}
            >
              <BrandLogo brandId={bid} size={14} /> {m.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Tabel Business */}
      <div className="loc-list-container" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.03)', marginTop: '24px' }}>
        <table className="loc-table hoverable-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '16px 24px', width: '50px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
              <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Denumire & ID</th>
              <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Branduri Admise</th>
              <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stare</th>
              <th style={{ padding: '16px 24px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((loc, index) => {
              const finalKioskUrl = loc.kioskUrl || `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;
              const brandsArr = loc.brands || (loc.brandId ? [loc.brandId] : []);
              
              return (
                <tr key={loc.id} className="loc-table-row">
                  <td style={{ padding: '16px 24px', color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem' }}>
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{loc.name}</span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'monospace' }}>{loc.id}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {brandsArr.map(b => (
                         <BrandLogo key={b} brandId={b} size={28} />
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <span style={{ width: 10, height: 10, borderRadius: '50%', background: loc.active ? '#22c55e' : '#ef4444', display: 'inline-block' }} title={loc.active ? 'Online' : 'Inactiv'} />
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <a 
                        title="Vizualizare Kiosk direct"
                        href={finalKioskUrl} target="_blank" rel="noreferrer"
                        className="btn-business-icon"
                        style={{ textDecoration: 'none', background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </a>
                      <button 
                        title="Copiază Link Universal"
                        className="btn-business-icon"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={(e) => {
                          const btn = e.currentTarget;
                          const svg = btn.querySelector('svg');
                          navigator.clipboard.writeText(finalKioskUrl);
                          svg.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
                          setTimeout(() => {
                             svg.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
                          }, 2000);
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                      <button 
                        title="Setări și Screensaver"
                        className="btn-business-icon"
                        style={{ background: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: '#0f172a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => setEditingLoc(loc)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              Afișare {Math.min(sorted.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(sorted.length, currentPage * itemsPerPage)} din {sorted.length}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f1f5f9' : '#fff', color: currentPage === 1 ? '#94a3b8' : '#334155', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}
              >
                Start
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: currentPage === totalPages ? '#f1f5f9' : '#fff', color: currentPage === totalPages ? '#94a3b8' : '#334155', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}
              >
                Următoarea
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KioskSettingsForm({ loc, backend, onBack, onSave }) {
  const { fetchWithAuth } = useAuth();
  const [formData, setFormData] = useState({
    kioskUrl: loc.kioskUrl || '',
    posterUrl: loc.posterUrl || '',
    topBannerUrl: loc.topBannerUrl || '',
    topBannerHeight: loc.topBannerHeight || 3,
    topBannerRadiusTop: loc.topBannerRadiusTop !== undefined ? loc.topBannerRadiusTop : true,
    topBannerRadiusBottom: loc.topBannerRadiusBottom !== undefined ? loc.topBannerRadiusBottom : false,
    bottomBannerContent: loc.bottomBannerContent || '',
    bottomBannerHeight: loc.bottomBannerHeight || 2,
    bottomBannerRadiusTop: loc.bottomBannerRadiusTop !== undefined ? loc.bottomBannerRadiusTop : false,
    bottomBannerRadiusBottom: loc.bottomBannerRadiusBottom !== undefined ? loc.bottomBannerRadiusBottom : true,
    kioskPin: loc.kioskPin || '',
    brands: loc.brands || [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Toggles for optional sections
  const [usePin, setUsePin] = useState(!!loc.kioskPin);
  const [useBanner, setUseBanner] = useState(!!loc.topBannerUrl);
  const [useBottomBanner, setUseBottomBanner] = useState(!!loc.bottomBannerContent);

  const handleChange = (field, val) => setFormData(p => ({ ...p, [field]: val }));

  const toggleBrand = (b) => {
    setFormData(prev => {
      const bSet = new Set(prev.brands);
      bSet.has(b) ? bSet.delete(b) : bSet.add(b);
      return { ...prev, brands: Array.from(bSet) };
    });
  };

  const saveSettings = async () => {
    setIsSaving(true);
    // Sync toggles with data
    const finalData = { ...formData };
    if (!usePin) finalData.kioskPin = '';
    if (!useBanner) finalData.topBannerUrl = '';
    if (!useBottomBanner) finalData.bottomBannerContent = '';

    try {
      await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });
      setSaveSuccess(true);
      onSave();
      
      // Toast feel — wait a moment then close
      setTimeout(() => {
        onBack();
      }, 1000);
      
    } catch(e) {
      alert('Eroare la salvare.');
      setIsSaving(false);
    }
  };

  const renderPreview = (u) => {
    if (!u) return null;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) {
      return <video src={u} autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    } else if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(u)) {
      return <img src={u} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    } else {
      return <iframe src={u} title="Preview" style={{ width: '100%', height: '100%', border: 'none' }} />;
    }
  };

  const finalKioskUrl = formData.kioskUrl || `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;

  return (
    <div className="loc-edit-form" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="loc-edit-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <button className="loc-back-btn" onClick={onBack} style={{ padding: 0, color: '#64748b', fontWeight: 600, border: 'none', background: 'none' }}>← Înapoi</button>
           <h2 style={{ margin: '8px 0 0 0', fontSize: '1.5rem', color: '#0f172a' }}>Configurare Kiosk: <span style={{color:'#3b82f6'}}>{loc.name}</span></h2>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a
            href={finalKioskUrl}
            target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155',
              padding: '10px 16px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.2s'
            }}
          >
            👁️ Preview Live
          </a>
          <button 
            className="loc-save-btn" 
            onClick={saveSettings} 
            disabled={isSaving || saveSuccess}
            style={{ 
              background: saveSuccess ? '#10b981' : '#0f172a', 
              color: '#fff',
              padding: '10px 24px', 
              borderRadius: '12px',
              fontSize: '0.95rem',
              border: 'none',
              cursor: (isSaving || saveSuccess) ? 'default' : 'pointer',
              boxShadow: saveSuccess ? '0 4px 14px rgba(16, 185, 129, 0.4)' : '0 4px 14px rgba(15, 23, 42, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
            }}
          >
            {saveSuccess ? '✅ Configurație Salvată' : isSaving ? '⏳ Se procesează...' : '💾 Salvează Schimbările'}
          </button>
        </div>
      </div>

      <div className="loc-edit-grid" style={{ gridTemplateColumns: 'minmax(400px, 1fr) 1fr', gap: '24px' }}>
        
        {/* Card: Comportament */}
        <div className="loc-edit-card" style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>📱 Conținut Kiosk</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 20 }}>Selectează restaurantele pe care clienții le pot explora din această tabletă.</p>
          
          <div className="loc-brand-select" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {Object.entries({smashme:'SmashMe',sushimaster:'Sushi Master',welovesushi:'WeLoveSushi',ikura:'Ikura'}).map(([k, v]) => {
              const isActive = formData.brands.includes(k);
              const pillColor = (BRAND_COLORS && BRAND_COLORS[k]) ? BRAND_COLORS[k] : '#64748b'; // proper fallback
              return (
                <button
                  key={k}
                  className={`loc-brand-pill ${isActive ? 'active' : ''}`}
                  style={{ 
                    padding: '10px 18px', borderRadius: '12px', 
                    display: 'flex', alignItems: 'center', gap: '10px', 
                    background: isActive ? pillColor : '#ffffff', 
                    color: isActive ? '#fff' : '#334155', 
                    border: isActive ? `2px solid ${pillColor}` : '2px solid #cbd5e1',
                    boxShadow: isActive ? `0 4px 12px ${pillColor}50` : '0 2px 4px rgba(0,0,0,0.02)',
                    fontWeight: 600, transition: 'all 0.2s', 
                    filter: isActive ? 'none' : 'grayscale(100%) opacity(0.8)',
                     cursor: 'pointer'
                  }}
                  onClick={() => toggleBrand(k)}
                >
                  {isActive 
                    ? <span style={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: 'rgba(255,255,255,0.3)', borderRadius: '50%', fontSize: '0.85rem'}}>✓</span> 
                    : <span style={{display: 'block', width: 20, height: 20, border: '2px solid #94a3b8', borderRadius: '50%'}}></span>
                  }
                  <BrandLogo brandId={k} size={18} /> {v}
                </button>
              );
            })}
          </div>
          
          <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 8 }}>🔗 Link Universal (Aplică-l pe tabletă)</label>
          <div style={{ display: 'flex', gap: 8, background: '#f8fafc', padding: 4, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <input type="text" readOnly value={finalKioskUrl} style={{ background: 'transparent', border: 'none', flex: 1, padding: '0 12px', fontFamily: 'monospace', fontSize: '0.85rem', color: '#0f172a', outline: 'none' }} />
            <button 
              style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              onClick={() => {
                navigator.clipboard.writeText(finalKioskUrl);
                alert('Copiat!');
              }}
            >
              Copy
            </button>
          </div>
        </div>

        {/* Card: Screensaver */}
        <div className="loc-edit-card" style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>🎬 Screensaver Standby</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 20 }}>Rulare automată reclamă full-screen dacă tableta stă neatinsă 30s.</p>
          
          <input 
            type="url" 
            className="pc-input" 
            placeholder="URL Video MP4 sau Imagine..."
            value={formData.posterUrl}
            onChange={e => handleChange('posterUrl', e.target.value)}
            style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
          />
          
          {formData.posterUrl ? (
            <div style={{ height: 160, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f1f5f9' }}>
               {renderPreview(formData.posterUrl)}
            </div>
          ) : (
             <div style={{ height: 160, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>Fără screensaver.</div>
          )}
        </div>

        {/* Card: Banner Promo (10% Top) */}
        <div className="loc-edit-card" style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>📢 Banner Promo Persistent (Top)</h3>
            <label className="pc-toggle" style={{ margin: 0 }}>
              <input type="checkbox" checked={useBanner} onChange={e => setUseBanner(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 20 }}>Ocupă deasupra interfeței cu o bandă îngustă (10%) reclamă video/imagine la reducere.</p>
          
          {useBanner && (
             <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <input 
                  type="url" 
                  className="pc-input" 
                  placeholder="URL Video MP4 sau Imagine..."
                  value={formData.topBannerUrl}
                  onChange={e => handleChange('topBannerUrl', e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
                />
                
                {formData.topBannerUrl ? (
                  <div style={{ 
                    height: 80, 
                    borderRadius: `${formData.topBannerRadiusTop ? '12px' : '0'} ${formData.topBannerRadiusTop ? '12px' : '0'} ${formData.topBannerRadiusBottom ? '12px' : '0'} ${formData.topBannerRadiusBottom ? '12px' : '0'}`,
                    transition: 'border-radius 0.3s ease',
                    overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f1f5f9' 
                  }}>
                     {renderPreview(formData.topBannerUrl)}
                  </div>
                ) : (
                   <div style={{ height: 80, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>Introdu url-ul campaniei.</div>
                )}

                <div style={{ marginTop: 24, padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>⚙️ Configurare Vizuală (Design)</h4>
                  
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 12 }}>
                      <span>Înălțime Banner</span>
                      <span style={{ color: '#0f172a' }}>Nivel {formData.topBannerHeight} (din 5)</span>
                    </label>
                    <input 
                      type="range" min="1" max="5" step="1"
                      value={formData.topBannerHeight} 
                      onChange={e => handleChange('topBannerHeight', parseInt(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: 8 }}>
                      <span>Subțire (10%)</span>
                      <span>Lat (30%)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <label className="pc-toggle" style={{ margin: 0, flex: 1, background: '#fff', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Colțuri Sus Rotunde</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={formData.topBannerRadiusTop} onChange={e => handleChange('topBannerRadiusTop', e.target.checked)} />
                        <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
                      </div>
                    </label>
                    <label className="pc-toggle" style={{ margin: 0, flex: 1, background: '#fff', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Colțuri Jos Rotunde</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={formData.topBannerRadiusBottom} onChange={e => handleChange('topBannerRadiusBottom', e.target.checked)} />
                        <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
                      </div>
                    </label>
                  </div>
                </div>

             </div>
          )}
        </div>

        {/* Card: Banner Promo (Footer) */}
        <div className="loc-edit-card" style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>📣 Banner Promo (Footer / Jos)</h3>
            <label className="pc-toggle" style={{ margin: 0 }}>
              <input type="checkbox" checked={useBottomBanner} onChange={e => setUseBottomBanner(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 20 }}>Apare în partea de jos a ecranului (sub meniu). Suportă Link Video/Imagine sau Text lung editabil.</p>
          
          {useBottomBanner && (
             <div style={{ animation: 'fadeIn 0.3s ease' }}>
                
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#334155' }}>1. Afișare Reclamă (Video/Imagine)</h4>
                <input 
                  type="url" 
                  className="pc-input" 
                  placeholder="URL Video MP4 sau Imagine (Lasă gol pt. text)"
                  value={formData.bottomBannerContent.startsWith('http') ? formData.bottomBannerContent : ''}
                  onChange={e => handleChange('bottomBannerContent', e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
                />

                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#334155' }}>2. SAU Afișare Text Derulant</h4>
                <textarea 
                  className="pc-input" 
                  placeholder="Introdu mesajul ofertei... (Lasă gol pt. media)"
                  value={!formData.bottomBannerContent.startsWith('http') ? formData.bottomBannerContent : ''}
                  onChange={e => handleChange('bottomBannerContent', e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', width: '100%', marginBottom: 16, boxSizing: 'border-box', minHeight: 80, resize: 'vertical' }}
                />
                
                {formData.bottomBannerContent && formData.bottomBannerContent.startsWith('http') ? (
                  <div style={{ 
                    height: 80, 
                    borderRadius: `${formData.bottomBannerRadiusTop ? '12px' : '0'} ${formData.bottomBannerRadiusTop ? '12px' : '0'} ${formData.bottomBannerRadiusBottom ? '12px' : '0'} ${formData.bottomBannerRadiusBottom ? '12px' : '0'}`,
                    transition: 'border-radius 0.3s ease',
                    overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f1f5f9' 
                  }}>
                     {renderPreview(formData.bottomBannerContent)}
                  </div>
                ) : formData.bottomBannerContent ? (
                  <div style={{ 
                    padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', 
                    borderRadius: `${formData.bottomBannerRadiusTop ? '8px' : '0'} ${formData.bottomBannerRadiusTop ? '8px' : '0'} ${formData.bottomBannerRadiusBottom ? '8px' : '0'} ${formData.bottomBannerRadiusBottom ? '8px' : '0'}`,
                    transition: 'border-radius 0.3s ease',
                    fontSize: '0.95rem', color: '#334155', fontWeight: 600 
                  }}>
                    "{formData.bottomBannerContent}"
                  </div>
                ) : (
                   <div style={{ height: 80, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>Fără conținut pentru subsol.</div>
                )}

                <div style={{ marginTop: 24, padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>⚙️ Configurare Vizuală (Design)</h4>
                  
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 12 }}>
                      <span>Înălțime Banner</span>
                      <span style={{ color: '#0f172a' }}>Nivel {formData.bottomBannerHeight} (din 5)</span>
                    </label>
                    <input 
                      type="range" min="1" max="5" step="1"
                      value={formData.bottomBannerHeight} 
                      onChange={e => handleChange('bottomBannerHeight', parseInt(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: 8 }}>
                      <span>Subțire (10%)</span>
                      <span>Lat (30%)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <label className="pc-toggle" style={{ margin: 0, flex: 1, background: '#fff', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Colțuri Sus Rotunde</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={formData.bottomBannerRadiusTop} onChange={e => handleChange('bottomBannerRadiusTop', e.target.checked)} />
                        <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
                      </div>
                    </label>
                    <label className="pc-toggle" style={{ margin: 0, flex: 1, background: '#fff', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Colțuri Jos Rotunde</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={formData.bottomBannerRadiusBottom} onChange={e => handleChange('bottomBannerRadiusBottom', e.target.checked)} />
                        <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
                      </div>
                    </label>
                  </div>
                </div>

             </div>
          )}
        </div>

        {/* Card: Security */}
        <div className="loc-edit-card" style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>🔒 Securitate PIN</h3>
            <label className="pc-toggle" style={{ margin: 0 }}>
              <input type="checkbox" checked={usePin} onChange={e => setUsePin(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 20 }}>Blochează tableta până la introducerea primei parole de angajat.</p>
          
          {usePin && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <input 
                type="password" 
                maxLength="6"
                className="pc-input" 
                placeholder="Introdu PIN (ex: 1234)"
                value={formData.kioskPin}
                onChange={e => handleChange('kioskPin', e.target.value.replace(/\D/g, ''))}
                style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', width: '100%', maxWidth: '200px', fontSize: '1.1rem', letterSpacing: '2px', boxSizing: 'border-box' }}
              />
            </div>
          )}
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
      {/* Locations table (List View) */}
      <div className="loc-list-container" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.03)', marginTop: '24px' }}>
        <table className="loc-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>
              <th style={{ padding: '14px 16px', fontWeight: 600 }}>Nume Locație</th>
              <th style={{ padding: '14px 16px', fontWeight: 600 }}>Branduri Active</th>
              <th style={{ padding: '14px 16px', fontWeight: 600 }}>Statistici</th>
              <th style={{ padding: '14px 16px', fontWeight: 600 }}>Stare</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(loc => (
              <tr key={loc.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: loc.active ? 1 : 0.6, cursor: 'pointer' }} onClick={() => setEditingLoc(loc)} className="loc-list-row">
                <td style={{ padding: '16px', fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>
                  {loc.name}
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginTop: 4 }}>ID: {loc.id}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(loc.brands || []).map(b => <BrandLogo key={b} brandId={b} size={24} />)}
                  </div>
                </td>
                <td style={{ padding: '16px', color: '#64748b', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 6 }}>🪑 {loc.tables || 0}</span>
                    <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 6 }}>📱 {(loc.kiosks || []).length}</span>
                  </div>
                </td>
                <td style={{ padding: '16px' }} onClick={(e) => e.stopPropagation()}>
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 6px' }} 
                    onClick={() => toggleActive(loc)} 
                    title={loc.active ? 'Acum e LIVE (Apasă pentru dezactivare)' : 'Inactiv (Apasă pentru activare)'}
                  >
                     <span style={{ width: 10, height: 10, borderRadius: '50%', background: loc.active ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                  </div>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button 
                      title="Configurare locație"
                      className="btn-business-icon"
                      style={{ background: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: '#0f172a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => setEditingLoc(loc)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                    <button 
                      title="Șterge definitiv locația"
                      className="btn-business-icon"
                      style={{ background: '#fee2e2', border: '1px solid #fca5a5', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => deleteLoc(loc.id)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>Nu există locații care să corespundă filtrelor.</div>}
      </div>
    </div>
  );
}

function LocationEditForm({ loc, backend, onBack, onSave }) {
  const [formData, setFormData] = useState({
    name: loc.name || '',
    brands: loc.brands || [],
    orgIds: loc.orgIds || {},
    tables: loc.tables || 0,
    note: loc.note || '',
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
        <h2>Editare Locatie: {loc.name}</h2>
        <button className="loc-save-btn" onClick={saveLoc}>Salvează Toate</button>
      </div>

      <div className="loc-edit-grid">
        {/* Generaly Config */}
        <div className="loc-edit-card">
          <h3>Setări Generale</h3>
          <label>Nume Locație</label>
          <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} className="pc-input" />
          
          <label>Notă internă (opțional)</label>
          <textarea
            className="pc-input"
            style={{ minHeight: 80, resize: 'vertical' }}
            placeholder="ex: Kiosk la intrare, lângă casa 2. Tableta Samsung."
            value={formData.note}
            onChange={e => handleChange('note', e.target.value)}
          />

          <label>Număr Mese</label>
          <input type="number" value={formData.tables} onChange={e => handleChange('tables', Number(e.target.value))} className="pc-input" />

          <label>Branduri Active (restaurante disponibile fizic în locație)</label>
          <div className="loc-brand-select">
            {Object.entries(BRAND_LABELS).map(([k, v]) => (
              <button
                key={k} className={`loc-brand-pill ${formData.brands.includes(k) ? 'active' : ''}`}
                style={{ '--pill-color': BRAND_PILL_COLORS[k] }}
                onClick={() => toggleBrand(k)}
              >{v}</button>
            ))}
          </div>
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

      </div>
    </div>
  );
}

