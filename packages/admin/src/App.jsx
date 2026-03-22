import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import { useAuth } from './context/AuthProvider';
import LoginScreen from './screens/LoginScreen';
import UsersManager from './screens/UsersManager';

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
    const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'users'];
    return validTabs.includes(hash) ? hash : 'orders';
  });

  const setTab = (newTab) => {
    window.location.hash = newTab;
    setTabState(newTab);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'users'];
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

  if (!token) return <LoginScreen />;

  return (
    <div className="admin-app">
      {/* ─── Sidebar ─── */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span className="al-text" style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.5px' }}>Smart Kiosk<br/><small style={{ fontWeight: 400, opacity: 0.7, fontSize: '0.8rem' }}>Admin Panel</small></span>
        </div>
        <nav className="admin-nav">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'orders',    label: 'Comenzi' },
            { id: 'locations', label: 'Locații' },
            { id: 'kiosks',    label: 'Kioskuri' },
            { id: 'qrcodes',   label: 'QR Coduri' },
            { id: 'menu',      label: 'Meniu / Syrve' },
            ...(user?.role === 'admin' ? [{ id: 'users', label: 'Echipă' }] : []),
          ].map(item => (
            <button
              key={item.id}
              className={`anav-btn ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
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
        {/* Notifications */}
        <div className="notif-stack">
          {notifications.map(n => (
            <div key={n.id} className="notif">{n.msg}</div>
          ))}
        </div>

        {/* ─── DASHBOARD ─── */}
        {tab === 'dashboard' && (
          <div className="admin-section">
            <h2 className="section-title">Dashboard — Azi</h2>
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
              <h2 className="section-title">Comenzi</h2>
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
              <h2 className="section-title">Meniu din Syrve</h2>
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
            <KiosksManager backend={BACKEND} />
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

  return (
    <div className="kiosk-location-list">
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
             const finalKioskUrl = loc.kioskUrl || `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;

             return (
               <div key={loc.id} className="kl-location-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div className="kl-loc-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`kl-status ${loc.active ? 'kl-online' : 'kl-offline'}`} />
                      <span className="kl-loc-name" style={{fontSize: '1.05rem', fontWeight: 600, marginRight: 8}}>{loc.name} <span style={{opacity: 0.4, fontSize: '0.8rem', fontWeight: 400}}>({loc.id})</span></span>
                      
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 8, borderLeft: '1px solid rgba(0,0,0,0.1)' }}>
                        {(loc.brands || (loc.brandId ? [loc.brandId] : [])).map(b => (
                          <BrandLogo key={b} brandId={b} size={22} />
                        ))}
                      </div>
                    </div>
                    
                    <button
                      className="kl-poster-btn"
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
                      onClick={() => setEditingLoc(loc)}
                    >
                      Editează Screensaver & Link Custom →
                    </button>
                 </div>
                 
                 <div style={{ width: '100%', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.05)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 500 }}>Link Universal:</span>
                    <input 
                      type="text" 
                      readOnly 
                      value={finalKioskUrl}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: '#0f172a', outline: 'none', fontFamily: 'monospace' }}
                    />
                    <button 
                      style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: 6, color: '#334155', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                      onClick={() => {
                        navigator.clipboard.writeText(finalKioskUrl);
                        alert('Link-ul a fost copiat!');
                      }}
                    >
                      Copiază Link
                    </button>
                 </div>
               </div>
             )
           })}
        </div>
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
    kioskPin: loc.kioskPin || '',
    brands: loc.brands || [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Toggles for optional sections
  const [usePin, setUsePin] = useState(!!loc.kioskPin);
  const [useBanner, setUseBanner] = useState(!!loc.topBannerUrl);

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
      <div className="loc-edit-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 16, marginBottom: 24 }}>
        <div>
           <button className="loc-back-btn" onClick={onBack} style={{ padding: 0, color: '#64748b', fontWeight: 600, border: 'none', background: 'none' }}>← Înapoi</button>
           <h2 style={{ margin: '8px 0 0 0', fontSize: '1.5rem', color: '#0f172a' }}>Configurare Kiosk: <span style={{color:'#3b82f6'}}>{loc.name}</span></h2>
        </div>
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
            boxShadow: saveSuccess ? '0 4px 14px rgba(16, 185, 129, 0.4)' : '0 4px 14px rgba(15, 23, 42, 0.2)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
          }}
        >
          {saveSuccess ? '✅ Configurație Salvată' : isSaving ? '⏳ Se procesează...' : '💾 Salvează Schimbările'}
        </button>
      </div>

      <div className="loc-edit-grid" style={{ gridTemplateColumns: 'minmax(400px, 1fr) 1fr', gap: '24px' }}>
        
        {/* Card: Comportament */}
        <div className="loc-edit-card" style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>📱 Conținut Kiosk</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 20 }}>Selectează restaurantele pe care clienții le pot explora din această tabletă.</p>
          
          <div className="loc-brand-select" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {Object.entries({smashme:'SmashMe',sushimaster:'Sushi Master',welovesushi:'WeLoveSushi',ikura:'Ikura'}).map(([k, v]) => {
              const isActive = formData.brands.includes(k);
              const pillColor = BRAND_COLORS ? BRAND_COLORS[k] : '#3b82f6';
              return (
                <button
                  key={k}
                  className={`loc-brand-pill ${isActive ? 'active' : ''}`}
                  style={{ 
                    padding: '8px 16px', borderRadius: '10px', 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    background: isActive ? pillColor : '#f8fafc', 
                    color: isActive ? '#fff' : '#475569', 
                    border: isActive ? `2px solid ${pillColor}` : '2px solid transparent',
                    boxShadow: isActive ? `0 4px 12px ${pillColor}40` : 'none',
                    fontWeight: 600, transition: 'all 0.2s'
                  }}
                  onClick={() => toggleBrand(k)}
                >
                  <BrandLogo brandId={k} size={16} /> {v}
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
                  <div style={{ height: 80, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                     {renderPreview(formData.topBannerUrl)}
                  </div>
                ) : (
                   <div style={{ height: 80, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>Introdu url-ul campaniei.</div>
                )}
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
                >Modifică</button>
                <button
                  className={`loc-toggle ${loc.active ? 'loc-toggle--on' : ''}`}
                  onClick={() => toggleActive(loc)}
                  title={loc.active ? 'Dezactiveaza' : 'Activeaza'}
                >{loc.active ? 'ON' : 'OFF'}</button>
                <button className="loc-del" onClick={() => deleteLoc(loc.id)} title="Sterge" style={{padding: '0 8px', fontSize: '0.85rem', fontWeight: 600}}>Șterge</button>
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

