import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { io } from 'socket.io-client';

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
import { useConfirm } from './components/ConfirmModal';
import { LayoutDashboard, Receipt, MapPin, MonitorSmartphone, QrCode, Utensils, Languages, Image as ImageIcon, Tags, Users, Blocks, Gift, Store, Sun, Moon, LogOut, Menu, X } from 'lucide-react';

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

const BRAND_COLORS = { smashme: '#ef4444', crunch: '#eab308', rollmaster: '#3b82f6', lovesushi: '#ec4899', pokiwoki: '#f97316' };

function BrandLogo({ brandId, size = 18 }) {
  const logos = {
    smashme: '/brands/smashme-logo.png',
    crunch: '/brands/crunch-logo.png',
    rollmaster: '/brands/rollmaster-logo.png',
    lovesushi: '/brands/lovesushi-logo.png',
    pokiwoki: '/brands/pokiwoki-logo.png'
  };
  const src = logos[brandId];
  if (src) return <img src={src} alt={brandId} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline-block'; }} /> 
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
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-300">
      
      {/* ─── GLOBAL TOP HEADER ─── */}
      <header className="h-20 shrink-0 px-8 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 shadow-sm transition-colors duration-300">
        
        {/* Left: Logo & Mobile Toggle */}
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center h-full">
            <img 
              src={theme === 'dark' ? "/getapp_smart_kiosk_white.png" : "/getapp_smart_kiosk_logo.png"} 
              alt="GetApp Smart Kiosk" 
              className="max-h-12 object-contain" 
            />
          </div>
          <button className="md:hidden p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button 
            title={theme === 'dark' ? 'Mod Luminos' : 'Mod Întunecat'}
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button 
            title="Deconectare"
            onClick={logout} 
            className="w-10 h-10 rounded-full flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ─── BODY (Sidebar + Main) ─── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ─── Sidebar ─── */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}
        <aside className={`w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all duration-300 z-30 ${isSidebarOpen ? 'fixed inset-y-0 left-0 shadow-2xl' : 'hidden md:flex'}`}>
          <button className="md:hidden absolute right-4 top-4 text-slate-500" onClick={() => setIsSidebarOpen(false)}><X className="w-5 h-5" /></button>
          
          <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
              { id: 'orders',    label: 'Comenzi', icon: <Receipt className="w-5 h-5" /> },
              { id: 'locations', label: 'Locații', icon: <MapPin className="w-5 h-5" /> },
              { id: 'kiosks',    label: 'Kioskuri', icon: <MonitorSmartphone className="w-5 h-5" /> },
              { id: 'qrcodes',   label: 'QR Coduri', icon: <QrCode className="w-5 h-5" /> },
              { id: 'menu',      label: 'Meniu / Syrve', icon: <Utensils className="w-5 h-5" /> },
              { id: 'translations', label: 'Traduceri Automate', icon: <Languages className="w-5 h-5" /> },
              { id: 'modifiers', label: 'Imagini Opțiuni', icon: <ImageIcon className="w-5 h-5" /> },
              { id: 'products', label: 'Produse & Etichete', icon: <Tags className="w-5 h-5" /> },
              ...(user?.role === 'admin' ? [{ id: 'users', label: 'Echipă', icon: <Users className="w-5 h-5" /> }] : []),
              ...(user?.role === 'admin' ? [{ id: 'integrations', label: 'Integrări POS', icon: <Blocks className="w-5 h-5" /> }] : []),
              ...(user?.role === 'admin' ? [{ id: 'promotions', label: 'Promoții', icon: <Gift className="w-5 h-5" /> }] : []),
              ...(user?.role === 'admin' ? [{ id: 'brands', label: 'Branduri', icon: <Store className="w-5 h-5" /> }] : []),
            ].map(item => (
              <button
                key={item.id}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${tab === item.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'}`}
                onClick={() => { setTab(item.id); setIsSidebarOpen(false); }}
              >
                <span className={tab === item.id ? 'opacity-100' : 'opacity-75'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${connected ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {connected ? 'Live' : 'Offline'}
            </div>
          </div>
        </aside>

        {/* ─── Main ─── */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-900 relative">
        <div className="shrink-0 p-8">
           <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              {tab === 'dashboard' && 'Dashboard Overview'}
              {tab === 'orders' && 'Gestionare Comenzi'}
              {tab === 'locations' && 'Gestionare Locații'}
              {tab === 'kiosks' && 'Kiosk-uri & Screensavere'}
              {tab === 'qrcodes' && 'Coduri QR & Portal Mobil'}
              {tab === 'menu' && 'Sincronizare Syrve & Profile'}
              {tab === 'translations' && 'Traduceri Automate Meniu'}
              {tab === 'modifiers' && 'Asociere Imagini Opțiuni'}
              {tab === 'products' && 'Produse & Etichete (Overrides)'}
              {tab === 'users' && 'Echipă & Permisiuni'}
              {tab === 'integrations' && 'Integrări POS'}
              {tab === 'promotions' && 'Promoții / Roată Kiosk'}
              {tab === 'brands' && 'Gestionare Branduri'}
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
          <div className="space-y-8 px-4 md:px-8 pb-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Comenzi Azi" value={stats.total} color="var(--primary)" large />
              <StatCard label="SmashMe"   value={stats.smashme} color={BRAND_COLORS.smashme} />
              <StatCard label="SushiMaster" value={stats.sushimaster} color={BRAND_COLORS.sushimaster} />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Ultimele 10 comenzi</h3>
              <OrdersTable orders={orders.slice(0, 10)} />
            </div>
          </div>
        )}

        {/* ─── ORDERS ─── */}
        {tab === 'orders' && (
          <div className="space-y-6 px-4 md:px-8 pb-10">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['all','smashme','crunch','rollmaster','lovesushi','pokiwoki'].map(b => (
                <button
                  key={b}
                  className={`shrink-0 px-5 h-10 rounded-full text-sm font-bold flex items-center gap-2 border transition-colors ${brandFilter === b ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  onClick={() => setBrandFilter(b)}
                >
                  {b === 'all' ? 'Toate' : <><BrandLogo brandId={b} size={14} /> {b === 'smashme' ? 'SmashMe' : b === 'crunch' ? 'Crunch' : b === 'rollmaster' ? 'Roll Master' : b === 'lovesushi' ? 'Love Sushi' : 'Poki-Woki'}</>}
                </button>
              ))}
            </div>
            <OrdersTable orders={filteredOrders} full />
          </div>
        )}

        {/* ─── MAIN CONTENT WRAPPER ─── */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-10">
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
    </div>
  );
}

function StatCard({ label, value, color, large }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-center" style={{ borderLeft: `4px solid ${color}` }}>
      <span className={`font-bold text-slate-900 dark:text-white ${large ? 'text-4xl' : 'text-3xl'}`}>{value}</span>
      <span className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-2">{label}</span>
    </div>
  );
}

function OrdersTable({ orders, full }) {
  if (!orders || orders.length === 0)
    return <p className="text-slate-500 dark:text-slate-400 py-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">Nicio comandă</p>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">#</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Brand</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Canal</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Tip</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Produse</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Ora</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {orders.map(o => {
            const sc = STATUS_LABELS[o.status] || { label: o.status, color: '#6b7a99' };
            return (
              <tr key={o._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">#{o.orderNumber}</td>
                <td className="px-6 py-4">
                  <span style={{ color: BRAND_COLORS[o.brand] }} className="flex items-center gap-2 text-sm font-bold">
                    <BrandLogo brandId={o.brand} size={16} /> {o.brand}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300"><span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-medium">{o.channel}</span></td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{o.orderType === 'dine-in' ? `Masa ${o.tableNumber}` : 'Caserie'}</td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                  <div className="max-w-[200px] truncate" title={(o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ')}>
                    {(o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ').slice(0, 40)}...
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{(o.totalAmount || 0).toFixed(0)} lei</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ backgroundColor: `${sc.color}20`, color: sc.color, border: `1px solid ${sc.color}40` }}>
                    ● {sc.label}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{o.createdAt ? new Date(o.createdAt).toLocaleTimeString('ro-RO') : '—'}</td>
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

  if (loading) return <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 animate-pulse h-64"></div>;

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
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><BrandLogo brandId={brandId} size={20} /> {brandName}</span>
        <label className="flex items-center gap-3 cursor-pointer">
          <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{enabled ? 'Activ' : 'Inactiv'}</span>
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <div className={`block w-14 h-8 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${enabled ? 'transform translate-x-6' : ''}`}></div>
          </div>
        </label>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Link poster (imagine, video, sau pagină web)</label>
          <input
            className="w-full px-4 h-10 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            type="url"
            placeholder="https://example.com/promo.jpg"
            value={url}
            onChange={handleUrlChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Tip conținut:</label>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
            {['image', 'video', 'iframe'].map(t => (
              <button
                key={t}
                className={`px-4 h-8 rounded-full text-sm font-bold transition-colors ${type === t ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
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
        <div className="px-6 pb-6">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Preview:</span>
          <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative">
            {type === 'image' && <img src={url} alt="Preview" className="w-full h-full object-contain" onError={e => e.target.src=''} />}
            {type === 'video' && <video src={url} autoPlay muted loop className="w-full h-full object-contain" />}
            {type === 'iframe' && <iframe src={url} title="Preview" className="w-full h-full border-none" />}
          </div>
        </div>
      )}

      <div className="mt-auto p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
        <button className="px-5 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all" onClick={save}>
          {saved ? 'Salvat!' : 'Salvează'}
        </button>
        {url && <button className="px-5 h-10 rounded-full bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold transition-colors" onClick={remove}>Șterge</button>}
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
    rollmaster: { name: 'Roll Master', color: '#3b82f6' }, lovesushi: { name: 'Love Sushi', color: '#ec4899' }, pokiwoki: { name: 'Poki-Woki', color: '#f97316' }, crunch: { name: 'Crunch', color: '#eab308' },
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            className={`shrink-0 px-5 h-10 rounded-full text-sm font-bold flex items-center gap-2 border transition-colors ${brandFilter === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
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
              className={`shrink-0 px-5 h-10 rounded-full text-sm font-bold flex items-center gap-2 border transition-colors ${brandFilter === bid ? 'bg-white dark:bg-slate-900 shadow-sm border-slate-300 dark:border-slate-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              style={brandFilter === bid ? { borderColor: m.color, color: m.color } : {}}
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
          className="shrink-0 px-5 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          Refresh
        </button>
      </div>

      {/* Tabel Business */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12">#</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Denumire & ID</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Branduri Admise</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Stare</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginated.map((loc, index) => {
              const finalKioskUrl = loc.kioskUrl || `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;
              const brandsArr = loc.brands || (loc.brandId ? [loc.brandId] : []);
              
              return (
                <tr key={loc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-900 dark:text-white text-base">{loc.name}</span>
                      <span className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 self-start px-2 py-0.5 rounded">{loc.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 items-center flex-wrap max-w-[200px]">
                      {brandsArr.map(b => (
                         <div key={b} title={brandMeta[b]?.name || b}><BrandLogo brandId={b} size={28} /></div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <span className={`w-3 h-3 rounded-full ${loc.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} title={loc.active ? 'Online' : 'Inactiv'} />
                       <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{loc.active ? 'Online' : 'Inactiv'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        title="Restartare Ecrane Remote"
                        className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:hover:bg-orange-500/10 dark:hover:text-orange-400 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={restartingId === loc.id ? 'animate-spin' : ''}><path d="M2.5 2v6h6M21.5 22v-6h-6"/><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/></svg>
                      </button>
                      <a 
                        title="Vizualizare Kiosk direct"
                        href={finalKioskUrl} target="_blank" rel="noreferrer"
                        className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </a>
                      <button 
                        title="Copiază Link Universal"
                        className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                      <button 
                        title="Setări și Screensaver"
                        className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 dark:hover:bg-purple-500/10 dark:hover:text-purple-400 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
                        onClick={() => setEditingLoc(loc)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Rânduri pe pagină:</span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-sm font-medium text-slate-500 ml-2 hidden sm:block">
              {(currentPage - 1) * itemsPerPage + 1}–{Math.min(sorted.length, currentPage * itemsPerPage)} din {sorted.length}
            </span>
          </div>
          <div className="flex gap-1">
            {[
              { label: '«', action: () => setCurrentPage(1),            disabled: currentPage === 1,          title: 'Prima pagină' },
              { label: '‹', action: () => setCurrentPage(p => p - 1),  disabled: currentPage === 1,          title: 'Anterioară' },
              { label: '›', action: () => setCurrentPage(p => p + 1),  disabled: currentPage === totalPages, title: 'Următoarea' },
              { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages, title: 'Ultima pagină' },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} disabled={btn.disabled} title={btn.title}
                className={`w-8 h-8 rounded-lg border text-sm font-bold flex items-center justify-center transition-colors ${btn.disabled ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'}`}
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
                const v = {smashme:'SmashMe', crunch:'Crunch', rollmaster:'Roll Master', lovesushi:'Love Sushi', pokiwoki:'Poki-Woki'}[k] || k;
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
              {Object.entries({smashme:'SmashMe', crunch:'Crunch', rollmaster:'Roll Master', lovesushi:'Love Sushi', pokiwoki:'Poki-Woki'}).map(([k, v]) => {
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
const BRAND_LABELS = { smashme: 'SmashMe', crunch: 'Crunch', rollmaster: 'Roll Master', lovesushi: 'Love Sushi', pokiwoki: 'Poki-Woki' };
const BRAND_PILL_COLORS = { smashme: '#ef4444', crunch: '#eab308', rollmaster: '#3b82f6', lovesushi: '#ec4899', pokiwoki: '#f97316' };

function LocationsManager({ backend }) { 
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
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

  const deleteLoc = async (id) => {
    const ok = await confirm('Ștergi această locație?', { title: 'Ștergere locație', icon: '🗑️', okLabel: 'Șterge', danger: true });
    if (!ok) return;
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
    <div className="space-y-6">
      {/* Filters & Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button className={`px-4 h-10 rounded-full text-sm font-bold transition-all ${filter === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`} onClick={() => handleFilterChange('all')}>
            Toate ({locations.length})
          </button>
          {Object.entries(BRAND_LABELS).map(([k, v]) => {
            const count = locations.filter(l => l.brands?.includes(k)).length;
            if (!count) return null;
            return (
              <button
                key={k}
                className={`px-4 h-10 rounded-full text-sm font-bold flex items-center gap-2 transition-all border ${filter === k ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                onClick={() => handleFilterChange(k)}
              >
                <BrandLogo brandId={k} size={14} /> {v} ({count})
              </button>
            );
          })}
        </div>
        <button className="px-5 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all whitespace-nowrap" onClick={() => setShowAdd(!showAdd)}>
          Adaugă Locație
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
          <input
            type="text"
            placeholder="Nume locație (ex: SM Brașov)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
          <div className="flex items-center gap-2 overflow-x-auto max-w-full">
            {Object.entries(BRAND_LABELS).map(([k, v]) => (
              <button
                key={k}
                className={`px-3 h-10 rounded-xl text-sm font-bold flex items-center gap-2 shrink-0 border transition-colors ${newBrands.includes(k) ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                onClick={() => toggleBrand(k)}
              ><BrandLogo brandId={k} size={14} /> {v}</button>
            ))}
          </div>
          <input
            type="number"
            min="1" max="100"
            value={newTables}
            onChange={e => setNewTables(Number(e.target.value))}
            className="w-24 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            placeholder="Nr. mese"
          />
          <button className="px-5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all" onClick={createLocation}>Salvează</button>
        </div>
      )}

      {/* Locations table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">#</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Nume Locație</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Branduri Active</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Statistici</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Stare</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.map((loc, index) => (
                <tr key={loc.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!loc.active ? 'opacity-60 grayscale' : ''}`} onClick={() => setEditingLoc(loc)}>
                  <td className="px-6 py-4 text-sm font-bold text-slate-400 dark:text-slate-500">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{loc.name}</div>
                    <div className="text-xs text-slate-500 mt-1 font-mono">ID: {loc.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 flex-wrap">
                      {(loc.brands || []).map(b => <BrandLogo key={b} brandId={b} size={20} />)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">Mese: {loc.tables || 0}</span>
                      <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">Kiosk-uri: {(loc.kiosks || []).length}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => toggleActive(loc)} 
                      title={loc.active ? 'Acum e LIVE (Apasă pentru dezactivare)' : 'Inactiv (Apasă pentru activare)'}
                    >
                       <div className={`w-3 h-3 rounded-full ${loc.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button 
                        title="Configurare locație"
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-500/20 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 flex items-center justify-center transition-colors"
                        onClick={() => setEditingLoc(loc)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                      <button 
                        title="Șterge definitiv locația"
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-100 dark:bg-slate-800 dark:hover:bg-red-500/20 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 flex items-center justify-center transition-colors"
                        onClick={() => deleteLoc(loc.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-10 text-center text-slate-500 dark:text-slate-400 font-medium">Nu există locații care să corespundă filtrelor.</div>}
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rânduri:</span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-xs font-medium text-slate-500 ml-2">
              {sorted.length === 0 ? '0' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(sorted.length, currentPage * itemsPerPage)}`} din {sorted.length}
            </span>
          </div>
          <div className="flex gap-1">
            {[
              { label: '«', action: () => setCurrentPage(1),           disabled: currentPage === 1,          title: 'Prima pagină' },
              { label: '‹', action: () => setCurrentPage(p => p - 1), disabled: currentPage === 1,          title: 'Anterioară' },
              { label: '›', action: () => setCurrentPage(p => p + 1), disabled: currentPage === totalPages, title: 'Următoarea' },
              { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages, title: 'Ultima pagină' },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} disabled={btn.disabled} title={btn.title}
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors ${btn.disabled ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
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
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <button onClick={onBack}
          className="px-4 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 shrink-0 shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg>
          Înapoi
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white m-0 tracking-tight">
            {loc.name}
          </h2>
          <p className="text-sm text-slate-500 mt-1">Editare locație</p>
        </div>
        <button onClick={saveLoc}
          className="px-6 h-11 rounded-xl bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all shrink-0"
        >
          Salvează Modificările
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Nume & Mese */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Informații Generale</h3>
          
          <div className="space-y-5">
            <div>
               <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Nume Locație</label>
               <input type="text" className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all" value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="Ex: SM Bacău" />
            </div>
            <div>
               <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Număr de Mese (Kiosk/QR)</label>
               <input type="number" className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all" value={formData.tables} onChange={e => handleChange('tables', parseInt(e.target.value)||0)} min="0" />
            </div>
          </div>
        </div>

        {/* Card: Branduri Asignate */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Restaurante Active</h3>
          
          <div className="flex flex-wrap gap-3">
            {Object.entries({smashme:'SmashMe', crunch:'Crunch', rollmaster:'Roll Master', lovesushi:'Love Sushi', pokiwoki:'Poki-Woki'}).map(([k, v]) => {
              const isActive = formData.brands.includes(k);
              const pillColor = (BRAND_COLORS && BRAND_COLORS[k]) ? BRAND_COLORS[k] : '#64748b';
              return (
                <button
                  key={k}
                  className={`px-4 h-11 rounded-xl flex items-center gap-3 font-bold text-sm transition-all border-2 ${isActive ? 'text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-80 grayscale hover:grayscale-0 hover:opacity-100'}`}
                  style={isActive ? { background: pillColor, borderColor: pillColor, boxShadow: `0 4px 12px ${pillColor}40` } : {}}
                  onClick={() => toggleBrand(k)}
                >
                  <BrandLogo brandId={k} size={18} /> {v}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card: Syrve API Keys */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 md:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Setări Syrve (iiko) per locație</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-3xl">Dacă un brand folosește un <code>Organization ID</code> diferit față de cel global (din .env), pune-l aici pentru a trimite comenzile corect la POS-ul locației corespunzătoare.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             {formData.brands.map(bId => (
               <div key={bId} className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                   <BrandLogo brandId={bId} size={14} /> Org ID ({bId})
                 </label>
                 <input type="text" className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all font-mono" value={formData.orgIds[bId] || ''} onChange={e => handleOrgChange(bId, e.target.value)} placeholder="ID global implicit" />
               </div>
             ))}
             {formData.brands.length === 0 && <span className="text-sm text-amber-600 dark:text-amber-400 font-medium p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20 col-span-full">⚠️ Selectează măcar un brand pentru a seta suprascrieri de locație Syrve.</span>}
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
    smashme: '#ef4444', crunch: '#eab308', rollmaster: '#3b82f6', lovesushi: '#ec4899', pokiwoki: '#f97316',
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
