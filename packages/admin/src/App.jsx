import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { io } from 'socket.io-client';

import { useAuth } from './context/AuthProvider';
import LoginScreen from './screens/LoginScreen';
import UsersManager from './screens/UsersManager';
import ModifierImages from './screens/ModifierImages';
import ProductOverrides from './screens/ProductOverrides';
import TranslationsScreen from './screens/TranslationsScreen';
import Integrations   from './screens/Integrations';
import PosLogs        from './screens/PosLogs';
import KioskLogs      from './screens/KioskLogs';
import IikoLogs       from './screens/IikoLogs';
import PrinterLogs    from './screens/PrinterLogs';
import PortScans      from './screens/PortScans';
import BrandLogo from './components/BrandLogo.jsx';
import DashboardCharts3D from './components/DashboardCharts3D.jsx';
import OrderToastNotificationStack, { playNewOrderSound } from './components/OrderToastNotification.jsx';
import OrdersNotificationBell from './components/OrdersNotificationBell.jsx';
import Promotions     from './screens/Promotions';
import FortuneWheelPreview from './components/FortuneWheelPreview';
import MenuManager, { MenuProfileEditorModal } from './screens/MenuManager';
import QrGenerator from './screens/QrGenerator';
import { useConfirm } from './components/ConfirmModal';
import { LayoutDashboard, Receipt, TrendingUp, MapPin, MonitorSmartphone, QrCode, Utensils, Languages, Image as ImageIcon, Tags, Users, Blocks, Gift, Store, Sun, Moon, LogOut, Menu, X, CreditCard, Download, Printer, Building2, Palette, Sparkles, Flame, Snowflake, Layers, Upload, Star, ChevronUp, ChevronDown, Check, Zap, Wifi, Sliders, Info, Trash2, AlertTriangle, Globe, Phone, Lock, Clock, ShieldCheck, ShieldAlert, Unlock, Eye, EyeOff, Activity, RotateCcw, Calendar } from 'lucide-react';
import { formatThousands } from './utils/formatters';

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

const BRAND_COLORS = { smashme: '#ef4444', crunch: '#eab308', rollmaster: '#e31e24', lovesushi: '#ec4899', pokiwoki: '#f97316' };

const STATUS_LABELS = {
  pending:          { label: 'Achitată cu succes',  color: '#059669' },
  awaiting_payment: { label: 'Trimis la bucătărie', color: '#059669' },
  confirmed:        { label: 'Trimis la bucătărie', color: '#059669' },
  preparing:        { label: 'În preparare',        color: '#3b82f6' },
  ready:            { label: 'Gata',                color: '#059669' },
  delivered:        { label: 'Livrat',              color: '#8b5cf6' },
  cancelled:        { label: 'Anulată',             color: '#ef4444' },
};

const getOrderStatus = (o) => {
  if (!o) return { label: '—', color: '#6b7a99' };
  if (o.status === 'cancelled') return { label: 'Anulată', color: '#ef4444' };
  if (o.status === 'delivered') return { label: 'Livrat', color: '#8b5cf6' };
  if (o.status === 'ready')     return { label: 'Gata', color: '#059669' };
  if (o.status === 'preparing') return { label: 'În preparare', color: '#3b82f6' };

  // Comenzi plătite cu cardul -> Achitată cu succes
  if (o.paymentMethod === 'card' || o.paymentRef?.authCode) {
    return { label: 'Achitată cu succes', color: '#059669' };
  }

  // Comenzi trimise la bucătărie (Syrve / iiko) sau cash
  if (o.syrveOrderId || o.status === 'awaiting_payment' || o.paymentMethod === 'cash') {
    return { label: 'Trimis la bucătărie', color: '#059669' };
  }

  return STATUS_LABELS[o.status] || { label: 'Achitată cu succes', color: '#059669' };
};

export default function AdminApp() {
  const { token, user, fetchWithAuth, logout } = useAuth();
  const confirm = useConfirm();
  
  const [tab, setTabState] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'modifiers', 'products', 'users', 'integrations', 'promotions', 'brands', 'translations', 'pos-logs', 'printer-logs', 'port-scans', 'iiko-logs', 'kiosk-logs'];
    return validTabs.includes(hash) ? hash : 'orders';
  });

  const setTab = (newTab) => {
    window.location.hash = newTab;
    setTabState(newTab);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['dashboard', 'orders', 'locations', 'kiosks', 'qrcodes', 'menu', 'modifiers', 'products', 'users', 'integrations', 'promotions', 'brands', 'translations', 'pos-logs', 'printer-logs', 'port-scans', 'iiko-logs', 'kiosk-logs'];
      if (validTabs.includes(hash)) setTabState(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [orders,    setOrders]    = useState([]);
  const [menuStatus,setMenuStatus]= useState(null);
  const [connected, setConnected] = useState(false);
  const [brandFilter, setBrandFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomStr = tomorrow.toISOString().slice(0, 10);
  
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(tomStr);

  // Dashboard-specific filters (Default 'today' - "o zi ca de obicei")
  const [dashboardPeriod, setDashboardPeriod] = useState('today');
  const [dashboardBrands, setDashboardBrands] = useState([]);
  const [dashboardLocation, setDashboardLocation] = useState('all');
  const [dashboardPayment, setDashboardPayment] = useState('all');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardCustomStart, setDashboardCustomStart] = useState(todayStr);
  const [dashboardCustomEnd, setDashboardCustomEnd] = useState(todayStr);

  const formatDateYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPeriodDateRange = (periodKey) => {
    const now = new Date();
    switch (periodKey) {
      case 'today': {
        const s = formatDateYMD(now);
        return { start: s, end: s };
      }
      case 'yesterday': {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const s = formatDateYMD(y);
        return { start: s, end: s };
      }
      case 'thisWeek': {
        const day = now.getDay() || 7;
        const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
        const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 7);
        return { start: formatDateYMD(mon), end: formatDateYMD(sun) };
      }
      case 'lastWeek': {
        const day = now.getDay() || 7;
        const lastMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 6);
        const lastSun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
        return { start: formatDateYMD(lastMon), end: formatDateYMD(lastSun) };
      }
      case 'thisMonth': {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: formatDateYMD(first), end: formatDateYMD(last) };
      }
      case 'lastMonth': {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: formatDateYMD(first), end: formatDateYMD(last) };
      }
      case 'thisYear': {
        const first = new Date(now.getFullYear(), 0, 1);
        const last = new Date(now.getFullYear(), 11, 31);
        return { start: formatDateYMD(first), end: formatDateYMD(last) };
      }
      default:
        return null;
    }
  };

  const handleSelectDashboardPeriod = (pKey) => {
    setDashboardPeriod(pKey);
    const range = getPeriodDateRange(pKey);
    if (range) {
      setDashboardCustomStart(range.start);
      setDashboardCustomEnd(range.end);
    }
  };

  const handleCustomDateChange = (type, val) => {
    setDashboardPeriod('custom');
    if (type === 'start') setDashboardCustomStart(val);
    if (type === 'end') setDashboardCustomEnd(val);
  };

  const [dashboardHour, setDashboardHour] = useState(null); // null or hour number 0..23
  const [dashboardDay, setDashboardDay] = useState(null);   // null or { type: 'dayOfWeek' | 'date', value: any, label: string }

  const toggleDashboardBrand = (bId) => {
    if (bId === 'all') {
      setDashboardBrands([]);
    } else {
      const lower = String(bId).toLowerCase();
      setDashboardBrands(prev => {
        if (prev.includes(lower)) {
          return prev.filter(x => x !== lower);
        } else {
          return [...prev, lower];
        }
      });
    }
  };

  const toggleDashboardHour = (h) => {
    setDashboardHour(prev => prev === h ? null : h);
  };

  const toggleDashboardDay = (dayObj) => {
    setDashboardDay(prev => {
      if (!prev || !dayObj) return dayObj || null;
      if (prev.type === dayObj.type && prev.value === dayObj.value) return null;
      return dayObj;
    });
  };

  const toggleDashboardPayment = (p) => {
    setDashboardPayment(prev => prev === p ? 'all' : p);
  };

  const clearAllDashboardFilters = () => {
    setDashboardBrands([]);
    setDashboardHour(null);
    setDashboardDay(null);
    setDashboardPayment('all');
    setDashboardLocation('all');
    setDashboardSearch('');
  };

  const [notifications, setNotifs]= useState([]);
  const [orderToasts, setOrderToasts] = useState([]);
  const knownOrderIdsRef = useRef(null);
  const toastedOrderKeysRef = useRef(new Set());

  const triggerOrderToast = useCallback((order) => {
    if (!order) return;
    const orderKey = String(order._id || order.orderNumber || order.id || '');
    if (!orderKey) return;

    // Deduplication: ignore if toasted in the last 15 seconds
    if (toastedOrderKeysRef.current.has(orderKey)) {
      return;
    }
    toastedOrderKeysRef.current.add(orderKey);
    setTimeout(() => {
      toastedOrderKeysRef.current.delete(orderKey);
    }, 15_000);

    const toastId = `${orderKey}-${Date.now()}`;
    setOrderToasts(prev => {
      const alreadyActive = prev.some(t => {
        const tKey = String(t.order._id || t.order.orderNumber || t.order.id || '');
        return tKey === orderKey;
      });
      if (alreadyActive) return prev;

      return [
        { id: toastId, order, timestamp: Date.now() },
        ...prev.slice(0, 1) // Keep max 2 toasts
      ];
    });
  }, []);

  const handleDismissOrderToast = useCallback((toastId) => {
    setOrderToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalProductsPage, setModalProductsPage] = useState(1);
  const [modalProductsPerPage, setModalProductsPerPage] = useState(10);
  const [menuImages, setMenuImages] = useState({});
  const [menuProducts, setMenuProducts] = useState({});
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('admin-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  });
  const socketRef = useRef(null);
  const [kiosksLiveStatus, setKiosksLiveStatus] = useState({});
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

  /* ─── Socket.IO (Primary + Localhost Fallback) ────── */
  useEffect(() => {
    const handleIncomingOrder = (order) => {
      if (!order) return;
      const orderId = order._id || order.id;
      const orderNum = order.orderNumber;

      setOrders(prev => {
        const exists = prev.some(o => 
          (orderId && (o._id === orderId || o.id === orderId)) ||
          (orderNum && o.orderNumber === orderNum)
        );
        if (exists) {
          // Actualizează pe loc datele (ex: syrveOrderId, status) fără să creeze dublură
          return prev.map(o => 
            ((orderId && (o._id === orderId || o.id === orderId)) || (orderNum && o.orderNumber === orderNum))
              ? { ...o, ...order }
              : o
          );
        }
        return [order, ...prev];
      });

      const isAlreadyToast = (orderId && knownOrderIdsRef.current?.has(orderId)) ||
                             (orderNum && knownOrderIdsRef.current?.has(orderNum));
      if (!isAlreadyToast) {
        if (orderId && knownOrderIdsRef.current) knownOrderIdsRef.current.add(orderId);
        if (orderNum && knownOrderIdsRef.current) knownOrderIdsRef.current.add(orderNum);
        triggerOrderToast(order);
      }
    };

    const socket = io(BACKEND, { 
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'] // Allow polling fallback
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
    socket.on('new_order', handleIncomingOrder);
    socket.on('order_syrve_confirmed', ({ orderId, syrveOrderId }) => {
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, syrveOrderId } : o));
      setOrderToasts(prev => prev.map(t => {
        if (t.order._id === orderId || t.order.orderNumber === orderId) {
          return { ...t, order: { ...t.order, syrveOrderId } };
        }
        return t;
      }));
    });
    socket.on('order_status_updated', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status } : o));
      setOrderToasts(prev => prev.map(t => {
        if (t.order._id === orderId) {
          return { ...t, order: { ...t.order, status } };
        }
        return t;
      }));
    });
    socket.on('kiosks_live_status', (statusMap) => {
      setKiosksLiveStatus(statusMap || {});
    });

    // Initial live status fetch + 15s poll fallback
    const fetchLiveKiosks = () => {
      fetchWithAuth(`${BACKEND}/api/locations/live-status`)
        .then(r => r.json())
        .then(d => { if (d.liveStatus) setKiosksLiveStatus(d.liveStatus); })
        .catch(() => {});
    };
    fetchLiveKiosks();
    const livePoll = setInterval(fetchLiveKiosks, 15000);

    // Also connect to localhost:4000 if running locally to catch local kiosk orders
    let localSocket = null;
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && !BACKEND.includes('localhost:4000')) {
      try {
        localSocket = io('http://localhost:4000', {
          reconnectionAttempts: 5,
          transports: ['websocket', 'polling']
        });
        localSocket.on('connect', () => {
          localSocket.emit('join', { role: 'admin' });
        });
        localSocket.on('new_order', handleIncomingOrder);
      } catch (e) {
        // Local backend not reachable, ignore
      }
    }

    return () => {
      clearInterval(livePoll);
      socket.disconnect();
      if (localSocket) localSocket.disconnect();
    };
  }, [triggerOrderToast]);

  /* ─── Test Order Toast Event Listener ───────────── */
  useEffect(() => {
    const handleTestToast = (e) => {
      const mockOrder = e.detail || {
        _id: `mock-${Date.now()}`,
        orderNumber: 'CJ1-094',
        brand: 'smashme',
        totalAmount: 62.50,
        orderType: 'takeaway',
        locationName: 'SmashMe Centru',
        paymentMethod: 'card',
        paymentRef: { authCode: '567194' },
        syrveOrderId: 'syrve-99120',
        items: [{ name: 'Spicy Jalapeno Meniu', quantity: 1 }, { name: 'Cartofi Prăjiți', quantity: 1 }]
      };
      triggerOrderToast(mockOrder);
    };
    window.addEventListener('test-order-toast', handleTestToast);
    return () => window.removeEventListener('test-order-toast', handleTestToast);
  }, [triggerOrderToast]);

  /* ─── Load promotions configs for UI Previews ───── */
  // promosData moved to KioskSettingsForm

  /* ─── Load initial orders + poll every 30s ──────── */
  useEffect(() => {
    const loadOrders = () => {
      let url = `${BACKEND}/api/orders?limit=500`;
      fetchWithAuth(url)
        .then(r => r.json())
        .then(d => {
          const list = d.orders || [];
          if (knownOrderIdsRef.current !== null) {
            const newArrivals = list.filter(o => {
              const id = o._id || o.id;
              const num = o.orderNumber;
              const isKnown = (id && knownOrderIdsRef.current.has(id)) || (num && knownOrderIdsRef.current.has(num));
              return !isKnown;
            });
            if (newArrivals.length > 0) {
              newArrivals.slice(0, 1).forEach(o => triggerOrderToast(o));
            }
          }
          knownOrderIdsRef.current = new Set(list.map(o => o._id || o.orderNumber));
          setOrders(list);
        })
        .catch(() => {});
    };
    loadOrders();
    const interval = setInterval(loadOrders, 30_000);
    return () => clearInterval(interval);
  }, [periodFilter, customStart, customEnd, dashboardPeriod, dashboardCustomStart, dashboardCustomEnd, triggerOrderToast]);

  const handleCancelOrder = async (orderId) => {
    const ok = await confirm('Ești sigur că vrei să anulezi această comandă (anulată din POS)?', {
      title: 'Anulare comandă',
      danger: true,
      okLabel: 'Anulează comanda'
    });
    if (!ok) return;
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', canceledBy: 'admin' })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: 'cancelled', canceledBy: 'admin' } : o));
        confirm('Comanda a fost marcată ca anulată.', { title: 'Comandă Anulată', hideCancel: true, okLabel: 'Închide' });
      } else {
        const err = await res.json().catch(() => ({}));
        confirm('Eroare: ' + (err.error || 'Nu s-a putut anula.'), { title: 'Eroare', danger: true, hideCancel: true, okLabel: 'Închide' });
      }
    } catch (e) {
      confirm('Eroare de rețea. Verificați conexiunea la server.', { title: 'Eroare de rețea', danger: true, hideCancel: true, okLabel: 'Închide' });
    }
  };  /* ─── Load menu status ───────────────────────────── */
  const fetchMenuStatus = useCallback(() => {
    fetchWithAuth(`${BACKEND}/api/menu/status`)
      .then(r => r.json())
      .then(d => setMenuStatus(d))
      .catch(() => {});
  }, []);
  useEffect(() => { if (tab === 'menu') fetchMenuStatus(); }, [tab, fetchMenuStatus]);

  /* ─── Fetch menu products + images for order detail ── */
  useEffect(() => {
    if (selectedOrder && selectedOrder.items) {
      Promise.all([
        fetch(`${BACKEND}/api/menu/all`).then(r => r.json()),
        fetch(`${BACKEND}/api/products/overrides/${selectedOrder.brand || 'smashme'}`).then(r => r.json()).catch(() => ({})),
      ]).then(([allMenuData, overridesData]) => {
        // Build image map from overrides
        const imgMap = {};
        if (overridesData && typeof overridesData === 'object') {
          Object.entries(overridesData).forEach(([pid, ov]) => {
            if (ov.imageUrl) imgMap[pid] = ov.imageUrl;
          });
        }
        setMenuImages(imgMap);

        // Build product map from iiko menu
        const prodMap = {};
        Object.keys(allMenuData || {}).forEach(b => {
          const brandMenu = allMenuData[b]?.menu?.products || [];
          brandMenu.forEach(p => {
            prodMap[p.id] = p;
            if (p.name) prodMap[p.name.toLowerCase()] = p;
          });
        });
        setMenuProducts(prodMap);
      }).catch(() => {});
    }
  }, [selectedOrder]);

  const addNotif = (msg) => {
    const id = Date.now();
    setNotifs(prev => [{ id, msg }, ...prev.slice(0, 4)]);
    setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== id)), 6000);
  };

  /* ─── Stats ──────────────────────────────────────── */
  const stats = {
    total:     orders.length,
    todayTotal: orders.filter(o => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      const today = new Date();
      return d.getDate() === today.getDate() && 
             d.getMonth() === today.getMonth() && 
             d.getFullYear() === today.getFullYear();
    }).length,
    pending:   orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
    revenue:   orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totalAmount || 0), 0),
  };
  const brandStats = orders.reduce((acc, o) => {
    if (o.brand) acc[o.brand] = (acc[o.brand] || 0) + 1;
    return acc;
  }, {});

  const isDateInPeriod = (dateStr, period, cStart = customStart, cEnd = customEnd) => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    
    if (period === 'today') return d >= startOfToday;
    if (period === 'yesterday') return d >= startOfYesterday && d < startOfToday;
    if (period === 'thisWeek') {
      const day = now.getDay() || 7;
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      return d >= startOfWeek;
    }
    if (period === 'lastWeek') {
      const day = now.getDay() || 7;
      const startOfLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 6);
      startOfLastWeek.setHours(0, 0, 0, 0);
      const endOfLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      endOfLastWeek.setHours(0, 0, 0, 0);
      return d >= startOfLastWeek && d < endOfLastWeek;
    }
    if (period === 'thisMonth') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === 'lastMonth') {
      let m = now.getMonth() - 1;
      let y = now.getFullYear();
      if (m < 0) { m = 11; y--; }
      return d.getFullYear() === y && d.getMonth() === m;
    }
    if (period === 'thisYear') {
      return d.getFullYear() === now.getFullYear();
    }
    if (period === 'custom') {
      if (!cStart && !cEnd) return true;
      let startValid = true;
      let endValid = true;
      if (cStart) {
        const sd = new Date(cStart);
        sd.setHours(0, 0, 0, 0);
        if (d < sd) startValid = false;
      }
      if (cEnd) {
        const ed = new Date(cEnd);
        ed.setHours(23, 59, 59, 999);
        if (d > ed) endValid = false;
      }
      return startValid && endValid;
    }
    return true;
  };

  /* ─── Dashboard Filtered Data & Stats ─────────────── */
  const dashboardPeriodOrders = useMemo(() => {
    const seen = new Set();
    return orders.filter(o => {
      const key = o._id || o.id || o.orderNumber;
      if (key) {
        if (seen.has(key)) return false;
        seen.add(key);
      }
      if (dashboardLocation !== 'all' && (o.locationName || o.locationId) !== dashboardLocation) return false;
      if (dashboardPayment !== 'all') {
        const isCard = o.paymentMethod === 'card' || !!o.paymentRef?.authCode;
        if (dashboardPayment === 'card' && !isCard) return false;
        if (dashboardPayment === 'cash' && isCard) return false;
      }
      if (!isDateInPeriod(o.createdAt, dashboardPeriod, dashboardCustomStart, dashboardCustomEnd)) return false;
      return true;
    });
  }, [orders, dashboardLocation, dashboardPayment, dashboardPeriod, dashboardCustomStart, dashboardCustomEnd]);

  const dashboardBrandStats = useMemo(() => {
    return dashboardPeriodOrders.reduce((acc, o) => {
      if (o.brand) {
        const b = o.brand.toLowerCase();
        acc[b] = (acc[b] || 0) + 1;
      }
      return acc;
    }, {});
  }, [dashboardPeriodOrders]);

  const dashboardFilteredOrders = useMemo(() => {
    return dashboardPeriodOrders.filter(o => {
      if (dashboardBrands.length > 0) {
        const b = (o.brand || '').toLowerCase();
        if (!dashboardBrands.includes(b)) return false;
      }

      if (dashboardHour !== null) {
        if (!o.createdAt) return false;
        const h = new Date(o.createdAt).getHours();
        if (h !== dashboardHour) return false;
      }

      if (dashboardDay !== null) {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        if (dashboardDay.type === 'dayOfWeek') {
          const dayNum = d.getDay() === 0 ? 7 : d.getDay();
          if (dayNum !== dashboardDay.value) return false;
        } else if (dashboardDay.type === 'date') {
          const dateStr = d.toISOString().slice(0, 10);
          if (dateStr !== dashboardDay.value) return false;
        }
      }
      
      if (dashboardSearch) {
        const q = dashboardSearch.toLowerCase();
        const matchNumber = String(o.orderNumber || '').includes(q);
        const matchIiko = (o.syrveOrderId || '').toLowerCase().includes(q);
        const matchLoc = (o.locationName || o.locationId || '').toLowerCase().includes(q);
        const matchAmount = String(o.totalAmount || '').includes(q);
        const matchItem = (o.items || []).some(i => (i.name || '').toLowerCase().includes(q));
        if (!matchNumber && !matchIiko && !matchLoc && !matchAmount && !matchItem) return false;
      }
      
      return true;
    });
  }, [dashboardPeriodOrders, dashboardBrands, dashboardHour, dashboardDay, dashboardSearch]);

  const dashboardRevenue = useMemo(() => {
    return dashboardFilteredOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
  }, [dashboardFilteredOrders]);

  const [globalSearch, setGlobalSearch] = useState('');

  const filteredOrders = orders.filter(o => {
    if (brandFilter !== 'all' && o.brand !== brandFilter) return false;
    if (locationFilter !== 'all' && (o.locationName || o.locationId) !== locationFilter) return false;
    if (paymentFilter !== 'all' && o.paymentMethod !== paymentFilter) return false;
    if (!isDateInPeriod(o.createdAt, periodFilter)) return false;
    
    if (globalSearch) {
      const q = globalSearch.toLowerCase();
      const matchNumber = String(o.orderNumber || '').includes(q);
      const matchIiko = (o.syrveOrderId || '').toLowerCase().includes(q);
      const matchLoc = (o.locationName || o.locationId || '').toLowerCase().includes(q);
      const matchAmount = String(o.totalAmount || '').includes(q);
      if (!matchNumber && !matchIiko && !matchLoc && !matchAmount) return false;
    }
    
    return true;
  });

  const uniqueLocations = [...new Set(orders.map(o => o.locationName || o.locationId).filter(Boolean))];

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
          {/* Notifications Bell with Recent Orders Dropdown */}
          <OrdersNotificationBell 
            orders={orders}
            onOpenOrder={(order) => setSelectedOrder(order)}
            onViewAllOrders={() => setTab('orders')}
            onTriggerTestOrder={() => {
              const testBrands = ['smashme', 'crunch', 'rollmaster', 'lovesushi', 'pokiwoki'];
              const randomBrand = testBrands[Math.floor(Math.random() * testBrands.length)];
              const mockOrder = {
                _id: `mock-${Date.now()}`,
                orderNumber: `CJ1-0${Math.floor(Math.random() * 89 + 10)}`,
                brand: randomBrand,
                totalAmount: Number((Math.random() * 40 + 35).toFixed(2)),
                orderType: Math.random() > 0.5 ? 'takeaway' : 'dine-in',
                locationName: 'SmashMe Centru',
                paymentMethod: 'card',
                paymentRef: { authCode: `${Math.floor(Math.random() * 899999 + 100000)}` },
                syrveOrderId: `syrve-${Math.floor(Math.random() * 90000 + 10000)}`,
                createdAt: new Date().toISOString(),
                items: [
                  { name: 'Smash Burger Dublu', quantity: 1 },
                  { name: 'Cartofi Prăjiți Usturoi', quantity: 1 }
                ]
              };
              setOrders(prev => [mockOrder, ...prev]);
              triggerOrderToast(mockOrder);
            }}
          />

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
              ...(user?.role === 'admin' ? [{ id: 'pos-logs', label: 'Loguri POS', icon: <CreditCard className="w-5 h-5" /> }] : []),
              ...(user?.role === 'admin' ? [{ id: 'printer-logs', label: 'Loguri Imprimantă', icon: <Printer className="w-5 h-5" /> }] : []),
              ...(user?.role === 'admin' ? [{ id: 'port-scans', label: 'Scanare Porturi PC', icon: <MonitorSmartphone className="w-5 h-5" /> }] : []),
              ...(user?.role === 'admin' ? [{ id: 'iiko-logs', label: 'Loguri iiko', icon: <Receipt className="w-5 h-5" /> }] : []),
              ...(user?.role === 'admin' ? [{ id: 'kiosk-logs', label: 'Loguri Kiosk (PIN)', icon: <Lock className="w-5 h-5" /> }] : []),
              ...(user?.role === 'admin' ? [{ id: 'promotions', label: 'Promoții', icon: <Gift className="w-5 h-5" /> }] : []),
              ...(user?.role === 'admin' ? [{ id: 'brands', label: 'Branduri', icon: <Store className="w-5 h-5" /> }] : []),
            ].map(item => (
              <button
                key={item.id}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all font-medium text-sm ${tab === item.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'}`}
                onClick={() => { setTab(item.id); setIsSidebarOpen(false); }}
              >
                <span className={tab === item.id ? 'opacity-100' : 'opacity-75'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold ${connected ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {connected ? 'Live' : 'Offline'}
            </div>
          </div>
        </aside>

        {/* ─── Main ─── */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-900 relative">
        <div className="shrink-0 px-4 md:px-8 pt-6 pb-2">
           <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
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
              {tab === 'pos-logs' && 'Loguri Tranzacții POS'}
              {tab === 'printer-logs' && 'Loguri Imprimantă'}
              {tab === 'port-scans' && 'Scanare Porturi PC'}
              {tab === 'iiko-logs' && 'Loguri iiko Syrve'}
              {tab === 'kiosk-logs' && 'Loguri Kiosk & Deblocare PIN'}
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
          <div className="space-y-6 px-4 md:px-8 pb-10">

            {/* Stat Cards Grid - Fixed 7 columns now placed at the top */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              <div className="w-full">
                <StatCard 
                  label={
                    dashboardPeriod === 'today' ? 'Comenzi Azi' :
                    dashboardPeriod === 'yesterday' ? 'Comenzi Ieri' :
                    dashboardPeriod === 'thisWeek' ? 'Comenzi Săpt. Curentă' :
                    dashboardPeriod === 'lastWeek' ? 'Comenzi Săpt. Trecută' :
                    dashboardPeriod === 'thisMonth' ? 'Comenzi Luna Curentă' :
                    dashboardPeriod === 'lastMonth' ? 'Comenzi Luna Trecută' :
                    dashboardPeriod === 'thisYear' ? 'Comenzi Anul Curent' :
                    'Comenzi'
                  } 
                  value={dashboardFilteredOrders.length} 
                  color="var(--primary)" 
                  icon={Receipt}
                  onClick={() => setDashboardBrands([])}
                />
              </div>
              <div className="w-full">
                <StatCard 
                  label="Încasări Total" 
                  value={`${formatThousands(dashboardRevenue, 0)} lei`} 
                  color="#059669" 
                  icon={TrendingUp}
                />
              </div>
              {Object.keys(BRAND_COLORS).map(b => (
                <div key={b} className="w-full">
                  <StatCard 
                    label={b === 'smashme' ? 'SmashMe' : b === 'crunch' ? 'Crunch' : b === 'rollmaster' ? 'Roll Master' : b === 'lovesushi' ? 'Love Sushi' : 'Poki-Woki'} 
                    value={dashboardBrandStats[b] || 0} 
                    color={BRAND_COLORS[b]} 
                    brandId={b}
                    onClick={() => toggleDashboardBrand(b)}
                    active={dashboardBrands.includes(b)}
                  />
                </div>
              ))}
            </div>

            {/* Controls & Period Filter Bar - Below Stat Cards */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
              {/* Linia 1: Filtru Branduri + Locații + Plăți + Căutare */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Brand Filter Buttons - Compact Icons with Multi-select */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
                  {['all','smashme','crunch','rollmaster','lovesushi','pokiwoki'].map(b => {
                    const isSelected = b === 'all' ? dashboardBrands.length === 0 : dashboardBrands.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        title={b === 'all' ? 'Toate Brandurile' : b === 'smashme' ? 'SmashMe' : b === 'crunch' ? 'Crunch' : b === 'rollmaster' ? 'Roll Master' : b === 'lovesushi' ? 'Love Sushi' : 'Poki-Woki'}
                        className={`shrink-0 h-10 rounded-full flex items-center justify-center border transition-all ${
                          b === 'all' ? 'px-4 text-xs font-bold' : 'w-10'
                        } ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        onClick={() => toggleDashboardBrand(b)}
                      >
                        {b === 'all' ? 'Toate' : <BrandLogo brandId={b} size={18} />}
                      </button>
                    );
                  })}
                </div>

                {/* Filtre dreapta: Locație, Plată, Căutare */}
                <div className="flex items-center gap-2.5 flex-wrap ml-auto">
                  {/* Location Filter */}
                  <select 
                    className="shrink-0 px-4 h-10 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    value={dashboardLocation}
                    onChange={(e) => setDashboardLocation(e.target.value)}
                  >
                    <option value="all">Toate locațiile</option>
                    {uniqueLocations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>

                  {/* Payment Filter */}
                  <select 
                    className="shrink-0 px-4 h-10 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    value={dashboardPayment}
                    onChange={(e) => setDashboardPayment(e.target.value)}
                  >
                    <option value="all">Toate plățile</option>
                    <option value="card">Card (POS)</option>
                    <option value="cash">Numerar (Cash)</option>
                  </select>

                  {/* Search Bar */}
                  <div className="relative min-w-[180px] max-w-[280px]">
                    <input
                      type="text"
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                      placeholder="Caută comandă, iiko..."
                      className="h-10 pl-10 pr-4 rounded-full text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition-all"
                    />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                </div>
              </div>

              {/* Linia 2: Sub filtru de brand — Butoane Rapide Perioadă + Câmpuri Dată */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                {/* Butoane Rapide Perioadă */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                  {[
                    { id: 'today', label: 'Azi' },
                    { id: 'yesterday', label: 'Ieri' },
                    { id: 'thisWeek', label: 'Săpt. Curentă' },
                    { id: 'lastWeek', label: 'Săpt. Trecută' },
                    { id: 'thisMonth', label: 'Luna Curentă' },
                    { id: 'lastMonth', label: 'Luna Trecută' },
                    { id: 'thisYear', label: 'Anul Curent' },
                    { id: 'custom', label: 'Personalizat' }
                  ].map(p => {
                    const isActive = dashboardPeriod === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectDashboardPeriod(p.id)}
                        className={`shrink-0 px-3.5 h-9 rounded-full text-xs font-bold transition-all border ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Câmpuri Dată sincronizate direct cu selecția */}
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 py-1 px-3 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Interval:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={dashboardCustomStart}
                      onChange={(e) => handleCustomDateChange('start', e.target.value)}
                      className="px-2.5 h-8 rounded-lg text-xs font-sans font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      title="Data de început"
                    />
                    <span className="text-slate-400 text-xs font-bold">—</span>
                    <input
                      type="date"
                      value={dashboardCustomEnd}
                      onChange={(e) => handleCustomDateChange('end', e.target.value)}
                      className="px-2.5 h-8 rounded-lg text-xs font-sans font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      title="Data de sfârșit"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Active Filter Pills Bar (if filtered by chart or toolbar) */}
            {(dashboardBrands.length > 0 || dashboardHour !== null || dashboardDay !== null || dashboardPayment !== 'all' || dashboardLocation !== 'all' || dashboardSearch) && (
              <div className="flex items-center gap-2 flex-wrap text-xs bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-slate-400 font-bold">Filtre active:</span>
                {dashboardBrands.map(b => (
                  <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">
                    <BrandLogo brandId={b} size={15} />
                    <span>Brand: {b}</span>
                    <button onClick={() => toggleDashboardBrand(b)} className="hover:text-red-500 font-bold ml-1 cursor-pointer">✕</button>
                  </span>
                ))}
                {dashboardHour !== null && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold">
                    Oră: {dashboardHour}:00 - {dashboardHour + 1}:00
                    <button onClick={() => toggleDashboardHour(dashboardHour)} className="hover:text-red-500 font-bold ml-1 cursor-pointer">✕</button>
                  </span>
                )}
                {dashboardDay !== null && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                    Zi: {dashboardDay.label}
                    <button onClick={() => toggleDashboardDay(dashboardDay)} className="hover:text-red-500 font-bold ml-1 cursor-pointer">✕</button>
                  </span>
                )}
                {dashboardPayment !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                    Plată: {dashboardPayment === 'card' ? 'Card POS' : 'Numerar (Cash)'}
                    <button onClick={() => toggleDashboardPayment(dashboardPayment)} className="hover:text-red-500 font-bold ml-1 cursor-pointer">✕</button>
                  </span>
                )}
                {dashboardLocation !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold">
                    Locație: {dashboardLocation}
                    <button onClick={() => setDashboardLocation('all')} className="hover:text-red-500 font-bold ml-1 cursor-pointer">✕</button>
                  </span>
                )}
                {dashboardSearch && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 font-bold">
                    Căutare: "{dashboardSearch}"
                    <button onClick={() => setDashboardSearch('')} className="hover:text-red-500 font-bold ml-1 cursor-pointer">✕</button>
                  </span>
                )}
                <button 
                  onClick={clearAllDashboardFilters} 
                  className="text-xs text-red-500 hover:text-red-600 underline font-bold ml-auto cursor-pointer"
                >
                  Resetează toate filtrele
                </button>
              </div>
            )}

            {/* 5 Interactive ZoomCharts with Cross-Filtering & Top Products */}
            <DashboardCharts3D 
              orders={dashboardPeriodOrders} 
              period={dashboardPeriod} 
              selectedBrands={dashboardBrands}
              onSelectBrand={toggleDashboardBrand}
              selectedHour={dashboardHour}
              onSelectHour={toggleDashboardHour}
              selectedDay={dashboardDay}
              onSelectDay={toggleDashboardDay}
              selectedPayment={dashboardPayment}
              onSelectPayment={toggleDashboardPayment}
              selectedProduct={dashboardSearch}
              onSelectProduct={(prodName) => setDashboardSearch(prev => prev === prodName ? '' : prodName)}
            />

            {/* Orders Table with Pagination & Row Numbers */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  Comenzi Perioadă
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Total: {dashboardFilteredOrders.length} înregistrări
                  </span>
                </h3>
              </div>
              <OrdersTable 
                orders={dashboardFilteredOrders} 
                onRowClick={setSelectedOrder} 
                selectedId={selectedOrder?._id}
                defaultRows={10}
              />
            </div>
          </div>
        )}

        {/* ─── ORDERS ─── */}
        {tab === 'orders' && (
          <div className="space-y-4 px-4 md:px-8 pb-10">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
                {['all','smashme','crunch','rollmaster','lovesushi','pokiwoki'].map(b => (
                  <button
                    key={b}
                    title={b === 'all' ? 'Toate' : b}
                    className={`shrink-0 h-10 rounded-full flex items-center justify-center border transition-colors ${b === 'all' ? 'px-5 text-sm font-bold' : 'w-10'} ${brandFilter === b ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    onClick={() => setBrandFilter(b)}
                  >
                    {b === 'all' ? 'Toate' : <BrandLogo brandId={b} size={20} />}
                  </button>
                ))}
              </div>
              
              {/* Global Search Bar */}
              <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    placeholder="Caută comandă, iiko, locație..."
                    className="h-10 pl-10 pr-4 rounded-full text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition-all"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-4 top-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <select 
                  className="shrink-0 px-4 h-10 rounded-full text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                >
                  <option value="all">Toată perioada</option>
                  <option value="today">Azi</option>
                  <option value="yesterday">Ieri</option>
                  <option value="thisWeek">Săptămâna Curentă</option>
                  <option value="thisMonth">Luna Curentă</option>
                  <option value="lastMonth">Luna Trecută</option>
                  <option value="thisYear">Anul Curent</option>
                  <option value="custom">Personalizat</option>
                </select>
                {periodFilter === 'custom' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <input 
                      type="date" 
                      className="px-3 h-10 rounded-full text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                      type="date" 
                      className="px-3 h-10 rounded-full text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                )}
                <select 
                  className="shrink-0 px-4 h-10 rounded-full text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                >
                  <option value="all">Toate locațiile</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
                <select 
                  className="shrink-0 px-4 h-10 rounded-full text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                >
                  <option value="all">Toate plățile</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>
            <OrdersTable orders={filteredOrders} full onRowClick={setSelectedOrder} selectedId={selectedOrder?._id} />
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
            <div className="admin-section"><LocationsManager backend={BACKEND} kiosksLiveStatus={kiosksLiveStatus} /></div>
          )}

          {/* ─── KIOSKS / SCREENSAVER ─── */}
          {tab === 'kiosks' && (
            <div className="admin-section"><KiosksManager backend={BACKEND} kiosksLiveStatus={kiosksLiveStatus} /></div>
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
          {tab === 'pos-logs' && <PosLogs orders={orders} onGoToOrder={async (orderId) => {
            const foundOrder = orders.find(o => o._id === orderId);
            if (foundOrder) {
              setSelectedOrder(foundOrder);
            } else {
              try {
                const res = await fetchWithAuth(`${BACKEND}/api/orders/${orderId}`);
                if (res.ok) {
                  const data = await res.json();
                  setOrders(prev => {
                    if (!prev.find(o => o._id === data._id)) {
                      return [data, ...prev];
                    }
                    return prev;
                  });
                  setSelectedOrder(data);
                } else {
                  console.error('Order not found on server');
                }
              } catch (e) {
                console.error('Failed to fetch order', e);
              }
            }
          }} />}
          {tab === 'iiko-logs' && <IikoLogs />}
          {tab === 'printer-logs' && <PrinterLogs />}
          {tab === 'port-scans' && <PortScans />}
          {tab === 'kiosk-logs' && <KioskLogs />}
          {tab === 'promotions' && <Promotions />}
          {tab === 'users' && <UsersManager />}
          {tab === 'brands' && <BrandsManager backend={BACKEND} />}
        </div>
      </main>
      </div>

    {/* Real-time Order Popup Toast in Top-Right Corner */}
    <OrderToastNotificationStack 
      orderToasts={orderToasts}
      onDismiss={handleDismissOrderToast}
      onOpenOrder={(order) => setSelectedOrder(order)}
    />

    {/* ── Order Detail Modal (centered) ── */}
    {selectedOrder && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedOrder(null)}>
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold">Comandă #{selectedOrder.orderNumber}</h2>
            <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">✕</button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              <BrandLogo brandId={selectedOrder.brand} size={24} />
              <span className="font-bold" style={{ color: BRAND_COLORS[selectedOrder.brand] }}>{selectedOrder.brand}</span>
              {(() => {
                const sc = getOrderStatus(selectedOrder);
                return (
                  <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{
                    backgroundColor: `${sc.color}20`,
                    color: sc.color,
                    border: `1px solid ${sc.color}40`
                  }}>● {sc.label}</span>
                );
              })()}
            </div>
            <div className="text-sm text-slate-500 space-y-2">
              <div className="flex items-center gap-6">
                <p><strong>Canal:</strong> {selectedOrder.channel}</p>
                <p><strong>Tip Comandă:</strong> {selectedOrder.orderType === 'dine-in' ? (selectedOrder.tableNumber ? `La masă (Masa ${selectedOrder.tableNumber})` : 'La masă') : 'La pachet'}</p>
              </div>
              <div className="flex items-center gap-6">
                <p className="flex items-center gap-2"><strong>Plată:</strong> <span className="font-bold">{selectedOrder.paymentMethod === 'cash' ? 'CASH' : (selectedOrder.paymentMethod === 'card' ? 'CARD' : '—')}</span> {selectedOrder.paymentMethod === 'card' ? <span className="px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap bg-emerald-500/20 text-emerald-500 border border-emerald-500/40">✓ Aprobat</span> : (selectedOrder.paymentMethod === 'cash' ? <span className="px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap bg-amber-500/20 text-amber-500 border border-amber-500/40">La Casă</span> : '')}</p>
                <p><strong>Data/Ora:</strong> {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('ro-RO') : '—'}</p>
              </div>
              {/* CUI / Date Fiscale */}
              {selectedOrder.fiscal && (
                <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-700/50 mt-2">
                  <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-0.5">Bon Fiscal cu CUI</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{selectedOrder.fiscal.name || '—'}</p>
                    <p className="text-xs text-slate-500">
                      CUI: <span className="font-bold text-slate-700 dark:text-slate-200">{selectedOrder.fiscal.rawCui || selectedOrder.fiscal.cui}</span>
                      {selectedOrder.fiscal.regCom && <> | Reg.Com: {selectedOrder.fiscal.regCom}</>}
                      {selectedOrder.fiscal.isVatPayer && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Plătitor TVA</span>}
                    </p>
                    {selectedOrder.fiscal.address && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{selectedOrder.fiscal.address}</p>
                    )}
                  </div>
                </div>
              )}
              {selectedOrder.syrveOrderId && (
                <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-500">ID Comandă iiko</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate select-all">{selectedOrder.syrveOrderId}</span>
                  </div>
                  {selectedOrder.paymentRef?.receiptNo && (
                    <div className="flex flex-col mt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Număr Bon POS (Chitanță)</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 select-all">{selectedOrder.paymentRef.receiptNo}</span>
                    </div>
                  )}
                  <button 
                    onClick={(e) => {
                      navigator.clipboard.writeText(selectedOrder.syrveOrderId);
                      const btn = e.currentTarget;
                      const originalHTML = btn.innerHTML;
                      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#059669" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
                      setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
                    }}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Copiază ID iiko"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {selectedOrder.status !== 'cancelled' && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    handleCancelOrder(selectedOrder._id);
                    setSelectedOrder({ ...selectedOrder, status: 'cancelled', canceledBy: 'admin' });
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold rounded-lg transition-colors text-sm"
                >
                  ✕ Anulează Comanda (Refuz POS)
                </button>
              </div>
            )}

            {(() => {
              const allItems = selectedOrder.items || [];
              const totalItems = allItems.length;
              const totalPages = Math.ceil(totalItems / modalProductsPerPage) || 1;
              const safePage = Math.min(modalProductsPage, totalPages);
              const paginatedItems = allItems.slice((safePage - 1) * modalProductsPerPage, safePage * modalProductsPerPage);

              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold uppercase text-slate-400">Produse ({totalItems})</h3>
                    {totalItems > 5 && (
                      <div className="flex items-center gap-2">
                        <select
                          value={modalProductsPerPage}
                          onChange={e => { setModalProductsPerPage(Number(e.target.value)); setModalProductsPage(1); }}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={5}>5 / pag</option>
                          <option value={10}>10 / pag</option>
                          <option value={20}>20 / pag</option>
                          <option value={999}>Toate</option>
                        </select>
                        <div className="flex gap-1">
                          <button onClick={() => setModalProductsPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs disabled:opacity-50 text-slate-600 dark:text-slate-300">‹</button>
                          <button onClick={() => setModalProductsPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs disabled:opacity-50 text-slate-600 dark:text-slate-300">›</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {paginatedItems.map((item, idx) => {
                      const actualIdx = (safePage - 1) * modalProductsPerPage + idx;
                      const fullProd = menuProducts[item.productId] || (item.name && menuProducts[item.name.toLowerCase()]);
                      const overrideImg = menuImages[item.productId];
                      let imgSrc = overrideImg || item.imageUrl || (fullProd?.imageLinks && fullProd.imageLinks[0]) || fullProd?.image || null;
                      if (imgSrc && imgSrc.startsWith('/uploads')) imgSrc = `${BACKEND}${imgSrc}`;

                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                             onClick={() => { if (fullProd) setSelectedItemDetail({ ...fullProd, originalItem: item }); }}>
                          <div className="font-bold text-slate-400 text-sm shrink-0 w-6 text-right">
                            {actualIdx + 1}.
                          </div>
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                            {imgSrc
                              ? <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
                              : <Utensils className="w-6 h-6 text-slate-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{item.name}</p>
                            {item.selectedModifiers?.length > 0 && (
                              <p className="text-xs text-slate-400 truncate">{item.selectedModifiers.map(m => m.optionName || m.modifierName).filter(Boolean).join(' · ')}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-blue-500">{item.quantity}x</span>
                            <p className="font-bold text-sm">{formatThousands((item.unitPrice !== undefined ? item.unitPrice : item.price) || 0)} lei</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-sm font-bold uppercase text-slate-400">Total</span>
              <span className="text-2xl font-black">{formatThousands(selectedOrder.totalAmount || 0)} lei</span>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Product Detail Modal ── */}
    {selectedItemDetail && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedItemDetail(null)}>
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold">{selectedItemDetail.name}</h2>
            <button onClick={() => setSelectedItemDetail(null)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">✕</button>
          </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* LEFT: Image */}
            <div className="md:w-2/5 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center p-8 md:border-r border-b md:border-b-0 border-slate-200 dark:border-slate-800">
              {(() => {
                let finalImg = menuImages[selectedItemDetail.id] || selectedItemDetail.image || (selectedItemDetail.imageLinks && selectedItemDetail.imageLinks[0]);
                if (finalImg && finalImg.startsWith('/uploads')) finalImg = `${BACKEND}${finalImg}`;
                if (finalImg) {
                  return <img src={finalImg} alt={selectedItemDetail.name} className="w-full max-w-[250px] aspect-square object-cover rounded-3xl" />;
                }
                return (
                  <div className="w-full max-w-[250px] aspect-square rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                    <Utensils className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                  </div>
                );
              })()}
            </div>

            {/* RIGHT: Description from iiko */}
            <div className="md:w-3/5 p-8 overflow-y-auto">
              {(() => {
                const trans = selectedItemDetail.translations || {};
                const desc = trans.ro || trans.en || selectedItemDetail.description || '';
                if (!desc) return <p className="text-slate-400 italic">Nicio descriere detaliată disponibilă în Syrve.</p>;
                return <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: desc.replace(/\n/g, '<br/>') }} />;
              })()}

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                {selectedItemDetail.weight != null && <p className="text-sm text-slate-500"><strong className="text-slate-700 dark:text-white">Greutate:</strong> {selectedItemDetail.weight} kg</p>}
                {selectedItemDetail.energyAmount != null && <p className="text-sm text-slate-500"><strong className="text-slate-700 dark:text-white">Energie:</strong> {selectedItemDetail.energyAmount} Kcal</p>}
                {selectedItemDetail.fatAmount != null && <p className="text-sm text-slate-500"><strong className="text-slate-700 dark:text-white">Grăsimi:</strong> {selectedItemDetail.fatAmount}g</p>}
                {selectedItemDetail.proteinsAmount != null && <p className="text-sm text-slate-500"><strong className="text-slate-700 dark:text-white">Proteine:</strong> {selectedItemDetail.proteinsAmount}g</p>}
                {selectedItemDetail.carbohydratesAmount != null && <p className="text-sm text-slate-500"><strong className="text-slate-700 dark:text-white">Carbohidrați:</strong> {selectedItemDetail.carbohydratesAmount}g</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}

function StatCard({ label, value, color, large, brandId, icon: Icon, onClick, active }) {
  // Parse currency if present (e.g. "3 645 lei")
  const isCurrency = typeof value === 'string' && value.includes('lei');
  const displayVal = isCurrency ? value.replace('lei', '').trim() : value;
  const valLength = String(displayVal).length;

  // Adaptive font sizing:
  // User explicitly asked: "fă mai mic număr comenzi și suma să se vadă întreagă"
  let fontSizeClass = 'text-lg';
  if (isCurrency) {
    if (valLength > 8) fontSizeClass = 'text-sm';
    else if (valLength > 5) fontSizeClass = 'text-base';
    else fontSizeClass = 'text-lg';
  } else {
    // Number of orders & brand counts: compact, clean and elegant
    fontSizeClass = valLength > 4 ? 'text-base' : 'text-lg';
  }

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border px-3 py-2.5 flex items-center justify-between min-w-[120px] flex-1 relative overflow-hidden transition-all duration-200 group select-none ${
        active 
          ? 'ring-2 ring-blue-500 border-blue-500 shadow-md scale-[1.02]' 
          : 'border-slate-200 dark:border-slate-800'
      } ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`} 
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex flex-col justify-center min-w-0 pr-1 z-10 flex-1">
        <div className="flex items-baseline gap-1 whitespace-nowrap overflow-visible">
          <span className={`font-black text-slate-900 dark:text-white tracking-tight ${fontSizeClass}`}>
            {displayVal}
          </span>
          {isCurrency && (
            <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
              lei
            </span>
          )}
        </div>
        {!brandId && (
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title={label}>
            {label}
          </span>
        )}
      </div>

      {brandId ? (
        <div className="flex flex-col items-center justify-center shrink-0 ml-1.5 z-10">
          <div className="relative">
            {/* 3D Atmosphere Glow behind avatar */}
            <div 
              className="absolute -inset-1 rounded-full blur-sm opacity-35 group-hover:opacity-75 transition-opacity pointer-events-none"
              style={{ backgroundColor: color }}
            />
            {/* 3D Raised Bezel Container with Specular Top Highlight */}
            <div 
              className="relative w-8.5 h-8.5 rounded-full p-0.5 flex items-center justify-center bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 border border-white/80 dark:border-slate-600/60 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
              style={{ 
                boxShadow: `0 3px 8px ${color}40, 0 1px 2px rgba(0,0,0,0.1), inset 0 1.5px 2px rgba(255,255,255,0.85)` 
              }}
            >
              <BrandLogo brandId={brandId} size={24} className="rounded-full shadow-inner" />
            </div>
          </div>
          {/* Denumire brand aliniată sub avatar */}
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap text-center max-w-[76px] overflow-hidden text-ellipsis" title={label}>
            {label}
          </span>
        </div>
      ) : Icon ? (
        <div className="relative shrink-0 ml-1.5">
          <div 
            className="absolute -inset-1 rounded-full blur-sm opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none"
            style={{ backgroundColor: color }}
          />
          <div 
            className="relative w-8.5 h-8.5 rounded-full flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
            style={{ 
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              boxShadow: `0 3px 8px ${color}35, 0 1px 2px rgba(0,0,0,0.1), inset 0 1.5px 2px rgba(255,255,255,0.4)` 
            }}
          >
            <Icon size={16} strokeWidth={2.5} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrdersTable({ orders, full, onRowClick, selectedId, defaultRows = 10 }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultRows);

  const safeOrders = useMemo(() => {
    if (!orders || !orders.length) return [];
    const seen = new Set();
    return orders.filter(o => {
      const key = o._id || o.id || o.orderNumber;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [orders]);
  const totalPages = Math.max(1, Math.ceil(safeOrders.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  if (safePage !== currentPage) setCurrentPage(safePage);

  const paginated = safeOrders.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <th className="w-14 px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">Nr.</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500"># Comandă</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Brand</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Locație</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Comandă / Plată</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</th>
            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm font-medium">
                Nicio comandă găsită în perioada selectată.
              </td>
            </tr>
          ) : (
            paginated.map((o, index) => {
              const sc = getOrderStatus(o);
              const rowNumber = (safePage - 1) * itemsPerPage + index + 1;
              return (
                <tr key={o._id} className={`transition-colors group cursor-pointer ${selectedId === o._id ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} onClick={() => onRowClick && onRowClick(o)}>
                  <td className="w-14 px-4 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                    {rowNumber}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">#{o.orderNumber}{o.fiscal && <span title={`CUI: ${o.fiscal.rawCui || o.fiscal.cui}`} className="inline-flex items-center text-indigo-600 dark:text-indigo-400"><Building2 size={13} /></span>}</span>
                      {o.createdAt && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(o.createdAt).toLocaleString('ro-RO')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <BrandLogo brandId={o.brand} size={28} className="shadow-xs shrink-0" />
                      <span style={{ color: BRAND_COLORS[o.brand] }} className="text-sm font-bold">
                        {o.brand}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                        {o.locationName || o.locationId || '—'}
                      </span>
                      {o.syrveOrderId && (
                        <div className="flex items-center gap-1 mt-0.5" title={o.syrveOrderId}>
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            {o.syrveOrderId}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(o.syrveOrderId);
                              const btn = e.currentTarget;
                              const originalHTML = btn.innerHTML;
                              btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#059669" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
                              setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
                            }}
                            className="text-slate-400 hover:text-emerald-500 transition-colors"
                            title="Copiază ID iiko"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                        {o.orderType === 'dine-in' ? (o.tableNumber ? `Masa ${o.tableNumber}` : 'La masă') : 'La pachet'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Plată: {o.paymentMethod === 'cash' ? 'Cash' : (o.paymentMethod === 'card' ? 'Card' : (o.paymentMethod || '—'))}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{formatThousands(o.totalAmount || 0)} lei</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ backgroundColor: `${sc.color}20`, color: sc.color, border: `1px solid ${sc.color}40` }}>
                      ● {sc.label}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Pagination Footer - Always Visible */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 gap-4">
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            Afișează
            <select 
              value={itemsPerPage} 
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 font-medium outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={999999}>Toți</option>
            </select>
          </span>
          <span>Total înregistrări: <strong className="text-slate-700 dark:text-slate-300">{safeOrders.length}</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">Pagina {currentPage} din {totalPages}</span>
          <div className="flex gap-1">
            {[
              { label: '«', action: () => setCurrentPage(1),           disabled: currentPage === 1 },
              { label: '‹', action: () => setCurrentPage(p => p - 1),  disabled: currentPage === 1 },
              { label: '›', action: () => setCurrentPage(p => p + 1),  disabled: currentPage === totalPages },
              { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                disabled={btn.disabled}
                className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${btn.disabled ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95'}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {full && (
        <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Total Comenzi Active</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatThousands(orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totalAmount || 0), 0))} lei
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Total Comenzi Anulate</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatThousands(orders.filter(o => o.status === 'cancelled').reduce((s, o) => s + (o.totalAmount || 0), 0))} lei
            </p>
          </div>
        </div>
      )}
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

  if (loading) return <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 animate-pulse h-64"></div>;

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
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
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

function KiosksManager({ backend, kiosksLiveStatus = {} }) {
  const { fetchWithAuth } = useAuth();
  const [locations, setLocations] = useState([]);
  const [brandsData, setBrandsData] = useState([]);
  const [allMenus, setAllMenus] = useState({});
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('online'); // 'all' | 'online' (default online)
  const [revealedPins, setRevealedPins] = useState(new Set()); // IDs of kiosks with revealed PINs
  const [editingLoc, setEditingLoc] = useState(null);
  const [editingTab, setEditingTab] = useState('design');
  const [restartingId, setRestartingId] = useState(null); // ID of loc currently restarting
  const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }

  const toggleRevealPin = (id) => {
    setRevealedPins(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isLocOnline = (loc) => {
    if (!loc) return false;
    const live = kiosksLiveStatus[loc.id] || 
                 (loc.kioskUrl ? kiosksLiveStatus[loc.kioskUrl] : null) ||
                 (loc.aliases && Array.isArray(loc.aliases) ? loc.aliases.map(a => kiosksLiveStatus[a]).find(Boolean) : null);
    return Boolean(live && (live.isLive || live.online || (live.onlineCount > 0)));
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchLocs = () => {
    setLoading(true);
    Promise.all([
      fetchWithAuth(`${backend}/api/locations`).then(r => r.json()).catch(err => {
        console.error('[Kiosks] fetch locations error:', err);
        return { locations: [] };
      }),
      fetchWithAuth(`${backend}/api/brands`).then(r => r.json()).catch(() => ({ brands: [] })),
      fetchWithAuth(`${backend}/api/menu/all`).then(r => r.json()).catch(() => ({}))
    ])
      .then(([locData, bData, mData]) => {
        const rawLocs = locData?.locations || (Array.isArray(locData) ? locData : []);
        setLocations(rawLocs);
        setBrandsData(bData.brands || []);
        setAllMenus(mData || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  useEffect(fetchLocs, [backend]);

  const getKioskMenuStats = (loc) => {
    const brandsArr = loc.brands && loc.brands.length > 0 ? loc.brands : (loc.brandId ? [loc.brandId] : ['smashme']);
    let totalCount = 0;
    let visibleCount = 0;
    let isCustom = false;
    let profileName = null;
    let hasExplicitOverrides = false;

    for (const bId of brandsArr) {
      const brandMenuObj = allMenus[bId]?.menu;
      const allProds = brandMenuObj?.products || [];
      const allCats = brandMenuObj?.categories || [];
      
      const bData = brandsData.find(b => b.id === bId);
      const profiles = bData?.data?.menuProfiles || [];
      const overrides = loc.menuOverrides?.[bId] || {};
      
      let profile = null;
      if (overrides.profileId) {
        profile = profiles.find(p => p.id === overrides.profileId);
        if (profile) profileName = profile.name;
      }
      
      const rootFolderId = overrides.rootFolderId || profile?.rootFolderId || null;
      const templateHidden = profile?.hiddenItems || {};
      const localHidden = overrides.hiddenItems || {};
      
      const mergedHidden = { ...templateHidden };
      for (const [k, v] of Object.entries(localHidden)) {
        mergedHidden[k] = v;
      }
      
      const hasAnyHidden = Object.values(mergedHidden).some(v => v === true);
      if (rootFolderId || hasAnyHidden || overrides.profileId) {
        hasExplicitOverrides = true;
      }

      if (allProds.length === 0) continue;
      totalCount += allProds.length;
      
      // Calculate surviving categories & products
      let finalCategories = allCats;
      if (rootFolderId) {
        const getDescendantsAndSelf = (parentId, cats) => {
          const self = cats.find(c => c.id === parentId);
          if (!self) return [];
          const children = cats.filter(c => c.parentGroup === parentId);
          return [self, ...children.flatMap(c => getDescendantsAndSelf(c.id, cats))];
        };
        const scoped = getDescendantsAndSelf(rootFolderId, finalCategories);
        if (scoped.length > 0) finalCategories = scoped;
      }
      
      let categoriesToKeep = [];
      for (const cat of finalCategories) {
        let isHidden = false;
        let cur = cat;
        while (cur) {
          if (mergedHidden[cur.id] === true) { isHidden = true; break; }
          cur = finalCategories.find(c => c.id === cur.parentGroup);
        }
        if (!isHidden) categoriesToKeep.push(cat);
      }
      
      const validCatIds = new Set(categoriesToKeep.map(c => c.id));
      const surviving = allProds.filter(p => validCatIds.has(p.categoryId) && mergedHidden[p.id] !== true);
      
      visibleCount += surviving.length;
    }

    if (totalCount === 0) {
      return { isCustom: hasExplicitOverrides, profileName, totalCount: null, visibleCount: null, hiddenCount: 0 };
    }

    isCustom = hasExplicitOverrides || (visibleCount < totalCount);

    return {
      isCustom,
      totalCount,
      visibleCount,
      profileName,
      hiddenCount: Math.max(0, totalCount - visibleCount)
    };
  };

  if (loading) return <p className="loading-text">Se încarcă kioskurile...</p>;

  if (editingLoc) {
    return <KioskSettingsForm loc={editingLoc} backend={backend} initialTab={editingTab} onBack={() => setEditingLoc(null)} onSave={fetchLocs} />;
  }

  const brandMeta = {
    smashme:     { name: 'SmashMe',     color: '#ef4444' },
    crunch:      { name: 'Crunch',      color: '#eab308' },
    rollmaster:  { name: 'Roll Master', color: '#e31e24' },
    lovesushi:   { name: 'Love Sushi',  color: '#ec4899' },
    pokiwoki:    { name: 'Poki-Woki',   color: '#f97316' },
    welovesushi: { name: 'WeLoveSushi', color: '#6366f1' },
  };

  const allBrandIds = new Set();
  locations.forEach(l => {
     if (l.brands && Array.isArray(l.brands)) {
       l.brands.forEach(b => {
         const norm = (b === 'sushimaster' || b === 'ikura') ? 'rollmaster' : b;
         allBrandIds.add(norm);
       });
     } else if (l.brandId) {
       const norm = (l.brandId === 'sushimaster' || l.brandId === 'ikura') ? 'rollmaster' : l.brandId;
       allBrandIds.add(norm);
     }
  });
  const brandIds = [...allBrandIds];

  const totalOnlineCount = locations.filter(isLocOnline).length;

  let filtered = locations;
  if (brandFilter !== 'all') {
    filtered = filtered.filter(l => {
      const bList = (l.brands || (l.brandId ? [l.brandId] : [])).map(b => (b === 'sushimaster' || b === 'ikura') ? 'rollmaster' : b);
      return bList.includes(brandFilter);
    });
  }

  if (statusFilter === 'online') {
    filtered = filtered.filter(isLocOnline);
  }

  const sorted = [...filtered].sort((a, b) => {
    const aOnline = isLocOnline(a);
    const bOnline = isLocOnline(b);
    if (aOnline !== bOnline) {
      return aOnline ? -1 : 1; // Online-first: Kiosk-urile conectate apar mereu primele în listă
    }
    return (a.name || '').localeCompare(b.name || '');
  });
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
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
          <button
            className={`shrink-0 px-5 h-10 rounded-full text-sm font-bold flex items-center gap-2 border transition-colors ${brandFilter === 'all' && statusFilter === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            onClick={() => {
              setBrandFilter('all');
              setStatusFilter('all');
              setCurrentPage(1);
            }}
          >
            Toate ({locations.length})
          </button>

          <button
            className={`shrink-0 px-4 h-10 rounded-full text-sm font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              statusFilter === 'online'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20 ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            onClick={() => {
              setStatusFilter(prev => prev === 'online' ? 'all' : 'online');
              setCurrentPage(1);
            }}
            title="Filtrează doar kiosk-urile conectate online"
          >
            <span className={`w-2 h-2 rounded-full ${statusFilter === 'online' ? 'bg-white' : 'bg-emerald-500'} ${totalOnlineCount > 0 ? 'animate-pulse' : ''}`} />
            <span>Online ({totalOnlineCount})</span>
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
      </div>

      {/* Tabel Business */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-left whitespace-nowrap">#</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 min-w-[200px]">Denumire</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Meniu</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Program</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Stare</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginated.map((loc, index) => {
              const finalKioskUrl = loc.kioskUrl ? `https://kiosk-smashme.netlify.app/?loc=${loc.kioskUrl}` : `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;
              const brandsArr = [...new Set((loc.brands && loc.brands.length > 0 ? loc.brands : (loc.brandId ? [loc.brandId] : (loc.name && loc.name.toLowerCase().includes('roll') ? ['rollmaster'] : (loc.name && loc.name.toLowerCase().includes('smash') ? ['smashme'] : [])))).map(b => (b === 'sushimaster' || b === 'ikura') ? 'rollmaster' : b))];
              const displayBrands = brandsArr.length > 1 && loc.name 
                ? (brandsArr.filter(b => loc.name.toLowerCase().replace(/[\s\-_]+/g, '').includes(b)).length > 0
                    ? brandsArr.filter(b => loc.name.toLowerCase().replace(/[\s\-_]+/g, '').includes(b))
                    : brandsArr)
                : brandsArr;
              const menuStats = getKioskMenuStats(loc);
              const live = kiosksLiveStatus[loc.id] || 
                           (loc.kioskUrl ? kiosksLiveStatus[loc.kioskUrl] : null) ||
                           (loc.aliases && Array.isArray(loc.aliases) ? loc.aliases.map(a => kiosksLiveStatus[a]).find(Boolean) : null);
              const isOnline = isLocOnline(loc);
              const isLocked = live ? (live.isLocked || live.screen === 'pin') : false;
              
              return (
                <tr key={loc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4 text-sm text-slate-400 font-medium whitespace-nowrap">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <button 
                        type="button"
                        onClick={() => { setEditingLoc(loc); setEditingTab('design'); }}
                        title={`Apasă pentru setările chioșcului ${loc.name}`}
                        className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all whitespace-nowrap cursor-pointer"
                      >
                        {displayBrands.length > 0 && (
                          <div className="flex items-center gap-1 shrink-0">
                            {displayBrands.map(b => (
                              <BrandLogo key={b} brandId={b} size={18} />
                            ))}
                          </div>
                        )}
                        <span>{loc.name}</span>
                      </button>
                      <div className="flex items-center gap-2 text-[11px] font-medium whitespace-nowrap">
                        <a 
                          href={`/kiosk/${loc.kioskUrl || loc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title={`Deschide chioșcul live (${loc.kioskUrl || loc.id})`}
                          className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                        >
                          URL: {loc.kioskUrl || loc.id}
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      {menuStats.isCustom ? (
                        <button 
                          type="button"
                          onClick={() => { setEditingLoc(loc); setEditingTab('menu'); }}
                          title={`Meniu Personalizat: ${menuStats.visibleCount !== null ? `${menuStats.visibleCount}/${menuStats.totalCount} produse` : ''} ${menuStats.hiddenCount > 0 ? `(${menuStats.hiddenCount} ascunse)` : ''}${menuStats.profileName ? ` - Profil: ${menuStats.profileName}` : ''}. Apasă pentru configurare.`}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all whitespace-nowrap cursor-pointer"
                        >
                          <span className="text-white">Meniu Personalizat</span>
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => { setEditingLoc(loc); setEditingTab('menu'); }}
                          title={`Meniu Complet${menuStats.totalCount ? ` (${menuStats.totalCount} produse)` : ''}. Apasă pentru configurare.`}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all whitespace-nowrap cursor-pointer"
                        >
                          <span className="text-white">Meniu Complet</span>
                        </button>
                      )}
                      {/* Detalii Meniu sub buton - exact 1 singur rând compact (maxim 2 rânduri per celulă) */}
                      <div 
                        className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[260px] leading-tight"
                        title={menuStats.isCustom 
                          ? `${menuStats.profileName ? `Profil: ${menuStats.profileName} • ` : ''}${menuStats.visibleCount}/${menuStats.totalCount} produse${menuStats.hiddenCount > 0 ? ` (${menuStats.hiddenCount} ascunse)` : ''}`
                          : `${menuStats.totalCount || 'Toate'} produse active`
                        }
                      >
                        {menuStats.isCustom ? (
                          <span className="inline-flex items-center gap-1">
                            {menuStats.profileName && (
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {menuStats.profileName} •
                              </span>
                            )}
                            <span>{menuStats.visibleCount}/{menuStats.totalCount} prod</span>
                            {menuStats.hiddenCount > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                (-{menuStats.hiddenCount})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span>{menuStats.totalCount ? `${menuStats.totalCount} produse active` : 'Toate produsele active'}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      {loc.lockScheduleActive ? (
                        <button 
                          type="button"
                          onClick={() => { setEditingLoc(loc); setEditingTab('system'); }}
                          title={`Orar blocare: ${loc.lockStartTime || '22:00'} - ${loc.lockEndTime || '09:00'}. Apasă pentru configurare.`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all whitespace-nowrap cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Orar: {loc.lockStartTime || '22:00'} - {loc.lockEndTime || '09:00'}</span>
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => { setEditingLoc(loc); setEditingTab('system'); }}
                          title="Fără program automat de blocare. Apasă pentru configurare orar."
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-all whitespace-nowrap cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Fără program</span>
                        </button>
                      )}
                      {/* PIN sub butonul de program */}
                      {loc.kioskPin ? (
                        <div className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                          <span>PIN: {revealedPins.has(loc.id) ? loc.kioskPin : '••••'}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRevealPin(loc.id);
                            }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded focus:outline-none cursor-pointer"
                            title={revealedPins.has(loc.id) ? 'Ascunde PIN' : 'Arată PIN'}
                          >
                            {revealedPins.has(loc.id) ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-normal whitespace-nowrap">
                          Fără PIN
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <div 
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm whitespace-nowrap ${
                          isOnline ? 'bg-emerald-600' : 'bg-slate-500 dark:bg-slate-600'
                        }`}
                        title={isOnline ? 'Chioșcul este activ și comunică în timp real' : 'Chioșcul este offline (deconectat)'}
                      >
                        <span 
                          className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-white animate-pulse' : 'bg-slate-300'}`} 
                        />
                        <span>{isOnline ? 'Conectat' : (loc.active ? 'Offline' : 'Inactiv')}</span>
                        {isOnline && isLocked && (
                          <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-600 text-white">
                            <Lock className="w-2.5 h-2.5 text-white" /> Blocat PIN
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                        {isOnline ? (isLocked ? 'Ecran blocat (PIN)' : 'Online acum') : (loc.active ? 'Offline' : 'Inactiv')}
                      </span>
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
                        onClick={() => { setEditingLoc(loc); setEditingTab('design'); }}
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
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                className={`w-8 h-8 rounded-full border text-sm font-bold flex items-center justify-center transition-colors ${btn.disabled ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'}`}
              >{btn.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
    {toast && (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        background: toast.type === 'error' ? '#ef4444' : '#059669',
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
  const colors = { idle: 'var(--surface)', sending: '#f59e0b', ok: '#059669', err: '#ef4444' };
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

/* ─── KIOSK SETTINGS REUSABLE CONTROLS ─── */
function KioskSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function KioskColorPicker({ label, value, onChange, placeholder, allowClear, clearValue = 'transparent', clearLabel = 'Fără' }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="relative w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex items-center justify-center shrink-0 cursor-pointer bg-slate-100 dark:bg-slate-800">
          <input
            type="color"
            value={value && value.startsWith('#') && value.length === 7 ? value : '#0f172a'}
            onChange={e => onChange(e.target.value)}
            className="absolute -inset-2 w-14 h-14 cursor-pointer opacity-0"
          />
          <div 
            className="w-full h-full border border-black/10" 
            style={{ backgroundColor: value || 'transparent' }} 
          />
        </div>
        <input
          type="text"
          value={value || ''}
          placeholder={placeholder || '#000000'}
          onChange={e => onChange(e.target.value)}
          className="w-28 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {allowClear && (
          <button
            type="button"
            onClick={() => onChange(clearValue)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
          >
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function parseFooterDetails(rawText, explicitWebsite, explicitPhone) {
  let website = (explicitWebsite || '').trim();
  let phone = (explicitPhone || '').trim();
  let extra = '';

  const fullText = (rawText || '').trim();
  if (!fullText && !website && !phone) return { website: '', phone: '', extra: '' };

  if (!website && fullText) {
    const webMatch = fullText.match(/(?:https?:\/\/|(?:www\w*\.))[^\s•|,;]+|[a-zA-Z0-9-]+\.(?:ro|com|eu|net|org|io|app|menu|site|info)\b[^\s•|,;]*/i);
    if (webMatch) {
      website = webMatch[0].trim();
    }
  }

  if (!phone && fullText) {
    const textWithoutWeb = website ? fullText.replace(website, '') : fullText;
    const phoneMatch = textWithoutWeb.match(/(?:\+?4?0\s*)?(?:0[1-9][\d\s\.\-]{7,15}|\+?[\d\s\.\-]{9,16})/);
    if (phoneMatch) {
      const candidate = phoneMatch[0].trim();
      const digitCount = (candidate.match(/\d/g) || []).length;
      if (digitCount >= 8) {
        phone = candidate;
      }
    }
  }

  if (fullText) {
    let rem = fullText;
    if (website) rem = rem.replace(website, '');
    if (phone) rem = rem.replace(phone, '');
    rem = rem.replace(/^[•\s\-\|,;:]+|[•\s\-\|,;:]+$/g, '').trim();
    if (rem && rem.length > 1) {
      extra = rem;
    }
  }

  return { website, phone, extra };
}

function KioskSettingsForm({ loc, backend, initialTab = 'design', onBack, onSave }) {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState(initialTab || 'design');
  const [formData, setFormData] = useState({
    name: loc.name || '',
    kioskUrl: loc.kioskUrl || '',
    posterUrl: loc.posterUrl || '',
    posterRotation: loc.posterRotation || 0,
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
    bottomBannerInfoBg: loc.bottomBannerInfoBg || '',
    kioskPin: loc.kioskPin || '',
    vendorPin: loc.vendorPin || '',
    lockScheduleActive: loc.lockScheduleActive || false,
    lockScheduleMode: loc.lockScheduleMode || 'daily',
    lockDays: Array.isArray(loc.lockDays) ? loc.lockDays : [1, 2, 3, 4, 5, 6, 0],
    lockStartTime: loc.lockStartTime || '22:00',
    lockEndTime: loc.lockEndTime || '09:00',
    lockAutoUnlock: loc.lockAutoUnlock !== undefined ? loc.lockAutoUnlock : true,
    brands: loc.brands || [],
    promoActive: loc.promoActive || false,
    promoBrandId: loc.promoBrandId || '',
    promoMinOrderValue: loc.promoMinOrderValue || 0,
    promoOrdersToAppear: loc.promoOrdersToAppear || 1,
    languages: loc.languages && loc.languages.length > 0 ? loc.languages : ['ro'],
    defaultLanguage: loc.defaultLanguage || (loc.languages && loc.languages.length > 0 ? loc.languages[0] : 'ro'),
    langButtonColor: loc.langButtonColor || '#0f172a',
    langButtonTextColor: loc.langButtonTextColor || '#ffffff',
    langButtonBorderColor: loc.langButtonBorderColor || 'transparent',
    langButtonText: loc.langButtonText || '',
    langButtonFlagColors: loc.langButtonFlagColors || false,
    langVerticalPosition: loc.langVerticalPosition || 'bottom',
    langSelectorPosition: loc.langSelectorPosition || 'after',
    langBgColor: loc.langBgColor || '',
    langBorderColor: loc.langBorderColor || '',
    langBarBg: loc.langBarBg || '',
    menuOverrides: loc.menuOverrides || {},
    paymentGateway: loc.paymentGateway || 'none',
    kioskUiSize: loc.kioskUiSize || 'S',
    visualEffects: loc.visualEffects || { parallax: true, steam: true, snow: false },
    categoryHeroActive: loc.categoryHeroActive ?? false,
    categoryHeroSteam: loc.categoryHeroSteam ?? true,
    categoryHeroProductId: loc.categoryHeroProductId || '',
    categoryHeroInterval: loc.categoryHeroInterval ?? 5,
    upsellActive: loc.upsellActive ?? false,
    startPromoLayout: loc.startPromoLayout || 'carousel',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showWheelPreviewFull, setShowWheelPreviewFull] = useState(false);
  const [editingMenuBrand, setEditingMenuBrand] = useState(null);
  const [uploadingScreensaver, setUploadingScreensaver] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBottomMedia, setUploadingBottomMedia] = useState(false);

  const handleScreensaverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingScreensaver(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetchWithAuth(`${backend}/api/locations/${loc.id}/screensaver`, {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (data.ok) {
        setFormData(prev => ({ ...prev, posterUrl: data.posterUrl }));
      } else {
        confirm('Eroare: ' + data.error, { title: 'Eroare Încărcare Screensaver', danger: true, hideCancel: true, okLabel: 'Închide' });
      }
    } catch (err) {
      confirm('Eroare la încărcarea imaginii pe server.', { title: 'Eroare Screensaver', danger: true, hideCancel: true, okLabel: 'Închide' });
    }
    setUploadingScreensaver(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetchWithAuth(`${backend}/api/locations/${loc.id}/upload-asset`, {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (data.ok && (data.url || data.posterUrl)) {
        setFormData(prev => ({ ...prev, bottomBannerLogoUrl: data.url || data.posterUrl }));
      } else {
        confirm(data.error || 'Nu s-a putut încărca sigla.', { title: 'Eroare Siglă', danger: true, hideCancel: true, okLabel: 'Închide' });
      }
    } catch (err) {
      confirm('Eroare la încărcarea siglei pe server.', { title: 'Eroare Siglă', danger: true, hideCancel: true, okLabel: 'Închide' });
    }
    setUploadingLogo(false);
  };

  const handleBottomMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBottomMedia(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetchWithAuth(`${backend}/api/locations/${loc.id}/upload-asset`, {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (data.ok && (data.url || data.posterUrl)) {
        setFormData(prev => ({ ...prev, bottomBannerUrl: data.url || data.posterUrl }));
      } else {
        confirm(data.error || 'Nu s-a putut încărca fișierul media.', { title: 'Eroare Media', danger: true, hideCancel: true, okLabel: 'Închide' });
      }
    } catch (err) {
      confirm('Eroare la încărcarea fișierului media pe server.', { title: 'Eroare Media', danger: true, hideCancel: true, okLabel: 'Închide' });
    }
    setUploadingBottomMedia(false);
  };

  const [promosData, setPromosData] = useState({});
  useEffect(() => {
    fetchWithAuth(`${backend}/api/promotions`)
      .then(r => r.json())
      .then(d => setPromosData(d || {}))
      .catch(() => {});
  }, [backend, fetchWithAuth]);

  // Derived: active brands for this location
  const activeBrands = formData.brands && formData.brands.length > 0 ? formData.brands : (loc.brands && loc.brands.length > 0 ? loc.brands : []);

  const [brandProfiles, setBrandProfiles] = useState({});
  useEffect(() => {
    activeBrands.forEach(brandId => {
      fetchWithAuth(`${backend}/api/brands/${brandId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
             setBrandProfiles(prev => ({ 
               ...prev, 
               [brandId]: { brand: d, profiles: d.data?.menuProfiles || [] } 
             }));
          }
        })
        .catch(() => {});
    });
  }, [backend, activeBrands.join(',')]);

  // Toggles for optional sections
  const [usePin, setUsePin] = useState(!!loc.kioskPin || !!loc.vendorPin || !!loc.lockScheduleActive);
  const [showManagerPin, setShowManagerPin] = useState(false);
  const [showVendorPin, setShowVendorPin] = useState(false);
  const [useBanner, setUseBanner] = useState(() => {
    if (loc.topBannerActive !== undefined) return Boolean(loc.topBannerActive);
    if (loc.topBannerUrl && String(loc.topBannerUrl).trim()) return true;
    return Object.keys(loc).some(k => k.startsWith('topBannerUrl_') && loc[k] && String(loc[k]).trim());
  });
  const [useBottomBanner, setUseBottomBanner] = useState(!!(loc.bottomBannerContent || loc.bottomBannerUrl || loc.bottomBannerText || loc.bottomBannerLogoUrl));

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
    const finalData = { ...formData };
    if (!usePin) {
      finalData.kioskPin = '';
      finalData.vendorPin = '';
      finalData.lockScheduleActive = false;
    }
    finalData.topBannerActive = Boolean(useBanner);
    if (!useBanner) {
      finalData.topBannerUrl = '';
      Object.keys(finalData).forEach(k => {
        if (k.startsWith('topBannerUrl_')) {
          finalData[k] = '';
        }
      });
    }
    if (!useBottomBanner) { 
      finalData.bottomBannerUrl = ''; 
      finalData.bottomBannerText = ''; 
      finalData.bottomBannerContent = ''; 
      finalData.bottomBannerLogoUrl = '';
    }

    try {
      await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });
      setSaveSuccess(true);
      onSave();
      setTimeout(() => {
        onBack();
      }, 1000);
    } catch(e) {
      console.error('Eroare la salvare.');
      setIsSaving(false);
    }
  };

  const renderPreview = (u, rotation = 0) => {
    if (!u) return null;
    let style = { width: '100%', height: '100%', objectFit: 'contain', border: 'none' };
    
    if (rotation === 90 || rotation === 270) {
      style = { 
        ...style,
        width: '177.77%',
        height: '56.25%',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) rotate(${rotation}deg)` 
      };
    } else if (rotation === 180) {
      style = { ...style, transform: `rotate(180deg)` };
    }

    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) {
      return <video src={u} autoPlay muted loop style={style} />;
    } else if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(u)) {
      return <img src={u} alt="Preview" style={style} />;
    } else {
      return <iframe src={u} title="Preview" style={style} />;
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
          onSave={async (updatedConfig) => {
             const brandId = editingMenuBrand.brand.id;
             const newOverrides = { ...formData.menuOverrides };
             if (!newOverrides[brandId]) newOverrides[brandId] = {};
             newOverrides[brandId].hiddenItems = updatedConfig.hiddenItems;

             // Actualizare sau creare profil de meniu pentru brand dacă numele a fost editat
             const brand = editingMenuBrand.brand;
             const currentProfiles = brand.data?.menuProfiles || [];
             let updatedProfiles = [...currentProfiles];
             const trimmedName = (updatedConfig.name || '').trim();
             let profileModified = false;

             if (editingMenuBrand.profile?.id) {
               if (trimmedName && trimmedName !== editingMenuBrand.profile.name) {
                 updatedProfiles = currentProfiles.map(p => 
                   p.id === editingMenuBrand.profile.id ? { ...p, name: trimmedName } : p
                 );
                 profileModified = true;
               }
             } else if (trimmedName && trimmedName !== 'Meniu Complet (Fără Șablon)' && trimmedName !== 'Meniu Personalizat') {
               const newProfId = 'prof_' + Date.now().toString(36);
               const newProf = {
                 id: newProfId,
                 name: trimmedName,
                 rootFolderId: updatedConfig.rootFolderId || null,
                 hiddenItems: updatedConfig.hiddenItems || {}
               };
               updatedProfiles.push(newProf);
               newOverrides[brandId].profileId = newProfId;
               profileModified = true;
             }

             if (profileModified) {
               try {
                 const updatedBrand = { ...brand, data: { ...brand.data, menuProfiles: updatedProfiles } };
                 await fetchWithAuth(`${backend}/api/brands/${brandId}`, {
                   method: 'PUT',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(updatedBrand)
                 });
                 setBrandProfiles(prev => ({
                   ...prev,
                   [brandId]: { brand: updatedBrand, profiles: updatedProfiles }
                 }));
               } catch (err) {
                 console.error('Eroare salvare profil brand:', err);
               }
             }

             handleChange('menuOverrides', newOverrides);
             setEditingMenuBrand(null);
             try {
               await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ menuOverrides: newOverrides })
               });
             } catch (err) {
               console.error('Auto-save visibility error:', err);
             }
          }}
        />
      </div>
    );
  }

  const finalKioskUrl = formData.kioskUrl 
    ? `https://kiosk-smashme.netlify.app/?loc=${formData.kioskUrl}` 
    : `https://kiosk-smashme.netlify.app/?loc=${loc.id}`;

  const TABS = [
    { id: 'menu', label: 'Meniu Kiosk', icon: <Utensils className="w-4 h-4" /> },
    { id: 'design', label: 'Design & Efecte 3D', icon: <Palette className="w-4 h-4" /> },
    { id: 'screensaver', label: 'Screensaver Standby', icon: <MonitorSmartphone className="w-4 h-4" />, badge: formData.posterUrl ? 'Activ' : null },
    { id: 'marketing', label: 'Bannere & Promoții', icon: <Tags className="w-4 h-4" />, badge: (useBanner || useBottomBanner || formData.promoActive) ? 'Activat' : null },
    { id: 'languages', label: 'Limbi & Traduceri', icon: <Languages className="w-4 h-4" />, badge: `${(formData.languages || []).length} limbi` },
    { id: 'system', label: 'Hardware & Securitate', icon: <Sliders className="w-4 h-4" />, badge: formData.paymentGateway !== 'none' ? 'POS' : null },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* ─── TOP HEADER BAR ─── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Înapoi la lista de Kioskuri"
          >
            ← Înapoi
          </button>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span>Configurare Kiosk</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-[11px] font-medium text-slate-400">URL: {loc.kioskUrl || loc.id}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <input 
                type="text" 
                value={formData.name || ''} 
                onChange={e => handleChange('name', e.target.value)}
                placeholder="Nume Locație (ex: SmashMe Cluj)"
                className="text-xl font-bold text-slate-900 dark:text-white bg-transparent border-b-2 border-dashed border-blue-500/50 focus:border-blue-500 outline-none pb-0.5 min-w-[260px] transition-colors"
                title="Editează numele locației"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={finalKioskUrl}
            target="_blank" 
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Deschide Live
          </a>
          <RestartKioskBtn locId={loc.id} backend={backend} fetchWithAuth={fetchWithAuth} />
          <button 
            type="button"
            onClick={saveSettings} 
            disabled={isSaving || saveSuccess}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              saveSuccess 
                ? 'bg-emerald-600 shadow-emerald-500/30 ring-2 ring-emerald-400' 
                : isSaving 
                  ? 'bg-slate-700 opacity-80 cursor-wait' 
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-slate-900/20'
            }`}
          >
            {saveSuccess ? 'Configurație Salvată' : isSaving ? 'Se salvează...' : 'Salvează Schimbările'}
          </button>
        </div>
      </div>

      {/* ─── SUB-NAVIGATION TABS (STICKY & ALWAYS VISIBLE WITHOUT SCROLL) ─── */}
      <div className="sticky top-0 z-30 py-2 -my-1 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1.5 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm w-full">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-center ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700/80 ring-1 ring-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
                {tab.badge && (
                  <span className={`shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    isActive 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' 
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TAB: MENIU KIOSK ─── */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          {/* Card: Personalizare Meniu Kiosk */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Personalizare Meniu Kiosk</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configurează profilul de meniu pe care îl preia acest Kiosk pentru fiecare brand activ, sau editează vizibilitatea produselor strict pe această tabletă.
              </p>
            </div>

            <div className="space-y-3">
              {activeBrands.map(brandId => {
                const bData = brandProfiles[brandId];
                if (!bData || !bData.brand) return null;
                
                const brandOverrides = (formData.menuOverrides || {})[brandId] || {};
                const currentProfileId = brandOverrides.profileId || '';
                const localHiddenCount = Object.keys(brandOverrides.hiddenItems || {}).length;

                return (
                  <div key={brandId} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <BrandLogo brandId={brandId} size={22} />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Meniu {bData.brand.name}</span>
                    </div>

                    <div className="flex items-center gap-3 flex-1 justify-end min-w-[300px]">
                      <select
                        value={currentProfileId}
                        onChange={async (e) => {
                          const val = e.target.value;
                          const newOverrides = { ...formData.menuOverrides };
                          if (!newOverrides[brandId]) newOverrides[brandId] = { hiddenItems: {} };
                          newOverrides[brandId] = { ...newOverrides[brandId], profileId: val };
                          handleChange('menuOverrides', newOverrides);
                          try {
                            await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ menuOverrides: newOverrides })
                            });
                          } catch (err) {
                            console.error('Auto-save profile error:', err);
                          }
                        }}
                        className="px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white max-w-[260px]"
                      >
                        <option value="">Meniu Complet (Implicit)</option>
                        {bData.profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({Object.keys(p.hiddenItems || {}).length} ascunse)</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const overrides = formData.menuOverrides[brandId] || { hiddenItems: {} };
                          const profile = bData.profiles.find(p => p.id === overrides.profileId) || { name: 'Meniu Complet (Fără Șablon)', rootFolderId: null, hiddenItems: {} };
                          setEditingMenuBrand({
                            brand: bData.brand,
                            profile,
                            localHiddenItemsOverride: overrides.hiddenItems || {}
                          });
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          localHiddenCount > 0 
                            ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800' 
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Editează Vizibilitatea {localHiddenCount > 0 && `(${localHiddenCount} specifice)`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 1: DESIGN & EFECTE 3D ─── */}
      {activeTab === 'design' && (
        <div className="space-y-6">
          {/* Card 1: Efecte Vizuale Kiosk (VFX) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Efecte Vizuale Kiosk (VFX)</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                GPU Canvas 60 FPS
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Tehnologii tactile și particule organice rulate direct pe ecranul detaliilor de produs pentru apetit maxim.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Parallax 3D */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span>Parallax 3D Tilt</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Înclinare 3D dinamică la atingerea pozei de produs, cu reflexie luminoasă speculară.
                  </p>
                </div>
                <KioskSwitch
                  checked={formData.visualEffects?.parallax ?? true}
                  onChange={val => handleChange('visualEffects', { ...formData.visualEffects, parallax: val })}
                />
              </div>

              {/* Steam / Abur */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>Abur Cald (Steam)</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Vapori delicați de abur cald care se ridică peste burgeri și preparatele fierbinți.
                  </p>
                </div>
                <KioskSwitch
                  checked={formData.visualEffects?.steam ?? true}
                  onChange={val => handleChange('visualEffects', { ...formData.visualEffects, steam: val })}
                />
              </div>

              {/* Snow / Zapada */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Snowflake className="w-4 h-4 text-cyan-500" />
                    <span>Zăpadă (Snow)</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Fulgii de zăpadă interactivi pentru campanii tematice de iarnă sau sărbători.
                  </p>
                </div>
                <KioskSwitch
                  checked={formData.visualEffects?.snow ?? false}
                  onChange={val => handleChange('visualEffects', { ...formData.visualEffects, snow: val })}
                />
              </div>
            </div>
          </div>

          {/* Card: Experiență Meniu & Upsell (KFC Style) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <Star className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Experiență Meniu & Upsell (KFC Style)</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
                Opțiuni Kiosk
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Activează sau dezactivează funcțiile de promovare vizuală și cross-selling pe tableta Kiosk.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Produsul Vedetă */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                      <Star className="w-4 h-4 text-amber-500" />
                      <span>Produsul Vedetă (Category Hero)</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Afișează bannerul mare promoțional în capul fiecărei categorii din meniu cu cel mai recomandat preparat.
                    </p>
                  </div>
                  <KioskSwitch
                    checked={formData.categoryHeroActive ?? false}
                    onChange={val => handleChange('categoryHeroActive', val)}
                  />
                </div>

                {formData.categoryHeroActive && (
                  <div className="mt-2 pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Efect Abur Cald (Steam FX)</span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Animație organică de abur cald peste poza produsului.</p>
                      </div>
                      <KioskSwitch
                        checked={formData.categoryHeroSteam ?? true}
                        onChange={val => handleChange('categoryHeroSteam', val)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        Produs Fix (Opțional)
                      </label>
                      <input
                        type="text"
                        placeholder="Lăsați gol pentru primul produs din categorie (Implicit)"
                        value={formData.categoryHeroProductId || ''}
                        onChange={e => handleChange('categoryHeroProductId', e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Dacă este lăsat gol, se alege automat primul produs din fiecare categorie.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        ⏱ Viteză Rotație Produse Banner (secunde)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="2"
                          max="60"
                          value={formData.categoryHeroInterval ?? 5}
                          onChange={e => handleChange('categoryHeroInterval', Math.max(2, Math.min(60, Number(e.target.value) || 5)))}
                          className="w-24 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">secunde (implicit: 5 secunde)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Câte secunde stă afișat fiecare produs în banner înainte de a trece la următorul. Poate fi modificat și direct de pe ecranul chioșcului din Meniul Manager.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upsell Coș */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>Upsell la Coș („Doriți și...”)</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Deschide ecranul modal cu selector rapid de sosuri, garnituri și băuturi înainte de trecerea la plată.
                  </p>
                </div>
                <KioskSwitch
                  checked={formData.upsellActive ?? false}
                  onChange={val => handleChange('upsellActive', val)}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Mărime Interfață & Buton Principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* UI Scaling */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Mărime Butoane și Poze Produse</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                  Reglează densitatea și scara grafică generală pe tableta Kiosk.
                </p>

                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {[
                    { v: 'S', l: 'Mic', desc: 'Standard' },
                    { v: 'M', l: 'Mediu', desc: 'Echilibrat' },
                    { v: 'L', l: 'Mare', desc: 'Extra Vizibil' }
                  ].map(opt => {
                    const isSelected = (formData.kioskUiSize || 'S') === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => handleChange('kioskUiSize', opt.v)}
                        className={`py-3 px-2 rounded-lg text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-slate-750 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <div className="text-sm">{opt.l}</div>
                        <div className="text-[10px] opacity-75">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 flex items-center">
                <Info className="w-3.5 h-3.5 inline mr-1.5 text-blue-500 shrink-0" />
                <span>Pentru ecrane mai mici de 21" este recomandat modul <strong>Mediu</strong>.</span>
              </div>
            </div>

            {/* Buton Principal Începe Comanda */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Butonul Principal "Începe comanda"</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aspectul butonului central vizibil clienților la debutul comenzii.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Text Buton</label>
                <input
                  type="text"
                  placeholder="Începe comanda"
                  value={formData.langButtonText || ''}
                  onChange={e => handleChange('langButtonText', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <KioskColorPicker
                  label="Culoare Fundal"
                  value={formData.langButtonColor || '#0f172a'}
                  onChange={val => handleChange('langButtonColor', val)}
                />
                <KioskColorPicker
                  label="Culoare Text"
                  value={formData.langButtonTextColor || '#ffffff'}
                  onChange={val => handleChange('langButtonTextColor', val)}
                />
                <div className="sm:col-span-2">
                  <KioskColorPicker
                    label="Culoare Contur"
                    value={formData.langButtonBorderColor || 'transparent'}
                    onChange={val => handleChange('langButtonBorderColor', val)}
                    allowClear={true}
                    clearValue="transparent"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Folosește culorile tricolorului (suprascrie fundalul)
                </div>
                <KioskSwitch
                  checked={formData.langButtonFlagColors || false}
                  onChange={val => handleChange('langButtonFlagColors', val)}
                />
              </div>

              {/* Live Button Preview */}
              <div className="pt-2 flex flex-col items-center">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Previzualizare Buton</span>
                <div
                  className="px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
                  style={{
                    background: formData.langButtonFlagColors 
                      ? 'linear-gradient(90deg, #002B7F 0%, #002B7F 33.3%, #FCD116 33.3%, #FCD116 66.6%, #CE1126 66.6%, #CE1126 100%)'
                      : (formData.langButtonColor || '#0f172a'),
                    color: formData.langButtonTextColor || '#ffffff',
                    border: formData.langButtonBorderColor && formData.langButtonBorderColor !== 'transparent' 
                      ? `2px solid ${formData.langButtonBorderColor}` 
                      : 'none'
                  }}
                >
                  <span>{formData.langButtonText || 'Începe comanda'}</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SCREENSAVER STANDBY ─── */}
      {activeTab === 'screensaver' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Setări Standby */}
          <div className="lg:col-span-7 space-y-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Screensaver Standby (Reclamă)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rulează automat în format full-screen când tableta nu este atinsă timp de 30 de secunde.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <strong>Recomandare format:</strong> Video MP4 (codec h264) cu raport 9:16 (vertical) sau 16:9 rotit corespunzător. Fișierele sunt rulate în buclă infinită pe tot ecranul.
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                URL Video MP4 sau Imagine
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://... sau încarcă din PC"
                  value={formData.posterUrl || ''}
                  onChange={e => handleChange('posterUrl', e.target.value)}
                  className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <label className={`px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  uploadingScreensaver ? 'opacity-70 cursor-wait' : ''
                }`}>
                  {uploadingScreensaver ? (
                    'Se încarcă...'
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Încarcă</span>
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*,video/mp4"
                    className="hidden"
                    onChange={handleScreensaverUpload}
                    disabled={uploadingScreensaver}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Rotație Afișare Reclamă
              </label>
              <div className="grid grid-cols-4 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {[
                  { v: 0, l: '0° Normal' },
                  { v: 90, l: '90° Dreapta' },
                  { v: 180, l: '180° Invers' },
                  { v: 270, l: '270° Stânga' }
                ].map(rot => {
                  const isSelected = (formData.posterRotation || 0) === rot.v;
                  return (
                    <button
                      key={rot.v}
                      type="button"
                      onClick={() => handleChange('posterRotation', rot.v)}
                      className={`py-2 px-2 rounded-lg text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-slate-750 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                      }`}
                    >
                      {rot.l}
                    </button>
                  );
                })}
              </div>
            </div>

            {formData.posterUrl && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleChange('posterUrl', '')}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Șterge Screensaver</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Tablet Device Mockup */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Simulator Tabletă Standby (9:16)
            </span>

            {formData.posterUrl ? (
              <div className="w-[270px] h-[480px] rounded-[28px] overflow-hidden border-[10px] border-slate-900 bg-black relative shadow-2xl flex items-center justify-center">
                {renderPreview(formData.posterUrl, formData.posterRotation || 0)}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 text-slate-900 px-5 py-2 rounded-full text-xs font-black whitespace-nowrap shadow-xl backdrop-blur-sm pointer-events-none">
                  Atinge pentru a începe
                </div>
              </div>
            ) : (
              <div className="w-[270px] h-[480px] rounded-[28px] border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <MonitorSmartphone className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2" />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Niciun screensaver activ</span>
                <span className="text-xs text-slate-400 mt-1">Încarcă un video MP4 sau o imagine pentru a rula în standby.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: BANNER & PROMOȚII ─── */}
      {activeTab === 'marketing' && (
        <div className="space-y-6">
          {/* Card 1: Banner Promo Persistent (Top) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Banner Promo Persistent (Top / Sus)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ocupă partea superioară a ecranului (10%-30%) cu reclamă video/imagine permanentă.
                </p>
              </div>
              <KioskSwitch
                checked={useBanner}
                onChange={val => {
                  setUseBanner(val);
                  handleChange('topBannerActive', val);
                  if (!val) {
                    handleChange('topBannerUrl', '');
                    if (formData.brands) {
                      formData.brands.forEach(bId => {
                        handleChange(`topBannerUrl_${bId}`, '');
                      });
                    }
                  }
                }}
              />
            </div>

            {useBanner && (
              <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  {formData.brands && formData.brands.length > 0 ? (
                    formData.brands.map(brandId => {
                      const val = formData[`topBannerUrl_${brandId}`] ?? formData.topBannerUrl ?? '';
                      return (
                        <div key={brandId} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <BrandLogo brandId={brandId} size={16} /> Banner pentru {brandId}
                          </label>
                          <input
                            type="url"
                            placeholder={`URL Video MP4 / Imagine pt ${brandId}...`}
                            value={val}
                            onChange={e => handleChange(`topBannerUrl_${brandId}`, e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        URL Banner Global
                      </label>
                      <input
                        type="url"
                        placeholder="https://... URL video MP4 sau imagine"
                        value={formData.topBannerUrl || ''}
                        onChange={e => handleChange('topBannerUrl', e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {/* Geometrie & Colțuri */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        <span>Înălțime Banner</span>
                        <span className="text-blue-600 font-bold">Nivel {formData.topBannerHeight} (din 5)</span>
                      </div>
                      <input
                        type="range"
                        min="1" max="5" step="1"
                        value={formData.topBannerHeight || 3}
                        onChange={e => handleChange('topBannerHeight', parseInt(e.target.value))}
                        className="w-full cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Colțuri Sus Rotunjite</span>
                        <KioskSwitch
                          checked={formData.topBannerRadiusTop ?? true}
                          onChange={val => handleChange('topBannerRadiusTop', val)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Colțuri Jos Rotunjite</span>
                        <KioskSwitch
                          checked={formData.topBannerRadiusBottom ?? false}
                          onChange={val => handleChange('topBannerRadiusBottom', val)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Simulator Banner Top</span>
                  <div className="w-[140px] h-[250px] rounded-2xl overflow-hidden border-4 border-slate-800 bg-slate-200 dark:bg-slate-800 relative shadow-md">
                    <div className="absolute inset-0 p-1.5 space-y-1">
                      <div className="w-full h-8 bg-slate-300 dark:bg-slate-700 rounded" />
                      <div className="w-full h-8 bg-slate-300 dark:bg-slate-700 rounded" />
                      <div className="w-full h-8 bg-slate-300 dark:bg-slate-700 rounded" />
                    </div>
                    <div 
                      className="absolute top-0 left-0 right-0 overflow-hidden bg-black shadow-md transition-all duration-300"
                      style={{
                        height: `${10 + ((formData.topBannerHeight || 1) - 1) * 5}%`,
                        borderRadius: `${formData.topBannerRadiusTop ? '8px' : '0'} ${formData.topBannerRadiusTop ? '8px' : '0'} ${formData.topBannerRadiusBottom ? '8px' : '0'} ${formData.topBannerRadiusBottom ? '8px' : '0'}`
                      }}
                    >
                      {renderPreview(formData.topBannerUrl)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Banner Promo Footer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Banner Promo Footer (Jos / Sub Meniu)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bară inferioară continuă. Afișează logo-ul firmei, site-ul web, telefonul, adresa sau promoții speciale.
                </p>
              </div>
              <KioskSwitch
                checked={useBottomBanner}
                onChange={val => setUseBottomBanner(val)}
              />
            </div>

            {useBottomBanner && (
              <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  {/* Secțiunea 1: Logo Firmă */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-500" />
                        <span>1. Logo Firmă / Brand (Apare în stânga în footer)</span>
                      </span>
                      {formData.bottomBannerLogoUrl && (
                        <button
                          type="button"
                          onClick={() => handleChange('bottomBannerLogoUrl', '')}
                          className="text-[11px] text-red-500 hover:text-red-600 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Șterge Logo</span>
                        </button>
                      )}
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                      Sigla companiei tale (ex: GetApp, sigla localului) afișată pe fundalul barei.
                    </p>
                    <div className="flex items-center gap-2">
                      {formData.bottomBannerLogoUrl && (
                        <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                          <img src={formData.bottomBannerLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                        </div>
                      )}
                      <input
                        type="url"
                        placeholder="https://... URL logo (sau încarcă fișier)"
                        value={formData.bottomBannerLogoUrl || ''}
                        onChange={e => handleChange('bottomBannerLogoUrl', e.target.value)}
                        className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <label className="px-3.5 py-2 text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors">
                        {uploadingLogo ? (
                          <span>Se încarcă...</span>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Încarcă Logo</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Secțiunea 2: Text Informații (Site Web, Telefon, Adresă) */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      <span>2. Informații Contact (Site Web & Telefon)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                      În footer, elementele sunt așezate automat vertical: <b>1. Logo sus</b>, sub el <b>2. Site-ul web</b>, iar sub ele <b>3. Telefonul</b>.
                    </p>
                    <textarea
                      placeholder="Ex: 0727 77 77 12 • wwww.getapp.ro"
                      value={formData.bottomBannerText || ''}
                      onChange={e => handleChange('bottomBannerText', e.target.value)}
                      rows={2}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    {/* Quick insert helpers */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-400">Adaugă rapid:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const add = 'wwww.getapp.ro';
                          const cur = formData.bottomBannerText ? formData.bottomBannerText.trim() : '';
                          handleChange('bottomBannerText', cur ? `${cur} • ${add}` : add);
                        }}
                        className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        + wwww.getapp.ro
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const add = '0727 77 77 12';
                          const cur = formData.bottomBannerText ? formData.bottomBannerText.trim() : '';
                          handleChange('bottomBannerText', cur ? `${cur} • ${add}` : add);
                        }}
                        className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        + 0727 77 77 12
                      </button>
                    </div>
                  </div>

                  {/* Mod Text & Aliniere */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mod Text</label>
                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        {[
                          { v: false, l: 'Rulant (Animat)' },
                          { v: true, l: 'Fix (Static)' }
                        ].map(m => (
                          <button
                            key={String(m.v)}
                            type="button"
                            onClick={() => handleChange('bottomBannerTextFixed', m.v)}
                            className={`py-1 text-xs rounded font-semibold transition-all ${
                              formData.bottomBannerTextFixed === m.v
                                ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                                : 'text-slate-500'
                            }`}
                          >
                            {m.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Aliniere Text</label>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        {['left', 'center', 'right'].map(align => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => handleChange('bottomBannerTextAlign', align)}
                            className={`py-1 text-xs rounded font-semibold capitalize transition-all ${
                              (formData.bottomBannerTextAlign || 'center') === align
                                ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                                : 'text-slate-500'
                            }`}
                          >
                            {align === 'left' ? 'Stânga' : align === 'center' ? 'Centru' : 'Dreapta'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Secțiunea 3: Reclamă Fundal Opțională */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                        <span>3. Reclamă Fundal (Opțional - Video MP4 sau Imagine)</span>
                      </span>
                      {formData.bottomBannerUrl && (
                        <button
                          type="button"
                          onClick={() => handleChange('bottomBannerUrl', '')}
                          className="text-[11px] text-red-500 hover:text-red-600 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Șterge Fișier Media</span>
                        </button>
                      )}
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                      Opțional. Folosiți doar pentru fișiere video (.mp4) sau poze de fundal. Nu introduceți adrese web aici (site-ul se trece la pasul 2).
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        placeholder="https://... URL video .mp4 sau imagine"
                        value={formData.bottomBannerUrl || ''}
                        onChange={e => handleChange('bottomBannerUrl', e.target.value)}
                        className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <label className="px-3.5 py-2 text-xs font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors">
                        {uploadingBottomMedia ? (
                          <span>Se încarcă...</span>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Încarcă Media</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*,video/mp4"
                          className="hidden"
                          onChange={handleBottomMediaUpload}
                          disabled={uploadingBottomMedia}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Culoare Fundal Banner */}
                  <KioskColorPicker
                    label="4. Culoare Fundal Banner Footer"
                    value={formData.bottomBannerBg || '#1e293b'}
                    onChange={val => handleChange('bottomBannerBg', val)}
                  />

                  {/* 5. Culoare Fundal Card Info (Logo + Contact) */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <KioskColorPicker
                      label="5. Culoare Fundal Card Info (Logo + Contact)"
                      value={formData.bottomBannerInfoBg || 'transparent'}
                      onChange={val => handleChange('bottomBannerInfoBg', val)}
                    />
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-400 font-medium">Preseturi:</span>
                      <button
                        type="button"
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${!formData.bottomBannerInfoBg || formData.bottomBannerInfoBg === 'transparent' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                        onClick={() => handleChange('bottomBannerInfoBg', 'transparent')}
                      >
                        Transparent
                      </button>
                      <button
                        type="button"
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${formData.bottomBannerInfoBg === 'rgba(0,0,0,0.45)' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                        onClick={() => handleChange('bottomBannerInfoBg', 'rgba(0,0,0,0.45)')}
                      >
                        Negru 45%
                      </button>
                      <button
                        type="button"
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${formData.bottomBannerInfoBg === '#000000' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                        onClick={() => handleChange('bottomBannerInfoBg', '#000000')}
                      >
                        Negru
                      </button>
                      <button
                        type="button"
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${formData.bottomBannerInfoBg === 'rgba(255,255,255,0.25)' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                        onClick={() => handleChange('bottomBannerInfoBg', 'rgba(255,255,255,0.25)')}
                      >
                        Alb 25%
                      </button>
                      <button
                        type="button"
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${formData.bottomBannerInfoBg === '#ffffff' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                        onClick={() => handleChange('bottomBannerInfoBg', '#ffffff')}
                      >
                        Alb
                      </button>
                    </div>
                  </div>
                </div>

                {/* Simulator Footer */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Simulator Banner Footer (Kiosk)</span>
                  
                  {/* Phone Simulator Frame */}
                  <div className="w-[150px] h-[260px] rounded-2xl overflow-hidden border-4 border-slate-800 bg-slate-900 relative shadow-lg flex flex-col justify-end">
                    {/* Dummy menu content in simulator */}
                    <div className="absolute inset-0 p-2 opacity-20 pointer-events-none flex flex-col gap-2">
                      <div className="h-4 bg-white/40 rounded-md w-3/4"></div>
                      <div className="grid grid-cols-2 gap-1.5 flex-1">
                        <div className="bg-white/30 rounded-lg"></div>
                        <div className="bg-white/30 rounded-lg"></div>
                        <div className="bg-white/30 rounded-lg"></div>
                        <div className="bg-white/30 rounded-lg"></div>
                      </div>
                    </div>

                    {/* Footer bar inside simulator */}
                    {(() => {
                      const { website: simWeb, phone: simPhone, extra: simExtra } = parseFooterDetails(formData.bottomBannerText);
                      const hasSimContact = Boolean(simWeb || simPhone);
                      const simInfoBg = formData.bottomBannerInfoBg;
                      const hasSimCustomBg = Boolean(simInfoBg && simInfoBg !== 'transparent');

                      return (
                        <div 
                          className="w-full transition-all duration-300 flex flex-col items-center justify-center px-1 py-0.5 relative overflow-hidden z-10 text-center"
                          style={{
                            height: `${14 + ((formData.bottomBannerHeight || 1) - 1) * 4}%`,
                            backgroundColor: formData.bottomBannerBg || '#1e293b',
                            borderRadius: `${formData.bottomBannerRadiusTop ? '8px' : '0'} ${formData.bottomBannerRadiusTop ? '8px' : '0'} ${formData.bottomBannerRadiusBottom ? '8px' : '0'} ${formData.bottomBannerRadiusBottom ? '8px' : '0'}`,
                            backgroundImage: formData.bottomBannerUrl && !/\.(mp4|webm)(\?|$)/i.test(formData.bottomBannerUrl) ? `url(${formData.bottomBannerUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            gap: '1px'
                          }}
                        >
                          <div 
                            className="flex flex-col items-center justify-center transition-all duration-200"
                            style={{
                              backgroundColor: simInfoBg || 'transparent',
                              padding: hasSimCustomBg ? '2px 6px' : '0',
                              borderRadius: hasSimCustomBg ? '4px' : '0',
                              boxShadow: hasSimCustomBg ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
                              gap: '1px'
                            }}
                          >
                            {formData.bottomBannerLogoUrl && (
                              <img 
                                src={formData.bottomBannerLogoUrl} 
                                alt="Logo" 
                                className="h-2.5 max-w-[28px] object-contain shrink-0" 
                              />
                            )}
                            {simWeb && (
                              <span className="text-[6.5px] font-bold text-white truncate max-w-[120px] leading-none">
                                {simWeb}
                              </span>
                            )}
                            {simPhone && (
                              <span className="text-[6px] font-semibold text-slate-200 truncate max-w-[120px] leading-none">
                                {simPhone}
                              </span>
                            )}
                          </div>
                          {simExtra && (
                            <span className="text-[5.5px] text-slate-300 truncate max-w-[120px] leading-none">
                              {simExtra}
                            </span>
                          )}
                          {!hasSimContact && !simExtra && (
                            <span className="text-[7px] font-bold text-white truncate max-w-[120px]">
                              {formData.bottomBannerText || (formData.bottomBannerLogoUrl ? '' : 'Text Promoțional')}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Real-scale Footer Bar Strip Preview */}
                  <div className="w-full mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 text-center">
                      Previzualizare Bară Footer (Reală: Logo ➔ Site ➔ Telefon)
                    </span>
                    {(() => {
                      const { website: pWeb, phone: pPhone, extra: pExtra } = parseFooterDetails(formData.bottomBannerText);
                      const hasContact = Boolean(pWeb || pPhone);
                      const pInfoBg = formData.bottomBannerInfoBg;
                      const hasPCustomBg = Boolean(pInfoBg && pInfoBg !== 'transparent');

                      return (
                        <div 
                          className="w-full min-h-[64px] py-2 px-3 rounded-xl flex flex-col items-center justify-center gap-1 overflow-hidden shadow-sm"
                          style={{
                            backgroundColor: formData.bottomBannerBg || '#1e293b',
                            backgroundImage: formData.bottomBannerUrl && !/\.(mp4|webm)(\?|$)/i.test(formData.bottomBannerUrl) ? `url(${formData.bottomBannerUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            alignItems: formData.bottomBannerTextAlign === 'left' ? 'flex-start' : formData.bottomBannerTextAlign === 'right' ? 'flex-end' : 'center',
                            textAlign: formData.bottomBannerTextAlign || 'center'
                          }}
                        >
                          <div 
                            className="flex flex-col items-center justify-center transition-all duration-200"
                            style={{
                              backgroundColor: pInfoBg || 'transparent',
                              padding: hasPCustomBg ? '4px 12px' : '0',
                              borderRadius: hasPCustomBg ? '8px' : '0',
                              boxShadow: hasPCustomBg ? '0 2px 6px rgba(0,0,0,0.25)' : 'none',
                              gap: '2px',
                              alignItems: formData.bottomBannerTextAlign === 'left' ? 'flex-start' : formData.bottomBannerTextAlign === 'right' ? 'flex-end' : 'center',
                            }}
                          >
                            {formData.bottomBannerLogoUrl && (
                              <img 
                                src={formData.bottomBannerLogoUrl} 
                                alt="Logo" 
                                className="h-5 max-w-[80px] object-contain shrink-0" 
                              />
                            )}
                            {pWeb && (
                              <span className="text-xs font-bold text-white leading-tight flex items-center gap-1">
                                <Globe className="w-3 h-3 text-white/80 shrink-0" />
                                <span>{pWeb}</span>
                              </span>
                            )}
                            {pPhone && (
                              <span className="text-[11px] font-semibold text-slate-200 leading-tight">
                                {pPhone}
                              </span>
                            )}
                          </div>
                          {pExtra && (
                            <span className="text-[10px] text-slate-300 leading-tight">
                              {pExtra}
                            </span>
                          )}
                          {!hasContact && !pExtra && (
                            <span className="text-xs font-bold text-white truncate">
                              {formData.bottomBannerText || (formData.bottomBannerLogoUrl ? '' : 'Adaugă text sau logo...')}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Promoție Roată Noroc */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Promoție Kiosk (Roată Noroc)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configurează condițiile de apariție și afișare a roții interactive de premii.
                </p>
              </div>
              <KioskSwitch
                checked={formData.promoActive || false}
                onChange={val => handleChange('promoActive', val)}
              />
            </div>

            {formData.promoActive && (
              <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Alege Roata</label>
                  <select
                    value={formData.promoBrandId || ''}
                    onChange={e => handleChange('promoBrandId', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">Alege...</option>
                    <option value="smashme">Roata SmashMe</option>
                    <option value="lovesushi">Roata RollMaster</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Moment Apariție</label>
                  <select
                    value={formData.promoTriggerMoment || 'after_payment'}
                    onChange={e => handleChange('promoTriggerMoment', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="before_payment">Înainte de Plată (Adaugă în coș)</option>
                    <option value="after_payment">După Confirmare Plată (Prezintă la Casă)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Sumă Minimă Coș (RON)</label>
                  <input
                    type="number"
                    value={formData.promoMinOrderValue === 0 ? '' : formData.promoMinOrderValue}
                    onChange={e => handleChange('promoMinOrderValue', Number(e.target.value))}
                    placeholder="Ex: 50"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Limitare Frecvență</label>
                    <KioskSwitch
                      checked={formData.promoFreqEnabled || false}
                      onChange={val => handleChange('promoFreqEnabled', val)}
                    />
                  </div>
                  {formData.promoFreqEnabled ? (
                    <input
                      type="number"
                      value={formData.promoOrdersToAppear === 0 ? '' : formData.promoOrdersToAppear}
                      onChange={e => handleChange('promoOrdersToAppear', Number(e.target.value))}
                      placeholder="Ex: Apare la fiecare a 3-a comandă"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-blue-600 dark:text-blue-400 text-center">
                      Roata apare MEREU
                    </div>
                  )}
                </div>

                {formData.promoBrandId && promosData[formData.promoBrandId] && (
                  <div className="md:col-span-2 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowWheelPreviewFull(true)}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700"
                    >
                      Deschide Simulatorul Roții de Noroc
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 4: Popup Promoțional de Start (Welcome Offer) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Popup Promoțional de Start (Welcome Offer)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Alege formatul de afișare pe acest kiosk atunci când există 2 sau mai multe produse cu ofertă de start activă.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Stil Afișare Oferte Multiple
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('startPromoLayout', 'carousel')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    (formData.startPromoLayout || 'carousel') === 'carousel'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Carusel (Slider Tactil)</span>
                    {(formData.startPromoLayout || 'carousel') === 'carousel' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Afișează ofertele succesiv, cu săgeți stânga/dreapta, swipe pe ecran și auto-rotire la fiecare 6 secunde.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleChange('startPromoLayout', 'duo')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    formData.startPromoLayout === 'duo'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Duo (2 Coloane Alăturate)</span>
                    {formData.startPromoLayout === 'duo' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Afișează ofertele în paralel pe 2 coloane, clientul putând compara și adăuga direct oricare dintre oferte.
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: LIMBI & TRADUCERI ─── */}
      {activeTab === 'languages' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Limbi Active */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Limbi Active pe Kiosk</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Limba marcată cu steluță este implicită la pornire</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {(formData.languages || []).length} active
              </span>
            </div>

            {(() => {
              const ALL_LANGS = ['ro', 'en', 'fr', 'hu', 'ru', 'uk', 'bg', 'de', 'es'];
              const langNames = { ro: 'RO (Română)', en: 'EN (English)', fr: 'FR (Français)', hu: 'HU (Magyar)', ru: 'RU (Русский)', uk: 'UA (Українська)', bg: 'BG (Български)', de: 'DE (Deutsch)', es: 'ES (Español)' };
              const currentLangs = formData.languages || ['ro'];
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
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    {currentLangs.map((lang, idx) => {
                      const isDefault = lang === defaultLang;
                      return (
                        <div
                          key={lang}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                            isDefault 
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' 
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <span className="text-xs font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
                          <span className="flex-1 text-sm font-bold text-slate-800 dark:text-slate-100">{langNames[lang]}</span>
                          <button
                            type="button"
                            title={isDefault ? 'Limbă implicită' : 'Setează ca limbă implicită'}
                            onClick={() => setDefault(lang)}
                            className={`p-1 text-base transition-all cursor-pointer ${isDefault ? 'text-amber-500 scale-110' : 'text-slate-300 hover:text-amber-400'}`}
                          >
                            <Star className="w-3.5 h-3.5" fill={isDefault ? "#f59e0b" : "none"} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLang(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLang(idx, 1)}
                            disabled={idx === currentLangs.length - 1}
                            className="p-1 text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLang(lang)}
                            disabled={currentLangs.length === 1}
                            className="p-1 text-xs font-bold text-rose-500 hover:text-rose-700 disabled:opacity-20 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {inactive.length > 0 && (
                    <div className="pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">+ Adaugă Limbi:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {inactive.map(l => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => addLang(l)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-all cursor-pointer"
                          >
                            + {langNames[l]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Card: Stil & Poziționare Bară Limbi */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Stil & Poziționare Bară Limbi</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Personalizează cum și unde apar butoanele de limbă.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Poziție Butoane</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {[
                    { v: 'top', l: 'Sus' },
                    { v: 'bottom', l: 'Jos' }
                  ].map(pos => (
                    <button
                      key={pos.v}
                      type="button"
                      onClick={() => handleChange('langVerticalPosition', pos.v)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${
                        (formData.langVerticalPosition || 'bottom') === pos.v
                          ? 'bg-white dark:bg-slate-750 text-blue-600 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      {pos.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Când să apară butoanele?</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {[
                    { v: 'after', l: 'După click' },
                    { v: 'before', l: 'Pe standby' },
                    { v: 'both', l: 'Ambele' }
                  ].map(mom => (
                    <button
                      key={mom.v}
                      type="button"
                      onClick={() => handleChange('langSelectorPosition', mom.v)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${
                        formData.langSelectorPosition === mom.v
                          ? 'bg-white dark:bg-slate-750 text-blue-600 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      {mom.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <KioskColorPicker
                  label="Fundal Buton Limbă"
                  value={formData.langBgColor || '#ffffff'}
                  onChange={val => handleChange('langBgColor', val)}
                  allowClear={true}
                />
                <KioskColorPicker
                  label="Contur Buton Limbă"
                  value={formData.langBorderColor || '#e2e8f0'}
                  onChange={val => handleChange('langBorderColor', val)}
                  allowClear={true}
                />
              </div>

              <KioskColorPicker
                label="Fundal Bară Limbi"
                value={formData.langBarBg || '#000000'}
                onChange={val => handleChange('langBarBg', val)}
                placeholder="rgba(0,0,0,0.35)"
                allowClear={true}
                clearValue=""
                clearLabel="Default"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: HARDWARE & SECURITATE ─── */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Card: Terminal POS Plată */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Terminal POS Plată</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selectează protocolul hardware prin care tableta comunică cu terminalul bancar.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Gateway: {formData.paymentGateway || 'none'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              {[
                { id: 'none', title: 'Fără POS', desc: 'Confirmare automată fără terminal bancar fizic', icon: <Zap className="w-5 h-5 text-amber-500" /> },
                { id: 'raiffeisen', title: 'Raiffeisen ECR', desc: 'Conectat prin Serial COM cu POS Bridge local', icon: <CreditCard className="w-5 h-5 text-emerald-500" /> },
                { id: 'verifone_serial', title: 'VeriFone V200t', desc: 'Conectat prin cablu USB-Serial la backend local', icon: <Sliders className="w-5 h-5 text-blue-500" /> },
                { id: 'viva_pos', title: 'Viva PAX A80', desc: 'Comunicare directă prin IP local în rețea', icon: <Wifi className="w-5 h-5 text-purple-500" /> }
              ].map(pos => {
                const isSelected = (formData.paymentGateway || 'none') === pos.id;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => handleChange('paymentGateway', pos.id)}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="mb-2">{pos.icon}</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{pos.title}</div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{pos.desc}</p>
                    </div>
                    {isSelected && (
                      <div className="mt-3 text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Activ pe acest Kiosk</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card: Restaurante Active (Branduri) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Restaurante Active pe Kiosk</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Reordonează brandurile pe care le pot explora clienții.</p>
              </div>

              <div className="space-y-2">
                {formData.brands.map((k, index) => {
                  const v = { smashme: 'SmashMe', crunch: 'Crunch', rollmaster: 'Roll Master', lovesushi: 'Love Sushi', pokiwoki: 'Poki-Woki' }[k] || k;
                  return (
                    <div key={k} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                          style={{ background: BRAND_COLORS?.[k] || '#64748b' }}
                        >
                          <BrandLogo brandId={k} size={18} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{v}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => {
                            const newB = [...formData.brands];
                            if (index > 0) {
                              [newB[index-1], newB[index]] = [newB[index], newB[index-1]];
                              setFormData(p => ({ ...p, brands: newB }));
                            }
                          }}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-20 cursor-pointer flex items-center justify-center"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === formData.brands.length - 1}
                          onClick={() => {
                            const newB = [...formData.brands];
                            if (index < newB.length - 1) {
                              [newB[index+1], newB[index]] = [newB[index], newB[index+1]];
                              setFormData(p => ({ ...p, brands: newB }));
                            }
                          }}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-20 cursor-pointer flex items-center justify-center"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleBrand(k)}
                          className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {formData.brands.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400 italic">Niciun restaurant selectat</div>
                )}
              </div>

              {/* Pool Branduri Inactive */}
              <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">+ Adaugă Restaurant:</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries({ smashme: 'SmashMe', crunch: 'Crunch', rollmaster: 'Roll Master', lovesushi: 'Love Sushi', pokiwoki: 'Poki-Woki' }).map(([k, v]) => {
                    if (formData.brands.includes(k)) return null;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleBrand(k)}
                        className="px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <span className="text-blue-500">+</span>
                        <BrandLogo brandId={k} size={14} />
                        <span>{v}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card: Link & Securitate */}
            <div className="space-y-6">
              {/* Link Kiosk */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Link Kiosk Personalizat</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ex: smashme-brasov"
                    value={formData.kioskUrl || ''}
                    onChange={e => handleChange('kioskUrl', e.target.value)}
                    className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(finalKioskUrl)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    Copiază URL
                  </button>
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {finalKioskUrl}
                </div>

                {/* Link Manager Kiosk */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500 inline" />
                      Link Portal Manager
                    </span>
                    <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                      {finalKioskUrl}&manager=true
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(`${finalKioskUrl}&manager=true`)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      title="Copiază link-ul direct pentru Manager"
                    >
                      Copiază
                    </button>
                    <a
                      href={`${finalKioskUrl}&manager=true`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold transition-all"
                      title="Deschide direct ecranul Manager"
                    >
                      Deschide
                    </a>
                  </div>
                </div>
              </div>

              {/* Securitate PIN & Blocare Programată Kiosk */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-500" />
                      Securitate PIN & Blocare Kiosk
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Protejează setările locale și permite blocarea ecranului pe timpul nopții sau în afara programului.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <KioskSwitch
                      checked={usePin}
                      onChange={val => {
                        setUsePin(val);
                        if (!val) {
                          handleChange('kioskPin', '');
                          handleChange('vendorPin', '');
                          handleChange('lockScheduleActive', false);
                        }
                      }}
                    />
                  </div>
                </div>

                {usePin && (
                  <div className="pt-2 space-y-6">
                    {/* PIN-uri: Manager și Vânzător */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                          PIN Manager (Principal)
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Acces complet la setările administrative locale și deblocare ecran.
                        </p>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="relative w-44">
                            <input
                              type={showManagerPin ? 'text' : 'password'}
                              maxLength={4}
                              placeholder="Fără PIN"
                              value={formData.kioskPin || ''}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                handleChange('kioskPin', val);
                                if (val && !usePin) setUsePin(true);
                              }}
                              className={`w-full px-3.5 py-2.5 pr-10 text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm ${
                                formData.kioskPin ? 'font-bold tracking-[0.25em] text-base' : 'font-normal tracking-normal text-sm placeholder:text-slate-400'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowManagerPin(p => !p)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                              title={showManagerPin ? 'Ascunde PIN' : 'Arată PIN'}
                            >
                              {showManagerPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {formData.kioskPin ? (
                            <button
                              type="button"
                              onClick={() => handleChange('kioskPin', '')}
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
                              title="Șterge PIN Manager (Kioskul va funcționa fără PIN)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Resetează
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1.5 rounded-xl flex items-center gap-1">
                              Fără restricție
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                          PIN Vânzător / Casier (Opțional)
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Permite personalului deblocarea ecranului, fără acces la setările admin.
                        </p>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="relative w-44">
                            <input
                              type={showVendorPin ? 'text' : 'password'}
                              maxLength={4}
                              placeholder="Fără PIN"
                              value={formData.vendorPin || ''}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                handleChange('vendorPin', val);
                                if (val && !usePin) setUsePin(true);
                              }}
                              className={`w-full px-3.5 py-2.5 pr-10 text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all shadow-sm ${
                                formData.vendorPin ? 'font-bold tracking-[0.25em] text-base' : 'font-normal tracking-normal text-sm placeholder:text-slate-400'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowVendorPin(p => !p)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                              title={showVendorPin ? 'Ascunde PIN' : 'Arată PIN'}
                            >
                              {showVendorPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {formData.vendorPin ? (
                            <button
                              type="button"
                              onClick={() => handleChange('vendorPin', '')}
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
                              title="Șterge PIN Vânzător"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Resetează
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl flex items-center gap-1">
                              Opțional
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Secțiune Blocare Kiosk după Program */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            Blocare automată pe interval orar (Ex: noapte / mall)
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Blochează ecranul Kiosk cu ecran PIN în afara orelor de funcționare pentru a preveni atingerile neautorizate.
                          </p>
                        </div>
                        <KioskSwitch
                          checked={Boolean(formData.lockScheduleActive)}
                          onChange={val => handleChange('lockScheduleActive', val)}
                        />
                      </div>

                      {formData.lockScheduleActive && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-4">
                          {/* Frecvență: Zilnic vs Personalizat */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                              Frecvență activare:
                            </label>
                            <div className="inline-flex rounded-xl p-1 bg-slate-200/70 dark:bg-slate-700/60 text-xs font-semibold">
                              <button
                                type="button"
                                onClick={() => handleChange('lockScheduleMode', 'daily')}
                                className={`px-4 py-1.5 rounded-lg transition-all ${
                                  (formData.lockScheduleMode || 'daily') === 'daily'
                                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                Zilnic (Luni - Duminică)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChange('lockScheduleMode', 'custom')}
                                className={`px-4 py-1.5 rounded-lg transition-all ${
                                  formData.lockScheduleMode === 'custom'
                                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                              >
                                Zile selectate
                              </button>
                            </div>
                          </div>

                          {/* Selector Zile dacă e custom */}
                          {formData.lockScheduleMode === 'custom' && (
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                                Zile în care se aplică blocarea:
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { id: 1, label: 'Luni' },
                                  { id: 2, label: 'Marți' },
                                  { id: 3, label: 'Miercuri' },
                                  { id: 4, label: 'Joi' },
                                  { id: 5, label: 'Vineri' },
                                  { id: 6, label: 'Sâmbătă' },
                                  { id: 0, label: 'Duminică' },
                                ].map(day => {
                                  const currentDays = Array.isArray(formData.lockDays) ? formData.lockDays : [1, 2, 3, 4, 5, 6, 0];
                                  const isSelected = currentDays.includes(day.id);
                                  return (
                                    <button
                                      key={day.id}
                                      type="button"
                                      onClick={() => {
                                        let updated;
                                        if (isSelected) {
                                          updated = currentDays.filter(d => d !== day.id);
                                        } else {
                                          updated = [...currentDays, day.id];
                                        }
                                        handleChange('lockDays', updated);
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                        isSelected
                                          ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                      }`}
                                    >
                                      {day.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Ore start și stop */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                Ora început blocare (Seara):
                              </label>
                              <input
                                type="time"
                                value={formData.lockStartTime || '22:00'}
                                onChange={e => handleChange('lockStartTime', e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                Ora sfârșit blocare (Dimineața):
                              </label>
                              <input
                                type="time"
                                value={formData.lockEndTime || '09:00'}
                                onChange={e => handleChange('lockEndTime', e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                            Exemplu: între <strong>{formData.lockStartTime || '22:00'}</strong> și <strong>{formData.lockEndTime || '09:00'}</strong>, Kiosk-ul va fi protejat cu PIN. Dacă un angajat deblochează ecranul în acest interval, ecranul rămâne deblocat pe tura respectivă până la următorul interval.
                          </div>

                          {/* Opțiune deblocare automată */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/60">
                            <div>
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                                Deblocare automată la final de interval
                              </span>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Când se termină timpul de blocare (ex: la ora {formData.lockEndTime || '09:00'}), ecranul iese automat din PIN și devine gata de comenzi.
                              </p>
                            </div>
                            <KioskSwitch
                              checked={formData.lockAutoUnlock !== false}
                              onChange={val => handleChange('lockAutoUnlock', val)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card: Personalizare Meniu Kiosk */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Personalizare Meniu Kiosk</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configurează profilul de meniu pe care îl preia acest Kiosk pentru fiecare brand activ, sau editează vizibilitatea produselor strict pe această tabletă.
              </p>
            </div>

            <div className="space-y-3">
              {activeBrands.map(brandId => {
                const bData = brandProfiles[brandId];
                if (!bData || !bData.brand) return null;
                
                const brandOverrides = (formData.menuOverrides || {})[brandId] || {};
                const currentProfileId = brandOverrides.profileId || '';
                const localHiddenCount = Object.keys(brandOverrides.hiddenItems || {}).length;

                return (
                  <div key={brandId} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <BrandLogo brandId={brandId} size={22} />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Meniu {bData.brand.name}</span>
                    </div>

                    <div className="flex items-center gap-3 flex-1 justify-end min-w-[300px]">
                      <select
                        value={currentProfileId}
                        onChange={async (e) => {
                          const val = e.target.value;
                          const newOverrides = { ...formData.menuOverrides };
                          if (!newOverrides[brandId]) newOverrides[brandId] = { hiddenItems: {} };
                          newOverrides[brandId] = { ...newOverrides[brandId], profileId: val };
                          handleChange('menuOverrides', newOverrides);
                          try {
                            await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ menuOverrides: newOverrides })
                            });
                          } catch (err) {
                            console.error('Auto-save profile error:', err);
                          }
                        }}
                        className="px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white max-w-[260px]"
                      >
                        <option value="">Meniu Complet (Implicit)</option>
                        {bData.profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({Object.keys(p.hiddenItems || {}).length} ascunse)</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const overrides = formData.menuOverrides[brandId] || { hiddenItems: {} };
                          const profile = bData.profiles.find(p => p.id === overrides.profileId) || { name: 'Meniu Complet (Fără Șablon)', rootFolderId: null, hiddenItems: {} };
                          setEditingMenuBrand({
                            brand: bData.brand,
                            profile,
                            localHiddenItemsOverride: overrides.hiddenItems || {}
                          });
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          localHiddenCount > 0 
                            ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800' 
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Editează Vizibilitatea {localHiddenCount > 0 && `(${localHiddenCount} specifice)`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── OVERLAY ROATĂ NOROC FULLSCREEN ─── */}
      {showWheelPreviewFull && formData.promoBrandId && promosData[formData.promoBrandId] && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fadeIn">
          <button 
            type="button"
            onClick={() => setShowWheelPreviewFull(false)}
            className="absolute top-6 right-6 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-bold border border-white/20 transition-all cursor-pointer"
          >
            ✕ Închide
          </button>
          <h2 className="text-white text-2xl font-black mb-8 drop-shadow-md">
            Simulare Roată Noroc pe Kiosk
          </h2>
          <div className="w-[500px] h-[500px] relative flex items-center justify-center">
            <FortuneWheelPreview config={promosData[formData.promoBrandId].config} brandId={formData.promoBrandId} scale={1.2} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── LOCATIONS MANAGER ──────────────────────────────────── */
const BRAND_LABELS = { smashme: 'SmashMe', crunch: 'Crunch', rollmaster: 'Roll Master', lovesushi: 'Love Sushi', pokiwoki: 'Poki-Woki' };
const BRAND_PILL_COLORS = { smashme: '#ef4444', crunch: '#eab308', rollmaster: '#3b82f6', lovesushi: '#ec4899', pokiwoki: '#f97316' };

function LocationsManager({ backend, kiosksLiveStatus = {} }) { 
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
    const ok = await confirm('Ștergi această locație?', { title: 'Ștergere locație', okLabel: 'Șterge', danger: true });
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
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
          <input
            type="text"
            placeholder="Nume locație (ex: SM Brașov)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 w-full h-10 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
          <div className="flex items-center gap-2 overflow-x-auto max-w-full">
            {Object.entries(BRAND_LABELS).map(([k, v]) => (
              <button
                key={k}
                className={`px-3 h-10 rounded-full text-sm font-bold flex items-center gap-2 shrink-0 border transition-colors ${newBrands.includes(k) ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                onClick={() => toggleBrand(k)}
              ><BrandLogo brandId={k} size={14} /> {v}</button>
            ))}
          </div>
          <input
            type="number"
            min="1" max="100"
            value={newTables}
            onChange={e => setNewTables(Number(e.target.value))}
            className="w-24 h-10 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            placeholder="Nr. mese"
          />
          <button className="px-5 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all" onClick={createLocation}>Salvează</button>
        </div>
      )}

      {/* Locations table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
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
                    <div className="text-xs text-slate-400 mt-0.5 font-medium">ID: {loc.id}</div>
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
              className="text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${btn.disabled ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
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
  const { fetchWithAuth } = useAuth();
  const [formData, setFormData] = useState({
    ...loc,
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
          className="px-4 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 shrink-0 shadow-sm"
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
          className="px-6 h-11 rounded-full bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all shrink-0"
        >
          Salvează Modificările
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Nume & Mese */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Informații Generale</h3>
          
          <div className="space-y-5">
            <div>
               <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Nume Locație</label>
               <input type="text" className="w-full h-11 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all" value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="Ex: SM Bacău" />
            </div>
            <div>
               <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Număr de Mese (Kiosk/QR)</label>
               <input type="number" className="w-full h-11 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all" value={formData.tables} onChange={e => handleChange('tables', parseInt(e.target.value)||0)} min="0" />
            </div>
          </div>
        </div>

        {/* Card: Branduri Asignate */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Restaurante Active</h3>
          
          <div className="flex flex-wrap gap-3">
            {Object.entries({smashme:'SmashMe', crunch:'Crunch', rollmaster:'Roll Master', lovesushi:'Love Sushi', pokiwoki:'Poki-Woki'}).map(([k, v]) => {
              const isActive = formData.brands.includes(k);
              const pillColor = (BRAND_COLORS && BRAND_COLORS[k]) ? BRAND_COLORS[k] : '#64748b';
              return (
                <button
                  key={k}
                  className={`px-4 h-11 rounded-full flex items-center gap-3 font-bold text-sm transition-all border-2 ${isActive ? 'text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-80 grayscale hover:grayscale-0 hover:opacity-100'}`}
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 md:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Setări Syrve (iiko) per locație</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-3xl">Dacă un brand folosește un <code>Organization ID</code> diferit față de cel global (din .env), pune-l aici pentru a trimite comenzile corect la POS-ul locației corespunzătoare.</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {formData.brands.map(bId => (
               <div key={bId} className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                   <BrandLogo brandId={bId} size={14} /> Org ID ({bId})
                 </label>
                 <input type="text" className="w-full h-11 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all" value={formData.orgIds[bId] || ''} onChange={e => handleOrgChange(bId, e.target.value)} placeholder="ID global implicit" />
               </div>
             ))}
             {formData.brands.length === 0 && <span className="text-sm text-amber-600 dark:text-amber-400 font-medium p-4 bg-amber-50 dark:bg-amber-500/10 rounded-full border border-amber-200 dark:border-amber-500/20 col-span-full">Selectează măcar un brand pentru a seta suprascrieri de locație Syrve.</span>}
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{brand.id}</div>
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
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 12, wordBreak: 'break-all', fontWeight: 500, background: 'var(--bg-surface)', padding: '6px 8px', borderRadius: 6 }}>
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
          background: toast.type === 'error' ? '#ef4444' : '#059669',
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
