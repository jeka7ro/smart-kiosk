import React, { useState } from 'react';
import BrandLogo from './BrandLogo';
import BankLogo from './BankLogo';
import { TrendingUp, PieChart, CreditCard, Clock, Banknote, Calendar, Flame, Trophy, Award, ShoppingBag, Utensils, ChevronDown, ChevronUp, Monitor, Sparkles, Layers } from 'lucide-react';
import { formatThousands, formatLocationAndKiosk } from '../utils/formatters';
import { detectCardBrand, detectCardBank, BANK_CONFIG } from '../utils/cardUtils';
import { BRAND_COLORS, BRAND_KIOSK_PALETTES, normalizeBrandKey, getBrandColor, getBrandLabel } from '../utils/brandTheme';
export { detectCardBrand, detectCardBank, BANK_CONFIG };

/**
 * 1. GRAFIC 3D: Evoluție Vânzări & Încasări (3D Spline Ribbon with Isometric Depth)
 */
export function SalesTrendChart3D({ 
  orders = [], 
  comparisonOrders = [],
  allOrders = [],
  isComparisonLoading = false,
  period = 'today',
  customStart = '',
  customEnd = '',
  selectedLocation = 'all',
  selectedBrands = [],
  selectedPayment = 'all',
  selectedProduct = '',
  selectedHour = null,
  onSelectHour = () => {},
  selectedDay = null,
  onSelectDay = () => {}
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [seriesFilter, setSeriesFilter] = useState('both'); // 'both' (Combined Column+Line default) | 'revenue' | 'count'
  const [compareTarget, setCompareTarget] = useState('yesterday'); // 'none' | 'yesterday' (prev day / prev same period) | 'lastMonth' (same day last month, single-day only)
  const [multiDayMode, setMultiDayMode] = useState('cumulative'); // 'cumulative' (Total cumulat comparativ) | 'daily' (Pe zile / pe luni individual)
  const showBars = seriesFilter === 'both' || seriesFilter === 'revenue';
  const showLines = seriesFilter === 'both' || seriesFilter === 'count';

  // Helper potrivire filtre active pentru comparație (locație, brand, plată, produs)
  const matchesLocation = React.useCallback((o) => {
    if (!selectedLocation || selectedLocation === 'all') return true;
    return (o.locationName || o.locationId) === selectedLocation;
  }, [selectedLocation]);

  const matchesBrand = React.useCallback((o) => {
    if (!selectedBrands || selectedBrands.length === 0) return true;
    const b = (o.brand || '').toLowerCase();
    return selectedBrands.includes(b);
  }, [selectedBrands]);

  const matchesPayment = React.useCallback((o) => {
    if (!selectedPayment || selectedPayment === 'all') return true;
    const isCard = o.paymentMethod === 'card' || !!o.paymentRef?.authCode;
    if (selectedPayment === 'card') return isCard;
    if (selectedPayment === 'cash') return !isCard;
    if (selectedPayment === 'visa') return isCard && detectCardBrand(o) === 'visa';
    if (selectedPayment === 'mastercard') return isCard && detectCardBrand(o) === 'mastercard';
    if (selectedPayment.startsWith('bank_')) {
      const bankId = selectedPayment.replace('bank_', '');
      return isCard && detectCardBank(o).id === bankId;
    }
    return true;
  }, [selectedPayment]);

  const matchesProduct = React.useCallback((o) => {
    if (!selectedProduct) return true;
    const q = selectedProduct.toLowerCase().trim();
    const items = Array.isArray(o.items) ? o.items : [];
    return items.some(it => (it.name || '').toLowerCase().includes(q));
  }, [selectedProduct]);

  // Determină tipul perioadei: 1 singură zi (Azi / Ieri / Interval 1 zi) vs Perioadă multi-zi (Săpt. / Lună / An / Interval)
  const isCustomSingleDay = Boolean(period === 'custom' && customStart && customEnd && customStart === customEnd);
  const isHourly = period === 'today' || period === 'yesterday' || isCustomSingleDay;
  const isCumulativeView = isHourly || multiDayMode === 'cumulative';
  const isCompared = compareTarget !== 'none';
  const isLastMonth = isHourly && compareTarget === 'lastMonth';

  // Calcul dinamic date de referință & etichete pentru 1 zi vs aceeași perioadă anterioară
  const periodMeta = React.useMemo(() => {
    const now = new Date();
    const fmtDM = (d) => d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
    const parseYMD = (s) => {
      if (!s) return null;
      const [y, m, d] = s.split('-').map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    };

    const baseDay = period === 'yesterday'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      : (isCustomSingleDay && parseYMD(customStart)) || new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const prevDay = new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate() - 1);
    const lmMonth = baseDay.getMonth() === 0 ? 11 : baseDay.getMonth() - 1;
    const lmYear = baseDay.getMonth() === 0 ? baseDay.getFullYear() - 1 : baseDay.getFullYear();
    const lmMaxDay = new Date(lmYear, lmMonth + 1, 0).getDate();
    const lmDay = new Date(lmYear, lmMonth, Math.min(baseDay.getDate(), lmMaxDay));

    const prevDayLabel = period === 'today' ? 'Ieri' : fmtDM(prevDay);
    const lastMonthLabel = fmtDM(lmDay);

    if (period === 'today') {
      return { primaryLabel: 'Azi', prevPeriodLabel: 'Ieri', prevDay, lmDay, lastMonthLabel };
    }
    if (period === 'yesterday') {
      return { primaryLabel: 'Ieri', prevPeriodLabel: prevDayLabel, prevDay, lmDay, lastMonthLabel };
    }
    if (isCustomSingleDay) {
      return { primaryLabel: fmtDM(baseDay), prevPeriodLabel: prevDayLabel, prevDay, lmDay, lastMonthLabel };
    }
    if (period === 'thisWeek') {
      return { primaryLabel: 'Săpt. curentă', prevPeriodLabel: 'Săpt. trec.', prevDay, lmDay, lastMonthLabel };
    }
    if (period === 'lastWeek') {
      return { primaryLabel: 'Săpt. trec.', prevPeriodLabel: 'Săpt. ant.', prevDay, lmDay, lastMonthLabel };
    }
    if (period === 'thisMonth') {
      return { primaryLabel: 'Luna curentă', prevPeriodLabel: 'Luna trec.', prevDay, lmDay, lastMonthLabel };
    }
    if (period === 'lastMonth') {
      return { primaryLabel: 'Luna trec.', prevPeriodLabel: 'Acum 2 luni', prevDay, lmDay, lastMonthLabel };
    }
    if (period === 'thisYear') {
      return { primaryLabel: 'Anul curent', prevPeriodLabel: 'Anul trec.', prevDay, lmDay, lastMonthLabel };
    }
    return { primaryLabel: 'Perioadă', prevPeriodLabel: 'Per. ant.', prevDay, lmDay, lastMonthLabel };
  }, [period, customStart, isCustomSingleDay]);

  // Configurație vizuală: Chihlimbar pt ziua/perioada anterioară vs Violet pt aceeași zi din luna trecută (doar pe 1 zi)
  const compareConfig = React.useMemo(() => {
    if (isLastMonth) {
      return {
        id: 'lastMonth',
        name: `Luna trecută (${periodMeta.lastMonthLabel})`,
        shortLabel: periodMeta.lastMonthLabel,
        color: '#a855f7',
      };
    }
    return {
      id: 'yesterday',
      name: periodMeta.prevPeriodLabel,
      shortLabel: periodMeta.prevPeriodLabel,
      color: '#f59e0b',
    };
  }, [isLastMonth, periodMeta]);

  // Pool curat combinat din comparisonOrders (încărcate real pentru perioada de comparație) + allOrders (filtrat după locație, brand, plată, produs)
  const cleanAllFilteredOrders = React.useMemo(() => {
    const pool = [...(Array.isArray(comparisonOrders) ? comparisonOrders : []), ...(Array.isArray(allOrders) ? allOrders : [])];
    if (pool.length === 0) return [];
    const seen = new Set();
    return pool.filter(o => {
      if (!o || o.status === 'cancelled' || !o.createdAt) return false;
      const key = o._id || o.id || o.orderNumber;
      if (key) {
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return matchesLocation(o) && matchesBrand(o) && matchesPayment(o) && matchesProduct(o);
    });
  }, [allOrders, comparisonOrders, matchesLocation, matchesBrand, matchesPayment, matchesProduct]);

  // Filtrare comenzi pentru comparația de 1 ZI (Azi vs Ieri / 24.10; Ieri vs Alaltăieri / 23.10)
  const activeSingleDayComparisonOrders = React.useMemo(() => {
    if (!isHourly || compareTarget === 'none') return [];
    const targetDay = isLastMonth ? periodMeta.lmDay : periodMeta.prevDay;
    const start = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), 0, 0, 0, 0);
    const end = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate() + 1, 0, 0, 0, 0);
    return cleanAllFilteredOrders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= start && d < end;
    });
  }, [cleanAllFilteredOrders, isHourly, compareTarget, isLastMonth, periodMeta]);

  const buckets = React.useMemo(() => {
    const fmtYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fmtDayShort = (d) => d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
    const fmtDayMonthFull = (d) => d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long' });
    // JS getDay(): 0=Dum, 1=Lun, 2=Mar, 3=Mie, 4=Joi, 5=Vin, 6=Sâm
    const DOW_SHORT3 = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
    const DOW_SHORT2 = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'];
    const DOW_FULL = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
    const MONTHS_SHORT = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const MONTHS_FULL = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

    const finalizeSlots = (slots, cumulative) => {
      let runRev = 0;
      let runCnt = 0;
      let runYRev = 0;
      let runYCnt = 0;
      slots.forEach((slot) => {
        const stepRev = Math.round(slot.revenue * 100) / 100;
        const stepCnt = slot.count;
        const stepYRev = Math.round(slot.yesterdayRevenue * 100) / 100;
        const stepYCnt = slot.yesterdayCount;

        slot.hourRevenue = stepRev;
        slot.hourCount = stepCnt;
        slot.hourYesterdayRevenue = stepYRev;
        slot.hourYesterdayCount = stepYCnt;

        if (cumulative) {
          runRev = Math.round((runRev + stepRev) * 100) / 100;
          runCnt += stepCnt;
          runYRev = Math.round((runYRev + stepYRev) * 100) / 100;
          runYCnt += stepYCnt;
          slot.revenue = runRev;
          slot.count = runCnt;
          slot.yesterdayRevenue = runYRev;
          slot.yesterdayCount = runYCnt;
        } else {
          slot.revenue = stepRev;
          slot.count = stepCnt;
          slot.yesterdayRevenue = stepYRev;
          slot.yesterdayCount = stepYCnt;
        }
      });
      return slots;
    };

    if (isHourly) {
      const currentHour = new Date().getHours();
      let startHour = 10;
      let maxHour = 22;

      // Dacă este 'today', nu afișăm orele viitoare care nu au sosit încă
      if (period === 'today') {
        maxHour = Math.min(22, Math.max(startHour + 1, currentHour));
      }

      // Verificăm dacă există comenzi plasate mai devreme de 10:00 sau după maxHour
      orders.forEach(o => {
        if (!o.createdAt || o.status === 'cancelled') return;
        const h = new Date(o.createdAt).getHours();
        if (h < startHour) startHour = h;
        if (period === 'today' && h > maxHour && h <= 23) maxHour = h;
      });

      const slots = [];
      for (let h = startHour; h <= maxHour; h++) {
        slots.push({
          label: `${h}:00`,
          subLabel: '',
          isWeekend: false,
          fullLabel: `Până la ${h + 1}:00`,
          hourRangeLabel: `${h}:00–${h + 1}:00`,
          hour: h,
          revenue: 0,
          count: 0,
          yesterdayRevenue: 0,
          yesterdayCount: 0
        });
      }

      orders.forEach(o => {
        if (!o.createdAt || o.status === 'cancelled') return;
        const h = new Date(o.createdAt).getHours();
        const slot = slots.find(s => s.hour === h);
        if (slot) {
          slot.revenue += (o.totalAmount || 0);
          slot.count += 1;
        }
      });

      if (Array.isArray(activeSingleDayComparisonOrders) && activeSingleDayComparisonOrders.length > 0) {
        activeSingleDayComparisonOrders.forEach(o => {
          if (!o.createdAt || o.status === 'cancelled') return;
          const h = new Date(o.createdAt).getHours();
          const slot = slots.find(s => s.hour === h);
          if (slot) {
            slot.yesterdayRevenue += (o.totalAmount || 0);
            slot.yesterdayCount += 1;
          }
        });
      }

      return finalizeSlots(slots, true);
    }

    // ── PERIOADE MULTI-ZI: Suportă AMBELE moduri ('cumulative' = Total cumulat comparativ | 'daily' = Pe zile / pe luni individual) ──
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const dayDiffUTC = (d, startD) => Math.round(
      (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(startD.getFullYear(), startD.getMonth(), startD.getDate())) / 86400000
    );

    // 1. Săptămâna curentă vs Săptămâna trecută | Săptămâna trecută vs Săptămâna anterioară
    if (period === 'thisWeek' || period === 'lastWeek') {
      const dow = now.getDay() || 7; // 1=Lun .. 7=Dum
      const curMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 1, 0, 0, 0, 0);
      const primaryStart = period === 'thisWeek'
        ? curMon
        : new Date(curMon.getFullYear(), curMon.getMonth(), curMon.getDate() - 7, 0, 0, 0, 0);
      const daysCount = period === 'thisWeek' ? dow : 7;
      const prevStart = new Date(primaryStart.getFullYear(), primaryStart.getMonth(), primaryStart.getDate() - 7, 0, 0, 0, 0);

      const slots = Array.from({ length: daysCount }, (_, i) => {
        const dCur = new Date(primaryStart.getFullYear(), primaryStart.getMonth(), primaryStart.getDate() + i);
        const jsDow = dCur.getDay();
        const isWknd = jsDow === 0 || jsDow === 6;
        const shortDate = `${String(dCur.getDate()).padStart(2, '0')} ${MONTHS_SHORT[dCur.getMonth()].toLowerCase()}`;
        return {
          label: DOW_SHORT3[jsDow],
          subLabel: shortDate,
          isWeekend: isWknd,
          fullLabel: isCumulativeView
            ? `Cumulat până ${DOW_FULL[jsDow]}, ${fmtDayMonthFull(dCur)}`
            : `${DOW_FULL[jsDow]}, ${fmtDayMonthFull(dCur)}`,
          hourRangeLabel: `${DOW_FULL[jsDow]}, ${shortDate}`,
          dateKey: fmtYMD(dCur),
          revenue: 0,
          count: 0,
          yesterdayRevenue: 0,
          yesterdayCount: 0
        };
      });

      const primaryEnd = new Date(primaryStart.getFullYear(), primaryStart.getMonth(), primaryStart.getDate() + daysCount, 0, 0, 0, 0);
      const prevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth(), prevStart.getDate() + daysCount, 0, 0, 0, 0);

      orders.forEach(o => {
        if (!o.createdAt || o.status === 'cancelled') return;
        const d = new Date(o.createdAt);
        if (d >= primaryStart && d < primaryEnd) {
          const idx = dayDiffUTC(d, primaryStart);
          if (idx >= 0 && idx < slots.length) {
            slots[idx].revenue += (o.totalAmount || 0);
            slots[idx].count += 1;
          }
        }
      });

      if (compareTarget !== 'none') {
        cleanAllFilteredOrders.forEach(o => {
          const d = new Date(o.createdAt);
          if (d >= prevStart && d < prevEnd) {
            const idx = dayDiffUTC(d, prevStart);
            if (idx >= 0 && idx < slots.length) {
              slots[idx].yesterdayRevenue += (o.totalAmount || 0);
              slots[idx].yesterdayCount += 1;
            }
          }
        });
      }

      return finalizeSlots(slots, isCumulativeView);
    }

    // 2. Anul curent (Ian .. luna curentă) vs Anul trecut (Ian .. aceeași lună)
    if (period === 'thisYear') {
      const curYear = now.getFullYear();
      const maxMonthIdx = now.getMonth();
      const slots = Array.from({ length: maxMonthIdx + 1 }, (_, m) => ({
        label: MONTHS_SHORT[m],
        subLabel: String(curYear),
        isWeekend: false,
        fullLabel: isCumulativeView
          ? `Cumulat până în ${MONTHS_FULL[m]} ${curYear}`
          : `${MONTHS_FULL[m]} ${curYear}`,
        hourRangeLabel: MONTHS_FULL[m],
        revenue: 0,
        count: 0,
        yesterdayRevenue: 0,
        yesterdayCount: 0
      }));

      orders.forEach(o => {
        if (!o.createdAt || o.status === 'cancelled') return;
        const d = new Date(o.createdAt);
        if (d.getFullYear() === curYear && d.getMonth() <= maxMonthIdx) {
          slots[d.getMonth()].revenue += (o.totalAmount || 0);
          slots[d.getMonth()].count += 1;
        }
      });

      if (compareTarget !== 'none') {
        cleanAllFilteredOrders.forEach(o => {
          const d = new Date(o.createdAt);
          if (d.getFullYear() === curYear - 1 && d.getMonth() <= maxMonthIdx) {
            slots[d.getMonth()].yesterdayRevenue += (o.totalAmount || 0);
            slots[d.getMonth()].yesterdayCount += 1;
          }
        });
      }

      return finalizeSlots(slots, isCumulativeView);
    }

    // 3. Luna curentă vs Luna trecută | Luna trecută vs Acum 2 luni | Interval personalizat vs Perioada anterioară egală
    let primaryStart;
    let totalDays;
    let prevStart;
    let prevTotalDays;

    if (period === 'thisMonth') {
      primaryStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      totalDays = now.getDate();
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      prevTotalDays = Math.min(totalDays, prevMonthDays);
    } else if (period === 'lastMonth') {
      primaryStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      totalDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      prevTotalDays = new Date(now.getFullYear(), now.getMonth() - 1, 0).getDate();
    } else {
      const parseLocalYMD = (s) => {
        if (!s) return null;
        const [y, m, d] = s.split('-').map(Number);
        return (y && m && d) ? new Date(y, m - 1, d, 0, 0, 0, 0) : null;
      };
      const sd = parseLocalYMD(customStart) || new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() - 6);
      const ed = parseLocalYMD(customEnd) || todayStart;
      primaryStart = sd <= ed ? sd : ed;
      const primaryLast = sd <= ed ? ed : sd;
      totalDays = Math.max(1, Math.round((primaryLast - primaryStart) / 86400000) + 1);
      prevStart = new Date(primaryStart.getFullYear(), primaryStart.getMonth(), primaryStart.getDate() - totalDays, 0, 0, 0, 0);
      prevTotalDays = totalDays;
    }

    // În modul 'daily' (Pe zile): afișăm FIECARE ZI (1..24 / 1..31) cu Zi + Ziua Săptămânii (01 / Du, 02 / Lu, ...)!
    // În modul 'cumulative' (Total cumulat comparativ): dacă > 10 zile, grupăm în 6 checkpoint-uri curate cu date + ziua săptămânii!
    const groupSize = (!isCumulativeView || totalDays <= 10) ? 1 : Math.ceil(totalDays / 6);
    const numBuckets = Math.max(1, Math.ceil(totalDays / groupSize));
    const isCompactDaily = groupSize === 1 && totalDays > 10;

    const slots = Array.from({ length: numBuckets }, (_, bi) => {
      const startOff = bi * groupSize;
      const endOff = Math.min(totalDays - 1, (bi + 1) * groupSize - 1);
      const dStart = new Date(primaryStart.getFullYear(), primaryStart.getMonth(), primaryStart.getDate() + startOff);
      const dEnd = new Date(primaryStart.getFullYear(), primaryStart.getMonth(), primaryStart.getDate() + endOff);
      const jsDowStart = dStart.getDay();
      const jsDowEnd = dEnd.getDay();
      const isWknd = groupSize === 1 && (jsDowStart === 0 || jsDowStart === 6);
      const sameMonth = dStart.getMonth() === dEnd.getMonth();

      let label;
      let subLabel;
      if (groupSize === 1) {
        if (isCompactDaily) {
          // 11–31 zile individuale: Rând 1 = ziua (01..31), Rând 2 = ziua săptămânii (Lu, Ma, Mi, Jo, Vi, Sâ, Du) — ZERO suprapunere!
          label = String(dStart.getDate()).padStart(2, '0');
          subLabel = DOW_SHORT2[jsDowStart];
        } else {
          // ≤ 10 zile: Rând 1 = Lun/Mar/Mie, Rând 2 = 01 nov
          label = DOW_SHORT3[jsDowStart];
          subLabel = `${String(dStart.getDate()).padStart(2, '0')} ${MONTHS_SHORT[dStart.getMonth()].toLowerCase()}`;
        }
      } else {
        label = sameMonth
          ? `${dStart.getDate()}–${dEnd.getDate()} ${MONTHS_SHORT[dEnd.getMonth()]}`
          : `${dStart.getDate()} ${MONTHS_SHORT[dStart.getMonth()]}–${dEnd.getDate()} ${MONTHS_SHORT[dEnd.getMonth()]}`;
        subLabel = `${DOW_SHORT3[jsDowStart]}–${DOW_SHORT3[jsDowEnd]}`;
      }

      return {
        label,
        subLabel,
        isWeekend: isWknd,
        fullLabel: groupSize === 1
          ? (isCumulativeView
              ? `Cumulat până ${DOW_FULL[jsDowStart]}, ${fmtDayMonthFull(dStart)}`
              : `${DOW_FULL[jsDowStart]}, ${fmtDayMonthFull(dStart)}`)
          : `Cumulat ${dStart.getDate()}–${dEnd.getDate()} ${MONTHS_FULL[dEnd.getMonth()]} (${DOW_SHORT3[jsDowStart]}–${DOW_SHORT3[jsDowEnd]})`,
        hourRangeLabel: groupSize === 1 ? `${DOW_FULL[jsDowStart]}, ${fmtDayShort(dStart)}` : label,
        dateKey: groupSize === 1 ? fmtYMD(dStart) : null,
        revenue: 0,
        count: 0,
        yesterdayRevenue: 0,
        yesterdayCount: 0
      };
    });

    const primaryEnd = new Date(primaryStart.getFullYear(), primaryStart.getMonth(), primaryStart.getDate() + totalDays, 0, 0, 0, 0);
    const prevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth(), prevStart.getDate() + prevTotalDays, 0, 0, 0, 0);

    orders.forEach(o => {
      if (!o.createdAt || o.status === 'cancelled') return;
      const d = new Date(o.createdAt);
      if (d >= primaryStart && d < primaryEnd) {
        const dayIdx = dayDiffUTC(d, primaryStart);
        const bi = Math.min(numBuckets - 1, Math.max(0, Math.floor(dayIdx / groupSize)));
        slots[bi].revenue += (o.totalAmount || 0);
        slots[bi].count += 1;
      }
    });

    if (compareTarget !== 'none') {
      cleanAllFilteredOrders.forEach(o => {
        const d = new Date(o.createdAt);
        if (d >= prevStart && d < prevEnd) {
          const dayIdx = dayDiffUTC(d, prevStart);
          const bi = Math.min(numBuckets - 1, Math.max(0, Math.floor(dayIdx / groupSize)));
          slots[bi].yesterdayRevenue += (o.totalAmount || 0);
          slots[bi].yesterdayCount += 1;
        }
      });
    }

    return finalizeSlots(slots, isCumulativeView);
  }, [orders, activeSingleDayComparisonOrders, cleanAllFilteredOrders, isHourly, isCumulativeView, period, isLastMonth, compareTarget, customStart, customEnd]);

  // Independent Dual Y-Axis Scales:
  // Left Y-Axis = RON (exclusively for Vertical Columns)
  // Right Y-Axis = Comenzi (exclusively for Line Chart)
  const rawMaxRev = Math.max(
    ...buckets.map(b => b.revenue || 0),
    ...(isCompared ? buckets.map(b => b.yesterdayRevenue || 0) : []),
    40
  );
  const rawMaxCnt = Math.max(
    ...buckets.map(b => b.count || 0),
    ...(isCompared ? buckets.map(b => b.yesterdayCount || 0) : []),
    4
  );
  const revStep = rawMaxRev > 100000 ? 40000 : rawMaxRev > 40000 ? 20000 : rawMaxRev > 20000 ? 5000 : rawMaxRev > 8000 ? 2000 : rawMaxRev > 4000 ? 1000 : rawMaxRev > 1600 ? 400 : rawMaxRev > 400 ? 200 : rawMaxRev > 160 ? 80 : 40;
  const maxRev = Math.max(revStep, Math.ceil(rawMaxRev / revStep) * revStep);
  const cntStep = rawMaxCnt > 4000 ? 1000 : rawMaxCnt > 1600 ? 400 : rawMaxCnt > 800 ? 200 : rawMaxCnt > 400 ? 100 : rawMaxCnt > 160 ? 40 : rawMaxCnt > 80 ? 20 : rawMaxCnt > 32 ? 12 : rawMaxCnt > 16 ? 8 : 4;
  const maxCnt = Math.max(4, Math.ceil((rawMaxCnt * 1.06) / cntStep) * cntStep);

  const hasSubXLabel = buckets.some(b => Boolean(b.subLabel));
  const width = 640;
  const height = hasSubXLabel ? 290 : 278;
  const padLeft = maxRev >= 100000 ? 78 : maxRev >= 10000 ? 70 : maxRev >= 1000 ? 64 : 56;
  const padRight = maxCnt >= 1000 ? 56 : maxCnt >= 100 ? 52 : 46;
  const padTop = 44;
  const padBottom = hasSubXLabel ? 42 : 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const baseY = padTop + chartH;

  // Slot-centered X coordinate so columns & line points share exact center without colliding with Y-axes
  const slotW = chartW / Math.max(buckets.length, 1);
  const isDenseSlots = slotW < 34;
  const yForRev = (val) => padTop + chartH - (Math.max(0, val || 0) / maxRev) * chartH;
  const yForCnt = (val) => padTop + chartH - (Math.max(0, val || 0) / maxCnt) * chartH;

  // Responsive column widths: wide & bold on 5–10 slots, clean slim bars on 24–31 daily slots
  const barGap = isDenseSlots ? 1.5 : 4;
  const groupedBarW = isDenseSlots
    ? Math.max(5.5, (slotW * 0.78 - barGap) / 2)
    : Math.min(34, Math.max(12, (slotW * 0.72 - barGap) / 2));
  const singleBarW = isDenseSlots
    ? Math.max(9.5, slotW * 0.64)
    : Math.min(44, Math.max(16, slotW * 0.48));

  // Format compact RON inside bar labels (always readable without overflowing bar width)
  const formatBarRevLabel = (val) => {
    const rounded = Math.round(val || 0);
    if (rounded >= 100000) return `${Math.round(rounded / 1000)}k`;
    if (rounded >= 10000) return `${(rounded / 1000).toFixed(1).replace('.0', '')}k`;
    if (isDenseSlots && rounded >= 1000) return `${(rounded / 1000).toFixed(1).replace('.0', '')}k`;
    return formatThousands(rounded, 0);
  };

  // Place RON label cleanly near the TOP cap of the column (NEVER jammed at the bottom floor, NEVER hidden)
  const computeBarLabelPos = (barY, barH, avoidYs) => {
    if (barH >= 24) {
      let y = barY + 13;
      const hitsLine = avoidYs.some(ly => ly !== null && Math.abs(y - ly) < 10);
      if (hitsLine && barH >= 38) {
        y = barY + 25;
      }
      return { y, inside: true };
    }
    if (barH >= 15) {
      return { y: barY + barH / 2 + 3.2, inside: true };
    }
    return { y: Math.max(padTop - 2, barY - 4), inside: false };
  };

  // Combined slot geometry: both RON bar positions & independent Comenzi line points
  const slotsGeo = buckets.map((b, i) => {
    const cx = padLeft + (i + 0.5) * slotW;
    const revToday = b.revenue || 0;
    const revPrev = b.yesterdayRevenue || 0;
    const cntToday = b.count || 0;
    const cntPrev = b.yesterdayCount || 0;

    const barTodayY = yForRev(revToday);
    const barTodayH = Math.max(0, baseY - barTodayY);
    const barPrevY = yForRev(revPrev);
    const barPrevH = Math.max(0, baseY - barPrevY);

    const lineTodayY = yForCnt(cntToday);
    const linePrevY = yForCnt(cntPrev);

    return {
      cx,
      b,
      revToday,
      revPrev,
      cntToday,
      cntPrev,
      barTodayY,
      barTodayH,
      barPrevY,
      barPrevH,
      lineTodayY,
      linePrevY,
    };
  });

  // Smooth monotone cubic spline helper for Comenzi lines
  const createSmoothPath = (points) => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      d += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
    }
    return d;
  };

  const todayLinePath = createSmoothPath(slotsGeo.map(s => ({ x: s.cx, y: s.lineTodayY })));
  const prevLinePath = createSmoothPath(slotsGeo.map(s => ({ x: s.cx, y: s.linePrevY })));

  // Total perioadă: în modul Cumulat = ultimul bucket; în modul Pe zile = suma tuturor bucket-urilor
  const lastBucket = buckets[buckets.length - 1] || { revenue: 0, count: 0, yesterdayRevenue: 0, yesterdayCount: 0 };
  const totalRev = isCumulativeView
    ? (lastBucket.revenue || 0)
    : Math.round(buckets.reduce((s, b) => s + (b.revenue || 0), 0) * 100) / 100;
  const totalCnt = isCumulativeView
    ? (lastBucket.count || 0)
    : buckets.reduce((s, b) => s + (b.count || 0), 0);
  const totalYesterdayRev = isCumulativeView
    ? (lastBucket.yesterdayRevenue || 0)
    : Math.round(buckets.reduce((s, b) => s + (b.yesterdayRevenue || 0), 0) * 100) / 100;
  const totalYesterdayCnt = isCumulativeView
    ? (lastBucket.yesterdayCount || 0)
    : buckets.reduce((s, b) => s + (b.yesterdayCount || 0), 0);

  const chartTitle = isHourly
    ? 'Total Comenzi Cumulat'
    : isCumulativeView
      ? (period === 'thisMonth' || period === 'lastMonth'
          ? 'Total Lună Cumulat'
          : period === 'thisWeek' || period === 'lastWeek'
            ? 'Total Săptămână Cumulat'
            : period === 'thisYear'
              ? 'Total An Cumulat'
              : 'Total Perioadă Cumulat')
      : (period === 'thisYear' ? 'Evoluție Pe Luni' : 'Evoluție Pe Zile');

  const formatOrdersWord = (n) => (n === 1 ? 'comandă' : 'comenzi');
  const primarySeriesLabel = periodMeta.primaryLabel;

  // Active header readout: switches smoothly between cumulative total and hovered slot
  const activeSlot = hoveredIndex !== null && slotsGeo[hoveredIndex] ? slotsGeo[hoveredIndex].b : null;
  const curRev = activeSlot ? activeSlot.revenue : totalRev;
  const curCnt = activeSlot ? activeSlot.count : totalCnt;
  const prevRev = activeSlot ? (activeSlot.yesterdayRevenue || 0) : totalYesterdayRev;
  const prevCnt = activeSlot ? (activeSlot.yesterdayCount || 0) : totalYesterdayCnt;

  const revDiff = Math.round((curRev - prevRev) * 100) / 100;
  const revPct = prevRev > 0 ? Math.round((revDiff / prevRev) * 100) : null;
  const cntDiff = curCnt - prevCnt;
  const cntPct = prevCnt > 0 ? Math.round((cntDiff / prevCnt) * 100) : null;

  const formatDiffCompact = (diff, mode) => {
    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
    const absVal = Math.abs(diff);
    return mode === 'revenue'
      ? `${sign}${formatThousands(absVal)} lei`
      : `${sign}${absVal} ${formatOrdersWord(absVal)}`;
  };

  const compStrokeColor = isLastMonth ? '#9333EA' : '#EA580C';
  const compBarColor = isLastMonth ? '#A855F7' : '#F59E0B';
  const compBarTextClass = isLastMonth
    ? 'fill-[#6B21A8] dark:fill-[#F3E8FF]'
    : 'fill-[#9A3412] dark:fill-[#FEF3C7]';

  return (
    <div className="apple-card relative p-4 sm:p-5 overflow-hidden group h-full flex flex-col">
      {/* Row 1: Clean Title + Controls (ZERO wrapped badges underneath title) */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white"
            style={{
              backgroundColor: '#007AFF',
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)',
              boxShadow: '0 2px 8px -1px rgba(0,122,255,0.42), inset 0 0.5px 0 rgba(255,255,255,0.35)'
            }}
          >
            <TrendingUp className="w-[18px] h-[18px]" strokeWidth={2.1} />
          </div>
          <h4 className="text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">
            {chartTitle}
          </h4>
        </div>

        {/* Compact Controls: Multi-day Mode (Cumulat | Pe zile) + Compare (1-day vs Same Prev Period) + Series */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-nowrap shrink-0">
          {!isHourly && (
            <div className="apple-segmented">
              <button
                type="button"
                onClick={() => setMultiDayMode('cumulative')}
                className={`apple-segmented-item !px-2 ${multiDayMode === 'cumulative' ? 'is-active' : ''}`}
              >
                Cumulat
              </button>
              <button
                type="button"
                onClick={() => setMultiDayMode('daily')}
                className={`apple-segmented-item !px-2 ${multiDayMode === 'daily' ? 'is-active' : ''}`}
              >
                {period === 'thisYear' ? 'Pe luni' : 'Pe zile'}
              </button>
            </div>
          )}

          <div className="apple-segmented">
            <button
              type="button"
              onClick={() => setCompareTarget('none')}
              className={`apple-segmented-item !px-2 ${compareTarget === 'none' ? 'is-active' : ''}`}
            >
              Fără
            </button>
            <button
              type="button"
              onClick={() => setCompareTarget('yesterday')}
              className={`apple-segmented-item !px-2 inline-flex items-center gap-1 ${
                compareTarget !== 'none' && !isLastMonth ? 'is-active' : ''
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${compareTarget !== 'none' && !isLastMonth ? 'bg-white' : 'bg-[#F59E0B]'}`} />
              <span>{periodMeta.prevPeriodLabel}</span>
            </button>
            {isHourly && (
              <button
                type="button"
                onClick={() => setCompareTarget('lastMonth')}
                className={`apple-segmented-item !px-2 inline-flex items-center gap-1 ${isLastMonth ? 'is-active' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isLastMonth ? 'bg-white' : 'bg-[#A855F7]'}`} />
                <span>{periodMeta.lastMonthLabel}</span>
              </button>
            )}
          </div>

          <div className="apple-segmented" title="Coloane = RON · Linie = Comenzi">
            <button
              type="button"
              onClick={() => setSeriesFilter('both')}
              className={`apple-segmented-item !px-2 ${seriesFilter === 'both' ? 'is-active' : ''}`}
            >
              RON + Cmd
            </button>
            <button
              type="button"
              onClick={() => setSeriesFilter('revenue')}
              className={`apple-segmented-item !px-2 ${seriesFilter === 'revenue' ? 'is-active' : ''}`}
            >
              RON
            </button>
            <button
              type="button"
              onClick={() => setSeriesFilter('count')}
              className={`apple-segmented-item !px-2 ${seriesFilter === 'count' ? 'is-active' : ''}`}
            >
              Comenzi
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Single-Line Live Summary Strip (Azi + Comparație + % RON + % Cmd aligned cleanly) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 mb-1.5 pl-[46px] shrink-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-[#6E6E73] dark:text-[#98989D]">
          {activeSlot && (
            <>
              <span className="font-semibold text-[#007AFF] dark:text-[#0A84FF] whitespace-nowrap">{activeSlot.fullLabel}</span>
              <span className="text-black/15 dark:text-white/20">·</span>
            </>
          )}
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className="w-2 h-2 rounded-[2px] bg-[#007AFF] shrink-0" />
            <span>{primarySeriesLabel}:</span>
            <strong className="font-semibold text-[#1D1D1F] dark:text-white">{formatThousands(curRev)} lei</strong>
            <span className="text-[#0055D4] dark:text-[#64D2FF] font-semibold">· {curCnt} {formatOrdersWord(curCnt)}</span>
          </span>
          {isCompared && (
            <>
              <span className="text-black/15 dark:text-white/20">·</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: compBarColor }} />
                <span>{compareConfig.shortLabel}:</span>
                {isComparisonLoading && prevRev === 0 && prevCnt === 0 ? (
                  <span className="text-[#86868B] italic">Se încarcă...</span>
                ) : (
                  <>
                    <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{formatThousands(prevRev)} lei</span>
                    <span className="font-medium" style={{ color: compStrokeColor }}>· {prevCnt} cmd</span>
                  </>
                )}
              </span>
            </>
          )}
        </div>

        {isCompared && (curRev > 0 || prevRev > 0 || curCnt > 0 || prevCnt > 0) && (
          <div className="flex items-center gap-1.5 shrink-0">
            {(curRev > 0 || prevRev > 0) && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                revDiff === 0
                  ? 'bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#AEAEB2]'
                  : revDiff > 0
                    ? 'bg-[#34C759]/14 text-[#1F7A33] dark:text-[#30D158]'
                    : 'bg-[#FF3B30]/12 text-[#D70015] dark:text-[#FF453A]'
              }`}>
                {revDiff !== 0 && <span>{revDiff > 0 ? '↗' : '↘'}</span>}
                <span>{revPct !== null ? `${revPct > 0 ? '+' : ''}${revPct}% RON` : formatDiffCompact(revDiff, 'revenue')}</span>
              </span>
            )}
            {(curCnt > 0 || prevCnt > 0) && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                cntDiff === 0
                  ? 'bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#AEAEB2]'
                  : cntDiff > 0
                    ? 'bg-[#007AFF]/12 text-[#0055D4] dark:text-[#64D2FF]'
                    : 'bg-[#FF3B30]/12 text-[#D70015] dark:text-[#FF453A]'
              }`}>
                {cntDiff !== 0 && <span>{cntDiff > 0 ? '↗' : '↘'}</span>}
                <span>{cntPct !== null ? `${cntPct > 0 ? '+' : ''}${cntPct}% cmd` : formatDiffCompact(cntDiff, 'count')}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Combined Column (RON - Left Y) + Line (Comenzi - Right Y) SVG Canvas */}
      <div className="relative w-full flex-1 min-h-[260px] flex items-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[420px] overflow-visible">
          <defs>
            <linearGradient id="barTodayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#007AFF" stopOpacity="0.56" />
              <stop offset="100%" stopColor="#007AFF" stopOpacity="0.18" />
            </linearGradient>
            <linearGradient id="barTodayHoverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#007AFF" stopOpacity="0.76" />
              <stop offset="100%" stopColor="#007AFF" stopOpacity="0.30" />
            </linearGradient>
            <linearGradient id="barCompGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={compBarColor} stopOpacity="0.46" />
              <stop offset="100%" stopColor={compBarColor} stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Left Y-Axis Header: RON (Coloane) */}
          <g className="select-none">
            <rect x={padLeft - 40} y={padTop - 25} width="8" height="9" rx="2" fill="#007AFF" opacity={showBars ? 0.8 : 0.25} />
            <text
              x={padLeft - 8}
              y={padTop - 17}
              textAnchor="end"
              fontSize="9.5"
              className={`font-semibold uppercase tracking-wide ${showBars ? 'fill-[#007AFF] dark:fill-[#0A84FF]' : 'fill-[#86868B]'}`}
            >
              RON
            </text>
          </g>

          {/* Right Y-Axis Header: Comenzi (Linie) */}
          <g className="select-none">
            <line x1={padLeft + chartW + 4} y1={padTop - 20.5} x2={padLeft + chartW + 16} y2={padTop - 20.5} stroke="#0055D4" strokeWidth="2" opacity={showLines ? 1 : 0.3} />
            <circle cx={padLeft + chartW + 10} cy={padTop - 20.5} r="2.6" fill="#ffffff" stroke="#0055D4" strokeWidth="1.6" opacity={showLines ? 1 : 0.3} />
            <text
              x={padLeft + chartW + 20}
              y={padTop - 17}
              textAnchor="start"
              fontSize="9.5"
              className={`font-semibold uppercase tracking-wide ${showLines ? 'fill-[#0055D4] dark:fill-[#64D2FF]' : 'fill-[#86868B]'}`}
            >
              CMD
            </text>
          </g>

          {/* Horizontal Gridlines + Independent Dual Y-Axes (Left = RON, Right = Comenzi) */}
          {[0.25, 0.5, 0.75, 1].map((lvl, idx) => {
            const yLvl = padTop + chartH * (1 - lvl);
            const revTick = Math.round(maxRev * lvl);
            const cntTick = Math.round(maxCnt * lvl);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={yLvl}
                  x2={padLeft + chartW}
                  y2={yLvl}
                  stroke="currentColor"
                  className="text-black/[0.08] dark:text-white/[0.1]"
                  strokeDasharray="3,4"
                  strokeWidth="1"
                />
                {/* Left Y-Axis Tick (RON) */}
                <line
                  x1={padLeft - 4}
                  y1={yLvl}
                  x2={padLeft}
                  y2={yLvl}
                  stroke="currentColor"
                  className="text-black/25 dark:text-white/30"
                  strokeWidth="1.2"
                />
                <text
                  x={padLeft - 8}
                  y={yLvl + 3.5}
                  textAnchor="end"
                  fontSize="9.8"
                  className={`font-medium select-none ${showBars ? 'fill-[#6E6E73] dark:fill-[#98989D]' : 'fill-[#86868B]/40'}`}
                >
                  {formatThousands(revTick, 0)} lei
                </text>

                {/* Right Y-Axis Tick (Comenzi) */}
                <line
                  x1={padLeft + chartW}
                  y1={yLvl}
                  x2={padLeft + chartW + 4}
                  y2={yLvl}
                  stroke="currentColor"
                  className="text-black/25 dark:text-white/30"
                  strokeWidth="1.2"
                />
                <text
                  x={padLeft + chartW + 8}
                  y={yLvl + 3.5}
                  textAnchor="start"
                  fontSize="9.8"
                  className={`font-semibold select-none ${showLines ? 'fill-[#0055D4]/80 dark:fill-[#64D2FF]/85' : 'fill-[#86868B]/40'}`}
                >
                  {cntTick}
                </text>
              </g>
            );
          })}

          {/* Origin 0 on BOTH Y-Axes */}
          <text x={padLeft - 8} y={baseY + 3.5} textAnchor="end" fontSize="9.8" className="fill-[#6E6E73] dark:fill-[#98989D] font-medium select-none">
            0 lei
          </text>
          <text x={padLeft + chartW + 8} y={baseY + 3.5} textAnchor="start" fontSize="9.8" className="fill-[#0055D4]/75 dark:fill-[#64D2FF]/80 font-semibold select-none">
            0
          </text>

          {/* Left Y-Axis Line (RON) */}
          <line
            x1={padLeft}
            y1={padTop - 4}
            x2={padLeft}
            y2={baseY}
            stroke="currentColor"
            className="text-black/20 dark:text-white/25"
            strokeWidth="1.25"
            strokeLinecap="round"
          />

          {/* Right Y-Axis Line (Comenzi) */}
          <line
            x1={padLeft + chartW}
            y1={padTop - 4}
            x2={padLeft + chartW}
            y2={baseY}
            stroke="currentColor"
            className="text-[#0055D4]/30 dark:text-[#64D2FF]/30"
            strokeWidth="1.25"
            strokeLinecap="round"
          />

          {/* Bottom X-Axis Line (Time) */}
          <line
            x1={padLeft}
            y1={baseY}
            x2={padLeft + chartW}
            y2={baseY}
            stroke="currentColor"
            className="text-black/20 dark:text-white/25"
            strokeWidth="1.25"
            strokeLinecap="round"
          />

          {/* ── LAYER 1: VERTICAL COLUMNS (VALOAREA ÎN RON — Left Y-Axis, VALUES ALWAYS VISIBLE AT TOP CAP) ── */}
          {showBars && slotsGeo.map((s, i) => {
            const isHovered = hoveredIndex === i;
            const isPointSelected = isHourly
              ? (selectedHour === s.b.hour)
              : (s.b.dateKey && selectedDay?.value === s.b.dateKey);

            const todayBarX = isCompared ? s.cx + barGap / 2 : s.cx - singleBarW / 2;
            const todayBarWidth = isCompared ? groupedBarW : singleBarW;
            const prevBarX = s.cx - barGap / 2 - groupedBarW;
            const prevBarWidth = groupedBarW;

            const activeLineYs = showLines
              ? [s.cntToday > 0 ? s.lineTodayY : null, isCompared && s.cntPrev > 0 ? s.linePrevY : null]
              : [];

            const todayRevStr = formatBarRevLabel(s.revToday);
            const prevRevStr = formatBarRevLabel(s.revPrev);
            const todayLabelPos = computeBarLabelPos(s.barTodayY, s.barTodayH, activeLineYs);
            const prevLabelPos = computeBarLabelPos(s.barPrevY, s.barPrevH, activeLineYs);

            return (
              <g key={`bars-${i}`} className="pointer-events-none">
                {/* Subtle vertical slot wash on hover */}
                {(isHovered || isPointSelected) && (
                  <rect
                    x={s.cx - slotW * 0.45}
                    y={padTop}
                    width={slotW * 0.9}
                    height={chartH}
                    rx="8"
                    fill="#007AFF"
                    fillOpacity="0.055"
                  />
                )}

                {/* Comparison Column (Orange / Purple — RON) */}
                {isCompared && s.barPrevH > 0 && (
                  <>
                    <rect
                      x={prevBarX}
                      y={s.barPrevY}
                      width={prevBarWidth}
                      height={s.barPrevH}
                      rx={prevBarWidth < 10 ? '2.5' : '4.5'}
                      fill="url(#barCompGrad)"
                      stroke={compBarColor}
                      strokeOpacity={isHovered ? 0.85 : 0.48}
                      strokeWidth="1"
                      className="transition-all duration-150"
                    />
                    {s.revPrev > 0 && (
                      prevBarWidth >= 19 ? (
                        <text
                          x={prevBarX + prevBarWidth / 2}
                          y={prevLabelPos.y}
                          textAnchor="middle"
                          fontSize={prevRevStr.length >= 5 ? '7.6' : '8.8'}
                          className={`font-bold select-none ${prevLabelPos.inside ? compBarTextClass : 'fill-[#9A3412] dark:fill-[#FBBF24]'}`}
                        >
                          {prevRevStr}
                        </text>
                      ) : (prevBarWidth >= 9 && s.barPrevH >= 28) ? (
                        <text
                          x={prevBarX + prevBarWidth / 2}
                          y={s.barPrevY + Math.min(24, s.barPrevH / 2)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="7.4"
                          transform={`rotate(-90 ${prevBarX + prevBarWidth / 2} ${s.barPrevY + Math.min(24, s.barPrevH / 2)})`}
                          className={`font-bold select-none ${compBarTextClass}`}
                        >
                          {prevRevStr}
                        </text>
                      ) : prevBarWidth >= 9 ? (
                        <text
                          x={prevBarX + prevBarWidth / 2}
                          y={Math.max(padTop - 2, s.barPrevY - 3.5)}
                          textAnchor="middle"
                          fontSize="7.2"
                          className="font-bold select-none fill-[#9A3412] dark:fill-[#FBBF24]"
                        >
                          {prevRevStr}
                        </text>
                      ) : null
                    )}
                  </>
                )}

                {/* Today / Primary Column (Apple Blue — RON) */}
                {s.barTodayH > 0 && (
                  <>
                    <rect
                      x={todayBarX}
                      y={s.barTodayY}
                      width={todayBarWidth}
                      height={s.barTodayH}
                      rx={todayBarWidth < 10 ? '2.5' : '4.5'}
                      fill={isHovered || isPointSelected ? 'url(#barTodayHoverGrad)' : 'url(#barTodayGrad)'}
                      stroke="#007AFF"
                      strokeOpacity={isHovered || isPointSelected ? 0.95 : 0.58}
                      strokeWidth={isHovered || isPointSelected ? '1.3' : '1'}
                      className="transition-all duration-150"
                    />
                    {s.revToday > 0 && (
                      todayBarWidth >= 19 ? (
                        <text
                          x={todayBarX + todayBarWidth / 2}
                          y={todayLabelPos.y}
                          textAnchor="middle"
                          fontSize={todayRevStr.length >= 5 ? '7.6' : '8.8'}
                          className={`font-bold select-none ${
                            todayLabelPos.inside
                              ? 'fill-[#003A9B] dark:fill-white'
                              : 'fill-[#0055D4] dark:fill-[#64D2FF]'
                          }`}
                        >
                          {todayRevStr}
                        </text>
                      ) : (todayBarWidth >= 9 && s.barTodayH >= 28) ? (
                        <text
                          x={todayBarX + todayBarWidth / 2}
                          y={s.barTodayY + Math.min(24, s.barTodayH / 2)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="7.5"
                          transform={`rotate(-90 ${todayBarX + todayBarWidth / 2} ${s.barTodayY + Math.min(24, s.barTodayH / 2)})`}
                          className="font-bold select-none fill-[#003A9B] dark:fill-white"
                        >
                          {todayRevStr}
                        </text>
                      ) : todayBarWidth >= 9 ? (
                        <text
                          x={todayBarX + todayBarWidth / 2}
                          y={Math.max(padTop - 2, s.barTodayY - 3.5)}
                          textAnchor="middle"
                          fontSize="7.2"
                          className="font-bold select-none fill-[#0055D4] dark:fill-[#64D2FF]"
                        >
                          {todayRevStr}
                        </text>
                      ) : null
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* ── LAYER 2: LINE CHARTS (NUMĂR DE COMENZI — Right Y-Axis, Independent Scaling, ALWAYS VISIBLE VALUES) ── */}
          {showLines && (
            <g className="pointer-events-none">
              {/* Comparison Line (Dashed Orange / Purple — Comenzi) */}
              {isCompared && prevLinePath && (
                <>
                  <path
                    d={prevLinePath}
                    fill="none"
                    stroke={compStrokeColor}
                    strokeWidth="2"
                    strokeDasharray="5,4"
                    strokeLinecap="round"
                    opacity="0.86"
                  />
                  {slotsGeo.map((s, idx) => (
                    s.cntPrev > 0 && (
                      <circle
                        key={`prev-dot-${idx}`}
                        cx={s.cx}
                        cy={s.linePrevY}
                        r={hoveredIndex === idx ? 4.4 : 3.2}
                        fill="#ffffff"
                        stroke={compStrokeColor}
                        strokeWidth="1.9"
                      />
                    )
                  ))}
                </>
              )}

              {/* Primary Line Halo + Crisp Solid Blue Line (Comenzi) */}
              {todayLinePath && (
                <>
                  <path
                    d={todayLinePath}
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity="0.78"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="dark:stroke-[#1C1C1E]"
                  />
                  <path
                    d={todayLinePath}
                    fill="none"
                    stroke="#0055D4"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="dark:stroke-[#38BDF8]"
                  />
                </>
              )}

              {/* Line Points + Always-Visible Non-Overlapping Count Pills (with neighbor anti-collision on 24–31 daily slots) */}
              {(() => {
                let lastTodayPill = null;
                return slotsGeo.map((s, i) => {
                  const isHovered = hoveredIndex === i;
                  const isPointSelected = isHourly
                    ? (selectedHour === s.b.hour)
                    : (s.b.dateKey && selectedDay?.value === s.b.dateKey);

                  const hasToday = s.cntToday > 0;
                  const hasPrev = isCompared && s.cntPrev > 0;
                  const sameCount = hasToday && hasPrev && s.cntToday === s.cntPrev && !isDenseSlots;
                  const compactSuffix = slotW < 58 ? '' : ' cmd';
                  const pillFontSize = isDenseSlots ? 8.1 : 9.3;
                  const pillH = isDenseSlots ? 12.5 : 14.5;

                  const todayText = `${s.cntToday}${compactSuffix}`;
                  const todayPillW = isDenseSlots
                    ? Math.max(16, todayText.length * 4.8 + 6)
                    : Math.max(26, todayText.length * 5.6 + 11);
                  const prevText = `${s.cntPrev}${compactSuffix}`;
                  const prevPillW = isDenseSlots
                    ? Math.max(16, prevText.length * 4.8 + 6)
                    : Math.max(26, prevText.length * 5.6 + 11);

                  const verticalGap = Math.abs(s.lineTodayY - s.linePrevY);
                  const prevHigher = hasPrev && hasToday && s.cntPrev > s.cntToday;
                  const todayHigher = hasPrev && hasToday && s.cntToday > s.cntPrev;

                  // Today pill position + neighbor anti-collision stagger for dense daily views (24–31 days)
                  let todayPillX = s.cx;
                  let todayPillY = Math.max(13, s.lineTodayY - (isDenseSlots ? 10 : 12));
                  if (prevHigher && !isDenseSlots) {
                    todayPillX = Math.min(padLeft + chartW - todayPillW / 2 - 2, s.cx + Math.min(24, slotW * 0.24));
                    todayPillY = verticalGap >= 18 ? Math.max(24, s.lineTodayY - 8) : Math.min(baseY - 14, s.lineTodayY + 13);
                  }
                  if (hasToday && isDenseSlots && lastTodayPill) {
                    const horizTouch = Math.abs(todayPillX - lastTodayPill.x) < (todayPillW / 2 + lastTodayPill.w / 2 + 1.5);
                    const vertTouch = Math.abs(todayPillY - lastTodayPill.y) < 13;
                    if (horizTouch && vertTouch) {
                      todayPillY = todayPillY >= 24 ? todayPillY - 12 : todayPillY + 21;
                    }
                  }
                  if (hasToday) {
                    lastTodayPill = { x: todayPillX, y: todayPillY, w: todayPillW };
                  }

                  // Comparison pill position
                  let prevPillX = s.cx;
                  let prevPillY = Math.max(13, s.linePrevY - (isDenseSlots ? 10 : 12));
                  if (todayHigher && !isDenseSlots) {
                    prevPillX = Math.max(padLeft + prevPillW / 2 + 2, s.cx - Math.min(24, slotW * 0.24));
                    prevPillY = verticalGap >= 18 ? Math.max(24, s.linePrevY - 8) : Math.min(baseY - 14, s.linePrevY + 13);
                  } else if (isDenseSlots && hasToday && verticalGap < 15) {
                    prevPillY = Math.min(baseY - 12, s.linePrevY + 13);
                  }
                  const showPrevPill = hasPrev && !sameCount && (!isDenseSlots || isHovered || verticalGap >= 16);

                  // Combined split pill when both equal on non-dense slots (e.g. "2 / 2 cmd")
                  const splitTextLen = `${s.cntToday}/${s.cntPrev}${compactSuffix}`.length;
                  const splitPillW = Math.max(40, splitTextLen * 5.8 + 14);
                  const splitPillY = Math.max(15, s.lineTodayY - 12);

                  return (
                    <g key={`line-pt-${i}`}>
                      {isPointSelected && (
                        <circle
                          cx={s.cx}
                          cy={s.lineTodayY}
                          r={isDenseSlots ? 7.5 : 10}
                          fill="#007AFF"
                          fillOpacity="0.14"
                          stroke="#007AFF"
                          strokeWidth="1.25"
                          strokeOpacity="0.5"
                        />
                      )}
                      <circle
                        cx={s.cx}
                        cy={s.lineTodayY}
                        r={isPointSelected ? 5 : (isHovered ? 4.8 : (hasToday ? (isDenseSlots ? 3.2 : 4) : 0))}
                        fill={isPointSelected || isHovered ? '#0055D4' : '#ffffff'}
                        stroke="#0055D4"
                        strokeWidth={isDenseSlots ? '1.8' : '2.2'}
                        className="dark:stroke-[#38BDF8] transition-all duration-150"
                      />

                      {/* Equal counts on both series -> single clean split badge showing BOTH */}
                      {sameCount && (
                        <g>
                          <rect
                            x={s.cx - splitPillW / 2}
                            y={splitPillY - 10}
                            width={splitPillW}
                            height="14.5"
                            rx="7.25"
                            className="fill-white/95 dark:fill-[#1C1C1E]/95 stroke-black/[0.09] dark:stroke-white/[0.15]"
                            strokeWidth="0.75"
                          />
                          <text
                            x={s.cx}
                            y={splitPillY + 0.5}
                            textAnchor="middle"
                            fontSize="9.2"
                            className="font-bold select-none"
                          >
                            <tspan className="fill-[#0055D4] dark:fill-[#38BDF8]">{s.cntToday}</tspan>
                            <tspan className="fill-[#AEAEB2]"> / </tspan>
                            <tspan fill={compStrokeColor}>{s.cntPrev}</tspan>
                            {compactSuffix && <tspan className="fill-[#6E6E73] dark:fill-[#AEAEB2] font-semibold">{compactSuffix}</tspan>}
                          </text>
                        </g>
                      )}

                      {/* Distinct Today pill */}
                      {hasToday && !sameCount && (
                        <g>
                          <rect
                            x={todayPillX - todayPillW / 2}
                            y={todayPillY - pillH + 4.2}
                            width={todayPillW}
                            height={pillH}
                            rx={pillH / 2}
                            className="fill-white/95 dark:fill-[#1C1C1E]/95 stroke-[#0055D4]/22 dark:stroke-[#38BDF8]/30"
                            strokeWidth="0.75"
                          />
                          <text
                            x={todayPillX}
                            y={todayPillY + 0.5}
                            textAnchor="middle"
                            fontSize={pillFontSize}
                            className={`font-bold select-none ${
                              isHovered || isPointSelected
                                ? 'fill-[#0055D4] dark:fill-[#38BDF8]'
                                : 'fill-[#1D1D1F] dark:fill-[#F5F5F7]'
                            }`}
                          >
                            {todayText}
                          </text>
                        </g>
                      )}

                      {/* Distinct Comparison pill */}
                      {showPrevPill && (
                        <g>
                          <rect
                            x={prevPillX - prevPillW / 2}
                            y={prevPillY - pillH + 4.2}
                            width={prevPillW}
                            height={pillH - 0.5}
                            rx={(pillH - 0.5) / 2}
                            className="fill-white/95 dark:fill-[#1C1C1E]/95"
                            stroke={compStrokeColor}
                            strokeOpacity="0.32"
                            strokeWidth="0.75"
                          />
                          <text
                            x={prevPillX}
                            y={prevPillY + 0.2}
                            textAnchor="middle"
                            fontSize={isDenseSlots ? 7.8 : 9}
                            fill={compStrokeColor}
                            className="font-bold select-none"
                          >
                            {prevText}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                });
              })()}
            </g>
          )}

          {/* ── LAYER 3: INTERACTIVE HITBOXES + X-AXIS TICKS & TIME LABELS ── */}
          {slotsGeo.map((s, i) => {
            const isHovered = hoveredIndex === i;
            const isPointSelected = isHourly
              ? (selectedHour === s.b.hour)
              : (s.b.dateKey && selectedDay?.value === s.b.dateKey);

            return (
              <g
                key={`hit-${i}`}
                className="cursor-pointer"
                onClick={() => {
                  if (isHourly && s.b.hour !== undefined) {
                    onSelectHour(s.b.hour);
                  } else if (!isHourly && s.b.dateKey) {
                    onSelectDay({ type: 'date', value: s.b.dateKey, label: s.b.fullLabel || s.b.label });
                  }
                }}
              >
                <rect
                  x={s.cx - slotW / 2}
                  y={padTop}
                  width={slotW}
                  height={chartH + padBottom}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                {/* X-Axis Tick Mark */}
                <line
                  x1={s.cx}
                  y1={baseY}
                  x2={s.cx}
                  y2={baseY + 4}
                  stroke="currentColor"
                  className="text-black/25 dark:text-white/30"
                  strokeWidth="1.2"
                />

                {/* X-Axis Primary Label (Date / Hour / Weekday) */}
                <text
                  x={s.cx}
                  y={hasSubXLabel ? baseY + 16 : baseY + 19}
                  textAnchor="middle"
                  fontSize={isDenseSlots ? '8.8' : (slotW < 52 ? '9.6' : '10.5')}
                  className={`transition-colors select-none ${
                    isPointSelected || isHovered
                      ? 'fill-[#007AFF] dark:fill-[#0A84FF] font-bold'
                      : s.b.isWeekend
                        ? 'fill-[#1D1D1F] dark:fill-[#F5F5F7] font-semibold'
                        : 'fill-[#6E6E73] dark:fill-[#98989D] font-medium'
                  }`}
                >
                  {s.b.label}
                </text>

                {/* X-Axis Secondary Label (Day of Week: Lu/Ma/Mi/Jo/Vi/Sâ/Du or Date under Lun/Mar/Mie — ZERO overlap!) */}
                {s.b.subLabel && (
                  <text
                    x={s.cx}
                    y={baseY + 28}
                    textAnchor="middle"
                    fontSize={isDenseSlots ? '7.8' : '8.8'}
                    className={`transition-colors select-none ${
                      isPointSelected || isHovered
                        ? 'fill-[#007AFF] dark:fill-[#0A84FF] font-semibold'
                        : s.b.isWeekend
                          ? 'fill-[#007AFF]/85 dark:fill-[#64D2FF]/85 font-semibold'
                          : 'fill-[#8E8E93] dark:fill-[#8E8E93] font-medium'
                    }`}
                  >
                    {s.b.subLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Edge-Aware Apple Liquid Glass Tooltip (Time + RON Columns + Comenzi Line, NEVER clipped) */}
        {hoveredIndex !== null && slotsGeo[hoveredIndex] && (() => {
          const s = slotsGeo[hoveredIndex];
          const b = s.b;
          const xRatio = s.cx / width;
          const xPct = xRatio * 100;
          const topAnchorY = Math.min(s.barTodayY, s.lineTodayY);
          const yRatio = topAnchorY / height;

          const alignRightEdge = xRatio >= 0.58;
          const alignLeftEdge = xRatio <= 0.36;
          const popoverPos = alignRightEdge
            ? { right: `calc(${(100 - xPct).toFixed(2)}% + 14px)`, top: `${Math.min(48, Math.max(8, yRatio * 100 - 8))}%` }
            : alignLeftEdge
              ? { left: `calc(${xPct.toFixed(2)}% + 14px)`, top: `${Math.min(48, Math.max(8, yRatio * 100 - 8))}%` }
              : { left: `${xPct.toFixed(2)}%`, top: `${Math.max(6, Math.min(44, yRatio * 100 - 12))}%`, transform: 'translateX(-50%)' };

          const sRevDiff = Math.round((s.revToday - s.revPrev) * 100) / 100;
          const sRevPct = s.revPrev > 0 ? Math.round((sRevDiff / s.revPrev) * 100) : null;
          const sCntDiff = s.cntToday - s.cntPrev;
          const sCntPct = s.cntPrev > 0 ? Math.round((sCntDiff / s.cntPrev) * 100) : null;

          return (
            <div
              className="absolute pointer-events-none transition-all duration-150 z-30"
              style={popoverPos}
            >
              <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl text-[#1D1D1F] dark:text-[#F5F5F7] px-3.5 py-2.5 rounded-[16px] shadow-[0_12px_32px_rgba(0,0,0,0.14)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.58)] border border-black/[0.08] dark:border-white/[0.14] min-w-[230px] max-w-[265px]">
                {/* Interval Header */}
                <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <span className="text-[11.5px] font-semibold text-[#1D1D1F] dark:text-white whitespace-nowrap">
                    {isHourly ? `${b.label} · ${b.fullLabel}` : b.fullLabel}
                  </span>
                </div>

                {/* Section 1: Coloane = Valoare RON */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-[2px] bg-[#007AFF]/70" />
                      Valoare (RON)
                    </span>
                    {isCompared && (s.revToday > 0 || s.revPrev > 0) && (
                      <span className={sRevDiff >= 0 ? 'text-[#1F7A33] dark:text-[#30D158]' : 'text-[#D70015] dark:text-[#FF453A]'}>
                        {sRevDiff > 0 ? '↗ ' : sRevDiff < 0 ? '↘ ' : ''}
                        {sRevPct !== null ? `${sRevPct > 0 ? '+' : ''}${sRevPct}%` : formatDiffCompact(sRevDiff, 'revenue')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#6E6E73] dark:text-[#AEAEB2]">{primarySeriesLabel}</span>
                    <span className="font-bold text-[#1D1D1F] dark:text-white">{formatThousands(s.revToday)} lei</span>
                  </div>
                  {isCompared && (
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span style={{ color: compBarColor }} className="font-medium">{compareConfig.shortLabel}</span>
                      <span className="font-semibold text-[#6E6E73] dark:text-[#AEAEB2]">{formatThousands(s.revPrev)} lei</span>
                    </div>
                  )}
                </div>

                {/* Section 2: Linie = Număr Comenzi */}
                <div className="space-y-1 mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-[2px] rounded-full bg-[#0055D4]" />
                      Comenzi (buc.)
                    </span>
                    {isCompared && (s.cntToday > 0 || s.cntPrev > 0) && (
                      <span className={sCntDiff >= 0 ? 'text-[#0055D4] dark:text-[#64D2FF]' : 'text-[#D70015] dark:text-[#FF453A]'}>
                        {sCntDiff > 0 ? '↗ ' : sCntDiff < 0 ? '↘ ' : ''}
                        {sCntPct !== null ? `${sCntPct > 0 ? '+' : ''}${sCntPct}%` : formatDiffCompact(sCntDiff, 'count')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#6E6E73] dark:text-[#AEAEB2]">{primarySeriesLabel}</span>
                    <span className="font-bold text-[#0055D4] dark:text-[#38BDF8]">{s.cntToday} {formatOrdersWord(s.cntToday)}</span>
                  </div>
                  {isCompared && (
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span style={{ color: compStrokeColor }} className="font-medium">{compareConfig.shortLabel}</span>
                      <span className="font-semibold text-[#6E6E73] dark:text-[#AEAEB2]">{s.cntPrev} {formatOrdersWord(s.cntPrev)}</span>
                    </div>
                  )}
                </div>

                {/* Incremental activity note for cumulative views */}
                {isCumulativeView && (b.hourCount > 0 || b.hourRevenue > 0) && (
                  <div className="mt-2 pt-1.5 border-t border-black/[0.06] dark:border-white/[0.08] text-[10.5px] text-[#86868B] flex items-center justify-between gap-2">
                    <span>În {b.hourRangeLabel || b.label}</span>
                    <span className="font-medium text-[#6E6E73] dark:text-[#AEAEB2]">
                      +{b.hourCount} {formatOrdersWord(b.hourCount)} · {formatThousands(b.hourRevenue)} lei
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/**
 * 2. GRAFIC: Vânzări pe Branduri — Donut + Carduri + Drilldown Navigator (stil Screen 1)
 * Suportă Branduri / Kioskuri / Locații și drilldown interactiv (Click pe felie -> Kioskuri brand).
 */
export function BrandDonutChart3D({ 
  orders = [], 
  selectedBrands = [], 
  onSelectBrand = () => {},
  selectedHour = null,
  selectedDay = null
}) {
  const [viewMode, setViewMode] = useState('brands'); // 'brands' | 'kiosks' | 'locations'
  const [drilledBrandId, setDrilledBrandId] = useState(null);
  const [drilledLocation, setDrilledLocation] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const LOCATION_PALETTE = ['#10B981', '#007AFF', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const brandData = React.useMemo(() => {
    const map = {
      smashme: { id: 'smashme', name: 'SmashMe', color: BRAND_COLORS.smashme, revenue: 0, count: 0, kiosksMap: {} },
      crunch: { id: 'crunch', name: 'Crunch', color: BRAND_COLORS.crunch, revenue: 0, count: 0, kiosksMap: {} },
      rollmaster: { id: 'rollmaster', name: 'Roll Master', color: BRAND_COLORS.rollmaster, revenue: 0, count: 0, kiosksMap: {} },
      lovesushi: { id: 'lovesushi', name: 'Love Sushi', color: BRAND_COLORS.lovesushi, revenue: 0, count: 0, kiosksMap: {} },
      pokiwoki: { id: 'pokiwoki', name: 'Poki-Woki', color: BRAND_COLORS.pokiwoki, revenue: 0, count: 0, kiosksMap: {} }
    };
    const locMap = {};
    const allKiosksSet = new Set();

    orders.forEach(o => {
      if (!o.brand || o.status === 'cancelled') return;
      const bKey = normalizeBrandKey(o.brand);
      if (!map[bKey]) {
        map[bKey] = {
          id: bKey,
          name: getBrandLabel(bKey),
          color: getBrandColor(bKey),
          revenue: 0,
          count: 0,
          kiosksMap: {}
        };
      }

      const rev = Number(o.totalAmount || 0);
      map[bKey].revenue += rev;
      map[bKey].count += 1;

      const locInfo = formatLocationAndKiosk(o);
      const kKey = locInfo.fullDisplay; // ex: "Cluj • Kiosk 1"
      allKiosksSet.add(kKey);

      if (!map[bKey].kiosksMap[kKey]) {
        map[bKey].kiosksMap[kKey] = {
          key: kKey,
          locationName: locInfo.locationName,
          kioskLabel: locInfo.kioskLabel,
          fullDisplay: locInfo.fullDisplay,
          revenue: 0,
          count: 0
        };
      }
      map[bKey].kiosksMap[kKey].revenue += rev;
      map[bKey].kiosksMap[kKey].count += 1;

      const locName = locInfo.locationName || 'Altele';
      if (!locMap[locName]) {
        locMap[locName] = { id: locName, name: locName, revenue: 0, count: 0, brandsMap: {} };
      }
      locMap[locName].revenue += rev;
      locMap[locName].count += 1;
      if (!locMap[locName].brandsMap[bKey]) {
        locMap[locName].brandsMap[bKey] = {
          id: `${locName}__${bKey}`,
          brandId: bKey,
          name: map[bKey].name,
          color: map[bKey].color,
          revenue: 0,
          count: 0
        };
      }
      locMap[locName].brandsMap[bKey].revenue += rev;
      locMap[locName].brandsMap[bKey].count += 1;
    });

    const activeList = Object.values(map)
      .filter(b => b.count > 0 || b.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count);
    const totalRev = activeList.reduce((s, b) => s + b.revenue, 0);
    const totalCnt = activeList.reduce((s, b) => s + b.count, 0);

    const formattedList = activeList.map(b => {
      const brandRev = b.revenue;
      const brandCount = b.count;
      const rawKiosks = Object.values(b.kiosksMap).sort((a, x) => b.revenue === 0 ? x.count - a.count : x.revenue - a.revenue);
      const palette = BRAND_KIOSK_PALETTES[b.id] || [b.color];

      const kiosks = rawKiosks.map((k, idx) => {
        const kColor = palette[idx % palette.length];
        const kPctOfBrand = brandRev > 0 ? (k.revenue / brandRev) * 100 : (brandCount > 0 ? (k.count / brandCount) * 100 : 0);
        const kPctOfTotal = totalRev > 0 ? (k.revenue / totalRev) * 100 : (totalCnt > 0 ? (k.count / totalCnt) * 100 : 0);
        return {
          ...k,
          id: `${b.id}__${k.key.replace(/\s+/g, '_')}`,
          brandId: b.id,
          brandName: b.name,
          color: kColor,
          avg: k.count > 0 ? (k.revenue / k.count) : 0,
          pctOfBrand: kPctOfBrand,
          pctOfTotal: kPctOfTotal
        };
      });

      return {
        ...b,
        avg: brandCount > 0 ? (brandRev / brandCount) : 0,
        pct: totalRev > 0 ? (brandRev / totalRev) * 100 : (totalCnt > 0 ? (brandCount / totalCnt) * 100 : 0),
        kiosks
      };
    });

    const locationsList = Object.values(locMap)
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
      .map((loc, idx) => {
        const subBrands = Object.values(loc.brandsMap)
          .sort((a, b) => b.revenue - a.revenue)
          .map(sb => ({
            ...sb,
            avg: sb.count > 0 ? sb.revenue / sb.count : 0,
            pct: loc.revenue > 0 ? (sb.revenue / loc.revenue) * 100 : 0
          }));
        return {
          ...loc,
          color: LOCATION_PALETTE[idx % LOCATION_PALETTE.length],
          avg: loc.count > 0 ? loc.revenue / loc.count : 0,
          pct: totalRev > 0 ? (loc.revenue / totalRev) * 100 : 0,
          brands: subBrands
        };
      });

    return {
      list: formattedList,
      locations: locationsList,
      totalRevenue: totalRev,
      totalCount: totalCnt,
      totalKiosks: allKiosksSet.size
    };
  }, [orders]);

  // Reset drilldown safely if selected period no longer contains the drilled brand/location
  const activeDrilledBrand = drilledBrandId ? brandData.list.find(b => b.id === drilledBrandId) : null;
  const activeDrilledLocation = drilledLocation ? brandData.locations.find(l => l.id === drilledLocation) : null;

  // Build active display items depending on viewMode & drilldown depth
  const { items, scopeTotalRev, scopeTotalCnt, scopeUnitCount, scopeUnitLabel, levelLabel, canReset } = React.useMemo(() => {
    if (viewMode === 'brands' && activeDrilledBrand) {
      const list = activeDrilledBrand.kiosks.map(k => ({
        id: k.id,
        brandId: activeDrilledBrand.id,
        name: k.fullDisplay,
        shortName: k.kioskLabel || k.fullDisplay,
        subtitle: `${k.count} ${k.count === 1 ? 'comandă' : 'comenzi'} · med. ${formatThousands(k.avg, 0)} lei`,
        revenue: k.revenue,
        count: k.count,
        avg: k.avg,
        pct: k.pctOfBrand,
        color: k.color,
        isDrillable: false
      }));
      return {
        items: list,
        scopeTotalRev: activeDrilledBrand.revenue,
        scopeTotalCnt: activeDrilledBrand.count,
        scopeUnitCount: list.length,
        scopeUnitLabel: 'Kioskuri',
        levelLabel: `${activeDrilledBrand.name} → Kioskuri`,
        canReset: true
      };
    }

    if (viewMode === 'locations' && activeDrilledLocation) {
      const list = activeDrilledLocation.brands.map(sb => ({
        id: sb.id,
        brandId: sb.brandId,
        name: sb.name,
        shortName: sb.name,
        revenue: sb.revenue,
        count: sb.count,
        avg: sb.avg,
        extraTag: '',
        pct: sb.pct,
        color: sb.color,
        isDrillable: false
      }));
      return {
        items: list,
        scopeTotalRev: activeDrilledLocation.revenue,
        scopeTotalCnt: activeDrilledLocation.count,
        scopeUnitCount: list.length,
        scopeUnitLabel: 'Branduri',
        levelLabel: `${activeDrilledLocation.name} → Branduri`,
        canReset: true
      };
    }

    if (viewMode === 'kiosks') {
      const allKiosks = [];
      brandData.list.forEach(b => {
        b.kiosks.forEach(k => {
          allKiosks.push({
            id: k.id,
            brandId: b.id,
            name: `${b.name} · ${k.fullDisplay}`,
            shortName: `${b.name} ${k.kioskLabel}`,
            revenue: k.revenue,
            count: k.count,
            avg: k.avg,
            extraTag: '',
            pct: k.pctOfTotal,
            color: k.color,
            isDrillable: true
          });
        });
      });
      allKiosks.sort((a, b) => b.revenue - a.revenue || b.count - a.count);
      return {
        items: allKiosks,
        scopeTotalRev: brandData.totalRevenue,
        scopeTotalCnt: brandData.totalCount,
        scopeUnitCount: allKiosks.length,
        scopeUnitLabel: 'Kioskuri',
        levelLabel: 'Toate Kioskurile',
        canReset: selectedBrands.length > 0
      };
    }

    if (viewMode === 'locations') {
      const list = brandData.locations.map(loc => ({
        id: loc.id,
        locationId: loc.id,
        name: loc.name,
        shortName: loc.name,
        revenue: loc.revenue,
        count: loc.count,
        avg: loc.avg,
        extraTag: `${loc.brands.length} ${loc.brands.length === 1 ? 'brand' : 'branduri'}`,
        pct: loc.pct,
        color: loc.color,
        isDrillable: loc.brands.length > 0
      }));
      return {
        items: list,
        scopeTotalRev: brandData.totalRevenue,
        scopeTotalCnt: brandData.totalCount,
        scopeUnitCount: list.length,
        scopeUnitLabel: 'Locații',
        levelLabel: 'Toate Locațiile',
        canReset: selectedBrands.length > 0
      };
    }

    // Default: Branduri
    const list = brandData.list.map(b => ({
      id: b.id,
      brandId: b.id,
      name: b.name,
      shortName: b.name,
      revenue: b.revenue,
      count: b.count,
      avg: b.avg,
      extraTag: b.kiosks.length > 1 ? `${b.kiosks.length} kioskuri` : '',
      pct: b.pct,
      color: b.color,
      isDrillable: b.kiosks.length > 0
    }));
    return {
      items: list,
      scopeTotalRev: brandData.totalRevenue,
      scopeTotalCnt: brandData.totalCount,
      scopeUnitCount: list.length,
      scopeUnitLabel: 'Branduri',
      levelLabel: 'Toate Brandurile',
      canReset: selectedBrands.length > 0
    };
  }, [viewMode, activeDrilledBrand, activeDrilledLocation, brandData, selectedBrands.length]);

  const scopeAvg = scopeTotalCnt > 0 ? scopeTotalRev / scopeTotalCnt : 0;

  let cumulativeAngle = 0;
  const slices = items.map(item => {
    const angleSpan = (item.pct / 100) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angleSpan;
    cumulativeAngle += angleSpan;
    return { ...item, startAngle, endAngle, angleSpan };
  });

  const activeHovered = slices.find(s => s.id === hoveredId) || null;

  const handleItemClick = (item) => {
    if (viewMode === 'brands' && !activeDrilledBrand && item.brandId) {
      setDrilledBrandId(item.brandId);
      setHoveredId(null);
      if (!selectedBrands.includes(item.brandId)) {
        onSelectBrand(item.brandId);
      }
      return;
    }
    if (viewMode === 'locations' && !activeDrilledLocation && item.locationId) {
      setDrilledLocation(item.locationId);
      setHoveredId(null);
      return;
    }
    if (item.brandId) {
      onSelectBrand(item.brandId);
    }
  };

  const handleReset = () => {
    setDrilledBrandId(null);
    setDrilledLocation(null);
    setHoveredId(null);
    if (selectedBrands.length > 0) {
      selectedBrands.forEach(bId => onSelectBrand(bId));
    }
  };

  return (
    <div className="apple-card relative p-4 sm:p-5 overflow-hidden group h-full flex flex-col justify-between">
      {/* 1. Header Row (Identic Screen 1: Icon + Titlu stânga, Segmented Pills dreapta) */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 mb-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/12 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <PieChart className="w-4 h-4" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h4 className="text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
              Vânzări pe Branduri
            </h4>
            {(selectedHour !== null || selectedDay?.label) && (
              <p className="text-[10.5px] text-[#86868B] truncate leading-tight">
                {selectedHour !== null ? `Ora ${selectedHour}:00–${selectedHour + 1}:00` : selectedDay.label}
              </p>
            )}
          </div>
        </div>

        <div className="apple-segmented shrink-0">
          {[
            { id: 'brands', label: 'Branduri' },
            { id: 'kiosks', label: 'Kioskuri' },
            { id: 'locations', label: 'Locații' },
          ].map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setViewMode(m.id);
                setDrilledBrandId(null);
                setDrilledLocation(null);
                setHoveredId(null);
              }}
              className={`apple-segmented-item !px-2.5 !py-1 !text-[11.5px] ${viewMode === m.id ? 'is-active' : ''}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. KPI Strip (4 Mini-Carduri Curate — Exact Structura din Screen 1) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3.5 shrink-0">
        <div className="rounded-[12px] border border-black/[0.06] dark:border-white/[0.08] bg-[#FAFAFC] dark:bg-white/[0.04] px-2.5 py-2 text-center">
          <div className="text-[10.5px] font-medium text-[#6E6E73] dark:text-[#98989D] truncate">Total Încasări</div>
          <div className="text-[14px] font-bold text-[#1D1D1F] dark:text-white mt-0.5 whitespace-nowrap">
            {formatThousands(scopeTotalRev, 0)} <span className="text-[11px] font-semibold text-[#86868B]">lei</span>
          </div>
        </div>
        <div className="rounded-[12px] border border-black/[0.06] dark:border-white/[0.08] bg-[#FAFAFC] dark:bg-white/[0.04] px-2.5 py-2 text-center">
          <div className="text-[10.5px] font-medium text-[#6E6E73] dark:text-[#98989D] truncate">Comenzi</div>
          <div className="text-[14px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 whitespace-nowrap">
            {scopeTotalCnt}
          </div>
        </div>
        <div className="rounded-[12px] border border-black/[0.06] dark:border-white/[0.08] bg-[#FAFAFC] dark:bg-white/[0.04] px-2.5 py-2 text-center">
          <div className="text-[10.5px] font-medium text-[#6E6E73] dark:text-[#98989D] truncate">Bon Mediu</div>
          <div className="text-[14px] font-bold text-[#1D1D1F] dark:text-white mt-0.5 whitespace-nowrap">
            {formatThousands(scopeAvg, 0)} <span className="text-[11px] font-semibold text-[#86868B]">lei</span>
          </div>
        </div>
        <div className="rounded-[12px] border border-black/[0.06] dark:border-white/[0.08] bg-[#FAFAFC] dark:bg-white/[0.04] px-2.5 py-2 text-center">
          <div className="text-[10.5px] font-medium text-[#6E6E73] dark:text-[#98989D] truncate">{scopeUnitLabel}</div>
          <div className="text-[14px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 whitespace-nowrap">
            {scopeUnitCount}
          </div>
        </div>
      </div>

      {/* 3. Middle Split: Donut Stânga (cu Halo + Inel Interior Curat) + Listă Carduri Dreapta */}
      <div className="grid grid-cols-1 sm:grid-cols-[158px_1fr] 2xl:grid-cols-[184px_1fr] gap-3.5 items-center flex-1 min-h-0">
        {/* Donut SVG — stil identic Screen 1, scalat armonios pe ecrane mari */}
        <div className="relative flex items-center justify-center">
          <svg viewBox="0 0 216 216" className="w-[156px] h-[156px] 2xl:w-[180px] 2xl:h-[180px] overflow-visible">
            {/* Soft outer circular halo (exact ca în Screen 1) */}
            <circle
              cx="108"
              cy="108"
              r="95"
              className="fill-[#F3F5F8] dark:fill-white/[0.04]"
            />

            {/* Empty track when no sales */}
            {slices.length === 0 && (
              <circle
                cx="108"
                cy="108"
                r="71"
                fill="none"
                stroke="currentColor"
                className="text-black/[0.07] dark:text-white/[0.1]"
                strokeWidth="24"
              />
            )}

            {slices.map(s => {
              if (s.angleSpan <= 0) return null;
              const isHovered = hoveredId === s.id;
              const isSelected = s.brandId && selectedBrands.includes(s.brandId);

              const rOut = isHovered || isSelected ? 87 : 84;
              const rIn = 57;
              const gap = slices.length > 1 ? 2.4 : 0;
              const a1 = (s.startAngle + gap / 2 - 90) * (Math.PI / 180);
              const a2 = (s.endAngle - gap / 2 - 90) * (Math.PI / 180);
              const span = Math.max(0.5, s.angleSpan - gap);
              const largeArc = span > 180 ? 1 : 0;

              if (span >= 358) {
                return (
                  <circle
                    key={`slice-${s.id}`}
                    cx="108"
                    cy="108"
                    r={(rOut + rIn) / 2}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={rOut - rIn}
                    onClick={() => handleItemClick(s)}
                    onMouseEnter={() => setHoveredId(s.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className="cursor-pointer transition-all duration-200"
                  />
                );
              }

              const x1 = 108 + rOut * Math.cos(a1);
              const y1 = 108 + rOut * Math.sin(a1);
              const x2 = 108 + rOut * Math.cos(a2);
              const y2 = 108 + rOut * Math.sin(a2);
              const x3 = 108 + rIn * Math.cos(a2);
              const y3 = 108 + rIn * Math.sin(a2);
              const x4 = 108 + rIn * Math.cos(a1);
              const y4 = 108 + rIn * Math.sin(a1);
              const pathData = `M ${x1},${y1} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2},${y2} L ${x3},${y3} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4},${y4} Z`;

              return (
                <path
                  key={`slice-${s.id}`}
                  d={pathData}
                  fill={s.color}
                  onClick={() => handleItemClick(s)}
                  onMouseEnter={() => setHoveredId(s.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="cursor-pointer transition-all duration-200"
                  opacity={
                    hoveredId && !isHovered
                      ? 0.45
                      : !activeDrilledBrand && selectedBrands.length > 0 && !isSelected
                        ? 0.35
                        : 1
                  }
                />
              );
            })}

            {/* Crisp White Inner Medallion with subtle border (exact ca în Screen 1) */}
            <circle
              cx="108"
              cy="108"
              r="50"
              className="fill-white dark:fill-[#1C1C1E] stroke-black/[0.08] dark:stroke-white/[0.12]"
              strokeWidth="1.2"
            />

            {/* Center Text inside Medallion */}
            <g className="pointer-events-none select-none">
              {activeHovered ? (
                <>
                  <text
                    x="108"
                    y="93"
                    textAnchor="middle"
                    fontSize="8.5"
                    className="fill-[#6E6E73] dark:fill-[#98989D] font-semibold uppercase tracking-wider"
                  >
                    {activeHovered.shortName.slice(0, 14)}
                  </text>
                  <text
                    x="108"
                    y="112"
                    textAnchor="middle"
                    fontSize="16"
                    className="fill-[#1D1D1F] dark:fill-white font-bold tracking-tight"
                  >
                    {formatThousands(activeHovered.revenue, 0)}
                  </text>
                  <text
                    x="108"
                    y="126"
                    textAnchor="middle"
                    fontSize="9.5"
                    fill={activeHovered.color}
                    className="font-bold uppercase tracking-wide"
                  >
                    {activeHovered.pct.toFixed(0)}% · {activeHovered.count} cmd
                  </text>
                </>
              ) : (
                <>
                  <text
                    x="108"
                    y="93"
                    textAnchor="middle"
                    fontSize="8.5"
                    className="fill-[#6E6E73] dark:fill-[#98989D] font-semibold uppercase tracking-wider"
                  >
                    TOTAL
                  </text>
                  <text
                    x="108"
                    y="113"
                    textAnchor="middle"
                    fontSize="17"
                    className="fill-[#1D1D1F] dark:fill-white font-bold tracking-tight"
                  >
                    {formatThousands(scopeTotalRev, 0)}
                  </text>
                  <text
                    x="108"
                    y="126"
                    textAnchor="middle"
                    fontSize="9"
                    className="fill-emerald-600 dark:fill-emerald-400 font-bold uppercase tracking-wider"
                  >
                    LEI · {scopeTotalCnt} CMD
                  </text>
                </>
              )}
            </g>
          </svg>
        </div>

        {/* Right List: Clean Rounded Brand/Kiosk Rows (Exact Screen 1 layout: Logo + Name/Sub + Pill + Colored %) */}
        <div className="flex flex-col gap-1.5 max-h-[196px] overflow-y-auto pr-0.5 min-w-0">
          {items.length === 0 ? (
            <div className="p-4 text-center text-[#86868B] text-xs bg-[#FAFAFC] dark:bg-white/[0.04] rounded-2xl border border-black/[0.05] dark:border-white/[0.06]">
              Niciun brand cu vânzări în perioada selectată.
            </div>
          ) : (
            items.map(item => {
              const isHovered = hoveredId === item.id;
              const isSelected = !activeDrilledBrand && item.brandId && selectedBrands.includes(item.brandId);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-[13px] border transition-all cursor-pointer ${
                    isSelected || isHovered
                      ? 'bg-white dark:bg-white/[0.09] border-black/[0.14] dark:border-white/[0.2] shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                      : 'bg-[#FAFAFC] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.07] hover:bg-white dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-[#2C2C2E] border border-black/[0.07] dark:border-white/[0.1] shadow-2xs flex items-center justify-center shrink-0">
                    {item.brandId ? (
                      <BrandLogo brandId={item.brandId} size={20} />
                    ) : (
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    )}
                  </div>

                  {/* Two full-width crisp rows: Row 1 = Name + [lei] + %, Row 2 = Comenzi + Media (NEVER truncated!) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate leading-tight">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-[8px] bg-white dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.12] text-[11px] font-semibold text-[#1D1D1F] dark:text-white whitespace-nowrap">
                          {formatThousands(item.revenue, 0)} lei
                        </span>
                        <span
                          className="text-[12px] font-bold min-w-[30px] text-right whitespace-nowrap"
                          style={{ color: item.brandId === 'pokiwoki' ? '#10B981' : item.color }}
                        >
                          {Math.round(item.pct)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-[#6E6E73] dark:text-[#98989D] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{item.count} cmd</span>
                        <span className="text-black/20 dark:text-white/25">·</span>
                        <span className="font-medium text-[#1D1D1F]/80 dark:text-white/80">
                          med. {formatThousands(item.avg, 0)} lei
                        </span>
                      </span>
                      {item.extraTag && (
                        <span className="text-[10px] text-[#86868B] shrink-0">
                          {item.extraTag}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Bottom Drilldown Navigator (Stacked Horizontal Bar + Nivel + Hint + Resetare 100% — Exact ca în Screen 1) */}
      <div className="mt-3.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
        <div className="flex items-center justify-between gap-2 mb-1.5 text-[10.5px]">
          <span className="font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D] truncate">
            DRILLDOWN NAVIGATOR <span className="normal-case font-medium text-[#86868B]">(Ierarhie &amp; Pondere)</span>
          </span>
          <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap shrink-0">
            Nivel: {levelLabel}
          </span>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="w-full h-7 rounded-[10px] overflow-hidden flex gap-[2px] bg-black/[0.05] dark:bg-white/[0.07]">
          {items.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-[10.5px] text-[#86868B]">
              Fără date
            </div>
          ) : (
            items.map(item => {
              const isHovered = hoveredId === item.id;
              const pctRound = Math.round(item.pct);
              return (
                <button
                  key={`bar-${item.id}`}
                  type="button"
                  title={`${item.name}: ${formatThousands(item.revenue)} lei (${pctRound}% · ${item.count} cmd)`}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    width: `${Math.max(item.pct, 2)}%`,
                    backgroundColor: item.color,
                    opacity: hoveredId && !isHovered ? 0.55 : 1
                  }}
                  className="h-full flex items-center justify-center px-1.5 text-white text-[11px] font-semibold transition-all duration-150 cursor-pointer overflow-hidden whitespace-nowrap"
                >
                  {item.pct >= 18 ? (
                    <span className="truncate">{item.shortName} {pctRound}%</span>
                  ) : item.pct >= 9 ? (
                    <span>{pctRound}%</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hint + Resetare (100%) */}
        <div className="flex items-center justify-between gap-2 mt-2 text-[11px]">
          <span className="text-[#86868B] inline-flex items-center gap-1.5 truncate">
            <span className="w-3.5 h-3.5 rounded-full border border-[#86868B]/60 inline-flex items-center justify-center text-[9px] font-bold shrink-0">i</span>
            <span className="truncate">
              {activeDrilledBrand || activeDrilledLocation
                ? 'Afișare detaliată pe nivelul selectat.'
                : 'Click pe o felie pentru explorare în profunzime.'}
            </span>
          </span>
          <button
            type="button"
            onClick={handleReset}
            className={`font-semibold whitespace-nowrap shrink-0 transition-opacity cursor-pointer ${
              canReset
                ? 'text-emerald-600 dark:text-emerald-400 hover:underline'
                : 'text-emerald-600/75 dark:text-emerald-400/75 hover:text-emerald-600 dark:hover:text-emerald-400'
            }`}
          >
            Resetare (100%)
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 3. GRAFIC 3D: Metode de Plată (Card POS vs Cash + Analiză Bănci Emitente & Rețele)
 */
export function PaymentMethodsChart3D({ 
  orders = [], 
  selectedPayment = 'all', 
  onSelectPayment = () => {},
  selectedHour = null,
  selectedDay = null
}) {
  const [hoveredMethod, setHoveredMethod] = useState(null);
  const [cardSubMode, setCardSubMode] = useState('banks'); // 'banks' | 'networks'
  const [isCardDetailsExpanded, setIsCardDetailsExpanded] = useState(false);

  const stats = React.useMemo(() => {
    let cardRev = 0, cardCnt = 0;
    let cashRev = 0, cashCnt = 0;
    let visaRev = 0, visaCnt = 0;
    let mcRev = 0, mcCnt = 0;

    const banksMap = {};
    Object.keys(BANK_CONFIG).forEach(k => {
      banksMap[k] = { ...BANK_CONFIG[k], revenue: 0, count: 0 };
    });

    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const amt = o.totalAmount || 0;
      const isCard = o.paymentMethod === 'card' || !!o.paymentRef?.authCode;
      if (isCard) {
        cardRev += amt;
        cardCnt += 1;
        const brand = detectCardBrand(o);
        if (brand === 'mastercard') {
          mcRev += amt;
          mcCnt += 1;
        } else {
          visaRev += amt;
          visaCnt += 1;
        }

        const bank = detectCardBank(o);
        if (banksMap[bank.id]) {
          banksMap[bank.id].revenue += amt;
          banksMap[bank.id].count += 1;
        }
      } else {
        cashRev += amt;
        cashCnt += 1;
      }
    });

    const totalRev = cardRev + cashRev;
    const totalCnt = cardCnt + cashCnt;

    const visaPctOfCard = cardRev > 0 ? (visaRev / cardRev) * 100 : 0;
    const mcPctOfCard = cardRev > 0 ? (mcRev / cardRev) * 100 : 0;

    const activeBanks = Object.values(banksMap)
      .filter(b => b.count > 0 || b.revenue > 0)
      .map(b => ({
        ...b,
        avg: b.count > 0 ? b.revenue / b.count : 0,
        pctOfCard: cardRev > 0 ? (b.revenue / cardRev) * 100 : 0,
        pctOfTotal: totalRev > 0 ? (b.revenue / totalRev) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      card: {
        id: 'card',
        label: 'Card (POS Printec)',
        revenue: cardRev,
        count: cardCnt,
        pct: totalRev > 0 ? (cardRev / totalRev) * 100 : 0,
        visa: {
          revenue: visaRev,
          count: visaCnt,
          pctOfCard: visaPctOfCard,
        },
        mastercard: {
          revenue: mcRev,
          count: mcCnt,
          pctOfCard: mcPctOfCard,
        },
        banks: activeBanks
      },
      cash: {
        id: 'cash',
        label: 'Cash (Casa Syrve)',
        revenue: cashRev,
        count: cashCnt,
        pct: totalRev > 0 ? (cashRev / totalRev) * 100 : 0
      },
      totalRevenue: totalRev,
      totalCount: totalCnt
    };
  }, [orders]);

  const isCardActive = selectedPayment === 'card';
  const isVisaActive = selectedPayment === 'visa';
  const isMastercardActive = selectedPayment === 'mastercard';
  const isBankActive = typeof selectedPayment === 'string' && selectedPayment.startsWith('bank_');
  const isAnyCardActive = isCardActive || isVisaActive || isMastercardActive || isBankActive;
  const isCashActive = selectedPayment === 'cash';

  return (
    <div className="apple-card relative p-4 sm:p-5 overflow-hidden group h-full flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white"
            style={{
              backgroundColor: '#34C759',
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)',
              boxShadow: '0 2px 8px -1px rgba(52,199,89,0.42), inset 0 0.5px 0 rgba(255,255,255,0.35)'
            }}
          >
            <CreditCard className="w-[18px] h-[18px]" strokeWidth={2.1} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              Metode de Plată
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {selectedHour !== null 
                ? `la ora ${selectedHour}:00 - ${selectedHour + 1}:00 • Card POS vs Cash` 
                : selectedDay
                ? `${selectedDay.label} • Card POS vs Cash`
                : 'Card POS vs Cash la Casă (click pentru filtrare)'}
            </p>
          </div>
        </div>

        {(isAnyCardActive || isCashActive) && (
          <button
            onClick={() => onSelectPayment('all')}
            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Resetează
          </button>
        )}
      </div>

      {/* ─── Apple HIG Segmented Distribution Bar (Card POS vs Cash) ─── */}
      <div className="space-y-2 relative z-10 select-none">
        {/* Metric Header */}
        <div className="flex items-center justify-between text-xs font-medium px-0.5">
          <div 
            onClick={() => onSelectPayment(isCardActive ? 'all' : 'card')}
            className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${isCashActive ? 'opacity-40 hover:opacity-80' : 'opacity-100'}`}
            title="Filtrează după Card POS"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-700 dark:text-slate-200 font-semibold">Card POS</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              {stats.card.pct.toFixed(1)}%
            </span>
          </div>

          <div 
            onClick={() => onSelectPayment(isCashActive ? 'all' : 'cash')}
            className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${isAnyCardActive ? 'opacity-40 hover:opacity-80' : 'opacity-100'}`}
            title="Filtrează după Cash"
          >
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              {stats.cash.pct.toFixed(1)}%
            </span>
            <span className="text-slate-700 dark:text-slate-200 font-semibold">Cash</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
        </div>

        {/* Apple HIG Segmented Distribution Bar */}
        <div 
          className="w-full h-3 rounded-full bg-slate-100 dark:bg-white/[0.04] p-0.5 flex gap-0.5 overflow-hidden cursor-pointer border border-slate-200/60 dark:border-white/[0.08]"
          onClick={() => onSelectPayment(isCardActive ? 'cash' : (isCashActive ? 'all' : 'card'))}
          title="Click pentru a filtra după metoda de plată"
        >
          <div 
            style={{ width: `${stats.card.pct}%` }}
            className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
          />
          <div 
            style={{ width: `${stats.cash.pct}%` }}
            className="h-full rounded-full bg-amber-500 transition-all duration-500 ease-out"
          />
        </div>
      </div>

      {/* ─── Carduri Metode de Plată ─── */}
      <div className="space-y-3 relative z-10">
        {/* Card POS (cu Comparație Bănci Emitente & Visa vs Mastercard) */}
        <div
          onClick={() => onSelectPayment(isCardActive ? 'all' : 'card')}
          className={`bg-white dark:bg-[#161618] rounded-2xl border p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-200 group cursor-pointer select-none ${
            isAnyCardActive
              ? 'ring-2 ring-emerald-500/60 border-emerald-500 shadow-sm'
              : isCashActive
                ? 'opacity-40 border-slate-200/80 dark:border-white/[0.08] hover:opacity-75'
                : 'border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] shadow-2xs'
          }`}
        >
          {/* Rând Principal: Total Card POS */}
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col justify-center min-w-0 pr-2 z-10 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Card POS
                </span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  {stats.card.pct.toFixed(1)}%
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {formatThousands(stats.card.revenue)}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  lei
                </span>
              </div>

              <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                <span>{stats.card.count} {stats.card.count === 1 ? 'comandă' : 'comenzi'}</span>
                <span className="text-slate-300 dark:text-white/20">•</span>
                <span>Terminal Bancar</span>
              </div>
            </div>

            <div className="shrink-0 ml-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] transition-transform duration-200 group-hover:scale-105">
                <CreditCard size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>

          {/* ─── Sub-Panou: Bănci Emitente (BT, Revolut, ING, BCR) vs Rețele (Visa/MC) (Restrâns implicit) ─── */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-white/[0.08] z-10">
            {!(isCardDetailsExpanded || isBankActive || isVisaActive || isMastercardActive) ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsCardDetailsExpanded(true); }}
                className="w-full flex items-center justify-between py-1.5 px-3 rounded-full border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-[11px] font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer group/btn shadow-2xs"
              >
                <span className="flex items-center gap-1.5">
                  <span></span>
                  <span>Bănci Emitente & Rețele</span>
                  <span className="text-[10px] font-semibold text-slate-400">({stats.card.banks.length} bănci • Visa / MC)</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  <span>Extinde</span>
                  <ChevronDown size={13} className="group-hover/btn:translate-y-0.5 transition-transform" />
                </span>
              </button>
            ) : (
              <div className="animate-fadeIn">
                {/* Header Comparație cu Toggle Bănci vs Rețele */}
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider text-[9.5px] font-extrabold text-slate-600 dark:text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {cardSubMode === 'banks' ? 'Distribuție Bănci' : 'Comparație Emisori'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsCardDetailsExpanded(false); }}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                      title="Restrânge panoul de bănci"
                    >
                      <span>Restrânge</span>
                      <ChevronUp size={11} />
                    </button>
                  </div>

              <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] p-0.5 rounded-lg border border-slate-200 dark:border-white/[0.08] shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCardSubMode('banks'); }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                    cardSubMode === 'banks'
                      ? 'bg-white dark:bg-white/[0.12] text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-black/5 dark:ring-white/10'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Bănci
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCardSubMode('networks'); }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                    cardSubMode === 'networks'
                      ? 'bg-white dark:bg-white/[0.12] text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-black/5 dark:ring-white/10'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Rețele
                </button>
              </div>
            </div>

            {cardSubMode === 'banks' ? (
              <div className="space-y-2.5">
                {/* Multi-Segmented Bank Distribution Bar */}
                <div className="relative w-full h-2 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden flex shadow-inner">
                  {stats.card.banks.map((b, i) => (
                    <div 
                      key={b.id}
                      style={{ 
                        width: `${b.pctOfCard}%`,
                        backgroundColor: b.color
                      }}
                      className={`h-full transition-all duration-500 ${i === 0 ? 'rounded-l-full' : ''} ${i === stats.card.banks.length - 1 ? 'rounded-r-full' : ''}`}
                      title={`${b.name}: ${b.pctOfCard.toFixed(1)}% (${formatThousands(b.revenue)} lei)`}
                    />
                  ))}
                </div>

                {/* Grid Bănci Emitente */}
                <div className="grid grid-cols-2 gap-1.5 max-h-[175px] overflow-y-auto pr-0.5 custom-scrollbar">
                  {stats.card.banks.length === 0 ? (
                    <div className="col-span-2 text-center text-xs text-slate-400 py-2">
                      Nicio plată cu cardul înregistrată
                    </div>
                  ) : (
                    stats.card.banks.map(b => {
                      const isThisBankActive = selectedPayment === `bank_${b.id}`;
                      return (
                        <div 
                          key={b.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPayment(isThisBankActive ? 'all' : `bank_${b.id}`);
                          }}
                          className={`p-2 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                            isThisBankActive
                              ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/40 shadow-sm scale-[1.02]'
                              : isBankActive
                                ? 'opacity-40 border-slate-200/60 dark:border-white/[0.08] hover:opacity-80'
                                : 'bg-slate-50/80 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:shadow-xs'
                          }`}
                          title={`Click pentru a filtra tranzacțiile ${b.name}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <BankLogo bankId={b.id} bank={b} size={26} className="shadow-xs shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {b.shortName}
                                </span>
                                <span className="px-1 py-0.2 rounded text-[9px] font-black bg-slate-200/70 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300">
                                  {b.pctOfCard.toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-[11px] font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                                {formatThousands(b.revenue)} <span className="text-[8px] font-semibold text-slate-400">lei</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-1">
                            <span className="text-[9.5px] font-bold text-slate-400 block">
                              {b.count} cmd
                            </span>
                            <span className="text-[8.5px] text-slate-500 dark:text-slate-400 font-semibold block">
                              med. {formatThousands(b.avg, 0)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Insight Footer */}
                {stats.card.banks.length > 0 && (
                  <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between text-[10px]">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      {stats.card.banks[0].name} ({stats.card.banks[0].pctOfCard.toFixed(0)}%)
                    </span>
                    <span className="text-slate-400 text-[9px] font-medium">
                      Top Carduri
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Modul Rețele (Visa / Mastercard) */
              <div>
                <div className="relative w-full h-2 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden flex shadow-inner mb-2.5">
                  <div 
                    style={{ width: `${stats.card.visa.pctOfCard}%` }}
                    className="h-full bg-gradient-to-r from-[#102468] via-[#1e40af] to-[#3b82f6] transition-all duration-700 relative rounded-l-full"
                    title={`Visa: ${stats.card.visa.pctOfCard.toFixed(1)}% (${formatThousands(stats.card.visa.revenue)} lei)`}
                  />
                  <div 
                    style={{ width: `${stats.card.mastercard.pctOfCard}%` }}
                    className="h-full bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#eb001b] transition-all duration-700 relative rounded-r-full"
                    title={`Mastercard: ${stats.card.mastercard.pctOfCard.toFixed(1)}% (${formatThousands(stats.card.mastercard.revenue)} lei)`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Card Visa */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPayment(isVisaActive ? 'all' : 'visa');
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between group/visa ${
                      isVisaActive
                        ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/40 shadow-sm scale-[1.02]'
                        : isMastercardActive
                          ? 'opacity-40 border-slate-200/60 dark:border-white/[0.08] hover:opacity-80'
                          : 'bg-slate-50/80 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-white/[0.08] hover:shadow-sm'
                    }`}
                    title="Click pentru a filtra doar plăți Visa"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-5.5 rounded-md bg-gradient-to-br from-[#102468] via-[#0b1b4f] to-[#040c29] border border-blue-600/40 shadow-xs flex items-center justify-center shrink-0 px-1 overflow-hidden">
                        <svg width="22" height="7.5" viewBox="0 0 780 250" fill="none">
                          <path d="M293.4 12.8L192.5 240.4H134.2L81.7 58.7C78.5 46.2 75.7 41.7 65.7 36.3C49.3 27.5 23.1 19.3 0 14.4L5.4 2.1H106.6C120.3 2.1 132.8 11.2 135.8 26.6L162.2 165.7L228.6 2.1H293.4V12.8ZM550.9 164.7C551.4 102.3 464.3 98.7 464.9 70.8C465.2 62.3 473.4 53.2 491.5 50.8C500.4 49.6 525.4 48.6 553.6 61.6L564.7 9.8C549.4 4.3 529.7 0 504.7 0C443.4 0 399.7 32.6 399.3 79.5C398.9 114 430.1 133.3 453.6 144.8C477.8 156.6 485.9 164.1 485.7 174.7C485.4 191 465.9 198.1 448 198.4C416.7 198.8 398.5 190 384.1 183.3L372.4 237.9C388.6 245.4 418.5 251.7 449.6 252C513.7 252 550.4 220.4 550.9 164.7ZM712.5 240.4H768L719.2 2.1H668C656.7 2.1 647.2 8.7 643.1 18.5L549.4 240.4H611.8L624.2 206.3H700.5L712.5 240.4ZM641.4 159.2L672.7 73.1L690.7 159.2H641.4ZM387.6 2.1L338.4 240.4H280.4L329.6 2.1H387.6Z" fill="#FFFFFF"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Visa</span>
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-blue-500/15 text-blue-700 dark:text-blue-400">
                            {stats.card.visa.pctOfCard.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-[11.5px] font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                          {formatThousands(stats.card.visa.revenue)} <span className="text-[9px] font-semibold text-slate-400">lei</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0 ml-1">
                      {stats.card.visa.count} cmd
                    </span>
                  </div>

                  {/* Card Mastercard */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPayment(isMastercardActive ? 'all' : 'mastercard');
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between group/mc ${
                      isMastercardActive
                        ? 'bg-orange-50/90 dark:bg-orange-950/50 border-orange-500 ring-2 ring-orange-500/40 shadow-sm scale-[1.02]'
                        : isVisaActive
                          ? 'opacity-40 border-slate-200/60 dark:border-white/[0.08] hover:opacity-80'
                          : 'bg-slate-50/80 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] hover:border-orange-400 hover:bg-orange-50/40 dark:hover:bg-white/[0.08] hover:shadow-sm'
                    }`}
                    title="Click pentru a filtra doar plăți Mastercard"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-5.5 rounded-md bg-[#161618] border border-white/[0.12] shadow-xs flex items-center justify-center shrink-0 overflow-hidden">
                        <svg width="20" height="13" viewBox="0 0 24 15" fill="none">
                          <circle cx="7.5" cy="7.5" r="7" fill="#EB001B"/>
                          <circle cx="16.5" cy="7.5" r="7" fill="#F79E1B"/>
                          <path d="M12 2.2a6.98 6.98 0 0 1 0 10.6 6.98 6.98 0 0 1 0-10.6Z" fill="#FF5F00"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">MC</span>
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400">
                            {stats.card.mastercard.pctOfCard.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-[11.5px] font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                          {formatThousands(stats.card.mastercard.revenue)} <span className="text-[9px] font-semibold text-slate-400">lei</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0 ml-1">
                      {stats.card.mastercard.count} cmd
                    </span>
                  </div>
                </div>
              </div>
            )}
              </div>
            )}
          </div>
        </div>

        {/* Cash la Casă */}
        <div
          onClick={() => onSelectPayment(isCashActive ? 'all' : 'cash')}
          className={`bg-white dark:bg-[#161618] rounded-2xl border p-4 flex items-center justify-between relative overflow-hidden transition-all duration-200 group cursor-pointer select-none ${
            isCashActive
              ? 'ring-2 ring-amber-500/60 border-amber-500 shadow-sm'
              : isAnyCardActive
                ? 'opacity-40 border-slate-200/80 dark:border-white/[0.08] hover:opacity-75'
                : 'border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] shadow-2xs'
          }`}
        >
          <div className="flex flex-col justify-center min-w-0 pr-2 z-10 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cash la Casă
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                {stats.cash.pct.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {formatThousands(stats.cash.revenue)}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                lei
              </span>
            </div>

            <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span>{stats.cash.count} {stats.cash.count === 1 ? 'comandă' : 'comenzi'}</span>
              <span className="text-slate-300 dark:text-white/20">•</span>
              <span>Casa Syrve</span>
            </div>
          </div>

          <div className="shrink-0 ml-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] transition-transform duration-200 group-hover:scale-105">
              <Banknote size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer Insight Strip (Apple HIG Style) ─── */}
      <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
            {stats.card.pct >= 50 
              ? (stats.card.visa.revenue >= stats.card.mastercard.revenue
                  ? `Plățile cu cardul domină (Visa: ${stats.card.visa.pctOfCard.toFixed(0)}% vs MC: ${stats.card.mastercard.pctOfCard.toFixed(0)}%)`
                  : `Plățile cu cardul domină (MC: ${stats.card.mastercard.pctOfCard.toFixed(0)}% vs Visa: ${stats.card.visa.pctOfCard.toFixed(0)}%)`)
              : 'Plata în numerar predomină'}
          </span>
        </div>
        <span className="font-bold text-slate-900 dark:text-white tracking-tight text-xs shrink-0 ml-2">
          Total: {formatThousands(stats.totalRevenue)} lei
        </span>
      </div>
    </div>
  );
}

/**
 * 4. GRAFIC HEATMAP: Calendar Activitate Zile & Ore (Interactive Calendar Heatmap)
 * Înlocuiește fostul grafic pe ore și permite filtrarea interactivă după Zi și/sau Oră!
 */
export function CalendarHeatmapChart({
  orders = [],
  period = 'today',
  selectedHour = null,
  onSelectHour = () => {},
  selectedDay = null,
  onSelectDay = () => {}
}) {
  const [metricMode, setMetricMode] = useState('count'); // 'count' | 'revenue'
  const [hoveredCell, setHoveredCell] = useState(null);

  const DAYS = [
    { id: 1, name: 'Luni', short: 'Lun' },
    { id: 2, name: 'Marți', short: 'Mar' },
    { id: 3, name: 'Miercuri', short: 'Mie' },
    { id: 4, name: 'Joi', short: 'Joi' },
    { id: 5, name: 'Vineri', short: 'Vin' },
    { id: 6, name: 'Sâmbătă', short: 'Sâm' },
    { id: 7, name: 'Duminică', short: 'Dum' }
  ];

  // Orele disponibile: 10:00 - 22:00 (dacă este 'azi', oprim la ora curentă)
  const hours = React.useMemo(() => {
    const currentHour = new Date().getHours();
    let startHour = 10;
    let maxHour = 22;

    if (period === 'today') {
      maxHour = Math.min(22, Math.max(startHour + 1, currentHour));
    }

    orders.forEach(o => {
      if (!o.createdAt || o.status === 'cancelled') return;
      const h = new Date(o.createdAt).getHours();
      if (h < startHour) startHour = h;
      if (period === 'today' && h > maxHour && h <= 23) maxHour = h;
    });

    const list = [];
    for (let h = startHour; h <= maxHour; h++) {
      list.push(h);
    }
    return list;
  }, [orders, period]);

  // Construcția matricei [dayId][hour]
  const matrixData = React.useMemo(() => {
    const matrix = {};
    DAYS.forEach(d => {
      matrix[d.id] = {};
      hours.forEach(h => {
        matrix[d.id][h] = { count: 0, revenue: 0 };
      });
    });

    orders.forEach(o => {
      if (!o.createdAt || o.status === 'cancelled') return;
      const d = new Date(o.createdAt);
      const jsDay = d.getDay();
      const dayId = jsDay === 0 ? 7 : jsDay;
      const h = d.getHours();

      if (matrix[dayId] && matrix[dayId][h]) {
        matrix[dayId][h].count += 1;
        matrix[dayId][h].revenue += (o.totalAmount || 0);
      }
    });

    return matrix;
  }, [orders, hours]);

  // Determinare valori de vârf
  const { maxVal, peakInfo } = React.useMemo(() => {
    let maxV = 0;
    let peak = { dayId: 1, hour: 10, count: 0, revenue: 0 };

    DAYS.forEach(d => {
      hours.forEach(h => {
        const cell = matrixData[d.id]?.[h] || { count: 0, revenue: 0 };
        const val = metricMode === 'revenue' ? cell.revenue : cell.count;
        if (val > maxV) maxV = val;
        if (cell.count > peak.count) {
          peak = { dayId: d.id, hour: h, count: cell.count, revenue: cell.revenue };
        }
      });
    });

    return { maxVal: Math.max(maxV, 1), peakInfo: peak };
  }, [matrixData, hours, metricMode]);

  const todayDayId = React.useMemo(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  }, []);

  const handleCellClick = (dayId, dayName, hour) => {
    if (selectedDay?.value === dayId && selectedHour === hour) {
      onSelectDay(null);
      onSelectHour(null);
    } else {
      onSelectDay({ type: 'dayOfWeek', value: dayId, label: dayName });
      onSelectHour(hour);
    }
  };

  const handleDayClick = (dayId, dayName) => {
    if (selectedDay?.value === dayId) {
      onSelectDay(null);
    } else {
      onSelectDay({ type: 'dayOfWeek', value: dayId, label: dayName });
    }
  };

  const handleHourClick = (hour) => {
    if (selectedHour === hour) {
      onSelectHour(null);
    } else {
      onSelectHour(hour);
    }
  };

  const getCellColor = (val, count) => {
    if (count === 0) {
      return 'bg-slate-100/70 dark:bg-white/[0.04] text-slate-400 dark:text-white/25 border border-slate-200/50 dark:border-white/[0.08]';
    }
    const ratio = val / maxVal;
    if (ratio <= 0.25) {
      return 'bg-rose-500/20 dark:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/35 font-semibold';
    }
    if (ratio <= 0.50) {
      return 'bg-amber-500/25 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-500/40 font-bold';
    }
    if (ratio <= 0.75) {
      return 'bg-emerald-500/60 dark:bg-emerald-500/70 text-emerald-950 dark:text-white border border-emerald-500/80 font-bold shadow-xs';
    }
    return 'bg-emerald-800 dark:bg-emerald-700 text-white font-black border border-emerald-900 dark:border-emerald-600 shadow-md shadow-emerald-950/30';
  };

  const peakDayName = DAYS.find(d => d.id === peakInfo.dayId)?.name || 'Luni';

  return (
    <div className="apple-card relative p-4 sm:p-5 overflow-hidden group h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white"
            style={{
              backgroundColor: '#5856D6',
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)',
              boxShadow: '0 2px 8px -1px rgba(88,86,214,0.42), inset 0 0.5px 0 rgba(255,255,255,0.35)'
            }}
          >
            <Calendar className="w-[18px] h-[18px]" strokeWidth={2.1} />
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Calendar Zile & Ore
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Vârf: <span className="font-semibold text-slate-800 dark:text-slate-200">{peakDayName} la {peakInfo.hour}:00</span> ({peakInfo.count} comenzi)
            </p>
          </div>
        </div>

        {/* Mode Switcher - Apple Capsule Segmented Control */}
        <div className="apple-segmented">
          <button
            type="button"
            onClick={() => setMetricMode('count')}
            className={`apple-segmented-item ${metricMode === 'count' ? 'is-active' : ''}`}
          >
            Nr. Comenzi
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('revenue')}
            className={`apple-segmented-item ${metricMode === 'revenue' ? 'is-active' : ''}`}
          >
            Încasări (RON)
          </button>
        </div>
      </div>

      {/* Heatmap Matrix Table */}
      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <table className="w-full border-collapse select-none min-w-[560px]">
          <thead>
            <tr>
              <th className="w-14 text-[10px] uppercase font-bold text-slate-400 pb-2 text-left">
                Zi / Oră
              </th>
              {hours.map(h => {
                const isHourSelected = selectedHour === h;
                return (
                  <th key={h} className="p-1 pb-2 text-center">
                    <button
                      onClick={() => handleHourClick(h)}
                      title={`Filtrează ora ${h}:00 (Click pentru activare/deselectare)`}
                      className={`w-full py-1 rounded-lg text-[10px] font-bold transition-all ${
                        isHourSelected
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400 scale-105'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      {h}:00
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(d => {
              const isDaySelected = selectedDay?.value === d.id;
              const isToday = d.id === todayDayId;
              return (
                <tr key={d.id} className="group/row">
                  <td className="pr-1.5 py-1">
                    <button
                      onClick={() => handleDayClick(d.id, d.name)}
                      title={`Filtrează comenzile de ${d.name} (Click pentru activare/deselectare)`}
                      className={`w-full text-left px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                        isDaySelected
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                          : isToday && period === 'today'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-black border border-emerald-500/30'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span>{d.short}</span>
                      {isToday && period === 'today' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </button>
                  </td>
                  {hours.map(h => {
                    const cell = matrixData[d.id]?.[h] || { count: 0, revenue: 0 };
                    const val = metricMode === 'revenue' ? cell.revenue : cell.count;
                    const isExactSelected = selectedDay?.value === d.id && selectedHour === h;
                    const isInSelectedRow = selectedDay?.value === d.id;
                    const isInSelectedCol = selectedHour === h;
                    const colorClass = getCellColor(val, cell.count);

                    return (
                      <td key={h} className="p-0.5 text-center">
                        <button
                          onClick={() => handleCellClick(d.id, d.name, h)}
                          onMouseEnter={() => setHoveredCell({ dayId: d.id, dayName: d.name, hour: h, count: cell.count, revenue: cell.revenue })}
                          onMouseLeave={() => setHoveredCell(null)}
                          title={`${d.name}, ${h}:00 - ${h+1}:00: ${cell.count} comenzi (${cell.revenue.toFixed(0)} lei)`}
                          className={`w-full h-7 rounded-md flex items-center justify-center text-[10.5px] transition-all cursor-pointer ${colorClass} ${
                            isExactSelected
                              ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 scale-110 shadow-lg z-20 font-black'
                              : isInSelectedRow || isInSelectedCol
                              ? 'ring-1 ring-emerald-400/60'
                              : 'hover:scale-105 hover:shadow-sm'
                          }`}
                        >
                          {cell.count > 0 ? (
                            metricMode === 'revenue' 
                              ? `${cell.revenue.toFixed(0)}` 
                              : cell.count
                          ) : (
                            <span className="opacity-30 text-[9px]">•</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hover Info & Controls */}
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
        {hoveredCell ? (
          <div className="flex items-center gap-2 animate-in fade-in duration-100">
            <span className="font-bold text-slate-900 dark:text-white">
              {hoveredCell.dayName}, ora {hoveredCell.hour}:00:
            </span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {hoveredCell.count} {hoveredCell.count === 1 ? 'comandă' : 'comenzi'} ({formatThousands(hoveredCell.revenue)} lei)
            </span>
            <span className="text-[10px] text-slate-400">
              (Click pentru filtrare / deselectare)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Click pe orice celulă, zi sau oră pentru a filtra comenzile</span>
          </div>
        )}

        {/* Legend Scale */}
        <div className="flex items-center gap-1.5 ml-auto text-[10px] text-slate-400 font-medium">
          <span>0</span>
          <div className="w-3 h-3 rounded bg-slate-100 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/[0.08]" title="0 comenzi" />
          <div className="w-3 h-3 rounded bg-rose-500/25 border border-rose-500/35" title="Slab (roșu)" />
          <div className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/40" title="Mediu (galben)" />
          <div className="w-3 h-3 rounded bg-emerald-500/60 border border-emerald-500/80" title="Bun (verde)" />
          <div className="w-3 h-3 rounded bg-emerald-800 dark:bg-emerald-700 border border-emerald-900" title="Vârf (verde închis)" />
        </div>
      </div>
    </div>
  );
}

/**
 * 5. GRAFIC 3D: Top Vânzări Produse (Best Sellers with 3D Apple Liquid Bars & Podium)
 */
// Filtrare produse: doar ce se vinde separat sau în combo complet (exclude sosuri/accesorii, băuturi și garnituri vândute în combo)
const SOSURI_ACCESORII_RX = /^sos\b|\b(15|25|50)\s*g\b|ketchup|maionez[aă]|mu[sș]tar|wasabi|ghimbir|bete sushi/i;
const BAUTURI_RX = /bautur|băutur|drink|\bcola\b|pepsi|fanta|sprite|\bap[aă]\b|water|bere|beer|suc\b|juice|ceai|tea|limonad|lemonade|ayran|shake|smoothie|fuze|schweppes|cappy/i;
const GARNITURI_RX = /^cartofi\s+prajiti/i;
const COMBO_COMPLET_RX = /meniu|menu|combo|box|smart box|easy meal|\bset\b|platou/i;

export const isStandaloneOrCompleteCombo = (productName) => {
  const name = (productName || '').trim();
  if (!name) return false;
  // 1. Combo complet (Meniu, Combo, Smart Box, Set) -> Păstrează ca entitate întreagă
  if (COMBO_COMPLET_RX.test(name)) return true;
  // 2. Sosuri, accesorii, băuturi sau cartofi/garnituri vândute în combo -> Exclude din top produse
  if (SOSURI_ACCESORII_RX.test(name)) return false;
  if (BAUTURI_RX.test(name)) return false;
  if (GARNITURI_RX.test(name)) return false;
  // 3. Produse vândute separat (burgeri individuali, sushi roll-uri, feluri principale, wok, deserturi) -> Păstrează
  return true;
};

/**
 * 5. GRAFIC 3D: Top Vânzări Produse (Clasament Bestsellers cu Podium 3D & Bare Progresie Lichidă)
 */
export function TopProductsChart3D({
  orders = [],
  selectedProduct = '',
  onSelectProduct = () => {},
  selectedHour = null,
  selectedDay = null
}) {
  const [metricMode, setMetricMode] = useState('quantity'); // 'quantity' | 'revenue'
  const [limit, setLimit] = useState(10); // 5 | 10
  const [isExpanded, setIsExpanded] = useState(false); // Lista apare doar la extindere pe buton, nu permanent
  const [productFilter, setProductFilter] = useState('combos_and_mains'); // 'combos_and_mains' | 'all'

  const { topProducts, totalUnits, totalRevenue, maxMetricVal } = React.useMemo(() => {
    const map = {};
    let totalU = 0;
    let totalR = 0;

    orders.forEach(order => {
      if (order.status === 'cancelled') return;
      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach(item => {
        // Ignoră modificatorii sau sub-produsele imbricate
        if (item.isModifier || item.isComboItem || item.comboItemId || item.parentId) return;

        const rawName = (item.name || '').trim();
        if (!rawName) return;

        // Dacă filtrul este pe preparate & combo-uri complete, ignorăm produsele care se vând în combo (sosuri, băuturi, garnituri)
        if (productFilter === 'combos_and_mains' && !isStandaloneOrCompleteCombo(rawName)) {
          return;
        }

        const qty = Number(item.quantity) || 1;
        const rev = Number(item.totalPrice) || (Number(item.unitPrice) * qty) || 0;
        const brand = (item.brandId || order.brand || '').toLowerCase();
        const imageUrl = item.imageUrl || null;

        totalU += qty;
        totalR += rev;

        if (!map[rawName]) {
          map[rawName] = {
            name: rawName,
            brand,
            quantity: 0,
            revenue: 0,
            imageUrl
          };
        }
        map[rawName].quantity += qty;
        map[rawName].revenue += rev;
        if (!map[rawName].imageUrl && imageUrl) {
          map[rawName].imageUrl = imageUrl;
        }
      });
    });

    const all = Object.values(map);
    all.sort((a, b) => {
      if (metricMode === 'revenue') {
        return b.revenue - a.revenue;
      }
      return b.quantity - a.quantity;
    });

    const maxVal = all.length > 0 ? (metricMode === 'revenue' ? all[0].revenue : all[0].quantity) : 1;

    return {
      topProducts: all,
      totalUnits: totalU,
      totalRevenue: totalR,
      maxMetricVal: Math.max(1, maxVal)
    };
  }, [orders, metricMode, productFilter]);

  const displayedProducts = topProducts.slice(0, limit);
  const podiumTop3 = topProducts.slice(0, 3);

  return (
    <div className="apple-card p-4 sm:p-5 relative overflow-hidden">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white"
            style={{
              backgroundColor: '#FF9500',
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.08) 100%)',
              boxShadow: '0 2px 8px -1px rgba(255,149,0,0.42), inset 0 0.5px 0 rgba(255,255,255,0.35)'
            }}
          >
            <Trophy className="w-[18px] h-[18px]" strokeWidth={2.1} />
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Top Vânzări Produse
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {topProducts.length} produse diferite vândute • {formatThousands(totalUnits)} bucăți ({formatThousands(totalRevenue)} lei)
              {selectedHour !== null ? ` • la ora ${selectedHour}:00 - ${selectedHour + 1}:00` : ''}
              {selectedDay ? ` • ${selectedDay.label}` : ''}
            </p>
          </div>
        </div>

        {/* Controls: Product Filter + Metric Mode - Apple Capsule Segmented Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Switcher Filtru: Meniuri & Preparate vs Toate */}
          <div className="apple-segmented">
            <button
              type="button"
              onClick={() => setProductFilter('combos_and_mains')}
              title="Exclude sosurile, băuturile și produsele vândute în combo. Afișează doar ce se vinde separat sau în combo complet."
              className={`apple-segmented-item ${productFilter === 'combos_and_mains' ? 'is-active' : ''}`}
            >
              Preparate & Combo
            </button>
            <button
              type="button"
              onClick={() => setProductFilter('all')}
              title="Include toate produsele, inclusiv sosuri, garnituri și băuturi."
              className={`apple-segmented-item ${productFilter === 'all' ? 'is-active' : ''}`}
            >
              Toate
            </button>
          </div>

          {/* Limit Switcher (apare când lista este extinsă) */}
          {isExpanded && (
            <div className="apple-segmented">
              <button
                type="button"
                onClick={() => setLimit(5)}
                className={`apple-segmented-item ${limit === 5 ? 'is-active' : ''}`}
              >
                Top 5
              </button>
              <button
                type="button"
                onClick={() => setLimit(10)}
                className={`apple-segmented-item ${limit === 10 ? 'is-active' : ''}`}
              >
                Top 10
              </button>
            </div>
          )}

          {/* Metric Mode Switcher */}
          <div className="apple-segmented">
            <button
              type="button"
              onClick={() => setMetricMode('quantity')}
              className={`apple-segmented-item ${metricMode === 'quantity' ? 'is-active' : ''}`}
            >
              Cantitate (Buc)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('revenue')}
              className={`apple-segmented-item ${metricMode === 'revenue' ? 'is-active' : ''}`}
            >
              Încasări (RON)
            </button>
          </div>
        </div>
      </div>

      {displayedProducts.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          Nu există vânzări în perioada selectată.
        </div>
      ) : (
        <div className="space-y-5 relative z-10">
          {/* ── Top 3 Podium Cards ── */}
          {podiumTop3.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {podiumTop3.map((prod, idx) => {
                const rankNum = idx + 1;
                const isFirst = rankNum === 1;
                const isSecond = rankNum === 2;

                const brandColor = BRAND_COLORS[prod.brand] || '#f59e0b';
                const isSelected = selectedProduct && selectedProduct.toLowerCase() === prod.name.toLowerCase();

                const sharePct = totalUnits > 0 ? ((prod.quantity / totalUnits) * 100).toFixed(1) : 0;
                const revPct = totalRevenue > 0 ? ((prod.revenue / totalRevenue) * 100).toFixed(1) : 0;

                return (
                  <div
                    key={prod.name}
                    onClick={() => onSelectProduct(prod.name)}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer group relative overflow-hidden select-none ${
                      isSelected
                        ? 'ring-2 ring-amber-500 scale-[1.02] shadow-md'
                        : 'hover:scale-[1.01] hover:shadow-md'
                    } ${
                      isFirst
                        ? 'bg-gradient-to-b from-amber-500/10 via-amber-500/[0.04] to-transparent border-amber-400/60 dark:border-amber-500/40 shadow-xs'
                        : isSecond
                        ? 'bg-gradient-to-b from-slate-200/50 via-slate-100/15 to-transparent dark:from-slate-800/40 border-slate-300 dark:border-slate-700'
                        : 'bg-gradient-to-b from-amber-700/10 via-amber-700/[0.04] to-transparent dark:from-amber-900/20 border-amber-700/30 dark:border-amber-800/40'
                    }`}
                  >
                    {/* Podium Rank Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border shadow-xs ${
                        isFirst
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/40'
                          : isSecond
                          ? 'bg-slate-400/20 text-slate-700 dark:text-slate-300 border-slate-400/30'
                          : 'bg-amber-800/20 text-amber-800 dark:text-amber-400 border-amber-700/30'
                      }`}>
                        <Trophy size={11} className="shrink-0" />
                        <span>Locul {rankNum}</span>
                      </span>

                      {/* Brand Avatar */}
                      <BrandLogo brandId={prod.brand} size={32} className="shadow-sm shrink-0 border border-slate-200/80 dark:border-slate-700/80" />
                    </div>

                    {/* Product Media & Title */}
                    <div className="flex items-center gap-3 mb-3">
                      {prod.imageUrl ? (
                        <img 
                          src={prod.imageUrl} 
                          alt={prod.name}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 bg-white"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center p-1 border shadow-xs shrink-0"
                          style={{ borderColor: `${brandColor}50` }}
                        >
                          <BrandLogo brandId={prod.brand} size={28} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h5 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate leading-tight">
                          {prod.name}
                        </h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {prod.quantity} buc. • {sharePct}% volum
                        </p>
                      </div>
                    </div>

                    {/* Metric Values & Mini Bar */}
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {formatThousands(prod.revenue)} <span className="text-[10px] font-bold text-slate-400">lei</span>
                      </span>
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        {metricMode === 'revenue' ? `${revPct}% încasări` : `${prod.quantity} bucăți`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Buton de Extindere când lista este pliată ── */}
          {!isExpanded ? (
            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setIsExpanded(true)}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 hover:border-amber-500 transition-all shadow-xs flex items-center gap-2 border border-slate-200/80 dark:border-slate-700 cursor-pointer group"
              >
                <span>Extinde clasament complet ({topProducts.length} produse)</span>
                <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
              </button>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {/* ── Complete Ranking List with 3D Liquid Apple Progress Bars ── */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {displayedProducts.map((prod, index) => {
                  const rank = index + 1;
                  const val = metricMode === 'revenue' ? prod.revenue : prod.quantity;
                  const fillPct = Math.max(8, (val / maxMetricVal) * 100);
                  const brandColor = BRAND_COLORS[prod.brand] || '#f59e0b';
                  const isSelected = selectedProduct && selectedProduct.toLowerCase() === prod.name.toLowerCase();

                  const sharePct = totalUnits > 0 ? ((prod.quantity / totalUnits) * 100).toFixed(1) : 0;

                  return (
                    <div
                      key={prod.name}
                      onClick={() => onSelectProduct(prod.name)}
                      className={`py-3 px-2 rounded-2xl transition-all duration-200 cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none ${
                        isSelected
                          ? 'bg-amber-500/10 ring-1 ring-amber-500/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                      title={`Click pentru a filtra comenzile cu ${prod.name}`}
                    >
                      {/* Left: Rank, Image, Product Info */}
                      <div className="flex items-center gap-3 min-w-0 sm:w-1/2">
                        {/* Rank Pill */}
                        <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                          rank === 1
                            ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/50'
                            : rank === 2
                            ? 'bg-slate-400 text-white'
                            : rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {rank}
                        </span>

                        {/* Image / Icon */}
                        {prod.imageUrl ? (
                          <img 
                            src={prod.imageUrl} 
                            alt={prod.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs shrink-0 bg-white"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div 
                            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center p-0.5 border shadow-xs shrink-0"
                            style={{ borderColor: `${brandColor}40` }}
                          >
                            <BrandLogo brandId={prod.brand} size={20} />
                          </div>
                        )}

                        {/* Title & Brand */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              {prod.name}
                            </span>
                            <BrandLogo brandId={prod.brand} size={20} className="shadow-xs shrink-0" />
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {prod.quantity} buc. vândute • {sharePct}% din total
                          </p>
                        </div>
                      </div>

                      {/* Right: 3D Liquid Bar & Values */}
                      <div className="flex items-center gap-3 sm:w-1/2 justify-end">
                        {/* 3D Liquid Apple Capsule Bar */}
                        <div 
                          className="relative flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-800/80 p-0.5 border border-slate-200/80 dark:border-white/10 overflow-hidden shrink-0"
                          style={{
                            boxShadow: 'inset 0 1.5px 3px rgba(0,0,0,0.2)'
                          }}
                        >
                          <div
                            className="relative h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end overflow-hidden"
                            style={{
                              width: `${fillPct}%`,
                              background: rank === 1
                                ? 'linear-gradient(180deg, #fde047 0%, #f59e0b 55%, #d97706 100%)'
                                : 'linear-gradient(180deg, #67e8f9 0%, #06b6d4 55%, #0891b2 100%)',
                              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.8), 0 0 6px rgba(6,182,212,0.4)'
                            }}
                          >
                            {/* Top Specular Shine */}
                            <div className="absolute inset-x-1 top-0 h-[45%] rounded-t-full bg-gradient-to-b from-white/80 to-transparent pointer-events-none" />
                          </div>
                        </div>

                        {/* Numeric Stats */}
                        <div className="text-right shrink-0 min-w-[85px]">
                          <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {metricMode === 'revenue' 
                              ? `${formatThousands(prod.revenue)} lei`
                              : `${prod.quantity} buc.`}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {metricMode === 'revenue' 
                              ? `${prod.quantity} bucăți`
                              : `${formatThousands(prod.revenue)} lei`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Buton Restrângere la finalul listei */}
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-6 py-2.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-xs flex items-center gap-2 border border-slate-200/80 dark:border-slate-700 cursor-pointer group"
                >
                  <span>Restrânge clasamentul</span>
                  <ChevronUp size={14} className="group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper Component to render all 5 3D Charts neatly in a responsive grid with interactive cross-filtering
 */
export default function DashboardCharts3D({ 
  orders = [], 
  allOrders = [],
  comparisonOrders = [],
  isComparisonLoading = false,
  period = 'today',
  customStart = '',
  customEnd = '',
  selectedLocation = 'all',
  selectedBrands = [],
  onSelectBrand = () => {},
  selectedHour = null,
  onSelectHour = () => {},
  selectedDay = null,
  onSelectDay = () => {},
  selectedPayment = 'all',
  onSelectPayment = () => {},
  selectedProduct = '',
  onSelectProduct = () => {},
  ordersSection = null
}) {
  // Helper filtrare timp (oră & zi)
  const matchesTime = React.useCallback((o) => {
    if (selectedHour !== null) {
      if (!o.createdAt) return false;
      const h = new Date(o.createdAt).getHours();
      if (h !== selectedHour) return false;
    }
    if (selectedDay !== null) {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      if (selectedDay.type === 'dayOfWeek') {
        if (d.getDay() !== selectedDay.value) return false;
      } else if (selectedDay.type === 'date') {
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr !== selectedDay.value) return false;
      }
    }
    return true;
  }, [selectedHour, selectedDay]);

  // Helper filtrare brand
  const matchesBrand = React.useCallback((o) => {
    if (!selectedBrands || selectedBrands.length === 0) return true;
    const b = (o.brand || '').toLowerCase();
    return selectedBrands.includes(b);
  }, [selectedBrands]);

  // Helper filtrare metodă de plată
  const matchesPayment = React.useCallback((o) => {
    if (!selectedPayment || selectedPayment === 'all') return true;
    const isCard = o.paymentMethod === 'card' || !!o.paymentRef?.authCode;
    if (selectedPayment === 'card') return isCard;
    if (selectedPayment === 'cash') return !isCard;
    if (selectedPayment === 'visa') return isCard && detectCardBrand(o) === 'visa';
    if (selectedPayment === 'mastercard') return isCard && detectCardBrand(o) === 'mastercard';
    if (selectedPayment.startsWith('bank_')) {
      const bankId = selectedPayment.replace('bank_', '');
      return isCard && detectCardBank(o).id === bankId;
    }
    return true;
  }, [selectedPayment]);

  // Helper căutare produs
  const matchesProduct = React.useCallback((o) => {
    if (!selectedProduct) return true;
    const q = selectedProduct.toLowerCase().trim();
    const items = Array.isArray(o.items) ? o.items : [];
    return items.some(it => (it.name || '').toLowerCase().includes(q));
  }, [selectedProduct]);

  // 1. Comenzi pentru SalesTrendChart3D (filtrează după brand, plată, produs - menține toate orele/zilele pt curbă)
  const salesTrendOrders = React.useMemo(() => {
    return orders.filter(o => o.status !== 'cancelled' && matchesBrand(o) && matchesPayment(o) && matchesProduct(o));
  }, [orders, matchesBrand, matchesPayment, matchesProduct]);

  // Comenzi REALE pentru comparație (combină comparisonOrders încărcate pt perioada anterioară + allOrders, filtrate după brand, plată, produs)
  const comparisonSalesOrders = React.useMemo(() => {
    const pool = [...(Array.isArray(comparisonOrders) ? comparisonOrders : []), ...(Array.isArray(allOrders) ? allOrders : []), ...(Array.isArray(orders) ? orders : [])];
    const seen = new Set();
    return pool.filter(o => {
      if (!o || o.status === 'cancelled' || !o.createdAt) return false;
      const k = o._id || o.id || o.orderNumber;
      if (k) {
        if (seen.has(k)) return false;
        seen.add(k);
      }
      return matchesBrand(o) && matchesPayment(o) && matchesProduct(o);
    });
  }, [comparisonOrders, allOrders, orders, matchesBrand, matchesPayment, matchesProduct]);

  // 2. Comenzi pentru BrandDonutChart3D (filtrează după oră, zi, plată, produs - arată toate brandurile pt selecție)
  const brandDonutOrders = React.useMemo(() => {
    return orders.filter(o => o.status !== 'cancelled' && matchesTime(o) && matchesPayment(o) && matchesProduct(o));
  }, [orders, matchesTime, matchesPayment, matchesProduct]);

  // 3. Comenzi pentru CalendarHeatmapChart (filtrează după brand, plată, produs)
  const calendarOrders = React.useMemo(() => {
    return orders.filter(o => o.status !== 'cancelled' && matchesBrand(o) && matchesPayment(o) && matchesProduct(o));
  }, [orders, matchesBrand, matchesPayment, matchesProduct]);

  // 4. Comenzi pentru PaymentMethodsChart3D (filtrează după brand, oră, zi, produs - arată Card vs Cash în acea oră/zi)
  const paymentOrders = React.useMemo(() => {
    return orders.filter(o => o.status !== 'cancelled' && matchesBrand(o) && matchesTime(o) && matchesProduct(o));
  }, [orders, matchesBrand, matchesTime, matchesProduct]);

  // 5. Comenzi pentru TopProductsChart3D (filtrează după brand, oră, zi, plată - arată top produse specifice acelei ore/zile)
  const topProductsOrders = React.useMemo(() => {
    return orders.filter(o => o.status !== 'cancelled' && matchesBrand(o) && matchesTime(o) && matchesPayment(o));
  }, [orders, matchesBrand, matchesTime, matchesPayment]);

  return (
    <div className="dashboard-bento-grid">
      <div className="dashboard-bento-trend h-full">
        <SalesTrendChart3D 
          orders={salesTrendOrders} 
          comparisonOrders={comparisonSalesOrders}
          allOrders={allOrders}
          isComparisonLoading={isComparisonLoading}
          period={period}
          customStart={customStart}
          customEnd={customEnd}
          selectedLocation={selectedLocation}
          selectedBrands={selectedBrands}
          selectedPayment={selectedPayment}
          selectedProduct={selectedProduct}
          selectedHour={selectedHour}
          onSelectHour={onSelectHour}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
        />
      </div>

      <div className="dashboard-bento-brands h-full">
        <BrandDonutChart3D 
          orders={brandDonutOrders} 
          selectedBrands={selectedBrands}
          onSelectBrand={onSelectBrand}
          selectedHour={selectedHour}
          selectedDay={selectedDay}
        />
      </div>

      <div className="dashboard-bento-calendar h-full">
        <CalendarHeatmapChart 
          orders={calendarOrders} 
          period={period} 
          selectedHour={selectedHour}
          onSelectHour={onSelectHour}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
        />
      </div>

      <div className="dashboard-bento-payments h-full">
        <PaymentMethodsChart3D 
          orders={paymentOrders} 
          selectedPayment={selectedPayment}
          onSelectPayment={onSelectPayment}
          selectedHour={selectedHour}
          selectedDay={selectedDay}
        />
      </div>

      <div className="dashboard-bento-products h-full">
        <TopProductsChart3D 
          orders={topProductsOrders}
          selectedProduct={selectedProduct}
          onSelectProduct={onSelectProduct}
          selectedHour={selectedHour}
          selectedDay={selectedDay}
        />
      </div>

      {ordersSection && (
        <div className="dashboard-bento-orders min-w-0">
          {ordersSection}
        </div>
      )}
    </div>
  );
}
