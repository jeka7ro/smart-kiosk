import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthProvider';
import { ChevronDown, ChevronUp, Copy, Search, Building2, Utensils, RefreshCw, FileText, CheckCircle2, XCircle, CreditCard, Banknote, ShieldCheck, AlertTriangle, Scale, X, Percent } from 'lucide-react';
import * as XLSX from 'xlsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { formatThousands } from '../utils/formatters';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const STATUS_CONFIG = {
  success: { label: 'Succes', color: '#10b981', bg: '#10b98120', icon: '✓' },
  error:   { label: 'Eroare', color: '#ef4444', bg: '#ef444420', icon: '✕' },
};

function getLogAmount(log) {
  if (!log) return null;
  if (log.totalAmount !== undefined && log.totalAmount !== null) return Number(log.totalAmount);
  if (log.amount !== undefined && log.amount !== null) return Number(log.amount);

  const payments = log.payload?.order?.payments;
  if (Array.isArray(payments) && payments.length > 0) {
    const sum = payments.reduce((acc, p) => acc + (Number(p.sum) || 0), 0);
    if (sum > 0) return sum;
  }

  const items = log.payload?.order?.items;
  if (Array.isArray(items) && items.length > 0) {
    const sum = items.reduce((acc, item) => {
      if (item.sum !== undefined && item.sum !== null) return acc + (Number(item.sum) || 0);
      const price = Number(item.price) || 0;
      const amount = Number(item.amount) || Number(item.quantity) || 1;
      return acc + (price * amount);
    }, 0);
    if (sum > 0) return sum;
  }

  if (log.payload?.totalAmount !== undefined && log.payload?.totalAmount !== null) {
    return Number(log.payload.totalAmount);
  }

  return null;
}

export function getSyrveAudit(log) {
  if (!log) {
    return {
      catalogGross: 0,
      discountSum: 0,
      paidSum: 0,
      balanceGap: 0,
      hasDiscount: false,
      isBalanced: true,
      hasUnsentDiscount: false,
      discounts: []
    };
  }

  const order = log.payload?.order || log.payload || {};
  let catalogGross = 0;
  const items = order.items || [];
  if (Array.isArray(items)) {
    items.forEach(it => {
      const q = Number(it.amount) || Number(it.quantity) || 1;
      let line = (Number(it.price) || 0) * q;
      if (Array.isArray(it.modifiers)) {
        it.modifiers.forEach(m => {
          line += (Number(m.price) || 0) * (Number(m.amount) || 1) * q;
        });
      }
      catalogGross += line;
    });
  }
  catalogGross = Math.round(catalogGross * 100) / 100;

  const discounts = order.discountsInfo?.discounts || [];
  const discountSum = Math.round(discounts.reduce((s, d) => s + (Number(d.sum) || 0), 0) * 100) / 100;

  const payments = order.payments || [];
  let paidSum = 0;
  if (Array.isArray(payments) && payments.length > 0) {
    paidSum = payments.reduce((s, p) => s + (Number(p.sum) || 0), 0);
  } else if (order.totalAmount !== undefined && order.totalAmount !== null) {
    paidSum = Number(order.totalAmount);
  } else if (log.totalAmount !== undefined && log.totalAmount !== null) {
    paidSum = Number(log.totalAmount);
  }
  paidSum = Math.round(paidSum * 100) / 100;

  const balanceGap = Math.round((catalogGross - discountSum - paidSum) * 100) / 100;
  const hasDiscount = discountSum > 0.01;
  const isBalanced = Math.abs(balanceGap) <= 0.05;
  const hasUnsentDiscount = !hasDiscount && balanceGap > 0.05;

  return {
    catalogGross,
    discountSum,
    paidSum,
    balanceGap,
    hasDiscount,
    isBalanced,
    hasUnsentDiscount,
    discounts
  };
}

export default function IikoLogs() {
  const { fetchWithAuth } = useAuth();
  const [logs, setLogs] = useState([]);
  const [ordersMap, setOrdersMap] = useState({});
  const [menuProducts, setMenuProducts] = useState({});
  const [menuImages, setMenuImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [search, setSearch] = useState('');
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(tomorrowStr);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [retryingId, setRetryingId] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditFilter, setAuditFilter] = useState('discrepancies_or_discounts');
  const [auditSearch, setAuditSearch] = useState('');

  const toggleBrand = (bId) => {
    const lower = String(bId).toLowerCase();
    setSelectedBrands(prev => {
      if (prev.includes(lower)) {
        return prev.filter(x => x !== lower);
      } else {
        return [...prev, lower];
      }
    });
    setCurrentPage(1);
  };

  const selectAllBrands = () => {
    setSelectedBrands([]);
    setCurrentPage(1);
  };

  const handleRetry = async (log, e) => {
    e.stopPropagation();
    const orderId = log.id || log.order_id;
    if (!orderId) return;
    setRetryingId(orderId);
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/orders/${encodeURIComponent(orderId)}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Comanda #${orderId} a fost retrimisă cu succes!\nSyrve ID: ${data.syrveOrderId}`);
        fetchLogs();
      } else {
        alert(`Eroare la retrimetere: ${data.error || JSON.stringify(data)}`);
      }
    } catch (err) {
      alert(`Eroare: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND}/api/iiko-logs`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : (data.logs || []));
    } catch (e) {
      console.error('Failed to load iiko logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Fetch orders to correlate with logs
    fetchWithAuth(`${BACKEND}/api/orders?limit=500`)
      .then(r => r.json())
      .then(d => {
        const ords = Array.isArray(d) ? d : (d.orders || []);
        const map = {};
        ords.forEach(o => {
          if (o.orderNumber) {
            map[String(o.orderNumber)] = o;
            map[String(o.orderNumber).replace(/^#/, '')] = o;
          }
          if (o._id) map[String(o._id)] = o;
          if (o.id) map[String(o.id)] = o;
          if (o.syrveOrderId) map[String(o.syrveOrderId)] = o;
        });
        setOrdersMap(map);
      })
      .catch(() => {});

    // Fetch menu products and overrides for rich details
    Promise.all([
      fetch(`${BACKEND}/api/menu/all`).then(r => r.json()).catch(() => ({})),
      fetch(`${BACKEND}/api/products/overrides/smashme`).then(r => r.json()).catch(() => ({})),
      fetch(`${BACKEND}/api/products/overrides/rollmaster`).then(r => r.json()).catch(() => ({})),
      fetch(`${BACKEND}/api/products/overrides/crunch`).then(r => r.json()).catch(() => ({}))
    ]).then(([allMenuData, ovSmash, ovRoll, ovCrunch]) => {
      const prodMap = {};
      Object.keys(allMenuData || {}).forEach(b => {
        const prods = allMenuData[b]?.menu?.products || [];
        prods.forEach(p => {
          if (p.id) prodMap[p.id] = p;
          if (p.name) prodMap[p.name.toLowerCase()] = p;
        });
      });
      setMenuProducts(prodMap);

      const imgMap = {};
      [ovSmash, ovRoll, ovCrunch].forEach(ovSet => {
        if (ovSet && typeof ovSet === 'object') {
          Object.entries(ovSet).forEach(([pid, val]) => {
            if (val?.imageUrl) imgMap[pid] = val.imageUrl;
          });
        }
      });
      setMenuImages(imgMap);
    }).catch(() => {});
  }, []);

  const getOrderDetails = (log) => {
    const rawId = String(log.id || log.order_id || log.orderId || '').trim();
    const cleanId = rawId.replace(/^#/, '').trim();
    const matched = ordersMap[cleanId] || ordersMap[rawId];

    let items = [];
    if (matched?.items && Array.isArray(matched.items) && matched.items.length > 0) {
      items = matched.items.map(it => {
        const fullP = menuProducts[it.productId] || (it.name && menuProducts[it.name.toLowerCase()]);
        const overrideImg = menuImages[it.productId];
        let imgSrc = overrideImg || it.imageUrl || (fullP?.imageLinks && fullP.imageLinks[0]) || fullP?.image || null;
        if (imgSrc && imgSrc.startsWith('/uploads')) imgSrc = `${BACKEND}${imgSrc}`;

        return {
          productId: it.productId,
          name: it.name || fullP?.name || 'Produs',
          quantity: it.quantity || 1,
          price: it.unitPrice !== undefined ? it.unitPrice : (it.price || 0),
          selectedModifiers: it.selectedModifiers || [],
          comment: it.comment,
          imageUrl: imgSrc
        };
      });
    } else {
      // Fallback from log.payload.order.items
      const payloadItems = log.payload?.order?.items || log.payload?.items || [];
      if (Array.isArray(payloadItems) && payloadItems.length > 0) {
        items = payloadItems.map(it => {
          const fullP = menuProducts[it.productId];
          const overrideImg = menuImages[it.productId];
          let imgSrc = overrideImg || (fullP?.imageLinks && fullP.imageLinks[0]) || fullP?.image || null;
          if (imgSrc && imgSrc.startsWith('/uploads')) imgSrc = `${BACKEND}${imgSrc}`;

          return {
            productId: it.productId,
            name: fullP?.name || it.name || `Produs (${String(it.productId).slice(0, 8)}...)`,
            quantity: it.amount || it.quantity || 1,
            price: it.price !== undefined ? it.price : (fullP?.price || 0),
            selectedModifiers: (it.modifiers || []).map(m => {
              const fullMod = menuProducts[m.productId];
              return {
                optionName: fullMod?.name || m.name || m.productId,
                price: m.price || 0
              };
            }),
            comment: it.comment,
            imageUrl: imgSrc
          };
        });
      }
    }

    const totalAmount = getLogAmount(log) || (matched?.totalAmount || 0);
    const orderType = matched?.orderType || (log.payload?.order?.comment?.includes('La masă') ? 'dine-in' : (log.payload?.order?.comment?.includes('La pachet') ? 'takeaway' : null));
    const tableNumber = matched?.tableNumber;
    let paymentMethod = matched?.paymentMethod;
    if (!paymentMethod) {
      if (matched?.paymentRef?.authCode || log.payload?.order?.comment?.includes('PLĂTIT')) {
        paymentMethod = 'card';
      } else if (log.payload?.order?.comment?.includes('Cash') || log.payload?.order?.comment?.includes('NEPLĂTIT')) {
        paymentMethod = 'cash';
      } else {
        paymentMethod = 'card';
      }
    }
    const fiscal = matched?.fiscal;
    const syrveOrderId = matched?.syrveOrderId || log.response?.orderInfo?.id || log.response?.id;

    return {
      items,
      totalAmount,
      orderType,
      tableNumber,
      paymentMethod,
      fiscal,
      syrveOrderId,
      matched
    };
  };

  const isDateInPeriod = (dateStr, period) => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (period === 'today') return d >= startOfToday;
    if (period === 'yesterday') return d >= startOfYesterday && d < startOfToday;
    if (period === 'this_week') {
      const day = now.getDay() || 7;
      return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    }
    if (period === 'this_month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (period === 'last_month') {
      let m = now.getMonth() - 1, y = now.getFullYear();
      if (m < 0) { m = 11; y--; }
      return d.getFullYear() === y && d.getMonth() === m;
    }
    if (period === 'this_year') return d.getFullYear() === now.getFullYear();
    if (period === 'custom') {
      if (!customStart && !customEnd) return true;
      let ok = true;
      if (customStart) { const sd = new Date(customStart); sd.setHours(0,0,0,0); if (d < sd) ok = false; }
      if (customEnd) { const ed = new Date(customEnd); ed.setHours(23,59,59,999); if (d > ed) ok = false; }
      return ok;
    }
    return true;
  };

  const brands = [...new Set(logs.map(l => l.brandId).filter(Boolean))];

  // ── Filtered by Period & Brands for StatCards ────────────────
  const periodFilteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (selectedBrands.length > 0) {
        const bLower = (l.brandId || '').toLowerCase();
        if (!selectedBrands.includes(bLower)) return false;
      }
      if (!isDateInPeriod(l.timestamp, periodFilter)) return false;
      return true;
    });
  }, [logs, selectedBrands, periodFilter, customStart, customEnd]);

  // Derived stats strictly reflect the selected period and brands
  const derivedStats = useMemo(() => ({
    total: periodFilteredLogs.length,
    success: periodFilteredLogs.filter(l => l.status === 'success').length,
    errors: periodFilteredLogs.filter(l => l.status === 'error').length,
  }), [periodFilteredLogs]);

  // Syrve Audit stats across selected period and brands
  const auditStats = useMemo(() => {
    let totalAnalyzed = 0;
    let withDiscountCount = 0;
    let totalDiscountSum = 0;
    let discrepancyCount = 0;
    let totalDiscrepancySum = 0;

    periodFilteredLogs.forEach(l => {
      totalAnalyzed++;
      const audit = getSyrveAudit(l);
      if (audit.hasDiscount) {
        withDiscountCount++;
        totalDiscountSum += audit.discountSum;
      }
      if (!audit.isBalanced) {
        discrepancyCount++;
        totalDiscrepancySum += Math.abs(audit.balanceGap);
      }
    });

    return {
      totalAnalyzed,
      withDiscountCount,
      totalDiscountSum: Math.round(totalDiscountSum * 100) / 100,
      discrepancyCount,
      totalDiscrepancySum: Math.round(totalDiscrepancySum * 100) / 100,
    };
  }, [periodFilteredLogs]);

  // Filtered logs for the Audit Modal
  const auditFilteredLogs = useMemo(() => {
    return periodFilteredLogs.filter(l => {
      const audit = getSyrveAudit(l);
      if (auditFilter === 'discrepancies' && audit.isBalanced) return false;
      if (auditFilter === 'only_discounts' && !audit.hasDiscount) return false;
      if (auditFilter === 'discrepancies_or_discounts' && !audit.hasDiscount && audit.isBalanced) return false;

      if (auditSearch) {
        const q = auditSearch.toLowerCase();
        const id = String(l.id || l.order_id || '').toLowerCase();
        const brand = String(l.brandId || '').toLowerCase();
        if (!id.includes(q) && !brand.includes(q)) return false;
      }
      return true;
    });
  }, [periodFilteredLogs, auditFilter, auditSearch]);

  // Table filtering adds status filter & search on top of periodFilteredLogs
  const filtered = useMemo(() => {
    return periodFilteredLogs.filter(l => {
      if (filter !== 'all' && l.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const amount = getLogAmount(l);
        const amountStr = amount !== null ? `${amount.toFixed(2)}` : '';
        const haystack = [l.id, l.brandId, l.order_id, l.status, amountStr].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [periodFilteredLogs, filter, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportExcel = () => {
    const data = filtered.map(l => {
      const amount = getLogAmount(l);
      const details = getOrderDetails(l);
      return {
        'Data/Ora': l.timestamp ? new Date(l.timestamp).toLocaleString('ro-RO') : '',
        'ID Comandă': l.id || '',
        'Brand': l.brandId || '',
        'Sumă (lei)': amount !== null ? amount.toFixed(2) : '—',
        'Plată': details.paymentMethod === 'card' ? 'Card POS' : 'Cash',
        'Status': STATUS_CONFIG[l.status]?.label || l.status,
      };
    });
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "iiko Logs");
    XLSX.writeFile(wb, `iiko_logs_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const periodLabel = 
    periodFilter === 'today' ? 'Loguri Azi' : 
    periodFilter === 'yesterday' ? 'Loguri Ieri' : 
    periodFilter === 'this_week' ? 'Loguri Săptămână' : 
    periodFilter === 'this_month' ? 'Loguri Lună' : 
    periodFilter === 'last_month' ? 'Loguri Luna Trecută' : 
    periodFilter === 'this_year' ? 'Loguri An' : 
    'Total Loguri iiko';

  return (
    <div className="space-y-6">
      {/* Stats Cards - Identical to Dashboard StatCard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard 
          label={periodLabel} 
          value={derivedStats.total} 
          color="#6366f1" 
          icon={FileText}
          onClick={() => { setFilter('all'); setCurrentPage(1); }}
          active={filter === 'all'}
        />
        <StatCard 
          label="Succes" 
          value={derivedStats.success} 
          color="#10b981" 
          icon={CheckCircle2}
          onClick={() => { setFilter(filter === 'success' ? 'all' : 'success'); setCurrentPage(1); }}
          active={filter === 'success'}
        />
        <StatCard 
          label="Erori" 
          value={derivedStats.errors} 
          color="#ef4444" 
          icon={XCircle}
          onClick={() => { setFilter(filter === 'error' ? 'all' : 'error'); setCurrentPage(1); }}
          active={filter === 'error'}
          highlight={derivedStats.errors > 0}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all',     label: 'Toate' },
            { id: 'success', label: '✓ Succes' },
            { id: 'error',   label: '✕ Erori' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setCurrentPage(1); }}
              className={`px-4 h-9 rounded-full text-sm font-bold border transition-colors ${
                filter === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}

          <select
            value={periodFilter}
            onChange={e => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
            className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toată perioada</option>
            <option value="today">Azi</option>
            <option value="yesterday">Ieri</option>
            <option value="this_week">Săptămâna curentă</option>
            <option value="this_month">Luna curentă</option>
            <option value="last_month">Luna trecută</option>
            <option value="this_year">Anul curent</option>
            <option value="custom">Personalizat</option>
          </select>

          {periodFilter === 'custom' && (
            <div className="flex items-center gap-1">
              <input type="date" value={customStart} onChange={e => {setCustomStart(e.target.value); setCurrentPage(1);}} className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-400 font-bold">-</span>
              <input type="date" value={customEnd} onChange={e => {setCustomEnd(e.target.value); setCurrentPage(1);}} className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {brands.length > 0 && (
            <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
              <button
                onClick={selectAllBrands}
                className={`h-8 px-3 rounded-full text-xs font-bold transition-all ${
                  selectedBrands.length === 0
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Toate
              </button>
              {brands.map(b => {
                const isSelected = selectedBrands.includes(b.toLowerCase());
                return (
                  <button
                    key={b}
                    onClick={() => toggleBrand(b)}
                    title={`Filtru ${b} (Click pentru selecție multiplă)`}
                    className={`h-8 w-8 rounded-full flex items-center justify-center transition-all border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <BrandLogo brandId={b} size={16} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search className="w-3.5 h-3.5 text-slate-400" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              placeholder="Caută..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="h-9 pl-8 pr-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              style={{ width: 160 }}
            />
            {search && (
              <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: '#6366f1', color: 'white', borderRadius: 9999, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                {filtered.length} / {logs.length}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowAuditModal(true)}
            className={`px-4 h-9 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
              auditStats.discrepancyCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 hover:bg-amber-100'
                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100'
            }`}
            title="Audit Reconciliere & Reduceri Syrve"
          >
            <ShieldCheck size={15} />
            <span>Audit Syrve</span>
            {auditStats.discrepancyCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white">
                {auditStats.discrepancyCount}
              </span>
            ) : auditStats.withDiscountCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-500 text-white">
                {auditStats.withDiscountCount}
              </span>
            ) : null}
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 h-9 rounded-full bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel
          </button>
          <button
            onClick={fetchLogs}
            className="px-4 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12 text-center">Nr.</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Data / Ora</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">ID Comandă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Brand</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Ce s-a comandat</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Sumă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Acțiune</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  Nu există loguri iiko
                </td>
              </tr>
            )}
            {paginated.map((log, idx) => {
              const globalIdx = (currentPage - 1) * itemsPerPage + idx;
              const logKey = log._id || `${log.id || log.order_id || ''}-${log.timestamp || log.created_at || ''}-${globalIdx}`;
              const isExpanded = expandedId === logKey;
              const statusInfo = STATUS_CONFIG[log.status] || STATUS_CONFIG.error;
              const details = getOrderDetails(log);
              const audit = getSyrveAudit(log);

              return (
                <React.Fragment key={logKey}>
                  <tr
                    className={`border-b border-slate-100 dark:border-slate-800/50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                    onClick={() => setExpandedId(isExpanded ? null : logKey)}
                  >
                    <td className="px-4 py-3 text-center text-slate-400 text-xs font-mono">
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {log.timestamp ? new Date(log.timestamp).toLocaleDateString('ro-RO') : '—'}
                      </div>
                      <div className="text-slate-400">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('ro-RO') : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-blue-600 dark:text-blue-400">
                      #{log.id || log.order_id || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-2">
                        <BrandLogo brandId={log.brandId} size={20} />
                        <span className="capitalize font-bold text-slate-700 dark:text-slate-300">{log.brandId || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[240px]">
                      {details.items.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={details.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}>
                            {details.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {details.items.reduce((s, it) => s + (it.quantity || 1), 0)} buc • {details.orderType === 'dine-in' ? (details.tableNumber ? `Masa ${details.tableNumber}` : 'La masă') : 'La pachet'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Detalii în payload</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {details.totalAmount !== null && details.totalAmount !== undefined 
                          ? `${formatThousands(details.totalAmount)} lei` 
                          : '—'}
                      </div>
                      <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                        {details.paymentMethod === 'cash' ? 'Cash' : 'Card'}
                      </div>
                      {/* Audit Pill */}
                      {audit.hasDiscount && audit.isBalanced && (
                        <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50" title={`Reducere aplicata in Syrve: -${formatThousands(audit.discountSum)} lei`}>
                          <Percent size={9} />
                          -{formatThousands(audit.discountSum)} lei
                        </div>
                      )}
                      {!audit.isBalanced && (
                        <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50" title={`Restanta in Syrve: ${formatThousands(audit.balanceGap)} lei`}>
                          <AlertTriangle size={9} />
                          +{formatThousands(audit.balanceGap)} lei restanta
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: statusInfo.bg, color: statusInfo.color }}
                      >
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {log.status === 'error' && (
                          <button
                            onClick={(e) => handleRetry(log, e)}
                            disabled={retryingId === (log.id || log.order_id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                              retryingId === (log.id || log.order_id)
                                ? 'bg-amber-100 text-amber-600 cursor-wait'
                                : 'bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {retryingId === (log.id || log.order_id) ? (
                              <>
                                <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                                Retrimit...
                              </>
                            ) : (
                              <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                Retrimite
                              </>
                            )}
                          </button>
                        )}
                        <button className="text-slate-400 hover:text-slate-600 transition-colors">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-50 dark:bg-slate-800/30">
                      <td colSpan={8} className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
                        <div className="space-y-6">
                          
                          {/* ── DETALII COMANDĂ (Ce s-a comandat) ── */}
                          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-3">
                                <BrandLogo brandId={log.brandId} size={26} />
                                <div>
                                  <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 m-0">
                                    Comandă #{log.id || log.order_id || '—'}
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                      {details.items.length} {details.items.length === 1 ? 'produs' : 'produse'}
                                    </span>
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                                    <span><strong>Canal:</strong> {details.matched?.channel || 'KIOSK'}</span>
                                    <span>•</span>
                                    <span><strong>Tip:</strong> {details.orderType === 'dine-in' ? (details.tableNumber ? `La masă (Masa ${details.tableNumber})` : 'La masă') : 'La pachet'}</span>
                                    <span>•</span>
                                    <span><strong>Plată:</strong> {details.paymentMethod === 'cash' ? 'Numerar (Cash)' : 'Card (POS)'}</span>
                                    {log.timestamp && (
                                      <>
                                        <span>•</span>
                                        <span>{new Date(log.timestamp).toLocaleString('ro-RO')}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Comandă</span>
                                <div className="text-2xl font-black text-slate-900 dark:text-white">
                                  {formatThousands(details.totalAmount || 0)} lei
                                </div>
                              </div>
                            </div>

                            {/* CUI Fiscal dacă există */}
                            {details.fiscal && (
                              <div className="mt-4 p-3 bg-indigo-50/80 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800/50 flex items-center gap-3 text-xs">
                                <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <div>
                                  <div className="font-bold text-indigo-900 dark:text-indigo-300">
                                    Bon Fiscal cu CUI: <span className="text-slate-800 dark:text-slate-100 font-semibold">{details.fiscal.name || '—'}</span>
                                  </div>
                                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                                    CUI: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{details.fiscal.rawCui || details.fiscal.cui}</strong>
                                    {details.fiscal.regCom && <> • Reg.Com: {details.fiscal.regCom}</>}
                                    {details.fiscal.isVatPayer && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">Plătitor TVA</span>}
                                  </div>
                                  {details.fiscal.address && (
                                    <div className="text-[11px] text-slate-400 mt-0.5">{details.fiscal.address}</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Syrve ID dacă există */}
                            {details.syrveOrderId && (
                              <div className="mt-3 p-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-emerald-800 dark:text-emerald-300">ID Syrve / iiko:</span>
                                  <span className="font-mono text-emerald-900 dark:text-emerald-200 font-bold select-all">{details.syrveOrderId}</span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(details.syrveOrderId);
                                    const btn = e.currentTarget;
                                    const prev = btn.innerHTML;
                                    btn.innerText = 'Copiat!';
                                    setTimeout(() => { btn.innerHTML = prev; }, 1500);
                                  }}
                                  className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-50 transition-colors"
                                >
                                  Copiază ID
                                </button>
                              </div>
                            )}

                            {/* Card Audit Syrve: Preț Catalog vs Reducere vs Încasat */}
                            <div className="mt-3 p-3.5 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-700/60">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Audit & Reconciliere Syrve
                                  </span>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  audit.isBalanced
                                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                }`}>
                                  {audit.isBalanced ? (
                                    <>
                                      <CheckCircle2 size={12} />
                                      Echilibrat 100% (Catalog - Reducere = Plata)
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle size={12} />
                                      Atentie: {formatThousands(audit.balanceGap)} lei restanta in Syrve (reducere netransmisa)
                                    </>
                                  )}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Catalog Brut</span>
                                  <span className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
                                    {formatThousands(audit.catalogGross)} lei
                                  </span>
                                </div>
                                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Reducere Kiosk</span>
                                  <span className={`text-sm font-black mt-0.5 block ${audit.hasDiscount ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                    {audit.hasDiscount ? `-${formatThousands(audit.discountSum)} lei` : '0.00 lei'}
                                  </span>
                                </div>
                                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Incasat POS</span>
                                  <span className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
                                    {formatThousands(audit.paidSum)} lei
                                  </span>
                                </div>
                                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Balanta Syrve</span>
                                  <span className={`text-sm font-black mt-0.5 block ${audit.isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {audit.isBalanced ? '0.00 lei' : `+${formatThousands(audit.balanceGap)} lei restanta`}
                                  </span>
                                </div>
                              </div>

                              {audit.hasDiscount && audit.discounts.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/50 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-600 dark:text-slate-400">Detalii reducere Syrve:</span>
                                  {audit.discounts.map((d, dIdx) => (
                                    <span key={dIdx} className="font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                      {d.type || 'RMS'} | ID: {d.discountTypeId || '—'} | Suma: -{formatThousands(d.sum || 0)} lei
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Lista de produse */}
                            <div className="mt-4">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Ce se comandă ({details.items.length} poziții)
                              </h5>

                              {details.items.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-2">
                                  Produsele sunt detaliate în Cerere (Payload Trimis) mai jos.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {details.items.map((it, iIdx) => (
                                    <div key={iIdx} className="p-3 rounded-2xl flex items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="font-bold text-slate-400 text-xs shrink-0 w-5 text-right">
                                          {iIdx + 1}.
                                        </div>
                                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                          {it.imageUrl ? (
                                            <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <Utensils className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                            {it.name}
                                          </div>
                                          {/* Modificatori / Opțiuni */}
                                          {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                              {it.selectedModifiers.map((m, mIdx) => (
                                                <span key={mIdx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                                  + {m.optionName || m.name || m.productId} {Number(m.price) > 0 ? `(${formatThousands(m.price)} lei)` : ''}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          {it.comment && (
                                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium italic mt-0.5">
                                              Notă: {it.comment}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/50">
                                          {it.quantity}x
                                        </span>
                                        <div className="font-black text-sm text-slate-900 dark:text-white mt-1">
                                          {formatThousands((it.price || 0) * (it.quantity || 1))} lei
                                        </div>
                                        {it.quantity > 1 && (
                                          <div className="text-[10px] text-slate-400">
                                            {formatThousands(it.price || 0)} lei / buc
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ── TEHNIC: Payload & Răspuns ── */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Request Payload */}
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 m-0">
                                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                  Cerere (Payload Trimis)
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2));
                                    const btn = e.currentTarget;
                                    const prev = btn.innerHTML;
                                    btn.innerText = 'Copiat!';
                                    setTimeout(() => { btn.innerHTML = prev; }, 1500);
                                  }}
                                  className="text-xs px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1 font-bold"
                                >
                                  <Copy size={13} /> Copiază
                                </button>
                              </div>
                              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700 max-h-80">
                                <pre className="text-xs text-blue-300 font-mono" style={{ margin: 0 }}>
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            </div>

                            {/* Response */}
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 m-0">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusInfo.color }}></span>
                                  Răspuns (Syrve)
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(JSON.stringify(log.response, null, 2));
                                    const btn = e.currentTarget;
                                    const prev = btn.innerHTML;
                                    btn.innerText = 'Copiat!';
                                    setTimeout(() => { btn.innerHTML = prev; }, 1500);
                                  }}
                                  className="text-xs px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1 font-bold"
                                >
                                  <Copy size={13} /> Copiază
                                </button>
                              </div>
                              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700 max-h-80">
                                <pre className="text-xs font-mono" style={{ margin: 0, color: log.status === 'error' ? '#fca5a5' : '#86efac' }}>
                                  {JSON.stringify(log.response, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              Afișează
              <select
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toți</option>
              </select>
            </span>
            <span>Total înregistrări: <strong className="text-slate-700 dark:text-slate-300">{filtered.length}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Pagina {currentPage} din {totalPages}</span>
            <div className="flex gap-1">
              {[
                { label: '«', action: () => setCurrentPage(1),           disabled: currentPage === 1 },
                { label: '‹', action: () => setCurrentPage(p => p - 1),  disabled: currentPage === 1 },
                { label: '›', action: () => setCurrentPage(p => p + 1),  disabled: currentPage === totalPages },
                { label: '»', action: () => setCurrentPage(totalPages),  disabled: currentPage === totalPages },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} disabled={btn.disabled}
                  className={`w-8 h-8 rounded-lg border text-sm font-bold flex items-center justify-center transition-colors ${btn.disabled ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'}`}
                >{btn.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL AUDIT REDUCERI SYRVE ─── */}
      {showAuditModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setShowAuditModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0 flex items-center gap-2">
                    Audit Integritate & Reduceri Syrve
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 m-0">
                    Verificare matematica intre pret catalog brut, discount transmis si plata POS
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Comenzi Verificate
                  </span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {auditStats.totalAnalyzed}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    In perioada selectata
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                    Reduceri Transmise
                  </span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    -{formatThousands(auditStats.totalDiscountSum)} lei
                  </div>
                  <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 block font-medium">
                    {auditStats.withDiscountCount} comenzi cu reduceri promotionale
                  </span>
                </div>

                <div className={`p-4 rounded-2xl border ${
                  auditStats.discrepancyCount > 0
                    ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                }`}>
                  <span className={`text-xs font-bold uppercase tracking-wider block ${
                    auditStats.discrepancyCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'
                  }`}>
                    Discrepante / Restante
                  </span>
                  <div className={`text-2xl font-black mt-1 ${
                    auditStats.discrepancyCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                  }`}>
                    {auditStats.discrepancyCount > 0 ? `${auditStats.discrepancyCount} comenzi` : '0'}
                  </div>
                  <span className={`text-[11px] mt-0.5 block font-medium ${
                    auditStats.discrepancyCount > 0 ? 'text-amber-700/80 dark:text-amber-400/80' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {auditStats.discrepancyCount > 0 
                      ? `${formatThousands(auditStats.totalDiscrepancySum)} lei restanta totala` 
                      : 'Toate comenzile sunt in echilibru perfect'}
                  </span>
                </div>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'discrepancies_or_discounts', label: 'Reduceri & Atentie' },
                    { id: 'discrepancies', label: `Doar Discrepante (${auditStats.discrepancyCount})` },
                    { id: 'only_discounts', label: `Doar cu Reduceri (${auditStats.withDiscountCount})` },
                    { id: 'all', label: `Toate (${auditStats.totalAnalyzed})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setAuditFilter(tab.id)}
                      className={`px-3.5 h-8 rounded-full text-xs font-bold transition-all border ${
                        auditFilter === tab.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative' }}>
                  <Search className="w-3.5 h-3.5 text-slate-400" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    placeholder="Filtreaza comanda..."
                    value={auditSearch}
                    onChange={e => setAuditSearch(e.target.value)}
                    className="h-8 pl-8 pr-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ width: 180 }}
                  />
                </div>
              </div>

              {/* Audit Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10">
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-slate-400">Nr.</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-slate-400">Data</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-slate-400">Comanda</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-slate-400">Brand</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-slate-400 text-right">Catalog Brut</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-slate-400 text-right">Reducere</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-slate-400 text-right">Incasat POS</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-slate-400 text-center">Balanta Syrve</th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-slate-400 text-right">Inspecteaza</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {auditFilteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-10 text-slate-400 italic">
                            Nu exista comenzi conforme cu criteriul selectat
                          </td>
                        </tr>
                      ) : (
                        auditFilteredLogs.map((l, idx) => {
                          const audit = getSyrveAudit(l);
                          const logKey = l._id || `${l.id || l.order_id || ''}-${l.timestamp || l.created_at || ''}-${idx}`;
                          return (
                            <tr key={logKey} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {l.timestamp ? new Date(l.timestamp).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">
                                #{l.id || l.order_id || '—'}
                              </td>
                              <td className="px-3 py-2">
                                <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                                  {l.brandId || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-200">
                                {formatThousands(audit.catalogGross)} lei
                              </td>
                              <td className="px-3 py-2 text-right">
                                {audit.hasDiscount ? (
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    -{formatThousands(audit.discountSum)} lei
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-black text-slate-900 dark:text-white">
                                {formatThousands(audit.paidSum)} lei
                              </td>
                              <td className="px-3 py-2 text-center">
                                {audit.isBalanced ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                    <CheckCircle2 size={10} /> Echilibrat
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                    <AlertTriangle size={10} /> +{formatThousands(audit.balanceGap)} lei
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => {
                                    setShowAuditModal(false);
                                    setExpandedId(logKey);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors"
                                >
                                  Deschide
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Verificare automata aplicata pe toate comenzile locale si din cloud.
              </span>
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-colors"
              >
                Inchide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, brandId, icon: Icon, onClick, active, highlight }) {
  const isCurrency = typeof value === 'string' && value.includes('lei');
  const displayVal = isCurrency ? value.replace('lei', '').trim() : value;
  const valLength = String(displayVal).length;

  let fontSizeClass = 'text-xl';
  if (isCurrency) {
    if (valLength > 8) fontSizeClass = 'text-sm';
    else if (valLength > 5) fontSizeClass = 'text-base';
    else fontSizeClass = 'text-lg';
  } else {
    fontSizeClass = valLength > 4 ? 'text-xl' : 'text-2xl';
  }

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border px-4 py-3 flex items-center justify-between min-w-[120px] flex-1 relative overflow-hidden transition-all duration-200 group select-none ${
        active 
          ? 'ring-2 ring-blue-500 border-blue-500 shadow-md scale-[1.02]' 
          : highlight
          ? 'border-red-300 dark:border-red-500/50'
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
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              lei
            </span>
          )}
        </div>
        {!brandId && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title={label}>
            {label}
          </span>
        )}
      </div>

      {brandId ? (
        <div className="flex flex-col items-center justify-center shrink-0 ml-2 z-10">
          <div className="relative">
            {/* 3D Atmosphere Glow behind avatar */}
            <div 
              className="absolute -inset-1 rounded-full blur-sm opacity-35 group-hover:opacity-75 transition-opacity pointer-events-none"
              style={{ backgroundColor: color }}
            />
            {/* 3D Raised Bezel Container with Specular Top Highlight */}
            <div 
              className="relative w-9 h-9 rounded-full p-0.5 flex items-center justify-center bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 border border-white/80 dark:border-slate-600/60 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
              style={{ 
                boxShadow: `0 3px 8px ${color}40, 0 1px 2px rgba(0,0,0,0.1), inset 0 1.5px 2px rgba(255,255,255,0.85)` 
              }}
            >
              <BrandLogo brandId={brandId} size={24} className="rounded-full shadow-inner" />
            </div>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap text-center max-w-[80px] overflow-hidden text-ellipsis" title={label}>
            {label}
          </span>
        </div>
      ) : Icon ? (
        <div className="relative shrink-0 ml-2">
          <div 
            className="absolute -inset-1 rounded-full blur-sm opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none"
            style={{ backgroundColor: color }}
          />
          <div 
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
            style={{ 
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              boxShadow: `0 3px 8px ${color}35, 0 1px 2px rgba(0,0,0,0.1), inset 0 1.5px 2px rgba(255,255,255,0.4)` 
            }}
          >
            <Icon size={18} strokeWidth={2.5} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
