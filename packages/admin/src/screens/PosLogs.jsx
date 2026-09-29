import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { io } from 'socket.io-client';
import { 
  CreditCard, CheckCircle2, XCircle, AlertTriangle, RotateCcw, 
  Receipt, Copy, Check, X, ChevronDown, ChevronUp,
  TrendingUp, BarChart3, PieChart, Landmark, ArrowUpRight, ArrowRight, Wallet, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import BrandLogo from '../components/BrandLogo.jsx';
import BankLogo from '../components/BankLogo.jsx';
import { formatThousands } from '../utils/formatters';
import { detectCardBrand, detectCardBank, BANK_CONFIG } from '../utils/cardUtils';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

const STATUS_CONFIG = {
  approved:    { label: 'Aprobat',          color: '#ffffff', bg: '#059669' },
  declined:    { label: 'Respins',          color: '#ffffff', bg: '#dc2626' },
  cancelled:   { label: 'Anulat de client', color: '#ffffff', bg: '#64748b' },
  timeout:     { label: 'Timeout',          color: '#ffffff', bg: '#d97706' },
  refunded:    { label: 'Returnat',         color: '#ffffff', bg: '#2563eb' },
  unsolicited: { label: 'POS Info',         color: '#ffffff', bg: '#7c3aed' },
};

const isLogCancelled = (l) => {
  if (!l) return false;
  if (l.status === 'cancelled') return true;
  if (typeof l.error === 'string') {
    const err = l.error.toLowerCase();
    return err.includes('anulat') || err.includes('kiosk timeout') || err.includes('cancel');
  }
  return false;
};

export function CardBrandAvatar({ brand, cardNo, isNfc, cardBank }) {
  let badge = null;
  const isMc = brand === 'mastercard';
  const isVisa = brand === 'visa';
  const isMaestro = brand === 'maestro';

  if (isMc) {
    badge = (
      <div className="relative w-8 h-5.5 sm:w-9 sm:h-6 rounded-md bg-gradient-to-br from-slate-950 via-slate-900 to-black border border-slate-700/60 shadow-sm flex items-center justify-center shrink-0 overflow-hidden" title="Mastercard">
        <svg width="22" height="14" viewBox="0 0 24 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7.5" cy="7.5" r="7" fill="#EB001B"/>
          <circle cx="16.5" cy="7.5" r="7" fill="#F79E1B"/>
          <path d="M12 2.2a6.98 6.98 0 0 1 0 10.6 6.98 6.98 0 0 1 0-10.6Z" fill="#FF5F00"/>
        </svg>
      </div>
    );
  } else if (isVisa) {
    badge = (
      <div className="relative w-8 h-5.5 sm:w-9 sm:h-6 rounded-md bg-gradient-to-br from-[#102468] via-[#0b1b4f] to-[#040c29] border border-blue-600/40 shadow-sm flex items-center justify-center shrink-0 overflow-hidden px-1" title="Visa">
        <svg width="22" height="7.5" viewBox="0 0 780 250" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M293.4 12.8L192.5 240.4H134.2L81.7 58.7C78.5 46.2 75.7 41.7 65.7 36.3C49.3 27.5 23.1 19.3 0 14.4L5.4 2.1H106.6C120.3 2.1 132.8 11.2 135.8 26.6L162.2 165.7L228.6 2.1H293.4V12.8ZM550.9 164.7C551.4 102.3 464.3 98.7 464.9 70.8C465.2 62.3 473.4 53.2 491.5 50.8C500.4 49.6 525.4 48.6 553.6 61.6L564.7 9.8C549.4 4.3 529.7 0 504.7 0C443.4 0 399.7 32.6 399.3 79.5C398.9 114 430.1 133.3 453.6 144.8C477.8 156.6 485.9 164.1 485.7 174.7C485.4 191 465.9 198.1 448 198.4C416.7 198.8 398.5 190 384.1 183.3L372.4 237.9C388.6 245.4 418.5 251.7 449.6 252C513.7 252 550.4 220.4 550.9 164.7ZM712.5 240.4H768L719.2 2.1H668C656.7 2.1 647.2 8.7 643.1 18.5L549.4 240.4H611.8L624.2 206.3H700.5L712.5 240.4ZM641.4 159.2L672.7 73.1L690.7 159.2H641.4ZM387.6 2.1L338.4 240.4H280.4L329.6 2.1H387.6Z" fill="#FFFFFF"/>
        </svg>
      </div>
    );
  } else if (isMaestro) {
    badge = (
      <div className="relative w-8 h-5.5 sm:w-9 sm:h-6 rounded-md bg-gradient-to-br from-slate-900 via-slate-800 to-black border border-slate-700/60 shadow-sm flex items-center justify-center shrink-0 overflow-hidden" title="Maestro">
        <svg width="22" height="14" viewBox="0 0 24 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7.5" cy="7.5" r="7" fill="#0061A8"/>
          <circle cx="16.5" cy="7.5" r="7" fill="#EB001B"/>
          <path d="M12 2.2a6.98 6.98 0 0 1 0 10.6 6.98 6.98 0 0 1 0-10.6Z" fill="#6C6BBA"/>
        </svg>
      </div>
    );
  } else if (cardNo) {
    badge = (
      <div className="relative w-8 h-5.5 sm:w-9 sm:h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center shrink-0" title="Card bancar">
        <CreditCard size={14} />
      </div>
    );
  }

  if (!cardNo && !badge) return <span className="text-slate-400">—</span>;

  const last4 = cardNo ? cardNo.slice(-4) : '';
  const brandName = isMc ? 'Mastercard' : (isVisa ? 'Visa' : (isMaestro ? 'Maestro' : 'Card Bancar'));
  const effBank = cardBank || (cardNo ? detectCardBank({ cardNo, brand }) : null);

  return (
    <div className="flex items-center gap-2.5">
      {badge}
      {cardNo ? (
        <div className="flex flex-col text-left leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wider">
              •••• {last4}
            </span>
            {isNfc && (
              <span title="Plată Contactless (NFC)" className="inline-flex items-center text-blue-500 dark:text-blue-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                  <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                  <line x1="12" y1="20" x2="12.01" y2="20"/>
                </svg>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-slate-400 font-semibold tracking-tight">
              {brandName}
            </span>
            {effBank && (
              <span 
                className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight border shadow-xs"
                style={{
                  backgroundColor: `${effBank.color}15`,
                  color: effBank.color,
                  borderColor: `${effBank.color}35`
                }}
                title={`Bancă emitentă: ${effBank.name}`}
              >
                <BankLogo bankId={effBank.id} bank={effBank} size={13} />
                {effBank.shortName}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-semibold">{brandName}</span>
          {effBank && (
            <span 
              className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight border shadow-xs"
              style={{
                backgroundColor: `${effBank.color}15`,
                color: effBank.color,
                borderColor: `${effBank.color}35`
              }}
              title={`Bancă emitentă: ${effBank.name}`}
            >
              <BankLogo bankId={effBank.id} bank={effBank} size={13} />
              {effBank.shortName}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function extractPosMeta(log) {
  let rNo = log.receiptNo || log.raw?.receiptNo || log.raw?.InvoiceNum || log.raw?.receipt_number || null;
  let tid = log.terminalId || log.termId || log.raw?.termId || null;
  let cardBrand = 'generic';
  let isNfc = false;
  let respCode = log.responseCode || log.response_code || log.code || null;
  let hostDate = log.txDate || null;
  let pan = log.cardNo || log.card_no || '';

  // Check extraFields in raw
  const extra = log.raw?.extraFields;
  if (Array.isArray(extra)) {
    const extraJoined = extra.join(' ').toLowerCase();
    if (extraJoined.includes('contactless') || extraJoined.includes('cl mc') || extraJoined.includes('cl visa') || extraJoined.includes('cl ')) isNfc = true;
    if (extraJoined.includes('mastercard') || extraJoined.includes('cl mc') || extraJoined.includes(' mc ')) cardBrand = 'mastercard';
    if (extraJoined.includes('visa') || extraJoined.includes('cl visa')) cardBrand = 'visa';
    if (extraJoined.includes('maestro') || extraJoined.includes('cl maestro')) cardBrand = 'maestro';

    if (extra[1] && typeof extra[1] === 'string' && extra[1].length >= 4) {
      const c = extra[1].trim();
      if (!pan || pan.length < c.length) pan = c;
    }
    if (extra[3] && !rNo) {
      const pr = String(extra[3]).trim();
      rNo = pr.length >= 7 ? pr.slice(1) : pr.slice(0, 6);
    }
  }

  // Check card string BIN
  const cardStart = String(pan).trim();
  if (cardStart.startsWith('4')) cardBrand = 'visa';
  else if (/^(5[1-5]|2[2-7])/.test(cardStart)) cardBrand = 'mastercard';
  else if (/^(50|5[6-8]|6)/.test(cardStart)) cardBrand = 'maestro';
  else if (/^3[47]/.test(cardStart)) cardBrand = 'amex';

  // Parse raw if available (hex from verifone/printec)
  let rawStr = '';
  if (typeof log.raw === 'object' && log.raw !== null) {
    if (log.raw.data && typeof log.raw.data === 'string') rawStr = log.raw.data;
    else rawStr = JSON.stringify(log.raw);
  } else if (typeof log.raw === 'string') {
    rawStr = log.raw;
  }

  // Check hex string
  if (/^[0-9a-fA-F]+$/.test(rawStr) && rawStr.length % 2 === 0 && rawStr.length >= 80) {
    try {
      let ascii = '';
      for (let i = 0; i < rawStr.length; i += 2) {
        ascii += String.fromCharCode(parseInt(rawStr.substr(i, 2), 16));
      }
      if (ascii.length >= 20 && !tid) {
        const potentialTid = ascii.substring(12, 20).trim();
        if (/^[0-9A-Za-z]{6,8}$/.test(potentialTid)) tid = potentialTid;
      }
      if (ascii.length >= 32 && !hostDate) {
        hostDate = ascii.substring(20, 32).trim();
      }
      if (ascii.length >= 57 && !respCode) {
        respCode = ascii.substring(53, 57).trim();
      }
      if (ascii.length >= 57) {
        const varFields = ascii.substring(57).split(String.fromCharCode(0x1C));
        if (varFields[1]) {
          const c = varFields[1].trim();
          if (!pan || pan.length < c.length) pan = c;
          if (c.startsWith('4')) cardBrand = 'visa';
          else if (/^(5[1-5]|2[2-7])/.test(c)) cardBrand = 'mastercard';
          else if (/^(50|5[6-8]|6)/.test(c)) cardBrand = 'maestro';
        }
        if (varFields[2]) {
          const f2 = varFields[2].toLowerCase();
          if (f2.includes('contactless') || f2.includes('cl mc') || f2.includes('cl visa') || f2.includes('cl ')) isNfc = true;
          if (f2.includes('mastercard') || f2.includes('mc')) cardBrand = 'mastercard';
          if (f2.includes('visa')) cardBrand = 'visa';
          if (f2.includes('maestro')) cardBrand = 'maestro';
        }
        if (varFields[3] && !rNo) {
          const pr = varFields[3].trim();
          rNo = pr.length >= 7 ? pr.slice(1) : pr.slice(0, 6);
        }
        if (ascii.toLowerCase().includes('contactless')) isNfc = true;
      }
    } catch (_) {}
  }

  // Regex fallback for text receipt
  if (!rNo) {
    const match = rawStr.match(/(?:CHITANTA\s+NR|BON\s+NR|RECEIPT\s+NO|TXN|STAN)\s*[:\.]?\s*(\d+)/i);
    if (match) rNo = match[1];
    else if (rawStr.startsWith('MOL11')) {
      const matches = rawStr.match(/\d{6}/g);
      if (matches) {
        const auth = log.authCode || '';
        const stan = matches.find(m => m !== auth && m !== '000000');
        if (stan) rNo = stan;
      }
    }
  }

  // Additional brand detection from raw text or log.cardNo
  const logStr = (JSON.stringify(log) + ' ' + rawStr).toLowerCase();
  if (cardBrand === 'generic') {
    if (logStr.includes('mastercard') || logStr.includes('mc debit') || logStr.includes('mc credit')) cardBrand = 'mastercard';
    else if (logStr.includes('visa') || logStr.includes('visa debit') || logStr.includes('visa electron')) cardBrand = 'visa';
    else if (logStr.includes('maestro')) cardBrand = 'maestro';
  }

  const cardBank = detectCardBank({
    ...log,
    cardNo: pan || log.cardNo,
    pan: pan || log.cardNo,
    cardBrand,
    paymentRef: {
      cardNo: pan || log.cardNo,
      pan: pan || log.cardNo,
      brand: cardBrand,
      raw: log.raw,
      extraFields: log.raw?.extraFields
    }
  });

  return { rNo, tid, cardBrand, cardBank, isNfc, respCode, hostDate, pan };
}

export function PosReceiptModal({ log, order, orders = [], onClose }) {
  if (!log) return null;
  const meta = extractPosMeta(log);
  const dt = log.timestamp ? new Date(log.timestamp) : null;
  const [copied, setCopied] = useState(false);

  const brandId = order?.brand || log?.brand || log?.brandId || log?.raw?.brand || log?.raw?.cart?.brand || log?.raw?.items?.[0]?.brand || orders.find(o => (o.locationId && (o.locationId === log.locationId || o.locationId === log.locationName)) || (o.locationName && (o.locationName === log.locationId || o.locationName === log.locationName)))?.brand || (
    (`${log?.locationName || ''} ${log?.locationId || ''}`.toLowerCase().includes('roll') || `${log?.locationName || ''} ${log?.locationId || ''}`.toLowerCase().includes('sushi') || `${log?.locationName || ''} ${log?.locationId || ''}`.toLowerCase().includes('oradea')) ? 'rollmaster' : 'smashme'
  );
  const locationName = log.locationName || log.locationId || 'Terminal';

  const receiptText = `
================================
         CHITANȚĂ POS
================================
Brand:   ${brandId ? brandId.toUpperCase() : '—'}
Data:    ${dt ? dt.toLocaleString('ro-RO') : '—'}
Locație: ${locationName}
Terminal (TID): ${meta.tid || log.termId || '—'}
Bon POS (STAN): ${meta.rNo || '—'}
RRN:     ${log.refNum || '—'}
Auth:    ${log.authCode || '—'}
Card:    ${meta.pan || (log.cardNo ? `****${log.cardNo.slice(-4)}` : '—')} (${meta.cardBrand.toUpperCase()})
Bancă:   ${meta.cardBank?.name || '—'}
Mod:     ${meta.isNfc ? 'CONTACTLESS' : 'CHIP/INSERT'}
Suma:    ${Number(log.amount || 0).toFixed(2)} RON
Status:  ${log.paid ? 'APROBAT (0000)' : `RESPINS (${meta.respCode || log.error || 'EROARE'})`}
================================
`.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Receipt Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white text-center relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex flex-col items-center justify-center gap-2 mb-1">
            {brandId ? (
              <div className="p-1 rounded-2xl bg-white/10 shadow-md">
                <BrandLogo brandId={brandId} size={48} className="rounded-xl" />
              </div>
            ) : (
              <div className="p-2.5 rounded-2xl bg-white/10 shadow-inner">
                <Receipt size={28} className="text-indigo-300" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-black tracking-tight">Chitanță Tranzacție POS</h3>
              <p className="text-xs text-indigo-200 mt-0.5 flex items-center justify-center gap-1.5 font-medium">
                {brandId && <span className="font-bold capitalize">{brandId}</span>}
                {brandId && <span>•</span>}
                <span>{locationName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block">Total tranzacție</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {formatThousands(Number(log.amount) || 0)} <span className="text-sm font-bold text-slate-500">RON</span>
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${log.paid ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'}`}>
                {log.paid ? 'Aprobat' : 'Respins'}
              </span>
              {!log.paid && meta.respCode && meta.respCode !== '0000' && (
                <span className="text-[11px] font-semibold text-red-500 mt-1">Eroare: {meta.respCode}</span>
              )}
            </div>
          </div>

          <div className="space-y-2.5 text-xs border-t border-b border-slate-100 dark:border-slate-800 py-3 text-slate-600 dark:text-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Dată și oră:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{dt ? dt.toLocaleString('ro-RO') : '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Terminal (TID):</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{meta.tid || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Număr bon (STAN):</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{meta.rNo || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Cod autorizare:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{log.authCode || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Referință (RRN):</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{log.refNum || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Card utilizat:</span>
              <div className="flex items-center gap-1.5">
                <CardBrandAvatar brand={meta.cardBrand} cardNo={meta.pan || log.cardNo} isNfc={meta.isNfc} cardBank={meta.cardBank} />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Bancă emitentă:</span>
              <div className="flex items-center gap-1.5">
                {meta.cardBank ? (
                  <span 
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-xs"
                    style={{
                      backgroundColor: `${meta.cardBank.color}15`,
                      color: meta.cardBank.color,
                      borderColor: `${meta.cardBank.color}35`
                    }}
                  >
                    <BankLogo bankId={meta.cardBank.id} bank={meta.cardBank} size={18} />
                    {meta.cardBank.name}
                  </span>
                ) : (
                  <span className="font-semibold text-slate-800 dark:text-slate-100">—</span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Modalitate plată:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {meta.isNfc ? 'Contactless (NFC)' : 'Card cu cip (EMV)'}
              </span>
            </div>
            {order?.orderNumber && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Comandă Kiosk:</span>
                <span className="font-bold text-slate-900 dark:text-white">#{order.orderNumber}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? 'Copiat!' : 'Copiază Bon'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all"
            >
              Închide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PosLogs({ orders = [], onGoToOrder }) {
  const { fetchWithAuth } = useAuth();
  const confirm = useConfirm();
  const [logs, setLogs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' | 'bankStats'
  const [filter, setFilter]   = useState('all');     // all | approved | declined | timeout
  const [locFilter, setLocFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [bankFilter, setBankFilter] = useState('all');
  const [isBankStatsOpen, setIsBankStatsOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('all');
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(tomorrowStr);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [settling, setSettling] = useState(false);
  const [settlementNotice, setSettlementNotice] = useState(null);
  const [receiptModalLog, setReceiptModalLog] = useState(null);
  const socketRef = useRef(null);

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const logsRes = await fetchWithAuth(`${BACKEND}/api/pos-logs?limit=500`);
      if (!logsRes.ok) throw new Error('Failed to fetch POS logs');
      
      const logsData = await logsRes.json();
      setLogs(logsData.logs || []);
    } catch (err) {
      console.error('Failed to load POS logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  // Live updates via socket
  useEffect(() => {
    const socket = io(BACKEND, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', { role: 'admin' }));
    socket.on('pos_log_new', (entry) => {
      if (!entry || !entry._id || !entry.timestamp) return;
      if ((Number(entry.amount) === 0 || !entry.amount) && !entry.paid && !entry.authCode) return;
      setLogs(prev => [entry, ...prev]);
    });
    socket.on('pos_log_updated', (data) => {
      if (!data) return;
      setLogs(prev => prev.map(l => {
        const matches = (data.orderId && (l.orderId === data.orderId || l.order_id === data.orderId)) ||
                        (data.authCode && l.authCode === data.authCode);
        if (matches) {
          return {
            ...l,
            iikoSent: data.iikoSent,
            iikoOrderId: data.iikoOrderId || l.iikoOrderId,
            iikoError: data.iikoError,
          };
        }
        return l;
      }));
    });
    socket.on('order_syrve_confirmed', (data) => {
      if (!data) return;
      setLogs(prev => prev.map(l => {
        if (l.orderId === data.orderId || l.order_id === data.orderId) {
          return { ...l, iikoSent: true, iikoOrderId: data.syrveOrderId };
        }
        return l;
      }));
    });
    socket.on('pos_settlement_result', (data) => {
      setSettling(false);
      if (data?.success) {
        setSettlementNotice({ type: 'success', text: 'Închiderea de Zi (Settlement) a fost finalizată cu succes pe POS!' });
      } else {
        setSettlementNotice({ type: 'error', text: `Settlement eșuat: ${data?.error || data?.result?.reason || 'Eroare necunoscută'}` });
      }
      setTimeout(() => setSettlementNotice(null), 10000);
    });
    return () => socket.disconnect();
  }, []);

  const handleTriggerSettlement = async () => {
    const locName = locFilter !== 'all' ? locFilter : 'toate locațiile';
    const confirmed = await confirm({
      title: 'Închidere de Zi (Settlement POS)',
      message: `Sigur doriți să declanșați Închiderea de Zi (Settlement) pe POS-ul fizic pentru ${locName}?\n\nAceastă operațiune transmite raportul zilnic către bancă și eliberează complet memoria terminalului, prevenind erorile de tip A0.`,
      confirmText: 'Da, execută Settlement',
      cancelText: 'Anulează',
      danger: false,
    });
    if (!confirmed) return;

    setSettling(true);
    setSettlementNotice({ type: 'info', text: `Comandă transmisă către terminalul POS (${locName}). Aștept confirmarea băncii...` });

    try {
      const res = await fetchWithAuth(`${BACKEND}/api/payment/pos-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: locFilter !== 'all' ? locFilter : undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Eroare la trimiterea comenzii de settlement');
      }
    } catch (err) {
      setSettling(false);
      setSettlementNotice({ type: 'error', text: `Eroare settlement: ${err.message}` });
    }
  };

  const getOrderForLog = (log) => {
    if (!log) return null;
    return orders.find(o => 
      (log.authCode && o.paymentRef?.authCode === log.authCode) || 
      (log.refNum && o.paymentRef?.refNum === log.refNum) || 
      o._id === log.orderId ||
      o._id === log.order_id ||
      (o.orderNumber && (String(o.orderNumber) === String(log.orderId) || `#${o.orderNumber}` === String(log.orderId))) ||
      (o.posOrderId && (o.posOrderId === log.orderId || o.posOrderId === log.order_id))
    );
  };

  const getLogBrand = useCallback((log) => {
    if (!log) return 'smashme';
    const order = getOrderForLog(log);
    if (order?.brand) return order.brand;
    if (log.raw?.brand) return log.raw.brand;
    if (log.brand) return log.brand;

    const matchedOrder = orders.find(o => 
      (o.locationId && (o.locationId === log.locationId || o.locationId === log.locationName)) || 
      (o.locationName && (o.locationName === log.locationId || o.locationName === log.locationName))
    );
    if (matchedOrder?.brand) return matchedOrder.brand;

    const locCombined = `${log.locationName || ''} ${log.locationId || ''}`.toLowerCase();
    if (locCombined.includes('smash') || locCombined.includes('cluj')) return 'smashme';
    if (locCombined.includes('crunch')) return 'crunch';
    if (locCombined.includes('roll') || locCombined.includes('master') || locCombined.includes('sushi') || locCombined.includes('ikura') || locCombined.includes('oradea')) return 'rollmaster';
    if (locCombined.includes('love')) return 'lovesushi';
    if (locCombined.includes('poki')) return 'pokiwoki';

    return 'smashme';
  }, [orders]);

  const isLogIikoSuccess = (log) => {
    if (log.iikoSent) return true;
    const order = getOrderForLog(log);
    return Boolean(order?.syrveOrderId);
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
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      return d >= startOfWeek;
    }
    if (period === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === 'last_month') {
      let m = now.getMonth() - 1;
      let y = now.getFullYear();
      if (m < 0) { m = 11; y--; }
      return d.getFullYear() === y && d.getMonth() === m;
    }
    if (period === 'this_year') {
      return d.getFullYear() === now.getFullYear();
    }
    if (period === 'custom') {
      if (!customStart && !customEnd) return true;
      let startValid = true;
      let endValid = true;
      if (customStart) {
        const sd = new Date(customStart);
        sd.setHours(0, 0, 0, 0);
        if (d < sd) startValid = false;
      }
      if (customEnd) {
        const ed = new Date(customEnd);
        ed.setHours(23, 59, 59, 999);
        if (d > ed) endValid = false;
      }
      return startValid && endValid;
    }
    return true;
  };

  // Helper to detect failed payment attempts that were quickly retried and approved for the same amount & location
  const isSupersededRetry = useCallback((log, allLogs) => {
    if (log.status === 'approved' || log.paid === true) return false;
    const logAmt = parseFloat(log.amount) || 0;
    if (logAmt <= 0) return false;
    if (!log.timestamp) return false;
    const logTime = new Date(log.timestamp).getTime();
    if (isNaN(logTime)) return false;
    const logLoc = (log.locationId || '').trim();

    return allLogs.some(other => {
      if ((other._id || other.id) === (log._id || log.id)) return false;
      if (other.status !== 'approved' && other.paid !== true) return false;
      const otherAmt = parseFloat(other.amount) || 0;
      if (Math.abs(logAmt - otherAmt) > 0.05) return false;
      const otherLoc = (other.locationId || '').trim();
      if (logLoc && otherLoc && logLoc !== otherLoc) return false;
      if (!other.timestamp) return false;
      const otherTime = new Date(other.timestamp).getTime();
      if (isNaN(otherTime)) return false;
      const diffMs = otherTime - logTime;
      // Approved transaction happened within 2 minutes (120 seconds) after the failed attempt
      return diffMs >= -5000 && diffMs <= 120000;
    });
  }, []);

  // ── Filtered by Period, Location & Brands for StatCards ───────
  const periodFilteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (!l || !l._id || !l.timestamp) return false;
      if ((Number(l.amount) === 0 || !l.amount) && l.status !== 'approved' && !l.paid && !l.authCode) return false;
      if (isSupersededRetry(l, logs)) return false;
      if (locFilter !== 'all' && l.locationId !== locFilter) return false;
      if (brandFilter !== 'all' && getLogBrand(l) !== brandFilter) return false;
      if (!isDateInPeriod(l.timestamp, periodFilter)) return false;
      return true;
    });
  }, [logs, locFilter, brandFilter, periodFilter, customStart, customEnd, orders, isSupersededRetry, getLogBrand]);

  // Derived stats strictly reflect the selected period, location and brand
  const derivedStats = useMemo(() => {
    return {
      total: periodFilteredLogs.length,
      approved: periodFilteredLogs.filter(l => l.status === 'approved' || l.paid === true).length,
      declined: periodFilteredLogs.filter(l => (l.status === 'declined' || l.status === 'timeout' || (l.status !== 'approved' && l.paid === false)) && !isLogCancelled(l)).length,
      cancelled: periodFilteredLogs.filter(l => isLogCancelled(l)).length,
      iikoFailed: periodFilteredLogs.filter(l => (l.status === 'approved' || l.paid === true) && !isLogIikoSuccess(l)).length
    };
  }, [periodFilteredLogs, isLogIikoSuccess]);

  // ── Derived Bank Breakdown for Card Payments ───────
  const bankStats = useMemo(() => {
    const map = {};
    Object.keys(BANK_CONFIG).forEach(k => {
      map[k] = { 
        ...BANK_CONFIG[k], 
        count: 0, 
        volume: 0,
        brands: { mastercard: 0, visa: 0, maestro: 0, other: 0 }
      };
    });

    let totalCardCount = 0;
    let totalCardVol = 0;
    const networkStats = {
      mastercard: { name: 'Mastercard', count: 0, volume: 0 },
      visa: { name: 'Visa', count: 0, volume: 0 },
      maestro: { name: 'Maestro', count: 0, volume: 0 },
      other: { name: 'Altele', count: 0, volume: 0 }
    };

    periodFilteredLogs.forEach(l => {
      if (l.status === 'approved' || l.paid === true) {
        const meta = extractPosMeta(l);
        const bankKey = meta.cardBank?.id || 'other';
        const amt = Number(l.amount) || 0;

        totalCardCount += 1;
        totalCardVol += amt;

        const bKey = meta.cardBrand === 'mastercard' ? 'mastercard' : 
                     (meta.cardBrand === 'visa' ? 'visa' : 
                     (meta.cardBrand === 'maestro' ? 'maestro' : 'other'));
        networkStats[bKey].count += 1;
        networkStats[bKey].volume += amt;

        if (!map[bankKey]) {
          map[bankKey] = {
            id: bankKey,
            name: meta.cardBank?.name || 'Alte Bănci',
            shortName: meta.cardBank?.shortName || 'Altele',
            color: meta.cardBank?.color || '#64748b',
            count: 0,
            volume: 0,
            brands: { mastercard: 0, visa: 0, maestro: 0, other: 0 }
          };
        }
        map[bankKey].count += 1;
        map[bankKey].volume += amt;
        if (!map[bankKey].brands) map[bankKey].brands = { mastercard: 0, visa: 0, maestro: 0, other: 0 };
        map[bankKey].brands[bKey] = (map[bankKey].brands[bKey] || 0) + 1;
      }
    });

    const list = Object.values(map).filter(b => b.count > 0).sort((a, b) => b.volume - a.volume);
    const totalVol = list.reduce((sum, b) => sum + b.volume, 0);
    const avgTicket = totalCardCount > 0 ? (totalVol / totalCardCount) : 0;
    const topBank = list.length > 0 ? list[0] : null;

    return { list, totalVol, totalCount: totalCardCount, avgTicket, topBank, networkStats };
  }, [periodFilteredLogs]);

  // Table filtering adds status and bank filters on top of periodFilteredLogs
  const filtered = useMemo(() => {
    return periodFilteredLogs.filter(l => {
      if (filter !== 'all') {
        if (filter === 'approved') return l.status === 'approved' || l.paid === true;
        if (filter === 'cancelled') return isLogCancelled(l);
        if (filter === 'declined') return (l.status === 'declined' || (l.status !== 'approved' && l.paid === false)) && !isLogCancelled(l);
        if (filter === 'timeout') return l.status === 'timeout';
        if (filter === 'iikoFailed') return (l.status === 'approved' || l.paid === true) && !isLogIikoSuccess(l);
        if (l.status !== filter) return false;
      }
      if (bankFilter !== 'all') {
        const meta = extractPosMeta(l);
        if (meta.cardBank?.id !== bankFilter) return false;
      }
      return true;
    });
  }, [periodFilteredLogs, filter, bankFilter, isLogIikoSuccess]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Unique locations and brands for filter
  const locations = [...new Set(logs.map(l => l.locationId).filter(Boolean))];
  const brands = [...new Set(logs.map(l => getLogBrand(l)).filter(Boolean))];

  const extractReceiptNo = (log) => extractPosMeta(log).rNo;

  const prepareExportData = () => {
    return filtered.map(log => {
      const order = getOrderForLog(log);
      const meta = extractPosMeta(log);
      const isSuccess = isLogIikoSuccess(log);
      return {
        'Data/Ora': log.timestamp ? new Date(log.timestamp).toLocaleString('ro-RO') : '',
        'Brand': order?.brand || '',
        'ID Comanda': order?.orderNumber ? `#${order.orderNumber}` : (log.orderId || ''),
        'Nr. Bon': meta.rNo || '',
        'Locatie': log.locationId || '',
        'TID': meta.tid || '',
        'Suma (RON)': Number((Number(log.amount) || 0).toFixed(2)),
        'Status POS': isLogCancelled(log) ? 'Anulat de client' : (STATUS_CONFIG[log.status]?.label || log.status),
        'Auth Code': log.authCode || '',
        'Tip Card': meta.cardBrand ? meta.cardBrand.toUpperCase() : 'CARD',
        'Bancă Emitentă': meta.cardBank?.name || '—',
        'Card': meta.pan || (log.cardNo ? `****${log.cardNo.slice(-4)}` : ''),
        'Mod Plata': meta.isNfc ? 'Contactless' : 'Chip',
        'Ref#': log.refNum || '',
        'iiko': log.paid ? (isSuccess ? 'Trimis' : 'Netrimis') : '',
        'Eroare': log.error || ''
      };
    });
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    if (data.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "POS Logs");
    XLSX.writeFile(workbook, `pos_logs_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const periodLabel = 
    periodFilter === 'today' ? 'Total POS Azi' : 
    periodFilter === 'yesterday' ? 'Total POS Ieri' : 
    periodFilter === 'this_week' ? 'Total POS Săpt.' : 
    periodFilter === 'this_month' ? 'Total POS Lună' : 
    periodFilter === 'last_month' ? 'Total POS Luna Trec.' : 
    periodFilter === 'this_year' ? 'Total POS An' : 
    'Total POS Logs';

  return (
    <div className="space-y-6">
      {/* Settlement Alert Notice */}
      {settlementNotice && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-bold shadow-md animate-fadeIn ${
          settlementNotice.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-200' 
            : settlementNotice.type === 'info'
            ? 'bg-blue-50 border border-blue-300 text-blue-800 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-200'
            : 'bg-red-50 border border-red-300 text-red-800 dark:bg-red-950/60 dark:border-red-700 dark:text-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {settlementNotice.type === 'success' ? <CheckCircle2 size={18} /> : settlementNotice.type === 'info' ? <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <AlertTriangle size={18} />}
            <span>{settlementNotice.text}</span>
          </div>
          <button onClick={() => setSettlementNotice(null)} className="p-1 hover:bg-black/10 rounded-lg cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Header with Segmented Navigation Tab & Global Period/Location Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Segmented Tab Pill */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-inner">
          <button
            type="button"
            onClick={() => { setActiveTab('logs'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CreditCard size={15} />
            <span>Jurnal Tranzacții POS</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black">
              {derivedStats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bankStats')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'bankStats'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="text-sm">🏦</span>
            <span>Statistici Bănci & Carduri</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-black">
              {bankStats.list.length} bănci • {formatThousands(bankStats.totalVol)} lei
            </span>
          </button>
        </div>

        {/* Global Filter Bar (Period, Custom Date, Location, Brand, Export) */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {/* Period Filter */}
          <select
            value={periodFilter}
            onChange={e => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
            className="h-8.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
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
              <input 
                type="date" 
                value={customStart} 
                onChange={e => {setCustomStart(e.target.value); setCurrentPage(1);}} 
                className="h-8.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500" 
              />
              <span className="text-slate-400 font-bold">-</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={e => {setCustomEnd(e.target.value); setCurrentPage(1);}} 
                className="h-8.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
          )}

          {locations.length > 0 && (
            <select
              value={locFilter}
              onChange={e => { setLocFilter(e.target.value); setCurrentPage(1); }}
              className="h-8.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            >
              <option value="all">Toate locațiile</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}

          {brands.length > 0 && (
            <select
              value={brandFilter}
              onChange={e => { setBrandFilter(e.target.value); setCurrentPage(1); }}
              className="h-8.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 capitalize shadow-2xs"
            >
              <option value="all">Toate brandurile</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          {/* Settlement POS button */}
          <button
            onClick={handleTriggerSettlement}
            disabled={settling}
            className="px-3 h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Trimite comanda de Închidere de Zi (Settlement) către POS"
          >
            <RotateCcw size={13} className={settling ? 'animate-spin text-blue-600' : ''} />
            <span>Settlement POS</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="px-3 h-8.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Exportă tranzacțiile în Excel"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: JURNAL TRANZACȚII POS ─── */}
      {activeTab === 'logs' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Stats Cards - Identical to Dashboard StatCard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard 
              label={periodLabel} 
              value={derivedStats.total} 
              color="#6366f1" 
              icon={CreditCard}
              onClick={() => { setFilter('all'); setCurrentPage(1); }}
              active={filter === 'all'}
            />
            <StatCard 
              label="Aprobate" 
              value={derivedStats.approved} 
              color="#059669" 
              icon={CheckCircle2}
              onClick={() => { setFilter(filter === 'approved' ? 'all' : 'approved'); setCurrentPage(1); }}
              active={filter === 'approved'}
            />
            <StatCard 
              label="Respinse" 
              value={derivedStats.declined} 
              color="#ef4444" 
              icon={XCircle}
              onClick={() => { setFilter(filter === 'declined' ? 'all' : 'declined'); setCurrentPage(1); }}
              active={filter === 'declined'}
            />
            <StatCard 
              label="iiko Eșuat" 
              value={derivedStats.iikoFailed} 
              color="#f97316" 
              icon={AlertTriangle}
              onClick={() => { setFilter(filter === 'iikoFailed' ? 'all' : 'iikoFailed'); setCurrentPage(1); }}
              active={filter === 'iikoFailed'}
              highlight={derivedStats.iikoFailed > 0}
            />
          </div>

          {/* Quick Bank Filter Banner if a bank is selected */}
          {bankFilter !== 'all' && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl text-xs font-bold text-blue-900 dark:text-blue-200 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span>Filtru bancar activ:</span>
                <BankLogo bankId={bankFilter} size={20} />
                <span className="font-extrabold">{BANK_CONFIG[bankFilter]?.name || bankFilter}</span>
                <span className="opacity-75">
                  ({filtered.length} tranzacții găsite)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('bankStats')}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Vezi analiză bancară</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  onClick={() => { setBankFilter('all'); setCurrentPage(1); }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Resetează filtru ✕
                </button>
              </div>
            </div>
          )}

          {/* Table Controls (Status pills + Bank selector) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all',       label: 'Toate' },
                { id: 'approved',  label: 'Aprobate' },
                { id: 'declined',  label: 'Respinse' },
                { id: 'cancelled', label: 'Anulate de client' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { setFilter(f.id); setCurrentPage(1); }}
                  className={`px-3.5 h-8.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    filter === f.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {/* Bank Filter Dropdown */}
              <select
                value={bankFilter}
                onChange={e => { setBankFilter(e.target.value); setCurrentPage(1); }}
                className="h-8.5 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              >
                <option value="all">Toate băncile</option>
                {Object.values(BANK_CONFIG).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="text-xs font-bold text-slate-400">
              {filtered.length} tranzacții afișate (pag. {currentPage} din {totalPages})
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12">Nr. Crt.</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Data / Ora</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Brand / Locație</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">ID Comandă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Sumă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status POS</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Auth Code</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Card / Bancă</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Ref#</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">iiko</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Eroare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                  Nicio tranzacție POS înregistrată
                </td>
              </tr>
            ) : paginated.map((log, idx) => {
              const isCancelled = isLogCancelled(log);
              const sc = isCancelled ? STATUS_CONFIG.cancelled : (STATUS_CONFIG[log.status] || STATUS_CONFIG.declined);
              const dt = log.timestamp ? new Date(log.timestamp) : null;
              const order = getOrderForLog(log);
              const meta = extractPosMeta(log);
              return (
                <tr key={log._id} onClick={() => onGoToOrder && order && onGoToOrder(order._id)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-slate-500">
                    {(currentPage - 1) * itemsPerPage + idx + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {dt ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold">{dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="font-bold">{dt.toLocaleDateString('ro-RO')}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 items-start">
                      {(() => {
                        const effectiveBrand = getLogBrand(log);
                        return effectiveBrand ? (
                          <div className="flex items-center gap-2">
                            <BrandLogo brandId={effectiveBrand} size={20} />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{effectiveBrand}</span>
                          </div>
                        ) : <span className="text-slate-400">—</span>;
                      })()}
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {log.locationName || (log.locationId === 'cluj1' ? 'SmashMe Cluj' : (log.locationId === 'cluj2' ? 'SmashMe Cluj 2' : (log.locationId === 'sm-brasov' ? 'SmashMe Brașov' : (log.locationId || 'Locație necunoscută'))))}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5 items-start">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 select-all">
                        {order?.orderNumber ? `#${order.orderNumber}` : (log.orderId?.startsWith('kiosk-') ? `Kiosk #${log.orderId.replace('kiosk-', '').slice(-4)}` : (log.orderId || '—'))}
                      </span>
                      {meta.rNo ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReceiptModalLog(log);
                          }}
                          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-all cursor-pointer"
                          title="Vezi chitanță POS completă (STAN)"
                        >
                          #{meta.rNo}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReceiptModalLog(log);
                          }}
                          className="text-[11px] font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-1"
                          title="Vezi chitanță POS completă"
                        >
                          <Receipt size={12} />
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                    {formatThousands(Number(log.amount) || 0)} RON
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center shadow-xs"
                      style={{ backgroundColor: sc.bg, color: sc.color }}
                    >
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
                    {log.authCode || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <CardBrandAvatar brand={meta.cardBrand} cardNo={meta.pan || log.cardNo} isNfc={meta.isNfc} cardBank={meta.cardBank} />
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      <span>{log.refNum || '—'}</span>
                      {meta.isNfc ? (
                        <span className="text-[10px] text-blue-500 font-bold inline-flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                            <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                            <line x1="12" y1="20" x2="12.01" y2="20"/>
                          </svg>
                          Contactless
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">Chip / Insert</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {log.paid ? (() => {
                      const isSuccess = isLogIikoSuccess(log);
                      const iikoId = log.iikoOrderId || order?.syrveOrderId;

                      const successMessage = (
                        <div className="flex flex-col gap-4 text-left mt-2">
                          <p className="text-slate-600 dark:text-slate-300">Comanda a fost trimisă cu succes în iiko.</p>
                          {iikoId && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/50 flex flex-col gap-1.5 mt-1">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">ID Comandă iiko</span>
                              <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-950 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-800">
                                <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">
                                  {iikoId}
                                </span>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(iikoId);
                                    const btn = e.currentTarget;
                                    const originalHTML = btn.innerHTML;
                                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#059669" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
                                    setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors shrink-0"
                                  title="Copiază ID iiko"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );

                      const errorMessage = (
                        <div className="flex flex-col gap-3 text-left mt-2">
                          <p className="text-slate-600 dark:text-slate-300">Eroare la trimiterea comenzii în iiko:</p>
                          <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900/50">
                            <span className="font-semibold text-xs text-red-600 dark:text-red-400 break-all select-all">
                              {log.iikoError || 'Eroare necunoscută. Vă rugăm să verificați manual.'}
                            </span>
                          </div>
                        </div>
                      );

                      return (
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirm(
                                isSuccess ? successMessage : errorMessage,
                                {
                                  title: isSuccess ? 'Status iiko: Succes' : 'Status iiko: Eroare',
                                  type: isSuccess ? 'info' : 'error',
                                  hideCancel: true,
                                  danger: !isSuccess,
                                  okLabel: 'Închide'
                                }
                              );
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-transform active:scale-95 cursor-pointer shadow-sm ${isSuccess ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                          >
                            {isSuccess ? 'Trimis' : 'Eroare'}
                          </button>
                        </div>
                      );
                    })() : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {log.error ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirm(
                            <div className="flex flex-col gap-3 text-left mt-2">
                              <p className="text-slate-600 dark:text-slate-300">
                                {isCancelled ? 'Detalii anulare comandă:' : 'Detaliu eroare POS:'}
                              </p>
                              <div className={`${isCancelled ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700' : 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50'} p-3 rounded-xl border`}>
                                <span className={`font-semibold text-sm ${isCancelled ? 'text-slate-700 dark:text-slate-300' : 'text-red-600 dark:text-red-400'} break-all select-all whitespace-pre-wrap`}>
                                  {log.error}
                                </span>
                              </div>
                            </div>,
                            { 
                              title: isCancelled ? 'Comandă Anulată de Client' : 'Eroare POS', 
                              type: isCancelled ? 'info' : 'error',
                              danger: !isCancelled, 
                              hideCancel: true, 
                              okLabel: 'Închide' 
                            }
                          );
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-transform active:scale-95 cursor-pointer shadow-sm ${
                          isCancelled 
                            ? 'bg-slate-500 hover:bg-slate-600 text-white' 
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        Detalii
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
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
    </div>
  )}

      {/* ─── TAB 2: STATISTICI BĂNCI & CARDURI ─── */}
      {activeTab === 'bankStats' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 1. High-Level KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* KPI 1: Volum Total Carduri */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Volum Total Carduri
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Landmark size={18} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {formatThousands(bankStats.totalVol)}
                </span>
                <span className="text-xs font-bold text-slate-400">RON</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                din {bankStats.totalCount} plăți aprobate
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            </div>

            {/* KPI 2: Plăți Card Aprobate */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tranzacții Aprobate
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {bankStats.totalCount}
                </span>
                <span className="text-xs font-bold text-slate-400">plăți</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                la {bankStats.list.length} bănci emitente diferite
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            </div>

            {/* KPI 3: Valoare Medie / Bon Card (AOV) */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ticket Mediu / Card
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {bankStats.avgTicket.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-slate-400">RON / bon</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                cheltuială medie per client la POS
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            </div>

            {/* KPI 4: Bancă Lider */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Bancă Lider (Volum)
                </span>
                {bankStats.topBank ? (
                  <BankLogo bankId={bankStats.topBank.id} size={28} className="shadow-xs shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                    <ShieldCheck size={18} />
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate max-w-[170px]">
                  {bankStats.topBank ? bankStats.topBank.shortName : '—'}
                </span>
                {bankStats.topBank && bankStats.totalVol > 0 && (
                  <span className="text-xs font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                    {((bankStats.topBank.volume / bankStats.totalVol) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                {bankStats.topBank ? `${formatThousands(bankStats.topBank.volume)} RON • ${bankStats.topBank.count} tranzacții` : 'Nicio tranzacție'}
              </div>
              <div 
                className="absolute bottom-0 left-0 right-0 h-1" 
                style={{ backgroundColor: bankStats.topBank?.color || '#3b82f6' }}
              />
            </div>
          </div>

          {/* 2. Visual Multi-Segment Distribution Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Distribuție Volum per Bancă Emitentă
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                {bankStats.list.length} bănci identificate
              </span>
            </div>

            {/* The 3D multi-color segmented progress bar */}
            {bankStats.totalVol > 0 ? (
              <div className="w-full h-4 sm:h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex shadow-inner p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                {bankStats.list.map(b => {
                  const pct = (b.volume / bankStats.totalVol) * 100;
                  if (pct < 0.3) return null;
                  return (
                    <div
                      key={b.id}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: b.color,
                      }}
                      className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 relative group cursor-pointer hover:opacity-90"
                      onClick={() => {
                        setBankFilter(b.id);
                        setActiveTab('logs');
                        setCurrentPage(1);
                      }}
                      title={`${b.name}: ${formatThousands(b.volume)} RON (${pct.toFixed(1)}%) • ${b.count} tranzacții`}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                Nu există plăți cu cardul în perioada selectată.
              </div>
            )}

            {/* Quick Badges below bar */}
            <div className="flex flex-wrap gap-2 pt-1">
              {bankStats.list.map(b => {
                const pct = bankStats.totalVol > 0 ? ((b.volume / bankStats.totalVol) * 100).toFixed(1) : '0';
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      setBankFilter(b.id);
                      setActiveTab('logs');
                      setCurrentPage(1);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer hover:scale-[1.02] shadow-2xs group"
                  >
                    <BankLogo bankId={b.id} bank={b} size={22} className="shrink-0" />
                    <span>{b.shortName}</span>
                    <span className="text-[11px] font-extrabold px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                      {pct}%
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {formatThousands(b.volume)} lei
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Rețele Carduri (Mastercard vs. Visa vs. Maestro vs. Altele) */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart size={18} className="text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Rețele de Plată (Card Brand)
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                Mastercard vs. Visa vs. Maestro
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              {[
                { 
                  id: 'mastercard', 
                  name: 'Mastercard', 
                  data: bankStats.networkStats?.mastercard, 
                  color: '#eb001b',
                  avatar: (
                    <div className="w-8 h-5 rounded bg-black border border-slate-700 flex items-center justify-center shrink-0">
                      <svg width="20" height="12" viewBox="0 0 24 15" fill="none">
                        <circle cx="7.5" cy="7.5" r="7" fill="#EB001B"/>
                        <circle cx="16.5" cy="7.5" r="7" fill="#F79E1B"/>
                        <path d="M12 2.2a6.98 6.98 0 0 1 0 10.6 6.98 6.98 0 0 1 0-10.6Z" fill="#FF5F00"/>
                      </svg>
                    </div>
                  )
                },
                { 
                  id: 'visa', 
                  name: 'Visa', 
                  data: bankStats.networkStats?.visa, 
                  color: '#1a1f71',
                  avatar: (
                    <div className="w-8 h-5 rounded bg-[#102468] border border-blue-600/40 flex items-center justify-center px-1 shrink-0">
                      <span className="text-[10px] font-black text-white italic tracking-wider">VISA</span>
                    </div>
                  )
                },
                { 
                  id: 'maestro', 
                  name: 'Maestro', 
                  data: bankStats.networkStats?.maestro, 
                  color: '#0061a8',
                  avatar: (
                    <div className="w-8 h-5 rounded bg-black border border-slate-700 flex items-center justify-center shrink-0">
                      <svg width="20" height="12" viewBox="0 0 24 15" fill="none">
                        <circle cx="7.5" cy="7.5" r="7" fill="#0061A8"/>
                        <circle cx="16.5" cy="7.5" r="7" fill="#EB001B"/>
                        <path d="M12 2.2a6.98 6.98 0 0 1 0 10.6 6.98 6.98 0 0 1 0-10.6Z" fill="#6C6BBA"/>
                      </svg>
                    </div>
                  )
                },
                { 
                  id: 'other', 
                  name: 'Card Bancar / Altele', 
                  data: bankStats.networkStats?.other, 
                  color: '#64748b',
                  avatar: (
                    <div className="w-8 h-5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <CreditCard size={12} />
                    </div>
                  )
                }
              ].map(net => {
                const count = net.data?.count || 0;
                const vol = net.data?.volume || 0;
                const pct = bankStats.totalCount > 0 ? ((count / bankStats.totalCount) * 100).toFixed(1) : '0';
                return (
                  <div key={net.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {net.avatar}
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{net.name}</span>
                      </div>
                      <span className="text-[11px] font-black px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {formatThousands(vol)} RON
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {count} plăți
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Grid de Carduri Bănci Emitente (Detailed Bank Cards) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>🏦</span>
                <span>Analiză Bănci Emitente ({bankStats.list.length})</span>
              </h3>
              <span className="text-xs text-slate-400 font-semibold">
                Ordonate descrescător după volumul încasat
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankStats.list.map((b, idx) => {
                const pct = bankStats.totalVol > 0 ? ((b.volume / bankStats.totalVol) * 100).toFixed(1) : '0';
                const avg = b.count > 0 ? (b.volume / b.count).toFixed(2) : '0.00';
                const maxVol = bankStats.topBank?.volume || 1;
                const relativeProgress = Math.min(100, Math.round((b.volume / maxVol) * 100));

                return (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group"
                  >
                    {/* Top bank badge / rank */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BankLogo bankId={b.id} bank={b} size={42} className="shadow-xs shrink-0" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                              {b.name}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {b.shortName}
                            </span>
                            <span className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400">
                              #{idx + 1} în top
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black shadow-2xs"
                          style={{
                            backgroundColor: `${b.color}18`,
                            color: b.color,
                            border: `1px solid ${b.color}35`
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Middle: Volume and Metrics */}
                    <div className="my-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2 text-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Volum</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                          {formatThousands(b.volume)} lei
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Tranzacții</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                          {b.count} plăți
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Medie / Bon</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                          {avg} lei
                        </span>
                      </div>
                    </div>

                    {/* Relative volume progress bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${relativeProgress}%`,
                          backgroundColor: b.color
                        }}
                      />
                    </div>

                    {/* Action button: Drill-down to transactions */}
                    <button
                      onClick={() => {
                        setBankFilter(b.id);
                        setActiveTab('logs');
                        setCurrentPage(1);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 dark:bg-slate-800/60 dark:hover:bg-blue-950/40 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700/80 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer group-hover:border-blue-300 dark:group-hover:border-blue-700"
                    >
                      <span>Vezi tranzacțiile în Jurnal</span>
                      <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Tabel Comparativ Bănci */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Clasament Detaliat Bănci Emitente
              </h4>
              <span className="text-xs font-semibold text-slate-400">
                {bankStats.list.length} bănci • {bankStats.totalCount} tranzacții analizate
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Bancă Emitentă</th>
                    <th className="px-4 py-3 text-right">Tranzacții</th>
                    <th className="px-4 py-3 text-right">Pondere Tranzacții</th>
                    <th className="px-4 py-3 text-right">Volum Total (RON)</th>
                    <th className="px-4 py-3 text-right">Pondere Volum</th>
                    <th className="px-4 py-3 text-right">Ticket Mediu</th>
                    <th className="px-4 py-3 text-center w-28">Acțiune</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {bankStats.list.map((b, idx) => {
                    const countPct = bankStats.totalCount > 0 ? ((b.count / bankStats.totalCount) * 100).toFixed(1) : '0';
                    const volPct = bankStats.totalVol > 0 ? ((b.volume / bankStats.totalVol) * 100).toFixed(1) : '0';
                    const avg = b.count > 0 ? (b.volume / b.count).toFixed(2) : '0.00';

                    return (
                      <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-black text-slate-400 text-center">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <BankLogo bankId={b.id} bank={b} size={26} className="shrink-0" />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white leading-tight">
                                {b.name}
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {b.shortName}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-slate-200">
                          {b.count}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-semibold">
                          {countPct}%
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">
                          {formatThousands(b.volume)} lei
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black"
                            style={{
                              backgroundColor: `${b.color}15`,
                              color: b.color,
                            }}
                          >
                            {volPct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                          {avg} lei
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setBankFilter(b.id);
                              setActiveTab('logs');
                              setCurrentPage(1);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-colors text-[11px] font-bold cursor-pointer"
                          >
                            Filtrează
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {receiptModalLog && (
        <PosReceiptModal
          log={receiptModalLog}
          order={getOrderForLog(receiptModalLog)}
          orders={orders}
          onClose={() => setReceiptModalLog(null)}
        />
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
          ? 'border-orange-300 dark:border-orange-500/50'
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
