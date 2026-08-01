import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const STATUS_CONFIG = {
  pending:    { label: 'Nou',         color: '#f59e0b', next: 'preparing', nextLabel: '▶ Începe' },
  preparing:  { label: 'Pregătire',   color: '#4f8ef7', next: 'ready',    nextLabel: '✅ Gata'  },
  ready:      { label: 'Gata',        color: '#22c55e', next: 'delivered', nextLabel: '🍽 Livrat' },
  delivered:  { label: 'Livrat',      color: '#a855f7', next: null,        nextLabel: null },
  completed:  { label: 'Finalizat',   color: '#6b7280', next: null,        nextLabel: null },
  cancelled:  { label: 'Anulat',      color: '#ef4444', next: null,        nextLabel: null },
};

// Quick beep using Web Audio API
function playBeep(type = 'new') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = type === 'new' ? 880 : 660;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

export default function App() {
  const [orders, setOrders]       = useState([]);
  const [filter, setFilter]       = useState('all'); // all | pending | preparing | ready
  const [connected, setConnected] = useState(false);
  const [brand, setBrand]         = useState('all');
  const socketRef = useRef(null);
  const [menuProducts, setMenuProducts] = useState({});
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);

  // Connect to backend Socket.IO
  useEffect(() => {
    const socket = io(BACKEND, { reconnectionAttempts: 10 });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_room', 'kitchen');
      console.log('[KDS] Connected, joined kitchen room');
    });

    socket.on('disconnect', () => setConnected(false));

    // New order arrives from kiosk or QR app
    socket.on('new_order', (order) => {
      console.log('[KDS] New order:', order);
      setOrders(prev => [{ ...order, status: 'pending', arrivedAt: Date.now(), _id: order._id || order.id || `local_${Date.now()}` }, ...prev]);
      playBeep('new');
    });

    // Order status updated (e.g. from another KDS screen)
    socket.on('order_status_updated', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status } : o));
    });

    return () => socket.disconnect();
  }, []);

  // Fetch all menu products from iiko for item details
  useEffect(() => {
    fetch(`${BACKEND}/api/menu/all`)
      .then(r => r.json())
      .then(allMenuData => {
         const prodMap = {};
         Object.keys(allMenuData || {}).forEach(b => {
           const brandMenu = allMenuData[b]?.menu?.products || [];
           brandMenu.forEach(p => {
             prodMap[p.id] = p;
             if (p.name) prodMap[p.name.toLowerCase()] = p;
           });
         });
         setMenuProducts(prodMap);
      })
      .catch(() => {});
  }, []);

  // Load ALL orders on mount (including delivered/completed history)
  useEffect(() => {
    fetch(`${BACKEND}/api/orders?limit=200`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.orders)) setOrders(data.orders);
      })
      .catch(() => {});
  }, []);

  const updateStatus = useCallback((orderId, newStatus) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o));
    if (newStatus === 'ready') playBeep('ready');
    // Notify backend
    fetch(`${BACKEND}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
    // Broadcast via Socket.IO
    socketRef.current?.emit('update_order_status', { orderId, status: newStatus });
  }, []);

  const filteredOrders = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (brand !== 'all' && o.brand !== brand) return false;
    return true;
  });

  const counts = {
    pending:   orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
  };

  return (
    <div className="kds-app">
      {/* ─── Header ─── */}
      <header className="kds-header">
        <div className="kds-logo">
          <span className="kds-logo-icon">🍽</span>
          <span className="kds-logo-text">Kitchen Display</span>
        </div>

        <div className="kds-stats">
          <div className="kds-stat kds-stat--pending"  onClick={() => setFilter('pending')}>
            <span className="stat-num">{counts.pending}</span>
            <span className="stat-lbl">Noi</span>
          </div>
          <div className="kds-stat kds-stat--preparing" onClick={() => setFilter('preparing')}>
            <span className="stat-num">{counts.preparing}</span>
            <span className="stat-lbl">Pregătire</span>
          </div>
          <div className="kds-stat kds-stat--ready" onClick={() => setFilter('ready')}>
            <span className="stat-num">{counts.ready}</span>
            <span className="stat-lbl">Gata</span>
          </div>
        </div>

        <div className="kds-header-right">
          {/* Brand logo tabs */}
          <div className="kds-brand-tabs">
            <button
              className={`kds-brand-tab ${brand === 'all' ? 'active' : ''}`}
              onClick={() => setBrand('all')}
              title="Toate brandurile"
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'inherit' }}>TOATE</span>
            </button>
            <button
              className={`kds-brand-tab ${brand === 'smashme' ? 'active' : ''}`}
              onClick={() => setBrand('smashme')}
              title="SmashMe"
              style={{ '--tab-accent': '#EE3B24' }}
            >
              <img src="/brands/smashme-logo.png" alt="SmashMe"
                   style={{ height: '28px', objectFit: 'contain', maxWidth: '90px' }} />
            </button>
            <button
              className={`kds-brand-tab ${brand === 'sushimaster' ? 'active' : ''}`}
              onClick={() => setBrand('sushimaster')}
              title="SushiMaster"
              style={{ '--tab-accent': '#E31E24' }}
            >
              <img src="/brands/sushimaster-logo.png" alt="SushiMaster"
                   style={{ height: '28px', objectFit: 'contain', maxWidth: '90px' }} />
            </button>
            <button
              className={`kds-brand-tab ${brand === 'ikura' ? 'active' : ''}`}
              onClick={() => setBrand('ikura')}
              title="Ikura"
              style={{ '--tab-accent': '#8b5cf6' }}
            >
              <img src="/brands/ikura-logo.png" alt="Ikura"
                   style={{ height: '28px', objectFit: 'contain', maxWidth: '90px' }} />
            </button>
          </div>

          <div className={`kds-connection ${connected ? 'connected' : 'disconnected'}`}>
            <span className="conn-dot" />
            {connected ? 'Live' : 'Reconectare...'}
          </div>

          <div className="kds-filters">
            {['all','pending','preparing','ready','delivered'].map(f => (
              <button
                key={f}
                className={`kds-filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
                style={f !== 'all' ? { '--fc': STATUS_CONFIG[f]?.color } : {}}
              >
                {f === 'all' ? 'Toate' : STATUS_CONFIG[f]?.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ─── Orders Grid ─── */}
      <main className="kds-grid">
        {filteredOrders.length === 0 && (
          <div className="kds-empty">
            <span style={{ fontSize: '4rem' }}>🍳</span>
            <p>Nicio comandă momentan</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Comenzile apar automat când sunt plasate</p>
          </div>
        )}
        {filteredOrders.map(order => (
          <OrderCard 
             key={order._id} 
             order={order} 
             onStatusChange={updateStatus} 
             menuProducts={menuProducts}
             onProductClick={(item, fullProd) => setSelectedItemDetail({ ...fullProd, originalItem: item })}
          />
        ))}

        {/* ── Product Detail Modal ── */}
        {selectedItemDetail && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', padding: '20px'
          }} onClick={() => setSelectedItemDetail(null)}>
            <div style={{
              background: 'var(--bg-card)', borderRadius: '32px', border: '1px solid var(--border)',
              width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 30px',
                borderBottom: '1px solid var(--border)'
              }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>{selectedItemDetail.name}</h2>
                <button onClick={() => setSelectedItemDetail(null)} style={{
                  background: 'var(--bg)', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem',
                  width: '40px', height: '40px', borderRadius: '9999px', cursor: 'pointer'
                }}>✕</button>
              </div>
              
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
                {/* LEFT: Image */}
                <div style={{
                  width: window.innerWidth < 768 ? '100%' : '40%', background: 'var(--bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px',
                  borderRight: window.innerWidth < 768 ? 'none' : '1px solid var(--border)',
                  borderBottom: window.innerWidth < 768 ? '1px solid var(--border)' : 'none',
                }}>
                  {(() => {
                    let finalImg = selectedItemDetail.image || (selectedItemDetail.imageLinks && selectedItemDetail.imageLinks[0]);
                    if (finalImg && finalImg.startsWith('/uploads')) finalImg = `${BACKEND}${finalImg}`;
                    
                    if (finalImg) {
                      return <img src={finalImg} alt={selectedItemDetail.name} style={{ width: '100%', maxWidth: '250px', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '32px' }} />;
                    }
                    return (
                      <div style={{ width: '100%', maxWidth: '250px', aspectRatio: '1/1', borderRadius: '32px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '5rem' }}>🍽️</span>
                      </div>
                    );
                  })()}
                </div>
                
                {/* RIGHT: Text Content */}
                <div style={{ width: window.innerWidth < 768 ? '100%' : '60%', padding: '30px', overflowY: 'auto' }}>
                  {(() => {
                    const trans = selectedItemDetail.translations || {};
                    const desc = trans.ro || trans.en || selectedItemDetail.description || '';
                    if (!desc) return <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Nicio descriere detaliată disponibilă în Syrve.</p>;
                    return (
                      <div style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: '1.6' }}
                           dangerouslySetInnerHTML={{ __html: desc.replace(/\n/g, '<br/>') }} />
                    );
                  })()}
                  
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     {selectedItemDetail.weight != null && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text)' }}>Greutate:</strong> {selectedItemDetail.weight} kg</p>}
                     {selectedItemDetail.energyAmount != null && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text)' }}>Valoare energetică:</strong> {selectedItemDetail.energyAmount} Kcal</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({ order, onStatusChange, menuProducts, onProductClick }) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const elapsed = Math.floor((Date.now() - (order.arrivedAt || Date.now())) / 1000 / 60);
  const isUrgent = elapsed >= 10 && order.status !== 'delivered' && order.status !== 'cancelled';
  const isCancelled = order.status === 'cancelled';

  return (
    <div className={`order-card order-card--${order.status} ${isUrgent ? 'order-card--urgent' : ''}`}
         style={{ '--sc': cfg.color, opacity: isCancelled ? 0.5 : 1 }}>

      {/* Card Header */}
      <div className="oc-header">
        <div className="oc-num">#{order.orderNumber || order._id?.slice(-4) || '????'}</div>
        <div className="oc-badges">
          {order.orderType === 'dine-in'
            ? <span className="oc-badge oc-badge--table">🪑 Masa {order.tableNumber}</span>
            : <span className="oc-badge oc-badge--takeaway">🛍 La pachet</span>
          }
          {order.brand && <span className="oc-badge oc-badge--brand">{order.brand}</span>}
        </div>
        <div className="oc-time">
          <span className={`oc-elapsed ${isUrgent ? 'urgent' : ''}`}>{elapsed}min</span>
          <span className="oc-status" style={{ color: cfg.color }}>● {cfg.label}</span>
        </div>
      </div>

      {/* Items */}
      <div className="oc-items">
        {(order.items || []).map((item, i) => {
          const fullProd = menuProducts ? (menuProducts[item.productId] || (item.name && menuProducts[item.name.toLowerCase()])) : null;
          return (
            <div key={i} 
                 className={`oc-item ${fullProd ? 'oc-item--clickable' : ''}`}
                 onClick={() => {
                   if (fullProd && onProductClick) onProductClick(item, fullProd);
                 }}
                 style={fullProd ? { cursor: 'pointer' } : {}}
            >
              <span className="oc-qty">{item.quantity}x</span>
              <div className="oc-item-info">
                <span className="oc-item-name">{item.name}</span>
                {item.selectedModifiers?.length > 0 && (
                  <span className="oc-item-mods">
                    {item.selectedModifiers.map(m => m.optionName || m.modifierName).filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="oc-footer">
        <span className="oc-total">{(order.totalAmount || 0).toFixed(0)} lei</span>
        {cfg.next && !isCancelled && (
          <button
            className="btn-status-next"
            style={{ '--sc': STATUS_CONFIG[cfg.next]?.color || cfg.color }}
            onClick={() => onStatusChange(order._id, cfg.next)}
          >
            {cfg.nextLabel}
          </button>
        )}
        {order.status === 'delivered' && (
          <span className="oc-done">✓ Livrat</span>
        )}
        {isCancelled && (
          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem' }}>❌ ANULAT</span>
        )}
      </div>
    </div>
  );
}
