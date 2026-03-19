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
  const [tab,       setTab]       = useState('orders'); // orders | menu | stats
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
