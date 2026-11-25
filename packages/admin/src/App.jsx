import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { io } from 'socket.io-client';

import { useAuth } from './context/AuthProvider';
import LoginScreen from './screens/LoginScreen';
import UsersManager from './screens/UsersManager';
import ModifierImages from './screens/ModifierImages';
import ProductOverrides from './screens/ProductOverrides';
import TranslationsScreen from './screens/TranslationsScreen';
import Integrations from './screens/Integrations';
import PosLogs from './screens/PosLogs';
import PendingOrders from './screens/PendingOrders';
import KioskLogs from './screens/KioskLogs';
import IikoLogs from './screens/IikoLogs';
import PrinterLogs from './screens/PrinterLogs';
import PortScans from './screens/PortScans';
import BridgeMonitoring from './screens/BridgeMonitoring';
import BrandLogo from './components/BrandLogo.jsx';
import BankLogo from './components/BankLogo.jsx';
import ThermalReceiptModal from './components/ThermalReceiptModal.jsx';
import SoftwareReleaseNotesModal from './components/SoftwareReleaseNotesModal.jsx';
import WindowsRemoteModal from './components/WindowsRemoteModal.jsx';
import { BRIDGE_RELEASE_NOTES } from './data/bridgeReleaseNotes.js';
import DashboardCharts3D, { detectCardBrand, detectCardBank, BANK_CONFIG } from './components/DashboardCharts3D.jsx';
import { playNewOrderSound } from './components/OrderToastNotification.jsx';
import DynamicIsland from './components/DynamicIsland.jsx';
import Promotions from './screens/Promotions';
import FortuneWheelPreview from './components/FortuneWheelPreview';
import MenuManager, { MenuProfileEditorModal } from './screens/MenuManager';
import QrGenerator from './screens/QrGenerator';
import { useConfirm, RestartDialogIcon } from './components/ConfirmModal';
import { LayoutDashboard, ShoppingBag, FileText, TrendingUp, MapPin, MonitorSmartphone, QrCode, Utensils, Languages, Image as ImageIcon, Tags, Users, Blocks, Gift, Store, Sun, Moon, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X, CreditCard, Download, Printer, Building2, Palette, Sparkles, Flame, Snowflake, Layers, Upload, Pencil, Star, ChevronUp, ChevronDown, Check, CheckCircle2, Zap, Wifi, Sliders, Info, Trash2, AlertTriangle, Globe, Phone, Lock, Clock, ShieldCheck, ShieldAlert, Unlock, Eye, EyeOff, Activity, RotateCcw, Calendar, Copy, Server, ExternalLink, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { formatThousands } from './utils/formatters';


const rawBackend = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-ttut.onrender.com';
const BACKEND = rawBackend;

const BUILD_INFO = {
  number: typeof __BUILD_NUMBER__ !== 'undefined' ? __BUILD_NUMBER__ : '883',
  date: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '',
};

// ─── Keep-alive: prevent Render.com free tier from sleeping ───────────────────
function useKeepAlive() {
  useEffect(() => {
    const ping = () => fetch(`${BACKEND}/api/health`, { method: 'GET' }).catch(() => { });
    ping(); // immediate ping on load
    const id = setInterval(ping, 4 * 60 * 1000); // every 4 minutes
    return () => clearInterval(id);
  }, []);
}

import { BRAND_COLORS, BRAND_LABELS, getBrandColor, getBrandLabel } from './utils/brandTheme';

const STATUS_LABELS = {
  pending: { label: 'Achitată', color: '#059669' },
  awaiting_payment: { label: 'iiko', color: '#059669' },
  confirmed: { label: 'iiko', color: '#059669' },
  preparing: { label: 'În preparare', color: '#3b82f6' },
  ready: { label: 'Gata', color: '#059669' },
  delivered: { label: 'Livrat', color: '#8b5cf6' },
  cancelled: { label: 'Anulată', color: '#ef4444' },
};

const getOrderStatus = (o) => {
  if (!o) return { label: '—', color: '#6b7a99' };
  if (o.status === 'cancelled') return { label: 'Anulată', color: '#ef4444' };
  if (o.status === 'delivered') return { label: 'Livrat', color: '#8b5cf6' };
  if (o.status === 'ready') return { label: 'Gata', color: '#059669' };
  if (o.status === 'preparing') return { label: 'În preparare', color: '#3b82f6' };

  // Comenzi plătite cu cardul -> Achitată
  if (o.paymentMethod === 'card' || o.paymentRef?.authCode) {
    return { label: 'Achitată', color: '#059669' };
  }

  // Comenzi trimise la bucătărie (Syrve / iiko) sau cash -> iiko
  if (o.syrveOrderId || o.status === 'awaiting_payment' || o.paymentMethod === 'cash') {
    return { label: 'iiko', color: '#059669' };
  }

  return STATUS_LABELS[o.status] || { label: 'Achitată', color: '#059669' };
};

function getOrdersQueryParams(period, cStart, cEnd) {
  if (period === 'all') return 'limit=2000';
  const now = new Date();
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    return `startDate=${encodeURIComponent(start)}&limit=500`;
  }
  if (period === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    return `startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&limit=500`;
  }
  if (period === 'thisWeek') {
    const day = now.getDay() || 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0, 0).toISOString();
    return `startDate=${encodeURIComponent(start)}&limit=1500`;
  }
  if (period === 'lastWeek') {
    const day = now.getDay() || 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 6, 0, 0, 0, 0).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0, 0).toISOString();
    return `startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&limit=1500`;
  }
  if (period === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
    return `startDate=${encodeURIComponent(start)}&limit=3000`;
  }
  if (period === 'lastMonth') {
    let m = now.getMonth() - 1;
    let y = now.getFullYear();
    if (m < 0) { m = 11; y--; }
    const start = new Date(y, m, 1, 0, 0, 0, 0).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
    return `startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&limit=3000`;
  }
  if (period === 'thisYear') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).toISOString();
    return `startDate=${encodeURIComponent(start)}&limit=4000`;
  }
  if (period === 'custom') {
    const parts = [];
    if (cStart) {
      const sd = new Date(cStart);
      sd.setHours(0, 0, 0, 0);
      parts.push(`startDate=${encodeURIComponent(sd.toISOString())}`);
    }
    if (cEnd) {
      const ed = new Date(cEnd);
      ed.setHours(23, 59, 59, 999);
      parts.push(`endDate=${encodeURIComponent(ed.toISOString())}`);
    }
    parts.push('limit=2500');
    return parts.join('&');
  }
  return 'limit=500';
}

function getComparisonOrdersQueries(period, cStart, cEnd) {
  const now = new Date();
  const makeRangeQuery = (startDateObj, endDateObj, limit = 1000) =>
    `startDate=${encodeURIComponent(startDateObj.toISOString())}&endDate=${encodeURIComponent(endDateObj.toISOString())}&limit=${limit}`;
  const makeDayQuery = (dayObj, limit = 600) => {
    const s = new Date(dayObj.getFullYear(), dayObj.getMonth(), dayObj.getDate(), 0, 0, 0, 0);
    const e = new Date(dayObj.getFullYear(), dayObj.getMonth(), dayObj.getDate(), 23, 59, 59, 999);
    return makeRangeQuery(s, e, limit);
  };
  const sameDayPrevMonth = (baseDay) => {
    const lmMonth = baseDay.getMonth() === 0 ? 11 : baseDay.getMonth() - 1;
    const lmYear = baseDay.getMonth() === 0 ? baseDay.getFullYear() - 1 : baseDay.getFullYear();
    const maxDay = new Date(lmYear, lmMonth + 1, 0).getDate();
    return new Date(lmYear, lmMonth, Math.min(baseDay.getDate(), maxDay), 0, 0, 0, 0);
  };
  const parseLocalYMD = (s) => {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return (y && m && d) ? new Date(y, m - 1, d, 0, 0, 0, 0) : null;
  };

  if (period === 'today') {
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const lm = sameDayPrevMonth(now);
    return [makeDayQuery(yest, 600), makeDayQuery(lm, 600)];
  }
  if (period === 'yesterday') {
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const dayBeforeYest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
    const lm = sameDayPrevMonth(yest);
    return [makeDayQuery(dayBeforeYest, 600), makeDayQuery(lm, 600)];
  }
  if (period === 'thisWeek') {
    const dow = now.getDay() || 7;
    const prevMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 1 - 7, 0, 0, 0, 0);
    const prevEnd = new Date(prevMon.getFullYear(), prevMon.getMonth(), prevMon.getDate() + dow - 1, 23, 59, 59, 999);
    return [makeRangeQuery(prevMon, prevEnd, 1500)];
  }
  if (period === 'lastWeek') {
    const dow = now.getDay() || 7;
    const twoWeeksAgoMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 1 - 14, 0, 0, 0, 0);
    const twoWeeksAgoSun = new Date(twoWeeksAgoMon.getFullYear(), twoWeeksAgoMon.getMonth(), twoWeeksAgoMon.getDate() + 6, 23, 59, 59, 999);
    return [makeRangeQuery(twoWeeksAgoMon, twoWeeksAgoSun, 1500)];
  }
  if (period === 'thisMonth') {
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const prevMonthMaxDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), prevMonthMaxDay), 23, 59, 59, 999);
    return [makeRangeQuery(prevStart, prevEnd, 3500)];
  }
  if (period === 'lastMonth') {
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
    return [makeRangeQuery(prevStart, prevEnd, 3500)];
  }
  if (period === 'thisYear') {
    const prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    const prevEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0, 23, 59, 59, 999);
    return [makeRangeQuery(prevStart, prevEnd, 5000)];
  }
  if (period === 'custom') {
    const sd = parseLocalYMD(cStart);
    const ed = parseLocalYMD(cEnd);
    if (!sd || !ed) return [];
    const start = sd <= ed ? sd : ed;
    const end = sd <= ed ? ed : sd;
    const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    if (totalDays === 1) {
      const prevDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
      const lm = sameDayPrevMonth(start);
      return [makeDayQuery(prevDay, 600), makeDayQuery(lm, 600)];
    }
    const prevStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - totalDays, 0, 0, 0, 0);
    const prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 23, 59, 59, 999);
    return [makeRangeQuery(prevStart, prevEnd, 3000)];
  }
  return [];
}

export default function AdminApp() {
  const { token, user, fetchWithAuth, logout } = useAuth();
  const confirm = useConfirm();

  const [tab, setTabState] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['dashboard', 'orders', 'pending-orders', 'locations', 'kiosks', 'bridge-monitoring', 'qrcodes', 'menu', 'modifiers', 'products', 'users', 'integrations', 'promotions', 'brands', 'translations', 'pos-logs', 'printer-logs', 'port-scans', 'iiko-logs', 'kiosk-logs'];
    return validTabs.includes(hash) ? hash : 'orders';
  });

  const setTab = (newTab) => {
    window.location.hash = newTab;
    setTabState(newTab);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['dashboard', 'orders', 'pending-orders', 'locations', 'kiosks', 'bridge-monitoring', 'qrcodes', 'menu', 'modifiers', 'products', 'users', 'integrations', 'promotions', 'brands', 'translations', 'pos-logs', 'printer-logs', 'port-scans', 'iiko-logs', 'kiosk-logs'];
      if (validTabs.includes(hash)) setTabState(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [orders, setOrders] = useState([]);
  const [dashboardComparisonOrders, setDashboardComparisonOrders] = useState([]);
  const [isComparisonLoading, setIsComparisonLoading] = useState(false);
  const [menuStatus, setMenuStatus] = useState(null);
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

  const [notifications, setNotifs] = useState([]);
  const [orderToasts, setOrderToasts] = useState([]);
  const knownOrderIdsRef = useRef(null);
  const toastedOrderKeysRef = useRef(new Set());

  const isOrderFromToday = (order) => {
    const dt = order?.createdAt || order?.arrivedAt;
    if (!dt) return false;
    const d = new Date(dt);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const triggerOrderToast = useCallback((order) => {
    if (!order) return;
    // Never pop live Dynamic Island notifications for historical orders from previous days
    if (order.createdAt && !isOrderFromToday(order)) return;
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

  const [deviceAlerts, setDeviceAlerts] = useState([]);
  const lastKnownDeviceStatusRef = useRef({});
  const deviceAlertsInitializedRef = useRef(false);
  const disconnectPendingSinceRef = useRef({});
  const disconnectAlertTriggeredRef = useRef({});

  const handleDismissDeviceAlert = useCallback((id) => {
    setDeviceAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleOpenDeviceLocation = useCallback((locationId) => {
    setActiveLocationDropdown(locationId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [thermalReceiptOrder, setThermalReceiptOrder] = useState(null);
  const [modalProductsPage, setModalProductsPage] = useState(1);
  const [modalProductsPerPage, setModalProductsPerPage] = useState(10);
  const [menuImages, setMenuImages] = useState({});
  const [menuProducts, setMenuProducts] = useState({});
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('admin-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  });
  const socketRef = useRef(null);
  const [kiosksLiveStatus, setKiosksLiveStatus] = useState(() => {
    try {
      const cached = localStorage.getItem('admin_cached_kiosks_live_status');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
  const [bridgeSummary, setBridgeSummary] = useState(() => {
    try {
      const cached = localStorage.getItem('admin_cached_bridge_summary');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (kiosksLiveStatus && Object.keys(kiosksLiveStatus).length > 0) {
      try {
        localStorage.setItem('admin_cached_kiosks_live_status', JSON.stringify(kiosksLiveStatus));
      } catch { }
    }
  }, [kiosksLiveStatus]);

  useEffect(() => {
    if (bridgeSummary?.locations && Object.keys(bridgeSummary.locations).length > 0) {
      try {
        localStorage.setItem('admin_cached_bridge_summary', JSON.stringify(bridgeSummary));
      } catch { }
    }
  }, [bridgeSummary]);
  const [activeLocationDropdown, setActiveLocationDropdown] = useState(null);
  const [dropdownActionLoading, setDropdownActionLoading] = useState(null);
  const [dropdownActionFeedback, setDropdownActionFeedback] = useState(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [releaseNotesTargetLoc, setReleaseNotesTargetLoc] = useState(null);
  const [dashboardRemoteLoc, setDashboardRemoteLoc] = useState(null);

  const handleDropdownAction = async (locationId, actionType) => {
    setActiveLocationDropdown(null);
    // Acțiunile care repornesc ceva cer confirmare în fereastra aplicației (ca să nu se apese din greșeală)
    if (actionType === 'restart-bridge') {
      const ok = await confirm(
        'POS Bridge va fi oprit aproximativ 1–2 minute. În acest timp NU se pot face plăți cu cardul și nu se tipărește bonul. Nu reporni dacă un client plătește chiar acum.',
        { title: 'Restart POS Bridge — ești sigur?', icon: <RestartDialogIcon />, okLabel: 'Da, repornește', cancelLabel: 'Nu, renunț', danger: true }
      );
      if (!ok) return;
    } else if (actionType === 'reload-kiosk') {
      const ok = await confirm(
        'Ecranul kiosk-ului din locație se reîncarcă. Dacă un client e în mijlocul unei comenzi, o va pierde.',
        { title: 'Refresh Ecran Kiosk — ești sigur?', icon: <RestartDialogIcon />, okLabel: 'Da, reîncarcă', cancelLabel: 'Nu, renunț', danger: true }
      );
      if (!ok) return;
    }
    const key = `${locationId}-${actionType}`;
    setDropdownActionLoading(key);
    setDropdownActionFeedback(null);
    try {
      const res = await fetch(`${BACKEND}/api/bridge-monitoring/${locationId}/${actionType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-live-2024-secure',
        },
      });
      const json = await res.json();
      if (res.ok) {
        setDropdownActionFeedback({ locationId, type: 'success', text: json.message || 'Comandă trimisă cu succes.' });
      } else {
        setDropdownActionFeedback({ locationId, type: 'error', text: json.error || 'Eroare la transmiterea comenzii.' });
      }
    } catch (err) {
      setDropdownActionFeedback({ locationId, type: 'error', text: err.message });
    } finally {
      setDropdownActionLoading(null);
      setTimeout(() => setDropdownActionFeedback(null), 5000);
    }
  };

  useKeepAlive(); // prevent Render backend from sleeping

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      const activeOrdersQuery = tab === 'orders'
        ? getOrdersQueryParams(periodFilter, customStart, customEnd)
        : getOrdersQueryParams(dashboardPeriod, dashboardCustomStart, dashboardCustomEnd);

      await Promise.all([
        fetchWithAuth(`${BACKEND}/api/locations/live-status`)
          .then(r => r.json())
          .then(d => { if (d?.liveStatus) setKiosksLiveStatus(prev => ({ ...prev, ...d.liveStatus })); })
          .catch(() => null),
        fetch('https://smart-kiosk-ttut.onrender.com/api/bridge-monitoring/status', {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        })
          .then(r => r.json())
          .then(summary => { if (summary?.locations) setBridgeSummary(summary); })
          .catch(() => null),
        fetchWithAuth(`${BACKEND}/api/orders?${activeOrdersQuery}`)
          .then(r => r.json())
          .then(d => { if (d?.orders) setOrders(d.orders); })
          .catch(() => null),
        ...(tab === 'dashboard'
          ? [Promise.all(
              getComparisonOrdersQueries(dashboardPeriod, dashboardCustomStart, dashboardCustomEnd).map(q =>
                fetchWithAuth(`${BACKEND}/api/orders?${q}`).then(r => r.json()).then(d => d?.orders || []).catch(() => [])
              )
            ).then(lists => {
              const seen = new Set();
              const merged = [];
              lists.flat().forEach(o => {
                if (!o) return;
                const k = o._id || o.id || o.orderNumber;
                if (k) { if (seen.has(k)) return; seen.add(k); }
                merged.push(o);
              });
              setDashboardComparisonOrders(merged);
            }).catch(() => null)]
          : []),
      ]);
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 500);
    }
  };

  const liveKiosksCount = useMemo(() => {
    const activeLocations = new Set();
    const locDefs = [
      { id: 'cluj1', aliases: ['cluj1', 'cluj', 'cluj-centru', 'cluj-main', 'smashme-main', 'sm-cluj', 'smashme-cluj', '9c63cff6-1d66-442d-a98d-2302656e3943', '90296b11-9ba9-4279-a69b-1f84e193315e'] },
      { id: 'cluj2', aliases: ['cluj2', 'cluj-2', 'cj2', 'cj-2', 'smashme-cj2', 'smashme cj-2', 'cj-kiosk2', 'cluj-kiosk2'] },
      { id: 'sm-brasov', aliases: ['sm-brasov', 'brasov', 'brasov-centru', 'rollmaster', 'rollmaster-brasov', 'rm-brasov', 'adddb5a0-26e5-4d50-b472-1c74726c3f72'] },
      { id: 'constanta1', aliases: ['constanta1', 'constanta', 'smashme-constanta', '8308e796-8780-4d18-ae66-4e430178c778'] }
    ];

    locDefs.forEach(loc => {
      const bridgeLoc = bridgeSummary?.locations?.[loc.id] ||
        (loc.aliases ? loc.aliases.map(a => bridgeSummary?.locations?.[a]).find(Boolean) : null);
      const isBridgeOnline = Boolean(bridgeLoc?.status === 'online' || bridgeLoc?.isBridgeOnline);
      if (isBridgeOnline) {
        activeLocations.add(loc.id);
      }
    });

    return activeLocations.size;
  }, [kiosksLiveStatus, bridgeSummary]);

  /* ─── Live Locations Health Summary (for Apple Dynamic Island) ─── */
  const locationsHealth = useMemo(() => {
    const locDefs = [
      { id: 'cluj1', name: 'Cluj 1', aliases: ['cluj1', 'cluj', 'cluj-centru', 'cluj-main', 'smashme-main', 'sm-cluj', 'smashme-cluj', '9c63cff6-1d66-442d-a98d-2302656e3943', '90296b11-9ba9-4279-a69b-1f84e193315e'] },
      { id: 'cluj2', name: 'Cluj 2', aliases: ['cluj2', 'cluj-2', 'cj2', 'cj-2', 'smashme-cj2', 'smashme cj-2', 'cj-kiosk2', 'cluj-kiosk2'] },
      { id: 'sm-brasov', name: 'Brașov', aliases: ['sm-brasov', 'brasov', 'brasov-centru', 'rollmaster', 'rollmaster-brasov', 'rm-brasov', 'adddb5a0-26e5-4d50-b472-1c74726c3f72'] },
      { id: 'constanta1', name: 'Constanța', aliases: ['constanta1', 'constanta', 'smashme-constanta', '8308e796-8780-4d18-ae66-4e430178c778'] }
    ];

    let onlineCount = 0;
    const issues = [];

    locDefs.forEach(loc => {
      const liveKiosk = loc.aliases.map(a => kiosksLiveStatus[a]).find(Boolean);
      const bridgeLoc = bridgeSummary?.locations?.[loc.id] ||
        loc.aliases.map(a => bridgeSummary?.locations?.[a]).find(Boolean);
      const isBridgeOnline = Boolean(bridgeLoc?.status === 'online' || bridgeLoc?.isBridgeOnline);
      const hasRecent = Boolean(bridgeLoc?.connectedAt && (Date.now() - bridgeLoc.connectedAt < 30000) && bridgeLoc.port && bridgeLoc.port !== 'N/A');
      const bridgeActive = isBridgeOnline || hasRecent;
      const isKioskConnected = Boolean(
        liveKiosk?.isLive ||
        liveKiosk?.online ||
        (liveKiosk?.onlineCount > 0) ||
        bridgeLoc?.isKioskOnline ||
        (loc.id === 'cluj2' && bridgeActive)
      );

      if (isKioskConnected && bridgeActive) {
        onlineCount += 1;
      } else if (bridgeSummary?.locations) {
        if (!bridgeActive && isKioskConnected) {
          issues.push({ id: loc.id, name: loc.name, statusTone: 'warning', statusLabel: 'POS Oprit', message: 'Ecran Kiosk activ, POS Bridge deconectat' });
        } else if (bridgeActive && !isKioskConnected) {
          issues.push({ id: loc.id, name: loc.name, statusTone: 'warning', statusLabel: 'Ecran Inactiv', message: 'POS Bridge activ, ecran Kiosk oprit' });
        } else {
          issues.push({ id: loc.id, name: loc.name, statusTone: 'offline', statusLabel: 'Offline', message: 'Kiosk și POS Bridge deconectate' });
        }
      }
    });

    return { onlineCount, totalCount: locDefs.length, issues };
  }, [kiosksLiveStatus, bridgeSummary]);

  /* ─── Device Disconnect & Reconnect Alert Watcher ─── */
  useEffect(() => {
    if (!bridgeSummary || !bridgeSummary.locations) return;

    const locDefs = [
      { id: 'cluj1', name: 'Cluj 1', aliases: ['cluj1', 'cluj', 'cluj-centru', 'cluj-main', 'smashme-main', 'sm-cluj', 'smashme-cluj', '9c63cff6-1d66-442d-a98d-2302656e3943', '90296b11-9ba9-4279-a69b-1f84e193315e'] },
      { id: 'cluj2', name: 'Cluj 2', aliases: ['cluj2', 'cluj-2', 'cj2', 'cj-2', 'smashme-cj2', 'smashme cj-2', 'cj-kiosk2', 'cluj-kiosk2'] },
      { id: 'sm-brasov', name: 'Brașov', aliases: ['sm-brasov', 'brasov', 'brasov-centru', 'rollmaster', 'rollmaster-brasov', 'rm-brasov', 'adddb5a0-26e5-4d50-b472-1c74726c3f72'] },
      { id: 'constanta1', name: 'Constanța', aliases: ['constanta1', 'constanta', 'smashme-constanta', '8308e796-8780-4d18-ae66-4e430178c778'] }
    ];

    const currentStatuses = {};
    const newAlerts = [];

    locDefs.forEach(loc => {
      const liveKiosk = loc.aliases.map(a => kiosksLiveStatus[a]).find(Boolean);
      const bridgeLoc = bridgeSummary?.locations?.[loc.id] ||
        (loc.aliases ? loc.aliases.map(a => bridgeSummary?.locations?.[a]).find(Boolean) : null);
      const isBridgeOnline = Boolean(bridgeLoc?.status === 'online' || bridgeLoc?.isBridgeOnline);

      const hasRecentConnection = Boolean(bridgeLoc?.connectedAt && (Date.now() - bridgeLoc.connectedAt < 30 * 1000) && bridgeLoc.port && bridgeLoc.port !== 'N/A');
      const bridgeIsActive = isBridgeOnline || hasRecentConnection;
      const isKioskConnected = Boolean(
        liveKiosk?.isLive ||
        liveKiosk?.online ||
        (liveKiosk?.onlineCount > 0) ||
        bridgeLoc?.isKioskOnline ||
        (loc.id === 'cluj2' && bridgeIsActive)
      );

      let statusTone = 'offline';
      let statusLabel = 'Offline';
      let message = 'Kiosk oprit / fără conexiune internet!';

      // Doar dacă TOATE componentele sunt conectate (ecran + POS bridge) apare cu VERDE!
      if (isKioskConnected && bridgeIsActive) {
        statusTone = 'online';
        statusLabel = 'Online';
        message = 'Kiosk și POS conectate sincronizat';
      } else if (!bridgeIsActive && isKioskConnected) {
        statusTone = 'warning';
        statusLabel = 'POS Oprit';
        message = 'Ecran Kiosk activ, dar POS Bridge este deconectat!';
      } else if (bridgeIsActive && !isKioskConnected) {
        statusTone = 'warning';
        statusLabel = 'Ecran Inactiv';
        message = 'POS Bridge conectat, dar ecranul Kiosk este inactiv!';
      }

      currentStatuses[loc.id] = { statusTone, statusLabel, message };

      const prev = lastKnownDeviceStatusRef.current[loc.id];

      // Filtru inteligent anti-alarme false:
      // Dacă este online, curățăm pending-ul și trimitem reconnected doar dacă a fost trimisă anterior alertă reală
      if (statusTone === 'online') {
        if (disconnectAlertTriggeredRef.current[loc.id]) {
          newAlerts.push({
            id: `dev-alert-${loc.id}-${Date.now()}`,
            locationId: loc.id,
            locationName: loc.name,
            statusTone: 'online',
            statusLabel: 'Online',
            message: 'Conexiunea a fost restabilită cu succes!',
            type: 'reconnected',
            timestamp: Date.now()
          });
          disconnectAlertTriggeredRef.current[loc.id] = false;
        }
        disconnectPendingSinceRef.current[loc.id] = null;
      } else {
        // statusTone este 'warning' sau 'offline'
        if (!disconnectPendingSinceRef.current[loc.id]) {
          disconnectPendingSinceRef.current[loc.id] = Date.now();
        }

        const durationDown = Date.now() - disconnectPendingSinceRef.current[loc.id];
        // Declanșează toast de alertă DOAR dacă deconectarea persistă mai mult de 35 secunde
        // (astfel evităm complet alarmele false la restarturile automate de soft de 15 secunde)
        if (deviceAlertsInitializedRef.current && prev && durationDown >= 35000 && !disconnectAlertTriggeredRef.current[loc.id]) {
          newAlerts.push({
            id: `dev-alert-${loc.id}-${Date.now()}`,
            locationId: loc.id,
            locationName: loc.name,
            statusTone,
            statusLabel,
            message,
            type: statusTone === 'offline' ? 'disconnected' : 'warning',
            timestamp: Date.now()
          });
          disconnectAlertTriggeredRef.current[loc.id] = true;
        }
      }
    });

    lastKnownDeviceStatusRef.current = currentStatuses;
    deviceAlertsInitializedRef.current = true;

    // Elimină automat alertele de avertizare pentru orice locație care a revenit ONLINE (fără a crea array nou dacă nu se schimbă nimic)
    setDeviceAlerts(prev => {
      if (prev.length === 0) return prev;
      const next = prev.filter(a => {
        const locStatus = currentStatuses[a.locationId];
        if (locStatus && locStatus.statusTone === 'online' && a.type !== 'reconnected') {
          return false;
        }
        return true;
      });
      return next.length === prev.length ? prev : next;
    });

    if (newAlerts.length > 0) {
      setDeviceAlerts(prev => {
        const incomingLocIds = new Set(newAlerts.map(a => a.locationId));
        const filtered = prev.filter(p => !incomingLocIds.has(p.locationId));
        return [...newAlerts, ...filtered].slice(0, 3);
      });
    }
  }, [kiosksLiveStatus, bridgeSummary]);

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
      if (statusMap) {
        setKiosksLiveStatus(prev => {
          const next = { ...prev };
          for (const [k, val] of Object.entries(statusMap)) {
            const incomingOnline = Boolean(val?.isLive || val?.online || (val?.onlineCount > 0));
            const prevOnline = Boolean(next[k]?.isLive || next[k]?.online || (next[k]?.onlineCount > 0));
            if (incomingOnline || !prevOnline) {
              next[k] = val;
            }
          }
          return next;
        });
      }
    });

    socket.on('bridge_status_update', (summary) => {
      if (summary?.locations) {
        setBridgeSummary(prev => {
          if (!prev?.locations) return summary;
          const mergedLocs = { ...prev.locations };
          for (const [k, loc] of Object.entries(summary.locations)) {
            const incomingOnline = Boolean(loc?.isBridgeOnline || loc?.status === 'online');
            const prevOnline = Boolean(mergedLocs[k]?.isBridgeOnline || mergedLocs[k]?.status === 'online');
            if (incomingOnline || !prevOnline) {
              mergedLocs[k] = { ...(mergedLocs[k] || {}), ...loc };
            }
          }
          return { ...prev, ...summary, locations: mergedLocs };
        });
      }
    });

    socket.on('location_updated', (updatedLoc) => {
      if (updatedLoc?.id) {
        window.dispatchEvent(new CustomEvent('admin_location_updated', { detail: updatedLoc }));
      }
    });

    // Initial live status fetch + 15s poll fallback (combina ttut + legacy v7ws)
    const fetchLiveKiosks = () => {
      Promise.all([
        fetchWithAuth(`${BACKEND}/api/locations/live-status`).then(r => r.json()).catch(() => null),
        fetch('https://smart-kiosk-v7ws.onrender.com/api/locations/live-status', {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).then(r => r.json()).catch(() => null),
        fetch('https://smart-kiosk-ttut.onrender.com/api/locations/live-status', {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).then(r => r.json()).catch(() => null)
      ]).then(([d1, d2, d3]) => {
        const sources = [d1?.liveStatus || {}, d2?.liveStatus || {}, d3?.liveStatus || {}];
        const mergedLive = {};
        for (const src of sources) {
          for (const [k, val] of Object.entries(src)) {
            const isValOnline = Boolean(val?.isLive || val?.online || (val?.onlineCount > 0));
            const isExistingOnline = Boolean(mergedLive[k]?.isLive || mergedLive[k]?.online || (mergedLive[k]?.onlineCount > 0));
            if (!mergedLive[k] || isValOnline || !isExistingOnline) {
              mergedLive[k] = {
                ...(mergedLive[k] || {}),
                ...val,
                ...(isExistingOnline || isValOnline ? { isLive: true, online: true } : {})
              };
            }
          }
        }
        if (Object.keys(mergedLive).length > 0) {
          setKiosksLiveStatus(prev => ({ ...prev, ...mergedLive }));
        }
      }).catch(() => { });
    };
    fetchLiveKiosks();
    const livePoll = setInterval(fetchLiveKiosks, 15000);

    // Initial bridge monitoring fetch + 15s poll (combina ttut + legacy v7ws)
    const fetchBridgeStatus = () => {
      Promise.all([
        fetch('https://smart-kiosk-ttut.onrender.com/api/bridge-monitoring/status', {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).then(r => r.json()).catch(() => null),
        fetch('https://smart-kiosk-v7ws.onrender.com/api/bridge-monitoring/status', {
          headers: { 'x-api-key': 'sk-live-2024-secure' }
        }).then(r => r.json()).catch(() => null)
      ]).then(([tt, legacy]) => {
        if (!tt && !legacy) return;
        const merged = tt ? { ...tt, locations: { ...(tt.locations || {}) } } : { locations: {} };
        if (legacy?.locations) {
          for (const [k, loc] of Object.entries(legacy.locations)) {
            if (loc.isBridgeOnline && (!merged.locations[k] || !merged.locations[k].isBridgeOnline)) {
              merged.locations[k] = { ...merged.locations[k], ...loc, isBridgeOnline: true, status: 'online' };
            }
          }
        }
        if (merged?.locations) setBridgeSummary(merged);
      }).catch(() => { });
    };
    fetchBridgeStatus();
    const bridgePoll = setInterval(fetchBridgeStatus, 15000);

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
        localSocket.on('kiosks_live_status', (statusMap) => {
          setKiosksLiveStatus(prev => ({ ...prev, ...(statusMap || {}) }));
        });
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

  /* ─── Load initial orders + poll recent every 30s ─── */
  useEffect(() => {
    let isCancelled = false;

    const activeOrdersQuery = tab === 'orders'
      ? getOrdersQueryParams(periodFilter, customStart, customEnd)
      : getOrdersQueryParams(dashboardPeriod, dashboardCustomStart, dashboardCustomEnd);

    // 1. Încărcare inițială pentru perioada selectată (Azi = doar ~36 KB în loc de 10.5 MB)
    fetchWithAuth(`${BACKEND}/api/orders?${activeOrdersQuery}`)
      .then(r => r.json())
      .then(d => {
        if (isCancelled) return;
        const list = d.orders || [];
        if (knownOrderIdsRef.current === null) {
          knownOrderIdsRef.current = new Set();
        }
        // Only register loaded orders as known — switching tabs or date filters must NEVER trigger live toasts for old orders
        list.forEach(o => {
          if (o._id) knownOrderIdsRef.current.add(o._id);
          if (o.id) knownOrderIdsRef.current.add(o.id);
          if (o.orderNumber) knownOrderIdsRef.current.add(o.orderNumber);
        });
        setOrders(list);
      })
      .catch(() => { });

    // 1b. Încărcare comenzi REALE pentru perioada de comparație din Dashboard (Ieri / Alaltăieri / Luna trec. / Săpt. trec. etc.)
    if (tab === 'dashboard') {
      const compQueries = getComparisonOrdersQueries(dashboardPeriod, dashboardCustomStart, dashboardCustomEnd);
      if (compQueries.length > 0) {
        setDashboardComparisonOrders([]);
        setIsComparisonLoading(true);
        Promise.all(
          compQueries.map(q =>
            fetchWithAuth(`${BACKEND}/api/orders?${q}`)
              .then(r => r.json())
              .then(d => d?.orders || [])
              .catch(() => [])
          )
        )
          .then(lists => {
            if (isCancelled) return;
            const merged = [];
            const seen = new Set();
            lists.flat().forEach(o => {
              if (!o) return;
              const k = o._id || o.id || o.orderNumber;
              if (k) {
                if (seen.has(k)) return;
                seen.add(k);
              }
              merged.push(o);
            });
            setDashboardComparisonOrders(merged);
            setIsComparisonLoading(false);
          })
          .catch(() => {
            if (!isCancelled) setIsComparisonLoading(false);
          });
      } else {
        setDashboardComparisonOrders([]);
        setIsComparisonLoading(false);
      }
    }

    // 2. Verificare de fundal la fiecare 30s: transferă doar ultimele 30 de comenzi (~50 KB)
    const pollRecent = () => {
      fetchWithAuth(`${BACKEND}/api/orders?limit=30`)
        .then(r => r.json())
        .then(d => {
          if (isCancelled) return;
          const recentList = d.orders || [];
          if (recentList.length === 0) return;

          if (knownOrderIdsRef.current !== null) {
            const nowMs = Date.now();
            const newArrivals = recentList.filter(o => {
              const id = o._id || o.id;
              const num = o.orderNumber;
              const isKnown = (id && knownOrderIdsRef.current.has(id)) || (num && knownOrderIdsRef.current.has(num));
              if (isKnown) return false;
              // Only alert for genuinely fresh orders placed TODAY (within last 5 minutes)
              const createdMs = new Date(o.createdAt || o.arrivedAt || 0).getTime();
              return isOrderFromToday(o) && createdMs > 0 && (nowMs - createdMs) < 5 * 60 * 1000;
            });
            if (newArrivals.length > 0) {
              newArrivals.slice(0, 1).forEach(o => triggerOrderToast(o));
            }
          }
          recentList.forEach(o => {
            if (o._id) knownOrderIdsRef.current?.add(o._id);
            if (o.id) knownOrderIdsRef.current?.add(o.id);
            if (o.orderNumber) knownOrderIdsRef.current?.add(o.orderNumber);
          });

          // Combină comenzile recente fără să șteargă lista deja încărcată
          setOrders(prev => {
            const incomingMap = new Map();
            recentList.forEach(o => {
              const k = o._id || o.id || o.orderNumber;
              if (k) incomingMap.set(k, o);
            });
            const updated = prev.map(o => {
              const k = o._id || o.id || o.orderNumber;
              if (k && incomingMap.has(k)) {
                const match = incomingMap.get(k);
                incomingMap.delete(k);
                return { ...o, ...match };
              }
              return o;
            });
            const fresh = Array.from(incomingMap.values());
            return [...fresh, ...updated];
          });
        })
        .catch(() => { });
    };

    const interval = setInterval(pollRecent, 30_000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [tab, periodFilter, customStart, customEnd, dashboardPeriod, dashboardCustomStart, dashboardCustomEnd, triggerOrderToast]);

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
      .catch(() => { });
  }, []);
  useEffect(() => { if (tab === 'menu') fetchMenuStatus(); }, [tab, fetchMenuStatus]);

  /* ─── Fetch menu products + images for orders tables and detail ── */
  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND}/api/menu/all`).then(r => r.json()).catch(() => ({})),
      fetch(`${BACKEND}/api/products/overrides/smashme`).then(r => r.json()).catch(() => ({})),
      fetch(`${BACKEND}/api/products/overrides/rollmaster`).then(r => r.json()).catch(() => ({})),
      fetch(`${BACKEND}/api/products/overrides/crunch`).then(r => r.json()).catch(() => ({})),
      fetch(`${BACKEND}/api/products/overrides/lovesushi`).then(r => r.json()).catch(() => ({})),
      fetch(`${BACKEND}/api/products/overrides/pokiwoki`).then(r => r.json()).catch(() => ({}))
    ]).then(([allMenuData, ovSmash, ovRoll, ovCrunch, ovLove, ovPoki]) => {
      // Build product map from iiko menu
      const prodMap = {};
      Object.keys(allMenuData || {}).forEach(b => {
        const brandMenu = allMenuData[b]?.menu?.products || [];
        brandMenu.forEach(p => {
          if (p.id) prodMap[p.id] = p;
          if (p.name) prodMap[p.name.toLowerCase().trim()] = p;
        });
      });
      setMenuProducts(prodMap);

      // Build image map from all overrides
      const imgMap = {};
      [ovSmash, ovRoll, ovCrunch, ovLove, ovPoki].forEach(ovSet => {
        if (ovSet && typeof ovSet === 'object') {
          Object.entries(ovSet).forEach(([pid, val]) => {
            if (val?.imageUrl) imgMap[pid] = val.imageUrl;
          });
        }
      });
      setMenuImages(imgMap);
    }).catch(() => { });
  }, []);

  const addNotif = (msg) => {
    const id = Date.now();
    setNotifs(prev => [{ id, msg }, ...prev.slice(0, 4)]);
    setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== id)), 6000);
  };

  /* ─── Stats ──────────────────────────────────────── */
  const stats = {
    total: orders.length,
    todayTotal: orders.filter(o => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      const today = new Date();
      return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
    }).length,
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    revenue: orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totalAmount || 0), 0),
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
        if (dashboardPayment === 'visa' && (!isCard || detectCardBrand(o) !== 'visa')) return false;
        if (dashboardPayment === 'mastercard' && (!isCard || detectCardBrand(o) !== 'mastercard')) return false;
        if (dashboardPayment.startsWith('bank_')) {
          const targetBankId = dashboardPayment.replace('bank_', '');
          if (!isCard || detectCardBank(o).id !== targetBankId) return false;
        }
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('admin_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(active);
      document.documentElement.classList.toggle('admin-fullscreen', active);
    };

    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
      document.documentElement.classList.remove('admin-fullscreen');
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      if (!active) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch {
      // Fallback: dacă browserul blochează API-ul, togglează clasa de layout extins
      setIsFullscreen(prev => {
        const next = !prev;
        document.documentElement.classList.toggle('admin-fullscreen', next);
        return next;
      });
    }
  }, []);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(prev => !prev);
    } else {
      setIsSidebarCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem('admin_sidebar_collapsed', String(next)); } catch { }
        return next;
      });
    }
  };

  if (!token) return <LoginScreen />;

  return (
    <div className="flex flex-col h-screen h-[100dvh] overflow-hidden min-w-0 max-w-full w-full bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors duration-200">

      {/* ─── GLOBAL TOP HEADER (macOS Sequoia Toolbar + Sidebar Seam Toggle + Centered Apple Dynamic Island) ─── */}
      <header className="h-14 shrink-0 pl-3 md:pl-0 pr-3 md:pr-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 apple-glass border-b border-black/[0.06] dark:border-white/[0.08] z-40 transition-colors duration-200 w-full max-w-full relative">

        {/* Left: Renewed Apple-Style GetApp Logo + Sidebar Toggle anchored right at the Sidebar Boundary */}
        <div
          className={`flex items-center justify-self-start h-full min-w-0 transition-all duration-300 ${isSidebarCollapsed
            ? 'gap-2.5 md:pl-4'
            : 'gap-2.5 md:gap-0 md:justify-between md:w-60 md:pl-4 md:pr-3 md:border-r md:border-black/[0.06] md:dark:border-white/[0.08]'
            }`}
        >
          <button
            type="button"
            onClick={() => setTab('dashboard')}
            className="flex items-center cursor-pointer group select-none min-w-0"
            title="Mergi la Dashboard"
          >
            <img
              src={theme === 'dark' ? "/getapp_smart_kiosk_white.png" : "/getapp_smart_kiosk_logo.png"}
              alt="GetApp Smart Kiosk"
              className="max-h-8 md:max-h-9 object-contain transition-transform duration-200 group-hover:scale-[1.03]"
            />
          </button>

          {/* Apple Liquid Glass Sidebar Toggle — Anchored right on the Sidebar/Content Boundary */}
          <button
            type="button"
            className="apple-glass-btn apple-glass-btn-sm"
            onClick={handleToggleSidebar}
            title={isSidebarCollapsed ? 'Afișează meniul lateral' : 'Ascunde meniul lateral'}
            aria-label={isSidebarCollapsed ? 'Afișează meniul lateral' : 'Ascunde meniul lateral'}
          >
            <span className="md:hidden">
              <Menu className="w-[15.5px] h-[15.5px]" strokeWidth={1.9} />
            </span>
            <span className="hidden md:inline-flex">
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-[15.5px] h-[15.5px]" strokeWidth={1.9} />
              ) : (
                <PanelLeftClose className="w-[15.5px] h-[15.5px]" strokeWidth={1.9} />
              )}
            </span>
          </button>
        </div>

        {/* Center: Apple Dynamic Island & Unified Notification Center */}
        <div className="justify-self-center flex items-center justify-center">
          <DynamicIsland
            orderToasts={orderToasts}
            deviceAlerts={deviceAlerts}
            systemNotifications={notifications}
            orders={orders}
            locationsHealth={locationsHealth}
            connected={connected}
            onDismissOrderToast={handleDismissOrderToast}
            onDismissDeviceAlert={handleDismissDeviceAlert}
            onOpenOrder={(order) => setSelectedOrder(order)}
            onOpenLocation={handleOpenDeviceLocation}
            onViewAllOrders={() => setTab('orders')}
            onOpenLiveStatus={() => setTab('bridge-monitoring')}
          />
        </div>

        {/* Right: Authentic Apple Liquid Glass Circular Controls */}
        <div className="flex items-center gap-2 justify-self-end shrink-0">
          <button
            type="button"
            title="Reîmprospătează datele"
            onClick={handleManualRefresh}
            disabled={isManualRefreshing}
            className="apple-glass-btn disabled:opacity-40"
          >
            <RefreshCw strokeWidth={1.9} className={`w-[15.5px] h-[15.5px] ${isManualRefreshing ? 'animate-spin text-[#007AFF]' : ''}`} />
          </button>

          <button
            type="button"
            title={theme === 'dark' ? 'Mod Luminos' : 'Mod Întunecat'}
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="apple-glass-btn"
          >
            {theme === 'dark' ? <Sun strokeWidth={1.9} className="w-[15.5px] h-[15.5px]" /> : <Moon strokeWidth={1.9} className="w-[15.5px] h-[15.5px]" />}
          </button>

          <button
            type="button"
            title={isFullscreen ? 'Ieși din Ecran Complet (Esc)' : 'Ecran Complet (optimizat Laptop → 5K Ultrawide)'}
            onClick={handleToggleFullscreen}
            className={`apple-glass-btn ${isFullscreen ? '!text-[#007AFF] dark:!text-[#0A84FF] !border-[#007AFF]/30 dark:!border-[#0A84FF]/40' : ''}`}
          >
            {isFullscreen ? (
              <Minimize2 strokeWidth={1.9} className="w-[15.5px] h-[15.5px]" />
            ) : (
              <Maximize2 strokeWidth={1.9} className="w-[15.5px] h-[15.5px]" />
            )}
          </button>

          <div className="w-px h-5 bg-black/[0.08] dark:bg-white/[0.12] mx-0.5 hidden sm:block" />

          <button
            type="button"
            title="Deconectare"
            onClick={logout}
            className="apple-glass-btn apple-glass-btn-danger"
          >
            <LogOut strokeWidth={1.9} className="w-[15.5px] h-[15.5px]" />
          </button>
        </div>
      </header>

      {/* ─── BODY (macOS Sidebar + Main Canvas) ─── */}
      <div className="flex flex-1 overflow-hidden min-w-0 max-w-full w-full">

        {/* ─── macOS Sequoia Collapsible Sidebar ─── */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/35 backdrop-blur-xs z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}
        <aside className={`shrink-0 apple-sidebar flex flex-col transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] z-30 ${isSidebarOpen
          ? 'fixed inset-y-0 left-0 w-60 border-r border-black/[0.06] dark:border-white/[0.08] shadow-2xl'
          : isSidebarCollapsed
            ? 'hidden md:flex md:w-0 md:overflow-hidden md:opacity-0 md:border-r-0 md:pointer-events-none'
            : 'hidden md:flex md:w-60 border-r border-black/[0.06] dark:border-white/[0.08]'
          }`}>
          <div className="md:hidden flex items-center justify-end px-3 pt-3">
            <button type="button" className="apple-close-btn !w-7 !h-7" onClick={() => setIsSidebarOpen(false)}>
              <X size={14} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3.5 px-2.5 space-y-5">
            {[
              {
                section: 'Gestiune & Vânzări',
                items: [
                  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[16px] h-[16px]" /> },
                  { id: 'orders', label: 'Comenzi', icon: <ShoppingBag className="w-[16px] h-[16px]" /> },
                  { id: 'pending-orders', label: 'În Așteptare', icon: <Clock className="w-[16px] h-[16px]" /> },
                  { id: 'locations', label: 'Locații', icon: <MapPin className="w-[16px] h-[16px]" /> },
                  { id: 'kiosks', label: 'Kioskuri', icon: <MonitorSmartphone className="w-[16px] h-[16px]" /> },
                  { id: 'bridge-monitoring', label: 'LIVE Status', icon: <Server className="w-[16px] h-[16px]" /> },
                ]
              },
              {
                section: 'Catalog & Promoții',
                items: [
                  { id: 'menu', label: 'Meniu / Syrve', icon: <Utensils className="w-[16px] h-[16px]" /> },
                  { id: 'promotions', label: 'Promoții & Vouchere', icon: <Gift className="w-[16px] h-[16px]" /> },
                  { id: 'brands', label: 'Branduri', icon: <Store className="w-[16px] h-[16px]" /> },
                  { id: 'products', label: 'Produse & Etichete', icon: <Tags className="w-[16px] h-[16px]" /> },
                  { id: 'modifiers', label: 'Imagini Opțiuni', icon: <ImageIcon className="w-[16px] h-[16px]" /> },
                  { id: 'translations', label: 'Traduceri Automate', icon: <Languages className="w-[16px] h-[16px]" /> },
                  { id: 'qrcodes', label: 'QR Coduri', icon: <QrCode className="w-[16px] h-[16px]" /> },
                ]
              },
              {
                section: 'Diagnostic & Sistem',
                items: [
                  ...(user?.role === 'admin' ? [{ id: 'pos-logs', label: 'Loguri POS', icon: <CreditCard className="w-[16px] h-[16px]" /> }] : []),
                  ...(user?.role === 'admin' ? [{ id: 'printer-logs', label: 'Loguri Imprimantă', icon: <Printer className="w-[16px] h-[16px]" /> }] : []),
                  ...(user?.role === 'admin' ? [{ id: 'port-scans', label: 'Scanare Porturi PC', icon: <MonitorSmartphone className="w-[16px] h-[16px]" /> }] : []),
                  ...(user?.role === 'admin' ? [{ id: 'iiko-logs', label: 'Loguri iiko', icon: <FileText className="w-[16px] h-[16px]" /> }] : []),
                  ...(user?.role === 'admin' ? [{ id: 'kiosk-logs', label: 'Loguri Kiosk (PIN)', icon: <Lock className="w-[16px] h-[16px]" /> }] : []),
                  ...(user?.role === 'admin' ? [{ id: 'integrations', label: 'Integrări POS', icon: <Blocks className="w-[16px] h-[16px]" /> }] : []),
                  ...(user?.role === 'admin' ? [{ id: 'users', label: 'Echipă', icon: <Users className="w-[16px] h-[16px]" /> }] : []),
                ]
              }
            ].map(group => (
              <div key={group.section} className="space-y-0.5">
                <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-tight text-[#86868B] dark:text-[#636366]">
                  {group.section}
                </div>
                {group.items.map(item => {
                  const isActive = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[9px] text-[13px] transition-all cursor-pointer ${isActive
                        ? 'bg-[#007AFF] text-white font-medium shadow-[0_1px_2px_rgba(0,122,255,0.28)]'
                        : 'text-[#1D1D1F]/80 dark:text-[#F5F5F7]/80 font-normal hover:bg-black/[0.045] dark:hover:bg-white/[0.06] hover:text-[#1D1D1F] dark:hover:text-white'
                        }`}
                      onClick={() => { setTab(item.id); setIsSidebarOpen(false); }}
                    >
                      <span className={isActive ? 'text-white' : 'text-[#007AFF] dark:text-[#0A84FF]'}>
                        {item.icon}
                      </span>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Compact macOS Sidebar Status Footer */}
          <div className="px-3 py-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
            <button
              type="button"
              onClick={() => { setTab('bridge-monitoring'); setIsSidebarOpen(false); }}
              title="Vezi starea echipamentelor"
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[12px] font-medium bg-black/[0.04] hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`} />
                <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">{connected ? 'Conectat' : 'Offline'}</span>
              </div>
              {connected && (
                <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D] tabular-nums">
                  {liveKiosksCount} {liveKiosksCount === 1 ? 'kiosk' : 'kiosk-uri'}
                </span>
              )}
            </button>

            <div className="px-1 flex items-center justify-between text-[11px] text-[#86868B] dark:text-[#636366] select-none tabular-nums">
              <span>Build #{BUILD_INFO.number}</span>
              {BUILD_INFO.date && <span className="truncate ml-2">{BUILD_INFO.date}</span>}
            </div>
          </div>
        </aside>

        {/* ─── Main Apple Grouped Canvas (Adaptive Laptop → 4K → 5K Ultrawide) ─── */}
        <main className="admin-adaptive-main flex-1 flex flex-col overflow-y-auto overflow-x-hidden min-w-0 max-w-full w-full bg-[#F5F5F7] dark:bg-[#000000] relative">
          <div className="admin-adaptive-container w-full mx-auto flex flex-col flex-1 min-w-0">
          <div className="shrink-0 px-4 md:px-7 pt-5 md:pt-6 pb-3">
            <h2 className="text-[22px] md:text-[26px] font-bold tracking-[-0.022em] text-[#1D1D1F] dark:text-[#F5F5F7]">
              {tab === 'dashboard' && 'Dashboard'}
              {tab === 'orders' && 'Comenzi'}
              {tab === 'pending-orders' && 'Comenzi În Așteptare'}
              {tab === 'locations' && 'Locații'}
              {tab === 'kiosks' && 'Kiosk-uri & Screensavere'}
              {tab === 'bridge-monitoring' && 'LIVE Status'}
              {tab === 'qrcodes' && 'Coduri QR & Portal Mobil'}
              {tab === 'menu' && 'Meniu / Syrve'}
              {tab === 'translations' && 'Traduceri Automate'}
              {tab === 'modifiers' && 'Imagini Opțiuni'}
              {tab === 'products' && 'Produse & Etichete'}
              {tab === 'users' && 'Echipă & Permisiuni'}
              {tab === 'integrations' && 'Integrări POS'}
              {tab === 'promotions' && 'Promoții & Vouchere'}
              {tab === 'brands' && 'Branduri'}
              {tab === 'pos-logs' && 'Loguri POS'}
              {tab === 'printer-logs' && 'Loguri Imprimantă'}
              {tab === 'port-scans' && 'Scanare Porturi PC'}
              {tab === 'iiko-logs' && 'Loguri iiko Syrve'}
              {tab === 'kiosk-logs' && 'Loguri Kiosk & PIN'}
            </h2>
          </div>

          {/* ─── DASHBOARD ─── */}
          {tab === 'dashboard' && (
            <div className="space-y-4 md:space-y-5 px-4 md:px-7 pb-10 min-w-0 max-w-full w-full">

              {/* Live Kiosks Status Strip (Concentric Apple Pill Toolbar) */}
              <div className="apple-card !rounded-[24px] sm:!rounded-full p-2 flex flex-row items-center justify-between gap-2 w-full max-w-full min-w-0">
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 flex-1 min-w-0">
                  {[
                    {
                      id: 'cluj1',
                      name: 'Cluj 1 (Centru)',
                      aliases: ['cluj1', 'cluj', 'cluj-centru', 'cluj-main', 'smashme-main', 'sm-cluj', 'smashme-cluj', '9c63cff6-1d66-442d-a98d-2302656e3943', '90296b11-9ba9-4279-a69b-1f84e193315e']
                    },
                    {
                      id: 'cluj2',
                      name: 'Cluj 2',
                      aliases: ['cluj2', 'cluj-2', 'cj2', 'cj-2', 'smashme-cj2', 'smashme cj-2', 'cj-kiosk2', 'cluj-kiosk2']
                    },
                    {
                      id: 'sm-brasov',
                      name: 'Brașov',
                      aliases: ['sm-brasov', 'brasov', 'brasov-centru', 'rollmaster', 'rollmaster-brasov', 'rm-brasov', 'adddb5a0-26e5-4d50-b472-1c74726c3f72']
                    },
                    {
                      id: 'constanta1',
                      name: 'Constanța',
                      aliases: ['constanta1', 'constanta', 'smashme-constanta', '8308e796-8780-4d18-ae66-4e430178c778']
                    },
                  ].map(loc => {
                    const liveKiosk = loc.aliases.map(a => kiosksLiveStatus[a]).find(Boolean);
                    const bridgeLoc = bridgeSummary?.locations?.[loc.id] ||
                      (loc.aliases ? loc.aliases.map(a => bridgeSummary?.locations?.[a]).find(Boolean) : null);
                    const isBridgeOnline = Boolean(bridgeLoc?.status === 'online' || bridgeLoc?.isBridgeOnline);

                    const hasRecentConnection = Boolean(bridgeLoc?.connectedAt && (Date.now() - bridgeLoc.connectedAt < 30 * 1000) && bridgeLoc.port && bridgeLoc.port !== 'N/A');
                    const bridgeIsActive = isBridgeOnline || hasRecentConnection;
                    const isKioskConnected = Boolean(
                      liveKiosk?.isLive ||
                      liveKiosk?.online ||
                      (liveKiosk?.onlineCount > 0) ||
                      bridgeLoc?.isKioskOnline ||
                      (loc.id === 'cluj2' && bridgeIsActive)
                    );
                    const targetVerGlobal = BRIDGE_RELEASE_NOTES[0]?.version || bridgeSummary?.latestBridgeVersion || '3.5.0';
                    const hasBridgeUpdate = isBridgeOnline && Boolean(bridgeLoc?.bridgeVersion && bridgeLoc.bridgeVersion !== targetVerGlobal);

                    let statusTone = 'offline';
                    let statusLabel = 'Offline';
                    if (isKioskConnected && bridgeIsActive) {
                      statusTone = 'online';
                      statusLabel = 'Online';
                    } else if (!bridgeIsActive && isKioskConnected) {
                      statusTone = 'warning';
                      statusLabel = 'POS Oprit';
                    } else if (bridgeIsActive && !isKioskConnected) {
                      statusTone = 'warning';
                      statusLabel = 'Ecran Inactiv';
                    }

                    const isOpen = activeLocationDropdown === loc.id;

                    return (
                      <div key={loc.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveLocationDropdown(prev => prev === loc.id ? null : loc.id)}
                          title="Click pentru detalii tehnice"
                          className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-full text-[12px] transition-all text-left cursor-pointer border ${isOpen
                            ? 'bg-black/[0.08] dark:bg-white/[0.14] text-[#1D1D1F] dark:text-white border-black/[0.12] dark:border-white/[0.18]'
                            : 'bg-[#F5F5F7] dark:bg-[#2C2C2E]/80 hover:bg-black/[0.06] dark:hover:bg-white/[0.12] border-black/[0.05] dark:border-white/[0.07] text-[#1D1D1F] dark:text-[#F5F5F7]'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${statusTone === 'online'
                              ? 'bg-[#34C759]'
                              : statusTone === 'warning'
                                ? 'bg-[#FF9500] animate-pulse'
                                : 'bg-[#8E8E93]'
                              }`} />
                            <span className="font-medium truncate">{loc.name}</span>
                          </div>
                          <span className={`text-[11px] font-medium shrink-0 ${statusTone === 'online'
                            ? 'text-[#248A3D] dark:text-[#30D158]'
                            : statusTone === 'warning'
                              ? 'text-[#C96B00] dark:text-[#FF9F0A]'
                              : 'text-[#86868B]'
                            }`}>
                            {statusLabel}
                          </span>
                        </button>

                        {/* Dropdown Popover cu toate detaliile tehnice la click */}
                        {isOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
                              onClick={() => setActiveLocationDropdown(null)}
                            />
                            <div className="fixed inset-x-4 top-20 max-w-sm mx-auto sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:mt-2 sm:w-84 apple-modal !rounded-[20px] p-4 z-50 animate-in fade-in zoom-in-95 duration-150 select-none">
                              {/* Header Popover */}
                              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                                <div>
                                  <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">{loc.id}</div>
                                  <div className="text-[14.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">{loc.name}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusTone === 'online'
                                    ? 'bg-[#34C759]/12 text-[#1F7A33] dark:text-[#30D158]'
                                    : statusTone === 'warning'
                                      ? 'bg-[#FF9500]/12 text-[#C96B00] dark:text-[#FF9F0A]'
                                      : 'bg-black/[0.05] text-[#6E6E73] dark:bg-white/[0.08] dark:text-[#98989D]'
                                    }`}>
                                    {statusLabel}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveLocationDropdown(null)}
                                    className="apple-close-btn !w-7 !h-7"
                                    title="Închide"
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Detalii Tehnice Hardware - Apple Inset Grouped */}
                              <div className="my-3 apple-inset-group px-3 py-1.5 divide-y divide-black/[0.05] dark:divide-white/[0.06] text-[12px]">
                                <div className="flex items-center justify-between py-1.5">
                                  <span className="text-[#6E6E73] dark:text-[#98989D]">POS Bridge</span>
                                  <span className={`font-semibold ${isBridgeOnline ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#C96B00] dark:text-[#FF9F0A]'}`}>
                                    {isBridgeOnline ? 'Rulare activă' : 'Oprit / Deconectat'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between py-1.5">
                                  <span className="text-[#6E6E73] dark:text-[#98989D]">Versiune Soft (PC)</span>
                                  <div className="flex items-center gap-1.5 tabular-nums">
                                    <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                                      v{bridgeLoc?.bridgeVersion || bridgeLoc?.latestBridgeVer || '3.5.4'}
                                    </span>
                                    {isBridgeOnline && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveLocationDropdown(null);
                                          setReleaseNotesTargetLoc(loc.id);
                                          setIsReleaseNotesOpen(true);
                                        }}
                                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-all active:scale-95 ${!hasBridgeUpdate
                                          ? 'bg-[#34C759]/12 text-[#1F7A33] dark:text-[#30D158]'
                                          : 'bg-[#FF9500]/12 text-[#C96B00] dark:text-[#FF9F0A]'
                                          }`}
                                      >
                                        {!hasBridgeUpdate ? 'La zi' : `Nou: v${targetVerGlobal}`}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between py-1.5">
                                  <span className="text-[#6E6E73] dark:text-[#98989D]">Port Serial POS</span>
                                  <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                                    {bridgeLoc?.port && bridgeLoc.port !== 'N/A' ? `${bridgeLoc.port} (${bridgeLoc.gateway || 'raiffeisen'})` : 'Nedetectat'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between py-1.5">
                                  <span className="text-[#6E6E73] dark:text-[#98989D]">Imprimantă Bonuri</span>
                                  <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate max-w-[145px]" title={bridgeLoc?.printerName || 'Nedetectată'}>
                                    {bridgeLoc?.printerName || 'Nedetectată'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between py-1.5">
                                  <span className="text-[#6E6E73] dark:text-[#98989D]">Ecran Kiosk</span>
                                  <span className={`font-semibold ${isKioskConnected ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#86868B]'}`}>
                                    {isKioskConnected ? 'Conectat în browser' : 'Inactiv'}
                                  </span>
                                </div>
                                {(() => {
                                  const isUniversalConfig = Boolean(liveKiosk?.isUniversal);
                                  const kioskScriptVer = liveKiosk?.scriptVersion || (isUniversalConfig ? '2.4.0' : null);
                                  const latestScriptVer = liveKiosk?.latestScriptVersion || '2.4.0';
                                  const isScriptUpToDate = Boolean(kioskScriptVer && kioskScriptVer === latestScriptVer);

                                  return (
                                    <>
                                      <div className="flex items-center justify-between py-1.5">
                                        <span className="text-[#6E6E73] dark:text-[#98989D]">Configurare</span>
                                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${isUniversalConfig
                                          ? 'bg-[#34C759]/12 text-[#1F7A33] dark:text-[#30D158]'
                                          : 'bg-black/[0.06] text-[#6E6E73] dark:bg-white/[0.08] dark:text-[#98989D]'
                                          }`}>
                                          {isUniversalConfig ? 'Universală' : 'Manuală'}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between py-1.5">
                                        <span className="text-[#6E6E73] dark:text-[#98989D]">Script Kiosk</span>
                                        <div className="flex items-center gap-1.5 text-right tabular-nums">
                                          <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                                            {kioskScriptVer ? `v${kioskScriptVer}` : 'Fără script'}
                                          </span>
                                          {isKioskConnected && (
                                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${isScriptUpToDate
                                              ? 'bg-[#34C759]/12 text-[#1F7A33] dark:text-[#30D158]'
                                              : 'bg-[#FF9500]/12 text-[#C96B00] dark:text-[#FF9F0A]'
                                              }`}>
                                              {isScriptUpToDate ? 'La zi' : 'Update'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                                {isBridgeOnline && bridgeLoc?.uptimeSeconds > 0 && (
                                  <div className="flex items-center justify-between py-1.5 tabular-nums">
                                    <span className="text-[#6E6E73] dark:text-[#98989D]">Timp de rulare</span>
                                    <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                                      {Math.floor(bridgeLoc.uptimeSeconds / 60)} min
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Notificare acțiune */}
                              {dropdownActionFeedback && dropdownActionFeedback.locationId === loc.id && (
                                <div className={`mb-2.5 px-3 py-2 rounded-xl text-[11.5px] font-medium ${dropdownActionFeedback.type === 'success'
                                  ? 'bg-[#34C759]/12 text-[#1F7A33] dark:text-[#30D158]'
                                  : 'bg-[#FF3B30]/12 text-[#D70015] dark:text-[#FF453A]'
                                  }`}>
                                  {dropdownActionFeedback.text}
                                </div>
                              )}

                              {/* Butoane Acțiuni Control - Apple Secondary Controls */}
                              <div className="grid grid-cols-4 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDropdownAction(loc.id, 'test-print')}
                                  disabled={dropdownActionLoading === `${loc.id}-test-print`}
                                  title="Scoate un bon de probă pe imprimantă"
                                  className="apple-btn-secondary flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10.5px] disabled:opacity-50"
                                >
                                  <Printer className="w-3.5 h-3.5 text-[#007AFF] dark:text-[#0A84FF]" />
                                  <span className="whitespace-nowrap">Test Bon</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDropdownAction(loc.id, 'restart-bridge')}
                                  disabled={dropdownActionLoading === `${loc.id}-restart-bridge`}
                                  title="Repornește programul Bridge de pe Windows PC"
                                  className="apple-btn-secondary flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10.5px] disabled:opacity-50"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 text-[#007AFF] dark:text-[#0A84FF] ${dropdownActionLoading === `${loc.id}-restart-bridge` ? 'animate-spin' : ''}`} />
                                  <span className="whitespace-nowrap">Bridge</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDropdownAction(loc.id, 'reload-kiosk')}
                                  disabled={dropdownActionLoading === `${loc.id}-reload-kiosk`}
                                  title="Reîncarcă ecranul Kiosk din browser"
                                  className="apple-btn-secondary flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10.5px] disabled:opacity-50"
                                >
                                  <RotateCcw className={`w-3.5 h-3.5 text-[#007AFF] dark:text-[#0A84FF] ${dropdownActionLoading === `${loc.id}-reload-kiosk` ? 'animate-spin' : ''}`} />
                                  <span className="whitespace-nowrap">Ecran</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDropdownAction(loc.id, 'fullscreen-kiosk')}
                                  disabled={dropdownActionLoading === `${loc.id}-fullscreen-kiosk`}
                                  title="Activează modul Fullscreen pe ecranul Kiosk"
                                  className="apple-btn-secondary flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10.5px] disabled:opacity-50"
                                >
                                  <Maximize2 className={`w-3.5 h-3.5 text-[#007AFF] dark:text-[#0A84FF] ${dropdownActionLoading === `${loc.id}-fullscreen-kiosk` ? 'animate-pulse' : ''}`} />
                                  <span className="whitespace-nowrap">Fullscreen</span>
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveLocationDropdown(null);
                                  setDashboardRemoteLoc({ id: loc.id, kioskUrl: loc.id, name: loc.name, bridgeLoc, isOnline: statusTone === 'online' || isKioskConnected });
                                }}
                                className="apple-btn-primary mt-2.5 w-full py-2.5 px-3 text-[12px] flex items-center justify-center gap-2"
                              >
                                <Server className="w-3.5 h-3.5" />
                                <span>Control PC Windows (C:\SmartKiosk)</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Actions: Apple Version Status Pill + Open Live Status */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 shrink-0 self-stretch sm:self-auto py-0.5 sm:py-0">
                  {(() => {
                    const targetVer = BRIDGE_RELEASE_NOTES[0]?.version || bridgeSummary?.latestBridgeVersion || '3.5.0';
                    const locList = bridgeSummary?.locations ? Object.values(bridgeSummary.locations) : [];
                    const onlineList = locList.filter(l => l.status === 'online' || l.isBridgeOnline);
                    if (onlineList.length === 0) return null;
                    const outdated = onlineList.filter(l => (l.bridgeVersion && l.bridgeVersion !== targetVer) || l.isBridgeUpToDate === false);

                    if (outdated.length === 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setReleaseNotesTargetLoc(null);
                            setIsReleaseNotesOpen(true);
                          }}
                          title={`Click pentru a vedea noutățile versiunii oficiale v${targetVer} (Release Notes)`}
                          className="flex items-center justify-center gap-1.5 px-3 h-7 rounded-full text-[11.5px] font-semibold bg-[#34C759]/[0.11] hover:bg-[#34C759]/[0.17] text-[#1F7A33] dark:text-[#30D158] border border-[#34C759]/20 cursor-pointer transition-all active:scale-95 whitespace-nowrap tabular-nums"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                          <span className="hidden sm:inline">Soft la zi (v{targetVer})</span>
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setReleaseNotesTargetLoc(null);
                          setIsReleaseNotesOpen(true);
                        }}
                        title={`Click pentru noutăți și actualizare la v${targetVer} (${outdated.length} kiosk-uri)`}
                        className="apple-btn-primary relative flex items-center justify-center gap-1.5 px-3 h-7 !rounded-full text-[11.5px] whitespace-nowrap tabular-nums"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-white/90 shrink-0" />
                        <span className="hidden sm:inline">Actualizează la v{targetVer} ({outdated.length})</span>
                        <span className="sm:hidden absolute -top-1 -right-1 w-4 h-4 bg-[#FF9500] text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#1C1C1E]">
                          {outdated.length}
                        </span>
                      </button>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => setTab('bridge-monitoring')}
                    title="Monitorizare detaliată LIVE Status"
                    className="apple-glass-btn apple-glass-btn-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Stat Cards Grid - Responsive Grid with comfortable spacing */}
              <div className={`grid ${(2 + Object.keys(BRAND_COLORS).filter(b => (dashboardBrandStats[b] || 0) > 0).length) <= 2 ? 'grid-cols-2' :
                (2 + Object.keys(BRAND_COLORS).filter(b => (dashboardBrandStats[b] || 0) > 0).length) === 3 ? 'grid-cols-2 sm:grid-cols-3' :
                  (2 + Object.keys(BRAND_COLORS).filter(b => (dashboardBrandStats[b] || 0) > 0).length) === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                    (2 + Object.keys(BRAND_COLORS).filter(b => (dashboardBrandStats[b] || 0) > 0).length) === 5 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5' :
                      (2 + Object.keys(BRAND_COLORS).filter(b => (dashboardBrandStats[b] || 0) > 0).length) === 6 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6' :
                        'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7'
                } gap-3`}>
                <div className="w-full">
                  <StatCard
                    label={
                      dashboardPeriod === 'today' ? 'Comenzi Azi' :
                        dashboardPeriod === 'yesterday' ? 'Comenzi Ieri' :
                          dashboardPeriod === 'thisWeek' ? 'Comenzi Săptămână' :
                            dashboardPeriod === 'lastWeek' ? 'Comenzi Săpt. Prec.' :
                              dashboardPeriod === 'thisMonth' ? 'Comenzi Lună' :
                                dashboardPeriod === 'lastMonth' ? 'Comenzi Luna Prec.' :
                                  dashboardPeriod === 'thisYear' ? 'Comenzi An' :
                                    'Comenzi'
                    }
                    value={dashboardFilteredOrders.length}
                    color="#007AFF"
                    icon={ShoppingBag}
                    onClick={() => setDashboardBrands([])}
                  />
                </div>
                <div className="w-full">
                  <StatCard
                    label="Încasări Total"
                    value={`${formatThousands(dashboardRevenue, 0)} lei`}
                    color="#34C759"
                    icon={TrendingUp}
                  />
                </div>
                {Object.keys(BRAND_COLORS)
                  .filter(b => (dashboardBrandStats[b] || 0) > 0)
                  .map(b => (
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

              {/* Controls & Period Filter Bar — STRICTLY ONE SINGLE ROW Concentric Apple Pill Toolbar */}
              <div className={`apple-card p-2 w-full max-w-full min-w-0 ${dashboardPeriod === 'custom' ? '!rounded-[22px]' : '!rounded-full'}`}>
                <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none w-full min-w-0">
                  {/* 1. Brand Segmented Strip */}
                  <div className="apple-segmented shrink-0">
                    {['all', 'smashme', 'crunch', 'rollmaster', 'lovesushi', 'pokiwoki'].map(b => {
                      const isSelected = b === 'all' ? dashboardBrands.length === 0 : dashboardBrands.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          title={b === 'all' ? 'Toate Brandurile' : b === 'smashme' ? 'SmashMe' : b === 'crunch' ? 'Crunch' : b === 'rollmaster' ? 'Roll Master' : b === 'lovesushi' ? 'Love Sushi' : 'Poki-Woki'}
                          className={`apple-segmented-item flex items-center justify-center ${b === 'all' ? '!px-3' : '!px-0 w-[28px]'
                            } ${isSelected ? 'is-active' : 'opacity-75 hover:opacity-100'}`}
                          onClick={() => toggleDashboardBrand(b)}
                        >
                          {b === 'all' ? 'Toate' : (
                            <span className={`rounded-full flex items-center justify-center ${isSelected ? 'bg-white p-[1.5px] shadow-2xs' : ''}`}>
                              <BrandLogo brandId={b} size={17} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="w-px h-5 bg-black/[0.07] dark:bg-white/[0.1] shrink-0 hidden sm:block" />

                  {/* 2. Quick Period Segmented Control (Desktop) */}
                  <div className="hidden sm:inline-flex apple-segmented shrink-0">
                    {[
                      { id: 'today', label: 'Azi' },
                      { id: 'yesterday', label: 'Ieri' },
                      { id: 'thisWeek', label: 'Săpt.' },
                      { id: 'thisMonth', label: 'Lună' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectDashboardPeriod(p.id)}
                        className={`apple-segmented-item ${dashboardPeriod === p.id ? 'is-active' : ''}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* 3. Extended Period Selector (Desktop: Săpt. trec., Luna trec., An, Interval) */}
                  <select
                    className={`hidden sm:block apple-input h-8 px-2.5 text-[12px] font-medium cursor-pointer shrink-0 ${['lastWeek', 'lastMonth', 'thisYear', 'custom'].includes(dashboardPeriod)
                      ? '!text-[#007AFF] dark:!text-[#0A84FF] !bg-[#007AFF]/[0.09] !border-[#007AFF]/25 font-semibold'
                      : ''
                      }`}
                    value={['lastWeek', 'lastMonth', 'thisYear', 'custom'].includes(dashboardPeriod) ? dashboardPeriod : ''}
                    onChange={(e) => { if (e.target.value) handleSelectDashboardPeriod(e.target.value); }}
                    title="Alte perioade"
                  >
                    <option value="" disabled>Mai mult</option>
                    <option value="lastWeek">Săpt. trec.</option>
                    <option value="lastMonth">Luna trec.</option>
                    <option value="thisYear">Anul curent</option>
                    <option value="custom">Interval...</option>
                  </select>

                  {/* Mobile Single Period Selector */}
                  <select
                    className="sm:hidden apple-input h-8 px-2.5 text-[12px] font-medium cursor-pointer shrink-0"
                    value={dashboardPeriod}
                    onChange={(e) => handleSelectDashboardPeriod(e.target.value)}
                  >
                    <option value="today">Azi</option>
                    <option value="yesterday">Ieri</option>
                    <option value="thisWeek">Săptămâna curentă</option>
                    <option value="lastWeek">Săptămâna trecută</option>
                    <option value="thisMonth">Luna curentă</option>
                    <option value="lastMonth">Luna trecută</option>
                    <option value="thisYear">Anul curent</option>
                    <option value="custom">Interval personalizat</option>
                  </select>

                  <div className="w-px h-5 bg-black/[0.07] dark:bg-white/[0.1] shrink-0 hidden md:block" />

                  {/* 4. Location Selector */}
                  <select
                    className="apple-input h-8 px-2.5 text-[12px] font-medium cursor-pointer shrink-0 max-w-[145px]"
                    value={dashboardLocation}
                    onChange={(e) => setDashboardLocation(e.target.value)}
                  >
                    <option value="all">Toate locațiile</option>
                    {uniqueLocations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>

                  {/* 5. Payment Selector */}
                  <select
                    className="apple-input h-8 px-2.5 text-[12px] font-medium cursor-pointer shrink-0 max-w-[130px]"
                    value={dashboardPayment}
                    onChange={(e) => setDashboardPayment(e.target.value)}
                  >
                    <option value="all">Toate plățile</option>
                    <option value="card">Card POS (Toate)</option>
                    <option value="visa">Card Visa</option>
                    <option value="mastercard">Card Mastercard</option>
                    <option value="cash">Numerar (Cash)</option>
                  </select>

                  {/* 6. Spotlight Search (Fills remaining width cleanly on the same single row) */}
                  <div className="relative flex-1 min-w-[125px]">
                    <input
                      type="text"
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                      placeholder="Caută..."
                      className="apple-input h-8 pl-8 pr-7 text-[12px] w-full placeholder-[#86868B]"
                    />
                    <svg className="w-3.5 h-3.5 text-[#86868B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {dashboardSearch && (
                      <button
                        type="button"
                        onClick={() => setDashboardSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black/15 dark:bg-white/20 flex items-center justify-center text-[#1D1D1F] dark:text-white cursor-pointer"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Date Range Drawer (Only appears when 'Interval...' is chosen) */}
                {dashboardPeriod === 'custom' && (
                  <div className="mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2 flex-wrap animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D]">
                      <Calendar className="w-3.5 h-3.5 text-[#007AFF]" />
                      <span>Interval personalizat:</span>
                    </div>
                    <input
                      type="date"
                      value={dashboardCustomStart}
                      onChange={(e) => handleCustomDateChange('start', e.target.value)}
                      className="apple-input px-2.5 h-8 text-[12px] font-medium tabular-nums"
                      title="Data de început"
                    />
                    <span className="text-[#86868B] text-xs">—</span>
                    <input
                      type="date"
                      value={dashboardCustomEnd}
                      onChange={(e) => handleCustomDateChange('end', e.target.value)}
                      className="apple-input px-2.5 h-8 text-[12px] font-medium tabular-nums"
                      title="Data de sfârșit"
                    />
                  </div>
                )}
              </div>

              {/* Active Filter Pills Bar (with crisp visible X buttons!) */}
              {(dashboardBrands.length > 0 || dashboardHour !== null || dashboardDay !== null || dashboardPayment !== 'all' || dashboardLocation !== 'all' || dashboardSearch) && (
                <div className="apple-card flex items-center gap-2 flex-wrap text-xs px-3.5 py-2.5">
                  <span className="text-[#86868B] font-medium">Filtre active:</span>
                  {dashboardBrands.map(b => (
                    <span key={b} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#007AFF]/10 text-[#007AFF] dark:text-[#0A84FF] font-medium">
                      <BrandLogo brandId={b} size={14} />
                      <span>{b}</span>
                      <button type="button" onClick={() => toggleDashboardBrand(b)} className="hover:opacity-70 ml-0.5 cursor-pointer"><X size={12} strokeWidth={2.5} /></button>
                    </span>
                  ))}
                  {dashboardHour !== null && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.06] dark:bg-white/[0.1] text-[#1D1D1F] dark:text-white font-medium">
                      <span>Ora {dashboardHour}:00–{dashboardHour + 1}:00</span>
                      <button type="button" onClick={() => toggleDashboardHour(dashboardHour)} className="hover:opacity-70 ml-0.5 cursor-pointer"><X size={12} strokeWidth={2.5} /></button>
                    </span>
                  )}
                  {dashboardDay !== null && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.06] dark:bg-white/[0.1] text-[#1D1D1F] dark:text-white font-medium">
                      <span>{dashboardDay.label}</span>
                      <button type="button" onClick={() => toggleDashboardDay(dashboardDay)} className="hover:opacity-70 ml-0.5 cursor-pointer"><X size={12} strokeWidth={2.5} /></button>
                    </span>
                  )}
                  {dashboardPayment !== 'all' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158] font-medium">
                      <span>
                        {dashboardPayment === 'card' ? 'Card POS' :
                          dashboardPayment === 'visa' ? 'Visa' :
                            dashboardPayment === 'mastercard' ? 'Mastercard' :
                              dashboardPayment.startsWith('bank_') ? `Card ${BANK_CONFIG[dashboardPayment.replace('bank_', '')]?.name || 'Bancă'}` :
                                'Cash'}
                      </span>
                      <button type="button" onClick={() => toggleDashboardPayment(dashboardPayment)} className="hover:opacity-70 ml-0.5 cursor-pointer"><X size={12} strokeWidth={2.5} /></button>
                    </span>
                  )}
                  {dashboardLocation !== 'all' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.06] dark:bg-white/[0.1] text-[#1D1D1F] dark:text-white font-medium">
                      <span>{dashboardLocation}</span>
                      <button type="button" onClick={() => setDashboardLocation('all')} className="hover:opacity-70 ml-0.5 cursor-pointer"><X size={12} strokeWidth={2.5} /></button>
                    </span>
                  )}
                  {dashboardSearch && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.06] dark:bg-white/[0.1] text-[#1D1D1F] dark:text-white font-medium">
                      <span>„{dashboardSearch}”</span>
                      <button type="button" onClick={() => setDashboardSearch('')} className="hover:opacity-70 ml-0.5 cursor-pointer"><X size={12} strokeWidth={2.5} /></button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={clearAllDashboardFilters}
                    className="text-xs text-[#FF3B30] hover:underline font-medium ml-auto cursor-pointer"
                  >
                    Resetează tot
                  </button>
                </div>
              )}

              {/* 5 Interactive Charts + Orders Table in Unified Adaptive Bento Grid (Laptop → 21:9 → 5K 32:9 Ultrawide) */}
              <DashboardCharts3D
                orders={dashboardPeriodOrders}
                allOrders={orders}
                comparisonOrders={dashboardComparisonOrders}
                isComparisonLoading={isComparisonLoading}
                period={dashboardPeriod}
                customStart={dashboardCustomStart}
                customEnd={dashboardCustomEnd}
                selectedLocation={dashboardLocation}
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
                ordersSection={(
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2.5">
                        Comenzi Perioadă
                        <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#007AFF]/[0.10] text-[#007AFF] dark:text-[#0A84FF] tabular-nums">
                          {dashboardFilteredOrders.length} înregistrări
                        </span>
                      </h3>
                    </div>
                    <OrdersTable
                      orders={dashboardFilteredOrders}
                      onRowClick={setSelectedOrder}
                      onOpenThermalReceipt={setThermalReceiptOrder}
                      selectedId={selectedOrder?._id}
                      defaultRows={10}
                      menuProducts={menuProducts}
                      menuImages={menuImages}
                      backend={BACKEND}
                    />
                  </div>
                )}
              />
            </div>
          )}

          {/* ─── ORDERS ─── */}
          {tab === 'orders' && (
            <div className="space-y-4 px-4 md:px-7 pb-10">
              <div className={`apple-card p-2 ${periodFilter === 'custom' ? '!rounded-[22px]' : '!rounded-full'}`}>
                <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none w-full min-w-0">
                  <div className="apple-segmented shrink-0">
                    {['all', 'smashme', 'crunch', 'rollmaster', 'lovesushi', 'pokiwoki'].map(b => (
                      <button
                        key={b}
                        type="button"
                        title={b === 'all' ? 'Toate' : b}
                        className={`apple-segmented-item flex items-center justify-center ${b === 'all' ? '!px-3' : '!px-0 w-[28px]'} ${brandFilter === b ? 'is-active' : 'opacity-75 hover:opacity-100'}`}
                        onClick={() => setBrandFilter(b)}
                      >
                        {b === 'all' ? 'Toate' : (
                          <span className={`rounded-full flex items-center justify-center ${brandFilter === b ? 'bg-white p-[1.5px] shadow-2xs' : ''}`}>
                            <BrandLogo brandId={b} size={17} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="w-px h-5 bg-black/[0.07] dark:bg-white/[0.1] shrink-0 hidden sm:block" />

                  <select
                    className="apple-input shrink-0 px-2.5 h-8 text-[12px] font-medium cursor-pointer"
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value)}
                  >
                    <option value="all">Toată perioada</option>
                    <option value="today">Azi</option>
                    <option value="yesterday">Ieri</option>
                    <option value="thisWeek">Săptămâna curentă</option>
                    <option value="thisMonth">Luna curentă</option>
                    <option value="lastMonth">Luna trecută</option>
                    <option value="thisYear">Anul curent</option>
                    <option value="custom">Interval...</option>
                  </select>
                  <select
                    className="apple-input shrink-0 px-2.5 h-8 text-[12px] font-medium cursor-pointer max-w-[155px]"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  >
                    <option value="all">Toate locațiile</option>
                    {uniqueLocations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                  <select
                    className="apple-input shrink-0 px-2.5 h-8 text-[12px] font-medium cursor-pointer max-w-[130px]"
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                  >
                    <option value="all">Toate plățile</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                  </select>

                  <div className="relative flex-1 min-w-[150px]">
                    <input
                      type="text"
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      placeholder="Caută comandă, iiko, locație..."
                      className="apple-input h-8 pl-8 pr-3 text-[12px] w-full placeholder-[#86868B]"
                    />
                    <svg className="w-3.5 h-3.5 text-[#86868B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                </div>
                {periodFilter === 'custom' && (
                  <div className="mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2 flex-wrap">
                    <Calendar className="w-3.5 h-3.5 text-[#007AFF]" />
                    <input
                      type="date"
                      className="apple-input px-2.5 h-8 text-[12px] tabular-nums"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                    <span className="text-[#86868B] text-xs">—</span>
                    <input
                      type="date"
                      className="apple-input px-2.5 h-8 text-[12px] tabular-nums"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <OrdersTable
                orders={filteredOrders}
                full
                onRowClick={setSelectedOrder}
                onOpenThermalReceipt={setThermalReceiptOrder}
                selectedId={selectedOrder?._id}
                menuProducts={menuProducts}
                menuImages={menuImages}
                backend={BACKEND}
              />
            </div>
          )}

          {/* ─── MAIN CONTENT WRAPPER ─── */}
          <div className="flex-1 overflow-y-auto px-4 md:px-7 pb-10">
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
              <div className="admin-section">
                <KiosksManager
                  backend={BACKEND}
                  kiosksLiveStatus={kiosksLiveStatus}
                  bridgeSummary={bridgeSummary}
                  socket={socketRef.current}
                  onNavigateToProducts={(locId, kioskId, filterDiet = 'promo', brandId = 'smashme') => {
                    if (locId) localStorage.setItem('admin_active_location', locId);
                    if (kioskId) localStorage.setItem('admin_active_kiosk', kioskId);
                    if (filterDiet) localStorage.setItem('admin_product_filter_diet', filterDiet);
                    if (brandId) localStorage.setItem('admin_active_brand', brandId);
                    setTab('products');
                  }}
                />
              </div>
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
            {tab === 'pending-orders' && (
              <PendingOrders
                backend={BACKEND}
                onGoToOrder={async (orderId) => {
                  const foundOrder = orders.find(o => o._id === orderId);
                  if (foundOrder) {
                    setSelectedOrder(foundOrder);
                  } else {
                    try {
                      const res = await fetchWithAuth(`${BACKEND}/api/orders/${orderId}`);
                      if (res.ok) {
                        const data = await res.json();
                        setOrders(prev => [data, ...prev.filter(o => o._id !== data._id)]);
                        setSelectedOrder(data);
                      }
                    } catch (e) {
                      console.error('Failed to fetch order', e);
                    }
                  }
                }}
              />
            )}
            {tab === 'iiko-logs' && <IikoLogs />}
            {tab === 'printer-logs' && <PrinterLogs />}
            {tab === 'port-scans' && <PortScans />}
            {tab === 'bridge-monitoring' && <BridgeMonitoring backend={BACKEND} socket={socketRef.current} kiosksLiveStatus={kiosksLiveStatus} />}
            {tab === 'kiosk-logs' && <KioskLogs />}
            {tab === 'promotions' && <Promotions />}
            {tab === 'users' && <UsersManager />}
            {tab === 'brands' && <BrandsManager backend={BACKEND} />}
          </div>
          </div>
        </main>
      </div>

      {/* ── Order Detail Modal (Apple Sheet Style) ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-150" onClick={() => setSelectedOrder(null)}>
          <div className="apple-modal w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <BrandLogo brandId={selectedOrder.brand} size={32} className="rounded-xl shadow-2xs shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">#{selectedOrder.orderNumber}</h2>
                    <span className="text-xs font-semibold" style={{ color: getBrandColor(selectedOrder.brand) }}>
                      {getBrandLabel(selectedOrder.brand)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('ro-RO') : '—'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(() => {
                  const sc = getOrderStatus(selectedOrder);
                  return (
                    <span
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{
                        backgroundColor: `${sc.color}15`,
                        color: sc.color,
                        border: `1px solid ${sc.color}35`
                      }}
                    >
                      ● {sc.label}
                    </span>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="apple-close-btn ml-2"
                  title="Închide"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* ─── Apple Inset Grouped Metadata Card ─── */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40 divide-y divide-slate-200/60 dark:divide-slate-700/60 text-xs overflow-hidden">
                {/* Servire & Canal */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Tip Servire & Canal</span>
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                    <span>{selectedOrder.orderType === 'dine-in' ? (selectedOrder.tableNumber ? `La masă (Masa ${selectedOrder.tableNumber})` : 'La masă') : 'La pachet'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {selectedOrder.channel || 'kiosk'}
                    </span>
                  </div>
                </div>

                {/* Plată */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Metodă Plată</span>
                  <div className="flex items-center gap-1.5">
                    {selectedOrder.paymentMethod === 'card' ? (
                      <>
                        {(() => {
                          const bank = detectCardBank(selectedOrder);
                          return bank ? (
                            <span
                              className="px-2.5 py-1 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1.5 shadow-2xs"
                              style={{
                                backgroundColor: `${bank.color}15`,
                                color: bank.color,
                                borderColor: `${bank.color}35`
                              }}
                            >
                              <BankLogo bankId={bank.id} bank={bank} size={15} />
                              {bank.name}
                            </span>
                          ) : null;
                        })()}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          Card POS
                        </span>
                      </>
                    ) : selectedOrder.paymentMethod === 'cash' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Cash (La Casă)
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">—</span>
                    )}
                  </div>
                </div>

                {/* ID iiko & Bon POS */}
                {selectedOrder.syrveOrderId && (
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">ID Comandă iiko</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={selectedOrder.syrveOrderId}>
                        {selectedOrder.syrveOrderId}
                      </span>
                      <button
                        onClick={(e) => {
                          navigator.clipboard.writeText(selectedOrder.syrveOrderId);
                          const btn = e.currentTarget;
                          const originalHTML = btn.innerHTML;
                          btn.innerHTML = '<span class="text-emerald-600 text-[10px] font-bold">Copiat!</span>';
                          setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
                        }}
                        className="apple-pressable p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title="Copiază ID iiko"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Date Fiscale CUI */}
                {selectedOrder.fiscal && (
                  <div className="px-4 py-3 flex items-start justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400 font-medium pt-0.5">Bon Fiscal (CUI)</span>
                    <div className="text-right">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                        {selectedOrder.fiscal.name || '—'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        CUI: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedOrder.fiscal.rawCui || selectedOrder.fiscal.cui}</span>
                        {selectedOrder.fiscal.isVatPayer && <span className="ml-1.5 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">TVA</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Apple Receipt Items List ─── */}
              {(() => {
                const allItems = selectedOrder.items || [];
                const totalItems = allItems.length;
                const totalPages = Math.ceil(totalItems / modalProductsPerPage) || 1;
                const safePage = Math.min(modalProductsPage, totalPages);
                const paginatedItems = allItems.slice((safePage - 1) * modalProductsPerPage, safePage * modalProductsPerPage);

                return (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Produse comandate ({totalItems})
                      </span>
                      {totalItems > 5 && (
                        <div className="flex items-center gap-2">
                          <select
                            value={modalProductsPerPage}
                            onChange={e => { setModalProductsPerPage(Number(e.target.value)); setModalProductsPage(1); }}
                            className="apple-input px-2 py-0.5 text-[11px] font-medium cursor-pointer"
                          >
                            <option value={5}>5 / pag</option>
                            <option value={10}>10 / pag</option>
                            <option value={20}>20 / pag</option>
                            <option value={999}>Toate</option>
                          </select>
                          <div className="flex gap-1">
                            <button onClick={() => setModalProductsPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs disabled:opacity-40 text-slate-600 dark:text-slate-300 cursor-pointer">‹</button>
                            <button onClick={() => setModalProductsPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs disabled:opacity-40 text-slate-600 dark:text-slate-300 cursor-pointer">›</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 divide-y divide-slate-100 dark:divide-slate-800/70 overflow-hidden shadow-2xs max-h-[45vh] overflow-y-auto">
                      {paginatedItems.map((item, idx) => {
                        const fullProd = menuProducts[item.productId] || (item.name && menuProducts[item.name.toLowerCase()]);
                        const overrideImg = menuImages[item.productId];
                        let imgSrc = overrideImg || item.imageUrl || (fullProd?.imageLinks && fullProd.imageLinks[0]) || fullProd?.image || null;
                        if (imgSrc && imgSrc.startsWith('/uploads')) imgSrc = `${BACKEND}${imgSrc}`;

                        const unitP = (item.unitPrice !== undefined ? item.unitPrice : item.price) || 0;
                        const lineTotal = (item.totalPrice !== undefined ? item.totalPrice : unitP * (item.quantity || 1)) || 0;

                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-3.5 p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                            onClick={() => { if (fullProd) setSelectedItemDetail({ ...fullProd, originalItem: item }); }}
                          >
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center border border-black/5 dark:border-white/5 shadow-2xs">
                              {imgSrc ? (
                                <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <Utensils className="w-5 h-5 text-slate-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                              {item.selectedModifiers?.length > 0 ? (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {item.selectedModifiers.map(m => m.optionName || m.modifierName).filter(Boolean).join(' · ')}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                  {item.quantity || 1} buc × {formatThousands(unitP)} lei
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <p className="font-bold text-xs text-slate-900 dark:text-white">
                                {formatThousands(lineTotal)} lei
                              </p>
                              <span className="text-[10px] font-semibold text-slate-400">
                                {item.quantity}x
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Voucher Discount Info (when order used a promo code) */}
              {(selectedOrder.voucherCode || selectedOrder.voucherDiscount > 0) && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-[#34C759]/[0.10] border border-[#34C759]/20 text-xs">
                  <span className="font-semibold text-[#1F7A33] dark:text-[#30D158]">
                    Cupon aplicat: {selectedOrder.voucherCode || 'PROMO'}
                  </span>
                  <span className="font-bold text-[#1F7A33] dark:text-[#30D158]">
                    -{formatThousands(selectedOrder.voucherDiscount || 0)} lei
                  </span>
                </div>
              )}

              {/* Total Row */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Total Comandă
                  </span>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">TVA inclus</div>
                </div>
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {formatThousands(selectedOrder.totalAmount || 0)} lei
                </span>
              </div>

              {/* ─── Apple Capsule Action Buttons (Bottom Bar) ─── */}
              <div className="flex items-center justify-between gap-3 pt-2">
                {selectedOrder.status !== 'cancelled' ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleCancelOrder(selectedOrder._id);
                      setSelectedOrder({ ...selectedOrder, status: 'cancelled', canceledBy: 'admin' });
                    }}
                    className="apple-pressable px-5 py-2.5 rounded-full bg-[#FF3B30]/[0.10] hover:bg-[#FF3B30]/[0.18] text-[#FF3B30] dark:text-[#FF453A] border border-[#FF3B30]/20 text-[12.5px] font-semibold cursor-pointer transition-all"
                  >
                    Anulează Comanda (Refuz)
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-[#FF3B30]">Comandă Anulată</span>
                )}

                <button
                  type="button"
                  onClick={() => setThermalReceiptOrder(selectedOrder)}
                  className="apple-pressable ml-auto px-5 py-2.5 rounded-full bg-[#1D1D1F] hover:bg-[#000000] dark:bg-white dark:hover:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[12.5px] font-semibold flex items-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.18)] cursor-pointer transition-all"
                  title="Afișează bonul termic format casă de marcat"
                >
                  <Printer size={14} />
                  <span>Vezi Bon Termic</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Thermal Receipt Modal (80mm Paper Slip) ── */}
      {thermalReceiptOrder && (
        <ThermalReceiptModal
          order={thermalReceiptOrder}
          onClose={() => setThermalReceiptOrder(null)}
        />
      )}

      {/* ── Apple macOS Software Release Notes Modal ── */}
      <SoftwareReleaseNotesModal
        isOpen={isReleaseNotesOpen}
        onClose={() => {
          setIsReleaseNotesOpen(false);
          setReleaseNotesTargetLoc(null);
        }}
        initialVersion={BRIDGE_RELEASE_NOTES[0]?.version || '3.5.0'}
        targetLocation={releaseNotesTargetLoc}
        canUpdate={(() => {
          const targetVer = BRIDGE_RELEASE_NOTES[0]?.version || '3.5.0';
          const locList = bridgeSummary?.locations ? Object.values(bridgeSummary.locations) : [];
          return locList.some(l => (l.status === 'online' || l.isBridgeOnline) && ((l.bridgeVersion && l.bridgeVersion !== targetVer) || l.isBridgeUpToDate === false));
        })()}
        outdatedCount={(() => {
          const targetVer = BRIDGE_RELEASE_NOTES[0]?.version || '3.5.0';
          const locList = bridgeSummary?.locations ? Object.values(bridgeSummary.locations) : [];
          return locList.filter(l => (l.status === 'online' || l.isBridgeOnline) && ((l.bridgeVersion && l.bridgeVersion !== targetVer) || l.isBridgeUpToDate === false)).length;
        })()}
        onUpdate={async (version, selectedIds) => {
          try {
            const isAll = !selectedIds || selectedIds.length === 0 || selectedIds.length === 4;
            const backend = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://smart-kiosk-ttut.onrender.com');
            await fetch(`${backend}/api/bridge-monitoring/update-all-bridges`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'sk-live-2024-secure',
              },
              body: JSON.stringify({ locations: isAll ? undefined : selectedIds }),
            });
          } catch (err) {
            console.error('Eroare actualizare bridge din Dashboard:', err);
          }
        }}
        onCompleteUpdate={() => {
          fetchBridgeSummary();
        }}
      />

      {/* ── Product Detail Modal (Apple HIG Kiosk-Style Sheet) ── */}
      {selectedItemDetail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedItemDetail(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.35)] border border-slate-200/80 dark:border-white/10 w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 select-none"
            onClick={e => e.stopPropagation()}
          >
            {/* Header cu Titlu și Buton Închidere Apple */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0">
              <div className="min-w-0 pr-4">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  {selectedItemDetail.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="apple-close-btn shrink-0"
                title="Închide"
              >
                <X size={16} />
              </button>
            </div>

            {/* Corp Modal: Poza Mare Sus + Text Cuminte Dedesubt */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              {/* ─── Hero Image (Poza Mare Apetisantă) ─── */}
              <div className="w-full h-[400px] sm:h-[500px] bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-100 dark:from-slate-900 dark:via-slate-800/60 dark:to-slate-800 flex items-center justify-center p-3 relative overflow-hidden border-b border-slate-100 dark:border-slate-800/80 shrink-0">
                {(() => {
                  let finalImg = menuImages[selectedItemDetail.id] || selectedItemDetail.image || (selectedItemDetail.imageLinks && selectedItemDetail.imageLinks[0]);
                  if (finalImg && finalImg.startsWith('/uploads')) finalImg = `${BACKEND}${finalImg}`;
                  if (finalImg) {
                    return (
                      <img
                        src={finalImg}
                        alt={selectedItemDetail.name}
                        className="w-full h-full object-contain rounded-2xl drop-shadow-xl transition-transform duration-300 hover:scale-[1.03]"
                      />
                    );
                  }
                  return (
                    <div className="w-28 h-28 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 flex items-center justify-center shadow-sm">
                      <Utensils className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                    </div>
                  );
                })()}
              </div>

              {/* ─── Text Cuminte Dedesubt (Descriere, Ingrediente, Valori Nutriționale) ─── */}
              <div className="p-6 sm:p-7 space-y-4 flex-1">
                {(() => {
                  const trans = selectedItemDetail.translations || {};
                  const rawDesc = trans.ro || trans.en || selectedItemDetail.description || '';

                  if (!rawDesc) {
                    return (
                      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5 text-center text-slate-400 text-sm">
                        Nicio descriere detaliată disponibilă în Syrve pentru acest produs.
                      </div>
                    );
                  }

                  // Parsare conform logicii din Kiosk (descriere scurtă, ingrediente, valori nutriționale)
                  const lower = rawDesc.toLowerCase();
                  const ingMarkers = ['ingrediente:', 'ingredient:'];
                  const nutMarkers = ['declarație nutrițională', 'declaratie nutritionala', 'declarația nutrițională', 'declaratia nutritionala', 'valori nutritionale', 'valori nutritive'];

                  let ingIdx = -1;
                  let ingLen = 0;
                  for (const m of ingMarkers) {
                    const idx = lower.indexOf(m);
                    if (idx !== -1 && (ingIdx === -1 || idx < ingIdx)) {
                      ingIdx = idx;
                      ingLen = m.length;
                    }
                  }

                  let nutIdx = -1;
                  for (const m of nutMarkers) {
                    const idx = lower.indexOf(m);
                    if (idx !== -1 && (nutIdx === -1 || idx < nutIdx)) {
                      nutIdx = idx;
                    }
                  }

                  let shortDesc = rawDesc;
                  let ingredientsText = '';
                  let nutritionText = '';

                  if (ingIdx !== -1 && nutIdx !== -1 && nutIdx > ingIdx) {
                    shortDesc = rawDesc.slice(0, ingIdx).trim();
                    ingredientsText = rawDesc.slice(ingIdx + ingLen, nutIdx).trim();
                    nutritionText = rawDesc.slice(nutIdx).trim();
                  } else if (ingIdx !== -1) {
                    shortDesc = rawDesc.slice(0, ingIdx).trim();
                    ingredientsText = rawDesc.slice(ingIdx + ingLen).trim();
                  } else if (nutIdx !== -1) {
                    shortDesc = rawDesc.slice(0, nutIdx).trim();
                    nutritionText = rawDesc.slice(nutIdx).trim();
                  }

                  return (
                    <>
                      {/* Descriere Comercială / Prezentare Produs */}
                      {shortDesc && (
                        <div className="text-sm sm:text-base text-slate-700 dark:text-slate-200 font-normal leading-relaxed whitespace-pre-wrap">
                          {shortDesc}
                        </div>
                      )}

                      {/* Card Ingrediente Complete (Apple Inset Card) */}
                      {ingredientsText && (
                        <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Ingrediente Complete
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {ingredientsText}
                          </p>
                        </div>
                      )}

                      {/* Card Valori Nutriționale & Metric Chips (Apple Inset Card) */}
                      {(nutritionText || selectedItemDetail.weight != null || selectedItemDetail.energyAmount != null) && (
                        <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 space-y-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Informații Nutriționale
                          </div>

                          {/* Grilă de metrici nutriționale */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {selectedItemDetail.weight != null && (
                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-center shadow-2xs">
                                <span className="text-[10px] text-slate-400 block font-medium">Greutate</span>
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                  {selectedItemDetail.weight} kg
                                </span>
                              </div>
                            )}
                            {selectedItemDetail.energyAmount != null && (
                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-center shadow-2xs">
                                <span className="text-[10px] text-slate-400 block font-medium">Energie</span>
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                  {selectedItemDetail.energyAmount} kcal
                                </span>
                              </div>
                            )}
                            {selectedItemDetail.proteinsAmount != null && (
                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-center shadow-2xs">
                                <span className="text-[10px] text-slate-400 block font-medium">Proteine</span>
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                  {selectedItemDetail.proteinsAmount}g
                                </span>
                              </div>
                            )}
                            {selectedItemDetail.fatAmount != null && (
                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-center shadow-2xs">
                                <span className="text-[10px] text-slate-400 block font-medium">Grăsimi</span>
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                  {selectedItemDetail.fatAmount}g
                                </span>
                              </div>
                            )}
                            {selectedItemDetail.carbohydratesAmount != null && (
                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-center shadow-2xs">
                                <span className="text-[10px] text-slate-400 block font-medium">Carbohidrați</span>
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                  {selectedItemDetail.carbohydratesAmount}g
                                </span>
                              </div>
                            )}
                          </div>

                          {nutritionText && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1 whitespace-pre-wrap">
                              {nutritionText}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      <WindowsRemoteModal
        isOpen={Boolean(dashboardRemoteLoc)}
        onClose={() => setDashboardRemoteLoc(null)}
        loc={dashboardRemoteLoc}
        bridgeLoc={dashboardRemoteLoc?.bridgeLoc}
        isOnline={dashboardRemoteLoc?.isOnline}
        isLocked={false}
        isMaintenance={false}
        backend={BACKEND}
        socket={socketRef.current}
      />

    </div>
  );
}

function StatCard({ label, value, color, large, brandId, icon: Icon, onClick, active }) {
  const isCurrency = typeof value === 'string' && value.includes('lei');
  const displayVal = isCurrency ? value.replace('lei', '').trim() : value;
  const valLength = String(displayVal).length;
  const resolvedColor = color === 'var(--primary)' ? '#007AFF' : (color || '#007AFF');

  let fontSizeClass = 'text-[26px]';
  if (isCurrency) {
    if (valLength > 8) fontSizeClass = 'text-[19px]';
    else if (valLength > 5) fontSizeClass = 'text-[22px]';
    else fontSizeClass = 'text-[26px]';
  } else {
    fontSizeClass = valLength > 4 ? 'text-[22px]' : 'text-[26px]';
  }

  return (
    <div
      onClick={onClick}
      className={`apple-card px-4 py-3.5 flex items-center justify-between gap-3 min-w-0 flex-1 relative overflow-hidden select-none apple-pressable ${active
        ? 'ring-2 ring-[#007AFF] border-[#007AFF]'
        : ''
        } ${onClick ? 'cursor-pointer hover:border-black/[0.12] dark:hover:border-white/[0.16]' : ''}`}
    >
      {/* Left: Apple Metric Stack */}
      <div className="flex flex-col justify-between gap-1.5 min-w-0">
        <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] truncate" title={label}>
          {label}
        </span>
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className={`font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-[-0.03em] leading-none tabular-nums ${fontSizeClass}`}>
            {displayVal}
          </span>
          {isCurrency && (
            <span className="text-[12.5px] font-medium text-[#86868B]">
              lei
            </span>
          )}
        </div>
      </div>

      {/* Right: Authentic Apple macOS Sequoia / iOS 18 App Squircle */}
      {brandId ? (
        <div className="w-10 h-10 rounded-[11px] bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.09] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <BrandLogo brandId={brandId} size={22} />
        </div>
      ) : Icon ? (
        <div
          className="w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 text-white"
          style={{
            backgroundColor: resolvedColor,
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)',
            boxShadow: `0 2px 8px -1px ${resolvedColor}45, inset 0 0.5px 0 rgba(255,255,255,0.35)`
          }}
        >
          <Icon size={19} strokeWidth={2} />
        </div>
      ) : null}
    </div>
  );
}

function OrdersTable({ orders, full, onRowClick, onOpenThermalReceipt, selectedId, defaultRows = 10, menuProducts = {}, menuImages = {}, backend = '' }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultRows);

  const resolveProductImage = (item) => {
    if (!item) return null;
    const fullProd = menuProducts[item.productId] || (item.name && menuProducts[item.name.toLowerCase().trim()]);
    const overrideImg = menuImages[item.productId];
    let imgSrc = overrideImg || item.imageUrl || item.image || (fullProd?.imageLinks && fullProd.imageLinks[0]) || fullProd?.image || null;
    if (imgSrc && imgSrc.startsWith('/uploads')) imgSrc = `${backend || BACKEND}${imgSrc}`;
    return imgSrc;
  };

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
    <div className="apple-card overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-700/60">
            <th className="w-14 px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">Nr.</th>
            <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"># Comandă</th>
            <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Brand</th>
            <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Produse / Coș</th>
            <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total</th>
            <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm font-medium">
                Nicio comandă găsită în perioada selectată.
              </td>
            </tr>
          ) : (
            paginated.map((o, index) => {
              const sc = getOrderStatus(o);
              const rowNumber = (safePage - 1) * itemsPerPage + index + 1;
              const iikoId = o.syrveOrderId || o.iiko_order_id || o.iikoOrderId;

              return (
                <tr key={o._id} className={`transition-colors group cursor-pointer ${selectedId === o._id ? 'bg-emerald-500/10 text-emerald-950 dark:text-emerald-100' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`} onClick={() => onRowClick && onRowClick(o)}>
                  <td className="w-14 px-4 py-3.5 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                    {rowNumber}
                  </td>
                  <td
                    className="px-5 py-3.5 whitespace-nowrap cursor-pointer hover:opacity-85 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenThermalReceipt) onOpenThermalReceipt(o);
                      else if (onRowClick) onRowClick(o);
                    }}
                    title="Apasă pentru a deschide bonul de casă"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                        #{o.orderNumber}
                        {o.fiscal && <span title={`CUI: ${o.fiscal.rawCui || o.fiscal.cui}`} className="inline-flex items-center text-indigo-600 dark:text-indigo-400"><Building2 size={13} /></span>}
                      </span>
                      {o.createdAt && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(o.createdAt).toLocaleString('ro-RO')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <BrandLogo brandId={o.brand} size={24} className="shadow-2xs shrink-0" />
                      <span style={{ color: getBrandColor(o.brand) }} className="text-xs font-bold">
                        {getBrandLabel(o.brand)}
                      </span>
                    </div>
                  </td>
                  {/* Produse / Coș cu preview imagini mici */}
                  <td className="px-5 py-3.5 max-w-[200px] lg:max-w-xs">
                    {(() => {
                      const items = o.items || [];
                      if (!items.length) {
                        return <span className="text-xs text-slate-400 italic">Fără detalii</span>;
                      }
                      return (
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Mini imagini produse */}
                          <div className="flex -space-x-1.5 shrink-0">
                            {items.slice(0, 3).map((it, pIdx) => {
                              const img = resolveProductImage(it);
                              return (
                                <div key={pIdx} className="w-6 h-6 rounded-full border border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                                  {img ? (
                                    <img src={img} alt={it.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <Utensils className="w-3 h-3 text-slate-400" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={items.map(i => `${i.quantity || 1}x ${i.name}`).join(', ')}>
                              {items.map(i => `${i.quantity || 1}x ${i.name}`).join(', ')}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{items.length} {items.length === 1 ? 'produs' : 'produse'}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-600 dark:text-slate-300">
                                {o.orderType === 'dine-in' ? (o.tableNumber ? `Masa ${o.tableNumber}` : 'La masă') : 'La pachet'}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td
                    className="px-5 py-3.5 whitespace-nowrap cursor-pointer hover:opacity-85 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenThermalReceipt) onOpenThermalReceipt(o);
                      else if (onRowClick) onRowClick(o);
                    }}
                    title="Apasă pentru a deschide bonul de casă"
                  >
                    <div className="flex flex-col gap-1 items-start">
                      <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        {formatThousands(o.totalAmount || 0)} lei
                      </span>
                      {o.paymentMethod === 'card' ? (() => {
                        const bank = detectCardBank(o);
                        const brand = detectCardBrand(o);
                        return (
                          <div className="flex items-center gap-1.5 mt-0.5" title={`Plată cu Card • ${bank.name}`}>
                            <BankLogo bankId={bank.id} bank={bank} size={15} className="shrink-0" />
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {bank.shortName || bank.name}
                            </span>
                            {brand && brand !== 'generic' && (
                              <span className="text-[10px] font-semibold text-slate-400">
                                {brand === 'mastercard' ? 'Mastercard' : (brand === 'visa' ? 'Visa' : brand)}
                              </span>
                            )}
                          </div>
                        );
                      })() : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          {o.paymentMethod === 'cash' ? 'Cash' : (o.paymentMethod || '—')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="px-5 py-3.5 whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenThermalReceipt) onOpenThermalReceipt(o);
                      else if (onRowClick) onRowClick(o);
                    }}
                  >
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-block cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                      style={{ backgroundColor: `${sc.color}20`, color: sc.color, border: `1px solid ${sc.color}40` }}
                      title="Apasă pentru a deschide bonul de casă"
                    >
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
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-black/[0.015] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] gap-4">
        <div className="flex items-center gap-3 text-[12px] text-[#6E6E73] dark:text-[#98989D]">
          <span className="flex items-center gap-2">
            Afișează
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="apple-input py-1 px-2.5 text-[12px] font-semibold cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={999999}>Toți</option>
            </select>
          </span>
          <span className="tabular-nums">Total: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{safeOrders.length}</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] tabular-nums">Pagina {currentPage} din {totalPages}</span>
          <div className="flex gap-1">
            {[
              { label: '«', action: () => setCurrentPage(1), disabled: currentPage === 1 },
              { label: '‹', action: () => setCurrentPage(p => p - 1), disabled: currentPage === 1 },
              { label: '›', action: () => setCurrentPage(p => p + 1), disabled: currentPage === totalPages },
              { label: '»', action: () => setCurrentPage(totalPages), disabled: currentPage === totalPages },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                disabled={btn.disabled}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-35 disabled:cursor-not-allowed text-[13px] font-semibold transition-colors cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {full && (
        <div className="flex flex-col md:flex-row items-center justify-between px-5 py-4 bg-black/[0.015] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] m-0">Total Comenzi Active</p>
            <p className="text-[22px] font-bold tracking-tight text-[#248A3D] dark:text-[#30D158] m-0 mt-0.5 tabular-nums">
              {formatThousands(orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.totalAmount || 0), 0))} lei
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] m-0">Total Comenzi Anulate</p>
            <p className="text-[22px] font-bold tracking-tight text-[#FF3B30] m-0 mt-0.5 tabular-nums">
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
  const [url, setUrl] = useState('');
  const [type, setType] = useState('image');
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
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
            {type === 'image' && <img src={url} alt="Preview" className="w-full h-full object-contain" onError={e => e.target.src = ''} />}
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

function KiosksManager({ backend, kiosksLiveStatus = {}, bridgeSummary = null, socket = null, onNavigateToProducts }) {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [remoteModalLoc, setRemoteModalLoc] = useState(null);
  const [locations, setLocations] = useState(() => {
    try {
      const cached = localStorage.getItem('admin_cached_locations');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [brandsData, setBrandsData] = useState(() => {
    try {
      const cached = localStorage.getItem('admin_cached_brands');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [allMenus, setAllMenus] = useState({});
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('admin_cached_locations');
    } catch {
      return true;
    }
  });
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('online'); // 'all' | 'online' (default online)
  const [revealedPins, setRevealedPins] = useState(new Set()); // IDs of kiosks with revealed PINs
  const [editingLoc, setEditingLoc] = useState(null);
  const [editingTab, setEditingTab] = useState('design');
  const [restartingId, setRestartingId] = useState(null); // ID of loc currently restarting
  const [lockingId, setLockingId] = useState(null); // ID of loc currently being locked
  const [maintainingId, setMaintainingId] = useState(null); // ID of loc toggling maintenance
  const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }

  useEffect(() => {
    const onLocUpdated = (e) => {
      const updated = e.detail;
      if (!updated?.id) return;
      setLocations(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
    };
    window.addEventListener('admin_location_updated', onLocUpdated);

    let localCh = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        localCh = new BroadcastChannel('smart_kiosk_local_sync');
        localCh.onmessage = (ev) => {
          const msg = ev.data;
          if (msg?.type === 'LOCATION_UPDATED' && msg.location?.id) {
            setLocations(prev => prev.map(l => l.id === msg.location.id ? { ...l, ...msg.location } : l));
          }
        };
      }
    } catch (_) { }

    return () => {
      window.removeEventListener('admin_location_updated', onLocUpdated);
      if (localCh) {
        try { localCh.close(); } catch (_) { }
      }
    };
  }, []);

  const broadcastLocalSync = (loc, payload, updatedLoc) => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('smart_kiosk_local_sync');
        ch.postMessage({ type: 'LOCK_CONTROL', locationId: loc.id, kioskUrl: loc.kioskUrl, payload });
        if (updatedLoc) {
          ch.postMessage({ type: 'LOCATION_UPDATED', locationId: loc.id, kioskUrl: loc.kioskUrl, location: updatedLoc });
        }
        ch.close();
      }
    } catch (_) { }
  };

  const lockKioskNow = async (loc, e, currentlyLocked = false) => {
    if (e) e.stopPropagation();
    if (!loc || lockingId === loc.id) return;
    setLockingId(loc.id);
    const shouldLock = !currentlyLocked;
    const nowIso = new Date().toISOString();
    const updatedObj = {
      ...loc,
      forceLocked: shouldLock,
      forceLockedAt: shouldLock ? nowIso : null,
      ...(!shouldLock ? { remoteUnlockedAt: nowIso } : {})
    };
    broadcastLocalSync(loc, { locked: shouldLock, forceLocked: shouldLock, forceLockedAt: shouldLock ? nowIso : null, remoteUnlockedAt: !shouldLock ? nowIso : null }, updatedObj);
    try {
      const [putRes] = await Promise.all([
        fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedObj)
        }),
        fetchWithAuth(`${backend}/api/locations/${loc.id}/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locked: shouldLock, unlockedBy: shouldLock ? null : 'admin' })
        }).catch(() => null)
      ]);
      if (putRes && putRes.ok) {
        setLocations(prev => prev.map(l => l.id === loc.id ? updatedObj : l));
        if (editingLoc && editingLoc.id === loc.id) {
          setEditingLoc(prev => prev ? { ...prev, forceLocked: shouldLock, forceLockedAt: shouldLock ? nowIso : null } : prev);
        }
        showToast(
          shouldLock
            ? `Kiosk-ul „${loc.name}” a fost blocat cu ecranul PIN!`
            : `Kiosk-ul „${loc.name}” a fost deblocat de la distanță!`
        );
      } else {
        const data = await putRes?.json().catch(() => ({}));
        showToast(data?.error || 'Eroare la schimbarea stării de blocare.', 'error');
      }
    } catch {
      showToast('Eroare de rețea la trimiterea comenzii.', 'error');
    } finally {
      setLockingId(null);
    }
  };

  const toggleMaintenanceMode = async (loc, e) => {
    if (e) e.stopPropagation();
    if (!loc || maintainingId === loc.id) return;
    setMaintainingId(loc.id);
    const nextMaint = !loc.maintenanceMode;
    const updatedObj = { ...loc, maintenanceMode: nextMaint };
    broadcastLocalSync(loc, { maintenanceMode: nextMaint }, updatedObj);
    try {
      const putRes = await fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedObj)
      });
      if (putRes && putRes.ok) {
        setLocations(prev => prev.map(l => l.id === loc.id ? updatedObj : l));
        if (editingLoc && editingLoc.id === loc.id) {
          setEditingLoc(prev => prev ? { ...prev, maintenanceMode: nextMaint } : prev);
        }
        showToast(
          nextMaint
            ? `Mod Mentenanță ACTIVAT pentru „${loc.name}” (ecran animat cu logo-ul brandului)!`
            : `Mod Mentenanță OPRIT pentru „${loc.name}”. Kiosk-ul a revenit la normal!`
        );
      } else {
        const data = await putRes?.json().catch(() => ({}));
        showToast(data?.error || 'Eroare la schimbarea modului mentenanță.', 'error');
      }
    } catch {
      showToast('Eroare de rețea la schimbarea modului mentenanță.', 'error');
    } finally {
      setMaintainingId(null);
    }
  };

  const deleteLoc = async (loc) => {
    const ok = await confirm(`Ești sigur că vrei să ștergi chioșcul "${loc.name}"?`, {
      title: 'Ștergere Kiosk',
      okLabel: 'Șterge',
      danger: true
    });
    if (!ok) return;
    try {
      const res = await fetchWithAuth(`${backend}/api/locations/${loc.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Chioșcul "${loc.name}" a fost șters.`);
        fetchLocs();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Eroare la ștergerea chioșcului.', 'error');
      }
    } catch {
      showToast('Eroare de rețea la ștergere.', 'error');
    }
  };

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
    if (locations.length === 0) setLoading(true);
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
        if (rawLocs.length > 0) {
          setLocations(rawLocs);
          try { localStorage.setItem('admin_cached_locations', JSON.stringify(rawLocs)); } catch { }
        }
        if (bData.brands?.length > 0) {
          setBrandsData(bData.brands);
          try { localStorage.setItem('admin_cached_brands', JSON.stringify(bData.brands)); } catch { }
        }
        setAllMenus(mData || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  useEffect(fetchLocs, [backend]);

  useEffect(() => {
    const returnKioskId = localStorage.getItem('admin_return_to_kiosk');
    const returnTab = localStorage.getItem('admin_return_to_kiosk_tab') || 'marketing';
    if (returnKioskId && locations.length > 0) {
      const found = locations.find(l => l.id === returnKioskId || l.kioskUrl === returnKioskId);
      if (found) {
        setEditingLoc(found);
        setEditingTab(returnTab);
      }
      localStorage.removeItem('admin_return_to_kiosk');
      localStorage.removeItem('admin_return_to_kiosk_name');
      localStorage.removeItem('admin_return_to_kiosk_tab');
    }
  }, [locations]);

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
    return <KioskSettingsForm loc={editingLoc} backend={backend} initialTab={editingTab} onBack={() => setEditingLoc(null)} onSave={fetchLocs} onNavigateToProducts={onNavigateToProducts} />;
  }

  const brandMeta = {
    smashme: { name: 'SmashMe', color: BRAND_COLORS.smashme },
    crunch: { name: 'Crunch', color: BRAND_COLORS.crunch },
    rollmaster: { name: 'Roll Master', color: BRAND_COLORS.rollmaster },
    lovesushi: { name: 'Love Sushi', color: BRAND_COLORS.lovesushi },
    pokiwoki: { name: 'Poki-Woki', color: BRAND_COLORS.pokiwoki },
    welovesushi: { name: 'WeLoveSushi', color: BRAND_COLORS.lovesushi },
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
      <div className="space-y-5">
        <div className="apple-card p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
            <button
              className={`shrink-0 px-3.5 h-8 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer tabular-nums ${brandFilter === 'all' && statusFilter === 'all' ? 'bg-[#007AFF] text-white' : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'}`}
              onClick={() => {
                setBrandFilter('all');
                setStatusFilter('all');
                setCurrentPage(1);
              }}
            >
              Toate ({locations.length})
            </button>

            <button
              className={`shrink-0 px-3.5 h-8 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer tabular-nums ${statusFilter === 'online'
                ? 'bg-[#34C759] text-white'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
                }`}
              onClick={() => {
                setStatusFilter(prev => prev === 'online' ? 'all' : 'online');
                setCurrentPage(1);
              }}
              title="Filtrează doar kiosk-urile conectate online"
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === 'online' ? 'bg-white' : 'bg-[#34C759]'}`} />
              <span>Online ({totalOnlineCount})</span>
            </button>

            {brandIds.map(bid => {
              const m = brandMeta[bid] || { name: bid, color: '#007AFF' };
              const count = locations.filter(l => (l.brands && l.brands.includes(bid)) || l.brandId === bid).length;
              return (
                <button
                  key={bid}
                  className={`shrink-0 px-3 h-8 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer tabular-nums ${brandFilter === bid ? 'bg-[#007AFF] text-white' : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'}`}
                  onClick={() => handleFilterClick(bid)}
                >
                  <BrandLogo brandId={bid} size={14} /> {m.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabel Business */}
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.06] dark:border-white/[0.08] whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">
                  <th className="px-5 py-3 text-left w-12">#</th>
                  <th className="px-5 py-3 min-w-[200px]">Denumire</th>
                  <th className="px-5 py-3">Meniu</th>
                  <th className="px-5 py-3">Program</th>
                  <th className="px-5 py-3">Stare</th>
                  <th className="px-5 py-3 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {paginated.map((loc, index) => {
                  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
                  const kioskBaseUrl = isLocalhost ? 'http://localhost:4010' : 'https://kiosk-smashme.netlify.app';
                  const finalKioskUrl = loc.kioskUrl ? `${kioskBaseUrl}/?loc=${loc.kioskUrl}` : `${kioskBaseUrl}/?loc=${loc.id}`;
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
                  const isLocked = Boolean(loc.forceLocked) || (live ? Boolean(live.isLocked || live.screen === 'pin') : false);
                  const isMaintenance = Boolean(loc.maintenanceMode);

                  return (
                    <tr key={loc.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors group">
                      <td className="px-5 py-3.5 text-[13px] text-[#86868B] font-medium whitespace-nowrap tabular-nums">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 items-start">
                          <button
                            type="button"
                            onClick={() => { setEditingLoc(loc); setEditingTab('design'); }}
                            title={`Setări chioșc ${loc.name}`}
                            className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#007AFF] transition-colors cursor-pointer"
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
                          <a
                            href={finalKioskUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={`Deschide chioșcul live (${loc.kioskUrl || loc.id})`}
                            className="text-[11px] text-[#86868B] hover:text-[#007AFF] transition-colors pl-0.5"
                          >
                            {loc.kioskUrl || loc.id}
                          </a>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            type="button"
                            onClick={() => { setEditingLoc(loc); setEditingTab('menu'); }}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${menuStats.isCustom
                              ? 'bg-[#007AFF]/12 text-[#007AFF] hover:bg-[#007AFF]/20'
                              : 'bg-black/[0.05] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.09]'
                              }`}
                          >
                            {menuStats.isCustom ? 'Meniu Personalizat' : 'Meniu Complet'}
                          </button>
                          <div className="text-[11px] text-[#6E6E73] dark:text-[#98989D] whitespace-nowrap overflow-hidden text-ellipsis max-w-[240px] tabular-nums">
                            {menuStats.isCustom ? (
                              <span className="inline-flex items-center gap-1">
                                {menuStats.profileName && <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{menuStats.profileName} ·</span>}
                                <span>{menuStats.visibleCount}/{menuStats.totalCount} prod</span>
                                {menuStats.hiddenCount > 0 && <span className="text-[#FF9500] font-semibold">(-{menuStats.hiddenCount})</span>}
                              </span>
                            ) : (
                              <span>{menuStats.totalCount ? `${menuStats.totalCount} produse active` : 'Toate produsele active'}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            type="button"
                            onClick={() => { setEditingLoc(loc); setEditingTab('system'); }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer tabular-nums ${loc.lockScheduleActive
                              ? 'bg-[#007AFF]/12 text-[#007AFF] hover:bg-[#007AFF]/20'
                              : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08]'
                              }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{loc.lockScheduleActive ? `${loc.lockStartTime || '22:00'} – ${loc.lockEndTime || '09:00'}` : 'Fără program'}</span>
                          </button>
                          {loc.kioskPin ? (
                            <div className="inline-flex items-center gap-1 text-[11px] text-[#6E6E73] dark:text-[#98989D] ">
                              <span>PIN: {revealedPins.has(loc.id) ? loc.kioskPin : '••••'}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleRevealPin(loc.id); }}
                                className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white p-0.5 cursor-pointer"
                                title={revealedPins.has(loc.id) ? 'Ascunde PIN' : 'Arată PIN'}
                              >
                                {revealedPins.has(loc.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#86868B]">Fără PIN</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isOnline
                              ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]'
                              : 'bg-black/[0.05] dark:bg-white/[0.08] text-[#86868B]'
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#34C759]' : 'bg-[#86868B]'}`} />
                            {isOnline ? 'Conectat' : (loc.active ? 'Offline' : 'Inactiv')}
                          </span>
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF3B30]/12 text-[#FF3B30]">
                              <Lock className="w-2.5 h-2.5" /> PIN
                            </span>
                          )}
                          {isMaintenance && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF9500]/12 text-[#C93400] dark:text-[#FF9F0A]">
                              <Sliders className="w-2.5 h-2.5" /> Mentenanță
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => lockKioskNow(loc, e, isLocked)}
                            disabled={lockingId === loc.id}
                            title={isLocked ? 'Blocat cu PIN — apasă pentru deblocare' : 'Blochează cu ecran PIN'}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isLocked
                              ? 'bg-[#FF3B30] text-white'
                              : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-[#FF3B30]/12 hover:text-[#FF3B30]'
                              }`}
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => toggleMaintenanceMode(loc, e)}
                            disabled={maintainingId === loc.id}
                            title={isMaintenance ? 'Oprește modul Mentenanță' : 'Activează modul Mentenanță'}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isMaintenance
                              ? 'bg-[#FF9500] text-white'
                              : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-[#FF9500]/12 hover:text-[#FF9500]'
                              }`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRemoteModalLoc(loc); }}
                            title="Control PC Windows (C:\SmartKiosk)"
                            className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-[#007AFF]/12 hover:text-[#007AFF] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Server className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Restartare Ecrane Remote"
                            className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-[#FF9500]/12 hover:text-[#FF9500] flex items-center justify-center transition-colors cursor-pointer"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (restartingId === loc.id) return;
                              const okRestart = await confirm(
                                `Se repornesc ecranul kiosk ȘI POS Bridge-ul la „${loc.name}”. Timp de 1–2 minute nu se pot face plăți cu cardul și nu se tipărește bonul. Nu continua dacă un client plătește chiar acum.`,
                                { title: 'Restart locație — ești sigur?', icon: <RestartDialogIcon />, okLabel: 'Da, repornește', cancelLabel: 'Nu, renunț', danger: true }
                              );
                              if (!okRestart) return;
                              setRestartingId(loc.id);
                              try {
                                const res = await fetchWithAuth(`${backend}/api/locations/${loc.id}/restart`, { method: 'POST' });
                                const data = await res.json();
                                if (res.ok) showToast(`Semnal de restart trimis pentru ${loc.name}!`);
                                else showToast(data.error || 'Eroare la trimiterea comenzii', 'error');
                              } catch {
                                showToast('Conexiune eșuată. Verificați rețeaua.', 'error');
                              } finally {
                                setRestartingId(null);
                              }
                            }}
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${restartingId === loc.id ? 'animate-spin' : ''}`} />
                          </button>
                          <a
                            title="Vizualizare Kiosk direct"
                            href={finalKioskUrl} target="_blank" rel="noreferrer"
                            className="w-8 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-[#007AFF]/12 hover:text-[#007AFF] flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                          <button
                            title="Copiază Link Universal"
                            className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-[#34C759]/12 hover:text-[#248A3D] flex items-center justify-center transition-colors cursor-pointer"
                            onClick={() => {
                              navigator.clipboard.writeText(finalKioskUrl);
                              showToast('Link kiosk copiat');
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Produse Promoționale & Pop-up Start"
                            className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-[#FF9500]/12 hover:text-[#FF9500] flex items-center justify-center transition-colors cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetKioskId = loc.kioskUrl || loc.id;
                              const bArr = loc.brands && loc.brands.length > 0 ? loc.brands : (loc.brandId ? [loc.brandId] : ['smashme']);
                              const firstB = bArr[0] || 'smashme';
                              localStorage.setItem('admin_active_location', loc.id);
                              localStorage.setItem('admin_active_kiosk', targetKioskId);
                              localStorage.setItem('admin_product_filter_diet', 'promo');
                              localStorage.setItem('admin_active_brand', firstB);
                              localStorage.setItem('admin_return_to_kiosk', loc.id);
                              localStorage.setItem('admin_return_to_kiosk_name', loc.name || loc.id);
                              localStorage.setItem('admin_return_to_kiosk_tab', 'marketing');
                              if (onNavigateToProducts) onNavigateToProducts(loc.id, targetKioskId, 'promo', firstB);
                              else window.location.hash = 'products';
                            }}
                          >
                            <Tags className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Setări și Screensaver"
                            className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#007AFF]/12 hover:text-[#007AFF] flex items-center justify-center transition-colors cursor-pointer"
                            onClick={() => { setEditingLoc(loc); setEditingTab('design'); }}
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Șterge Kiosk"
                            className="w-8 h-8 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] flex items-center justify-center transition-colors cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); deleteLoc(loc); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-black/[0.015] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D]">Rânduri pe pagină</span>
              <select
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="apple-input py-1 px-2.5 text-[12px] font-semibold cursor-pointer"
              >
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] ml-1 hidden sm:block tabular-nums">
                {(currentPage - 1) * itemsPerPage + 1}–{Math.min(sorted.length, currentPage * itemsPerPage)} din {sorted.length}
              </span>
            </div>
            <div className="flex gap-1">
              {[
                { label: '«', action: () => setCurrentPage(1), disabled: currentPage === 1, title: 'Prima pagină' },
                { label: '‹', action: () => setCurrentPage(p => p - 1), disabled: currentPage === 1, title: 'Anterioară' },
                { label: '›', action: () => setCurrentPage(p => p + 1), disabled: currentPage === totalPages, title: 'Următoarea' },
                { label: '»', action: () => setCurrentPage(totalPages), disabled: currentPage === totalPages, title: 'Ultima pagină' },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} disabled={btn.disabled} title={btn.title}
                  className="w-8 h-8 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-35 disabled:cursor-not-allowed text-[13px] font-semibold flex items-center justify-center transition-colors cursor-pointer"
                >{btn.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {remoteModalLoc && (
        <WindowsRemoteModal
          isOpen={Boolean(remoteModalLoc)}
          onClose={() => setRemoteModalLoc(null)}
          loc={locations.find(l => l.id === remoteModalLoc.id) || remoteModalLoc}
          bridgeLoc={
            bridgeSummary?.locations?.[remoteModalLoc.kioskUrl || remoteModalLoc.id] ||
            bridgeSummary?.locations?.[remoteModalLoc.id]
          }
          isOnline={isLocOnline(remoteModalLoc)}
          isLocked={Boolean((locations.find(l => l.id === remoteModalLoc.id) || remoteModalLoc).forceLocked)}
          isMaintenance={Boolean((locations.find(l => l.id === remoteModalLoc.id) || remoteModalLoc).maintenanceMode)}
          onToggleLock={(l, e, curLocked) => lockKioskNow(locations.find(x => x.id === l.id) || l, e, curLocked)}
          onToggleMaintenance={(l, e) => toggleMaintenanceMode(locations.find(x => x.id === l.id) || l, e)}
          backend={backend}
          socket={socket}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-[#1C1C1E] dark:bg-[#2C2C2E] text-white px-5 py-2.5 rounded-full text-[13px] font-medium shadow-2xl border border-white/10 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className={`w-2 h-2 rounded-full ${toast.type === 'error' ? 'bg-[#FF3B30]' : 'bg-[#34C759]'}`} />
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}

function RestartKioskBtn({ locId, backend, fetchWithAuth }) {
  const confirm = useConfirm();
  const [rstState, setRstState] = useState('idle');
  const doRestart = async (e) => {
    e.stopPropagation();
    if (rstState === 'sending') return;
    const ok = await confirm(
      'Se repornesc ecranul kiosk ȘI POS Bridge-ul acestei locații. Timp de 1–2 minute nu se pot face plăți cu cardul. Nu continua dacă un client plătește chiar acum.',
      { title: 'Refresh Kiosk — ești sigur?', icon: <RestartDialogIcon />, okLabel: 'Da, repornește', cancelLabel: 'Nu, renunț', danger: true }
    );
    if (!ok) return;
    setRstState('sending');
    try {
      const res = await fetchWithAuth(`${backend}/api/locations/${locId}/restart`, { method: 'POST' });
      setRstState(res.ok ? 'ok' : 'err');
    } catch { setRstState('err'); }
    setTimeout(() => setRstState('idle'), 3000);
  };
  const colors = { idle: 'var(--surface)', sending: '#f59e0b', ok: '#059669', err: '#ef4444' };
  const labels = { idle: 'Refresh Kiosk', sending: 'Se trimite...', ok: 'Trimis!', err: 'Eroare' };
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
        <path d="M2.5 2v6h6M21.5 22v-6h-6" />
        <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2" />
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
      className={`apple-switch ${checked ? 'is-on' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="apple-switch-thumb" />
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
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-700 transition-colors"
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

function KioskSettingsForm({ loc, backend, initialTab = 'design', onBack, onSave, onNavigateToProducts }) {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState(initialTab || 'design');
  const targetKioskId = loc.kioskUrl || loc.id;
  const promoMap = loc.kioskPromos?.[targetKioskId] || {};
  const activePromoCount = Object.keys(promoMap).filter(pid => promoMap[pid]?.price).length;
  const startPopupCount = Object.keys(promoMap).filter(pid => promoMap[pid]?.price && promoMap[pid]?.popupStart).length;
  const firstBrand = (loc.brands && loc.brands[0]) || loc.brandId || 'smashme';

  const goToPromoProducts = () => {
    localStorage.setItem('admin_active_location', loc.id);
    localStorage.setItem('admin_active_kiosk', targetKioskId);
    localStorage.setItem('admin_product_filter_diet', 'promo');
    localStorage.setItem('admin_active_brand', firstBrand);
    localStorage.setItem('admin_return_to_kiosk', loc.id);
    localStorage.setItem('admin_return_to_kiosk_name', loc.name || loc.id);
    localStorage.setItem('admin_return_to_kiosk_tab', activeTab);
    if (onNavigateToProducts) {
      onNavigateToProducts(loc.id, targetKioskId, 'promo', firstBrand);
    } else {
      window.location.hash = 'products';
    }
  };
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
    forceLocked: Boolean(loc.forceLocked),
    forceLockedAt: loc.forceLockedAt || null,
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
    halloweenButtonTheme: loc.halloweenButtonTheme || 'auto',
    langVerticalPosition: loc.langVerticalPosition || 'bottom',
    langSelectorPosition: loc.langSelectorPosition || 'after',
    langBgColor: loc.langBgColor || '',
    langBorderColor: loc.langBorderColor || '',
    langBarBg: loc.langBarBg || '',
    menuOverrides: loc.menuOverrides || {},
    paymentGateway: loc.paymentGateway || 'none',
    paymentMode: loc.paymentMode || (loc.cashOnly ? 'cash_only' : 'both'),
    posWakeStandby: loc.posWakeStandby ?? true,
    posWakeIntervalMinutes: loc.posWakeIntervalMinutes || 5,
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
      .catch(() => { });
  }, [backend, fetchWithAuth]);

  // Derived: active brands for this location
  const activeBrands = formData.brands && formData.brands.length > 0 ? formData.brands : (loc.brands && loc.brands.length > 0 ? loc.brands : []);

  const [brandProfiles, setBrandProfiles] = useState({});
  useEffect(() => {
    activeBrands.forEach(brandId => {
      const locOrgId = (formData.orgIds && formData.orgIds[brandId]) || (loc.orgIds && loc.orgIds[brandId]) || '';
      const orgParam = locOrgId ? `&orgId=${encodeURIComponent(locOrgId)}` : '';
      const locParam = loc.id ? `&locId=${encodeURIComponent(loc.id)}` : '';
      Promise.all([
        fetchWithAuth(`${backend}/api/brands/${brandId}`).then(r => r.ok ? r.json() : null),
        fetchWithAuth(`${backend}/api/menu?brandId=${brandId}${orgParam}${locParam}&includeHidden=true`).then(r => r.ok ? r.json() : null)
      ])
        .then(([brandData, menuData]) => {
          if (brandData) {
            setBrandProfiles(prev => ({
              ...prev,
              [brandId]: {
                brand: brandData,
                profiles: brandData.data?.menuProfiles || [],
                menu: menuData || null
              }
            }));
          }
        })
        .catch(() => { });
    });
  }, [backend, activeBrands.join(','), loc.id, JSON.stringify(formData.orgIds || {}), JSON.stringify(loc.orgIds || {})]);

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
    } catch (e) {
      console.error('Eroare la salvare.');
      setIsSaving(false);
    }
  };

  const handleDeleteThisLoc = async () => {
    const ok = await confirm(`Ești sigur că vrei să ștergi chioșcul "${formData.name || loc.name}"?`, {
      title: 'Ștergere Kiosk',
      okLabel: 'Șterge definitiv',
      danger: true
    });
    if (!ok) return;
    try {
      const res = await fetchWithAuth(`${backend}/api/locations/${loc.id}`, { method: 'DELETE' });
      if (res.ok) {
        onSave();
        onBack();
      } else {
        const data = await res.json().catch(() => ({}));
        confirm(data.error || 'Eroare la ștergerea chioșcului.', { title: 'Eroare', danger: true, hideCancel: true });
      }
    } catch {
      confirm('Eroare de rețea la ștergere.', { title: 'Eroare', danger: true, hideCancel: true });
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
    const editBrandId = editingMenuBrand.brand.id;
    const locOrgId = (formData.orgIds && formData.orgIds[editBrandId]) || (loc.orgIds && loc.orgIds[editBrandId]) || '';
    return (
      <div className="admin-section" style={{ padding: 0 }}>
        <MenuProfileEditorModal
          backend={backend}
          brand={editingMenuBrand.brand}
          profile={editingMenuBrand.profile}
          localHiddenItemsOverride={editingMenuBrand.localHiddenItemsOverride}
          locId={loc.id}
          orgId={locOrgId}
          locationName={formData.name || loc.name}
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
            className="px-3.5 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
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
          <button
            type="button"
            onClick={goToPromoProducts}
            className="inline-flex items-center gap-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3.5 py-2 rounded-full text-sm font-semibold border border-amber-200 dark:border-amber-800/60 transition-all shadow-xs cursor-pointer"
            title="Deschide lista de produse promoționale și oferte Pop-up Start pentru acest Kiosk"
          >
            <Tags className="w-4 h-4 text-amber-500" />
            <span>Produse Promo {activePromoCount > 0 ? `(${activePromoCount})` : ''}</span>
          </button>
          <a
            href={finalKioskUrl}
            target="_blank"
            rel="noreferrer"
            className="apple-btn-secondary px-4 py-2 text-[13px]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            <span>Deschide Live</span>
          </a>
          <RestartKioskBtn locId={loc.id} backend={backend} fetchWithAuth={fetchWithAuth} />
          <button
            type="button"
            onClick={handleDeleteThisLoc}
            className="apple-glass-btn apple-glass-btn-danger"
            title="Șterge Kiosk"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving || saveSuccess}
            className={`px-5 py-2.5 rounded-full text-[13px] font-semibold text-white transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${saveSuccess
              ? 'bg-[#34C759] shadow-[0_2px_10px_rgba(52,199,89,0.35)]'
              : isSaving
                ? 'bg-[#007AFF]/70 cursor-wait'
                : 'apple-btn-primary'
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
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer text-center ${isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700/80 ring-1 ring-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                  }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
                {tab.badge && (
                  <span className={`shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${isActive
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

            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Tags className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Prețurile promoționale și ofertele Pop-up Start se configurează pe produse în ecranul Overrides:
                </span>
              </div>
              <button
                type="button"
                onClick={goToPromoProducts}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Deschide Produse Promo (Overrides)</span>
                <span>→</span>
              </button>
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
                        {bData.profiles.map(p => {
                          const prods = bData.menu?.products;
                          const hCount = (prods && Array.isArray(prods) && prods.length > 0)
                            ? prods.filter(prod => p.hiddenItems?.[prod.id] === true).length
                            : Object.values(p.hiddenItems || {}).filter(v => v === true).length;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} {hCount > 0 ? `(${hCount} ascunse)` : ''}
                            </option>
                          );
                        })}
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
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${localHiddenCount > 0
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
                        className={`py-3 px-2 rounded-full text-center transition-all cursor-pointer ${isSelected
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

              {/* Toggle Format Steag Tricolor pe Buton */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="text-base"></span>
                    <span>Format Buton Steag (Tricolor)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Afișează fundal în format de steag (tricolor / steagul limbii) pe butonul „Începe comanda”. Debifează pentru fundal simplu/solid.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.langButtonFlagColors)}
                    onChange={e => handleChange('langButtonFlagColors', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Halloween Seasonal Theme Selector */}
              <div className="p-4 rounded-2xl border border-orange-300/80 dark:border-orange-900/60 bg-gradient-to-r from-orange-500/10 via-purple-600/10 to-slate-900/10 dark:from-orange-950/40 dark:via-purple-950/40 dark:to-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="text-base"></span>
                    <span>Temă Festivă Halloween (Animații Periodice)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-black tracking-wide uppercase">Sezonier</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    Animație periodică vie pe butonul de start: reflexie de lumină rotativă, pulsație incandescentă și dovleac plutitor.
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs">
                  {[
                    { id: 'auto', label: 'Auto (15 Oct - 5 Nov)' },
                    { id: 'on', label: 'Pornit' },
                    { id: 'off', label: 'Oprit' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleChange('halloweenButtonTheme', opt.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${(formData.halloweenButtonTheme || 'auto') === opt.id
                        ? 'bg-gradient-to-r from-orange-600 to-purple-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Button Preview */}
              {(() => {
                const isHActive = (() => {
                  const s = formData.halloweenButtonTheme || 'auto';
                  if (s === 'on') return true;
                  if (s === 'off') return false;
                  const now = new Date();
                  const m = now.getMonth();
                  const d = now.getDate();
                  return (m === 9 && d >= 15) || (m === 10 && d <= 5);
                })();

                return (
                  <div className="pt-3 pb-1 flex flex-col items-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <span>Previzualizare Buton Kiosk</span>
                      {isHActive && <span className="px-1.5 py-0.2 rounded bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-extrabold text-[10px]">MOD HALLOWEEN ACTIV</span>}
                    </span>

                    {/* Inline Animation Styles for accurate Admin Preview */}
                    <style>{`
                      @keyframes adminHalloweenAlive {
                        0%, 65%, 100% {
                          transform: scale(1) rotate(0deg);
                          box-shadow: 0 0 20px rgba(255, 85, 0, 0.65), 0 0 45px rgba(126, 34, 206, 0.4), 0 10px 25px rgba(0,0,0,0.4);
                        }
                        72% {
                          transform: scale(1.025) rotate(-1.5deg);
                          box-shadow: 0 0 32px rgba(255, 120, 0, 0.85), 0 0 60px rgba(168, 85, 247, 0.6), 0 14px 30px rgba(0,0,0,0.5);
                        }
                        80% {
                          transform: scale(1.025) rotate(1.5deg);
                          box-shadow: 0 0 35px rgba(255, 120, 0, 0.9), 0 0 65px rgba(168, 85, 247, 0.65), 0 14px 30px rgba(0,0,0,0.5);
                        }
                        88% { transform: scale(1.01) rotate(-0.5deg); }
                        94% { transform: scale(1) rotate(0deg); }
                      }
                      @keyframes adminLightSweep {
                        0% { left: -80%; opacity: 0; }
                        12% { opacity: 0.65; }
                        38% { left: 180%; opacity: 0; }
                        100% { left: 180%; opacity: 0; }
                      }
                      @keyframes adminPumpkinFloat {
                        0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
                        35% { transform: translateY(-3.5px) rotate(-3deg) scale(1.05); }
                        70% { transform: translateY(-1.5px) rotate(3deg) scale(1.02); }
                      }
                      @keyframes adminBatHover {
                        0% { transform: translateY(0) rotate(-4deg); }
                        100% { transform: translateY(-4px) rotate(4deg); }
                      }
                    `}</style>

                    <div
                      className="relative px-8 py-3.5 rounded-2xl font-black text-sm select-none transition-all flex items-center justify-center gap-3 overflow-hidden cursor-pointer"
                      style={isHActive ? {
                        background: 'linear-gradient(135deg, #ff4500 0%, #c41800 35%, #7e22ce 75%, #3b0764 100%)',
                        color: '#ffffff',
                        border: '2px solid #ff8800',
                        animation: 'adminHalloweenAlive 5.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                      } : {
                        background: formData.langButtonFlagColors
                          ? 'linear-gradient(90deg, #002B7F 33.3%, #FCD116 33.3% 66.6%, #CE1126 66.6%)'
                          : (formData.langButtonColor || '#0f172a'),
                        color: formData.langButtonTextColor || '#ffffff',
                        border: formData.langButtonBorderColor && formData.langButtonBorderColor !== 'transparent'
                          ? `2px solid ${formData.langButtonBorderColor}`
                          : 'none',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)'
                      }}
                    >
                      {/* Sweeping Light Blade */}
                      {isHActive && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '-50%',
                            left: '-80%',
                            width: '55%',
                            height: '200%',
                            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 25%, rgba(255, 230, 100, 0.65) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 100%)',
                            transform: 'rotate(25deg)',
                            pointerEvents: 'none',
                            animation: 'adminLightSweep 5.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                            zIndex: 1,
                          }}
                        />
                      )}

                      {/* Bat in top corner */}
                      {isHActive && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '12px',
                            fontSize: '1rem',
                            animation: 'adminBatHover 2s ease-in-out infinite alternate',
                            filter: 'drop-shadow(0 0 5px rgba(168, 85, 247, 0.9))',
                            zIndex: 3,
                          }}
                        >
                        </span>
                      )}

                      {/* Floating Pumpkin */}
                      {isHActive && (
                        <img
                          src="/halloween_pumpkin.png"
                          alt=""
                          style={{
                            width: 26,
                            height: 26,
                            objectFit: 'contain',
                            animation: 'adminPumpkinFloat 3.5s ease-in-out infinite',
                            filter: 'drop-shadow(0 0 8px rgba(255, 120, 0, 0.95))',
                            zIndex: 2,
                          }}
                        />
                      )}

                      {/* Button Label */}
                      <span
                        style={{
                          position: 'relative',
                          zIndex: 2,
                          fontWeight: 800,
                          letterSpacing: '0.02em',
                          textShadow: isHActive ? '0 0 12px rgba(255, 210, 0, 0.8), 0 2px 4px rgba(0,0,0,0.85)' : 'none',
                        }}
                      >
                        {formData.langButtonText || 'Începe comanda'}
                      </span>

                      {/* Trailing Icon: Bat */}
                      {isHActive ? (
                        <img
                          src="/halloween_bat.png"
                          alt=""
                          style={{
                            height: 26,
                            width: 'auto',
                            maxWidth: 62,
                            objectFit: 'contain',
                            animation: 'adminBatHover 3.4s ease-in-out infinite alternate',
                            filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 5px rgba(255, 160, 0, 0.4))',
                            zIndex: 2,
                          }}
                        />
                      ) : (
                        <span style={{ zIndex: 2 }}>→</span>
                      )}
                    </div>
                  </div>
                );
              })()}
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
                <label className={`px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 ${uploadingScreensaver ? 'opacity-70 cursor-wait' : ''
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
                      className={`py-2 px-2 rounded-full text-xs transition-all cursor-pointer ${isSelected
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
                        className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 transition-colors"
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
                        className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 transition-colors"
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
                            className={`py-1 text-xs rounded font-semibold transition-all ${formData.bottomBannerTextFixed === m.v
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
                            className={`py-1 text-xs rounded font-semibold capitalize transition-all ${(formData.bottomBannerTextAlign || 'center') === align
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
                      Previzualizare Bară Footer (Reală: Logo Site Telefon)
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
                      className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700"
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

            {/* Quick Status & Direct Link to Product Overrides */}
            <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-amber-50/90 to-orange-50/70 dark:from-amber-950/25 dark:to-orange-950/15 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Tags className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Produse cu Ofertă de Start pe acest Kiosk:
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${startPopupCount > 0
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : activePromoCount > 0
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                    {startPopupCount > 0
                      ? `${startPopupCount} în Pop-up Start`
                      : activePromoCount > 0
                        ? `${activePromoCount} promo (fără Pop-up Start)`
                        : '0 configurate'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  {startPopupCount > 0
                    ? `Kioskul afișează automat popup-ul cu ofertele de întâmpinare la primul contact al clientului cu ecranul.`
                    : `Configurează prețul promoțional și bifează căsuța „Pop-up Start” în ecranul de Produse & Etichete.`}
                </p>
              </div>

              <button
                type="button"
                onClick={goToPromoProducts}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-600/20 transition-all cursor-pointer"
                title="Deschide ecranul Produse & Etichete pre-filtrat pe acest kiosk și pe Doar Promo"
              >
                <span>Gestionează Produse Promo (Overrides)</span>
                <span className="text-sm">→</span>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Stil Afișare Oferte Multiple
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('startPromoLayout', 'carousel')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${(formData.startPromoLayout || 'carousel') === 'carousel'
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
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${formData.startPromoLayout === 'duo'
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
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${isDefault
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
                            className="px-2.5 py-1 text-xs font-semibold rounded-full border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-all cursor-pointer"
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
                      className={`py-2 text-xs font-bold rounded-full transition-all ${(formData.langVerticalPosition || 'bottom') === pos.v
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
                      className={`py-2 text-xs font-bold rounded-full transition-all ${formData.langSelectorPosition === mom.v
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

              {/* Toggle Format Steag Tricolor pe Buton Principal */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 mt-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="text-base"></span>
                    <span>Format Buton Steag (Tricolor)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dacă este bifat, butonul mare „Începe comanda” va avea fundal tricolor. Debifează pentru culoare solidă/simplă.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.langButtonFlagColors)}
                    onChange={e => handleChange('langButtonFlagColors', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
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
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${isSelected
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

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Opțiuni Plată la Checkout</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Alege ce metode de plată sunt afișate clienților pe ecranul Kiosk-ului.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {[
                  { id: 'both', title: 'Card & Cash', desc: 'Implicit — clientul poate alege între Card POS și Cash la casierie' },
                  { id: 'cash_only', title: 'Doar Cash (Numerar)', desc: 'Activ doar numerar — util când POS-ul e deconectat sau lipsește cablul' },
                  { id: 'card_only', title: 'Doar Card (POS)', desc: 'Fără plată cash la casierie' },
                ].map(opt => {
                  const isSel = (formData.paymentMode || 'both') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleChange('paymentMode', opt.id)}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${isSel
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 hover:border-slate-300'
                        }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{opt.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{opt.desc}</div>
                      </div>
                      {isSel && (
                        <div className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Activ pe acest Kiosk</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Standby Keep-Alive / Trezire periodică POS */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Trezire automată POS din Standby (10:00 - 22:00)
                    </h4>
                    {formData.posWakeStandby ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                        Activ (la fiecare {formData.posWakeIntervalMinutes || 5} min)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                        Inactiv
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    În intervalul programului de lucru (10:00 - 22:00), dacă chioșcul este inactiv, trimite un impuls discret către terminalul bancar pentru a preveni adormirea portului USB în locații cu flux redus. Noaptea (după ora 22:00 și înainte de 10:00), impulsurile sunt oprite automat când restaurantul este închis.
                    <span className="block mt-0.5 text-slate-400 dark:text-slate-500 italic">Recomandat: <strong>5 minute</strong> pentru a preveni deconectarea portului serial.</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleChange('posWakeStandby', !formData.posWakeStandby)}
                  className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${formData.posWakeStandby ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.posWakeStandby ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {/* Selector Timer stil iPhone */}
              {formData.posWakeStandby && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>Interval impuls Keep-Alive (Timer):</span>
                    </div>

                    {/* Stepper stil iOS */}
                    <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => {
                          const current = Number(formData.posWakeIntervalMinutes || 5);
                          if (current > 1) handleChange('posWakeIntervalMinutes', current - 1);
                        }}
                        disabled={Number(formData.posWakeIntervalMinutes || 5) <= 1}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition font-extrabold text-lg select-none"
                        title="Scade cu 1 minut"
                      >
                        -
                      </button>

                      <div className="px-3 py-0.5 text-center min-w-[76px]">
                        <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                          {formData.posWakeIntervalMinutes || 5}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                          min
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const current = Number(formData.posWakeIntervalMinutes || 5);
                          if (current < 60) handleChange('posWakeIntervalMinutes', current + 1);
                        }}
                        disabled={Number(formData.posWakeIntervalMinutes || 5) >= 60}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition font-extrabold text-lg select-none"
                        title="Crește cu 1 minut"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">Preset rapid:</span>
                    {[
                      { min: 2, label: '2 min' },
                      { min: 3, label: '3 min' },
                      { min: 5, label: '5 min (Recomandat)', highlight: true },
                      { min: 10, label: '10 min' },
                      { min: 15, label: '15 min' },
                      { min: 30, label: '30 min' },
                    ].map(preset => {
                      const isSelected = Number(formData.posWakeIntervalMinutes || 5) === preset.min;
                      return (
                        <button
                          key={preset.min}
                          type="button"
                          onClick={() => handleChange('posWakeIntervalMinutes', preset.min)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${isSelected
                            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30 font-bold'
                            : preset.highlight
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                            }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>
                      Impuls discret de 100ms transmis la fiecare <strong>{formData.posWakeIntervalMinutes || 5} minute</strong> fără comenzi. Resetează ceasul de sleep din POS-ul Verifone fără zgomot sau tipărire.
                    </span>
                  </p>
                </div>
              )}
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
                              [newB[index - 1], newB[index]] = [newB[index], newB[index - 1]];
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
                              [newB[index + 1], newB[index]] = [newB[index], newB[index + 1]];
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
                        className="px-3 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
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
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
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
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-xs font-bold transition-all cursor-pointer"
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
                              className={`w-full px-3.5 py-2.5 pr-10 text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm ${formData.kioskPin ? 'font-bold tracking-[0.25em] text-base' : 'font-normal tracking-normal text-sm placeholder:text-slate-400'
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
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
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
                              className={`w-full px-3.5 py-2.5 pr-10 text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all shadow-sm ${formData.vendorPin ? 'font-bold tracking-[0.25em] text-base' : 'font-normal tracking-normal text-sm placeholder:text-slate-400'
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
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
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

                    {/* Secțiune Blocare Instantă (Manuală) */}
                    <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/50 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          Blocare / Deblocare Kiosk Instantă (Ecran PIN)
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Blochează imediat chioșcul exact ca în timpul nopții (fără buton X). Se poate debloca de pe Kiosk cu PIN Manager/Casier sau rapid din Admin.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const shouldLock = !formData.forceLocked;
                          const nowIso = new Date().toISOString();
                          const nextData = {
                            ...formData,
                            forceLocked: shouldLock,
                            forceLockedAt: shouldLock ? nowIso : null,
                            remoteUnlockedAt: !shouldLock ? nowIso : null
                          };
                          setFormData(nextData);
                          try {
                            const [putRes] = await Promise.all([
                              fetchWithAuth(`${backend}/api/locations/${loc.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(nextData)
                              }),
                              fetchWithAuth(`${backend}/api/locations/${loc.id}/lock`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ locked: shouldLock })
                              }).catch(() => null)
                            ]);
                            if (putRes && putRes.ok) {
                              window.dispatchEvent(new CustomEvent('admin_location_updated', { detail: nextData }));
                            } else {
                              confirm('Eroare la actualizarea stării de blocare.', { title: 'Eroare', danger: true, hideCancel: true, okLabel: 'Închide' });
                            }
                          } catch {
                            confirm('Eroare de rețea la actualizarea stării de blocare.', { title: 'Eroare de rețea', danger: true, hideCancel: true, okLabel: 'Închide' });
                          }
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer shrink-0 ${formData.forceLocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                          }`}
                      >
                        {formData.forceLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>{formData.forceLocked ? 'Deblochează acum' : 'Blochează acum'}</span>
                      </button>
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
                                className={`px-4 py-1.5 rounded-full transition-all ${(formData.lockScheduleMode || 'daily') === 'daily'
                                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                  }`}
                              >
                                Zilnic (Luni - Duminică)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChange('lockScheduleMode', 'custom')}
                                className={`px-4 py-1.5 rounded-full transition-all ${formData.lockScheduleMode === 'custom'
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
                                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${isSelected
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
                        {bData.profiles.map(p => {
                          const prods = bData.menu?.products;
                          const hCount = (prods && Array.isArray(prods) && prods.length > 0)
                            ? prods.filter(prod => p.hiddenItems?.[prod.id] === true).length
                            : Object.values(p.hiddenItems || {}).filter(v => v === true).length;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} {hCount > 0 ? `(${hCount} ascunse)` : ''}
                            </option>
                          );
                        })}
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
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${localHiddenCount > 0
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
            Închide
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
const BRAND_PILL_COLORS = BRAND_COLORS;

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

  if (loading) return (
    <div className="apple-card flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-6 h-6 border-2 border-black/10 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
      <span className="text-[#86868B] text-[13px] font-medium">Se încarcă locațiile...</span>
    </div>
  );

  if (editingLoc) {
    return <LocationEditForm loc={editingLoc} backend={backend} onBack={() => setEditingLoc(null)} onSave={fetchLocs} />;
  }

  return (
    <div className="space-y-5">
      {/* Filters & Add button */}
      <div className="apple-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button className={`px-3.5 h-8 rounded-full text-[12px] font-semibold transition-all cursor-pointer tabular-nums ${filter === 'all' ? 'bg-[#007AFF] text-white' : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'}`} onClick={() => handleFilterChange('all')}>
            Toate ({locations.length})
          </button>
          {Object.entries(BRAND_LABELS).map(([k, v]) => {
            const count = locations.filter(l => l.brands?.includes(k)).length;
            if (!count) return null;
            return (
              <button
                key={k}
                className={`px-3 h-8 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer tabular-nums ${filter === k ? 'bg-[#007AFF] text-white' : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'}`}
                onClick={() => handleFilterChange(k)}
              >
                <BrandLogo brandId={k} size={14} /> {v} ({count})
              </button>
            );
          })}
        </div>
        <button className="apple-btn-primary px-4 py-1.5 text-[13px] whitespace-nowrap" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Închide' : '+ Adaugă Locație'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="apple-card p-4 flex flex-col sm:flex-row gap-3 items-center animate-in fade-in duration-150">
          <input
            type="text"
            placeholder="Nume locație (ex: SM Brașov)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="apple-input flex-1 w-full text-[13px]"
          />
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            {Object.entries(BRAND_LABELS).map(([k, v]) => (
              <button
                key={k}
                className={`px-3 h-8 rounded-full text-[12px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${newBrands.includes(k) ? 'bg-[#007AFF] text-white' : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08]'}`}
                onClick={() => toggleBrand(k)}
              ><BrandLogo brandId={k} size={14} /> {v}</button>
            ))}
          </div>
          <input
            type="number"
            min="1" max="100"
            value={newTables}
            onChange={e => setNewTables(Number(e.target.value))}
            className="apple-input w-24 text-center text-[13px] tabular-nums"
            placeholder="Nr. mese"
          />
          <button className="apple-btn-primary px-4 py-2 text-[13px]" onClick={createLocation}>Salvează</button>
        </div>
      )}

      {/* Locations table */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.06] dark:border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">
                <th className="px-5 py-3 w-12">#</th>
                <th className="px-5 py-3">Nume Locație</th>
                <th className="px-5 py-3">Branduri Active</th>
                <th className="px-5 py-3">Statistici</th>
                <th className="px-5 py-3">Stare</th>
                <th className="px-5 py-3 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {paginated.map((loc, index) => (
                <tr key={loc.id} className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer ${!loc.active ? 'opacity-55' : ''}`} onClick={() => setEditingLoc(loc)}>
                  <td className="px-5 py-3.5 text-[13px] font-medium text-[#86868B] tabular-nums">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] text-[13px]">{loc.name}</div>
                    <div className="text-[11px] text-[#86868B] mt-0.5">{loc.id}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1.5 flex-wrap">
                      {(loc.brands || []).map(b => <BrandLogo key={b} brandId={b} size={20} />)}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums">
                    <div className="flex gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D]">Mese: {loc.tables || 0}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989D]">Kiosk-uri: {(loc.kiosks || []).length}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleActive(loc)}
                      title={loc.active ? 'Activ — apasă pentru dezactivare' : 'Inactiv — apasă pentru activare'}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${loc.active
                        ? 'bg-[#34C759]/12 text-[#248A3D] dark:text-[#30D158]'
                        : 'bg-[#FF3B30]/10 text-[#FF3B30]'
                        }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${loc.active ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`} />
                      {loc.active ? 'Activă' : 'Inactivă'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex justify-end gap-1.5">
                      <button
                        title="Configurare locație"
                        className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center transition-colors cursor-pointer"
                        onClick={() => setEditingLoc(loc)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                      <button
                        title="Șterge definitiv locația"
                        className="w-8 h-8 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] flex items-center justify-center transition-colors cursor-pointer"
                        onClick={() => deleteLoc(loc.id)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-10 text-center text-[#86868B] text-[13px] font-medium">Nu există locații care să corespundă filtrelor.</div>}
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center px-5 py-3.5 bg-black/[0.015] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D]">Rânduri</span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="apple-input py-1 px-2.5 text-[12px] font-semibold cursor-pointer"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] ml-1 tabular-nums">
              {sorted.length === 0 ? '0' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(sorted.length, currentPage * itemsPerPage)}`} din {sorted.length}
            </span>
          </div>
          <div className="flex gap-1">
            {[
              { label: '«', action: () => setCurrentPage(1), disabled: currentPage === 1, title: 'Prima pagină' },
              { label: '‹', action: () => setCurrentPage(p => p - 1), disabled: currentPage === 1, title: 'Anterioară' },
              { label: '›', action: () => setCurrentPage(p => p + 1), disabled: currentPage === totalPages, title: 'Următoarea' },
              { label: '»', action: () => setCurrentPage(totalPages), disabled: currentPage === totalPages, title: 'Ultima pagină' },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} disabled={btn.disabled} title={btn.title}
                className="w-8 h-8 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center font-semibold transition-colors cursor-pointer"
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

  const BRAND_DISPLAY = {
    smashme: 'SmashMe',
    crunch: 'Crunch',
    rollmaster: 'Roll Master',
    lovesushi: 'Love Sushi',
    pokiwoki: 'Poki-Woki',
    welovesushi: 'WeLoveSushi',
    sushimaster: 'Sushi Master',
    ikura: 'Ikura',
  };

  return (
    <div className="space-y-5 w-full animate-in fade-in duration-200">
      <div className="apple-card px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <button type="button" onClick={onBack} className="apple-btn-secondary px-3.5 h-9 text-[13px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span>Înapoi</span>
          </button>
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0 tracking-tight truncate">
              {loc.name}
            </h2>
            <p className="text-[12px] text-[#86868B] mt-0.5 mb-0 truncate">Editare locație · {loc.id}</p>
          </div>
        </div>
        <button type="button" onClick={saveLoc} className="apple-btn-primary px-5 h-9 text-[13px]">
          <Check size={15} strokeWidth={2.5} />
          <span>Salvează Modificările</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="apple-card p-5 space-y-4">
          <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">Informații Generale</h3>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] mb-1.5 block">Nume Locație</label>
            <input type="text" className="apple-input w-full" value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="Ex: SM Bacău" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] mb-1.5 block">Număr de Mese (Kiosk/QR)</label>
            <input type="number" className="apple-input w-full" value={formData.tables} onChange={e => handleChange('tables', parseInt(e.target.value) || 0)} min="0" />
          </div>
        </div>

        <div className="apple-card p-5 space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">Restaurante Active</h3>
            <p className="text-[12.5px] text-[#86868B] mt-1 mb-0">Selectează brandurile disponibile pe kiosk-urile din această locație.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries({ smashme: 'SmashMe', crunch: 'Crunch', rollmaster: 'Roll Master', lovesushi: 'Love Sushi', pokiwoki: 'Poki-Woki' }).map(([k, v]) => {
              const isActive = formData.brands.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  className={`px-3.5 h-9 rounded-full inline-flex items-center gap-2 font-semibold text-[13px] transition-all cursor-pointer ${isActive
                    ? 'bg-[#007AFF] text-white shadow-[0_2px_8px_rgba(0,122,255,0.3)]'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
                    }`}
                  onClick={() => toggleBrand(k)}
                >
                  <BrandLogo brandId={k} size={18} />
                  <span>{v}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="apple-card p-5 lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] m-0">Setări Syrve (iiko) per locație</h3>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#98989D] mt-1 mb-0">Dacă un brand folosește un <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Organization ID</span> diferit față de cel global, completează-l mai jos.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {formData.brands.map(bId => (
              <div key={bId} className="space-y-1.5">
                <label className="text-[11.5px] font-semibold text-[#6E6E73] dark:text-[#98989D] flex items-center gap-1.5">
                  <BrandLogo brandId={bId} size={16} />
                  <span>Org ID — {BRAND_DISPLAY[bId] || bId}</span>
                </label>
                <input type="text" className="apple-input w-full text-[13px]" value={formData.orgIds[bId] || ''} onChange={e => handleOrgChange(bId, e.target.value)} placeholder="ID global implicit" />
              </div>
            ))}
            {formData.brands.length === 0 && (
              <div className="text-[13px] text-[#C93400] dark:text-[#FF9F0A] font-medium px-4 py-3 bg-[#FF9500]/10 rounded-xl col-span-full">
                Selectează măcar un brand pentru a seta suprascrieri de locație Syrve.
              </div>
            )}
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

  const BRAND_DEFAULT_COLORS = BRAND_COLORS;

  if (loading) return (
    <div className="apple-card flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-6 h-6 border-2 border-black/10 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
      <span className="text-[#86868B] text-[13px] font-medium">Se încarcă brandurile...</span>
    </div>
  );

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[#6E6E73] dark:text-[#98989D] text-[13px] m-0">
          Gestionează identitatea vizuală, logo-urile și detaliile fiecărui brand din sistem.
        </p>
        <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-black/[0.045] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#98989D]">
          {brands.length} branduri
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {brands.map(brand => {
          const isEditing = editing === brand.id;
          return (
            <div key={brand.id} className={`apple-card p-4 flex flex-col justify-between gap-4 transition-all ${isEditing ? 'ring-2 ring-[#007AFF]/45' : ''}`}>
              <div className="space-y-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-[16px] bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] shadow-xs flex items-center justify-center overflow-hidden shrink-0 p-1.5">
                    {brand.logo_url ? (
                      <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain rounded-xl" />
                    ) : (
                      <BrandLogo brandId={brand.id} size={44} className="!border-0 !shadow-none !bg-transparent" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate leading-tight">
                      {brand.name || brand.id}
                    </div>
                    <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.07] text-[11px] font-medium text-[#86868B]">
                      {brand.id}
                    </div>
                    {brand.website && (
                      <a href={brand.website} target="_blank" rel="noreferrer" className="text-[12px] text-[#007AFF] hover:underline font-medium block truncate mt-1">
                        {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    )}
                  </div>
                </div>

                {!isEditing && brand.description && (
                  <p className="text-[12.5px] text-[#6E6E73] dark:text-[#98989D] m-0 leading-relaxed line-clamp-2">
                    {brand.description}
                  </p>
                )}
              </div>

              {!isEditing ? (
                <div className="flex items-center gap-2 pt-3 border-t border-black/[0.05] dark:border-white/[0.07]">
                  <label className="apple-btn-secondary flex-1 h-8 px-3 text-[12px] cursor-pointer">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => handleLogoUpload(brand.id, e.target.files[0])} />
                    <Upload size={13} strokeWidth={2.2} className="text-[#007AFF]" />
                    <span>{uploadingId === brand.id ? 'Se încarcă...' : 'Logo'}</span>
                  </label>
                  <button type="button" onClick={() => startEdit(brand)} className="apple-btn-secondary flex-1 h-8 px-3 text-[12px]">
                    <Pencil size={13} strokeWidth={2.1} className="text-[#6E6E73] dark:text-[#98989D]" />
                    <span>Editează</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.07]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">Nume brand</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="apple-input w-full text-[13px]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">Descriere</label>
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="apple-input w-full text-[13px] resize-y" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">Website</label>
                    <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://smashme.ro" type="url" className="apple-input w-full text-[13px]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">Logo URL</label>
                    <input value={form.logo_url} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://cdn.example.com/logo.png" type="url" className="apple-input w-full text-[13px]" />
                  </div>
                  {form.logo_url && (
                    <div className="h-14 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center p-2">
                      <img src={form.logo_url} alt="Preview" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setEditing(null)} className="apple-btn-secondary flex-1 h-9 px-3 text-[12.5px]">
                      Anulează
                    </button>
                    <button type="button" onClick={saveEdit} disabled={saving} className="apple-btn-primary flex-1 h-9 px-3 text-[12.5px]">
                      {saving ? 'Se salvează...' : 'Salvează'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-[#1C1C1E] dark:bg-[#2C2C2E] text-white px-5 py-2.5 rounded-full text-[13px] font-medium shadow-2xl border border-white/10 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className={`w-2 h-2 rounded-full ${toast.type === 'error' ? 'bg-[#FF3B30]' : 'bg-[#34C759]'}`} />
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
