import React, { useState, useEffect, useMemo } from 'react';
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

export default function ManagerPortalModal({ locationData, onClose }) {
  const localBackend = import.meta.env.VITE_BACKEND_URL || CLOUD_BACKEND;

  // PIN Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState('');

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
    const targetPin = configuredPin || '1234';

    if (entered === targetPin) {
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

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();

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

      return () => socket.disconnect();
    }
  }, [isAuthenticated, localBackend]);

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

  // If NOT authenticated, render PIN Keypad
  if (!isAuthenticated) {
    return (
      <div className="mgr-modal-backdrop" onClick={onClose}>
        <div className="mgr-pin-box" onClick={e => e.stopPropagation()}>
          <button className="mgr-pin-close-btn" onClick={onClose} aria-label="Închide">✕</button>

          <div className="mgr-pin-icon-wrapper">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          <h2 className="mgr-pin-title">Acces Manager Kiosk</h2>
          <p className="mgr-pin-subtitle">
            Introduceți codul PIN de Manager pentru acest Kiosk.
          </p>

          <div className={`mgr-pin-dots ${pinError ? 'mgr-pin-dots-error' : ''}`}>
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
        </div>
      </div>
    );
  }

  // Render Full Manager Portal
  return (
    <div className="mgr-modal-backdrop" onClick={onClose}>
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

            <div className="mgr-header-divider-v" />

            <div className="mgr-header-title-box">
              <div className="mgr-header-badge">
                <span className="mgr-live-dot" />
                Manager Conectat
              </div>
              <h1 className="mgr-portal-title">
                Registru Comenzi & Syrve
                <span className="mgr-location-label">— {locationData?.name || 'Locație'}</span>
              </h1>
            </div>
          </div>

          <div className="mgr-header-right">
            <button
              type="button"
              onClick={fetchOrders}
              className={`mgr-btn-refresh ${loading ? 'mgr-btn-refresh-spinning' : ''}`}
              title="Reîmprospătează lista"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Actualizează</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="mgr-btn-close"
              title="Închide panoul"
            >
              ✕
            </button>
          </div>
        </div>

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

      {/* ─── EXACT ORDER DETAIL POPUP WINDOW (Identic cu Panoul Comenzi Admin) ─── */}
      {selectedOrder && (
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
        </div>
      )}
    </div>
  );
}
