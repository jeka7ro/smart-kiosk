import.meta.env.VITE_BACKEND_URL import { useState, useEffect, useCallback, useRef } from 'react';
import.meta.env.VITE_BACKEND_URL import { QRCodeCanvas } from 'qrcode.react';
import.meta.env.VITE_BACKEND_URL import { io } from 'socket.io-client';
import.meta.env.VITE_BACKEND_URL import './App.css';
import.meta.env.VITE_BACKEND_URL import { useAuth } from './context/AuthProvider';
import.meta.env.VITE_BACKEND_URL import LoginScreen from './screens/LoginScreen';
import.meta.env.VITE_BACKEND_URL import UsersManager from './screens/UsersManager';
import.meta.env.VITE_BACKEND_URL import ModifierImages from './screens/ModifierImages';
import.meta.env.VITE_BACKEND_URL import TranslationsScreen from './screens/TranslationsScreen';
import.meta.env.VITE_BACKEND_URL import Integrations   from './screens/Integrations';
import.meta.env.VITE_BACKEND_URL import Promotions     from './screens/Promotions';
import.meta.env.VITE_BACKEND_URL import FortuneWheelPreview from './components/FortuneWheelPreview';
import.meta.env.VITE_BACKEND_URL import MenuManager, { MenuProfileEditorModal } from './screens/MenuManager';
import.meta.env.VITE_BACKEND_URL import QrGenerator from './screens/QrGenerator';
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL // ─── Keep-alive: prevent Render.com free tier from sleeping ───────────────────
import.meta.env.VITE_BACKEND_URL function useKeepAlive() {
import.meta.env.VITE_BACKEND_URL   useEffect(() => {
import.meta.env.VITE_BACKEND_URL     const ping = () => fetch(`${BACKEND}/api/health`, { method: 'GET' }).catch(() => {});
import.meta.env.VITE_BACKEND_URL     ping(); // immediate ping on load
import.meta.env.VITE_BACKEND_URL     const id = setInterval(ping, 4 * 60 * 1000); // every 4 minutes
import.meta.env.VITE_BACKEND_URL     return () => clearInterval(id);
import.meta.env.VITE_BACKEND_URL   }, []);
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL const BRAND_COLORS = { smashme: '#ef4444', sushimaster: '#3b82f6' };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL function BrandLogo({ brandId, size = 18 }) {
import.meta.env.VITE_BACKEND_URL   const logos = {
import.meta.env.VITE_BACKEND_URL     smashme: '/brands/smashme-logo.png',
import.meta.env.VITE_BACKEND_URL     sushimaster: '/brands/sushimaster-logo.png',
import.meta.env.VITE_BACKEND_URL     welovesushi: '/brands/welovesushi-logo.png',
import.meta.env.VITE_BACKEND_URL     ikura: '/brands/ikura-logo.png'
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL   const src = logos[brandId];
import.meta.env.VITE_BACKEND_URL   if (src) return <img src={src} alt={brandId} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }} />;
import.meta.env.VITE_BACKEND_URL   return <span style={{ fontSize: size * 0.8, fontWeight: 700, opacity: 0.6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{brandId}</span>;
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL const STATUS_LABELS = {
import.meta.env.VITE_BACKEND_URL   pending:   { label: 'Nou',       color: '#f59e0b' },
import.meta.env.VITE_BACKEND_URL   preparing: { label: 'Pregătire', color: '#3b82f6' },
import.meta.env.VITE_BACKEND_URL   ready:     { label: 'Gata',      color: '#10b981' },
import.meta.env.VITE_BACKEND_URL   delivered: { label: 'Livrat',    color: '#8b5cf6' },
import.meta.env.VITE_BACKEND_URL };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL export default function AdminApp() {
import.meta.env.VITE_BACKEND_URL   const { token, user, fetchWithAuth, logout } = useAuth();
import.meta.env.VITE_BACKEND_URL   
import.meta.env.VITE_BACKEND_URL   const [tab, setTabState] = useState(() => {
import.meta.env.VITE_BACKEND_URL     const hash = window.location.hash.replace('#', '');
import.meta.env.VITE_BACKEND_URL     const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'modifiers', 'users', 'integrations', 'promotions', 'brands', 'translations'];
import.meta.env.VITE_BACKEND_URL     return validTabs.includes(hash) ? hash : 'orders';
import.meta.env.VITE_BACKEND_URL   });
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const setTab = (newTab) => {
import.meta.env.VITE_BACKEND_URL     window.location.hash = newTab;
import.meta.env.VITE_BACKEND_URL     setTabState(newTab);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   useEffect(() => {
import.meta.env.VITE_BACKEND_URL     const handleHashChange = () => {
import.meta.env.VITE_BACKEND_URL       const hash = window.location.hash.replace('#', '');
import.meta.env.VITE_BACKEND_URL       const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'modifiers', 'users', 'integrations', 'promotions', 'brands', 'translations'];
import.meta.env.VITE_BACKEND_URL       if (validTabs.includes(hash)) setTabState(hash);
import.meta.env.VITE_BACKEND_URL     };
import.meta.env.VITE_BACKEND_URL     window.addEventListener('hashchange', handleHashChange);
import.meta.env.VITE_BACKEND_URL     return () => window.removeEventListener('hashchange', handleHashChange);
import.meta.env.VITE_BACKEND_URL   }, []);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const [orders,    setOrders]    = useState([]);
import.meta.env.VITE_BACKEND_URL   const [menuStatus,setMenuStatus]= useState(null);
import.meta.env.VITE_BACKEND_URL   const [connected, setConnected] = useState(false);
import.meta.env.VITE_BACKEND_URL   const [brandFilter, setBrandFilter] = useState('all');
import.meta.env.VITE_BACKEND_URL   const [notifications, setNotifs]= useState([]);
import.meta.env.VITE_BACKEND_URL   const [theme, setTheme] = useState(() => {
import.meta.env.VITE_BACKEND_URL     return localStorage.getItem('admin-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
import.meta.env.VITE_BACKEND_URL   });
import.meta.env.VITE_BACKEND_URL   const socketRef = useRef(null);
import.meta.env.VITE_BACKEND_URL   useKeepAlive(); // prevent Render backend from sleeping
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   /* ─── Theme Sync ─────────────────────────────────── */
import.meta.env.VITE_BACKEND_URL   useEffect(() => {
import.meta.env.VITE_BACKEND_URL     document.body.setAttribute('data-theme', theme);
import.meta.env.VITE_BACKEND_URL     localStorage.setItem('admin-theme', theme);
import.meta.env.VITE_BACKEND_URL   }, [theme]);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   /* ─── Socket.IO ─────────────────────────────────── */
import.meta.env.VITE_BACKEND_URL   useEffect(() => {
import.meta.env.VITE_BACKEND_URL     const socket = io(BACKEND, { 
import.meta.env.VITE_BACKEND_URL       reconnectionAttempts: 10,
import.meta.env.VITE_BACKEND_URL       transports: ['websocket'] // Force WebSocket to avoid polling issues
import.meta.env.VITE_BACKEND_URL     });
import.meta.env.VITE_BACKEND_URL     socketRef.current = socket;
import.meta.env.VITE_BACKEND_URL     socket.on('connect', () => {
import.meta.env.VITE_BACKEND_URL       console.log('Socket connected:', socket.id);
import.meta.env.VITE_BACKEND_URL       setConnected(true);
import.meta.env.VITE_BACKEND_URL       socket.emit('join', { role: 'admin' });
import.meta.env.VITE_BACKEND_URL     });
import.meta.env.VITE_BACKEND_URL     socket.on('connect_error', (err) => {
import.meta.env.VITE_BACKEND_URL       console.error('Socket connection error:', err.message);
import.meta.env.VITE_BACKEND_URL     });
import.meta.env.VITE_BACKEND_URL     socket.on('disconnect', () => {
import.meta.env.VITE_BACKEND_URL       console.log('Socket disconnected');
import.meta.env.VITE_BACKEND_URL       setConnected(false);
import.meta.env.VITE_BACKEND_URL     });
import.meta.env.VITE_BACKEND_URL     socket.on('new_order', order => {
import.meta.env.VITE_BACKEND_URL       setOrders(prev => [order, ...prev]);
import.meta.env.VITE_BACKEND_URL       addNotif(`Comandă nouă #${order.orderNumber} — ${order.brand} — ${(order.totalAmount||0).toFixed(0)} lei`);
import.meta.env.VITE_BACKEND_URL     });
import.meta.env.VITE_BACKEND_URL     socket.on('order_status_updated', ({ orderId, status }) => {
import.meta.env.VITE_BACKEND_URL       setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status } : o));
import.meta.env.VITE_BACKEND_URL     });
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL     return () => socket.disconnect();
import.meta.env.VITE_BACKEND_URL   }, []);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   /* ─── Load promotions configs for UI Previews ───── */
import.meta.env.VITE_BACKEND_URL   // promosData moved to KioskSettingsForm
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   /* ─── Load initial orders + poll every 30s ──────── */
import.meta.env.VITE_BACKEND_URL   useEffect(() => {
import.meta.env.VITE_BACKEND_URL     const loadOrders = () => {
import.meta.env.VITE_BACKEND_URL       fetchWithAuth(`${BACKEND}/api/orders?limit=100`)
import.meta.env.VITE_BACKEND_URL         .then(r => r.json())
import.meta.env.VITE_BACKEND_URL         .then(d => setOrders(d.orders || []))
import.meta.env.VITE_BACKEND_URL         .catch(() => {});
import.meta.env.VITE_BACKEND_URL     };
import.meta.env.VITE_BACKEND_URL     loadOrders();
import.meta.env.VITE_BACKEND_URL     const interval = setInterval(loadOrders, 30_000);
import.meta.env.VITE_BACKEND_URL     return () => clearInterval(interval);
import.meta.env.VITE_BACKEND_URL   }, []);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   /* ─── Load menu status ───────────────────────────── */
import.meta.env.VITE_BACKEND_URL   const fetchMenuStatus = useCallback(() => {
import.meta.env.VITE_BACKEND_URL     fetchWithAuth(`${BACKEND}/api/menu/status`)
import.meta.env.VITE_BACKEND_URL       .then(r => r.json())
import.meta.env.VITE_BACKEND_URL       .then(d => setMenuStatus(d))
import.meta.env.VITE_BACKEND_URL       .catch(() => {});
import.meta.env.VITE_BACKEND_URL   }, []);
import.meta.env.VITE_BACKEND_URL   useEffect(() => { if (tab === 'menu') fetchMenuStatus(); }, [tab, fetchMenuStatus]);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const addNotif = (msg) => {
import.meta.env.VITE_BACKEND_URL     const id = Date.now();
import.meta.env.VITE_BACKEND_URL     setNotifs(prev => [{ id, msg }, ...prev.slice(0, 4)]);
import.meta.env.VITE_BACKEND_URL     setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== id)), 6000);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   /* ─── Stats ──────────────────────────────────────── */
import.meta.env.VITE_BACKEND_URL   const stats = {
import.meta.env.VITE_BACKEND_URL     total:     orders.length,
import.meta.env.VITE_BACKEND_URL     pending:   orders.filter(o => o.status === 'pending').length,
import.meta.env.VITE_BACKEND_URL     preparing: orders.filter(o => o.status === 'preparing').length,
import.meta.env.VITE_BACKEND_URL     ready:     orders.filter(o => o.status === 'ready').length,
import.meta.env.VITE_BACKEND_URL     revenue:   orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
import.meta.env.VITE_BACKEND_URL     smashme:   orders.filter(o => o.brand === 'smashme').length,
import.meta.env.VITE_BACKEND_URL     sushimaster: orders.filter(o => o.brand === 'sushimaster').length,
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const filteredOrders = brandFilter === 'all'
import.meta.env.VITE_BACKEND_URL     ? orders
import.meta.env.VITE_BACKEND_URL     : orders.filter(o => o.brand === brandFilter);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   if (!token) return <LoginScreen />;
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <div className="admin-app">
import.meta.env.VITE_BACKEND_URL       {/* ─── Sidebar ─── */}
import.meta.env.VITE_BACKEND_URL       <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
import.meta.env.VITE_BACKEND_URL         <div className="admin-logo" style={{justifyContent: 'space-between', alignItems: 'center'}}>
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', alignItems: 'center' }}>
import.meta.env.VITE_BACKEND_URL             <img src="/logo_getapp.png" alt="GetApp Smart Kiosk" style={{ height: '52px', objectFit: 'contain' }} />
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL           <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)}>×</button>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL         <nav className="admin-nav">
import.meta.env.VITE_BACKEND_URL           {[
import.meta.env.VITE_BACKEND_URL             { id: 'dashboard', label: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> },
import.meta.env.VITE_BACKEND_URL             { id: 'orders',    label: 'Comenzi', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
import.meta.env.VITE_BACKEND_URL             { id: 'locations', label: 'Locații', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> },
import.meta.env.VITE_BACKEND_URL             { id: 'kiosks',    label: 'Kioskuri', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> },
import.meta.env.VITE_BACKEND_URL             { id: 'qrcodes',   label: 'QR Coduri', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg> },
import.meta.env.VITE_BACKEND_URL             { id: 'menu',      label: 'Meniu / Syrve', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg> },
import.meta.env.VITE_BACKEND_URL             { id: 'translations', label: 'Traduceri Automate', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l6 6"></path><path d="M4 14l6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg> },
import.meta.env.VITE_BACKEND_URL             { id: 'modifiers', label: 'Imagini Opțiuni', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> },
import.meta.env.VITE_BACKEND_URL             ...(user?.role === 'admin' ? [{ id: 'users', label: 'Echipă', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> }] : []),
import.meta.env.VITE_BACKEND_URL             ...(user?.role === 'admin' ? [{ id: 'integrations', label: 'Integrări POS', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg> }] : []),
import.meta.env.VITE_BACKEND_URL             ...(user?.role === 'admin' ? [{ id: 'promotions', label: 'Promoții ', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2L12 22"></path><path d="M2 12L22 12"></path><path d="M5 5l14 14"></path><path d="M19 5L5 19"></path></svg> }] : []),
import.meta.env.VITE_BACKEND_URL             ...(user?.role === 'admin' ? [{ id: 'brands', label: 'Branduri', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> }] : []),
import.meta.env.VITE_BACKEND_URL           ].map(item => (
import.meta.env.VITE_BACKEND_URL             <button
import.meta.env.VITE_BACKEND_URL               key={item.id}
import.meta.env.VITE_BACKEND_URL               className={`anav-btn ${tab === item.id ? 'active' : ''}`}
import.meta.env.VITE_BACKEND_URL               onClick={() => { setTab(item.id); setIsSidebarOpen(false); }}
import.meta.env.VITE_BACKEND_URL               style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
import.meta.env.VITE_BACKEND_URL             >
import.meta.env.VITE_BACKEND_URL               <span style={{ display: 'flex', opacity: tab === item.id ? 1 : 0.5 }}>{item.icon}</span>
import.meta.env.VITE_BACKEND_URL               <span style={{ fontWeight: tab === item.id ? 600 : 400 }}>{item.label}</span>
import.meta.env.VITE_BACKEND_URL             </button>
import.meta.env.VITE_BACKEND_URL           ))}
import.meta.env.VITE_BACKEND_URL         </nav>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         <div className={`admin-conn ${connected ? 'conn--ok' : 'conn--off'}`}>
import.meta.env.VITE_BACKEND_URL           <span className="conn-dot" />
import.meta.env.VITE_BACKEND_URL           {connected ? 'Live' : 'Offline'}
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       </aside>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       {/* ─── Main ─── */}
import.meta.env.VITE_BACKEND_URL       <main className="admin-main">
import.meta.env.VITE_BACKEND_URL         {/* Bara Navigare Mobile (Invizibila pe Desktop) */}
import.meta.env.VITE_BACKEND_URL         <div className="mobile-top-bar">
import.meta.env.VITE_BACKEND_URL           <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Smart Kiosk</span>
import.meta.env.VITE_BACKEND_URL           <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
import.meta.env.VITE_BACKEND_URL             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
import.meta.env.VITE_BACKEND_URL           </button>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* TOP HEADER BAR */}
import.meta.env.VITE_BACKEND_URL         <div className="main-header-bar" style={{ padding: '0 28px', height: '80px', boxSizing: 'border-box', borderBottom: '2px solid #0f766e', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
import.meta.env.VITE_BACKEND_URL            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
import.meta.env.VITE_BACKEND_URL               <button 
import.meta.env.VITE_BACKEND_URL                 title={theme === 'dark' ? 'Mod Luminos' : 'Mod Întunecat'}
import.meta.env.VITE_BACKEND_URL                 onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
import.meta.env.VITE_BACKEND_URL                 style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
import.meta.env.VITE_BACKEND_URL               >
import.meta.env.VITE_BACKEND_URL                 {theme === 'dark' ? (
import.meta.env.VITE_BACKEND_URL                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
import.meta.env.VITE_BACKEND_URL                     <circle cx="12" cy="12" r="5"></circle>
import.meta.env.VITE_BACKEND_URL                     <line x1="12" y1="1" x2="12" y2="3"></line>
import.meta.env.VITE_BACKEND_URL                     <line x1="12" y1="21" x2="12" y2="23"></line>
import.meta.env.VITE_BACKEND_URL                     <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
import.meta.env.VITE_BACKEND_URL                     <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
import.meta.env.VITE_BACKEND_URL                     <line x1="1" y1="12" x2="3" y2="12"></line>
import.meta.env.VITE_BACKEND_URL                     <line x1="21" y1="12" x2="23" y2="12"></line>
import.meta.env.VITE_BACKEND_URL                     <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
import.meta.env.VITE_BACKEND_URL                     <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
import.meta.env.VITE_BACKEND_URL                   </svg>
import.meta.env.VITE_BACKEND_URL                 ) : (
import.meta.env.VITE_BACKEND_URL                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
import.meta.env.VITE_BACKEND_URL                     <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
import.meta.env.VITE_BACKEND_URL                   </svg>
import.meta.env.VITE_BACKEND_URL                 )}
import.meta.env.VITE_BACKEND_URL               </button>
import.meta.env.VITE_BACKEND_URL               
import.meta.env.VITE_BACKEND_URL               <button 
import.meta.env.VITE_BACKEND_URL                 title="Deconectare"
import.meta.env.VITE_BACKEND_URL                 onClick={logout} 
import.meta.env.VITE_BACKEND_URL                 className="btn-business-icon"
import.meta.env.VITE_BACKEND_URL                 style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#ef4444', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
import.meta.env.VITE_BACKEND_URL               >
import.meta.env.VITE_BACKEND_URL                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
import.meta.env.VITE_BACKEND_URL               </button>
import.meta.env.VITE_BACKEND_URL            </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* PAGE TITLE (Moved from Header to Page Content) */}
import.meta.env.VITE_BACKEND_URL         <div style={{ padding: '32px 40px 0 40px', flexShrink: 0 }}>
import.meta.env.VITE_BACKEND_URL            <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: '-0.5px' }}>
import.meta.env.VITE_BACKEND_URL               {tab === 'dashboard' && 'Dashboard Overview'}
import.meta.env.VITE_BACKEND_URL               {tab === 'orders' && 'Gestionare Comenzi'}
import.meta.env.VITE_BACKEND_URL               {tab === 'locations' && 'Locațiile Noastre'}
import.meta.env.VITE_BACKEND_URL               {tab === 'kiosks' && 'Kioskuri'}
import.meta.env.VITE_BACKEND_URL               {tab === 'qrcodes' && 'Coduri QR'}
import.meta.env.VITE_BACKEND_URL               {tab === 'menu' && 'Sincronizare Syrve'}
import.meta.env.VITE_BACKEND_URL               {tab === 'translations' && 'Traduceri Meniu'}
import.meta.env.VITE_BACKEND_URL               {tab === 'modifiers' && 'Imagini Modificatori Opțiuni'}
import.meta.env.VITE_BACKEND_URL               {tab === 'integrations' && 'Integrări POS'}
import.meta.env.VITE_BACKEND_URL               {tab === 'users' && 'Echipă'}
import.meta.env.VITE_BACKEND_URL               {tab === 'promotions' && 'Roata Norocului'}
import.meta.env.VITE_BACKEND_URL               {tab === 'brands' && 'Branduri'}
import.meta.env.VITE_BACKEND_URL            </h2>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Notifications */}
import.meta.env.VITE_BACKEND_URL         <div className="notif-stack">
import.meta.env.VITE_BACKEND_URL           {notifications.map(n => (
import.meta.env.VITE_BACKEND_URL             <div key={n.id} className="notif">{n.msg}</div>
import.meta.env.VITE_BACKEND_URL           ))}
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* ─── DASHBOARD ─── */}
import.meta.env.VITE_BACKEND_URL         {tab === 'dashboard' && (
import.meta.env.VITE_BACKEND_URL           <div className="admin-section">
import.meta.env.VITE_BACKEND_URL             <div className="stat-grid">
import.meta.env.VITE_BACKEND_URL               <StatCard label="Total comenzi" value={stats.total} color="var(--primary)" />
import.meta.env.VITE_BACKEND_URL               <StatCard label="Noi / Așteptare" value={stats.pending}   color="var(--warning)" />
import.meta.env.VITE_BACKEND_URL               <StatCard label="În pregătire"   value={stats.preparing} color="var(--cyan)" />
import.meta.env.VITE_BACKEND_URL               <StatCard label="Gata ridicare"  value={stats.ready}     color="var(--success)" />
import.meta.env.VITE_BACKEND_URL               <StatCard label="Venituri"        value={`${stats.revenue.toFixed(0)} lei`} color="var(--success)" large />
import.meta.env.VITE_BACKEND_URL               <StatCard label="SmashMe"   value={stats.smashme} color={BRAND_COLORS.smashme} />
import.meta.env.VITE_BACKEND_URL               <StatCard label="SushiMaster" value={stats.sushimaster} color={BRAND_COLORS.sushimaster} />
import.meta.env.VITE_BACKEND_URL             </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL             <h3 className="sub-title">Ultimele 10 comenzi</h3>
import.meta.env.VITE_BACKEND_URL             <OrdersTable orders={orders.slice(0, 10)} />
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* ─── ORDERS ─── */}
import.meta.env.VITE_BACKEND_URL         {tab === 'orders' && (
import.meta.env.VITE_BACKEND_URL           <div className="admin-section">
import.meta.env.VITE_BACKEND_URL             <div className="section-header">
import.meta.env.VITE_BACKEND_URL               <div className="brand-tabs">
import.meta.env.VITE_BACKEND_URL                 {['all','smashme','sushimaster'].map(b => (
import.meta.env.VITE_BACKEND_URL                   <button
import.meta.env.VITE_BACKEND_URL                     key={b}
import.meta.env.VITE_BACKEND_URL                     className={`brand-tab ${brandFilter === b ? 'active' : ''}`}
import.meta.env.VITE_BACKEND_URL                     style={{ ...(b !== 'all' ? { '--bc': BRAND_COLORS[b] } : {}), display: 'flex', alignItems: 'center', gap: '6px' }}
import.meta.env.VITE_BACKEND_URL                     onClick={() => setBrandFilter(b)}
import.meta.env.VITE_BACKEND_URL                   >
import.meta.env.VITE_BACKEND_URL                     {b === 'all' ? 'Toate' : <><BrandLogo brandId={b} size={14} /> {b === 'smashme' ? 'SmashMe' : 'SushiMaster'}</>}
import.meta.env.VITE_BACKEND_URL                   </button>
import.meta.env.VITE_BACKEND_URL                 ))}
import.meta.env.VITE_BACKEND_URL               </div>
import.meta.env.VITE_BACKEND_URL             </div>
import.meta.env.VITE_BACKEND_URL             <OrdersTable orders={filteredOrders} full />
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* ─── MENU ─── */}
import.meta.env.VITE_BACKEND_URL         {tab === 'menu' && (
import.meta.env.VITE_BACKEND_URL           <MenuManager backend={BACKEND} />
import.meta.env.VITE_BACKEND_URL         )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* ─── LOCATIONS ─── */}
import.meta.env.VITE_BACKEND_URL         {tab === 'locations' && (
import.meta.env.VITE_BACKEND_URL           <div className="admin-section">
import.meta.env.VITE_BACKEND_URL             <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Gestioneaza locatiile si kioskurile alocate. Locatiile cu mai multe branduri permit comenzi mixte.</p>
import.meta.env.VITE_BACKEND_URL             <LocationsManager backend={BACKEND} />
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* ─── KIOSKS / SCREENSAVER ─── */}
import.meta.env.VITE_BACKEND_URL         {tab === 'kiosks' && (
import.meta.env.VITE_BACKEND_URL           <div className="admin-section">
import.meta.env.VITE_BACKEND_URL             <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Copiază link-ul necesar pentru tabletă sau setează screensaver-ul (imagine/video completă care rulează înainte de comandă).</p>
import.meta.env.VITE_BACKEND_URL             <KiosksManager backend={BACKEND} />
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* ─── QR CODE GENERATOR ─── */}
import.meta.env.VITE_BACKEND_URL         {tab === 'qrcodes' && (
import.meta.env.VITE_BACKEND_URL           <div className="admin-section">
import.meta.env.VITE_BACKEND_URL             <p style={{color:'var(--text-muted)',marginBottom:16,fontSize:'0.9rem'}}>Generează coduri QR pentru mese. Clienții scanează QR-ul și comandă direct de pe telefon.</p>
import.meta.env.VITE_BACKEND_URL             <QrGenerator backend={BACKEND} />
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         )}
import.meta.env.VITE_BACKEND_URL         {/* ─── USERS MANAGER ─── */}
import.meta.env.VITE_BACKEND_URL         {tab === 'translations' && <div className="admin-section"><TranslationsScreen backend={BACKEND} /></div>}
import.meta.env.VITE_BACKEND_URL         {tab === 'modifiers' && <ModifierImages />}
import.meta.env.VITE_BACKEND_URL         {tab === 'integrations' && <Integrations />}
import.meta.env.VITE_BACKEND_URL         {tab === 'promotions' && <Promotions />}
import.meta.env.VITE_BACKEND_URL         {tab === 'users' && <UsersManager />}
import.meta.env.VITE_BACKEND_URL         {tab === 'brands' && <BrandsManager backend={BACKEND} />}
import.meta.env.VITE_BACKEND_URL       </main>
import.meta.env.VITE_BACKEND_URL     </div>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL function StatCard({ label, value, color, large }) {
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <div className={`stat-card ${large ? 'stat-card--large' : ''}`} style={{ '--sc': color }}>
import.meta.env.VITE_BACKEND_URL       <span className="sc-value">{value}</span>
import.meta.env.VITE_BACKEND_URL       <span className="sc-label" style={{ opacity: 0.7, fontSize: '0.9rem' }}>{label}</span>
import.meta.env.VITE_BACKEND_URL     </div>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL function OrdersTable({ orders, full }) {
import.meta.env.VITE_BACKEND_URL   if (!orders || orders.length === 0)
import.meta.env.VITE_BACKEND_URL     return <p className="empty-text">Nicio comandă</p>;
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <div className="orders-table-wrap">
import.meta.env.VITE_BACKEND_URL       <table className="orders-table">
import.meta.env.VITE_BACKEND_URL         <thead>
import.meta.env.VITE_BACKEND_URL           <tr>
import.meta.env.VITE_BACKEND_URL             <th>#</th>
import.meta.env.VITE_BACKEND_URL             <th>Brand</th>
import.meta.env.VITE_BACKEND_URL             <th>Canal</th>
import.meta.env.VITE_BACKEND_URL             <th>Tip</th>
import.meta.env.VITE_BACKEND_URL             <th>Produse</th>
import.meta.env.VITE_BACKEND_URL             <th>Total</th>
import.meta.env.VITE_BACKEND_URL             <th>Status</th>
import.meta.env.VITE_BACKEND_URL             <th>Ora</th>
import.meta.env.VITE_BACKEND_URL           </tr>
import.meta.env.VITE_BACKEND_URL         </thead>
import.meta.env.VITE_BACKEND_URL         <tbody>
import.meta.env.VITE_BACKEND_URL           {orders.map(o => {
import.meta.env.VITE_BACKEND_URL             const sc = STATUS_LABELS[o.status] || { label: o.status, color: '#6b7a99' };
import.meta.env.VITE_BACKEND_URL             return (
import.meta.env.VITE_BACKEND_URL               <tr key={o._id}>
import.meta.env.VITE_BACKEND_URL                 <td><strong>#{o.orderNumber}</strong></td>
import.meta.env.VITE_BACKEND_URL                 <td>
import.meta.env.VITE_BACKEND_URL                   <span style={{ color: BRAND_COLORS[o.brand], display: 'flex', alignItems: 'center', gap: '6px' }}>
import.meta.env.VITE_BACKEND_URL                     <BrandLogo brandId={o.brand} size={16} /> {o.brand}
import.meta.env.VITE_BACKEND_URL                   </span>
import.meta.env.VITE_BACKEND_URL                 </td>
import.meta.env.VITE_BACKEND_URL                 <td><span className="tag">{o.channel}</span></td>
import.meta.env.VITE_BACKEND_URL                 <td>{o.orderType === 'dine-in' ? `Masa ${o.tableNumber}` : 'Caserie'}</td>
import.meta.env.VITE_BACKEND_URL                 <td>{(o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ').slice(0, 40)}...</td>
import.meta.env.VITE_BACKEND_URL                 <td><strong>{(o.totalAmount || 0).toFixed(0)} lei</strong></td>
import.meta.env.VITE_BACKEND_URL                 <td><span className="status-pill" style={{ background: sc.color + '22', color: sc.color }}>● {sc.label}</span></td>
import.meta.env.VITE_BACKEND_URL                 <td className="time-col">{o.createdAt ? new Date(o.createdAt).toLocaleTimeString('ro-RO') : '—'}</td>
import.meta.env.VITE_BACKEND_URL               </tr>
import.meta.env.VITE_BACKEND_URL             );
import.meta.env.VITE_BACKEND_URL           })}
import.meta.env.VITE_BACKEND_URL         </tbody>
import.meta.env.VITE_BACKEND_URL       </table>
import.meta.env.VITE_BACKEND_URL     </div>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL function KioskPosterCard({ brandId, brandName, emoji, backend }) { 
import.meta.env.VITE_BACKEND_URL   const { fetchWithAuth } = useAuth();
import.meta.env.VITE_BACKEND_URL   const [url, setUrl]         = useState('');
import.meta.env.VITE_BACKEND_URL   const [type, setType]       = useState('image');
import.meta.env.VITE_BACKEND_URL   const [enabled, setEnabled] = useState(false);
import.meta.env.VITE_BACKEND_URL   const [saved, setSaved]     = useState(false);
import.meta.env.VITE_BACKEND_URL   const [loading, setLoading] = useState(true);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   // Load existing config
import.meta.env.VITE_BACKEND_URL   useEffect(() => {
import.meta.env.VITE_BACKEND_URL     fetchWithAuth(`${backend}/api/admin/kiosk-config/${brandId}`)
import.meta.env.VITE_BACKEND_URL       .then(r => r.json())
import.meta.env.VITE_BACKEND_URL       .then(d => {
import.meta.env.VITE_BACKEND_URL         if (d.poster) {
import.meta.env.VITE_BACKEND_URL           setUrl(d.poster.url || '');
import.meta.env.VITE_BACKEND_URL           setType(d.poster.type || 'image');
import.meta.env.VITE_BACKEND_URL           setEnabled(d.poster.enabled !== false);
import.meta.env.VITE_BACKEND_URL         }
import.meta.env.VITE_BACKEND_URL         setLoading(false);
import.meta.env.VITE_BACKEND_URL       })
import.meta.env.VITE_BACKEND_URL       .catch(() => setLoading(false));
import.meta.env.VITE_BACKEND_URL   }, [brandId, backend]);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const save = async () => {
import.meta.env.VITE_BACKEND_URL     try {
import.meta.env.VITE_BACKEND_URL       await fetchWithAuth(`${backend}/api/admin/kiosk-config/${brandId}`, {
import.meta.env.VITE_BACKEND_URL         method: 'POST',
import.meta.env.VITE_BACKEND_URL         headers: { 'Content-Type': 'application/json' },
import.meta.env.VITE_BACKEND_URL         body: JSON.stringify({ url, type, enabled }),
import.meta.env.VITE_BACKEND_URL       });
import.meta.env.VITE_BACKEND_URL       setSaved(true);
import.meta.env.VITE_BACKEND_URL       setTimeout(() => setSaved(false), 2000);
import.meta.env.VITE_BACKEND_URL     } catch (e) {
import.meta.env.VITE_BACKEND_URL       console.error('Save failed:', e);
import.meta.env.VITE_BACKEND_URL     }
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const remove = async () => {
import.meta.env.VITE_BACKEND_URL     await fetchWithAuth(`${backend}/api/admin/kiosk-config/${brandId}`, { method: 'DELETE' });
import.meta.env.VITE_BACKEND_URL     setUrl('');
import.meta.env.VITE_BACKEND_URL     setType('image');
import.meta.env.VITE_BACKEND_URL     setEnabled(false);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   if (loading) return <div className="poster-card"><p>Se încarcă...</p></div>;
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   // Auto-detect type from URL
import.meta.env.VITE_BACKEND_URL   const detectType = (u) => {
import.meta.env.VITE_BACKEND_URL     if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return 'video';
import.meta.env.VITE_BACKEND_URL     if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u)) return 'image';
import.meta.env.VITE_BACKEND_URL     if (/youtube|vimeo|dailymotion/i.test(u)) return 'iframe';
import.meta.env.VITE_BACKEND_URL     return 'image';
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const handleUrlChange = (e) => {
import.meta.env.VITE_BACKEND_URL     const newUrl = e.target.value;
import.meta.env.VITE_BACKEND_URL     setUrl(newUrl);
import.meta.env.VITE_BACKEND_URL     if (newUrl) setType(detectType(newUrl));
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <div className="poster-card" style={{ '--bc': brandId === 'smashme' ? '#ef4444' : '#3b82f6' }}>
import.meta.env.VITE_BACKEND_URL       <div className="pc-header">
import.meta.env.VITE_BACKEND_URL         <span className="pc-brand" style={{display:'flex', alignItems:'center', gap:'8px'}}><BrandLogo brandId={brandId} size={20} /> {brandName}</span>
import.meta.env.VITE_BACKEND_URL         <label className="pc-toggle">
import.meta.env.VITE_BACKEND_URL           <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
import.meta.env.VITE_BACKEND_URL           <span className="toggle-slider" />
import.meta.env.VITE_BACKEND_URL           <span>{enabled ? 'Activ' : 'Inactiv'}</span>
import.meta.env.VITE_BACKEND_URL         </label>
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       <div className="pc-form">
import.meta.env.VITE_BACKEND_URL         <label className="pc-label">Link poster (imagine, video, sau pagină web)</label>
import.meta.env.VITE_BACKEND_URL         <input
import.meta.env.VITE_BACKEND_URL           className="pc-input"
import.meta.env.VITE_BACKEND_URL           type="url"
import.meta.env.VITE_BACKEND_URL           placeholder="https://example.com/promo.jpg"
import.meta.env.VITE_BACKEND_URL           value={url}
import.meta.env.VITE_BACKEND_URL           onChange={handleUrlChange}
import.meta.env.VITE_BACKEND_URL         />
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         <div className="pc-type-row">
import.meta.env.VITE_BACKEND_URL           <label className="pc-label" style={{marginBottom: 0}}>Tip conținut:</label>
import.meta.env.VITE_BACKEND_URL           <div className="pc-type-btns">
import.meta.env.VITE_BACKEND_URL             {['image', 'video', 'iframe'].map(t => (
import.meta.env.VITE_BACKEND_URL               <button
import.meta.env.VITE_BACKEND_URL                 key={t}
import.meta.env.VITE_BACKEND_URL                 className={`pc-type-btn ${type === t ? 'active' : ''}`}
import.meta.env.VITE_BACKEND_URL                 onClick={() => setType(t)}
import.meta.env.VITE_BACKEND_URL               >
import.meta.env.VITE_BACKEND_URL                 {t === 'image' ? 'Imagine' : t === 'video' ? 'Video' : 'Pagină web'}
import.meta.env.VITE_BACKEND_URL               </button>
import.meta.env.VITE_BACKEND_URL             ))}
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       {/* Preview */}
import.meta.env.VITE_BACKEND_URL       {url && (
import.meta.env.VITE_BACKEND_URL         <div className="pc-preview">
import.meta.env.VITE_BACKEND_URL           <span className="pc-label">Preview:</span>
import.meta.env.VITE_BACKEND_URL           <div className="pc-preview-box">
import.meta.env.VITE_BACKEND_URL             {type === 'image' && <img src={url} alt="Preview" onError={e => e.target.src=''} />}
import.meta.env.VITE_BACKEND_URL             {type === 'video' && <video src={url} autoPlay muted loop />}
import.meta.env.VITE_BACKEND_URL             {type === 'iframe' && <iframe src={url} title="Preview" />}
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL       )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       <div className="pc-actions">
import.meta.env.VITE_BACKEND_URL         <button className="btn-save" onClick={save}>
import.meta.env.VITE_BACKEND_URL           {saved ? ' Salvat!' : ' Salvează'}
import.meta.env.VITE_BACKEND_URL         </button>
import.meta.env.VITE_BACKEND_URL         {url && <button className="btn-delete" onClick={remove}>🗑 Șterge</button>}
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL     </div>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL function KiosksManager({ backend }) {
import.meta.env.VITE_BACKEND_URL   const { fetchWithAuth } = useAuth();
import.meta.env.VITE_BACKEND_URL   const [locations, setLocations] = useState([]);
import.meta.env.VITE_BACKEND_URL   const [loading, setLoading] = useState(true);
import.meta.env.VITE_BACKEND_URL   const [brandFilter, setBrandFilter] = useState('all');
import.meta.env.VITE_BACKEND_URL   const [editingLoc, setEditingLoc] = useState(null);
import.meta.env.VITE_BACKEND_URL   const [restartingId, setRestartingId] = useState(null); // ID of loc currently restarting
import.meta.env.VITE_BACKEND_URL   const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const showToast = (msg, type = 'success') => {
import.meta.env.VITE_BACKEND_URL     setToast({ msg, type });
import.meta.env.VITE_BACKEND_URL     setTimeout(() => setToast(null), 4000);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL   
import.meta.env.VITE_BACKEND_URL   // Pagination
import.meta.env.VITE_BACKEND_URL   const [currentPage, setCurrentPage] = useState(1);
import.meta.env.VITE_BACKEND_URL   const [itemsPerPage, setItemsPerPage] = useState(10);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const fetchLocs = () => {
import.meta.env.VITE_BACKEND_URL     setLoading(true);
import.meta.env.VITE_BACKEND_URL     fetchWithAuth(`${backend}/api/locations`)
import.meta.env.VITE_BACKEND_URL       .then(r => r.json())
import.meta.env.VITE_BACKEND_URL       .then(d => { setLocations(d.locations || []); setLoading(false); })
import.meta.env.VITE_BACKEND_URL       .catch(() => setLoading(false));
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL   useEffect(fetchLocs, [backend]);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   if (loading) return <p className="loading-text">Se încarcă kioskurile...</p>;
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   if (editingLoc) {
import.meta.env.VITE_BACKEND_URL     return <KioskSettingsForm loc={editingLoc} backend={backend} onBack={() => setEditingLoc(null)} onSave={fetchLocs} />;
import.meta.env.VITE_BACKEND_URL   }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const brandMeta = {
import.meta.env.VITE_BACKEND_URL     smashme:     { name: 'SmashMe',       color: '#ef4444' },
import.meta.env.VITE_BACKEND_URL     sushimaster: { name: 'Sushi Master',  color: '#3b82f6' },
import.meta.env.VITE_BACKEND_URL     ikura:       { name: 'Ikura',         color: '#d4af37' },
import.meta.env.VITE_BACKEND_URL     welovesushi: { name: 'WeLoveSushi',   color: '#ec4899' },
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const allBrandIds = new Set();
import.meta.env.VITE_BACKEND_URL   locations.forEach(l => {
import.meta.env.VITE_BACKEND_URL      if (l.brands && Array.isArray(l.brands)) l.brands.forEach(b => allBrandIds.add(b));
import.meta.env.VITE_BACKEND_URL      else if (l.brandId) allBrandIds.add(l.brandId);
import.meta.env.VITE_BACKEND_URL   });
import.meta.env.VITE_BACKEND_URL   const brandIds = [...allBrandIds];
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const filtered = brandFilter === 'all' 
import.meta.env.VITE_BACKEND_URL     ? locations 
import.meta.env.VITE_BACKEND_URL     : locations.filter(l => (l.brands && l.brands.includes(brandFilter)) || l.brandId === brandFilter);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const sorted = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
import.meta.env.VITE_BACKEND_URL   const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
import.meta.env.VITE_BACKEND_URL   const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const handleFilterClick = (filter) => {
import.meta.env.VITE_BACKEND_URL     setBrandFilter(filter);
import.meta.env.VITE_BACKEND_URL     setCurrentPage(1);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <>
import.meta.env.VITE_BACKEND_URL     <div className="kiosk-location-list">
import.meta.env.VITE_BACKEND_URL       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
import.meta.env.VITE_BACKEND_URL         <div className="kl-brand-filter" style={{ marginBottom: 0 }}>
import.meta.env.VITE_BACKEND_URL           <button
import.meta.env.VITE_BACKEND_URL             className={`kl-filter-btn ${brandFilter === 'all' ? 'active' : ''}`}
import.meta.env.VITE_BACKEND_URL             onClick={() => handleFilterClick('all')}
import.meta.env.VITE_BACKEND_URL           >
import.meta.env.VITE_BACKEND_URL             Toate ({locations.length})
import.meta.env.VITE_BACKEND_URL           </button>
import.meta.env.VITE_BACKEND_URL         {brandIds.map(bid => {
import.meta.env.VITE_BACKEND_URL           const m = brandMeta[bid] || { name: bid, color: '#6b7a99' };
import.meta.env.VITE_BACKEND_URL           const count = locations.filter(l => (l.brands && l.brands.includes(bid)) || l.brandId === bid).length;
import.meta.env.VITE_BACKEND_URL           return (
import.meta.env.VITE_BACKEND_URL             <button
import.meta.env.VITE_BACKEND_URL               key={bid}
import.meta.env.VITE_BACKEND_URL               className={`kl-filter-btn ${brandFilter === bid ? 'active' : ''}`}
import.meta.env.VITE_BACKEND_URL               style={{ '--bc': m.color, display: 'flex', alignItems: 'center', gap: '6px' }}
import.meta.env.VITE_BACKEND_URL               onClick={() => handleFilterClick(bid)}
import.meta.env.VITE_BACKEND_URL             >
import.meta.env.VITE_BACKEND_URL               <BrandLogo brandId={bid} size={14} /> {m.name} ({count})
import.meta.env.VITE_BACKEND_URL             </button>
import.meta.env.VITE_BACKEND_URL           );
import.meta.env.VITE_BACKEND_URL         })}
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL         <button
import.meta.env.VITE_BACKEND_URL           title="Reîncarcă lista"
import.meta.env.VITE_BACKEND_URL           onClick={fetchLocs}
import.meta.env.VITE_BACKEND_URL           style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}
import.meta.env.VITE_BACKEND_URL         >
import.meta.env.VITE_BACKEND_URL           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
import.meta.env.VITE_BACKEND_URL           Refresh
import.meta.env.VITE_BACKEND_URL         </button>
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       {/* Tabel Business */}
import.meta.env.VITE_BACKEND_URL       <div className="loc-list-container" style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.03)', marginTop: '24px' }}>
import.meta.env.VITE_BACKEND_URL         <table className="loc-table hoverable-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
import.meta.env.VITE_BACKEND_URL           <thead style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border)' }}>
import.meta.env.VITE_BACKEND_URL             <tr>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '16px 24px', width: '50px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Denumire & ID</th>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Branduri Admise</th>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stare</th>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Acțiuni</th>
import.meta.env.VITE_BACKEND_URL             </tr>
import.meta.env.VITE_BACKEND_URL           </thead>
import.meta.env.VITE_BACKEND_URL           <tbody>
import.meta.env.VITE_BACKEND_URL             {paginated.map((loc, index) => {
import.meta.env.VITE_BACKEND_URL               const finalKioskUrl = loc.kioskUrl || `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;
import.meta.env.VITE_BACKEND_URL               const brandsArr = loc.brands || (loc.brandId ? [loc.brandId] : []);
import.meta.env.VITE_BACKEND_URL               
import.meta.env.VITE_BACKEND_URL               return (
import.meta.env.VITE_BACKEND_URL                 <tr key={loc.id} className="loc-table-row">
import.meta.env.VITE_BACKEND_URL                   <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
import.meta.env.VITE_BACKEND_URL                     {(currentPage - 1) * itemsPerPage + index + 1}
import.meta.env.VITE_BACKEND_URL                   </td>
import.meta.env.VITE_BACKEND_URL                   <td style={{ padding: '16px 24px' }}>
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
import.meta.env.VITE_BACKEND_URL                       <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>{loc.name}</span>
import.meta.env.VITE_BACKEND_URL                       <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{loc.id}</span>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   </td>
import.meta.env.VITE_BACKEND_URL                   <td style={{ padding: '16px 24px' }}>
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
import.meta.env.VITE_BACKEND_URL                       {brandsArr.map(b => (
import.meta.env.VITE_BACKEND_URL                          <BrandLogo key={b} brandId={b} size={28} />
import.meta.env.VITE_BACKEND_URL                       ))}
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   </td>
import.meta.env.VITE_BACKEND_URL                   <td style={{ padding: '16px 24px' }}>
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
import.meta.env.VITE_BACKEND_URL                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: loc.active ? '#22c55e' : '#ef4444', display: 'inline-block' }} title={loc.active ? 'Online' : 'Inactiv'} />
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   </td>
import.meta.env.VITE_BACKEND_URL                   <td style={{ padding: '16px 24px', textAlign: 'right' }}>
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
import.meta.env.VITE_BACKEND_URL                       <button 
import.meta.env.VITE_BACKEND_URL                         title="Restartare Ecrane Remote"
import.meta.env.VITE_BACKEND_URL                         className="btn-business-icon"
import.meta.env.VITE_BACKEND_URL                         style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
import.meta.env.VITE_BACKEND_URL                         onClick={async (e) => {
import.meta.env.VITE_BACKEND_URL                            e.stopPropagation();
import.meta.env.VITE_BACKEND_URL                            if (restartingId === loc.id) return; // already restarting
import.meta.env.VITE_BACKEND_URL                            setRestartingId(loc.id);
import.meta.env.VITE_BACKEND_URL                            try {
import.meta.env.VITE_BACKEND_URL                              const res = await fetchWithAuth(`${backend}/api/locations/${loc.id}/restart`, { method: 'POST' });
import.meta.env.VITE_BACKEND_URL                              const data = await res.json();
import.meta.env.VITE_BACKEND_URL                              if (res.ok) {
import.meta.env.VITE_BACKEND_URL                                showToast(`Semnal de restart trimis pentru ${loc.name}!`);
import.meta.env.VITE_BACKEND_URL                              } else {
import.meta.env.VITE_BACKEND_URL                                showToast(data.error || 'Eroare la trimiterea comenzii', 'error');
import.meta.env.VITE_BACKEND_URL                              }
import.meta.env.VITE_BACKEND_URL                            } catch {
import.meta.env.VITE_BACKEND_URL                              showToast('Conexiune eșuată. Verificați rețeaua.', 'error');
import.meta.env.VITE_BACKEND_URL                            } finally {
import.meta.env.VITE_BACKEND_URL                              setRestartingId(null);
import.meta.env.VITE_BACKEND_URL                            }
import.meta.env.VITE_BACKEND_URL                         }}
import.meta.env.VITE_BACKEND_URL                       >
import.meta.env.VITE_BACKEND_URL                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 2v6h6M21.5 22v-6h-6"/><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/></svg>
import.meta.env.VITE_BACKEND_URL                       </button>
import.meta.env.VITE_BACKEND_URL                       <a 
import.meta.env.VITE_BACKEND_URL                         title="Vizualizare Kiosk direct"
import.meta.env.VITE_BACKEND_URL                         href={finalKioskUrl} target="_blank" rel="noreferrer"
import.meta.env.VITE_BACKEND_URL                         className="btn-business-icon"
import.meta.env.VITE_BACKEND_URL                         style={{ textDecoration: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
import.meta.env.VITE_BACKEND_URL                       >
import.meta.env.VITE_BACKEND_URL                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
import.meta.env.VITE_BACKEND_URL                       </a>
import.meta.env.VITE_BACKEND_URL                       <button 
import.meta.env.VITE_BACKEND_URL                         title="Copiază Link Universal"
import.meta.env.VITE_BACKEND_URL                         className="btn-business-icon"
import.meta.env.VITE_BACKEND_URL                         style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
import.meta.env.VITE_BACKEND_URL                         onClick={(e) => {
import.meta.env.VITE_BACKEND_URL                           const btn = e.currentTarget;
import.meta.env.VITE_BACKEND_URL                           const svg = btn.querySelector('svg');
import.meta.env.VITE_BACKEND_URL                           navigator.clipboard.writeText(finalKioskUrl);
import.meta.env.VITE_BACKEND_URL                           svg.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
import.meta.env.VITE_BACKEND_URL                           setTimeout(() => {
import.meta.env.VITE_BACKEND_URL                              svg.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
import.meta.env.VITE_BACKEND_URL                           }, 2000);
import.meta.env.VITE_BACKEND_URL                         }}
import.meta.env.VITE_BACKEND_URL                       >
import.meta.env.VITE_BACKEND_URL                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
import.meta.env.VITE_BACKEND_URL                       </button>
import.meta.env.VITE_BACKEND_URL                       <button 
import.meta.env.VITE_BACKEND_URL                         title="Setări și Screensaver"
import.meta.env.VITE_BACKEND_URL                         className="btn-business-icon"
import.meta.env.VITE_BACKEND_URL                         style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
import.meta.env.VITE_BACKEND_URL                         onClick={() => setEditingLoc(loc)}
import.meta.env.VITE_BACKEND_URL                       >
import.meta.env.VITE_BACKEND_URL                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
import.meta.env.VITE_BACKEND_URL                       </button>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   </td>
import.meta.env.VITE_BACKEND_URL                 </tr>
import.meta.env.VITE_BACKEND_URL               );
import.meta.env.VITE_BACKEND_URL             })}
import.meta.env.VITE_BACKEND_URL           </tbody>
import.meta.env.VITE_BACKEND_URL         </table>
import.meta.env.VITE_BACKEND_URL         
import.meta.env.VITE_BACKEND_URL         {/* Pagination Controls */}
import.meta.env.VITE_BACKEND_URL         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
import.meta.env.VITE_BACKEND_URL             <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Rânduri pe pagină:</span>
import.meta.env.VITE_BACKEND_URL             <select
import.meta.env.VITE_BACKEND_URL               value={itemsPerPage}
import.meta.env.VITE_BACKEND_URL               onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
import.meta.env.VITE_BACKEND_URL               style={{ fontSize: '0.82rem', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}
import.meta.env.VITE_BACKEND_URL             >
import.meta.env.VITE_BACKEND_URL               {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
import.meta.env.VITE_BACKEND_URL             </select>
import.meta.env.VITE_BACKEND_URL             <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 8 }}>
import.meta.env.VITE_BACKEND_URL               {(currentPage - 1) * itemsPerPage + 1}–{Math.min(sorted.length, currentPage * itemsPerPage)} din {sorted.length}
import.meta.env.VITE_BACKEND_URL             </span>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', gap: 4 }}>
import.meta.env.VITE_BACKEND_URL             {[
import.meta.env.VITE_BACKEND_URL               { label: '«', action: () => setCurrentPage(1),            disabled: currentPage === 1,          title: 'Prima pagină' },
import.meta.env.VITE_BACKEND_URL               { label: '‹', action: () => setCurrentPage(p => p - 1),  disabled: currentPage === 1,          title: 'Anterioară' },
import.meta.env.VITE_BACKEND_URL               { label: '›', action: () => setCurrentPage(p => p + 1),  disabled: currentPage === totalPages, title: 'Următoarea' },
import.meta.env.VITE_BACKEND_URL               { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages, title: 'Ultima pagină' },
import.meta.env.VITE_BACKEND_URL             ].map(btn => (
import.meta.env.VITE_BACKEND_URL               <button key={btn.label} onClick={btn.action} disabled={btn.disabled} title={btn.title}
import.meta.env.VITE_BACKEND_URL                 style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', background: btn.disabled ? '#f1f5f9' : '#fff', color: btn.disabled ? '#cbd5e1' : '#334155', cursor: btn.disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
import.meta.env.VITE_BACKEND_URL               >{btn.label}</button>
import.meta.env.VITE_BACKEND_URL             ))}
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL     </div>
import.meta.env.VITE_BACKEND_URL     {toast && (
import.meta.env.VITE_BACKEND_URL       <div style={{
import.meta.env.VITE_BACKEND_URL         position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
import.meta.env.VITE_BACKEND_URL         background: toast.type === 'error' ? '#ef4444' : '#10b981',
import.meta.env.VITE_BACKEND_URL         color: '#fff', padding: '14px 24px', borderRadius: '14px',
import.meta.env.VITE_BACKEND_URL         fontWeight: 700, fontSize: '0.95rem',
import.meta.env.VITE_BACKEND_URL         boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
import.meta.env.VITE_BACKEND_URL         display: 'flex', alignItems: 'center', gap: 10,
import.meta.env.VITE_BACKEND_URL       }}>
import.meta.env.VITE_BACKEND_URL         <span style={{ fontSize: '1.2rem' }}>{toast.type === 'error' ? '✕' : '✓'}</span>
import.meta.env.VITE_BACKEND_URL         {toast.msg}
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL     )}
import.meta.env.VITE_BACKEND_URL     </>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL function RestartKioskBtn({ locId, backend, fetchWithAuth }) {
import.meta.env.VITE_BACKEND_URL   const [rstState, setRstState] = useState('idle');
import.meta.env.VITE_BACKEND_URL   const doRestart = async (e) => {
import.meta.env.VITE_BACKEND_URL     e.stopPropagation();
import.meta.env.VITE_BACKEND_URL     if (rstState === 'sending') return;
import.meta.env.VITE_BACKEND_URL     setRstState('sending');
import.meta.env.VITE_BACKEND_URL     try {
import.meta.env.VITE_BACKEND_URL       const res = await fetchWithAuth(`${backend}/api/locations/${locId}/restart`, { method: 'POST' });
import.meta.env.VITE_BACKEND_URL       setRstState(res.ok ? 'ok' : 'err');
import.meta.env.VITE_BACKEND_URL     } catch { setRstState('err'); }
import.meta.env.VITE_BACKEND_URL     setTimeout(() => setRstState('idle'), 3000);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL   const colors = { idle: 'var(--surface)', sending: '#f59e0b', ok: '#10b981', err: '#ef4444' };
import.meta.env.VITE_BACKEND_URL   const labels = { idle: 'Refresh Kiosk', sending: 'Se trimite...', ok: '✓ Trimis!', err: '✕ Eroare' };
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <button
import.meta.env.VITE_BACKEND_URL       onClick={doRestart}
import.meta.env.VITE_BACKEND_URL       disabled={rstState === 'sending'}
import.meta.env.VITE_BACKEND_URL       style={{
import.meta.env.VITE_BACKEND_URL         display: 'inline-flex', alignItems: 'center', gap: 7,
import.meta.env.VITE_BACKEND_URL         background: rstState === 'idle' ? 'var(--surface)' : colors[rstState],
import.meta.env.VITE_BACKEND_URL         color: rstState === 'idle' ? 'var(--text)' : '#fff',
import.meta.env.VITE_BACKEND_URL         border: `1px solid ${rstState === 'idle' ? 'var(--border)' : colors[rstState]}`,
import.meta.env.VITE_BACKEND_URL         padding: '10px 16px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700,
import.meta.env.VITE_BACKEND_URL         cursor: rstState === 'sending' ? 'default' : 'pointer',
import.meta.env.VITE_BACKEND_URL         transition: 'all 0.3s',
import.meta.env.VITE_BACKEND_URL         boxShadow: rstState !== 'idle' ? `0 4px 14px ${colors[rstState]}55` : '0 2px 6px rgba(0,0,0,0.06)',
import.meta.env.VITE_BACKEND_URL       }}
import.meta.env.VITE_BACKEND_URL     >
import.meta.env.VITE_BACKEND_URL       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
import.meta.env.VITE_BACKEND_URL         style={{ animation: rstState === 'sending' ? 'spin 0.8s linear infinite' : 'none' }}>
import.meta.env.VITE_BACKEND_URL         <path d="M2.5 2v6h6M21.5 22v-6h-6"/>
import.meta.env.VITE_BACKEND_URL         <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/>
import.meta.env.VITE_BACKEND_URL       </svg>
import.meta.env.VITE_BACKEND_URL       {labels[rstState]}
import.meta.env.VITE_BACKEND_URL     </button>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL function KioskSettingsForm({ loc, backend, onBack, onSave }) {
import.meta.env.VITE_BACKEND_URL   const { fetchWithAuth } = useAuth();
import.meta.env.VITE_BACKEND_URL   const [formData, setFormData] = useState({
import.meta.env.VITE_BACKEND_URL     kioskUrl: loc.kioskUrl || '',
import.meta.env.VITE_BACKEND_URL     posterUrl: loc.posterUrl || '',
import.meta.env.VITE_BACKEND_URL     topBannerUrl: loc.topBannerUrl || '',
import.meta.env.VITE_BACKEND_URL     topBannerHeight: loc.topBannerHeight || 3,
import.meta.env.VITE_BACKEND_URL     topBannerRadiusTop: loc.topBannerRadiusTop !== undefined ? loc.topBannerRadiusTop : true,
import.meta.env.VITE_BACKEND_URL     topBannerRadiusBottom: loc.topBannerRadiusBottom !== undefined ? loc.topBannerRadiusBottom : false,
import.meta.env.VITE_BACKEND_URL     bottomBannerUrl: loc.bottomBannerUrl || (loc.bottomBannerContent?.startsWith('http') ? loc.bottomBannerContent : '') || '',
import.meta.env.VITE_BACKEND_URL     bottomBannerText: loc.bottomBannerText || (!loc.bottomBannerContent?.startsWith('http') ? loc.bottomBannerContent || '' : '') || '',
import.meta.env.VITE_BACKEND_URL     bottomBannerHeight: loc.bottomBannerHeight || 2,
import.meta.env.VITE_BACKEND_URL     bottomBannerRadiusTop: loc.bottomBannerRadiusTop !== undefined ? loc.bottomBannerRadiusTop : false,
import.meta.env.VITE_BACKEND_URL     bottomBannerRadiusBottom: loc.bottomBannerRadiusBottom !== undefined ? loc.bottomBannerRadiusBottom : true,
import.meta.env.VITE_BACKEND_URL     bottomBannerTextFixed: loc.bottomBannerTextFixed || false,
import.meta.env.VITE_BACKEND_URL     bottomBannerTextAlign: loc.bottomBannerTextAlign || 'center',
import.meta.env.VITE_BACKEND_URL     bottomBannerBg: loc.bottomBannerBg || '#1e293b',
import.meta.env.VITE_BACKEND_URL     bottomBannerLogoUrl: loc.bottomBannerLogoUrl || '',
import.meta.env.VITE_BACKEND_URL     kioskPin: loc.kioskPin || '',
import.meta.env.VITE_BACKEND_URL     brands: loc.brands || [],
import.meta.env.VITE_BACKEND_URL     promoActive: loc.promoActive || false,
import.meta.env.VITE_BACKEND_URL     promoBrandId: loc.promoBrandId || '',
import.meta.env.VITE_BACKEND_URL     promoMinOrderValue: loc.promoMinOrderValue || 0,
import.meta.env.VITE_BACKEND_URL     promoOrdersToAppear: loc.promoOrdersToAppear || 1,
import.meta.env.VITE_BACKEND_URL     languages: loc.languages && loc.languages.length > 0 ? loc.languages : ['ro'],
import.meta.env.VITE_BACKEND_URL     defaultLanguage: loc.defaultLanguage || (loc.languages && loc.languages.length > 0 ? loc.languages[0] : 'ro'),
import.meta.env.VITE_BACKEND_URL     langButtonColor: loc.langButtonColor || '#0f172a',
import.meta.env.VITE_BACKEND_URL     langSelectorPosition: loc.langSelectorPosition || 'after',
import.meta.env.VITE_BACKEND_URL   });
import.meta.env.VITE_BACKEND_URL   const [isSaving, setIsSaving] = useState(false);
import.meta.env.VITE_BACKEND_URL   const [saveSuccess, setSaveSuccess] = useState(false);
import.meta.env.VITE_BACKEND_URL   const [showWheelPreviewFull, setShowWheelPreviewFull] = useState(false);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const [promosData, setPromosData] = useState({});
import.meta.env.VITE_BACKEND_URL   useEffect(() => {
import.meta.env.VITE_BACKEND_URL     fetchWithAuth(`${backend}/api/promotions`)
import.meta.env.VITE_BACKEND_URL       .then(r => r.json())
import.meta.env.VITE_BACKEND_URL       .then(d => setPromosData(d || {}))
import.meta.env.VITE_BACKEND_URL       .catch(() => {});
import.meta.env.VITE_BACKEND_URL   }, [backend, fetchWithAuth]);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   // Toggles for optional sections
import.meta.env.VITE_BACKEND_URL   const [usePin, setUsePin] = useState(!!loc.kioskPin);
import.meta.env.VITE_BACKEND_URL   const [useBanner, setUseBanner] = useState(!!loc.topBannerUrl);
import.meta.env.VITE_BACKEND_URL   const [useBottomBanner, setUseBottomBanner] = useState(!!loc.bottomBannerContent);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const handleChange = (field, val) => setFormData(p => ({ ...p, [field]: val }));
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const toggleBrand = (b) => {
import.meta.env.VITE_BACKEND_URL     setFormData(prev => {
import.meta.env.VITE_BACKEND_URL       const bSet = new Set(prev.brands);
import.meta.env.VITE_BACKEND_URL       bSet.has(b) ? bSet.delete(b) : bSet.add(b);
import.meta.env.VITE_BACKEND_URL       return { ...prev, brands: Array.from(bSet) };
import.meta.env.VITE_BACKEND_URL     });
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const saveSettings = async () => {
import.meta.env.VITE_BACKEND_URL     setIsSaving(true);
import.meta.env.VITE_BACKEND_URL     // Sync toggles with data
import.meta.env.VITE_BACKEND_URL     const finalData = { ...formData };
import.meta.env.VITE_BACKEND_URL     if (!usePin) finalData.kioskPin = '';
import.meta.env.VITE_BACKEND_URL     if (!useBanner) finalData.topBannerUrl = '';
import.meta.env.VITE_BACKEND_URL     if (!useBottomBanner) { finalData.bottomBannerUrl = ''; finalData.bottomBannerText = ''; finalData.bottomBannerContent = ''; }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL     try {
import.meta.env.VITE_BACKEND_URL       await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
import.meta.env.VITE_BACKEND_URL         method: 'PUT',
import.meta.env.VITE_BACKEND_URL         headers: { 'Content-Type': 'application/json' },
import.meta.env.VITE_BACKEND_URL         body: JSON.stringify(finalData)
import.meta.env.VITE_BACKEND_URL       });
import.meta.env.VITE_BACKEND_URL       setSaveSuccess(true);
import.meta.env.VITE_BACKEND_URL       onSave();
import.meta.env.VITE_BACKEND_URL       
import.meta.env.VITE_BACKEND_URL       // Toast feel — wait a moment then close
import.meta.env.VITE_BACKEND_URL       setTimeout(() => {
import.meta.env.VITE_BACKEND_URL         onBack();
import.meta.env.VITE_BACKEND_URL       }, 1000);
import.meta.env.VITE_BACKEND_URL       
import.meta.env.VITE_BACKEND_URL     } catch(e) {
import.meta.env.VITE_BACKEND_URL       console.error('Eroare la salvare.');
import.meta.env.VITE_BACKEND_URL       setIsSaving(false);
import.meta.env.VITE_BACKEND_URL     }
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const renderPreview = (u) => {
import.meta.env.VITE_BACKEND_URL     if (!u) return null;
import.meta.env.VITE_BACKEND_URL     if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) {
import.meta.env.VITE_BACKEND_URL       return <video src={u} autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
import.meta.env.VITE_BACKEND_URL     } else if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(u)) {
import.meta.env.VITE_BACKEND_URL       return <img src={u} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
import.meta.env.VITE_BACKEND_URL     } else {
import.meta.env.VITE_BACKEND_URL       return <iframe src={u} title="Preview" style={{ width: '100%', height: '100%', border: 'none' }} />;
import.meta.env.VITE_BACKEND_URL     }
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   if (editingMenuBrand) {
import.meta.env.VITE_BACKEND_URL     return (
import.meta.env.VITE_BACKEND_URL       <div className="admin-section" style={{ padding: 0 }}>
import.meta.env.VITE_BACKEND_URL         <MenuProfileEditorModal 
import.meta.env.VITE_BACKEND_URL           backend={backend}
import.meta.env.VITE_BACKEND_URL           brand={editingMenuBrand.brand}
import.meta.env.VITE_BACKEND_URL           profile={editingMenuBrand.profile}
import.meta.env.VITE_BACKEND_URL           localHiddenItemsOverride={editingMenuBrand.localHiddenItemsOverride}
import.meta.env.VITE_BACKEND_URL           onClose={() => setEditingMenuBrand(null)}
import.meta.env.VITE_BACKEND_URL           onSave={(updatedConfig) => {
import.meta.env.VITE_BACKEND_URL              const brandId = editingMenuBrand.brand.id;
import.meta.env.VITE_BACKEND_URL              const newOverrides = { ...formData.menuOverrides };
import.meta.env.VITE_BACKEND_URL              if (!newOverrides[brandId]) newOverrides[brandId] = {};
import.meta.env.VITE_BACKEND_URL              newOverrides[brandId].hiddenItems = updatedConfig.hiddenItems;
import.meta.env.VITE_BACKEND_URL              handleChange('menuOverrides', newOverrides);
import.meta.env.VITE_BACKEND_URL              setEditingMenuBrand(null);
import.meta.env.VITE_BACKEND_URL           }}
import.meta.env.VITE_BACKEND_URL         />
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL     );
import.meta.env.VITE_BACKEND_URL   }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const finalKioskUrl = formData.kioskUrl || `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <div className="loc-edit-form" style={{ maxWidth: '1000px', margin: '0 auto' }}>
import.meta.env.VITE_BACKEND_URL       <div className="loc-edit-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
import.meta.env.VITE_BACKEND_URL         <div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL            <h2 style={{ margin: '8px 0 0 0', fontSize: '1.5rem', color: 'var(--text)' }}>Configurare Kiosk: <span style={{color:'#3b82f6'}}>{loc.name}</span></h2>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL         <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
import.meta.env.VITE_BACKEND_URL           <a
import.meta.env.VITE_BACKEND_URL             href={finalKioskUrl}
import.meta.env.VITE_BACKEND_URL             target="_blank" rel="noreferrer"
import.meta.env.VITE_BACKEND_URL             style={{
import.meta.env.VITE_BACKEND_URL               display: 'inline-flex', alignItems: 'center', gap: 6,
import.meta.env.VITE_BACKEND_URL               background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)',
import.meta.env.VITE_BACKEND_URL               padding: '10px 16px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600,
import.meta.env.VITE_BACKEND_URL               textDecoration: 'none', transition: 'all 0.2s'
import.meta.env.VITE_BACKEND_URL             }}
import.meta.env.VITE_BACKEND_URL           >
import.meta.env.VITE_BACKEND_URL             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
import.meta.env.VITE_BACKEND_URL             Preview Live
import.meta.env.VITE_BACKEND_URL           </a>
import.meta.env.VITE_BACKEND_URL           {/* Restart / Refresh remote kiosk */}
import.meta.env.VITE_BACKEND_URL           <RestartKioskBtn locId={loc.id} backend={backend} fetchWithAuth={fetchWithAuth} />
import.meta.env.VITE_BACKEND_URL           <button 
import.meta.env.VITE_BACKEND_URL             className="loc-save-btn" 
import.meta.env.VITE_BACKEND_URL             onClick={saveSettings} 
import.meta.env.VITE_BACKEND_URL             disabled={isSaving || saveSuccess}
import.meta.env.VITE_BACKEND_URL             style={{ 
import.meta.env.VITE_BACKEND_URL               background: saveSuccess ? '#10b981' : '#0f172a', 
import.meta.env.VITE_BACKEND_URL               color: '#fff',
import.meta.env.VITE_BACKEND_URL               padding: '10px 24px', 
import.meta.env.VITE_BACKEND_URL               borderRadius: '12px',
import.meta.env.VITE_BACKEND_URL               fontSize: '0.95rem',
import.meta.env.VITE_BACKEND_URL               border: 'none',
import.meta.env.VITE_BACKEND_URL               cursor: (isSaving || saveSuccess) ? 'default' : 'pointer',
import.meta.env.VITE_BACKEND_URL               boxShadow: saveSuccess ? '0 4px 14px rgba(16, 185, 129, 0.4)' : '0 4px 14px rgba(15, 23, 42, 0.2)',
import.meta.env.VITE_BACKEND_URL               transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
import.meta.env.VITE_BACKEND_URL             }}
import.meta.env.VITE_BACKEND_URL           >
import.meta.env.VITE_BACKEND_URL             {saveSuccess ? '✓ Configurație Salvată' : isSaving ? ' Se procesează...' : ' Salvează Schimbările'}
import.meta.env.VITE_BACKEND_URL           </button>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       <div className="loc-edit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Card: Comportament */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL           <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Conținut Kiosk</h3>
import.meta.env.VITE_BACKEND_URL           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Selectează restaurantele pe care clienții le pot explora din această tabletă.</p>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           <div className="loc-brand-select" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
import.meta.env.VITE_BACKEND_URL             {/* Show selected brands first with reorder buttons */}
import.meta.env.VITE_BACKEND_URL             <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px dashed var(--border)' }}>
import.meta.env.VITE_BACKEND_URL               {formData.brands.map((k, index) => {
import.meta.env.VITE_BACKEND_URL                 const v = {smashme:'SmashMe',sushimaster:'Sushi Master',welovesushi:'WeLoveSushi',ikura:'Ikura'}[k] || k;
import.meta.env.VITE_BACKEND_URL                 return (
import.meta.env.VITE_BACKEND_URL                   <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
import.meta.env.VITE_BACKEND_URL                       <div style={{ width: 28, height: 28, borderRadius: 6, background: (BRAND_COLORS && BRAND_COLORS[k]) ? BRAND_COLORS[k] : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
import.meta.env.VITE_BACKEND_URL                          <BrandLogo brandId={k} size={18} />
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                       {v}
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', gap: 6 }}>
import.meta.env.VITE_BACKEND_URL                       <button onClick={() => {
import.meta.env.VITE_BACKEND_URL                           const newB = [...formData.brands];
import.meta.env.VITE_BACKEND_URL                           if (index > 0) {
import.meta.env.VITE_BACKEND_URL                             [newB[index-1], newB[index]] = [newB[index], newB[index-1]];
import.meta.env.VITE_BACKEND_URL                             setFormData(p => ({ ...p, brands: newB }));
import.meta.env.VITE_BACKEND_URL                           }
import.meta.env.VITE_BACKEND_URL                         }} disabled={index === 0} style={{ padding: '6px 10px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: index===0?'not-allowed':'pointer', fontSize: '0.75rem', fontWeight: 600 }}>↑ Sus</button>
import.meta.env.VITE_BACKEND_URL                       <button onClick={() => {
import.meta.env.VITE_BACKEND_URL                           const newB = [...formData.brands];
import.meta.env.VITE_BACKEND_URL                           if (index < newB.length - 1) {
import.meta.env.VITE_BACKEND_URL                             [newB[index+1], newB[index]] = [newB[index], newB[index+1]];
import.meta.env.VITE_BACKEND_URL                             setFormData(p => ({ ...p, brands: newB }));
import.meta.env.VITE_BACKEND_URL                           }
import.meta.env.VITE_BACKEND_URL                         }} disabled={index === formData.brands.length - 1} style={{ padding: '6px 10px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: index===formData.brands.length-1?'not-allowed':'pointer', fontSize: '0.75rem', fontWeight: 600 }}>↓ Jos</button>
import.meta.env.VITE_BACKEND_URL                       <button onClick={() => toggleBrand(k)} style={{ padding: '6px 10px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Șterge</button>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 );
import.meta.env.VITE_BACKEND_URL               })}
import.meta.env.VITE_BACKEND_URL               {formData.brands.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Niciun restaurant selectat</span>}
import.meta.env.VITE_BACKEND_URL             </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL             {/* Selection candidates */}
import.meta.env.VITE_BACKEND_URL             <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
import.meta.env.VITE_BACKEND_URL               {Object.entries({smashme:'SmashMe',sushimaster:'Sushi Master',welovesushi:'WeLoveSushi',ikura:'Ikura'}).map(([k, v]) => {
import.meta.env.VITE_BACKEND_URL                 if (formData.brands.includes(k)) return null;
import.meta.env.VITE_BACKEND_URL                 return (
import.meta.env.VITE_BACKEND_URL                   <button
import.meta.env.VITE_BACKEND_URL                     key={k}
import.meta.env.VITE_BACKEND_URL                     className="loc-brand-pill"
import.meta.env.VITE_BACKEND_URL                     style={{ 
import.meta.env.VITE_BACKEND_URL                       padding: '8px 12px', borderRadius: '8px', 
import.meta.env.VITE_BACKEND_URL                       display: 'flex', alignItems: 'center', gap: '6px', 
import.meta.env.VITE_BACKEND_URL                       background: 'var(--surface)', color: 'var(--text)', 
import.meta.env.VITE_BACKEND_URL                       border: '1px dashed var(--border)',
import.meta.env.VITE_BACKEND_URL                       fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s', 
import.meta.env.VITE_BACKEND_URL                       cursor: 'pointer'
import.meta.env.VITE_BACKEND_URL                     }}
import.meta.env.VITE_BACKEND_URL                     onClick={() => toggleBrand(k)}
import.meta.env.VITE_BACKEND_URL                   >
import.meta.env.VITE_BACKEND_URL                     <span style={{ color: '#3b82f6', fontSize: '1.2rem', lineHeight: 1 }}>+</span>
import.meta.env.VITE_BACKEND_URL                     <BrandLogo brandId={k} size={14} /> <span style={{ opacity: 0.8 }}>{v}</span>
import.meta.env.VITE_BACKEND_URL                   </button>
import.meta.env.VITE_BACKEND_URL                 );
import.meta.env.VITE_BACKEND_URL               })}
import.meta.env.VITE_BACKEND_URL             </div>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           {/* LINK KIOSK SUPER COMPACT */}
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(59,130,246,0.05)', borderRadius: '10px', border: '1px dashed rgba(59,130,246,0.3)', marginBottom: '20px' }}>
import.meta.env.VITE_BACKEND_URL              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Link Kiosk: <span style={{ fontFamily: 'monospace', color: '#3b82f6' }}>...{finalKioskUrl.split('?loc=')[1]}</span></span>
import.meta.env.VITE_BACKEND_URL              <button onClick={() => navigator.clipboard.writeText(finalKioskUrl)} style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(59,130,246,0.3)' }}>Copiaza URL</button>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL           {/* GRID COMPACT SETARI DESIGN */}
import.meta.env.VITE_BACKEND_URL           <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
import.meta.env.VITE_BACKEND_URL              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Aspect & Poziționare Limbi</h4>
import.meta.env.VITE_BACKEND_URL              
import.meta.env.VITE_BACKEND_URL              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr)', gap: '16px' }}>
import.meta.env.VITE_BACKEND_URL                 
import.meta.env.VITE_BACKEND_URL                 {/* COL 1: Buton Principal (Fundal) */}
import.meta.env.VITE_BACKEND_URL                 <div>
import.meta.env.VITE_BACKEND_URL                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Fundal Buton Start Comandă</label>
import.meta.env.VITE_BACKEND_URL                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
import.meta.env.VITE_BACKEND_URL                       <input type="color" value={formData.langButtonColor || '#0f172a'} onChange={e => handleChange('langButtonColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
import.meta.env.VITE_BACKEND_URL                       <input type="text" value={formData.langButtonColor || '#0f172a'} onChange={e => handleChange('langButtonColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: '#fff', color: 'var(--text)' }} />
import.meta.env.VITE_BACKEND_URL                    </div>
import.meta.env.VITE_BACKEND_URL                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.75rem', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
import.meta.env.VITE_BACKEND_URL                      <input type="checkbox" checked={formData.langButtonFlagColors || false} onChange={e => handleChange('langButtonFlagColors', e.target.checked)} />
import.meta.env.VITE_BACKEND_URL                      Culorile Steagului (Suprascrie Fundalul)
import.meta.env.VITE_BACKEND_URL                    </label>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 {/* COL 1B: Buton Principal (Text Color) */}
import.meta.env.VITE_BACKEND_URL                 <div>
import.meta.env.VITE_BACKEND_URL                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Culoare Text Buton Start</label>
import.meta.env.VITE_BACKEND_URL                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
import.meta.env.VITE_BACKEND_URL                       <input type="color" value={formData.langButtonTextColor || '#ffffff'} onChange={e => handleChange('langButtonTextColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
import.meta.env.VITE_BACKEND_URL                       <input type="text" value={formData.langButtonTextColor || '#ffffff'} onChange={e => handleChange('langButtonTextColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: '#fff', color: 'var(--text)' }} />
import.meta.env.VITE_BACKEND_URL                    </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 {/* COL 1C: Buton Principal (Border) */}
import.meta.env.VITE_BACKEND_URL                 <div>
import.meta.env.VITE_BACKEND_URL                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Contur Buton Start</label>
import.meta.env.VITE_BACKEND_URL                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
import.meta.env.VITE_BACKEND_URL                       <input type="color" value={formData.langButtonBorderColor || '#0f172a'} onChange={e => handleChange('langButtonBorderColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
import.meta.env.VITE_BACKEND_URL                       <input type="text" value={formData.langButtonBorderColor || '#0f172a'} onChange={e => handleChange('langButtonBorderColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: '#fff', color: 'var(--text)' }} />
import.meta.env.VITE_BACKEND_URL                       <button type="button" onClick={() => handleChange('langButtonBorderColor', 'transparent')} style={{ fontSize: '0.65rem', padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>Fără</button>
import.meta.env.VITE_BACKEND_URL                    </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 {/* COL 1D: Buton Principal (Text) */}
import.meta.env.VITE_BACKEND_URL                 <div style={{ gridColumn: '1 / -1' }}>
import.meta.env.VITE_BACKEND_URL                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Text Personalizat Buton Start</label>
import.meta.env.VITE_BACKEND_URL                    <input type="text" placeholder="Începe comanda" value={formData.langButtonText || ''} onChange={e => handleChange('langButtonText', e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: '#fff', color: 'var(--text)', boxSizing: 'border-box' }} />
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 {/* COL 2: Pozitie Sus/Jos */}
import.meta.env.VITE_BACKEND_URL                 <div>
import.meta.env.VITE_BACKEND_URL                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Poziție pe Ecran</label>
import.meta.env.VITE_BACKEND_URL                    <div style={{ display: 'flex', gap: 4 }}>
import.meta.env.VITE_BACKEND_URL                      {[{v:'top',l:'Sus'},{v:'bottom',l:'Jos'}].map(opt => (
import.meta.env.VITE_BACKEND_URL                        <button key={opt.v} type="button" onClick={() => handleChange('langVerticalPosition', opt.v)}
import.meta.env.VITE_BACKEND_URL                          style={{ padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: (formData.langVerticalPosition || 'bottom') === opt.v ? '2px solid #3b82f6' : '1px solid var(--border)', background: (formData.langVerticalPosition || 'bottom') === opt.v ? '#eff6ff' : '#fff', color: (formData.langVerticalPosition || 'bottom') === opt.v ? '#1d4ed8' : 'var(--text-muted)', cursor: 'pointer' }}>
import.meta.env.VITE_BACKEND_URL                          {opt.l}
import.meta.env.VITE_BACKEND_URL                        </button>
import.meta.env.VITE_BACKEND_URL                      ))}
import.meta.env.VITE_BACKEND_URL                    </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 {/* COL 3: Fundal Limbi */}
import.meta.env.VITE_BACKEND_URL                 <div>
import.meta.env.VITE_BACKEND_URL                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Fundal Etichete Limbi</label>
import.meta.env.VITE_BACKEND_URL                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
import.meta.env.VITE_BACKEND_URL                       <input type="color" value={formData.langBgColor || '#ffffff'} onChange={e => handleChange('langBgColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
import.meta.env.VITE_BACKEND_URL                       <input type="text" value={formData.langBgColor || ''} placeholder="transparent" onChange={e => handleChange('langBgColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: '#fff', color: 'var(--text)' }} />
import.meta.env.VITE_BACKEND_URL                       <button type="button" onClick={() => handleChange('langBgColor', 'transparent')} style={{ fontSize: '0.65rem', padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>Fără</button>
import.meta.env.VITE_BACKEND_URL                    </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 {/* COL 4: Cand apar */}
import.meta.env.VITE_BACKEND_URL                 <div>
import.meta.env.VITE_BACKEND_URL                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Moment Apariție</label>
import.meta.env.VITE_BACKEND_URL                    <div style={{ display: 'flex', gap: 4 }}>
import.meta.env.VITE_BACKEND_URL                      {[{v:'before',l:'Screensaver'},{v:'after',l:'Dupa saver'},{v:'both',l:'Ambele'}].map(opt => (
import.meta.env.VITE_BACKEND_URL                        <button key={opt.v} type="button" onClick={() => handleChange('langSelectorPosition', opt.v)}
import.meta.env.VITE_BACKEND_URL                          style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, border: formData.langSelectorPosition === opt.v ? '2px solid #3b82f6' : '1px solid var(--border)', background: formData.langSelectorPosition === opt.v ? '#eff6ff' : '#fff', color: formData.langSelectorPosition === opt.v ? '#1d4ed8' : 'var(--text-muted)', cursor: 'pointer' }}>
import.meta.env.VITE_BACKEND_URL                          {opt.l}
import.meta.env.VITE_BACKEND_URL                        </button>
import.meta.env.VITE_BACKEND_URL                      ))}
import.meta.env.VITE_BACKEND_URL                    </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 {/* COL 5: Contur Limbi */}
import.meta.env.VITE_BACKEND_URL                 <div>
import.meta.env.VITE_BACKEND_URL                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Contur Etichete Limbi</label>
import.meta.env.VITE_BACKEND_URL                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
import.meta.env.VITE_BACKEND_URL                       <input type="color" value={formData.langBorderColor || '#e2e8f0'} onChange={e => handleChange('langBorderColor', e.target.value)} style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }} />
import.meta.env.VITE_BACKEND_URL                       <input type="text" value={formData.langBorderColor || ''} placeholder="transparent" onChange={e => handleChange('langBorderColor', e.target.value)} style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: '#fff', color: 'var(--text)' }} />
import.meta.env.VITE_BACKEND_URL                       <button type="button" onClick={() => handleChange('langBorderColor', 'transparent')} style={{ fontSize: '0.65rem', padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>Fără</button>
import.meta.env.VITE_BACKEND_URL                    </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL                 
import.meta.env.VITE_BACKEND_URL              </div>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Card: Security */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
import.meta.env.VITE_BACKEND_URL             <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Securitate PIN</h3>
import.meta.env.VITE_BACKEND_URL             <label className="pc-toggle" style={{ margin: 0 }}>
import.meta.env.VITE_BACKEND_URL               <input type="checkbox" checked={usePin} onChange={e => setUsePin(e.target.checked)} />
import.meta.env.VITE_BACKEND_URL               <span className="toggle-slider" />
import.meta.env.VITE_BACKEND_URL             </label>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Blochează tableta până la introducerea primei parole de angajat.</p>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           {usePin && (
import.meta.env.VITE_BACKEND_URL             <div style={{ animation: 'fadeIn 0.3s ease' }}>
import.meta.env.VITE_BACKEND_URL               <input 
import.meta.env.VITE_BACKEND_URL                 type="password" 
import.meta.env.VITE_BACKEND_URL                 maxLength="6"
import.meta.env.VITE_BACKEND_URL                 className="pc-input" 
import.meta.env.VITE_BACKEND_URL                 placeholder="Ex: 1234"
import.meta.env.VITE_BACKEND_URL                 value={formData.kioskPin}
import.meta.env.VITE_BACKEND_URL                 onChange={e => handleChange('kioskPin', e.target.value.replace(/\D/g, ''))}
import.meta.env.VITE_BACKEND_URL                 style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', maxWidth: '140px', fontSize: '1.1rem', letterSpacing: '2px', boxSizing: 'border-box' }}
import.meta.env.VITE_BACKEND_URL               />
import.meta.env.VITE_BACKEND_URL             </div>
import.meta.env.VITE_BACKEND_URL           )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL           <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
import.meta.env.VITE_BACKEND_URL              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
import.meta.env.VITE_BACKEND_URL                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)' }}>Limbi Afișate pe Kiosk</h4>
import.meta.env.VITE_BACKEND_URL                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>★ = limbă implicită</span>
import.meta.env.VITE_BACKEND_URL              </div>
import.meta.env.VITE_BACKEND_URL              {/* Active languages — ordered list with controls */}
import.meta.env.VITE_BACKEND_URL              {(() => {
import.meta.env.VITE_BACKEND_URL                const ALL_LANGS = ['ro', 'en', 'fr', 'hu', 'ru', 'uk', 'bg', 'de', 'es'];
import.meta.env.VITE_BACKEND_URL                const langNames = { ro: 'RO 🇷🇴', en: 'EN 🇬🇧', fr: 'FR 🇫🇷', hu: 'HU 🇭🇺', ru: 'RU 🇷🇺', uk: 'UA 🇺🇦', bg: 'BG 🇧🇬', de: 'DE 🇩🇪', es: 'ES 🇪🇸' };
import.meta.env.VITE_BACKEND_URL                const currentLangs = formData.languages || ['ro', 'en'];
import.meta.env.VITE_BACKEND_URL                const defaultLang = formData.defaultLanguage || currentLangs[0];
import.meta.env.VITE_BACKEND_URL                const inactive = ALL_LANGS.filter(l => !currentLangs.includes(l));
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                const moveLang = (idx, dir) => {
import.meta.env.VITE_BACKEND_URL                  const arr = [...currentLangs];
import.meta.env.VITE_BACKEND_URL                  const newIdx = idx + dir;
import.meta.env.VITE_BACKEND_URL                  if (newIdx < 0 || newIdx >= arr.length) return;
import.meta.env.VITE_BACKEND_URL                  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
import.meta.env.VITE_BACKEND_URL                  handleChange('languages', arr);
import.meta.env.VITE_BACKEND_URL                };
import.meta.env.VITE_BACKEND_URL                const removeLang = (lang) => {
import.meta.env.VITE_BACKEND_URL                  const filtered = currentLangs.filter(l => l !== lang);
import.meta.env.VITE_BACKEND_URL                  handleChange('languages', filtered);
import.meta.env.VITE_BACKEND_URL                  if (defaultLang === lang && filtered.length > 0) handleChange('defaultLanguage', filtered[0]);
import.meta.env.VITE_BACKEND_URL                };
import.meta.env.VITE_BACKEND_URL                const addLang = (lang) => {
import.meta.env.VITE_BACKEND_URL                  handleChange('languages', [...currentLangs, lang]);
import.meta.env.VITE_BACKEND_URL                };
import.meta.env.VITE_BACKEND_URL                const setDefault = (lang) => handleChange('defaultLanguage', lang);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                return (
import.meta.env.VITE_BACKEND_URL                  <div>
import.meta.env.VITE_BACKEND_URL                    {/* Selected languages in order */}
import.meta.env.VITE_BACKEND_URL                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
import.meta.env.VITE_BACKEND_URL                      {currentLangs.map((lang, idx) => {
import.meta.env.VITE_BACKEND_URL                        const isDefault = lang === defaultLang;
import.meta.env.VITE_BACKEND_URL                        return (
import.meta.env.VITE_BACKEND_URL                          <div key={lang} style={{
import.meta.env.VITE_BACKEND_URL                            display: 'flex', alignItems: 'center', gap: 6,
import.meta.env.VITE_BACKEND_URL                            background: isDefault ? '#0f172a' : 'var(--bg-surface)',
import.meta.env.VITE_BACKEND_URL                            border: isDefault ? '1px solid #0f172a' : '1px solid var(--border)',
import.meta.env.VITE_BACKEND_URL                            borderRadius: 10, padding: '6px 10px',
import.meta.env.VITE_BACKEND_URL                            transition: 'all 0.2s',
import.meta.env.VITE_BACKEND_URL                          }}>
import.meta.env.VITE_BACKEND_URL                            {/* Drag order number */}
import.meta.env.VITE_BACKEND_URL                            <span style={{ fontSize: '0.7rem', color: isDefault ? '#94a3b8' : 'var(--text-muted)', width: 16, textAlign: 'center', fontWeight: 700 }}>{idx + 1}</span>
import.meta.env.VITE_BACKEND_URL                            {/* Lang name */}
import.meta.env.VITE_BACKEND_URL                            <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 800, color: isDefault ? '#fff' : 'var(--text)' }}>{langNames[lang]}</span>
import.meta.env.VITE_BACKEND_URL                            {/* Default star button */}
import.meta.env.VITE_BACKEND_URL                            <button
import.meta.env.VITE_BACKEND_URL                              type="button"
import.meta.env.VITE_BACKEND_URL                              title={isDefault ? 'Limbă implicită (default)' : 'Setează ca limbă implicită'}
import.meta.env.VITE_BACKEND_URL                              onClick={() => setDefault(lang)}
import.meta.env.VITE_BACKEND_URL                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '0.9rem', opacity: isDefault ? 1 : 0.3, color: isDefault ? '#f59e0b' : '#94a3b8', transition: 'all 0.15s' }}
import.meta.env.VITE_BACKEND_URL                            >★</button>
import.meta.env.VITE_BACKEND_URL                            {/* Up / Down */}
import.meta.env.VITE_BACKEND_URL                            <button type="button" onClick={() => moveLang(idx, -1)} disabled={idx === 0}
import.meta.env.VITE_BACKEND_URL                              style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', padding: '2px 4px', fontSize: '0.7rem', opacity: idx === 0 ? 0.2 : 0.7, color: isDefault ? '#94a3b8' : 'var(--text-muted)', fontWeight: 700 }}>▲</button>
import.meta.env.VITE_BACKEND_URL                            <button type="button" onClick={() => moveLang(idx, 1)} disabled={idx === currentLangs.length - 1}
import.meta.env.VITE_BACKEND_URL                              style={{ background: 'none', border: 'none', cursor: idx === currentLangs.length - 1 ? 'default' : 'pointer', padding: '2px 4px', fontSize: '0.7rem', opacity: idx === currentLangs.length - 1 ? 0.2 : 0.7, color: isDefault ? '#94a3b8' : 'var(--text-muted)', fontWeight: 700 }}>▼</button>
import.meta.env.VITE_BACKEND_URL                            {/* Remove */}
import.meta.env.VITE_BACKEND_URL                            <button type="button" onClick={() => removeLang(lang)} disabled={currentLangs.length === 1}
import.meta.env.VITE_BACKEND_URL                              style={{ background: 'none', border: 'none', cursor: currentLangs.length === 1 ? 'default' : 'pointer', padding: '2px 6px', fontSize: '0.75rem', opacity: currentLangs.length === 1 ? 0.2 : 0.6, color: isDefault ? '#f87171' : '#ef4444', fontWeight: 700 }}>✕</button>
import.meta.env.VITE_BACKEND_URL                          </div>
import.meta.env.VITE_BACKEND_URL                        );
import.meta.env.VITE_BACKEND_URL                      })}
import.meta.env.VITE_BACKEND_URL                    </div>
import.meta.env.VITE_BACKEND_URL                    {/* Pool of inactive languages to add */}
import.meta.env.VITE_BACKEND_URL                    {inactive.length > 0 && (
import.meta.env.VITE_BACKEND_URL                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
import.meta.env.VITE_BACKEND_URL                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: 2 }}>+ Adaugă:</span>
import.meta.env.VITE_BACKEND_URL                        {inactive.map(lang => (
import.meta.env.VITE_BACKEND_URL                          <button key={lang} type="button" onClick={() => addLang(lang)}
import.meta.env.VITE_BACKEND_URL                            style={{ padding: '3px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: '1px dashed #94a3b8', background: 'transparent', color: 'var(--text-muted)', transition: 'all 0.15s' }}>
import.meta.env.VITE_BACKEND_URL                            {langNames[lang]}
import.meta.env.VITE_BACKEND_URL                          </button>
import.meta.env.VITE_BACKEND_URL                        ))}
import.meta.env.VITE_BACKEND_URL                      </div>
import.meta.env.VITE_BACKEND_URL                    )}
import.meta.env.VITE_BACKEND_URL                  </div>
import.meta.env.VITE_BACKEND_URL                );
import.meta.env.VITE_BACKEND_URL              })()}
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Card: Promoție (Roată Kiosk) */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
import.meta.env.VITE_BACKEND_URL             <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Promoție Kiosk (Roată Noroc)</h3>
import.meta.env.VITE_BACKEND_URL             <label className="pc-toggle" style={{ margin: 0 }}>
import.meta.env.VITE_BACKEND_URL               <input type="checkbox" checked={formData.promoActive || false} onChange={e => handleChange('promoActive', e.target.checked)} />
import.meta.env.VITE_BACKEND_URL               <span className="toggle-slider" />
import.meta.env.VITE_BACKEND_URL             </label>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Configurează condițiile specifice acestui kiosk pentru afișarea roții.</p>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           {formData.promoActive && (
import.meta.env.VITE_BACKEND_URL              <div style={{ animation: 'fadeIn 0.3s ease', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px 20px' }}>
import.meta.env.VITE_BACKEND_URL                <div>
import.meta.env.VITE_BACKEND_URL                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>Alege Roata</label>
import.meta.env.VITE_BACKEND_URL                  <select 
import.meta.env.VITE_BACKEND_URL                    value={formData.promoBrandId || ''} 
import.meta.env.VITE_BACKEND_URL                    onChange={e => handleChange('promoBrandId', e.target.value)}
import.meta.env.VITE_BACKEND_URL                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
import.meta.env.VITE_BACKEND_URL                  >
import.meta.env.VITE_BACKEND_URL                    <option value="">Alege...</option>
import.meta.env.VITE_BACKEND_URL                    <option value="smashme">Roata SmashMe</option>
import.meta.env.VITE_BACKEND_URL                    <option value="welovesushi">Roata SushiMaster</option>
import.meta.env.VITE_BACKEND_URL                  </select>
import.meta.env.VITE_BACKEND_URL                </div>
import.meta.env.VITE_BACKEND_URL                
import.meta.env.VITE_BACKEND_URL                <div>
import.meta.env.VITE_BACKEND_URL                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>Moment Apariție Roată</label>
import.meta.env.VITE_BACKEND_URL                  <select 
import.meta.env.VITE_BACKEND_URL                    value={formData.promoTriggerMoment || 'after_payment'} 
import.meta.env.VITE_BACKEND_URL                    onChange={e => handleChange('promoTriggerMoment', e.target.value)}
import.meta.env.VITE_BACKEND_URL                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
import.meta.env.VITE_BACKEND_URL                  >
import.meta.env.VITE_BACKEND_URL                    <option value="before_payment">Înainte de Plată (Adaugă în coș)</option>
import.meta.env.VITE_BACKEND_URL                    <option value="after_payment">După Confirmare Plată (Prezintă la Casă)</option>
import.meta.env.VITE_BACKEND_URL                  </select>
import.meta.env.VITE_BACKEND_URL                </div>
import.meta.env.VITE_BACKEND_URL                
import.meta.env.VITE_BACKEND_URL                <div>
import.meta.env.VITE_BACKEND_URL                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>Sumă Minimă Coș (RON)</label>
import.meta.env.VITE_BACKEND_URL                  <input 
import.meta.env.VITE_BACKEND_URL                    type="number" 
import.meta.env.VITE_BACKEND_URL                    value={formData.promoMinOrderValue === 0 ? '' : formData.promoMinOrderValue} 
import.meta.env.VITE_BACKEND_URL                    onChange={e => handleChange('promoMinOrderValue', Number(e.target.value))}
import.meta.env.VITE_BACKEND_URL                    placeholder="Ex: 50"
import.meta.env.VITE_BACKEND_URL                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
import.meta.env.VITE_BACKEND_URL                  />
import.meta.env.VITE_BACKEND_URL                </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                <div>
import.meta.env.VITE_BACKEND_URL                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
import.meta.env.VITE_BACKEND_URL                    <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Limitare Frecvență</label>
import.meta.env.VITE_BACKEND_URL                    <label className="pc-toggle" style={{ margin: 0, transform: 'scale(0.8)' }}>
import.meta.env.VITE_BACKEND_URL                      <input type="checkbox" checked={formData.promoFreqEnabled || false} onChange={e => handleChange('promoFreqEnabled', e.target.checked)} />
import.meta.env.VITE_BACKEND_URL                      <span className="toggle-slider" />
import.meta.env.VITE_BACKEND_URL                    </label>
import.meta.env.VITE_BACKEND_URL                  </div>
import.meta.env.VITE_BACKEND_URL                  {formData.promoFreqEnabled ? (
import.meta.env.VITE_BACKEND_URL                    <>
import.meta.env.VITE_BACKEND_URL                      <input 
import.meta.env.VITE_BACKEND_URL                        type="number" 
import.meta.env.VITE_BACKEND_URL                        value={formData.promoOrdersToAppear === 0 ? '' : formData.promoOrdersToAppear} 
import.meta.env.VITE_BACKEND_URL                        onChange={e => handleChange('promoOrdersToAppear', Number(e.target.value))}
import.meta.env.VITE_BACKEND_URL                        placeholder="Ex: Apare la fiecare a 3-a comandă"
import.meta.env.VITE_BACKEND_URL                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
import.meta.env.VITE_BACKEND_URL                      />
import.meta.env.VITE_BACKEND_URL                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ex: Randează doar dacă Comanda % N == 0</span>
import.meta.env.VITE_BACKEND_URL                    </>
import.meta.env.VITE_BACKEND_URL                  ) : (
import.meta.env.VITE_BACKEND_URL                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', textAlign: 'center' }}>
import.meta.env.VITE_BACKEND_URL                      Roata apare MEREU
import.meta.env.VITE_BACKEND_URL                    </div>
import.meta.env.VITE_BACKEND_URL                  )}
import.meta.env.VITE_BACKEND_URL                </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                {/* Previzualizare Roată */}
import.meta.env.VITE_BACKEND_URL                {formData.promoBrandId && promosData[formData.promoBrandId] ? (
import.meta.env.VITE_BACKEND_URL                  <div style={{ gridColumn: '1 / -1', width: '100%', marginTop: 24, padding: 20, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center', boxSizing: 'border-box' }}>
import.meta.env.VITE_BACKEND_URL                    <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Previzualizare Roată Live</h4>
import.meta.env.VITE_BACKEND_URL                    {promosData[formData.promoBrandId].active ? (
import.meta.env.VITE_BACKEND_URL                      <>
import.meta.env.VITE_BACKEND_URL                      <div 
import.meta.env.VITE_BACKEND_URL                        style={{ height: 400, overflow: 'hidden', position: 'relative', background: '#0f172a', borderRadius: 16, cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
import.meta.env.VITE_BACKEND_URL                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
import.meta.env.VITE_BACKEND_URL                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
import.meta.env.VITE_BACKEND_URL                        onClick={() => setShowWheelPreviewFull(true)}
import.meta.env.VITE_BACKEND_URL                      >
import.meta.env.VITE_BACKEND_URL                        <FortuneWheelPreview config={promosData[formData.promoBrandId].config} brandId={formData.promoBrandId} />
import.meta.env.VITE_BACKEND_URL                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.9) 0%, transparent 40%)', zIndex: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 20, color: '#fef08a', fontWeight: 800, fontSize: '0.9rem', letterSpacing: 1, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
import.meta.env.VITE_BACKEND_URL                          Apasă pentru simulare
import.meta.env.VITE_BACKEND_URL                        </div>
import.meta.env.VITE_BACKEND_URL                      </div>
import.meta.env.VITE_BACKEND_URL                      
import.meta.env.VITE_BACKEND_URL                      {/* OVERLAY FULLSCREEN */}
import.meta.env.VITE_BACKEND_URL                      {showWheelPreviewFull && (
import.meta.env.VITE_BACKEND_URL                        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' }}>
import.meta.env.VITE_BACKEND_URL                          
import.meta.env.VITE_BACKEND_URL                          {/* Close Button top-right */}
import.meta.env.VITE_BACKEND_URL                          <button 
import.meta.env.VITE_BACKEND_URL                            onClick={() => setShowWheelPreviewFull(false)}
import.meta.env.VITE_BACKEND_URL                            style={{ position: 'absolute', top: 30, right: 40, width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, transition: 'all 0.2s' }}
import.meta.env.VITE_BACKEND_URL                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
import.meta.env.VITE_BACKEND_URL                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}
import.meta.env.VITE_BACKEND_URL                          >
import.meta.env.VITE_BACKEND_URL                            Inchide
import.meta.env.VITE_BACKEND_URL                          </button>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                          <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, marginBottom: 40, marginTop: -60, textShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100000 }}>
import.meta.env.VITE_BACKEND_URL                            Așa se vede pe Kiosk!
import.meta.env.VITE_BACKEND_URL                          </h2>
import.meta.env.VITE_BACKEND_URL                          
import.meta.env.VITE_BACKEND_URL                          <div style={{ width: 800, height: 800, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
import.meta.env.VITE_BACKEND_URL                            <FortuneWheelPreview config={promosData[formData.promoBrandId].config} brandId={formData.promoBrandId} scale={1.2} />
import.meta.env.VITE_BACKEND_URL                          </div>
import.meta.env.VITE_BACKEND_URL                        </div>
import.meta.env.VITE_BACKEND_URL                      )}
import.meta.env.VITE_BACKEND_URL                      </>
import.meta.env.VITE_BACKEND_URL                    ) : (
import.meta.env.VITE_BACKEND_URL                      <div style={{ padding: 20, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600 }}>
import.meta.env.VITE_BACKEND_URL                        Roata este OPRITĂ din modulul global de Promoții pentru acest brand. Activați-o de acolo mai întâi!
import.meta.env.VITE_BACKEND_URL                      </div>
import.meta.env.VITE_BACKEND_URL                    )}
import.meta.env.VITE_BACKEND_URL                  </div>
import.meta.env.VITE_BACKEND_URL                ) : formData.promoBrandId ? (
import.meta.env.VITE_BACKEND_URL                  <div style={{ width: '100%', marginTop: 24, padding: 20, color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
import.meta.env.VITE_BACKEND_URL                    Nu există date de promoție salvate pentru {formData.promoBrandId}. Adăugați feliile în pagina Promoții.
import.meta.env.VITE_BACKEND_URL                  </div>
import.meta.env.VITE_BACKEND_URL                ) : null}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL              </div>
import.meta.env.VITE_BACKEND_URL           )}
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Card: Screensaver */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL           <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Screensaver Standby</h3>
import.meta.env.VITE_BACKEND_URL           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Rulare automată reclamă full-screen dacă tableta stă neatinsă 30s.</p>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           <input 
import.meta.env.VITE_BACKEND_URL             type="url" 
import.meta.env.VITE_BACKEND_URL             className="pc-input" 
import.meta.env.VITE_BACKEND_URL             placeholder="URL Video MP4 sau Imagine..."
import.meta.env.VITE_BACKEND_URL             value={formData.posterUrl}
import.meta.env.VITE_BACKEND_URL             onChange={e => handleChange('posterUrl', e.target.value)}
import.meta.env.VITE_BACKEND_URL             style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
import.meta.env.VITE_BACKEND_URL           />
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           {formData.posterUrl ? (
import.meta.env.VITE_BACKEND_URL             <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
import.meta.env.VITE_BACKEND_URL               <div style={{ width: 270, height: 480, borderRadius: 16, overflow: 'hidden', border: '8px solid #1e293b', background: '#000', position: 'relative', boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}>
import.meta.env.VITE_BACKEND_URL                 {renderPreview(formData.posterUrl)}
import.meta.env.VITE_BACKEND_URL                 <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.95)', color: '#0f172a', padding: '8px 16px', borderRadius: 24, fontSize: '0.8rem', fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
import.meta.env.VITE_BACKEND_URL                   Atinge pentru a începe
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL               </div>
import.meta.env.VITE_BACKEND_URL             </div>
import.meta.env.VITE_BACKEND_URL           ) : (
import.meta.env.VITE_BACKEND_URL              <div style={{ height: 160, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Fără screensaver.</div>
import.meta.env.VITE_BACKEND_URL           )}
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Card: Banner Promo (10% Top) */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
import.meta.env.VITE_BACKEND_URL             <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Banner Promo Persistent (Top)</h3>
import.meta.env.VITE_BACKEND_URL             <label className="pc-toggle" style={{ margin: 0 }}>
import.meta.env.VITE_BACKEND_URL               <input type="checkbox" checked={useBanner} onChange={e => setUseBanner(e.target.checked)} />
import.meta.env.VITE_BACKEND_URL               <span className="toggle-slider" />
import.meta.env.VITE_BACKEND_URL             </label>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Ocupă deasupra interfeței cu o bandă îngustă (10%) reclamă video/imagine la reducere.</p>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           {useBanner && (
import.meta.env.VITE_BACKEND_URL              <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '16px' }}>
import.meta.env.VITE_BACKEND_URL                 {formData.brands && formData.brands.length > 0 ? (
import.meta.env.VITE_BACKEND_URL                   formData.brands.map(brandId => {
import.meta.env.VITE_BACKEND_URL                     const val = formData[`topBannerUrl_${brandId}`] ?? formData.topBannerUrl ?? '';
import.meta.env.VITE_BACKEND_URL                     return (
import.meta.env.VITE_BACKEND_URL                       <div key={brandId} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
import.meta.env.VITE_BACKEND_URL                          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
import.meta.env.VITE_BACKEND_URL                            <BrandLogo brandId={brandId} size={16} /> Banner pentru {brandId}
import.meta.env.VITE_BACKEND_URL                          </label>
import.meta.env.VITE_BACKEND_URL                          <input 
import.meta.env.VITE_BACKEND_URL                            type="url" 
import.meta.env.VITE_BACKEND_URL                            className="pc-input" 
import.meta.env.VITE_BACKEND_URL                            placeholder={`URL Video MP4 / Imagine pt ${brandId}...`}
import.meta.env.VITE_BACKEND_URL                            value={val}
import.meta.env.VITE_BACKEND_URL                            onChange={e => handleChange(`topBannerUrl_${brandId}`, e.target.value)}
import.meta.env.VITE_BACKEND_URL                            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }}
import.meta.env.VITE_BACKEND_URL                          />
import.meta.env.VITE_BACKEND_URL                          
import.meta.env.VITE_BACKEND_URL                          {val ? (
import.meta.env.VITE_BACKEND_URL                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
import.meta.env.VITE_BACKEND_URL                              <div style={{ width: 135, height: 240, borderRadius: 12, overflow: 'hidden', border: '6px solid #1e293b', background: '#e2e8f0', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
import.meta.env.VITE_BACKEND_URL                                <div style={{ position: 'absolute', inset: 0, padding: '4px' }}>
import.meta.env.VITE_BACKEND_URL                                  <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
import.meta.env.VITE_BACKEND_URL                                  <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
import.meta.env.VITE_BACKEND_URL                                  <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px' }} />
import.meta.env.VITE_BACKEND_URL                                </div>
import.meta.env.VITE_BACKEND_URL                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${10 + ((formData.topBannerHeight || 1) - 1) * 5}%`, borderRadius: `${formData.topBannerRadiusTop ? '6px' : '0'} ${formData.topBannerRadiusTop ? '6px' : '0'} ${formData.topBannerRadiusBottom ? '6px' : '0'} ${formData.topBannerRadiusBottom ? '6px' : '0'}`, transition: 'all 0.3s ease', overflow: 'hidden', background: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
import.meta.env.VITE_BACKEND_URL                                   {renderPreview(val)}
import.meta.env.VITE_BACKEND_URL                                </div>
import.meta.env.VITE_BACKEND_URL                              </div>
import.meta.env.VITE_BACKEND_URL                            </div>
import.meta.env.VITE_BACKEND_URL                          ) : null}
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                     );
import.meta.env.VITE_BACKEND_URL                   })
import.meta.env.VITE_BACKEND_URL                 ) : (
import.meta.env.VITE_BACKEND_URL                   <div>
import.meta.env.VITE_BACKEND_URL                     <input 
import.meta.env.VITE_BACKEND_URL                       type="url" 
import.meta.env.VITE_BACKEND_URL                       className="pc-input" 
import.meta.env.VITE_BACKEND_URL                       placeholder="URL Video MP4 sau Imagine globală..."
import.meta.env.VITE_BACKEND_URL                       value={formData.topBannerUrl || ''} 
import.meta.env.VITE_BACKEND_URL                       onChange={e => handleChange('topBannerUrl', e.target.value)}
import.meta.env.VITE_BACKEND_URL                       style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
import.meta.env.VITE_BACKEND_URL                     />
import.meta.env.VITE_BACKEND_URL                     
import.meta.env.VITE_BACKEND_URL                     {formData.topBannerUrl ? (
import.meta.env.VITE_BACKEND_URL                       <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 16 }}>
import.meta.env.VITE_BACKEND_URL                         <div style={{ width: 135, height: 240, borderRadius: 12, overflow: 'hidden', border: '6px solid #1e293b', background: '#e2e8f0', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
import.meta.env.VITE_BACKEND_URL                           <div style={{ position: 'absolute', inset: 0, padding: '4px' }}>
import.meta.env.VITE_BACKEND_URL                             <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
import.meta.env.VITE_BACKEND_URL                             <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
import.meta.env.VITE_BACKEND_URL                             <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px' }} />
import.meta.env.VITE_BACKEND_URL                           </div>
import.meta.env.VITE_BACKEND_URL                           <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${10 + ((formData.topBannerHeight || 1) - 1) * 5}%`, borderRadius: `${formData.topBannerRadiusTop ? '6px' : '0'} ${formData.topBannerRadiusTop ? '6px' : '0'} ${formData.topBannerRadiusBottom ? '6px' : '0'} ${formData.topBannerRadiusBottom ? '6px' : '0'}`, transition: 'all 0.3s ease', overflow: 'hidden', background: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
import.meta.env.VITE_BACKEND_URL                              {renderPreview(formData.topBannerUrl)}
import.meta.env.VITE_BACKEND_URL                           </div>
import.meta.env.VITE_BACKEND_URL                         </div>
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                     ) : (
import.meta.env.VITE_BACKEND_URL                        <div style={{ height: 80, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Introdu url-ul campaniei.</div>
import.meta.env.VITE_BACKEND_URL                     )}
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 <div style={{ marginTop: 24, padding: 20, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
import.meta.env.VITE_BACKEND_URL                   <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Configurare Vizuală (Design)</h4>
import.meta.env.VITE_BACKEND_URL                   
import.meta.env.VITE_BACKEND_URL                   <div style={{ marginBottom: 20 }}>
import.meta.env.VITE_BACKEND_URL                     <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
import.meta.env.VITE_BACKEND_URL                       <span>Înălțime Banner</span>
import.meta.env.VITE_BACKEND_URL                       <span style={{ color: 'var(--text)' }}>Nivel {formData.topBannerHeight} (din 5)</span>
import.meta.env.VITE_BACKEND_URL                     </label>
import.meta.env.VITE_BACKEND_URL                     <input 
import.meta.env.VITE_BACKEND_URL                       type="range" min="1" max="5" step="1"
import.meta.env.VITE_BACKEND_URL                       value={formData.topBannerHeight} 
import.meta.env.VITE_BACKEND_URL                       onChange={e => handleChange('topBannerHeight', parseInt(e.target.value))}
import.meta.env.VITE_BACKEND_URL                       style={{ width: '100%', cursor: 'pointer' }}
import.meta.env.VITE_BACKEND_URL                     />
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
import.meta.env.VITE_BACKEND_URL                       <span>Subțire (10%)</span>
import.meta.env.VITE_BACKEND_URL                       <span>Lat (30%)</span>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                   <div style={{ display: 'flex', gap: 16 }}>
import.meta.env.VITE_BACKEND_URL                     <label className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
import.meta.env.VITE_BACKEND_URL                       <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Colțuri Sus Rotunde</span>
import.meta.env.VITE_BACKEND_URL                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
import.meta.env.VITE_BACKEND_URL                         <input type="checkbox" checked={formData.topBannerRadiusTop} onChange={e => handleChange('topBannerRadiusTop', e.target.checked)} />
import.meta.env.VITE_BACKEND_URL                         <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                     </label>
import.meta.env.VITE_BACKEND_URL                     <label className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
import.meta.env.VITE_BACKEND_URL                       <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Colțuri Jos Rotunde</span>
import.meta.env.VITE_BACKEND_URL                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
import.meta.env.VITE_BACKEND_URL                         <input type="checkbox" checked={formData.topBannerRadiusBottom} onChange={e => handleChange('topBannerRadiusBottom', e.target.checked)} />
import.meta.env.VITE_BACKEND_URL                         <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                     </label>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL              </div>
import.meta.env.VITE_BACKEND_URL           )}
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Card: Banner Promo (Footer) */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
import.meta.env.VITE_BACKEND_URL             <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Banner Promo (Footer / Jos)</h3>
import.meta.env.VITE_BACKEND_URL             <label className="pc-toggle" style={{ margin: 0 }}>
import.meta.env.VITE_BACKEND_URL               <input type="checkbox" checked={useBottomBanner} onChange={e => setUseBottomBanner(e.target.checked)} />
import.meta.env.VITE_BACKEND_URL               <span className="toggle-slider" />
import.meta.env.VITE_BACKEND_URL             </label>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Apare în partea de jos a ecranului (sub meniu). Suportă Link Video/Imagine sau Text lung editabil.</p>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           {useBottomBanner && (
import.meta.env.VITE_BACKEND_URL              <div style={{ animation: 'fadeIn 0.3s ease' }}>
import.meta.env.VITE_BACKEND_URL                 
import.meta.env.VITE_BACKEND_URL                 <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text)', fontWeight: 700 }}>1. Reclamă (Video / Imagine)</h4>
import.meta.env.VITE_BACKEND_URL                 <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>MP4, WebM, imagine — se afișează pe toată înălțimea banerului de jos</p>
import.meta.env.VITE_BACKEND_URL                 <input 
import.meta.env.VITE_BACKEND_URL                   type="url" 
import.meta.env.VITE_BACKEND_URL                   className="pc-input" 
import.meta.env.VITE_BACKEND_URL                   placeholder="https://... URL video MP4 sau imagine"
import.meta.env.VITE_BACKEND_URL                   value={formData.bottomBannerUrl || ''}
import.meta.env.VITE_BACKEND_URL                   onChange={e => handleChange('bottomBannerUrl', e.target.value)}
import.meta.env.VITE_BACKEND_URL                   style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: formData.bottomBannerUrl ? 12 : 20, boxSizing: 'border-box' }}
import.meta.env.VITE_BACKEND_URL                 />
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text)', fontWeight: 700 }}>2. Text Derulant</h4>
import.meta.env.VITE_BACKEND_URL                 <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Apare deasupra reclamei (overlay) sau singur dacă nu e reclamă</p>
import.meta.env.VITE_BACKEND_URL                 <textarea 
import.meta.env.VITE_BACKEND_URL                   className="pc-input" 
import.meta.env.VITE_BACKEND_URL                   placeholder="Ex: Burger SmashMe -20% azi! Gratis cartofi la orice combo!"
import.meta.env.VITE_BACKEND_URL                   value={formData.bottomBannerText || ''}
import.meta.env.VITE_BACKEND_URL                   onChange={e => handleChange('bottomBannerText', e.target.value)}
import.meta.env.VITE_BACKEND_URL                   style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', width: '100%', marginBottom: 12, boxSizing: 'border-box', minHeight: 70, resize: 'vertical' }}
import.meta.env.VITE_BACKEND_URL                 />
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 {/* Text appearance options */}
import.meta.env.VITE_BACKEND_URL                 {(formData.bottomBannerText || '').length > 0 && (
import.meta.env.VITE_BACKEND_URL                   <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16, padding: 16, background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
import.meta.env.VITE_BACKEND_URL                     
import.meta.env.VITE_BACKEND_URL                     {/* Mode: Fix / Rulant */}
import.meta.env.VITE_BACKEND_URL                     <div>
import.meta.env.VITE_BACKEND_URL                       <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted,#475569)', display: 'block', marginBottom: 8 }}>MOD AFIȘARE TEXT</label>
import.meta.env.VITE_BACKEND_URL                       <div style={{ display: 'flex', gap: 6 }}>
import.meta.env.VITE_BACKEND_URL                         {[['false', 'Rulant (scroll)'], ['true', 'Fix (static)']].map(([val, lbl]) => {
import.meta.env.VITE_BACKEND_URL                           const isActive = String(formData.bottomBannerTextFixed) === val;
import.meta.env.VITE_BACKEND_URL                           return (
import.meta.env.VITE_BACKEND_URL                             <button key={val} type="button"
import.meta.env.VITE_BACKEND_URL                               onClick={() => handleChange('bottomBannerTextFixed', val === 'true')}
import.meta.env.VITE_BACKEND_URL                               style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${isActive ? '#0f172a' : '#cbd5e1'}`, background: isActive ? '#0f172a' : 'var(--surface,#fff)', color: isActive ? '#fff' : 'var(--text-muted,#475569)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
import.meta.env.VITE_BACKEND_URL                             >{lbl}</button>
import.meta.env.VITE_BACKEND_URL                           );
import.meta.env.VITE_BACKEND_URL                         })}
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                     {/* Position */}
import.meta.env.VITE_BACKEND_URL                     <div>
import.meta.env.VITE_BACKEND_URL                       <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>POZIȚIE TEXT</label>
import.meta.env.VITE_BACKEND_URL                       <div style={{ display: 'flex', gap: 6 }}>
import.meta.env.VITE_BACKEND_URL                         {[['left', 'Stanga'], ['center', 'Centru'], ['right', 'Dreapta']].map(([val, lbl]) => (
import.meta.env.VITE_BACKEND_URL                           <button key={val} type="button"
import.meta.env.VITE_BACKEND_URL                             onClick={() => handleChange('bottomBannerTextAlign', val)}
import.meta.env.VITE_BACKEND_URL                             style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${formData.bottomBannerTextAlign === val ? '#0f172a' : '#cbd5e1'}`, background: formData.bottomBannerTextAlign === val ? '#0f172a' : '#fff', color: formData.bottomBannerTextAlign === val ? '#fff' : '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
import.meta.env.VITE_BACKEND_URL                           >{lbl}</button>
import.meta.env.VITE_BACKEND_URL                         ))}
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                     {/* Background color */}
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
import.meta.env.VITE_BACKEND_URL                       <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>CULOARE FUNDAL</label>
import.meta.env.VITE_BACKEND_URL                       <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
import.meta.env.VITE_BACKEND_URL                         <input type="color" value={formData.bottomBannerBg} onChange={e => handleChange('bottomBannerBg', e.target.value)}
import.meta.env.VITE_BACKEND_URL                           style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
import.meta.env.VITE_BACKEND_URL                         {['#1e293b','#d32f2f','#1a237e','#004d40','#4a148c','#e65100','#212121','#ffffff'].map(c => (
import.meta.env.VITE_BACKEND_URL                           <button key={c} type="button" onClick={() => handleChange('bottomBannerBg', c)}
import.meta.env.VITE_BACKEND_URL                             style={{ width: 26, height: 26, borderRadius: 6, background: c, border: formData.bottomBannerBg === c ? '3px solid #0f172a' : '2px solid #e2e8f0', cursor: 'pointer', flexShrink: 0 }} />
import.meta.env.VITE_BACKEND_URL                         ))}
import.meta.env.VITE_BACKEND_URL                         <input type="text" value={formData.bottomBannerBg} onChange={e => handleChange('bottomBannerBg', e.target.value)}
import.meta.env.VITE_BACKEND_URL                           style={{ width: 80, fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontFamily: 'monospace' }} />
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                     {/* Logo URL */}
import.meta.env.VITE_BACKEND_URL                     <div>
import.meta.env.VITE_BACKEND_URL                       <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>LOGO PNG (opțional, poți pune un URL sau poți face upload)</label>
import.meta.env.VITE_BACKEND_URL                       <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
import.meta.env.VITE_BACKEND_URL                         <input type="text" value={formData.bottomBannerLogoUrl || ''} onChange={e => handleChange('bottomBannerLogoUrl', e.target.value)}
import.meta.env.VITE_BACKEND_URL                           placeholder="https://... URL imagine PNG/SVG"
import.meta.env.VITE_BACKEND_URL                           style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
import.meta.env.VITE_BACKEND_URL                         <label style={{ cursor: 'pointer', background: '#f1f5f9', color: '#0f172a', padding: '8px 16px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, border: '1px solid #cbd5e1', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
import.meta.env.VITE_BACKEND_URL                           + Upload
import.meta.env.VITE_BACKEND_URL                           <input type="file" accept="image/png, image/jpeg, image/svg+xml, image/webp" style={{ display: 'none' }} onChange={e => {
import.meta.env.VITE_BACKEND_URL                             const file = e.target.files?.[0];
import.meta.env.VITE_BACKEND_URL                             if (!file) return;
import.meta.env.VITE_BACKEND_URL                             if (file.size > 2 * 1024 * 1024) {
import.meta.env.VITE_BACKEND_URL                               alert('Se permit maxim 2MB pentru un logo base64 ca să nu încetinim tableta. Găsește o variantă mai micșorată.');
import.meta.env.VITE_BACKEND_URL                               return;
import.meta.env.VITE_BACKEND_URL                             }
import.meta.env.VITE_BACKEND_URL                             const reader = new FileReader();
import.meta.env.VITE_BACKEND_URL                             reader.onload = (ev) => {
import.meta.env.VITE_BACKEND_URL                               handleChange('bottomBannerLogoUrl', ev.target.result);
import.meta.env.VITE_BACKEND_URL                             };
import.meta.env.VITE_BACKEND_URL                             reader.readAsDataURL(file);
import.meta.env.VITE_BACKEND_URL                           }} />
import.meta.env.VITE_BACKEND_URL                         </label>
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                       {formData.bottomBannerLogoUrl && (
import.meta.env.VITE_BACKEND_URL                         <img src={formData.bottomBannerLogoUrl} alt="logo preview" style={{ height: 32, marginTop: 8, borderRadius: 4, objectFit: 'contain', border: '1px solid var(--border)', background: formData.bottomBannerBg, padding: '4px 8px' }} />
import.meta.env.VITE_BACKEND_URL                       )}
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 )}
import.meta.env.VITE_BACKEND_URL                 
import.meta.env.VITE_BACKEND_URL                 {/* BOTTOM BANNER SIMULATOR */}
import.meta.env.VITE_BACKEND_URL                 <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 8, flexDirection: 'column', alignItems: 'center' }}>
import.meta.env.VITE_BACKEND_URL                   <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>PREVIEW KIOSK DISPLAY (9:16)</span>
import.meta.env.VITE_BACKEND_URL                   <div style={{ width: 135, height: 240, borderRadius: 12, overflow: 'hidden', border: '6px solid #1e293b', background: '#e2e8f0', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
import.meta.env.VITE_BACKEND_URL                     <div style={{ position: 'absolute', inset: 0, padding: '4px' }}>
import.meta.env.VITE_BACKEND_URL                       <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
import.meta.env.VITE_BACKEND_URL                       <div style={{ width: '100%', height: '30%', background: '#cbd5e1', borderRadius: '4px', marginBottom: '4px' }} />
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                     
import.meta.env.VITE_BACKEND_URL                     <div style={{ 
import.meta.env.VITE_BACKEND_URL                       position: 'absolute', bottom: 0, left: 0, right: 0,
import.meta.env.VITE_BACKEND_URL                       height: `${10 + ((formData.bottomBannerHeight || 1) - 1) * 5}%`, 
import.meta.env.VITE_BACKEND_URL                       borderRadius: `${formData.bottomBannerRadiusTop ? '6px' : '0'} ${formData.bottomBannerRadiusTop ? '6px' : '0'} ${formData.bottomBannerRadiusBottom ? '6px' : '0'} ${formData.bottomBannerRadiusBottom ? '6px' : '0'}`,
import.meta.env.VITE_BACKEND_URL                       transition: 'all 0.3s ease',
import.meta.env.VITE_BACKEND_URL                       overflow: 'hidden', background: formData.bottomBannerBg || '#000', boxShadow: '0 -4px 12px rgba(0,0,0,0.2)',
import.meta.env.VITE_BACKEND_URL                       display: 'flex', flexDirection: 'column', justifyContent: 'center'
import.meta.env.VITE_BACKEND_URL                     }}>
import.meta.env.VITE_BACKEND_URL                        {formData.bottomBannerUrl && (
import.meta.env.VITE_BACKEND_URL                          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
import.meta.env.VITE_BACKEND_URL                            {renderPreview(formData.bottomBannerUrl)}
import.meta.env.VITE_BACKEND_URL                          </div>
import.meta.env.VITE_BACKEND_URL                        )}
import.meta.env.VITE_BACKEND_URL                        {formData.bottomBannerText && (
import.meta.env.VITE_BACKEND_URL                          <div style={{ 
import.meta.env.VITE_BACKEND_URL                            position: 'relative', zIndex: 2, padding: '4px 6px', 
import.meta.env.VITE_BACKEND_URL                            display: 'flex', alignItems: 'center', gap: '4px',
import.meta.env.VITE_BACKEND_URL                            justifyContent: formData.bottomBannerTextAlign === 'center' ? 'center' : formData.bottomBannerTextAlign === 'right' ? 'flex-end' : 'flex-start',
import.meta.env.VITE_BACKEND_URL                            background: formData.bottomBannerUrl ? 'rgba(0,0,0,0.45)' : 'transparent',
import.meta.env.VITE_BACKEND_URL                            height: '100%', width: '100%', boxSizing: 'border-box'
import.meta.env.VITE_BACKEND_URL                          }}>
import.meta.env.VITE_BACKEND_URL                            {formData.bottomBannerLogoUrl && <img src={formData.bottomBannerLogoUrl} style={{ height: '60%', objectFit: 'contain' }} alt="Logo" />}
import.meta.env.VITE_BACKEND_URL                            <div style={{ color: ['#ffffff', '#f8fafc'].includes(formData.bottomBannerBg) && !formData.bottomBannerUrl ? '#0f172a' : '#fff', fontSize: '5px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden' }}>
import.meta.env.VITE_BACKEND_URL                               {formData.bottomBannerText}
import.meta.env.VITE_BACKEND_URL                            </div>
import.meta.env.VITE_BACKEND_URL                          </div>
import.meta.env.VITE_BACKEND_URL                        )}
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                 <div style={{ marginTop: 24, padding: 20, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
import.meta.env.VITE_BACKEND_URL                   <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Configurare Vizuală (Design)</h4>
import.meta.env.VITE_BACKEND_URL                   
import.meta.env.VITE_BACKEND_URL                   <div style={{ marginBottom: 20 }}>
import.meta.env.VITE_BACKEND_URL                     <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
import.meta.env.VITE_BACKEND_URL                       <span>Înălțime Banner</span>
import.meta.env.VITE_BACKEND_URL                       <span style={{ color: 'var(--text)' }}>Nivel {formData.bottomBannerHeight} (din 5)</span>
import.meta.env.VITE_BACKEND_URL                     </label>
import.meta.env.VITE_BACKEND_URL                     <input 
import.meta.env.VITE_BACKEND_URL                       type="range" min="1" max="5" step="1"
import.meta.env.VITE_BACKEND_URL                       value={formData.bottomBannerHeight} 
import.meta.env.VITE_BACKEND_URL                       onChange={e => handleChange('bottomBannerHeight', parseInt(e.target.value))}
import.meta.env.VITE_BACKEND_URL                       style={{ width: '100%', cursor: 'pointer' }}
import.meta.env.VITE_BACKEND_URL                     />
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
import.meta.env.VITE_BACKEND_URL                       <span>Subțire (10%)</span>
import.meta.env.VITE_BACKEND_URL                       <span>Lat (30%)</span>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                   <div style={{ display: 'flex', gap: 16 }}>
import.meta.env.VITE_BACKEND_URL                     <label className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
import.meta.env.VITE_BACKEND_URL                       <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Colțuri Sus Rotunde</span>
import.meta.env.VITE_BACKEND_URL                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
import.meta.env.VITE_BACKEND_URL                         <input type="checkbox" checked={formData.bottomBannerRadiusTop} onChange={e => handleChange('bottomBannerRadiusTop', e.target.checked)} />
import.meta.env.VITE_BACKEND_URL                         <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                     </label>
import.meta.env.VITE_BACKEND_URL                     <label className="pc-toggle" style={{ margin: 0, flex: 1, background: 'var(--surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
import.meta.env.VITE_BACKEND_URL                       <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Colțuri Jos Rotunde</span>
import.meta.env.VITE_BACKEND_URL                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
import.meta.env.VITE_BACKEND_URL                         <input type="checkbox" checked={formData.bottomBannerRadiusBottom} onChange={e => handleChange('bottomBannerRadiusBottom', e.target.checked)} />
import.meta.env.VITE_BACKEND_URL                         <span className="toggle-slider" style={{ position: 'relative', display: 'inline-block' }} />
import.meta.env.VITE_BACKEND_URL                       </div>
import.meta.env.VITE_BACKEND_URL                     </label>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL              </div>
import.meta.env.VITE_BACKEND_URL           )}
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Card: Personalizare Meniu */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL           <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>Personalizare Meniu Kiosk</h3>
import.meta.env.VITE_BACKEND_URL           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
import.meta.env.VITE_BACKEND_URL             Configează profilul de meniu pe care îl preia acest Kiosk pentru fiecare brand activ, sau editează vizibilitatea produselor strict pe această tabletă.
import.meta.env.VITE_BACKEND_URL           </p>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
import.meta.env.VITE_BACKEND_URL             {activeBrands.map(brandId => {
import.meta.env.VITE_BACKEND_URL                const bData = brandProfiles[brandId];
import.meta.env.VITE_BACKEND_URL                if (!bData) return null;
import.meta.env.VITE_BACKEND_URL                
import.meta.env.VITE_BACKEND_URL                const brandOverrides = formData.menuOverrides[brandId] || {};
import.meta.env.VITE_BACKEND_URL                const currentProfileId = brandOverrides.profileId || '';
import.meta.env.VITE_BACKEND_URL                const localHiddenCount = Object.keys(brandOverrides.hiddenItems || {}).length;
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                return (
import.meta.env.VITE_BACKEND_URL                  <div key={brandId} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
import.meta.env.VITE_BACKEND_URL                       <BrandLogo brandId={brandId} size={24} />
import.meta.env.VITE_BACKEND_URL                       <strong style={{ fontSize: '1.05rem', color: 'var(--text)' }}>Meniu {bData.brand.name}</strong>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
import.meta.env.VITE_BACKEND_URL                        <div style={{ flex: 1, minWidth: '220px' }}>
import.meta.env.VITE_BACKEND_URL                           <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Aplică un Șablon Global</label>
import.meta.env.VITE_BACKEND_URL                           <select 
import.meta.env.VITE_BACKEND_URL                             className="pc-input"
import.meta.env.VITE_BACKEND_URL                             value={currentProfileId}
import.meta.env.VITE_BACKEND_URL                             onChange={(e) => {
import.meta.env.VITE_BACKEND_URL                                const newOverrides = { ...formData.menuOverrides };
import.meta.env.VITE_BACKEND_URL                                if (!newOverrides[brandId]) newOverrides[brandId] = { hiddenItems: {} };
import.meta.env.VITE_BACKEND_URL                                newOverrides[brandId] = { ...newOverrides[brandId], profileId: e.target.value };
import.meta.env.VITE_BACKEND_URL                                handleChange('menuOverrides', newOverrides);
import.meta.env.VITE_BACKEND_URL                             }}
import.meta.env.VITE_BACKEND_URL                             style={{ padding: '10px 14px', borderRadius: 30, border: '1px solid var(--border)', width: '100%', outline: 'none', background: '#fff', fontSize: '0.9rem' }}
import.meta.env.VITE_BACKEND_URL                           >
import.meta.env.VITE_BACKEND_URL                             <option value="">Afișează Meniul Complet (Implicit)</option>
import.meta.env.VITE_BACKEND_URL                             {bData.profiles.map(p => (
import.meta.env.VITE_BACKEND_URL                                <option key={p.id} value={p.id}>{p.name} ({Object.keys(p.hiddenItems || {}).length} ascunse)</option>
import.meta.env.VITE_BACKEND_URL                             ))}
import.meta.env.VITE_BACKEND_URL                           </select>
import.meta.env.VITE_BACKEND_URL                        </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                        <div style={{ flex: 1, minWidth: '220px' }}>
import.meta.env.VITE_BACKEND_URL                           <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Suprascriere Manuală Kiosk</label>
import.meta.env.VITE_BACKEND_URL                           <button 
import.meta.env.VITE_BACKEND_URL                             className="um-btn"
import.meta.env.VITE_BACKEND_URL                             onClick={() => {
import.meta.env.VITE_BACKEND_URL                                const overrides = formData.menuOverrides[brandId] || { hiddenItems: {} };
import.meta.env.VITE_BACKEND_URL                                const profile = bData.profiles.find(p => p.id === overrides.profileId) || { name: 'Meniu Complet (Fără Șablon)', rootFolderId: null, hiddenItems: {} };
import.meta.env.VITE_BACKEND_URL                                setEditingMenuBrand({
import.meta.env.VITE_BACKEND_URL                                    brand: bData.brand,
import.meta.env.VITE_BACKEND_URL                                    profile,
import.meta.env.VITE_BACKEND_URL                                    localHiddenItemsOverride: overrides.hiddenItems || {}
import.meta.env.VITE_BACKEND_URL                                });
import.meta.env.VITE_BACKEND_URL                             }}
import.meta.env.VITE_BACKEND_URL                             style={{ padding: '10px 14px', borderRadius: 30, background: localHiddenCount > 0 ? '#eff6ff' : '#fff', color: localHiddenCount > 0 ? '#3b82f6' : 'var(--text)', border: `1px solid ${localHiddenCount > 0 ? '#3b82f6' : 'var(--border)'}`, width: '100%', display: 'flex', justifyContent: 'center', fontWeight: localHiddenCount > 0 ? 700 : 500 }}
import.meta.env.VITE_BACKEND_URL                           >
import.meta.env.VITE_BACKEND_URL                              Editează Vizibilitatea {localHiddenCount > 0 && `(${localHiddenCount} specifice)`}
import.meta.env.VITE_BACKEND_URL                           </button>
import.meta.env.VITE_BACKEND_URL                        </div>
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                  </div>
import.meta.env.VITE_BACKEND_URL                );
import.meta.env.VITE_BACKEND_URL             })}
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL     </div>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL /* ─── LOCATIONS MANAGER ──────────────────────────────────── */
import.meta.env.VITE_BACKEND_URL const BRAND_LABELS = { smashme: 'SmashMe', sushimaster: 'Sushi Master', ikura: 'Ikura', welovesushi: 'WeLoveSushi' };
import.meta.env.VITE_BACKEND_URL const BRAND_PILL_COLORS = { smashme: '#ef4444', sushimaster: '#3b82f6', ikura: '#8b5cf6', welovesushi: '#ec4899' };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL function LocationsManager({ backend }) { 
import.meta.env.VITE_BACKEND_URL   const { fetchWithAuth } = useAuth();
import.meta.env.VITE_BACKEND_URL   const [locations, setLocations] = useState([]);
import.meta.env.VITE_BACKEND_URL   const [loading, setLoading] = useState(true);
import.meta.env.VITE_BACKEND_URL   const [showAdd, setShowAdd] = useState(false);
import.meta.env.VITE_BACKEND_URL   const [editingLoc, setEditingLoc] = useState(null);
import.meta.env.VITE_BACKEND_URL   const [newName, setNewName] = useState('');
import.meta.env.VITE_BACKEND_URL   const [newBrands, setNewBrands] = useState([]);
import.meta.env.VITE_BACKEND_URL   const [newTables, setNewTables] = useState(10);
import.meta.env.VITE_BACKEND_URL   const [filter, setFilter] = useState('all');
import.meta.env.VITE_BACKEND_URL   const [currentPage, setCurrentPage] = useState(1);
import.meta.env.VITE_BACKEND_URL   const [itemsPerPage, setItemsPerPage] = useState(10);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const fetchLocs = () => {
import.meta.env.VITE_BACKEND_URL     setLoading(true);
import.meta.env.VITE_BACKEND_URL     fetchWithAuth(`${backend}/api/locations`)
import.meta.env.VITE_BACKEND_URL       .then(r => r.json())
import.meta.env.VITE_BACKEND_URL       .then(d => { setLocations(d.locations || []); setLoading(false); })
import.meta.env.VITE_BACKEND_URL       .catch(() => setLoading(false));
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL   useEffect(fetchLocs, [backend]);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const toggleBrand = (b) => {
import.meta.env.VITE_BACKEND_URL     setNewBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const createLocation = () => {
import.meta.env.VITE_BACKEND_URL     if (!newName.trim()) return;
import.meta.env.VITE_BACKEND_URL     fetchWithAuth(`${backend}/api/locations`, {
import.meta.env.VITE_BACKEND_URL       method: 'POST',
import.meta.env.VITE_BACKEND_URL       headers: { 'Content-Type': 'application/json' },
import.meta.env.VITE_BACKEND_URL       body: JSON.stringify({ name: newName, brands: newBrands, tables: newTables }),
import.meta.env.VITE_BACKEND_URL     })
import.meta.env.VITE_BACKEND_URL       .then(r => r.json())
import.meta.env.VITE_BACKEND_URL       .then(() => { setNewName(''); setNewBrands([]); setNewTables(10); setShowAdd(false); fetchLocs(); });
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const toggleActive = (loc) => {
import.meta.env.VITE_BACKEND_URL     fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
import.meta.env.VITE_BACKEND_URL       method: 'PUT',
import.meta.env.VITE_BACKEND_URL       headers: { 'Content-Type': 'application/json' },
import.meta.env.VITE_BACKEND_URL       body: JSON.stringify({ active: !loc.active }),
import.meta.env.VITE_BACKEND_URL     }).then(() => fetchLocs());
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const deleteLoc = (id) => {
import.meta.env.VITE_BACKEND_URL     if (!confirm('Stergi aceasta locatie?')) return;
import.meta.env.VITE_BACKEND_URL     fetchWithAuth(`${backend}/api/locations/${id}`, { method: 'DELETE' })
import.meta.env.VITE_BACKEND_URL       .then(() => fetchLocs());
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const filtered = filter === 'all' ? locations : locations.filter(l => l.brands?.includes(filter));
import.meta.env.VITE_BACKEND_URL   const sorted = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
import.meta.env.VITE_BACKEND_URL   const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
import.meta.env.VITE_BACKEND_URL   const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const handleFilterChange = (f) => { setFilter(f); setCurrentPage(1); };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   if (loading) return <p style={{color:'var(--text-muted)'}}>Se incarca...</p>;
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   if (editingLoc) {
import.meta.env.VITE_BACKEND_URL     return <LocationEditForm loc={editingLoc} backend={backend} onBack={() => setEditingLoc(null)} onSave={fetchLocs} />;
import.meta.env.VITE_BACKEND_URL   }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <div className="loc-manager">
import.meta.env.VITE_BACKEND_URL       {/* Filters Add button */}
import.meta.env.VITE_BACKEND_URL       <div className="loc-controls">
import.meta.env.VITE_BACKEND_URL         <div className="loc-filters">
import.meta.env.VITE_BACKEND_URL           <button className={`loc-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => handleFilterChange('all')}>
import.meta.env.VITE_BACKEND_URL             Toate ({locations.length})
import.meta.env.VITE_BACKEND_URL           </button>
import.meta.env.VITE_BACKEND_URL           {Object.entries(BRAND_LABELS).map(([k, v]) => {
import.meta.env.VITE_BACKEND_URL             const count = locations.filter(l => l.brands?.includes(k)).length;
import.meta.env.VITE_BACKEND_URL             if (!count) return null;
import.meta.env.VITE_BACKEND_URL             return (
import.meta.env.VITE_BACKEND_URL               <button
import.meta.env.VITE_BACKEND_URL                 key={k}
import.meta.env.VITE_BACKEND_URL                 className={`loc-filter-btn ${filter === k ? 'active' : ''}`}
import.meta.env.VITE_BACKEND_URL                 style={{ '--pill-color': BRAND_PILL_COLORS[k], display: 'flex', alignItems: 'center', gap: '6px' }}
import.meta.env.VITE_BACKEND_URL                 onClick={() => handleFilterChange(k)}
import.meta.env.VITE_BACKEND_URL               >
import.meta.env.VITE_BACKEND_URL                 <BrandLogo brandId={k} size={14} /> {v} ({count})
import.meta.env.VITE_BACKEND_URL               </button>
import.meta.env.VITE_BACKEND_URL             );
import.meta.env.VITE_BACKEND_URL           })}
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL         <button className="loc-add-btn" onClick={() => setShowAdd(!showAdd)}>Adauga locatie</button>
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       {/* Add form */}
import.meta.env.VITE_BACKEND_URL       {showAdd && (
import.meta.env.VITE_BACKEND_URL         <div className="loc-add-form">
import.meta.env.VITE_BACKEND_URL           <input
import.meta.env.VITE_BACKEND_URL             type="text"
import.meta.env.VITE_BACKEND_URL             placeholder="Nume locatie (ex: SM Brasov)"
import.meta.env.VITE_BACKEND_URL             value={newName}
import.meta.env.VITE_BACKEND_URL             onChange={e => setNewName(e.target.value)}
import.meta.env.VITE_BACKEND_URL             className="loc-input"
import.meta.env.VITE_BACKEND_URL           />
import.meta.env.VITE_BACKEND_URL           <div className="loc-brand-select">
import.meta.env.VITE_BACKEND_URL             {Object.entries(BRAND_LABELS).map(([k, v]) => (
import.meta.env.VITE_BACKEND_URL               <button
import.meta.env.VITE_BACKEND_URL                 key={k}
import.meta.env.VITE_BACKEND_URL                 className={`loc-brand-pill ${newBrands.includes(k) ? 'active' : ''}`}
import.meta.env.VITE_BACKEND_URL                 style={{ '--pill-color': BRAND_PILL_COLORS[k], display: 'flex', alignItems: 'center', gap: '6px' }}
import.meta.env.VITE_BACKEND_URL                 onClick={() => toggleBrand(k)}
import.meta.env.VITE_BACKEND_URL               ><BrandLogo brandId={k} size={14} /> {v}</button>
import.meta.env.VITE_BACKEND_URL             ))}
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL           <input
import.meta.env.VITE_BACKEND_URL             type="number"
import.meta.env.VITE_BACKEND_URL             min="1" max="100"
import.meta.env.VITE_BACKEND_URL             value={newTables}
import.meta.env.VITE_BACKEND_URL             onChange={e => setNewTables(Number(e.target.value))}
import.meta.env.VITE_BACKEND_URL             className="loc-input loc-input-sm"
import.meta.env.VITE_BACKEND_URL             placeholder="Nr. mese"
import.meta.env.VITE_BACKEND_URL           />
import.meta.env.VITE_BACKEND_URL           <button className="loc-save-btn" onClick={createLocation}>Salveaza</button>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL       )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       {/* Locations table */}
import.meta.env.VITE_BACKEND_URL       <div className="loc-list-container" style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.04)', marginTop: '24px' }}>
import.meta.env.VITE_BACKEND_URL         <table className="loc-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
import.meta.env.VITE_BACKEND_URL           <thead>
import.meta.env.VITE_BACKEND_URL             <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '14px 16px', fontWeight: 600 }}>#</th>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '14px 16px', fontWeight: 600 }}>Nume Locație</th>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '14px 16px', fontWeight: 600 }}>Branduri Active</th>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '14px 16px', fontWeight: 600 }}>Statistici</th>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '14px 16px', fontWeight: 600 }}>Stare</th>
import.meta.env.VITE_BACKEND_URL               <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Acțiuni</th>
import.meta.env.VITE_BACKEND_URL             </tr>
import.meta.env.VITE_BACKEND_URL           </thead>
import.meta.env.VITE_BACKEND_URL           <tbody>
import.meta.env.VITE_BACKEND_URL             {paginated.map((loc, index) => (
import.meta.env.VITE_BACKEND_URL               <tr key={loc.id} style={{ borderBottom: '1px solid var(--border)', opacity: loc.active ? 1 : 0.6, cursor: 'pointer' }} onClick={() => setEditingLoc(loc)} className="loc-list-row">
import.meta.env.VITE_BACKEND_URL                 <td style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
import.meta.env.VITE_BACKEND_URL                   {(currentPage - 1) * itemsPerPage + index + 1}
import.meta.env.VITE_BACKEND_URL                 </td>
import.meta.env.VITE_BACKEND_URL                 <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text)', fontSize: '1rem' }}>
import.meta.env.VITE_BACKEND_URL                   {loc.name}
import.meta.env.VITE_BACKEND_URL                   <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: 4 }}>ID: {loc.id}</div>
import.meta.env.VITE_BACKEND_URL                 </td>
import.meta.env.VITE_BACKEND_URL                 <td style={{ padding: '16px' }}>
import.meta.env.VITE_BACKEND_URL                   <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
import.meta.env.VITE_BACKEND_URL                     {(loc.brands || []).map(b => <BrandLogo key={b} brandId={b} size={24} />)}
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 </td>
import.meta.env.VITE_BACKEND_URL                 <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
import.meta.env.VITE_BACKEND_URL                   <div style={{ display: 'flex', gap: 12 }}>
import.meta.env.VITE_BACKEND_URL                     <span style={{ background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 6 }}>Mese: {loc.tables || 0}</span>
import.meta.env.VITE_BACKEND_URL                     <span style={{ background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 6 }}>Kiosk-uri: {(loc.kiosks || []).length}</span>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 </td>
import.meta.env.VITE_BACKEND_URL                 <td style={{ padding: '16px' }} onClick={(e) => e.stopPropagation()}>
import.meta.env.VITE_BACKEND_URL                   <div 
import.meta.env.VITE_BACKEND_URL                     style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 6px' }} 
import.meta.env.VITE_BACKEND_URL                     onClick={() => toggleActive(loc)} 
import.meta.env.VITE_BACKEND_URL                     title={loc.active ? 'Acum e LIVE (Apasă pentru dezactivare)' : 'Inactiv (Apasă pentru activare)'}
import.meta.env.VITE_BACKEND_URL                   >
import.meta.env.VITE_BACKEND_URL                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: loc.active ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 </td>
import.meta.env.VITE_BACKEND_URL                 <td style={{ padding: '16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
import.meta.env.VITE_BACKEND_URL                   <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
import.meta.env.VITE_BACKEND_URL                     <button 
import.meta.env.VITE_BACKEND_URL                       title="Configurare locație"
import.meta.env.VITE_BACKEND_URL                       className="btn-business-icon"
import.meta.env.VITE_BACKEND_URL                       style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', width: 34, height: 34, padding: 0, borderRadius: '50%', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
import.meta.env.VITE_BACKEND_URL                       onClick={() => setEditingLoc(loc)}
import.meta.env.VITE_BACKEND_URL                     >
import.meta.env.VITE_BACKEND_URL                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
import.meta.env.VITE_BACKEND_URL                     </button>
import.meta.env.VITE_BACKEND_URL                     <button 
import.meta.env.VITE_BACKEND_URL                       title="Șterge definitiv locația"
import.meta.env.VITE_BACKEND_URL                       className="btn-business-icon"
import.meta.env.VITE_BACKEND_URL                       style={{ background: '#fee2e2', border: '1px solid #fca5a5', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
import.meta.env.VITE_BACKEND_URL                       onClick={() => deleteLoc(loc.id)}
import.meta.env.VITE_BACKEND_URL                     >
import.meta.env.VITE_BACKEND_URL                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
import.meta.env.VITE_BACKEND_URL                     </button>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 </td>
import.meta.env.VITE_BACKEND_URL               </tr>
import.meta.env.VITE_BACKEND_URL             ))}
import.meta.env.VITE_BACKEND_URL           </tbody>
import.meta.env.VITE_BACKEND_URL         </table>
import.meta.env.VITE_BACKEND_URL         {filtered.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>Nu există locații care să corespundă filtrelor.</div>}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Pagination */}
import.meta.env.VITE_BACKEND_URL         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
import.meta.env.VITE_BACKEND_URL             <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Rânduri pe pagină:</span>
import.meta.env.VITE_BACKEND_URL             <select
import.meta.env.VITE_BACKEND_URL               value={itemsPerPage}
import.meta.env.VITE_BACKEND_URL               onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
import.meta.env.VITE_BACKEND_URL               style={{ fontSize: '0.82rem', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}
import.meta.env.VITE_BACKEND_URL             >
import.meta.env.VITE_BACKEND_URL               {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
import.meta.env.VITE_BACKEND_URL             </select>
import.meta.env.VITE_BACKEND_URL             <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 8 }}>
import.meta.env.VITE_BACKEND_URL               {sorted.length === 0 ? '0' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(sorted.length, currentPage * itemsPerPage)}`} din {sorted.length}
import.meta.env.VITE_BACKEND_URL             </span>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', gap: 4 }}>
import.meta.env.VITE_BACKEND_URL             {[
import.meta.env.VITE_BACKEND_URL               { label: '«', action: () => setCurrentPage(1),           disabled: currentPage === 1,          title: 'Prima pagină' },
import.meta.env.VITE_BACKEND_URL               { label: '‹', action: () => setCurrentPage(p => p - 1), disabled: currentPage === 1,          title: 'Anterioară' },
import.meta.env.VITE_BACKEND_URL               { label: '›', action: () => setCurrentPage(p => p + 1), disabled: currentPage === totalPages, title: 'Următoarea' },
import.meta.env.VITE_BACKEND_URL               { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages, title: 'Ultima pagină' },
import.meta.env.VITE_BACKEND_URL             ].map(btn => (
import.meta.env.VITE_BACKEND_URL               <button key={btn.label} onClick={btn.action} disabled={btn.disabled} title={btn.title}
import.meta.env.VITE_BACKEND_URL                 style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', background: btn.disabled ? '#f1f5f9' : '#fff', color: btn.disabled ? '#cbd5e1' : '#334155', cursor: btn.disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
import.meta.env.VITE_BACKEND_URL               >{btn.label}</button>
import.meta.env.VITE_BACKEND_URL             ))}
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL     </div>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL // ─── LocationEditForm (Restored from Git History) ─────────────────────────────────
import.meta.env.VITE_BACKEND_URL function LocationEditForm({ loc, backend, onBack, onSave }) {
import.meta.env.VITE_BACKEND_URL   const [formData, setFormData] = useState({
import.meta.env.VITE_BACKEND_URL     name: loc.name || '',
import.meta.env.VITE_BACKEND_URL     brands: loc.brands || [],
import.meta.env.VITE_BACKEND_URL     orgIds: loc.orgIds || {},
import.meta.env.VITE_BACKEND_URL     tables: loc.tables || 0,
import.meta.env.VITE_BACKEND_URL     note: loc.note || '',
import.meta.env.VITE_BACKEND_URL   });
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const handleChange = (field, val) => setFormData(prev => ({ ...prev, [field]: val }));
import.meta.env.VITE_BACKEND_URL   
import.meta.env.VITE_BACKEND_URL   const handleOrgChange = (brandId, val) => {
import.meta.env.VITE_BACKEND_URL     setFormData(prev => ({ ...prev, orgIds: { ...prev.orgIds, [brandId]: val } }));
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const toggleBrand = (b) => {
import.meta.env.VITE_BACKEND_URL     setFormData(prev => {
import.meta.env.VITE_BACKEND_URL       const newBrands = prev.brands.includes(b) ? prev.brands.filter(x => x !== b) : [...prev.brands, b];
import.meta.env.VITE_BACKEND_URL       return { ...prev, brands: newBrands };
import.meta.env.VITE_BACKEND_URL     });
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const saveLoc = async () => {
import.meta.env.VITE_BACKEND_URL     await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
import.meta.env.VITE_BACKEND_URL       method: 'PUT',
import.meta.env.VITE_BACKEND_URL       headers: { 'Content-Type': 'application/json' },
import.meta.env.VITE_BACKEND_URL       body: JSON.stringify(formData)
import.meta.env.VITE_BACKEND_URL     });
import.meta.env.VITE_BACKEND_URL     onSave();
import.meta.env.VITE_BACKEND_URL     onBack();
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <div className="loc-edit-form fade-in">
import.meta.env.VITE_BACKEND_URL       <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
import.meta.env.VITE_BACKEND_URL         <button onClick={onBack}
import.meta.env.VITE_BACKEND_URL           style={{ padding: '8px 18px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
import.meta.env.VITE_BACKEND_URL           ← Înapoi
import.meta.env.VITE_BACKEND_URL         </button>
import.meta.env.VITE_BACKEND_URL         <div style={{ flex: 1 }}>
import.meta.env.VITE_BACKEND_URL           <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
import.meta.env.VITE_BACKEND_URL             {loc.name}
import.meta.env.VITE_BACKEND_URL           </h2>
import.meta.env.VITE_BACKEND_URL           <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Editare locație</p>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL         <button onClick={saveLoc}
import.meta.env.VITE_BACKEND_URL           style={{ padding: '11px 26px', borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(15,23,42,0.2)', flexShrink: 0 }}>
import.meta.env.VITE_BACKEND_URL           Salvează Modificările
import.meta.env.VITE_BACKEND_URL         </button>
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       <div className="loc-edit-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr)', gap: '24px', maxWidth: 800 }}>
import.meta.env.VITE_BACKEND_URL         {/* Card: Nume & Mese */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL           <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', marginBottom: 20 }}>Informații Generale</h3>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
import.meta.env.VITE_BACKEND_URL             <div>
import.meta.env.VITE_BACKEND_URL                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Nume Locație</label>
import.meta.env.VITE_BACKEND_URL                <input type="text" className="input-field" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', boxSizing: 'border-box', marginTop: 6 }} value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="Ex: SM Bacau" />
import.meta.env.VITE_BACKEND_URL             </div>
import.meta.env.VITE_BACKEND_URL             <div>
import.meta.env.VITE_BACKEND_URL                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Număr de Mese (Generate Kiosk/QR)</label>
import.meta.env.VITE_BACKEND_URL                <input type="number" className="input-field" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', boxSizing: 'border-box', marginTop: 6 }} value={formData.tables} onChange={e => handleChange('tables', parseInt(e.target.value)||0)} min="0" />
import.meta.env.VITE_BACKEND_URL             </div>
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Card: Branduri Asignate */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL           <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', marginBottom: 20 }}>Restaurante Active în Kiosk</h3>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
import.meta.env.VITE_BACKEND_URL             {Object.entries({smashme:'SmashMe',sushimaster:'Sushi Master',welovesushi:'WeLoveSushi',ikura:'Ikura'}).map(([k, v]) => {
import.meta.env.VITE_BACKEND_URL               const isActive = formData.brands.includes(k);
import.meta.env.VITE_BACKEND_URL               const pillColor = (BRAND_COLORS && BRAND_COLORS[k]) ? BRAND_COLORS[k] : '#64748b';
import.meta.env.VITE_BACKEND_URL               return (
import.meta.env.VITE_BACKEND_URL                 <button
import.meta.env.VITE_BACKEND_URL                   key={k}
import.meta.env.VITE_BACKEND_URL                   className={`loc-brand-pill ${isActive ? 'active' : ''}`}
import.meta.env.VITE_BACKEND_URL                   style={{ 
import.meta.env.VITE_BACKEND_URL                     padding: '10px 18px', borderRadius: '12px', 
import.meta.env.VITE_BACKEND_URL                     display: 'flex', alignItems: 'center', gap: '10px', 
import.meta.env.VITE_BACKEND_URL                     background: isActive ? pillColor : '#ffffff', 
import.meta.env.VITE_BACKEND_URL                     color: isActive ? '#fff' : '#334155', 
import.meta.env.VITE_BACKEND_URL                     border: isActive ? `2px solid ${pillColor}` : '2px solid #cbd5e1',
import.meta.env.VITE_BACKEND_URL                     boxShadow: isActive ? `0 4px 12px ${pillColor}50` : '0 2px 4px rgba(0,0,0,0.02)',
import.meta.env.VITE_BACKEND_URL                     fontWeight: 600, transition: 'all 0.2s', cursor: 'pointer',
import.meta.env.VITE_BACKEND_URL                     filter: isActive ? 'none' : 'grayscale(100%) opacity(0.8)'
import.meta.env.VITE_BACKEND_URL                   }}
import.meta.env.VITE_BACKEND_URL                   onClick={() => toggleBrand(k)}
import.meta.env.VITE_BACKEND_URL                 >
import.meta.env.VITE_BACKEND_URL                   <BrandLogo brandId={k} size={18} /> {v}
import.meta.env.VITE_BACKEND_URL                 </button>
import.meta.env.VITE_BACKEND_URL               );
import.meta.env.VITE_BACKEND_URL             })}
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL         {/* Card: Syrve API Keys */}
import.meta.env.VITE_BACKEND_URL         <div className="loc-edit-card" style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)' }}>
import.meta.env.VITE_BACKEND_URL           <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--text)', marginBottom: 8 }}>Setări Syrve (iiko) per locație</h3>
import.meta.env.VITE_BACKEND_URL           <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Dacă un brand folosește un `Organization ID` diferit față de cel global (din .env), pune-l aici pentru a trimite comenzile corect la POS-ul locației corespunzătoare.</p>
import.meta.env.VITE_BACKEND_URL           
import.meta.env.VITE_BACKEND_URL           <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
import.meta.env.VITE_BACKEND_URL              {formData.brands.map(bId => (
import.meta.env.VITE_BACKEND_URL                <div key={bId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
import.meta.env.VITE_BACKEND_URL                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Overide ID Organizație ({bId}):</label>
import.meta.env.VITE_BACKEND_URL                  <input type="text" className="input-field" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', boxSizing: 'border-box', marginTop: 6 }} value={formData.orgIds[bId] || ''} onChange={e => handleOrgChange(bId, e.target.value)} placeholder="Lăsați gol pentru ID-ul global" />
import.meta.env.VITE_BACKEND_URL                </div>
import.meta.env.VITE_BACKEND_URL              ))}
import.meta.env.VITE_BACKEND_URL              {formData.brands.length === 0 && <span style={{fontSize:'0.85rem', color:'var(--warning)'}}>Selectează măcar un brand pentru a seta suprascrieri de locație Syrve.</span>}
import.meta.env.VITE_BACKEND_URL           </div>
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL         
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL     </div>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL function BrandsManager({ backend }) {
import.meta.env.VITE_BACKEND_URL   const { fetchWithAuth } = useAuth();
import.meta.env.VITE_BACKEND_URL   const [brands, setBrands] = useState([]);
import.meta.env.VITE_BACKEND_URL   const [loading, setLoading] = useState(true);
import.meta.env.VITE_BACKEND_URL   const [editing, setEditing] = useState(null); // brandId being edited
import.meta.env.VITE_BACKEND_URL   const [form, setForm] = useState({});
import.meta.env.VITE_BACKEND_URL   const [saving, setSaving] = useState(false);
import.meta.env.VITE_BACKEND_URL   const [toast, setToast] = useState(null);
import.meta.env.VITE_BACKEND_URL   const [uploadingId, setUploadingId] = useState(null);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const showToast = (msg, type = 'success') => {
import.meta.env.VITE_BACKEND_URL     setToast({ msg, type });
import.meta.env.VITE_BACKEND_URL     setTimeout(() => setToast(null), 3500);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const fetchBrands = () => {
import.meta.env.VITE_BACKEND_URL     setLoading(true);
import.meta.env.VITE_BACKEND_URL     fetchWithAuth(`${backend}/api/brands`)
import.meta.env.VITE_BACKEND_URL       .then(r => r.json())
import.meta.env.VITE_BACKEND_URL       .then(d => { setBrands(d.brands || []); setLoading(false); })
import.meta.env.VITE_BACKEND_URL       .catch(() => setLoading(false));
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL   useEffect(fetchBrands, [backend]);
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const startEdit = (brand) => {
import.meta.env.VITE_BACKEND_URL     setEditing(brand.id);
import.meta.env.VITE_BACKEND_URL     setForm({ name: brand.name || '', description: brand.description || '', website: brand.website || '', logo_url: brand.logo_url || '' });
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const saveEdit = async () => {
import.meta.env.VITE_BACKEND_URL     setSaving(true);
import.meta.env.VITE_BACKEND_URL     try {
import.meta.env.VITE_BACKEND_URL       const res = await fetchWithAuth(`${backend}/api/brands/${editing}`, {
import.meta.env.VITE_BACKEND_URL         method: 'PUT',
import.meta.env.VITE_BACKEND_URL         headers: { 'Content-Type': 'application/json' },
import.meta.env.VITE_BACKEND_URL         body: JSON.stringify(form),
import.meta.env.VITE_BACKEND_URL       });
import.meta.env.VITE_BACKEND_URL       if (res.ok) { showToast('Brand salvat!'); fetchBrands(); setEditing(null); }
import.meta.env.VITE_BACKEND_URL       else showToast('Eroare la salvare', 'error');
import.meta.env.VITE_BACKEND_URL     } catch { showToast('Conexiune eșuată', 'error'); }
import.meta.env.VITE_BACKEND_URL     setSaving(false);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const handleLogoUpload = async (brandId, file) => {
import.meta.env.VITE_BACKEND_URL     if (!file) return;
import.meta.env.VITE_BACKEND_URL     setUploadingId(brandId);
import.meta.env.VITE_BACKEND_URL     const fd = new FormData();
import.meta.env.VITE_BACKEND_URL     fd.append('logo', file);
import.meta.env.VITE_BACKEND_URL     try {
import.meta.env.VITE_BACKEND_URL       const res = await fetchWithAuth(`${backend}/api/brands/${brandId}/logo`, { method: 'POST', body: fd });
import.meta.env.VITE_BACKEND_URL       const data = await res.json();
import.meta.env.VITE_BACKEND_URL       if (res.ok) { showToast('Logo încărcat!'); fetchBrands(); }
import.meta.env.VITE_BACKEND_URL       else showToast(data.error || 'Eroare upload', 'error');
import.meta.env.VITE_BACKEND_URL     } catch { showToast('Upload eșuat', 'error'); }
import.meta.env.VITE_BACKEND_URL     setUploadingId(null);
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   const BRAND_DEFAULT_COLORS = {
import.meta.env.VITE_BACKEND_URL     smashme: '#ef4444', sushimaster: '#3b82f6', ikura: '#8b5cf6', welovesushi: '#ec4899',
import.meta.env.VITE_BACKEND_URL   };
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   if (loading) return <p className="loading-text">Se încarcă brandurile...</p>;
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL   return (
import.meta.env.VITE_BACKEND_URL     <div className="admin-section">
import.meta.env.VITE_BACKEND_URL       <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
import.meta.env.VITE_BACKEND_URL         Gestionează informațiile și logo-urile pentru fiecare brand din sistem.
import.meta.env.VITE_BACKEND_URL       </p>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
import.meta.env.VITE_BACKEND_URL         {brands.map(brand => {
import.meta.env.VITE_BACKEND_URL           const isEditing = editing === brand.id;
import.meta.env.VITE_BACKEND_URL           const color = BRAND_DEFAULT_COLORS[brand.id] || 'var(--primary)';
import.meta.env.VITE_BACKEND_URL           return (
import.meta.env.VITE_BACKEND_URL             <div key={brand.id} style={{
import.meta.env.VITE_BACKEND_URL               background: 'var(--surface)', borderRadius: 20, padding: 24,
import.meta.env.VITE_BACKEND_URL               border: `1px solid var(--border)`,
import.meta.env.VITE_BACKEND_URL               boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
import.meta.env.VITE_BACKEND_URL               outline: isEditing ? `2px solid ${color}` : 'none',
import.meta.env.VITE_BACKEND_URL               transition: 'all 0.2s',
import.meta.env.VITE_BACKEND_URL             }}>
import.meta.env.VITE_BACKEND_URL               {/* Logo + brand ID header */}
import.meta.env.VITE_BACKEND_URL               <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
import.meta.env.VITE_BACKEND_URL                 <div style={{
import.meta.env.VITE_BACKEND_URL                   width: 72, height: 72, borderRadius: 16,
import.meta.env.VITE_BACKEND_URL                   background: `${color}15`,
import.meta.env.VITE_BACKEND_URL                   border: `2px solid ${color}40`,
import.meta.env.VITE_BACKEND_URL                   display: 'flex', alignItems: 'center', justifyContent: 'center',
import.meta.env.VITE_BACKEND_URL                   overflow: 'hidden', flexShrink: 0,
import.meta.env.VITE_BACKEND_URL                 }}>
import.meta.env.VITE_BACKEND_URL                   {brand.logo_url ? (
import.meta.env.VITE_BACKEND_URL                     <img src={brand.logo_url} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
import.meta.env.VITE_BACKEND_URL                   ) : (
import.meta.env.VITE_BACKEND_URL                     <span style={{ fontSize: '1.8rem', fontWeight: 900, color, opacity: 0.4 }}>{(brand.name||brand.id)[0].toUpperCase()}</span>
import.meta.env.VITE_BACKEND_URL                   )}
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL                 <div>
import.meta.env.VITE_BACKEND_URL                   <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>{brand.name || brand.id}</div>
import.meta.env.VITE_BACKEND_URL                   <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{brand.id}</div>
import.meta.env.VITE_BACKEND_URL                   {brand.website && (
import.meta.env.VITE_BACKEND_URL                     <a href={brand.website} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: color, textDecoration: 'none', fontWeight: 600 }}>
import.meta.env.VITE_BACKEND_URL                       {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
import.meta.env.VITE_BACKEND_URL                     </a>
import.meta.env.VITE_BACKEND_URL                   )}
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL               </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL               {!isEditing ? (
import.meta.env.VITE_BACKEND_URL                 <>
import.meta.env.VITE_BACKEND_URL                   {brand.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>{brand.description}</p>}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                   {/* Logo upload area */}
import.meta.env.VITE_BACKEND_URL                   <label style={{
import.meta.env.VITE_BACKEND_URL                     display: 'block', border: '2px dashed var(--border)', borderRadius: 12,
import.meta.env.VITE_BACKEND_URL                     padding: '12px', textAlign: 'center', cursor: 'pointer',
import.meta.env.VITE_BACKEND_URL                     background: 'var(--bg-surface)', transition: 'all 0.2s', marginBottom: 12,
import.meta.env.VITE_BACKEND_URL                   }}>
import.meta.env.VITE_BACKEND_URL                     <input type="file" accept="image/*" style={{ display: 'none' }}
import.meta.env.VITE_BACKEND_URL                       onChange={e => handleLogoUpload(brand.id, e.target.files[0])} />
import.meta.env.VITE_BACKEND_URL                     {uploadingId === brand.id ? (
import.meta.env.VITE_BACKEND_URL                       <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Se încarcă...</span>
import.meta.env.VITE_BACKEND_URL                     ) : (
import.meta.env.VITE_BACKEND_URL                       <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
import.meta.env.VITE_BACKEND_URL                         Upload logo (PNG/JPG/SVG, max 5MB)
import.meta.env.VITE_BACKEND_URL                       </span>
import.meta.env.VITE_BACKEND_URL                     )}
import.meta.env.VITE_BACKEND_URL                   </label>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                   {/* Or paste URL */}
import.meta.env.VITE_BACKEND_URL                   {brand.logo_url && (
import.meta.env.VITE_BACKEND_URL                     <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 12, wordBreak: 'break-all', fontFamily: 'monospace', background: 'var(--bg-surface)', padding: '6px 8px', borderRadius: 6 }}>
import.meta.env.VITE_BACKEND_URL                       {brand.logo_url}
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   )}
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL                   <button onClick={() => startEdit(brand)} style={{
import.meta.env.VITE_BACKEND_URL                     width: '100%', padding: '10px', borderRadius: 10,
import.meta.env.VITE_BACKEND_URL                     background: 'var(--bg-surface)', border: '1px solid var(--border)',
import.meta.env.VITE_BACKEND_URL                     color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
import.meta.env.VITE_BACKEND_URL                   }}>
import.meta.env.VITE_BACKEND_URL                     Editează informații
import.meta.env.VITE_BACKEND_URL                   </button>
import.meta.env.VITE_BACKEND_URL                 </>
import.meta.env.VITE_BACKEND_URL               ) : (
import.meta.env.VITE_BACKEND_URL                 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
import.meta.env.VITE_BACKEND_URL                   <div>
import.meta.env.VITE_BACKEND_URL                     <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nume brand</label>
import.meta.env.VITE_BACKEND_URL                     <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
import.meta.env.VITE_BACKEND_URL                       style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                   <div>
import.meta.env.VITE_BACKEND_URL                     <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Descriere</label>
import.meta.env.VITE_BACKEND_URL                     <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
import.meta.env.VITE_BACKEND_URL                       style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                   <div>
import.meta.env.VITE_BACKEND_URL                     <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Website</label>
import.meta.env.VITE_BACKEND_URL                     <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
import.meta.env.VITE_BACKEND_URL                       placeholder="https://smashme.ro" type="url"
import.meta.env.VITE_BACKEND_URL                       style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                   <div>
import.meta.env.VITE_BACKEND_URL                     <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Logo URL (sau uploadează mai sus)</label>
import.meta.env.VITE_BACKEND_URL                     <input value={form.logo_url} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
import.meta.env.VITE_BACKEND_URL                       placeholder="https://cdn.example.com/logo.png" type="url"
import.meta.env.VITE_BACKEND_URL                       style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                   {form.logo_url && (
import.meta.env.VITE_BACKEND_URL                     <div style={{ height: 60, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
import.meta.env.VITE_BACKEND_URL                       <img src={form.logo_url} alt="Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
import.meta.env.VITE_BACKEND_URL                     </div>
import.meta.env.VITE_BACKEND_URL                   )}
import.meta.env.VITE_BACKEND_URL                   <div style={{ display: 'flex', gap: 8 }}>
import.meta.env.VITE_BACKEND_URL                     <button onClick={saveEdit} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 10, background: color, color: '#fff', border: 'none', fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontSize: '0.9rem' }}>
import.meta.env.VITE_BACKEND_URL                       {saving ? 'Se salvează...' : 'Salvează'}
import.meta.env.VITE_BACKEND_URL                     </button>
import.meta.env.VITE_BACKEND_URL                     <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
import.meta.env.VITE_BACKEND_URL                       Anulează
import.meta.env.VITE_BACKEND_URL                     </button>
import.meta.env.VITE_BACKEND_URL                   </div>
import.meta.env.VITE_BACKEND_URL                 </div>
import.meta.env.VITE_BACKEND_URL               )}
import.meta.env.VITE_BACKEND_URL             </div>
import.meta.env.VITE_BACKEND_URL           );
import.meta.env.VITE_BACKEND_URL         })}
import.meta.env.VITE_BACKEND_URL       </div>
import.meta.env.VITE_BACKEND_URL 
import.meta.env.VITE_BACKEND_URL       {/* Toast */}
import.meta.env.VITE_BACKEND_URL       {toast && (
import.meta.env.VITE_BACKEND_URL         <div style={{
import.meta.env.VITE_BACKEND_URL           position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
import.meta.env.VITE_BACKEND_URL           background: toast.type === 'error' ? '#ef4444' : '#10b981',
import.meta.env.VITE_BACKEND_URL           color: '#fff', padding: '14px 24px', borderRadius: '14px',
import.meta.env.VITE_BACKEND_URL           fontWeight: 700, fontSize: '0.95rem', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
import.meta.env.VITE_BACKEND_URL           display: 'flex', alignItems: 'center', gap: 10,
import.meta.env.VITE_BACKEND_URL         }}>
import.meta.env.VITE_BACKEND_URL           <span>{toast.type === 'error' ? '✕' : '✓'}</span> {toast.msg}
import.meta.env.VITE_BACKEND_URL         </div>
import.meta.env.VITE_BACKEND_URL       )}
import.meta.env.VITE_BACKEND_URL     </div>
import.meta.env.VITE_BACKEND_URL   );
import.meta.env.VITE_BACKEND_URL }
