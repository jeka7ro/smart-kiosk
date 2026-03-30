import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { io } from 'socket.io-client';
import './App.css';
import { useAuth } from './context/AuthProvider';
import LoginScreen from './screens/LoginScreen';
import UsersManager from './screens/UsersManager';
import ModifierImages from './screens/ModifierImages';
import ProductOverrides from './screens/ProductOverrides';
import TranslationsScreen from './screens/TranslationsScreen';
import Integrations   from './screens/Integrations';
import Promotions     from './screens/Promotions';
import FortuneWheelPreview from './components/FortuneWheelPreview';
import MenuManager, { MenuProfileEditorModal } from './screens/MenuManager';
import QrGenerator from './screens/QrGenerator';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

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
  if (src) return <img src={src} alt={brandId} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }} />;
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
    const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'modifiers', 'products', 'users', 'integrations', 'promotions', 'brands', 'translations'];
    return validTabs.includes(hash) ? hash : 'orders';
  });

  const setTab = (newTab) => {
    window.location.hash = newTab;
    setTabState(newTab);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'modifiers', 'products', 'users', 'integrations', 'promotions', 'brands', 'translations'];
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
    const socket = io(BACKEND, { 
      reconnectionAttempts: 10,
      transports: ['websocket'] // Force WebSocket to avoid polling issues
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setConnected(true);
      socket.emit('join', { role: 'admin' });
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });
    socket.on('new_order', order => {
      setOrders(prev => [order, ...prev]);
      addNotif(`Comandă nouă #${order.orderNumber} — ${order.brand} — ${(order.totalAmount||0).toFixed(0)} lei`);
    });
    socket.on('order_status_updated', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status } : o));
    });

    return () => socket.disconnect();
  }, []);

  /* ─── Load promotions configs for UI Previews ───── */
  // promosData moved to KioskSettingsForm

  /* ─── Load initial orders + poll every 30s ──────── */
  useEffect(() => {
    const loadOrders = () => {
      fetchWithAuth(`${BACKEND}/api/orders?limit=100`)
        .then(r => r.json())
        .then(d => setOrders(d.orders || []))
        .catch(() => {});
    };
    loadOrders();
    const interval = setInterval(loadOrders, 30_000);
    return () => clearInterval(interval);
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
        <div className="admin-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <img 
              src={theme === 'dark' ? "/getapp_smart_kiosk_white.png" : "/getapp_smart_kiosk_black.png"} 
              alt="GetApp Smart Kiosk" 
              style={{ maxWidth: '100%', height: 'auto', maxHeight: '66px', objectFit: 'contain', transform: 'translateX(8px)' }} 
            />
          </div>
          <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)} style={{ position: 'absolute', right: 16 }}>×</button>
        </div>
        <nav className="admin-nav">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> },
            { id: 'orders',    label: 'Comenzi', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
            { id: 'locations', label: 'Locații', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> },
            { id: 'kiosks',    label: 'Kioskuri', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> },
            { id: 'qrcodes',   label: 'QR Coduri', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg> },
            { id: 'menu',      label: 'Meniu / Syrve', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg> },
            { id: 'translations', label: 'Traduceri Automate', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l6 6"></path><path d="M4 14l6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg> },
            { id: 'modifiers', label: 'Imagini Opțiuni', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> },
            { id: 'products', label: 'Produse & Etichete', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> },
            ...(user?.role === 'admin' ? [{ id: 'users', label: 'Echipă', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> }] : []),
            ...(user?.role === 'admin' ? [{ id: 'integrations', label: 'Integrări POS', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg> }] : []),
            ...(user?.role === 'admin' ? [{ id: 'promotions', label: 'Promoții ', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2L12 22"></path><path d="M2 12L22 12"></path><path d="M5 5l14 14"></path><path d="M19 5L5 19"></path></svg> }] : []),
            ...(user?.role === 'admin' ? [{ id: 'brands', label: 'Branduri', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> }] : []),
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
        <div className="main-header-bar" style={{ padding: '0 28px', height: '80px', boxSizing: 'border-box', borderBottom: '2px solid #088c8c', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: 'var(--glass-bg)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', position: 'sticky', top: 0, zIndex: 10, boxShadow: 'var(--glass-shadow)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                title={theme === 'dark' ? 'Mod Luminos' : 'Mod Întunecat'}
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              >
                {theme === 'dark' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
              
              <button 
                title="Deconectare"
                onClick={logout} 
                className="btn-business-icon"
                style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#ef4444', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </button>
           </div>
        </div>

        {/* PAGE TITLE (Moved from Header to Page Content) */}
        <div style={{ padding: '32px 40px 0 40px', flexShrink: 0 }}>
           <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              {tab === 'dashboard' && 'Dashboard Overview'}
              {tab === 'orders' && 'Gestionare Comenzi'}
              {tab === 'menu' && 'Sincronizare Syrve'}
              {tab === 'translations' && 'Traduceri Meniu'}
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

        {/* ─── SCROLLABLE CONTENT AREA ─── */}
        <div className="admin-scrollable-content" style={{ flex: 1, overflowY: 'auto', paddingBottom: '40px' }}>
          {/* ─── MENU ─── */}
          {tab === 'menu' && (
            <MenuManager backend={BACKEND} />
          )}

          {/* ─── LOCATIONS ─── */}
          {tab === 'locations' && (
            <div className="admin-section"><LocationsManager backend={BACKEND} /></div>
          )}

          {/* ─── KIOSKS / SCREENSAVER ─── */}
          {tab === 'kiosks' && (
            <div className="admin-section"><KiosksManager backend={BACKEND} /></div>
          )}

          {/* ─── QR CODE GENERATOR ─── */}
          {tab === 'qrcodes' && (
            <QrGenerator backend={BACKEND} />
          )}
          {/* ─── USERS MANAGER ─── */}
          {tab === 'translations' && <div className="admin-section"><TranslationsScreen backend={BACKEND} /></div>}
          {tab === 'modifiers' && <ModifierImages />}
          {tab === 'products' && <ProductOverrides />}
          {tab === 'integrations' && <Integrations />}
          {tab === 'promotions' && <Promotions />}
          {tab === 'users' && <UsersManager />}
          {tab === 'brands' && <BrandsManager backend={BACKEND} />}
        </div>
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
                {t === 'image' ? 'Imagine' : t === 'video' ? 'Video' : 'Pagină web'}
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
          {saved ? ' Salvat!' : ' Salvează'}
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
  const [restartingId, setRestartingId] = useState(null); // ID of loc currently restarting
  const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
    <>
    <div className="kiosk-location-list">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div className="kl-brand-filter" style={{ marginBottom: 0 }}>
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
        <button
          title="Reîncarcă lista"
          onClick={fetchLocs}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          Refresh
        </button>
      </div>

      {/* Tabel Business */}
      <div className="loc-list-container" style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.03)', marginTop: '24px' }}>
        <table className="loc-table hoverable-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '16px 24px', width: '50px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Denumire & ID</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Branduri Admise</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stare</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((loc, index) => {
              const finalKioskUrl = loc.kioskUrl || `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;
              const brandsArr = loc.brands || (loc.brandId ? [loc.brandId] : []);
              
              return (
                <tr key={loc.id} className="loc-table-row">
                  <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>{loc.name}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{loc.id}</span>
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
                       <span style={{ width: 10, height: 10, borderRadius: '50%', background: loc.active ? '#088c8c' : '#ef4444', display: 'inline-block' }} title={loc.active ? 'Online' : 'Inactiv'} />
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        title="Restartare Ecrane Remote"
                        className="btn-business-icon"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={async (e) => {
                           e.stopPropagation();
                           if (restartingId === loc.id) return; // already restarting
                           setRestartingId(loc.id);
                           try {
                             const res = await fetchWithAuth(`${backend}/api/locations/${loc.id}/restart`, { method: 'POST' });
                             const data = await res.json();
                             if (res.ok) {
                               showToast(`Semnal de restart trimis pentru ${loc.name}!`);
                             } else {
                               showToast(data.error || 'Eroare la trimiterea comenzii', 'error');
                             }
                           } catch {
                             showToast('Conexiune eșuată. Verificați rețeaua.', 'error');
                           } finally {
                             setRestartingId(null);
                           }
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 2v6h6M21.5 22v-6h-6"/><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/></svg>
                      </button>
                      <a 
                        title="Vizualizare Kiosk direct"
                        href={finalKioskUrl} target="_blank" rel="noreferrer"
                        className="btn-business-icon"
                        style={{ textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </a>
                      <button 
                        title="Copiază Link Universal"
                        className="btn-business-icon"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Rânduri pe pagină:</span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              style={{ fontSize: '0.82rem', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 8 }}>
              {(currentPage - 1) * itemsPerPage + 1}–{Math.min(sorted.length, currentPage * itemsPerPage)} din {sorted.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { label: '«', action: () => setCurrentPage(1),            disabled: currentPage === 1,          title: 'Prima pagină' },
              { label: '‹', action: () => setCurrentPage(p => p - 1),  disabled: currentPage === 1,          title: 'Anterioară' },
              { label: '›', action: () => setCurrentPage(p => p + 1),  disabled: currentPage === totalPages, title: 'Următoarea' },
              { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages, title: 'Ultima pagină' },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} disabled={btn.disabled} title={btn.title}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', background: btn.disabled ? '#f1f5f9' : '#fff', color: btn.disabled ? '#cbd5e1' : '#334155', cursor: btn.disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              >{btn.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
    {toast && (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        background: toast.type === 'error' ? '#ef4444' : '#10b981',
        color: '#fff', padding: '14px 24px', borderRadius: '14px',
        fontWeight: 700, fontSize: '0.95rem',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: '1.2rem' }}>{toast.type === 'error' ? '✕' : '✓'}</span>
        {toast.msg}
      </div>
    )}
    </>
  );
}

function RestartKioskBtn({ locId, backend, fetchWithAuth }) {
  const [rstState, setRstState] = useState('idle');
  const doRestart = async (e) => {
    e.stopPropagation();
    if (rstState === 'sending') return;
    setRstState('sending');
    try {
      const res = await fetchWithAuth(`${backend}/api/locations/${locId}/restart`, { method: 'POST' });
      setRstState(res.ok ? 'ok' : 'err');
    } catch { setRstState('err'); }
    setTimeout(() => setRstState('idle'), 3000);
  };
  const colors = { idle: 'var(--surface)', sending: '#f59e0b', ok: '#10b981', err: '#ef4444' };
  const labels = { idle: 'Refresh Kiosk', sending: 'Se trimite...', ok: '✓ Trimis!', err: '✕ Eroare' };
  return (
    <button
      onClick={doRestart}
      disabled={rstState === 'sending'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: rstState === 'idle' ? 'var(--surface)' : colors[rstState],
        color: rstState === 'idle' ? 'var(--text)' : '#fff',
        border: `1px solid ${rstState === 'idle' ? 'var(--border)' : colors[rstState]}`,
        padding: '10px 16px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700,
        cursor: rstState === 'sending' ? 'default' : 'pointer',
        transition: 'all 0.3s',
        boxShadow: rstState !== 'idle' ? `0 4px 14px ${colors[rstState]}55` : '0 2px 6px rgba(0,0,0,0.06)',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ animation: rstState === 'sending' ? 'spin 0.8s linear infinite' : 'none' }}>
        <path d="M2.5 2v6h6M21.5 22v-6h-6"/>
        <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/>
      </svg>
      {labels[rstState]}
    </button>
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
    bottomBannerUrl: loc.bottomBannerUrl || (loc.bottomBannerContent?.startsWith('http') ? loc.bottomBannerContent : '') || '',
    bottomBannerText: loc.bottomBannerText || (!loc.bottomBannerContent?.startsWith('http') ? loc.bottomBannerContent || '' : '') || '',
    bottomBannerHeight: loc.bottomBannerHeight || 2,
    bottomBannerRadiusTop: loc.bottomBannerRadiusTop !== undefined ? loc.bottomBannerRadiusTop : false,
    bottomBannerRadiusBottom: loc.bottomBannerRadiusBottom !== undefined ? loc.bottomBannerRadiusBottom : true,
    bottomBannerTextFixed: loc.bottomBannerTextFixed || false,
    bottomBannerTextAlign: loc.bottomBannerTextAlign || 'center',
    bottomBannerBg: loc.bottomBannerBg || '#1e293b',
    bottomBannerLogoUrl: loc.bottomBannerLogoUrl || '',
    kioskPin: loc.kioskPin || '',
    brands: loc.brands || [],
    promoActive: loc.promoActive || false,
    promoBrandId: loc.promoBrandId || '',
    promoMinOrderValue: loc.promoMinOrderValue || 0,
    promoOrdersToAppear: loc.promoOrdersToAppear || 1,
    languages: loc.languages && loc.languages.length > 0 ? loc.languages : ['ro'],
    defaultLanguage: loc.defaultLanguage || (loc.languages && loc.languages.length > 0 ? loc.languages[0] : 'ro'),
    langButtonColor: loc.langButtonColor || '#0f172a',
    langSelectorPosition: loc.langSelectorPosition || 'after',
    menuOverrides: loc.menuOverrides || {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showWheelPreviewFull, setShowWheelPreviewFull] = useState(false);
  const [editingMenuBrand, setEditingMenuBrand] = useState(null);

  const [promosData, setPromosData] = useState({});
  useEffect(() => {
    fetchWithAuth(`${backend}/api/promotions`)
      .then(r => r.json())
      .then(d => setPromosData(d || {}))
      .catch(() => {});
  }, [backend, fetchWithAuth]);

  // Derived: active brands for this location
  const activeBrands = formData.brands && formData.brands.length > 0 ? formData.brands : (loc.brands || []);

  // Brand profiles for menu customization
  const [brandProfiles, setBrandProfiles] = useState({});
  useEffect(() => {
    activeBrands.forEach(brandId => {
      fetchWithAuth(`${backend}/api/menu/profiles/${brandId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setBrandProfiles(prev => ({ ...prev, [brandId]: d })))
        .catch(() => {});
    });
  }, [backend, activeBrands.join(',')]);

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
    if (!useBottomBanner) { finalData.bottomBannerUrl = ''; finalData.bottomBannerText = ''; finalData.bottomBannerContent = ''; }

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
      console.error('Eroare la salvare.');
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

  if (editingMenuBrand) {
    return (
      <div className="admin-section" style={{ padding: 0 }}>
        <MenuProfileEditorModal 
          backend={backend}
          brand={editingMenuBrand.brand}
          profile={editingMenuBrand.profile}
          localHiddenItemsOverride={editingMenuBrand.localHiddenItemsOverride}
          onClose={() => setEditingMenuBrand(null)}
          onSave={(updatedConfig) => {
             const brandId = editingMenuBrand.brand.id;
             const newOverrides = { ...formData.menuOverrides };
             if (!newOverrides[brandId]) newOverrides[brandId] = {};
             newOverrides[brandId].hiddenItems = updatedConfig.hiddenItems;
             handleChange('menuOverrides', newOverrides);
             setEditingMenuBrand(null);
          }}
        />
      </div>
    );
  }

  const finalKioskUrl = formData.kioskUrl || `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;

  return (
    <div className="loc-edit-form" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="loc-edit-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>

           <h2 style={{ margin: '8px 0 0 0', fontSize: '1.5rem', color: 'var(--text)' }}>Configurare Kiosk: <span style={{color:'#3b82f6'}}>{loc.name}</span></h2>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a
            href={finalKioskUrl}
            target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)',
              padding: '10px 16px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.2s'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Preview Live
          </a>
          {/* Restart / Refresh remote kiosk */}
          <RestartKioskBtn locId={loc.id} backend={backend} fetchWithAuth={fetchWithAuth} />
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
            {saveSuccess ? '✓ Configurație Salvată' : isSaving ? ' Se procesează...' : ' Salvează Schimbările'}
          </button>
        </div>
      </div>

      <div className="loc-edit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>

        {/* Card: Comportament */}
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Conținut Kiosk</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Selectează restaurantele pe care clienții le pot explora din această tabletă.</p>
          
          <div className="loc-brand-select" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {/* Show selected brands first with reorder buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px dashed var(--border)' }}>
              {formData.brands.map((k, index) => {
                const v = {smashme:'SmashMe',sushimaster:'Sushi Master',welovesushi:'WeLoveSushi',ikura:'Ikura'}[k] || k;
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: (BRAND_COLORS && BRAND_COLORS[k]) ? BRAND_COLORS[k] : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <BrandLogo brandId={k} size={18} />
                      </div>
                      {v}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => {
                          const newB = [...formData.brands];
                          if (index > 0) {
                            [newB[index-1], newB[index]] = [newB[index], newB[index-1]];
                            setFormData(p => ({ ...p, brands: newB }));
                          }
                        }} disabled={index === 0} style={{ padding: '6px 10px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: index===0?'not-allowed':'pointer', fontSize: '0.75rem', fontWeight: 600 }}>↑ Sus</button>
                      <button onClick={() => {
                          const newB = [...formData.brands];
                          if (index < newB.length - 1) {
                            [newB[index+1], newB[index]] = [newB[index], newB[index+1]];
                            setFormData(p => ({ ...p, brands: newB }));
                          }
                        }} disabled={index === formData.brands.length - 1} style={{ padding: '6px 10px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: index===formData.brands.length-1?'not-allowed':'pointer', fontSize: '0.75rem', fontWeight: 600 }}>↓ Jos</button>
                      <button onClick={() => toggleBrand(k)} style={{ padding: '6px 10px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Șterge</button>
                    </div>
                  </div>
                );
              })}
              {formData.brands.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Niciun restaurant selectat</span>}
            </div>

            {/* Selection candidates */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {Object.entries({smashme:'SmashMe',sushimaster:'Sushi Master',welovesushi:'WeLoveSushi',ikura:'Ikura'}).map(([k, v]) => {
                if (formData.brands.includes(k)) return null;
                return (
                  <button
                    key={k}
                    className="loc-brand-pill"
                    style={{ 
                      padding: '8px 12px', borderRadius: '8px', 
                      display: 'flex', alignItems: 'center', gap: '6px', 
                      background: 'var(--surface)', color: 'var(--text)', 
                      border: '1px dashed var(--border)',
                      fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s', 
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleBrand(k)}
                  >
                    <span style={{ color: '#3b82f6', fontSize: '1.2rem', lineHeight: 1 }}>+</span>
                    <BrandLogo brandId={k} size={14} /> <span style={{ opacity: 0.8 }}>{v}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* LINK KIOSK SUPER COMPACT */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(59,130,246,0.1)', borderRadius: '10px', border: '1px dashed rgba(59,130,246,0.3)', marginBottom: '20px' }}>
             <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Link Kiosk: <span style={{ fontFamily: 'monospace', color: 'var(--cyan, #3b82f6)' }}>...{finalKioskUrl.split('?loc=')[1]}</span></span>
             <button onClick={() => navigator.clipboard.writeText(finalKioskUrl)} style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(59,130,246,0.3)' }}>Copiaza URL</button>
          </div>

          {/* GRID COMPACT SETARI DESIGN */}
          <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
             <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Aspect & Poziționare Limbi</h4>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr)', gap: '16px' }}>
                
                {/* COL 1: Buton Principal (Fundal) */}
                <div>
                   <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Fundal Buton Start Comandă</label>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="color" value={formData.langButtonColor || '#0f172a'} onChange={e => handleChange('langButtonColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
                      <input type="text" value={formData.langButtonColor || '#0f172a'} onChange={e => handleChange('langButtonColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
                   </div>
                   <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.75rem', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
                     <input type="checkbox" checked={formData.langButtonFlagColors || false} onChange={e => handleChange('langButtonFlagColors', e.target.checked)} />
                     Culorile Steagului (Suprascrie Fundalul)
                   </label>
                </div>

                {/* COL 1B: Buton Principal (Text Color) */}
                <div>
                   <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Culoare Text Buton Start</label>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="color" value={formData.langButtonTextColor || '#ffffff'} onChange={e => handleChange('langButtonTextColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
                      <input type="text" value={formData.langButtonTextColor || '#ffffff'} onChange={e => handleChange('langButtonTextColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
                   </div>
                </div>

                {/* COL 1C: Buton Principal (Border) */}
                <div>
                   <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Contur Buton Start</label>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="color" value={formData.langButtonBorderColor || '#0f172a'} onChange={e => handleChange('langButtonBorderColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
                      <input type="text" value={formData.langButtonBorderColor || '#0f172a'} onChange={e => handleChange('langButtonBorderColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
                      <button type="button" onClick={() => handleChange('langButtonBorderColor', 'transparent')} style={{ fontSize: '0.65rem', padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>Fără</button>
                   </div>
                </div>

                {/* COL 1D: Buton Principal (Text) */}
                <div style={{ gridColumn: '1 / -1' }}>
                   <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Text Personalizat Buton Start</label>
                   <input type="text" placeholder="Începe comanda" value={formData.langButtonText || ''} onChange={e => handleChange('langButtonText', e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
                </div>

                {/* COL 2: Pozitie Sus/Jos */}
                <div>
                   <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Poziție pe Ecran</label>
                   <div style={{ display: 'flex', gap: 4 }}>
                     {[{v:'top',l:'Sus'},{v:'bottom',l:'Jos'}].map(opt => (
                       <button key={opt.v} type="button" onClick={() => handleChange('langVerticalPosition', opt.v)}
                         style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: (formData.langVerticalPosition || 'bottom') === opt.v ? '2px solid var(--primary)' : '1px solid var(--border)', background: (formData.langVerticalPosition || 'bottom') === opt.v ? 'var(--primary)' : 'var(--surface)', color: (formData.langVerticalPosition || 'bottom') === opt.v ? '#fff' : 'var(--text)', cursor: 'pointer' }}>
                         {opt.l}
                       </button>
                     ))}
                   </div>
                </div>

                {/* COL 3: Fundal Limbi */}
                <div>
                   <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Fundal Etichete Limbi</label>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="color" value={formData.langBgColor || '#ffffff'} onChange={e => handleChange('langBgColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
                      <input type="text" value={formData.langBgColor || ''} placeholder="transparent" onChange={e => handleChange('langBgColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
                      <button type="button" onClick={() => handleChange('langBgColor', 'transparent')} style={{ fontSize: '0.65rem', padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>Fără</button>
                   </div>
                </div>

                {/* COL 4: Cand apar */}
                <div>
                   <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Moment Apariție</label>
                   <div style={{ display: 'flex', gap: 4 }}>
                     {[{v:'before',l:'Screensaver'},{v:'after',l:'Dupa saver'},{v:'both',l:'Ambele'}].map(opt => (
                       <button key={opt.v} type="button" onClick={() => handleChange('langSelectorPosition', opt.v)}
                         style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, border: formData.langSelectorPosition === opt.v ? '2px solid var(--primary)' : '1px solid var(--border)', background: formData.langSelectorPosition === opt.v ? 'var(--primary)' : 'var(--surface)', color: formData.langSelectorPosition === opt.v ? '#fff' : 'var(--text)', cursor: 'pointer' }}>
                         {opt.l}
                       </button>
                     ))}
                   </div>
                </div>

                {/* COL 5: Contur Limbi */}
                <div>
                   <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Contur Etichete Limbi</label>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="color" value={formData.langBorderColor || '#e2e8f0'} onChange={e => handleChange('langBorderColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
                      <input type="text" value={formData.langBorderColor || ''} placeholder="transparent" onChange={e => handleChange('langBorderColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
                      <button type="button" onClick={() => handleChange('langBorderColor', 'transparent')} style={{ fontSize: '0.65rem', padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>Fără</button>
                   </div>
                </div>
                
             </div>
          </div>
        </div>

        {/* Card: Security */}
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Securitate PIN</h3>
            <label className="pc-toggle" style={{ margin: 0 }}>
              <input type="checkbox" checked={usePin} onChange={e => setUsePin(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Blochează tableta până la introducerea primei parole de angajat.</p>
          
          {usePin && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <input 
                type="password" 
                maxLength="6"
                className="pc-input" 
                placeholder="Ex: 1234"
                value={formData.kioskPin}
                onChange={e => handleChange('kioskPin', e.target.value.replace(/\D/g, ''))}
                style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', maxWidth: '140px', fontSize: '1.1rem', letterSpacing: '2px', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
               <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)' }}>Limbi Afișate pe Kiosk</h4>
               <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>★ = limbă implicită</span>
             </div>
             {/* Active languages — ordered list with controls */}
             {(() => {
               const ALL_LANGS = ['ro', 'en', 'fr', 'hu', 'ru', 'uk', 'bg', 'de', 'es'];
               const langNames = { ro: 'RO 🇷🇴', en: 'EN 🇬🇧', fr: 'FR 🇫🇷', hu: 'HU 🇭🇺', ru: 'RU 🇷🇺', uk: 'UA 🇺🇦', bg: 'BG 🇧🇬', de: 'DE 🇩🇪', es: 'ES 🇪🇸' };
               const currentLangs = formData.languages || ['ro', 'en'];
               const defaultLang = formData.defaultLanguage || currentLangs[0];
               const inactive = ALL_LANGS.filter(l => !currentLangs.includes(l));

               const moveLang = (idx, dir) => {
                 const arr = [...currentLangs];
                 const newIdx = idx + dir;
                 if (newIdx < 0 || newIdx >= arr.length) return;
                 [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
                 handleChange('languages', arr);
               };
               const removeLang = (lang) => {
                 const filtered = currentLangs.filter(l => l !== lang);
                 handleChange('languages', filtered);
                 if (defaultLang === lang && filtered.length > 0) handleChange('defaultLanguage', filtered[0]);
               };
               const addLang = (lang) => {
                 handleChange('languages', [...currentLangs, lang]);
               };
               const setDefault = (lang) => handleChange('defaultLanguage', lang);

               return (
                 <div>
                   {/* Selected languages in order */}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                     {currentLangs.map((lang, idx) => {
                       const isDefault = lang === defaultLang;
                       return (
                         <div key={lang} style={{
                           display: 'flex', alignItems: 'center', gap: 6,
                           background: isDefault ? '#0f172a' : 'var(--bg-surface)',
                           border: isDefault ? '1px solid #0f172a' : '1px solid var(--border)',
                           borderRadius: 10, padding: '6px 10px',
                           transition: 'all 0.2s',
                         }}>
                           {/* Drag order number */}
                           <span style={{ fontSize: '0.7rem', color: isDefault ? '#94a3b8' : 'var(--text-muted)', width: 16, textAlign: 'center', fontWeight: 700 }}>{idx + 1}</span>
                           {/* Lang name */}
                           <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 800, color: isDefault ? '#fff' : 'var(--text)' }}>{langNames[lang]}</span>
                           {/* Default star button */}
                           <button
                             type="button"
                             title={isDefault ? 'Limbă implicită (default)' : 'Setează ca limbă implicită'}
                             onClick={() => setDefault(lang)}
                             style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '0.9rem', opacity: isDefault ? 1 : 0.3, color: isDefault ? '#f59e0b' : '#94a3b8', transition: 'all 0.15s' }}
                           >★</button>
                           {/* Up / Down */}
                           <button type="button" onClick={() => moveLang(idx, -1)} disabled={idx === 0}
                             style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', padding: '2px 4px', fontSize: '0.7rem', opacity: idx === 0 ? 0.2 : 0.7, color: isDefault ? '#94a3b8' : 'var(--text-muted)', fontWeight: 700 }}>▲</button>
                           <button type="button" onClick={() => moveLang(idx, 1)} disabled={idx === currentLangs.length - 1}
                             style={{ background: 'none', border: 'none', cursor: idx === currentLangs.length - 1 ? 'default' : 'pointer', padding: '2px 4px', fontSize: '0.7rem', opacity: idx === currentLangs.length - 1 ? 0.2 : 0.7, color: isDefault ? '#94a3b8' : 'var(--text-muted)', fontWeight: 700 }}>▼</button>
                           {/* Remove */}
                           <button type="button" onClick={() => removeLang(lang)} disabled={currentLangs.length === 1}
                             style={{ background: 'none', border: 'none', cursor: currentLangs.length === 1 ? 'default' : 'pointer', padding: '2px 6px', fontSize: '0.75rem', opacity: currentLangs.length === 1 ? 0.2 : 0.6, color: isDefault ? '#f87171' : '#ef4444', fontWeight: 700 }}>✕</button>
                         </div>
                       );
                     })}
                   </div>
                   {/* Pool of inactive languages to add */}
                   {inactive.length > 0 && (
                     <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                       <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: 2 }}>+ Adaugă:</span>
                       {inactive.map(lang => (
                         <button key={lang} type="button" onClick={() => addLang(lang)}
                           style={{ padding: '3px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: '1px dashed #94a3b8', background: 'transparent', color: 'var(--text-muted)', transition: 'all 0.15s' }}>
                           {langNames[lang]}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
               );
             })()}
          </div>
        </div>


        {/* Card: Promoție (Roată Kiosk) */}
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Promoție Kiosk (Roată Noroc)</h3>
            <label className="pc-toggle" style={{ margin: 0 }}>
              <input type="checkbox" checked={formData.promoActive || false} onChange={e => handleChange('promoActive', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Configurează condițiile specifice acestui kiosk pentru afișarea roții.</p>
          
          {formData.promoActive && (
             <div style={{ animation: 'fadeIn 0.3s ease', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px 20px' }}>
               <div>
                 <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>Alege Roata</label>
                 <select 
                   value={formData.promoBrandId || ''} 
                   onChange={e => handleChange('promoBrandId', e.target.value)}
                   style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
                 >
                   <option value="">Alege...</option>
                   <option value="smashme">Roata SmashMe</option>
                   <option value="welovesushi">Roata SushiMaster</option>
                 </select>
               </div>
               
               <div>
                 <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>Moment Apariție Roată</label>
                 <select 
                   value={formData.promoTriggerMoment || 'after_payment'} 
                   onChange={e => handleChange('promoTriggerMoment', e.target.value)}
                   style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
                 >
                   <option value="before_payment">Înainte de Plată (Adaugă în coș)</option>
                   <option value="after_payment">După Confirmare Plată (Prezintă la Casă)</option>
                 </select>
               </div>
               
               <div>
                 <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>Sumă Minimă Coș (RON)</label>
                 <input 
                   type="number" 
                   value={formData.promoMinOrderValue === 0 ? '' : formData.promoMinOrderValue} 
                   onChange={e => handleChange('promoMinOrderValue', Number(e.target.value))}
                   placeholder="Ex: 50"
                   style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
                 />
               </div>

               <div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                   <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Limitare Frecvență</label>
                   <label className="pc-toggle" style={{ margin: 0, transform: 'scale(0.8)' }}>
                     <input type="checkbox" checked={formData.promoFreqEnabled || false} onChange={e => handleChange('promoFreqEnabled', e.target.checked)} />
                     <span className="toggle-slider" />
                   </label>
                 </div>
                 {formData.promoFreqEnabled ? (
                   <>
                     <input 
                       type="number" 
                       value={formData.promoOrdersToAppear === 0 ? '' : formData.promoOrdersToAppear} 
                       onChange={e => handleChange('promoOrdersToAppear', Number(e.target.value))}
                       placeholder="Ex: Apare la fiecare a 3-a comandă"
                       style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
                     />
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ex: Randează doar dacă Comanda % N == 0</span>
                   </>
                 ) : (
                   <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', textAlign: 'center' }}>
                     Roata apare MEREU
                   </div>
                 )}
               </div>

               {/* Previzualizare Roată */}
               {formData.promoBrandId && promosData[formData.promoBrandId] ? (
                 <div style={{ gridColumn: '1 / -1', width: '100%', marginTop: 24, padding: 20, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center', boxSizing: 'border-box' }}>
                   <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Previzualizare Roată Live</h4>
                   {promosData[formData.promoBrandId].active ? (
                     <>
                     <div 
                       style={{ height: 400, overflow: 'hidden', position: 'relative', background: '#0f172a', borderRadius: 16, cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                       onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                       onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                       onClick={() => setShowWheelPreviewFull(true)}
                     >
                       <FortuneWheelPreview config={promosData[formData.promoBrandId].config} brandId={formData.promoBrandId} />
                       <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.9) 0%, transparent 40%)', zIndex: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 20, color: '#fef08a', fontWeight: 800, fontSize: '0.9rem', letterSpacing: 1, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                         Apasă pentru simulare
                       </div>
                     </div>
                     
                     {/* OVERLAY FULLSCREEN */}
                     {showWheelPreviewFull && (
                       <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' }}>
                         
                         {/* Close Button top-right */}
                         <button 
                           onClick={() => setShowWheelPreviewFull(false)}
                           style={{ position: 'absolute', top: 30, right: 40, width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, transition: 'all 0.2s' }}
                           onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                           onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}
                         >
                           Inchide
                         </button>

                         <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, marginBottom: 40, marginTop: -60, textShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100000 }}>
                           Așa se vede pe Kiosk!
                         </h2>
                         
                         <div style={{ width: 800, height: 800, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <FortuneWheelPreview config={promosData[formData.promoBrandId].config} brandId={formData.promoBrandId} scale={1.2} />
                         </div>
                       </div>
                     )}
                     </>
                   ) : (
                     <div style={{ padding: 20, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600 }}>
                       Roata este OPRITĂ din modulul global de Promoții pentru acest brand. Activați-o de acolo mai întâi!
                     </div>
                   )}
                 </div>
               ) : formData.promoBrandId ? (
                 <div style={{ width: '100%', marginTop: 24, padding: 20, color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
                   Nu există date de promoție salvate pentru {formData.promoBrandId}. Adăugați feliile în pagina Promoții.
                 </div>
               ) : null}

             </div>
          )}
        </div>

        {/* Card: Screensaver */}
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Screensaver Standby</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Rulare automată reclamă full-screen dacă tableta stă neatinsă 30s.</p>
          
          <input 
            type="url" 
            className="pc-input" 
            placeholder="URL Video MP4 sau Imagine..."
            value={formData.posterUrl}
            onChange={e => handleChange('posterUrl', e.target.value)}
            style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
          />
          
          {formData.posterUrl ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <div style={{ width: 270, height: 480, borderRadius: 16, overflow: 'hidden', border: '8px solid #1e293b', background: '#000', position: 'relative', boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}>
                {renderPreview(formData.posterUrl)}
                <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.95)', color: '#0f172a', padding: '8px 16px', borderRadius: 24, fontSize: '0.8rem', fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  Atinge pentru a începe
                </div>
              </div>
            </div>
          ) : (
             <div style={{ height: 160, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Fără screensaver.</div>
          )}
        </div>

        {/* Card: Banner Promo (10% Top) */}
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Banner Promo Persistent (Top)</h3>
            <label className="pc-toggle" style={{ margin: 0 }}>
              <input type="checkbox" checked={useBanner} onChange={e => setUseBanner(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Ocupă deasupra interfeței cu o bandă îngustă (10%) reclamă video/imagine la reducere.</p>
          
          {useBanner && (
             <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '16px' }}>
                {formData.brands && formData.brands.length > 0 ? (
                  formData.brands.map(brandId => {
                    const val = formData[`topBannerUrl_${brandId}`] ?? formData.topBannerUrl ?? '';
                    return (
                      <div key={brandId} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                         <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                           <BrandLogo brandId={brandId} size={16} /> Banner pentru {brandId}
                         </label>
                         <input 
                           type="url" 
                           className="pc-input" 
                           placeholder={`URL Video MP4 / Imagine pt ${brandId}...`}
                           value={val}
                           onChange={e => handleChange(`topBannerUrl_${brandId}`, e.target.value)}
                           style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }}
                         />
                         
                         {val ? (
                           <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                             <div style={{ width: 135, height: 240, borderRadius: 12, overflow: 'hidden', border: '6px solid #1e293b', background: '#e2e8f0', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                               <div style={{ position: 'absolute', inset: 0, padding: '4px' }}>
                                 <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
                                 <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
                                 <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px' }} />
                               </div>
                               <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${10 + ((formData.topBannerHeight || 1) - 1) * 5}%`, borderRadius: `${formData.topBannerRadiusTop ? '6px' : '0'} ${formData.topBannerRadiusTop ? '6px' : '0'} ${formData.topBannerRadiusBottom ? '6px' : '0'} ${formData.topBannerRadiusBottom ? '6px' : '0'}`, transition: 'all 0.3s ease', overflow: 'hidden', background: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                                  {renderPreview(val)}
                               </div>
                             </div>
                           </div>
                         ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div>
                    <input 
                      type="url" 
                      className="pc-input" 
                      placeholder="URL Video MP4 sau Imagine globală..."
                      value={formData.topBannerUrl || ''} 
                      onChange={e => handleChange('topBannerUrl', e.target.value)}
                      style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
                    />
                    
                    {formData.topBannerUrl ? (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 16 }}>
                        <div style={{ width: 135, height: 240, borderRadius: 12, overflow: 'hidden', border: '6px solid #1e293b', background: '#e2e8f0', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                          <div style={{ position: 'absolute', inset: 0, padding: '4px' }}>
                            <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
                            <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
                            <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px' }} />
                          </div>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${10 + ((formData.topBannerHeight || 1) - 1) * 5}%`, borderRadius: `${formData.topBannerRadiusTop ? '6px' : '0'} ${formData.topBannerRadiusTop ? '6px' : '0'} ${formData.topBannerRadiusBottom ? '6px' : '0'} ${formData.topBannerRadiusBottom ? '6px' : '0'}`, transition: 'all 0.3s ease', overflow: 'hidden', background: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                             {renderPreview(formData.topBannerUrl)}
                          </div>
                        </div>
                      </div>
                    ) : (
                       <div style={{ height: 80, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Introdu url-ul campaniei.</div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 24, padding: 20, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Configurare Vizuală (Design)</h4>
                  
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
                      <span>Înălțime Banner</span>
                      <span style={{ color: 'var(--text)' }}>Nivel {formData.topBannerHeight} (din 5)</span>
                    </label>
                    <input 
                      type="range" min="1" max="5" step="1"
                      value={formData.topBannerHeight} 
                      onChange={e => handleChange('topBannerHeight', parseInt(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                      <span>Subțire (10%)</span>
                      <span>Lat (30%)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <label className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Colțuri Sus Rotunde</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={formData.topBannerRadiusTop} onChange={e => handleChange('topBannerRadiusTop', e.target.checked)} />
                        <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
                      </div>
                    </label>
                    <label className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Colțuri Jos Rotunde</span>
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
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Banner Promo (Footer / Jos)</h3>
            <label className="pc-toggle" style={{ margin: 0 }}>
              <input type="checkbox" checked={useBottomBanner} onChange={e => setUseBottomBanner(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Apare în partea de jos a ecranului (sub meniu). Suportă Link Video/Imagine sau Text lung editabil.</p>
          
          {useBottomBanner && (
             <div style={{ animation: 'fadeIn 0.3s ease' }}>
                
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text)', fontWeight: 700 }}>1. Reclamă (Video / Imagine)</h4>
                <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>MP4, WebM, imagine — se afișează pe toată înălțimea banerului de jos</p>
                <input 
                  type="url" 
                  className="pc-input" 
                  placeholder="https://... URL video MP4 sau imagine"
                  value={formData.bottomBannerUrl || ''}
                  onChange={e => handleChange('bottomBannerUrl', e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: formData.bottomBannerUrl ? 12 : 20, boxSizing: 'border-box' }}
                />


                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text)', fontWeight: 700 }}>2. Text Derulant</h4>
                <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Apare deasupra reclamei (overlay) sau singur dacă nu e reclamă</p>
                <textarea 
                  className="pc-input" 
                  placeholder="Ex: Burger SmashMe -20% azi! Gratis cartofi la orice combo!"
                  value={formData.bottomBannerText || ''}
                  onChange={e => handleChange('bottomBannerText', e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 12, boxSizing: 'border-box', minHeight: 70, resize: 'vertical' }}
                />

                {/* Text appearance options */}
                {(formData.bottomBannerText || '').length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16, padding: 16, background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    
                    {/* Mode: Fix / Rulant */}
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted,#475569)', display: 'block', marginBottom: 8 }}>MOD AFIȘARE TEXT</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[['false', 'Rulant (scroll)'], ['true', 'Fix (static)']].map(([val, lbl]) => {
                          const isActive = String(formData.bottomBannerTextFixed) === val;
                          return (
                            <button key={val} type="button"
                              onClick={() => handleChange('bottomBannerTextFixed', val === 'true')}
                              style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${isActive ? '#0f172a' : '#cbd5e1'}`, background: isActive ? '#0f172a' : 'var(--surface,#fff)', color: isActive ? '#fff' : 'var(--text-muted,#475569)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                            >{lbl}</button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Position */}
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>POZIȚIE TEXT</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[['left', 'Stanga'], ['center', 'Centru'], ['right', 'Dreapta']].map(([val, lbl]) => (
                          <button key={val} type="button"
                            onClick={() => handleChange('bottomBannerTextAlign', val)}
                            style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${formData.bottomBannerTextAlign === val ? '#0f172a' : '#cbd5e1'}`, background: formData.bottomBannerTextAlign === val ? '#0f172a' : '#fff', color: formData.bottomBannerTextAlign === val ? '#fff' : '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                          >{lbl}</button>
                        ))}
                      </div>
                    </div>

                    {/* Background color */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>CULOARE FUNDAL</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                        <input type="color" value={formData.bottomBannerBg} onChange={e => handleChange('bottomBannerBg', e.target.value)}
                          style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
                        {['#1e293b','#d32f2f','#1a237e','#004d40','#4a148c','#e65100','#212121','#ffffff'].map(c => (
                          <button key={c} type="button" onClick={() => handleChange('bottomBannerBg', c)}
                            style={{ width: 26, height: 26, borderRadius: 6, background: c, border: formData.bottomBannerBg === c ? '3px solid #0f172a' : '2px solid #e2e8f0', cursor: 'pointer', flexShrink: 0 }} />
                        ))}
                        <input type="text" value={formData.bottomBannerBg} onChange={e => handleChange('bottomBannerBg', e.target.value)}
                          style={{ width: 80, fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontFamily: 'monospace' }} />
                      </div>
                    </div>

                    {/* Logo URL */}
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>LOGO PNG (opțional, poți pune un URL sau poți face upload)</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="text" value={formData.bottomBannerLogoUrl || ''} onChange={e => handleChange('bottomBannerLogoUrl', e.target.value)}
                          placeholder="https://... URL imagine PNG/SVG"
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                        <label style={{ cursor: 'pointer', background: '#f1f5f9', color: '#0f172a', padding: '8px 16px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, border: '1px solid #cbd5e1', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                          + Upload
                          <input type="file" accept="image/png, image/jpeg, image/svg+xml, image/webp" style={{ display: 'none' }} onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) {
                              alert('Se permit maxim 2MB pentru un logo base64 ca să nu încetinim tableta. Găsește o variantă mai micșorată.');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              handleChange('bottomBannerLogoUrl', ev.target.result);
                            };
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                      </div>
                      {formData.bottomBannerLogoUrl && (
                        <img src={formData.bottomBannerLogoUrl} alt="logo preview" style={{ height: 32, marginTop: 8, borderRadius: 4, objectFit: 'contain', border: '1px solid var(--border)', background: formData.bottomBannerBg, padding: '4px 8px' }} />
                      )}
                    </div>
                  </div>
                )}
                
                {/* BOTTOM BANNER SIMULATOR */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 8, flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>PREVIEW KIOSK DISPLAY (9:16)</span>
                  <div style={{ width: 135, height: 240, borderRadius: 12, overflow: 'hidden', border: '6px solid #1e293b', background: '#e2e8f0', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                    <div style={{ position: 'absolute', inset: 0, padding: '4px' }}>
                      <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
                      <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
                    </div>
                    
                    <div style={{ 
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: `${10 + ((formData.bottomBannerHeight || 1) - 1) * 5}%`, 
                      borderRadius: `${formData.bottomBannerRadiusTop ? '6px' : '0'} ${formData.bottomBannerRadiusTop ? '6px' : '0'} ${formData.bottomBannerRadiusBottom ? '6px' : '0'} ${formData.bottomBannerRadiusBottom ? '6px' : '0'}`,
                      transition: 'all 0.3s ease',
                      overflow: 'hidden', background: formData.bottomBannerBg || '#000', boxShadow: '0 -4px 12px rgba(0,0,0,0.2)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center'
                    }}>
                       {formData.bottomBannerUrl && (
                         <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                           {renderPreview(formData.bottomBannerUrl)}
                         </div>
                       )}
                       {formData.bottomBannerText && (
                         <div style={{ 
                           position: 'relative', zIndex: 2, padding: '4px 6px', 
                           display: 'flex', alignItems: 'center', gap: '4px',
                           justifyContent: formData.bottomBannerTextAlign === 'center' ? 'center' : formData.bottomBannerTextAlign === 'right' ? 'flex-end' : 'flex-start',
                           background: formData.bottomBannerUrl ? 'rgba(0,0,0,0.45)' : 'transparent',
                           height: '100%', width: '100%', boxSizing: 'border-box'
                         }}>
                           {formData.bottomBannerLogoUrl && <img src={formData.bottomBannerLogoUrl} style={{ height: '60%', objectFit: 'contain' }} alt="Logo" />}
                           <div style={{ color: ['#ffffff', '#f8fafc'].includes(formData.bottomBannerBg) && !formData.bottomBannerUrl ? '#0f172a' : '#fff', fontSize: '5px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                              {formData.bottomBannerText}
                           </div>
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 24, padding: 20, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Configurare Vizuală (Design)</h4>
                  
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
                      <span>Înălțime Banner</span>
                      <span style={{ color: 'var(--text)' }}>Nivel {formData.bottomBannerHeight} (din 5)</span>
                    </label>
                    <input 
                      type="range" min="1" max="5" step="1"
                      value={formData.bottomBannerHeight} 
                      onChange={e => handleChange('bottomBannerHeight', parseInt(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                      <span>Subțire (10%)</span>
                      <span>Lat (30%)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <label className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Colțuri Sus Rotunde</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={formData.bottomBannerRadiusTop} onChange={e => handleChange('bottomBannerRadiusTop', e.target.checked)} />
                        <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
                      </div>
                    </label>
                    <label className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Colțuri Jos Rotunde</span>
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

      </div>

        {/* Card: Personalizare Meniu */}
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Personalizare Meniu Kiosk</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Configează profilul de meniu pe care îl preia acest Kiosk pentru fiecare brand activ, sau editează vizibilitatea produselor strict pe această tabletă.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeBrands.map(brandId => {
               const bData = brandProfiles[brandId];
               if (!bData || !bData.brand) return null;
               
               const brandOverrides = (formData.menuOverrides || {})[brandId] || {};
               const currentProfileId = brandOverrides.profileId || '';
               const localHiddenCount = Object.keys(brandOverrides.hiddenItems || {}).length;

               return (
                 <div key={brandId} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <BrandLogo brandId={brandId} size={24} />
                      <strong style={{ fontSize: '1.05rem', color: 'var(--text)' }}>Meniu {bData.brand.name}</strong>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
                       <div style={{ flex: 1, minWidth: '220px' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Aplică un Șablon Global</label>
                          <select 
                            className="pc-input"
                            value={currentProfileId}
                            onChange={(e) => {
                               const newOverrides = { ...formData.menuOverrides };
                               if (!newOverrides[brandId]) newOverrides[brandId] = { hiddenItems: {} };
                               newOverrides[brandId] = { ...newOverrides[brandId], profileId: e.target.value };
                               handleChange('menuOverrides', newOverrides);
                            }}
                            style={{ padding: '10px 14px', borderRadius: 30, border: '1px solid var(--border)', width: '100%', outline: 'none', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem' }}
                          >
                            <option value="">Afișează Meniul Complet (Implicit)</option>
                            {bData.profiles.map(p => (
                               <option key={p.id} value={p.id}>{p.name} ({Object.keys(p.hiddenItems || {}).length} ascunse)</option>
                            ))}
                          </select>
                       </div>

                       <div style={{ flex: 1, minWidth: '220px' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Suprascriere Manuală Kiosk</label>
                          <button 
                            className="um-btn"
                            onClick={() => {
                               const overrides = formData.menuOverrides[brandId] || { hiddenItems: {} };
                               const profile = bData.profiles.find(p => p.id === overrides.profileId) || { name: 'Meniu Complet (Fără Șablon)', rootFolderId: null, hiddenItems: {} };
                               setEditingMenuBrand({
                                   brand: bData.brand,
                                   profile,
                                   localHiddenItemsOverride: overrides.hiddenItems || {}
                               });
                            }}
                            style={{ padding: '10px 14px', borderRadius: 30, background: localHiddenCount > 0 ? '#eff6ff' : '#fff', color: localHiddenCount > 0 ? '#3b82f6' : 'var(--text)', border: `1px solid ${localHiddenCount > 0 ? '#3b82f6' : 'var(--border)'}`, width: '100%', display: 'flex', justifyContent: 'center', fontWeight: localHiddenCount > 0 ? 700 : 500 }}
                          >
                             Editează Vizibilitatea {localHiddenCount > 0 && `(${localHiddenCount} specifice)`}
                          </button>
                       </div>
                    </div>
                 </div>
               );
            })}
          </div>
        </div>


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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
  const sorted = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleFilterChange = (f) => { setFilter(f); setCurrentPage(1); };

  if (loading) return <p style={{color:'var(--text-muted)'}}>Se incarca...</p>;

  if (editingLoc) {
    return <LocationEditForm loc={editingLoc} backend={backend} onBack={() => setEditingLoc(null)} onSave={fetchLocs} />;
  }

  return (
    <div className="loc-manager">
      {/* Filters Add button */}
      <div className="loc-controls">
        <div className="loc-filters">
          <button className={`loc-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => handleFilterChange('all')}>
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
                onClick={() => handleFilterChange(k)}
              >
                <BrandLogo brandId={k} size={14} /> {v} ({count})
              </button>
            );
          })}
        </div>
        <button className="loc-add-btn" onClick={() => setShowAdd(!showAdd)}>Adauga locatie</button>
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
      <div className="loc-list-container" style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.04)', marginTop: '24px' }}>
        <table className="loc-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <th style={{ padding: '14px 16px', fontWeight: 600 }}>#</th>
              <th style={{ padding: '14px 16px', fontWeight: 600 }}>Nume Locație</th>
              <th style={{ padding: '14px 16px', fontWeight: 600 }}>Branduri Active</th>
              <th style={{ padding: '14px 16px', fontWeight: 600 }}>Statistici</th>
              <th style={{ padding: '14px 16px', fontWeight: 600 }}>Stare</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((loc, index) => (
              <tr key={loc.id} style={{ borderBottom: '1px solid var(--border)', opacity: loc.active ? 1 : 0.6, cursor: 'pointer' }} onClick={() => setEditingLoc(loc)} className="loc-list-row">
                <td style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </td>
                <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text)', fontSize: '1rem' }}>
                  {loc.name}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: 4 }}>ID: {loc.id}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(loc.brands || []).map(b => <BrandLogo key={b} brandId={b} size={24} />)}
                  </div>
                </td>
                <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 6 }}>Mese: {loc.tables || 0}</span>
                    <span style={{ background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 6 }}>Kiosk-uri: {(loc.kiosks || []).length}</span>
                  </div>
                </td>
                <td style={{ padding: '16px' }} onClick={(e) => e.stopPropagation()}>
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 6px' }} 
                    onClick={() => toggleActive(loc)} 
                    title={loc.active ? 'Acum e LIVE (Apasă pentru dezactivare)' : 'Inactiv (Apasă pentru activare)'}
                  >
                     <span style={{ width: 10, height: 10, borderRadius: '50%', background: loc.active ? '#088c8c' : '#ef4444', display: 'inline-block' }} />
                  </div>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button 
                      title="Configurare locație"
                      className="btn-business-icon"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => setEditingLoc(loc)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                    <button 
                      title="Șterge definitiv locația"
                      className="btn-business-icon"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
        {filtered.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>Nu există locații care să corespundă filtrelor.</div>}

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Rânduri pe pagină:</span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              style={{ fontSize: '0.82rem', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 8 }}>
              {sorted.length === 0 ? '0' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(sorted.length, currentPage * itemsPerPage)}`} din {sorted.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { label: '«', action: () => setCurrentPage(1),           disabled: currentPage === 1,          title: 'Prima pagină' },
              { label: '‹', action: () => setCurrentPage(p => p - 1), disabled: currentPage === 1,          title: 'Anterioară' },
              { label: '›', action: () => setCurrentPage(p => p + 1), disabled: currentPage === totalPages, title: 'Următoarea' },
              { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages, title: 'Ultima pagină' },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} disabled={btn.disabled} title={btn.title}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', background: btn.disabled ? '#f1f5f9' : '#fff', color: btn.disabled ? '#cbd5e1' : '#334155', cursor: btn.disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              >{btn.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LocationEditForm (Restored from Git History) ─────────────────────────────────
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
    <div className="loc-edit-form fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button onClick={onBack}
          style={{ padding: '8px 18px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          ← Înapoi
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            {loc.name}
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Editare locație</p>
        </div>
        <button onClick={saveLoc}
          style={{ padding: '11px 26px', borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(15,23,42,0.2)', flexShrink: 0 }}>
          Salvează Modificările
        </button>
      </div>

      <div className="loc-edit-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr)', gap: '24px', maxWidth: 800 }}>
        {/* Card: Nume & Mese */}
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', marginBottom: 20 }}>Informații Generale</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
               <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Nume Locație</label>
               <input type="text" className="input-field" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', boxSizing: 'border-box', marginTop: 6 }} value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="Ex: SM Bacau" />
            </div>
            <div>
               <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Număr de Mese (Generate Kiosk/QR)</label>
               <input type="number" className="input-field" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', boxSizing: 'border-box', marginTop: 6 }} value={formData.tables} onChange={e => handleChange('tables', parseInt(e.target.value)||0)} min="0" />
            </div>
          </div>
        </div>

        {/* Card: Branduri Asignate */}
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', marginBottom: 20 }}>Restaurante Active în Kiosk</h3>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {Object.entries({smashme:'SmashMe',sushimaster:'Sushi Master',welovesushi:'WeLoveSushi',ikura:'Ikura'}).map(([k, v]) => {
              const isActive = formData.brands.includes(k);
              const pillColor = (BRAND_COLORS && BRAND_COLORS[k]) ? BRAND_COLORS[k] : '#64748b';
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
                    fontWeight: 600, transition: 'all 0.2s', cursor: 'pointer',
                    filter: isActive ? 'none' : 'grayscale(100%) opacity(0.8)'
                  }}
                  onClick={() => toggleBrand(k)}
                >
                  <BrandLogo brandId={k} size={18} /> {v}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card: Syrve API Keys */}
        <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', marginBottom: 8 }}>Setări Syrve (iiko) per locație</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Dacă un brand folosește un `Organization ID` diferit față de cel global (din .env), pune-l aici pentru a trimite comenzile corect la POS-ul locației corespunzătoare.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             {formData.brands.map(bId => (
               <div key={bId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                 <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Overide ID Organizație ({bId}):</label>
                 <input type="text" className="input-field" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', boxSizing: 'border-box', marginTop: 6 }} value={formData.orgIds[bId] || ''} onChange={e => handleOrgChange(bId, e.target.value)} placeholder="Lăsați gol pentru ID-ul global" />
               </div>
             ))}
             {formData.brands.length === 0 && <span style={{fontSize:'0.85rem', color:'var(--warning)'}}>Selectează măcar un brand pentru a seta suprascrieri de locație Syrve.</span>}
          </div>
        </div>
        
      </div>
    </div>
  );
}

function BrandsManager({ backend }) {
  const { fetchWithAuth } = useAuth();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // brandId being edited
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBrands = () => {
    setLoading(true);
    fetchWithAuth(`${backend}/api/brands`)
      .then(r => r.json())
      .then(d => { setBrands(d.brands || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(fetchBrands, [backend]);

  const startEdit = (brand) => {
    setEditing(brand.id);
    setForm({ name: brand.name || '', description: brand.description || '', website: brand.website || '', logo_url: brand.logo_url || '' });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`${backend}/api/brands/${editing}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { showToast('Brand salvat!'); fetchBrands(); setEditing(null); }
      else showToast('Eroare la salvare', 'error');
    } catch { showToast('Conexiune eșuată', 'error'); }
    setSaving(false);
  };

  const handleLogoUpload = async (brandId, file) => {
    if (!file) return;
    setUploadingId(brandId);
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const res = await fetchWithAuth(`${backend}/api/brands/${brandId}/logo`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) { showToast('Logo încărcat!'); fetchBrands(); }
      else showToast(data.error || 'Eroare upload', 'error');
    } catch { showToast('Upload eșuat', 'error'); }
    setUploadingId(null);
  };

  const BRAND_DEFAULT_COLORS = {
    smashme: '#ef4444', sushimaster: '#3b82f6', ikura: '#8b5cf6', welovesushi: '#ec4899',
  };

  if (loading) return <p className="loading-text">Se încarcă brandurile...</p>;

  return (
    <div className="admin-section">
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
        Gestionează informațiile și logo-urile pentru fiecare brand din sistem.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {brands.map(brand => {
          const isEditing = editing === brand.id;
          const color = BRAND_DEFAULT_COLORS[brand.id] || 'var(--primary)';
          return (
            <div key={brand.id} style={{
              background: 'var(--surface)', borderRadius: 20, padding: 24,
              border: `1px solid var(--border)`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              outline: isEditing ? `2px solid ${color}` : 'none',
              transition: 'all 0.2s',
            }}>
              {/* Logo + brand ID header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 16,
                  background: `${color}15`,
                  border: `2px solid ${color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  {brand.logo_url ? (
                    <img src={brand.logo_url} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '1.8rem', fontWeight: 900, color, opacity: 0.4 }}>{(brand.name||brand.id)[0].toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>{brand.name || brand.id}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{brand.id}</div>
                  {brand.website && (
                    <a href={brand.website} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: color, textDecoration: 'none', fontWeight: 600 }}>
                      {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  )}
                </div>
              </div>

              {!isEditing ? (
                <>
                  {brand.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>{brand.description}</p>}

                  {/* Logo upload area */}
                  <label style={{
                    display: 'block', border: '2px dashed var(--border)', borderRadius: 12,
                    padding: '12px', textAlign: 'center', cursor: 'pointer',
                    background: 'var(--bg-surface)', transition: 'all 0.2s', marginBottom: 12,
                  }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleLogoUpload(brand.id, e.target.files[0])} />
                    {uploadingId === brand.id ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Se încarcă...</span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Upload logo (PNG/JPG/SVG, max 5MB)
                      </span>
                    )}
                  </label>

                  {/* Or paste URL */}
                  {brand.logo_url && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 12, wordBreak: 'break-all', fontFamily: 'monospace', background: 'var(--bg-surface)', padding: '6px 8px', borderRadius: 6 }}>
                      {brand.logo_url}
                    </div>
                  )}

                  <button onClick={() => startEdit(brand)} style={{
                    width: '100%', padding: '10px', borderRadius: 10,
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                  }}>
                    Editează informații
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nume brand</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Descriere</label>
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Website</label>
                    <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                      placeholder="https://smashme.ro" type="url"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Logo URL (sau uploadează mai sus)</label>
                    <input value={form.logo_url} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
                      placeholder="https://cdn.example.com/logo.png" type="url"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                  </div>
                  {form.logo_url && (
                    <div style={{ height: 60, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                      <img src={form.logo_url} alt="Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveEdit} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 10, background: color, color: '#fff', border: 'none', fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontSize: '0.9rem' }}>
                      {saving ? 'Se salvează...' : 'Salvează'}
                    </button>
                    <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                      Anulează
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#fff', padding: '14px 24px', borderRadius: '14px',
          fontWeight: 700, fontSize: '0.95rem', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>{toast.type === 'error' ? '✕' : '✓'}</span> {toast.msg}
        </div>
      )}
    </div>
  );
}
