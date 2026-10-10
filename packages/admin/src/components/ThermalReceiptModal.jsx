import React from 'react';
import { X } from 'lucide-react';
import { formatThousands } from '../utils/formatters';

const getReceiptBrandLogo = (brand) => {
  const b = String(brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (b.includes('smashme')) return { mono: '/brands/smashme-logo-mono.png', color: '/brands/smashme-logo.png' };
  if (b.includes('rollmaster') || b.includes('sushimaster') || b.includes('ikura')) return { mono: '/brands/rollmaster-logo-mono.png', color: '/brands/rollmaster-logo.png' };
  if (b.includes('crunch')) return { mono: null, color: '/brands/crunch-logo.png' };
  if (b.includes('lovesushi')) return { mono: null, color: '/brands/lovesushi-logo.png' };
  if (b.includes('welovesushi')) return { mono: null, color: '/brands/welovesushi-logo.png' };
  if (b.includes('pokiwoki')) return { mono: null, color: '/brands/pokiwoki-logo.png' };
  return { mono: null, color: `/brands/${b}-logo.png` };
};

export function normalizeOrderForReceipt(data) {
  if (!data) return null;

  // 1. Daca e log imprimanta deja formatat
  if (data.receiptContent) {
    const rc = data.receiptContent;
    const brands = (rc.brands && rc.brands.length > 0) ? rc.brands : [data.brand || 'smashme'];
    return {
      orderNumber: rc.orderNumber || data.orderNumber || '',
      brand: brands[0],
      brands,
      kioskId: data.kioskId || '',
      paymentMethod: rc.paymentMethod || data.paymentMethod || 'card',
      orderType: rc.orderType || data.orderType || 'takeaway',
      items: rc.items || [],
      total: rc.total || data.totalAmount || 0,
      date: rc.date || (data.timestamp ? new Date(data.timestamp).toLocaleString('ro-RO') : new Date().toLocaleString('ro-RO')),
    };
  }

  // 2. Comanda din baza de date / draft din PendingOrders
  const payload = data.payload || {};
  const orderNumber = data.orderNumber || payload.orderNumber || data.order_id || '';
  const brand = data.brand || payload.brand || data.locationBrand || 'smashme';
  const paymentMethod = payload.paymentMethod || (data.kind === 'cash_awaiting' ? 'cash' : (data.paymentMethod || 'card'));
  const orderType = payload.orderType || data.orderType || 'takeaway';

  const rawItems = payload.items || data.items || [];
  const items = rawItems.map(it => {
    let mods = [];
    if (Array.isArray(it.selectedModifiers)) {
      mods = it.selectedModifiers.map(m => typeof m === 'string' ? m : (m.optionName || m.name || 'Extra'));
    } else if (Array.isArray(it.modifiers)) {
      mods = it.modifiers.map(m => typeof m === 'string' ? m : (m.optionName || m.name || 'Extra'));
    }
    const qty = it.quantity || it.qty || 1;
    const itemTotal = it.totalPrice !== undefined 
      ? it.totalPrice 
      : (it.unitPrice !== undefined ? it.unitPrice * qty : (it.price !== undefined ? it.price : 0));
    return {
      name: it.name || it.productName || 'Produs',
      qty,
      price: itemTotal,
      modifiers: mods,
    };
  });

  const total = payload.totalAmount || data.totalAmount || data.total || data.pos_amount || items.reduce((s, x) => s + (Number(x.price) || 0), 0);
  const dt = data.createdAt || data.created_at || data.timestamp;
  const dateStr = dt ? new Date(dt).toLocaleString('ro-RO') : new Date().toLocaleString('ro-RO');

  return {
    orderNumber,
    brand,
    brands: [brand],
    kioskId: data.kioskId || data.kiosk_id || '',
    paymentMethod,
    orderType,
    items,
    total,
    date: dateStr,
  };
}

export default function ThermalReceiptModal({ order, onClose }) {
  if (!order) return null;
  const rc = normalizeOrderForReceipt(order);
  if (!rc) return null;

  const rawOrderNum = String(rc.orderNumber || '');
  const kMatch = rawOrderNum.match(/^[a-zA-Z]+(\d+)/);
  const kioskTag = kMatch && kMatch[1]
    ? `Kiosk ${kMatch[1]}`
    : (rc.kioskId ? `Kiosk ${String(rc.kioskId).replace(/[^0-9]/g, '') || '1'}` : null);

  const isCash = rc.paymentMethod === 'cash';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-[340px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 text-xs text-slate-800 dark:text-slate-200 font-sans transition-all max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Închide bonul"
          aria-label="Închide bonul"
        >
          <X size={18} />
        </button>

        {/* Receipt Header with Brand Logo */}
        <div className="flex flex-col items-center text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
          {(rc.brands || [rc.brand]).map((b, i) => {
            const logoInfo = getReceiptBrandLogo(b);
            const initialSrc = logoInfo.mono || logoInfo.color;
            return (
              <div key={i} className="mb-2 flex flex-col items-center justify-center">
                {initialSrc && (
                  <img
                    src={initialSrc}
                    alt={b}
                    className="h-11 max-w-[170px] object-contain dark:brightness-110 dark:invert transition-all"
                    onError={(e) => {
                      if (logoInfo.mono && e.target.src.includes('-mono.png')) {
                        e.target.src = logoInfo.color;
                      } else {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                      }
                    }}
                  />
                )}
                <div
                  className="text-base font-extrabold uppercase text-slate-900 dark:text-white tracking-wider"
                  style={{ display: initialSrc ? 'none' : 'block' }}
                >
                  {b}
                </div>
              </div>
            );
          })}

          {kioskTag && (
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
              {kioskTag}
            </div>
          )}

          <div className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider mt-1">
            COMANDA
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            #{rawOrderNum}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              isCash
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
            }`}>
              {isCash ? 'NEACHITAT – ACHITAȚI LA CASĂ' : 'ACHITAT CARD POS'}
            </span>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 uppercase tracking-wider">
              {rc.orderType === 'takeaway' ? 'LA PACHET' : 'LA MASĂ'}
            </span>
          </div>
        </div>

        {/* Products Section */}
        <div className="py-2.5">
          <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider pb-1.5 border-b border-slate-200 dark:border-slate-700/60">
            PRODUSE
          </div>

          <div className="py-2 space-y-2 border-b border-dashed border-slate-300 dark:border-slate-700 max-h-[320px] overflow-y-auto pr-1">
            {(rc.items || []).map((item, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                    {item.qty}x {item.name}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatThousands(Number(item.price))} RON
                  </span>
                </div>
                {item.modifiers && item.modifiers.length > 0 && item.modifiers.map((m, j) => (
                  <div key={j} className="text-[11px] text-slate-500 dark:text-slate-400 pl-3 pt-0.5">
                    + {m}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Total Section */}
        <div className="flex items-center justify-between py-2.5 text-sm font-black text-slate-900 dark:text-white border-b border-dashed border-slate-300 dark:border-slate-700">
          <span>TOTAL:</span>
          <span className="text-base text-emerald-600 dark:text-emerald-400">
            {formatThousands(Number(rc.total || 0))} RON
          </span>
        </div>

        {/* Date & Footer */}
        <div className="pt-2.5 text-center text-[11px] text-slate-400">
          <div>{rc.date}</div>
        </div>
      </div>
    </div>
  );
}
