import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { proxySyrveImage } from '../utils/imageUtils.js';
import './ManagerPortalModal.css';

const BRAND_COLORS = {
  smashme: '#ef4444',
  crunch: '#eab308',
  rollmaster: '#3b82f6',
  lovesushi: '#ec4899',
  sushimaster: '#e31e24',
  ikura: '#8b5cf6',
  welovesushi: '#ec4899',
  pokiwoki: '#f97316'
};

const BRAND_LOGOS = {
  smashme: '/brands/smashme-logo.png',
  crunch: '/brands/crunch-logo.png',
  rollmaster: '/brands/rollmaster-logo.png',
  lovesushi: '/brands/rollmaster-logo.png',
  sushimaster: '/brands/rollmaster-logo.png',
  ikura: '/brands/rollmaster-logo.png',
  welovesushi: '/brands/rollmaster-logo.png',
  pokiwoki: '/brands/smashme-logo.png'
};

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toFixed(2);
}

const CLOUD_BACKEND = 'https://smart-kiosk-v7ws.onrender.com';

export default function ManagerPortalModal({ locationData, onClose, isStandalone = false }) {
  const localBackend = import.meta.env.VITE_BACKEND_URL || CLOUD_BACKEND;

  // Active Tab: 'orders' | 'logs' | 'status'
  const [activeTab, setActiveTab] = useState('orders');

  // PIN Authentication State: daca nu este codul setat in kiosk, intra direct cu comenzile
  const configuredPin = String(locationData?.kioskPin || '').trim();
  const hasPinConfigured = Boolean(configuredPin && configuredPin !== '1234');
  const [isAuthenticated, setIsAuthenticated] = useState(!hasPinConfigured);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState('');
  const pinInputRef = useRef(null);

  useEffect(() => {
    const p = String(locationData?.kioskPin || '').trim();
    if (!p || p === '1234') {
      setIsAuthenticated(true);
    }
  }, [locationData?.kioskPin]);

  // Deschide tastatura doar pe telefon / mod standalone (?manager=true) daca se cere PIN
  useEffect(() => {
    if (isStandalone && !isAuthenticated) {
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isStandalone, isAuthenticated]);

  // Kiosk Logs State
  const [kioskLogs, setKioskLogs] = useState([]);
  const [kioskLogsLoading, setKioskLogsLoading] = useState(false);

  // Orders State
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null); // Popup modal for order detail

  // Status Filter: 'all' | 'success' | 'error'
  const [statusFilter, setStatusFilter] = useState('all');

  // Quick Period Buttons: 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom'
  const todayStr = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState('today');
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

  const [search, setSearch] = useState('');
  const [showRevenue, setShowRevenue] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [retryingId, setRetryingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Dynamic Hero Rotation Interval (in seconds)
  const [heroInterval, setHeroInterval] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('kiosk_hero_interval') : null;
    return saved ? Number(saved) : (Number(locationData?.categoryHeroInterval) || 5);
  });

  const handleUpdateHeroInterval = async (sec) => {
    const val = Math.max(2, Math.min(60, Number(sec) || 5));
    setHeroInterval(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kiosk_hero_interval', String(val));
      window.dispatchEvent(new Event('kiosk_hero_interval_changed'));
    }
    showToast(`⏱ Viteză rotație banner: ${val} secunde`);

    if (locationData?.id) {
      try {
        await fetch(`${localBackend}/api/locations/${locationData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_API_KEY || 'sk-live-2024-secure'
          },
          body: JSON.stringify({ categoryHeroInterval: val })
        });
      } catch (err) {
        console.warn('Eroare sincronizare viteză banner către server:', err);
      }
    }
  };

  // Ieșire automată din fullscreen la accesarea portalului manager
  useEffect(() => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      try {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } catch (_) {}
    }
  }, []);

  const sendLog = async (eventType, role) => {
    try {
      await fetch(`${localBackend}/api/kiosk-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: locationData?.id || '',
          locationName: locationData?.name || '',
          kioskId: localStorage.getItem('kiosk_device_id') || 'kiosk-main',
          eventType,
          role,
          details: { screen: 'manager_portal', timestamp: new Date().toISOString() }
        })
      });
    } catch (e) {
      console.warn('[ManagerPortal] Log error:', e.message);
    }
  };

  // PIN Keypad Handlers
  const verifyPin = (entered) => {
    const configuredPin = String(locationData?.kioskPin || '').trim();
    const isConfigured = configuredPin && entered === configuredPin;

    if (!configuredPin || isConfigured) {
      setIsAuthenticated(true);
      sendLog('manager_portal_access', 'manager');
    } else {
      setPinError(true);
      setPinErrorMessage('PIN incorect.');
      setPin('');
      sendLog('manager_portal_failed', 'unknown');
    }
  };

  const handlePinKey = (char) => {
    if (pin.length < 4) {
      const next = pin + char;
      setPin(next);
      setPinError(false);
      setPinErrorMessage('');
      if (next.length === 4) {
        verifyPin(next);
      }
    }
  };

  const handlePinDel = () => {
    setPin(prev => prev.slice(0, -1));
    setPinError(false);
    setPinErrorMessage('');
  };

  const handlePinSubmit = () => {
    if (pin.length === 4) {
      verifyPin(pin);
    }
  };

  // Fetch orders with automatic cloud fallback
  const fetchOrders = async () => {
    setLoading(true);
    let loadedOrders = [];

    // 1. Try local backend
    try {
      const res = await fetch(`${localBackend}/api/orders?limit=300`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) loadedOrders = data;
        else if (Array.isArray(data.orders)) loadedOrders = data.orders;
      }
    } catch (err) {
      console.warn('[ManagerPortal] Local backend fetch failed, trying cloud...', err.message);
    }

    // 2. If local backend returned 0 orders, fallback to Cloud
    if (loadedOrders.length === 0 && localBackend !== CLOUD_BACKEND) {
      try {
        const resCloud = await fetch(`${CLOUD_BACKEND}/api/orders?limit=300`);
        if (resCloud.ok) {
          const dataCloud = await resCloud.json();
          if (Array.isArray(dataCloud)) loadedOrders = dataCloud;
          else if (Array.isArray(dataCloud.orders)) loadedOrders = dataCloud.orders;
        }
      } catch (errCloud) {
        console.error('[ManagerPortal] Cloud backend fetch error:', errCloud);
      }
    }

    setAllOrders(loadedOrders);
    setLoading(false);
  };

  // Fetch kiosk security / unlock logs
  const fetchKioskLogs = async () => {
    setKioskLogsLoading(true);
    const locId = locationData?.id || locationData?.kioskUrl || '';
    try {
      const res = await fetch(`${localBackend}/api/kiosk-logs?limit=150${locId ? `&locationId=${encodeURIComponent(locId)}` : ''}`);
      if (res.ok) {
        const d = await res.json();
        setKioskLogs(d.logs || []);
      }
    } catch (e) {
      console.warn('[ManagerPortal] Failed to fetch kiosk logs:', e.message);
    } finally {
      setKioskLogsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
      fetchKioskLogs();

      const socket = io(localBackend, { transports: ['websocket', 'polling'] });
      socket.on('order_created', (newOrder) => {
        if (!newOrder) return;
        setAllOrders(prev => [newOrder, ...prev.filter(o => (o._id || o.id) !== (newOrder._id || newOrder.id))]);
        showToast(`Comandă nouă: #${newOrder.orderNumber}`);
      });
      socket.on('order_status_updated', (updated) => {
        if (!updated) return;
        setAllOrders(prev => prev.map(o => (o._id || o.id) === (updated._id || updated.id) ? { ...o, ...updated } : o));
      });
      socket.on('kiosk_log_new', (log) => {
        if (!log) return;
        setKioskLogs(prev => [log, ...prev]);
      });

      return () => socket.disconnect();
    }
  }, [isAuthenticated, localBackend, locationData?.id]);

  // Retry sending to Syrve/iiko
  const handleRetrySyrve = async (order, e) => {
    if (e) e.stopPropagation();
    const orderId = order._id || order.orderNumber || order.id;
    if (!orderId) return;

    setRetryingId(orderId);
    try {
      const activeEndpoint = localBackend || CLOUD_BACKEND;
      const res = await fetch(`${activeEndpoint}/api/orders/${encodeURIComponent(orderId)}/retry`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Comanda #${order.orderNumber || orderId} a fost transmisă în Syrve!`);
        fetchOrders();
        if (selectedOrder && (selectedOrder._id === order._id || selectedOrder.orderNumber === order.orderNumber)) {
          setSelectedOrder(prev => ({ ...prev, syrveOrderId: data.syrveOrderId || 'Confirmat' }));
        }
      } else {
        alert(`Eroare retrimitere Syrve: ${data.error || 'Necunoscută'}`);
      }
    } catch (err) {
      alert(`Eroare: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  // Cancel order (Refuz POS)
  const handleCancelOrder = async (order, e) => {
    if (e) e.stopPropagation();
    const orderId = order._id || order.id;
    if (!confirm(`Sigur doriți să anulați comanda #${order.orderNumber}?`)) return;

    try {
      const activeEndpoint = localBackend || CLOUD_BACKEND;
      const res = await fetch(`${activeEndpoint}/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', canceledBy: 'manager_kiosk' })
      });
      if (res.ok) {
        showToast(`Comanda #${order.orderNumber} a fost anulată.`);
        fetchOrders();
        if (selectedOrder && (selectedOrder._id === order._id || selectedOrder.orderNumber === order.orderNumber)) {
          setSelectedOrder(prev => ({ ...prev, status: 'cancelled' }));
        }
      }
    } catch (err) {
      alert(`Eroare la anulare: ${err.message}`);
    }
  };

  const copyText = (text, e) => {
    if (e) e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('Copiat în clipboard!');
  };

  const formatDateISO = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSelectPeriod = (p) => {
    setPeriod(p);
    setCurrentPage(1);

    const now = new Date();

    if (p === 'today') {
      const s = formatDateISO(now);
      setCustomStart(s);
      setCustomEnd(s);
    } else if (p === 'yesterday') {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const s = formatDateISO(y);
      setCustomStart(s);
      setCustomEnd(s);
    } else if (p === 'this_week') {
      const dayOfWeek = now.getDay() || 7; // Luni = 1, Duminică = 7
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
      const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
      setCustomStart(formatDateISO(monday));
      setCustomEnd(formatDateISO(sunday));
    } else if (p === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setCustomStart(formatDateISO(first));
      setCustomEnd(formatDateISO(last));
    } else if (p === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setCustomStart(formatDateISO(first));
      setCustomEnd(formatDateISO(last));
    } else if (p === 'all') {
      let earliest = new Date(now.getFullYear(), 0, 1);
      if (allOrders && allOrders.length > 0) {
        const dates = allOrders.map(o => o.createdAt ? new Date(o.createdAt).getTime() : null).filter(Boolean);
        if (dates.length > 0) {
          earliest = new Date(Math.min(...dates));
        }
      }
      setCustomStart(formatDateISO(earliest));
      setCustomEnd(formatDateISO(now));
    }
  };

  // Date in Period Helper
  const isDateInPeriod = (dateStr, p) => {
    if (p === 'all') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);

    if (customStart) {
      const [sy, sm, sd] = customStart.split('-').map(Number);
      const startD = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      if (d < startD) return false;
    }
    if (customEnd) {
      const [ey, em, ed] = customEnd.split('-').map(Number);
      const endD = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      if (d > endD) return false;
    }
    return true;
  };

  // Location filtering
  const locationOrders = useMemo(() => {
    const locId = String(locationData?.id || '').toLowerCase();
    const locName = String(locationData?.name || '').toLowerCase();
    const kioskUrl = String(locationData?.kioskUrl || '').toLowerCase();
    const aliases = (locationData?.aliases || []).map(a => String(a).toLowerCase());

    return allOrders.filter(o => {
      const oLocId = String(o.locationId || o.location_id || '').toLowerCase();
      const oLocName = String(o.locationName || '').toLowerCase();

      if (!locId && !locName && !kioskUrl) return true;

      if (locId && oLocId === locId) return true;
      if (kioskUrl && oLocId === kioskUrl) return true;
      if (locName && oLocName === locName) return true;
      if (aliases.includes(oLocId)) return true;

      if (locName.includes('smashme') && (oLocName.includes('smashme') || oLocId.includes('smashme') || oLocId.includes('cluj'))) {
        return true;
      }

      return false;
    });
  }, [allOrders, locationData]);

  // Period filtered orders (used for Stat Cards)
  const periodFilteredOrders = useMemo(() => {
    return locationOrders.filter(o => {
      const d = o.createdAt || o.date || o.arrivedAt || o.timestamp;
      return isDateInPeriod(d, period);
    });
  }, [locationOrders, period, customStart, customEnd]);

  // Label for active period on stat cards
  const periodLabel = useMemo(() => {
    if (period === 'today') return 'Azi';
    if (period === 'yesterday') return 'Ieri';
    if (period === 'this_week') return 'Săpt. curentă';
    if (period === 'this_month') return 'Luna curentă';
    if (period === 'last_month') return 'Luna trecută';
    if (period === 'custom') return `${customStart} - ${customEnd}`;
    return 'Toate';
  }, [period, customStart, customEnd]);

  // Stat Cards Metrics
  const stats = useMemo(() => {
    const totalCount = periodFilteredOrders.length;
    let successCount = 0;
    let errorCount = 0;
    let totalRevenue = 0;

    periodFilteredOrders.forEach(o => {
      const isOk = Boolean(o.syrveOrderId);
      if (isOk) successCount++;
      else if (o.status !== 'cancelled') errorCount++;

      if (o.status !== 'cancelled') {
        totalRevenue += Number(o.totalAmount || o.total || 0);
      }
    });

    return { totalCount, successCount, errorCount, totalRevenue };
  }, [periodFilteredOrders]);

  // Final filtered list for table
  const finalOrders = useMemo(() => {
    return periodFilteredOrders.filter(o => {
      if (statusFilter === 'success' && !o.syrveOrderId) return false;
      if (statusFilter === 'error' && (o.syrveOrderId || o.status === 'cancelled')) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const num = String(o.orderNumber || '').toLowerCase();
        const brand = String(o.brand || '').toLowerCase();
        const syrve = String(o.syrveOrderId || '').toLowerCase();
        const items = (o.items || []).map(i => i.name).join(' ').toLowerCase();
        if (!num.includes(q) && !brand.includes(q) && !syrve.includes(q) && !items.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [periodFilteredOrders, statusFilter, search]);

  // Pagination
  const totalPages = Math.ceil(finalOrders.length / itemsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return finalOrders.slice(start, start + itemsPerPage);
  }, [finalOrders, currentPage, itemsPerPage]);

  // Helper for Card/POS status
  const getPaymentBadge = (o) => {
    const method = String(o.paymentMethod || '').toLowerCase();
    const isCancelled = o.status === 'cancelled';

    if (method === 'cash') {
      return (
        <span className="mgr-badge mgr-badge-cash">
          Cash
        </span>
      );
    }

    if (isCancelled) {
      return (
        <span className="mgr-badge mgr-badge-error">
          ✕ Refuz POS
        </span>
      );
    }

    // Default card with paymentRef or confirmed
    if (o.paymentRef?.authCode || o.paymentRef?.receiptNo || o.status === 'paid' || o.syrveOrderId) {
      return (
        <span className="mgr-badge mgr-badge-success">
          ✓ Card OK
        </span>
      );
    }

    return (
      <span className="mgr-badge mgr-badge-warning">
        ⏳ Card POS
      </span>
    );
  };

  // Helper for iiko status
  const getIikoBadge = (o) => {
    if (o.syrveOrderId) {
      return (
        <span className="mgr-badge mgr-badge-success">
          ✓ iiko OK
        </span>
      );
    }

    return (
      <span className="mgr-badge mgr-badge-error">
        ✕ Eroare iiko
      </span>
    );
  };

const KIOSK_EVENT_META = {
  unlock_manager: {
    label: 'Deblocat PIN Manager',
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0'
  },
  unlock_vendor: {
    label: 'Deblocat PIN Vânzător',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe'
  },
  unlock_failed: {
    label: 'Tentativă PIN Eșuată',
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fecaca'
  },
  auto_lock: {
    label: 'Blocat Automat (Orar Noapte)',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a'
  },
  auto_unlock: {
    label: 'Deblocat Automat (Final Orar)',
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc'
  },
  manager_portal_access: {
    label: 'Conectare Portal Manager',
    color: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe'
  }
};

  // If NOT authenticated, render PIN Keypad
  if (!isAuthenticated) {
    return (
      <div className={`mgr-modal-backdrop mgr-pin-backdrop ${isStandalone ? 'mgr-standalone' : ''}`} onClick={isStandalone ? undefined : onClose}>
        <div className="mgr-pin-box" onClick={e => e.stopPropagation()}>
          {!isStandalone ? (
            <button className="mgr-pin-close-btn" onClick={onClose} aria-label="Închide">✕</button>
          ) : (
            <button 
              className="mgr-pin-close-btn" 
              onClick={() => window.location.reload()} 
              title="Reîmprospătează pagina"
              aria-label="Refresh"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          )}

          <div className="mgr-pin-icon-wrapper">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 className="mgr-pin-title">Portal Manager Kiosk</h2>
          <p className="mgr-pin-subtitle">
            {locationData?.name ? <strong>{locationData.name}<br /></strong> : null}
            Introduceți codul PIN de Manager pentru acces securizat
          </p>

          <div 
            className={`mgr-pin-dots ${pinError ? 'mgr-pin-dots-error' : ''}`}
            onClick={() => isStandalone && pinInputRef.current?.focus()}
          >
            {/* Input nativ exclusiv cand se acceseaza linkul de manager de pe telefon (?manager=true) */}
            {isStandalone && (
              <input
                ref={pinInputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                autoComplete="one-time-code"
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(val);
                  setPinError(false);
                  setPinErrorMessage('');
                  if (val.length === 4) {
                    verifyPin(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pin.length === 4) {
                    verifyPin(pin);
                  }
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  zIndex: 3,
                  cursor: 'pointer'
                }}
                aria-label="Cod PIN Manager"
              />
            )}
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                className={`mgr-pin-dot ${idx < pin.length ? 'filled' : ''}`}
              />
            ))}
          </div>

          {pinErrorMessage && (
            <div className="mgr-pin-error-text">{pinErrorMessage}</div>
          )}

          <div className="mgr-pin-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button
                key={n}
                type="button"
                className="mgr-pin-num-btn"
                onClick={() => handlePinKey(String(n))}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="mgr-pin-num-btn mgr-pin-action-btn"
              onClick={handlePinDel}
            >
              ⌫
            </button>
            <button
              type="button"
              className="mgr-pin-num-btn"
              onClick={() => handlePinKey('0')}
            >
              0
            </button>
            <button
              type="button"
              className="mgr-pin-num-btn mgr-pin-ok-btn"
              onClick={handlePinSubmit}
            >
              OK
            </button>
          </div>

          {isStandalone && (
            <div style={{ marginTop: 20, fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>GetApp Smart Kiosk</span>
              <span>•</span>
              <span>Acces Securizat Mobil</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Full Manager Portal
  return (
    <div className={`mgr-modal-backdrop ${isStandalone ? 'mgr-standalone' : ''}`} onClick={isStandalone ? undefined : onClose}>
      <div className="mgr-portal-container" onClick={e => e.stopPropagation()}>
        {/* Toast */}
        {toastMessage && (
          <div className="mgr-portal-toast">{toastMessage}</div>
        )}

        {/* Header */}
        <div className="mgr-portal-header">
          <div className="mgr-header-left">
            <div className="mgr-brand-header-box">
              <img
                src="/getapp_smart_kiosk_logo.png"
                alt="GetApp Smart Kiosk"
                className="mgr-brand-logo-img"
              />
              <span className="mgr-brand-url">www.getapp.ro</span>
            </div>
          </div>

          <div className="mgr-header-right">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'orders') fetchOrders();
                else if (activeTab === 'logs') fetchKioskLogs();
              }}
              className={`mgr-btn-refresh ${loading || kioskLogsLoading ? 'mgr-btn-refresh-spinning' : ''}`}
              title="Reîmprospătează lista"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Actualizează</span>
            </button>

            {isStandalone ? (
              <button
                type="button"
                onClick={() => setIsAuthenticated(false)}
                className="mgr-btn-logout"
                title="Deconectare de la sesiune"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Deconectare</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="mgr-btn-close"
                title="Închide panoul"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs (vizibile doar pe chioscul fizic, ascunse pe link-ul manager mobil) */}
        {!isStandalone && (
          <div className="mgr-nav-tabs">
            <button
              type="button"
              className={`mgr-nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Comenzi & Syrve</span>
              <span className="mgr-nav-badge">{finalOrders.length}</span>
            </button>

            <button
              type="button"
              className={`mgr-nav-tab ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => { setActiveTab('logs'); fetchKioskLogs(); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Loguri Kiosk (PIN)</span>
              <span className="mgr-nav-badge">{kioskLogs.length}</span>
            </button>

            <button
              type="button"
              className={`mgr-nav-tab ${activeTab === 'status' ? 'active' : ''}`}
              onClick={() => setActiveTab('status')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Stare Kiosk & Orar</span>
              <span className={`mgr-nav-dot ${locationData?.lockScheduleActive ? 'dot-active' : ''}`} />
            </button>
          </div>
        )}

        {/* ─── TAB 1: COMENZI & SYRVE ─── */}
        {activeTab === 'orders' && (
          <div className="mgr-tab-content mgr-orders-tab">
            {/* Stat Cards - Reflecting EXACT Selected Period */}
            <div className="mgr-stats-grid">
          <div className="mgr-stat-card">
            <div className="mgr-stat-info">
              <span className="mgr-stat-label">Total Comenzi ({periodLabel})</span>
              <span className="mgr-stat-value">{stats.totalCount}</span>
            </div>
            <div className="mgr-stat-icon-wrapper mgr-stat-icon-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
          </div>

          <div className="mgr-stat-card">
            <div className="mgr-stat-info">
              <span className="mgr-stat-label">Succes Syrve / iiko ({periodLabel})</span>
              <span className="mgr-stat-value mgr-val-green">{stats.successCount}</span>
            </div>
            <div className="mgr-stat-icon-wrapper mgr-stat-icon-green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <div className="mgr-stat-card">
            <div className="mgr-stat-info">
              <span className="mgr-stat-label">Erori / În așteptare ({periodLabel})</span>
              <span className="mgr-stat-value mgr-val-red">{stats.errorCount}</span>
            </div>
            <div className="mgr-stat-icon-wrapper mgr-stat-icon-red">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>

          <div className="mgr-stat-card">
            <div className="mgr-stat-info">
              <span className="mgr-stat-label">Total Încasat ({periodLabel})</span>
              <div className="mgr-revenue-wrapper">
                <span className="mgr-stat-value mgr-val-dark">
                  {showRevenue ? `${formatCurrency(stats.totalRevenue)} lei` : '•••••• lei'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowRevenue(prev => !prev)}
                  className="mgr-eye-btn"
                  title={showRevenue ? 'Ascunde suma încasată' : 'Afișează suma încasată'}
                >
                  {showRevenue ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="mgr-stat-icon-wrapper mgr-stat-icon-gray">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter Toolbar: Status Pills + Quick Period Buttons + Custom Date Picker */}
        <div className="mgr-filter-toolbar">
          <div className="mgr-filter-left">
            {/* Status Pills */}
            <div className="mgr-btn-group">
              <button
                type="button"
                onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                className={`mgr-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
              >
                Toate
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('success'); setCurrentPage(1); }}
                className={`mgr-pill-btn ${statusFilter === 'success' ? 'active' : ''}`}
              >
                ✓ Succes
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('error'); setCurrentPage(1); }}
                className={`mgr-pill-btn ${statusFilter === 'error' ? 'active' : ''}`}
              >
                ✕ Erori
              </button>
            </div>

            <div className="mgr-filter-divider" />

            {/* Quick Period Buttons */}
            <div className="mgr-btn-group">
              <button
                type="button"
                onClick={() => handleSelectPeriod('all')}
                className={`mgr-pill-btn ${period === 'all' ? 'active' : ''}`}
              >
                Toate
              </button>
              <button
                type="button"
                onClick={() => handleSelectPeriod('today')}
                className={`mgr-pill-btn ${period === 'today' ? 'active' : ''}`}
              >
                Azi
              </button>
              <button
                type="button"
                onClick={() => handleSelectPeriod('yesterday')}
                className={`mgr-pill-btn ${period === 'yesterday' ? 'active' : ''}`}
              >
                Ieri
              </button>
              <button
                type="button"
                onClick={() => handleSelectPeriod('this_week')}
                className={`mgr-pill-btn ${period === 'this_week' ? 'active' : ''}`}
              >
                Săptămâna curentă
              </button>
              <button
                type="button"
                onClick={() => handleSelectPeriod('this_month')}
                className={`mgr-pill-btn ${period === 'this_month' ? 'active' : ''}`}
              >
                Luna curentă
              </button>
              <button
                type="button"
                onClick={() => handleSelectPeriod('last_month')}
                className={`mgr-pill-btn ${period === 'last_month' ? 'active' : ''}`}
              >
                Luna trecută
              </button>
            </div>

            {/* Ferestre active permanente pentru interval de date */}
            <div className="mgr-custom-dates">
              <input
                type="date"
                value={customStart}
                onChange={e => { setCustomStart(e.target.value); setPeriod('custom'); setCurrentPage(1); }}
                className={`mgr-date-input ${period === 'custom' ? 'mgr-date-input-active' : ''}`}
                title="De la data"
              />
              <span className="mgr-date-sep">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => { setCustomEnd(e.target.value); setPeriod('custom'); setCurrentPage(1); }}
                className={`mgr-date-input ${period === 'custom' ? 'mgr-date-input-active' : ''}`}
                title="Până la data"
              />
            </div>
          </div>

          {/* Search Box */}
          <div className="mgr-search-wrapper">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Caută..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            />
            {search && (
              <button className="mgr-search-clear-btn" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>

        {/* Mobile Cards View (< 768px) */}
        <div className="mgr-mobile-cards-list">
          {paginatedOrders.length === 0 ? (
            <div className="mgr-empty-mobile">
              {loading ? 'Se încarcă comenzile...' : 'Nicio comandă găsită în perioada selectată.'}
            </div>
          ) : (
            paginatedOrders.map((o, idx) => {
              const brandKey = String(o.brand || 'smashme').toLowerCase();
              const brandLogo = BRAND_LOGOS[brandKey] || '/brands/smashme-logo.png';
              const itemsSummary = (o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
              const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '';
              const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }) : '';

              return (
                <div
                  key={o._id || o.id || o.orderNumber || idx}
                  className="mgr-m-card"
                  onClick={() => setSelectedOrder(o)}
                >
                  <div className="mgr-m-card-header">
                    <div className="mgr-m-card-id-wrap">
                      <span className="mgr-m-card-id">#{o.orderNumber}</span>
                      <span className="mgr-m-card-time">{dateStr} {timeStr}</span>
                    </div>
                    <div className="mgr-m-card-badges">
                      {getIikoBadge(o)}
                    </div>
                  </div>

                  <div className="mgr-m-card-body">
                    <div className="mgr-m-card-items-text">
                      {itemsSummary || 'Comandă fără detalii'}
                    </div>
                  </div>

                  <div className="mgr-m-card-footer">
                    <div className="mgr-m-card-brand">
                      <img src={brandLogo} alt="" className="mgr-m-brand-img" onError={e => e.target.style.display = 'none'} />
                      <span>{o.brand || 'SmashMe'}</span>
                      <span className="mgr-m-dot">•</span>
                      <span>{o.orderType === 'dine-in' ? (o.tableNumber ? `Masa ${o.tableNumber}` : 'La masă') : 'La pachet'}</span>
                    </div>
                    <div className="mgr-m-card-right-sum">
                      <span className="mgr-m-card-sum">{formatCurrency(o.totalAmount || o.total)} lei</span>
                      {getPaymentBadge(o)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Data Table with distinct Plată / POS and Status iiko columns */}
        <div className="mgr-table-container">
          <table className="mgr-data-table">
            <thead>
              <tr>
                <th className="th-nr">Nr.</th>
                <th className="th-date">Data / Ora</th>
                <th className="th-id"># Comandă</th>
                <th className="th-brand">Brand</th>
                <th className="th-items">Ce s-a comandat</th>
                <th className="th-sum">Total</th>
                <th className="th-payment">Plată / POS</th>
                <th className="th-iiko">Status iiko</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="mgr-empty-row">
                    {loading ? 'Se încarcă comenzile...' : 'Nicio comandă găsită în perioada selectată.'}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o, idx) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                  const itemsCount = (o.items || []).length;
                  const itemsSummary = (o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
                  const brandKey = String(o.brand || 'smashme').toLowerCase();
                  const brandLogo = BRAND_LOGOS[brandKey] || '/brands/smashme-logo.png';

                  return (
                    <tr
                      key={o._id || o.id || o.orderNumber || idx}
                      className="mgr-tr-row"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <td className="td-nr">{rowNumber}</td>
                      <td className="td-date">
                        <div className="mgr-date-stack">
                          <span className="mgr-date-main">
                            {o.createdAt ? new Date(o.createdAt).toLocaleDateString('ro-RO') : '—'}
                          </span>
                          <span className="mgr-date-sub">
                            {o.createdAt ? new Date(o.createdAt).toLocaleTimeString('ro-RO') : ''}
                          </span>
                        </div>
                      </td>
                      <td className="td-id">
                        <button
                          type="button"
                          className="mgr-order-num-link"
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(o); }}
                        >
                          #{o.orderNumber}
                        </button>
                      </td>
                      <td className="td-brand">
                        <div className="mgr-brand-badge">
                          <img src={brandLogo} alt={o.brand} className="mgr-brand-img" onError={e => e.target.style.display = 'none'} />
                          <span className="mgr-brand-txt">{o.brand}</span>
                        </div>
                      </td>
                      <td className="td-items">
                        <div className="mgr-items-preview">
                          <span className="mgr-items-main" title={itemsSummary}>
                            {itemsSummary || '—'}
                          </span>
                          <span className="mgr-items-meta">
                            {itemsCount} buc · {o.orderType === 'dine-in' ? (o.tableNumber ? `Masa ${o.tableNumber}` : 'La masă') : 'La pachet'}
                          </span>
                        </div>
                      </td>
                      <td className="td-sum">
                        <span className="mgr-sum-main">{formatCurrency(o.totalAmount || o.total)} lei</span>
                      </td>
                      <td className="td-payment">
                        {getPaymentBadge(o)}
                      </td>
                      <td className="td-iiko">
                        {getIikoBadge(o)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="mgr-table-footer">
          <div className="mgr-footer-left">
            <span>Afișează</span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="mgr-footer-select"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={300}>Toate</option>
            </select>
            <span>Total înregistrări: <strong>{finalOrders.length}</strong></span>
          </div>

          <div className="mgr-footer-right">
            <span>Pagina {currentPage} din {totalPages}</span>
            <div className="mgr-pager-buttons">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="mgr-pager-btn"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="mgr-pager-btn"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="mgr-pager-btn"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="mgr-pager-btn"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

        {/* ─── TAB 2: LOGURI KIOSK (PIN & SECURITATE) ─── */}
        {activeTab === 'logs' && (
          <div className="mgr-tab-content mgr-logs-tab">
            <div className="mgr-logs-header">
              <div className="mgr-logs-stats">
                <div className="mgr-logs-stat-pill">
                  <span className="mgr-logs-stat-num">{kioskLogs.filter(l => l.event_type === 'unlock_manager').length}</span>
                  <span className="mgr-logs-stat-text">Deblocări Manager</span>
                </div>
                <div className="mgr-logs-stat-pill">
                  <span className="mgr-logs-stat-num">{kioskLogs.filter(l => l.event_type === 'unlock_vendor').length}</span>
                  <span className="mgr-logs-stat-text">Deblocări Vânzător</span>
                </div>
                <div className="mgr-logs-stat-pill">
                  <span className="mgr-logs-stat-num mgr-val-red">{kioskLogs.filter(l => l.event_type === 'unlock_failed').length}</span>
                  <span className="mgr-logs-stat-text">Încercări Eșuate</span>
                </div>
                <div className="mgr-logs-stat-pill">
                  <span className="mgr-logs-stat-num mgr-val-amber">{kioskLogs.filter(l => l.event_type === 'auto_lock' || l.event_type === 'auto_unlock').length}</span>
                  <span className="mgr-logs-stat-text">Orar Automat</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={fetchKioskLogs} 
                className={`mgr-btn-refresh ${kioskLogsLoading ? 'mgr-btn-refresh-spinning' : ''}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                <span>Reîncarcă Loguri</span>
              </button>
            </div>

            <div className="mgr-logs-scroll-area">
              {kioskLogsLoading && kioskLogs.length === 0 ? (
                <div className="mgr-logs-empty">Se încarcă logurile de securitate...</div>
              ) : kioskLogs.length === 0 ? (
                <div className="mgr-logs-empty">
                  Nu există încă evenimente de deblocare înregistrate pentru acest kiosk.
                </div>
              ) : (
                <div className="mgr-logs-list">
                  {kioskLogs.map((log) => {
                    const ev = KIOSK_EVENT_META[log.event_type] || {
                      label: log.event_type || 'Eveniment',
                      color: '#64748b',
                      bg: '#f1f5f9',
                      border: '#cbd5e1'
                    };
                    const dateStr = log.timestamp 
                      ? new Date(log.timestamp).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'medium' }) 
                      : '-';
                    const detailsStr = log.details 
                      ? (typeof log.details === 'object' ? (log.details.schedule || log.details.reason || log.details.screen || JSON.stringify(log.details)) : String(log.details)) 
                      : null;

                    return (
                      <div key={log.id} className="mgr-log-card">
                        <div className="mgr-log-card-left">
                          <span 
                            className="mgr-log-badge" 
                            style={{ backgroundColor: ev.bg, color: ev.color, borderColor: ev.border }}
                          >
                            {ev.label}
                          </span>
                          <span className="mgr-log-time">{dateStr}</span>
                        </div>
                        <div className="mgr-log-card-right">
                          <span className="mgr-log-role">
                            Rol: <strong>{log.role === 'manager' ? 'Manager' : log.role === 'vendor' ? 'Vânzător' : (log.role || 'Sistem')}</strong>
                          </span>
                          {detailsStr && (
                            <span className="mgr-log-details">{detailsStr}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: STARE KIOSK & ORAR BLOCARE ─── */}
        {activeTab === 'status' && (
          <div className="mgr-tab-content mgr-status-tab">
            <div className="mgr-status-grid">
              {/* Card Informații Kiosk */}
              <div className="mgr-status-card">
                <h3 className="mgr-status-card-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                  Informații Kiosk & Conexiune
                </h3>
                <div className="mgr-status-rows">
                  <div className="mgr-status-row">
                    <span className="mgr-status-label">Denumire Locație:</span>
                    <span className="mgr-status-val"><strong>{locationData?.name || '-'}</strong></span>
                  </div>
                  <div className="mgr-status-row">
                    <span className="mgr-status-label">Identificator URL:</span>
                    <span className="mgr-status-val font-mono">{locationData?.kioskUrl || locationData?.id || '-'}</span>
                  </div>
                  <div className="mgr-status-row">
                    <span className="mgr-status-label">Stare Conexiune:</span>
                    <span className="mgr-status-val mgr-badge-online">
                      <span className="mgr-live-dot" /> Online / Conectat
                    </span>
                  </div>
                  <div className="mgr-status-row">
                    <span className="mgr-status-label">Acces Manager Mobil:</span>
                    <span className={`mgr-status-val ${locationData?.remoteManagerEnabled !== false ? 'mgr-val-green' : 'mgr-val-red'}`}>
                      {locationData?.remoteManagerEnabled !== false ? 'Activ (Conectat)' : 'Dezactivat din Admin'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Securitate & Orar Blocare */}
              <div className="mgr-status-card">
                <h3 className="mgr-status-card-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Securitate & Orar Blocare
                </h3>
                <div className="mgr-status-rows">
                  <div className="mgr-status-row">
                    <span className="mgr-status-label">Blocare după Orar:</span>
                    <span className={`mgr-status-val ${locationData?.lockScheduleActive ? 'mgr-val-green' : 'mgr-val-dark'}`}>
                      {locationData?.lockScheduleActive ? 'ACTIVAT' : 'DEZACTIVAT'}
                    </span>
                  </div>
                  {locationData?.lockScheduleActive && (
                    <>
                      <div className="mgr-status-row">
                        <span className="mgr-status-label">Interval Blocare:</span>
                        <span className="mgr-status-val font-mono">
                          <strong>{locationData.lockStartTime || '22:00'}</strong> — <strong>{locationData.lockEndTime || '09:00'}</strong>
                        </span>
                      </div>
                      <div className="mgr-status-row">
                        <span className="mgr-status-label">Frecvență Aplicare:</span>
                        <span className="mgr-status-val">
                          {locationData.lockScheduleMode === 'custom' ? 'Zile selectate' : 'Zilnic (Luni - Duminică)'}
                        </span>
                      </div>
                      <div className="mgr-status-row">
                        <span className="mgr-status-label">Deblocare Automată:</span>
                        <span className="mgr-status-val">
                          {locationData.lockAutoUnlock !== false ? 'Activă la final de orar' : 'Doar manual cu PIN'}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="mgr-status-row">
                    <span className="mgr-status-label">PIN Manager:</span>
                    <span className="mgr-status-val mgr-val-green">Configurat (Activ)</span>
                  </div>
                  <div className="mgr-status-row">
                    <span className="mgr-status-label">PIN Vânzător:</span>
                    <span className="mgr-status-val">
                      {locationData?.vendorPin ? 'Configurat (Activ)' : 'Nu este configurat'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Setări Banner & Rotație Produse */}
              <div className="mgr-status-card">
                <h3 className="mgr-status-card-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Viteză Rotație Banner / Produse
                </h3>
                <div className="mgr-status-rows">
                  <div className="mgr-status-row">
                    <span className="mgr-status-label">Interval Rotație Curent:</span>
                    <span className="mgr-status-val mgr-val-green">
                      <strong>{heroInterval} secunde</strong>
                    </span>
                  </div>
                  <div className="mgr-status-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                    <span className="mgr-status-label">Alege rapid viteza (secunde):</span>
                    <div className="mgr-hero-presets">
                      {[3, 4, 5, 7, 10, 15].map(sec => (
                        <button
                          key={sec}
                          type="button"
                          className={`mgr-hero-preset-btn ${heroInterval === sec ? 'mgr-hero-preset-btn--active' : ''}`}
                          onClick={() => handleUpdateHeroInterval(sec)}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mgr-status-row">
                    <span className="mgr-status-label">Setare directă secunde (tastare sau +/-):</span>
                    <div className="mgr-hero-stepper">
                      <button 
                        type="button" 
                        className="mgr-hero-step-btn" 
                        onClick={() => handleUpdateHeroInterval(Math.max(2, heroInterval - 1))}
                        title="Scade cu 1 secundă"
                      >
                        −
                      </button>
                      <input 
                        type="number"
                        min="2"
                        max="60"
                        className="mgr-hero-num-input"
                        value={heroInterval}
                        onChange={e => handleUpdateHeroInterval(e.target.value)}
                      />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>sec</span>
                      <button 
                        type="button" 
                        className="mgr-hero-step-btn" 
                        onClick={() => handleUpdateHeroInterval(Math.min(60, heroInterval + 1))}
                        title="Crește cu 1 secundă"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── EXACT ORDER DETAIL POPUP WINDOW (Identic cu Panoul Comenzi Admin) ─── */}
      {selectedOrder && typeof document !== 'undefined' && createPortal(
        <div className="mgr-detail-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="mgr-detail-modal" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="mgr-detail-header">
              <div className="mgr-detail-header-left">
                <h2 className="mgr-detail-title">Comandă #{selectedOrder.orderNumber}</h2>
                <div className="mgr-detail-brand-pill">
                  <img
                    src={BRAND_LOGOS[String(selectedOrder.brand).toLowerCase()] || '/brands/smashme-logo.png'}
                    alt={selectedOrder.brand}
                    className="mgr-detail-brand-icon"
                  />
                  <span className="mgr-detail-brand-name" style={{ color: BRAND_COLORS[selectedOrder.brand] || '#0f172a' }}>
                    {selectedOrder.brand}
                  </span>
                </div>
              </div>

              <div className="mgr-detail-header-right">
                {selectedOrder.syrveOrderId ? (
                  <span className="mgr-badge mgr-badge-success">● Confirmată iiko</span>
                ) : (
                  <span className="mgr-badge mgr-badge-error">● Eroare Syrve</span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="mgr-detail-close-btn"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="mgr-detail-body">
              {/* Order Meta Information */}
              <div className="mgr-detail-meta-card">
                <div className="mgr-detail-meta-grid">
                  <div>
                    <strong>Canal:</strong> {selectedOrder.channel || 'kiosk'}
                  </div>
                  <div>
                    <strong>Tip Comandă:</strong> {selectedOrder.orderType === 'dine-in' ? (selectedOrder.tableNumber ? `La masă (Masa ${selectedOrder.tableNumber})` : 'La masă') : 'La pachet'}
                  </div>
                  <div className="mgr-detail-meta-plat">
                    <strong>Plată:</strong>
                    <span className="mgr-pay-type">{selectedOrder.paymentMethod === 'cash' ? 'CASH' : 'CARD'}</span>
                    {selectedOrder.paymentMethod === 'card' ? (
                      <span className="mgr-badge mgr-badge-success">✓ Aprobat POS</span>
                    ) : (
                      <span className="mgr-badge mgr-badge-warning">La Casă</span>
                    )}
                  </div>
                  <div>
                    <strong>Data/Ora:</strong> {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('ro-RO') : '—'}
                  </div>
                </div>

                {/* Fiscal Data if present */}
                {selectedOrder.fiscal && (
                  <div className="mgr-fiscal-box">
                    <div className="mgr-fiscal-title">BON FISCAL CU CUI</div>
                    <div className="mgr-fiscal-name">{selectedOrder.fiscal.name || '—'}</div>
                    <div className="mgr-fiscal-cui">
                      CUI: <strong>{selectedOrder.fiscal.rawCui || selectedOrder.fiscal.cui}</strong>
                      {selectedOrder.fiscal.regCom && <span> | Reg.Com: {selectedOrder.fiscal.regCom}</span>}
                      {selectedOrder.fiscal.isVatPayer && <span className="mgr-fiscal-vat">Plătitor TVA</span>}
                    </div>
                    {selectedOrder.fiscal.address && (
                      <div className="mgr-fiscal-addr">{selectedOrder.fiscal.address}</div>
                    )}
                  </div>
                )}

                {/* iiko Syrve Box & POS Receipt */}
                <div className="mgr-syrve-info-bar">
                  <div className="mgr-syrve-code-group">
                    <span className="mgr-syrve-label">ID COMANDĂ IIKO</span>
                    <span className="mgr-syrve-code select-all">
                      {selectedOrder.syrveOrderId || 'Netransmis în Syrve'}
                    </span>
                  </div>

                  {selectedOrder.paymentRef?.receiptNo && (
                    <div className="mgr-syrve-code-group">
                      <span className="mgr-syrve-label">NUMĂR BON POS</span>
                      <span className="mgr-syrve-code">{selectedOrder.paymentRef.receiptNo}</span>
                    </div>
                  )}

                  <div className="mgr-syrve-action-btns">
                    {selectedOrder.syrveOrderId && (
                      <button
                        type="button"
                        onClick={(e) => copyText(selectedOrder.syrveOrderId, e)}
                        className="mgr-btn-outline"
                      >
                        Copiază ID
                      </button>
                    )}

                    {!selectedOrder.syrveOrderId && (
                      <button
                        type="button"
                        onClick={(e) => handleRetrySyrve(selectedOrder, e)}
                        disabled={retryingId === (selectedOrder._id || selectedOrder.orderNumber)}
                        className="mgr-btn-primary"
                      >
                        {retryingId === (selectedOrder._id || selectedOrder.orderNumber) ? 'Se retrimite...' : 'Retrimite în Syrve'}
                      </button>
                    )}

                    {selectedOrder.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={(e) => handleCancelOrder(selectedOrder, e)}
                        className="mgr-btn-danger"
                      >
                        ✕ Anulează Comanda (Refuz POS)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Products Section with Large Clean Product Images */}
              <div className="mgr-products-section">
                <div className="mgr-products-section-header">
                  <h3 className="mgr-products-title">PRODUSE ({(selectedOrder.items || []).length})</h3>
                </div>

                <div className="mgr-products-list">
                  {(selectedOrder.items || []).map((it, idx) => {
                    const imgSrc = proxySyrveImage(it.imageUrl || it.image);

                    return (
                      <div key={idx} className="mgr-product-card">
                        <div className="mgr-product-idx">{idx + 1}.</div>
                        <div className="mgr-product-img-box">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={it.name}
                              className="mgr-product-img"
                              onError={e => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                                e.target.parentNode.innerHTML = '<span class="mgr-prod-fallback"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></span>';
                              }}
                            />
                          ) : (
                            <span className="mgr-prod-fallback">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8">
                                <rect x="3" y="3" width="18" height="18" rx="4" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            </span>
                          )}
                        </div>

                        <div className="mgr-product-info">
                          <h4 className="mgr-product-name">{it.name}</h4>
                          {Array.isArray(it.selectedModifiers) && it.selectedModifiers.length > 0 && (
                            <div className="mgr-product-mods">
                              {it.selectedModifiers.map(m => `+ *${m.optionName || m.modifierName || m.name}`).join(' · ')}
                            </div>
                          )}
                        </div>

                        <div className="mgr-product-pricing">
                          <span className="mgr-product-qty">{it.quantity}x</span>
                          <span className="mgr-product-price">
                            {formatCurrency((it.unitPrice !== undefined ? it.unitPrice : it.price) || 0)} lei
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Bar */}
              <div className="mgr-detail-total-bar">
                <span className="mgr-detail-total-title">TOTAL</span>
                <span className="mgr-detail-total-amount">
                  {formatCurrency(selectedOrder.totalAmount || selectedOrder.total || 0)} lei
                </span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
