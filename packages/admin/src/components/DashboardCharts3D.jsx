import React, { useState } from 'react';
import BrandLogo from './BrandLogo';
import { TrendingUp, PieChart, CreditCard, Clock, Banknote, Calendar, Flame, Trophy, Award, ShoppingBag, Utensils, ChevronDown, ChevronUp } from 'lucide-react';
import { formatThousands } from '../utils/formatters';

const BRAND_COLORS = {
  smashme: '#ef4444',
  crunch: '#eab308',
  rollmaster: '#3b82f6',
  lovesushi: '#ec4899',
  pokiwoki: '#f97316'
};

/**
 * 1. GRAFIC 3D: Evoluție Vânzări & Încasări (3D Spline Ribbon with Isometric Depth)
 */
export function SalesTrendChart3D({ 
  orders = [], 
  period = 'today',
  selectedHour = null,
  onSelectHour = () => {},
  selectedDay = null,
  onSelectDay = () => {}
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [metricMode, setMetricMode] = useState('revenue'); // 'revenue' | 'count'
  const [showValues, setShowValues] = useState(true); // Afișare directă a valorilor pe grafic

  // Determină buckets în funcție de perioadă
  const isHourly = period === 'today' || period === 'yesterday';
  
  const buckets = React.useMemo(() => {
    if (isHourly) {
      const currentHour = new Date().getHours();
      let startHour = 10;
      let maxHour = 22;

      // Dacă este 'azi', nu afișăm orele viitoare care nu au sosit încă
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
          fullLabel: `Ora ${h}:00 - ${h + 1}:00`,
          hour: h,
          revenue: 0,
          count: 0
        });
      }
      orders.forEach(o => {
        if (!o.createdAt || o.status === 'cancelled') return;
        const d = new Date(o.createdAt);
        const h = d.getHours();
        const slot = slots.find(s => s.hour === h);
        if (slot) {
          slot.revenue += (o.totalAmount || 0);
          slot.count += 1;
        }
      });
      return slots;
    } else {
      // Zilnic (ultimele 7 zile sau zilele din interval)
      const dayMap = {};
      orders.forEach(o => {
        if (!o.createdAt || o.status === 'cancelled') return;
        const d = new Date(o.createdAt);
        const key = d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
        if (!dayMap[key]) {
          dayMap[key] = { label: key, fullLabel: d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'long' }), revenue: 0, count: 0, time: d.getTime() };
        }
        dayMap[key].revenue += (o.totalAmount || 0);
        dayMap[key].count += 1;
      });
      const sorted = Object.values(dayMap).sort((a, b) => a.time - b.time);
      if (sorted.length === 0) {
        return [
          { label: 'Lun', fullLabel: 'Luni', revenue: 0, count: 0 },
          { label: 'Mar', fullLabel: 'Marți', revenue: 0, count: 0 },
          { label: 'Mie', fullLabel: 'Miercuri', revenue: 0, count: 0 },
          { label: 'Joi', fullLabel: 'Joi', revenue: 0, count: 0 },
          { label: 'Vin', fullLabel: 'Vineri', revenue: 0, count: 0 },
          { label: 'Sâm', fullLabel: 'Sâmbătă', revenue: 0, count: 0 },
          { label: 'Dum', fullLabel: 'Duminică', revenue: 0, count: 0 }
        ];
      }
      return sorted;
    }
  }, [orders, isHourly]);

  const maxVal = Math.max(...buckets.map(b => metricMode === 'revenue' ? b.revenue : b.count), 10);
  const width = 640;
  const height = 230;
  const padX = 42;
  const padTop = 36;
  const padBottom = 32;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;
  const depth = 14; // 3D isometric z-depth

  // Compute points
  const pts = buckets.map((b, i) => {
    const x = padX + (i / (buckets.length - 1 || 1)) * chartW;
    const val = metricMode === 'revenue' ? b.revenue : b.count;
    const y = padTop + chartH - (val / maxVal) * chartH;
    return { x, y, b, val };
  });

  // Smooth cubic spline helper
  const createSmoothPath = (points, offsetY = 0, offsetX = 0) => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x + offsetX},${points[0].y + offsetY}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2 + offsetX;
      const cy1 = p0.y + offsetY;
      const cx2 = p0.x + (p1.x - p0.x) / 2 + offsetX;
      const cy2 = p1.y + offsetY;
      d += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x + offsetX},${p1.y + offsetY}`;
    }
    return d;
  };

  const frontPath = createSmoothPath(pts);
  const backPath = createSmoothPath(pts, -depth, depth);

  // 3D Ribbon side polygon
  let ribbonSide = '';
  if (pts.length > 1) {
    ribbonSide = `${frontPath} L ${pts[pts.length - 1].x + depth},${pts[pts.length - 1].y - depth}`;
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      ribbonSide += ` L ${p.x + depth},${p.y - depth}`;
    }
    ribbonSide += ' Z';
  }

  // Front Area closed
  const baseY = padTop + chartH;
  const frontArea = `${frontPath} L ${pts[pts.length - 1].x},${baseY} L ${pts[0].x},${baseY} Z`;

  const totalRev = buckets.reduce((s, b) => s + b.revenue, 0);
  const totalCnt = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden group h-full flex flex-col justify-between">
      {/* 3D Background Glow */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Evoluție Vânzări 3D
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Zoom 3D Flow
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Total: <strong className="text-slate-800 dark:text-slate-200">{formatThousands(totalRev)} lei</strong> ({totalCnt} comenzi)
            </p>
          </div>
        </div>

        {/* Toggle Mode & Valori pe Grafic */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowValues(v => !v)}
            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all border ${
              showValues 
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Afișează sau ascunde valorile direct pe grafic"
          >
            Valori pe Grafic
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setMetricMode('revenue')}
              className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all ${metricMode === 'revenue' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              Încasări (RON)
            </button>
            <button
              onClick={() => setMetricMode('count')}
              className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all ${metricMode === 'count' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              Nr. Comenzi
            </button>
          </div>
        </div>
      </div>

      {/* SVG 3D Canvas */}
      <div className="relative w-full h-[230px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="frontAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="extrusionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#4338ca" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#312e81" stopOpacity="0.3" />
            </linearGradient>

            <linearGradient id="neonLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            
            <filter id="shadow3D" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="12" stdDeviation="8" floodColor="#1e3a8a" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* 3D Floor Lines */}
          {[0.25, 0.5, 0.75, 1].map((lvl, idx) => {
            const yLvl = padTop + chartH * (1 - lvl);
            return (
              <g key={idx} opacity={0.35}>
                <line
                  x1={padX}
                  y1={yLvl}
                  x2={padX + chartW}
                  y2={yLvl}
                  stroke="currentColor"
                  className="text-slate-300 dark:text-slate-700"
                  strokeDasharray="4,4"
                />
                <line
                  x1={padX + chartW}
                  y1={yLvl}
                  x2={padX + chartW + depth}
                  y2={yLvl - depth}
                  stroke="currentColor"
                  className="text-slate-300 dark:text-slate-700"
                  strokeDasharray="2,2"
                />
                <text
                  x={padX - 8}
                  y={yLvl + 4}
                  textAnchor="end"
                  fontSize="10"
                  className="fill-slate-400 font-medium"
                >
                  {metricMode === 'revenue' ? `${Math.round(maxVal * lvl)} lei` : Math.round(maxVal * lvl)}
                </text>
              </g>
            );
          })}

          {/* 3D Isometric Base Plane */}
          <polygon
            points={`${padX},${baseY} ${padX + chartW},${baseY} ${padX + chartW + depth},${baseY - depth} ${padX + depth},${baseY - depth}`}
            fill="url(#gridGradient)"
            stroke="currentColor"
            className="text-slate-300 dark:text-slate-700"
            strokeWidth="0.75"
          />

          {/* 3D Ribbon Extruded Depth Top */}
          <path
            d={ribbonSide}
            fill="url(#extrusionGrad)"
            opacity="0.85"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }}
          />

          {/* Back 3D Line */}
          <path
            d={backPath}
            fill="none"
            stroke="#4338ca"
            strokeWidth="1.5"
            strokeDasharray="3,3"
            opacity="0.6"
          />

          {/* Front Area Gradient */}
          <path
            d={frontArea}
            fill="url(#frontAreaGrad)"
            filter="url(#shadow3D)"
          />

          {/* Front Main Spline Curve */}
          <path
            d={frontPath}
            fill="none"
            stroke="url(#neonLineGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#neonGlow)"
          />

          {/* Points & Interactive Hover Columns */}
          {pts.map((pt, i) => {
            const isHovered = hoveredIndex === i;
            const isPointSelected = isHourly 
              ? (selectedHour === pt.b.hour) 
              : (selectedDay?.value === pt.b.label);
            const valText = metricMode === 'revenue' 
              ? `${formatThousands(Math.round(pt.val))} lei` 
              : `${pt.val} com.`;
            const pillW = Math.max(38, valText.length * 6.2 + 12);

            return (
              <g 
                key={i} 
                className="cursor-pointer"
                onClick={() => {
                  if (isHourly && pt.b.hour !== undefined) {
                    onSelectHour(pt.b.hour);
                  } else if (!isHourly && pt.b.label) {
                    onSelectDay({ type: 'date', value: pt.b.label, label: pt.b.fullLabel || pt.b.label });
                  }
                }}
              >
                <rect
                  x={pt.x - chartW / (buckets.length * 2)}
                  y={padTop}
                  width={chartW / buckets.length}
                  height={chartH + padBottom}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                {(isHovered || isPointSelected) && (
                  <g>
                    <line
                      x1={pt.x}
                      y1={padTop}
                      x2={pt.x}
                      y2={baseY}
                      stroke="#38bdf8"
                      strokeWidth={isPointSelected ? 2 : 1.5}
                      strokeDasharray={isPointSelected ? undefined : "3,3"}
                      className={isPointSelected ? undefined : "animate-pulse"}
                    />
                    <line
                      x1={pt.x}
                      y1={pt.y}
                      x2={pt.x + depth}
                      y2={pt.y - depth}
                      stroke="#818cf8"
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                    />
                  </g>
                )}

                {isPointSelected && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={11}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    opacity="0.75"
                    strokeDasharray="3,2"
                  />
                )}

                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isPointSelected ? 8 : (isHovered ? 7 : (pt.val > 0 ? 4 : 2.5))}
                  fill={isPointSelected ? '#38bdf8' : (isHovered ? '#38bdf8' : '#ffffff')}
                  stroke={isPointSelected ? '#0284c7' : (isHovered ? '#0284c7' : '#6366f1')}
                  strokeWidth={isPointSelected ? 3.5 : (isHovered ? 3 : 2)}
                  className="transition-all duration-200"
                  style={{ filter: (isPointSelected || isHovered) ? 'drop-shadow(0 0 10px #38bdf8)' : 'none' }}
                />

                {/* Valoare numerică afișată direct pe grafic (Data Label) */}
                {showValues && (
                  pt.val > 0 ? (
                    <g 
                      className="transition-all duration-200 pointer-events-none select-none"
                      style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                    >
                      {/* Tija / Conector discret de la punct la etichetă */}
                      <line
                        x1={pt.x}
                        y1={pt.y - (isPointSelected ? 9 : 6)}
                        x2={pt.x}
                        y2={pt.y - 11}
                        stroke={isPointSelected ? "#38bdf8" : (isHovered ? "#38bdf8" : "#818cf8")}
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        opacity={isHovered || isPointSelected ? 0.95 : 0.45}
                      />

                      {/* Pill Badge Glassmorphism 3D */}
                      <rect
                        x={pt.x - pillW / 2}
                        y={pt.y - 28}
                        width={pillW}
                        height={17}
                        rx={8.5}
                        className={`transition-colors ${
                          isPointSelected 
                            ? 'fill-blue-600 stroke-cyan-300' 
                            : isHovered 
                            ? 'fill-slate-900 stroke-cyan-400' 
                            : 'fill-slate-900/90 dark:fill-slate-950/95 stroke-blue-500/40 dark:stroke-cyan-500/40'
                        }`}
                        strokeWidth={isPointSelected || isHovered ? "1.5" : "0.75"}
                        style={{
                          filter: isPointSelected || isHovered 
                            ? 'drop-shadow(0 0 8px rgba(56,189,248,0.7))' 
                            : 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))'
                        }}
                      />

                      {/* Valoare numerică proporțională (FĂRĂ font-mono) */}
                      <text
                        x={pt.x}
                        y={pt.y - 16}
                        textAnchor="middle"
                        fontSize="9.5"
                        className={`font-bold tracking-tight select-none ${
                          isPointSelected 
                            ? 'fill-white' 
                            : isHovered 
                            ? 'fill-white' 
                            : 'fill-cyan-300 dark:fill-cyan-400'
                        }`}
                      >
                        {valText}
                      </text>
                    </g>
                  ) : (
                    <text
                      x={pt.x}
                      y={pt.y - 8}
                      textAnchor="middle"
                      fontSize="8.5"
                      className="font-semibold fill-slate-400/50 dark:fill-slate-600 select-none"
                    >
                      0
                    </text>
                  )
                )}

                <text
                  x={pt.x}
                  y={baseY + 18}
                  textAnchor="middle"
                  fontSize="11"
                  className={`font-semibold transition-colors ${
                    isPointSelected 
                      ? 'fill-blue-600 dark:fill-blue-400 font-black' 
                      : isHovered 
                      ? 'fill-blue-600 dark:fill-blue-400 font-bold' 
                      : 'fill-slate-400'
                  }`}
                >
                  {pt.b.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 3D Glassmorphic Floating Tooltip */}
        {hoveredIndex !== null && pts[hoveredIndex] && (
          <div
            className="absolute pointer-events-none transition-all duration-150 z-30"
            style={{
              left: `${(pts[hoveredIndex].x / width) * 100}%`,
              top: `${Math.max(10, (pts[hoveredIndex].y / height) * 100 - 35)}%`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl shadow-2xl border border-blue-500/30 text-xs min-w-[140px] text-center transform hover:scale-105 transition-transform">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                {pts[hoveredIndex].b.fullLabel}
              </div>
              <div className="text-sm font-black text-white">
                {formatThousands(pts[hoveredIndex].b.revenue)} lei
              </div>
              <div className="text-[11px] text-slate-300 font-medium">
                {pts[hoveredIndex].b.count} {pts[hoveredIndex].b.count === 1 ? 'comandă' : 'comenzi'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 2. GRAFIC 3D: Distribuție pe Branduri (ZoomCharts 3D Extruded Donut Ring)
 */
export function BrandDonutChart3D({ 
  orders = [], 
  selectedBrands = [], 
  onSelectBrand = () => {},
  selectedHour = null,
  selectedDay = null
}) {
  const [hoveredBrand, setHoveredBrand] = useState(null);

  const brandData = React.useMemo(() => {
    const map = {
      smashme: { id: 'smashme', name: 'SmashMe', color: BRAND_COLORS.smashme, revenue: 0, count: 0 },
      crunch: { id: 'crunch', name: 'Crunch', color: BRAND_COLORS.crunch, revenue: 0, count: 0 },
      rollmaster: { id: 'rollmaster', name: 'Roll Master', color: BRAND_COLORS.rollmaster, revenue: 0, count: 0 },
      lovesushi: { id: 'lovesushi', name: 'Love Sushi', color: BRAND_COLORS.lovesushi, revenue: 0, count: 0 },
      pokiwoki: { id: 'pokiwoki', name: 'Poki-Woki', color: BRAND_COLORS.pokiwoki, revenue: 0, count: 0 }
    };

    orders.forEach(o => {
      if (!o.brand || o.status === 'cancelled') return;
      if (map[o.brand]) {
        map[o.brand].revenue += (o.totalAmount || 0);
        map[o.brand].count += 1;
      }
    });

    // Exclude brandurile cu 0 (cele neconectate încă)
    const activeList = Object.values(map).filter(b => b.count > 0 || b.revenue > 0);
    const totalRev = activeList.reduce((s, b) => s + b.revenue, 0);
    const totalCnt = activeList.reduce((s, b) => s + b.count, 0);

    return {
      list: activeList.map(b => ({
        ...b,
        avg: b.count > 0 ? (b.revenue / b.count) : 0,
        pct: totalRev > 0 ? (b.revenue / totalRev) * 100 : (totalCnt > 0 ? (b.count / totalCnt) * 100 : 0)
      })),
      totalRevenue: totalRev,
      totalCount: totalCnt
    };
  }, [orders]);

  const cx = 150;
  const cy = 115;
  const rx = 110;
  const ry = 62;
  const innerRatio = 0.58;
  const innerRx = rx * innerRatio;
  const innerRy = ry * innerRatio;
  const depth = 22;

  let cumulativeAngle = 0;
  const slices = brandData.list.map(b => {
    const angleSpan = (b.pct / 100) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angleSpan;
    cumulativeAngle += angleSpan;

    return {
      ...b,
      startAngle,
      endAngle,
      angleSpan
    };
  });

  const getEllipsePoint = (angleDeg, radiusX, radiusY, offsetY = 0) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: cx + radiusX * Math.cos(rad),
      y: cy + radiusY * Math.sin(rad) + offsetY
    };
  };

  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden group h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
            <PieChart className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Vânzări pe Branduri 3D
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Donut 3D Ring
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {selectedHour !== null 
                ? `Vânzări pe branduri la ora ${selectedHour}:00 - ${selectedHour + 1}:00` 
                : selectedDay?.label 
                ? `Vânzări pe branduri în ziua de ${selectedDay.label}` 
                : 'Pondere vânzări per brand în perioada selectată'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* 3D Donut SVG Canvas */}
        <div className="relative flex items-center justify-center min-h-[160px]">
          <svg viewBox="0 0 300 240" className="w-full max-w-[210px] h-[160px] overflow-visible">
            {/* Base Drop Shadow - Ring with Hollow Hole */}
            <path
              d={`
                M ${cx - rx * 0.95},${cy + depth + 8}
                A ${rx * 0.95} ${ry * 0.95} 0 1 0 ${cx + rx * 0.95},${cy + depth + 8}
                A ${rx * 0.95} ${ry * 0.95} 0 1 0 ${cx - rx * 0.95},${cy + depth + 8}
                M ${cx - innerRx * 0.95},${cy + depth + 8}
                A ${innerRx * 0.95} ${innerRy * 0.95} 0 1 1 ${cx + innerRx * 0.95},${cy + depth + 8}
                A ${innerRx * 0.95} ${innerRy * 0.95} 0 1 1 ${cx - innerRx * 0.95},${cy + depth + 8}
                Z
              `}
              fill="#000000"
              fillRule="evenodd"
              opacity="0.14"
            />

            {/* Side walls */}
            {slices.map(s => {
              if (s.angleSpan <= 0) return null;
              const isHovered = hoveredBrand === s.id;
              const isSelected = selectedBrands.includes(s.id);
              const liftY = isSelected ? -12 : (isHovered ? -8 : 0);

              const pStartTop = getEllipsePoint(s.startAngle, rx, ry, liftY);
              const pEndTop = getEllipsePoint(s.endAngle, rx, ry, liftY);
              const pStartBot = getEllipsePoint(s.startAngle, rx, ry, liftY + depth);
              const pEndBot = getEllipsePoint(s.endAngle, rx, ry, liftY + depth);

              return (
                <g key={`side-${s.id}`}>
                  <path
                    d={`
                      M ${pStartTop.x},${pStartTop.y}
                      A ${rx} ${ry} 0 ${s.angleSpan > 180 ? 1 : 0} 1 ${pEndTop.x},${pEndTop.y}
                      L ${pEndBot.x},${pEndBot.y}
                      A ${rx} ${ry} 0 ${s.angleSpan > 180 ? 1 : 0} 0 ${pStartBot.x},${pStartBot.y}
                      Z
                    `}
                    fill={s.color}
                    style={{ filter: 'brightness(0.72) contrast(1.15)' }}
                    opacity={isSelected ? 1 : (selectedBrands.length > 0 ? 0.35 : (isHovered ? 1 : 0.9))}
                  />
                </g>
              );
            })}

            {/* Top Elliptical Faces */}
            {slices.map(s => {
              if (s.angleSpan <= 0) return null;
              const isHovered = hoveredBrand === s.id;
              const isSelected = selectedBrands.includes(s.id);
              const liftY = isSelected ? -12 : (isHovered ? -8 : 0);

              const pOutStart = getEllipsePoint(s.startAngle, rx, ry, liftY);
              const pOutEnd = getEllipsePoint(s.endAngle, rx, ry, liftY);
              const pInStart = getEllipsePoint(s.startAngle, innerRx, innerRy, liftY);
              const pInEnd = getEllipsePoint(s.endAngle, innerRx, innerRy, liftY);

              const largeArc = s.angleSpan > 180 ? 1 : 0;

              const pathData = `
                M ${pOutStart.x},${pOutStart.y}
                A ${rx} ${ry} 0 ${largeArc} 1 ${pOutEnd.x},${pOutEnd.y}
                L ${pInEnd.x},${pInEnd.y}
                A ${innerRx} ${innerRy} 0 ${largeArc} 0 ${pInStart.x},${pInStart.y}
                Z
              `;

              return (
                <path
                  key={`top-${s.id}`}
                  d={pathData}
                  fill={s.color}
                  stroke={isSelected ? "#3b82f6" : "#ffffff"}
                  strokeWidth={isSelected ? "3" : "1.5"}
                  onClick={() => onSelectBrand(s.id)}
                  onMouseEnter={() => setHoveredBrand(s.id)}
                  onMouseLeave={() => setHoveredBrand(null)}
                  className="cursor-pointer transition-all duration-200"
                  opacity={isSelected ? 1 : (selectedBrands.length > 0 ? 0.45 : 1)}
                  style={{
                    filter: isSelected
                      ? 'drop-shadow(0 -6px 12px rgba(59,130,246,0.5)) brightness(1.2)'
                      : isHovered 
                      ? 'drop-shadow(0 -4px 8px rgba(0,0,0,0.3)) brightness(1.1)' 
                      : 'brightness(1.0)',
                    transformOrigin: `${cx}px ${cy}px`
                  }}
                />
              );
            })}

            {/* Slice Labels with Percentage (Data Labels pe Donut 3D) */}
            {slices.map(s => {
              if (s.angleSpan < 16) return null;
              const isHovered = hoveredBrand === s.id;
              const isSelected = selectedBrands.includes(s.id);
              const liftY = isSelected ? -12 : (isHovered ? -8 : 0);
              const midAngle = s.startAngle + s.angleSpan / 2;
              const midRx = (rx + innerRx) / 2;
              const midRy = (ry + innerRy) / 2;
              const pos = getEllipsePoint(midAngle, midRx, midRy, liftY);

              return (
                <g 
                  key={`badge-${s.id}`} 
                  className="pointer-events-none select-none transition-transform duration-200"
                >
                  <rect
                    x={pos.x - 20}
                    y={pos.y - 9}
                    width={40}
                    height={18}
                    rx={9}
                    fill="rgba(15, 23, 42, 0.88)"
                    stroke="#ffffff"
                    strokeWidth={isSelected || isHovered ? "1.5" : "0.75"}
                    style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))' }}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 3.5}
                    textAnchor="middle"
                    fontSize="9.5"
                    className="font-bold tracking-tight fill-white select-none"
                  >
                    {s.pct.toFixed(0)}%
                  </text>
                </g>
              );
            })}

            {/* Donut Center Hole Metrics */}
            <g className="pointer-events-none select-none">
              <text
                x={cx}
                y={cy + 6}
                textAnchor="middle"
                className="fill-slate-900 dark:fill-white font-black text-xs tracking-tight select-none"
              >
                {formatThousands(brandData.totalRevenue)} lei
              </text>
              <text
                x={cx}
                y={cy + 19}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 font-bold text-[9px] select-none"
              >
                {brandData.totalCount} comenzi
              </text>
            </g>

          </svg>
        </div>

        {/* Brand Legend */}
        <div className="flex flex-col gap-1.5 max-h-[130px] overflow-y-auto pr-1">
          {brandData.list.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
              Niciun brand cu vânzări în perioada selectată.
            </div>
          ) : (
            brandData.list.map(b => {
              const isHovered = hoveredBrand === b.id;
              const isSelected = selectedBrands.includes(b.id);
              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBrand(b.id)}
                  onMouseEnter={() => setHoveredBrand(b.id)}
                  onMouseLeave={() => setHoveredBrand(null)}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-sm ring-2 ring-blue-500/20 scale-[1.01]'
                      : isHovered 
                      ? 'bg-slate-100 dark:bg-slate-800 border-blue-500/40 shadow-sm scale-[1.01]' 
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: b.color }} />
                    <BrandLogo brandId={b.id} size={16} />
                    <span className={`text-xs ${isSelected ? 'font-black text-blue-600 dark:text-blue-400' : 'font-bold text-slate-800 dark:text-slate-200'}`}>
                      {b.name}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      {formatThousands(b.revenue)} lei
                    </div>
                    <div className="text-[10px] font-semibold text-slate-400">
                      {b.count} {b.count === 1 ? 'comandă' : 'comenzi'} • <span className="text-slate-600 dark:text-slate-300 font-bold">med. {formatThousands(b.avg)} lei</span> • <strong className="text-blue-600 dark:text-blue-400">{b.pct.toFixed(0)}%</strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 3. GRAFIC 3D: Metode de Plată (Cilindri Izometrici 3D: Card POS vs Cash)
 */
export function PaymentMethodsChart3D({ 
  orders = [], 
  selectedPayment = 'all', 
  onSelectPayment = () => {},
  selectedHour = null,
  selectedDay = null
}) {
  const [hoveredMethod, setHoveredMethod] = useState(null);

  const stats = React.useMemo(() => {
    let cardRev = 0, cardCnt = 0;
    let cashRev = 0, cashCnt = 0;

    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const amt = o.totalAmount || 0;
      if (o.paymentMethod === 'card' || o.paymentRef?.authCode) {
        cardRev += amt;
        cardCnt += 1;
      } else {
        cashRev += amt;
        cashCnt += 1;
      }
    });

    const totalRev = cardRev + cashRev;
    const totalCnt = cardCnt + cashCnt;

    return {
      card: {
        id: 'card',
        label: 'Card (POS Printec)',
        revenue: cardRev,
        count: cardCnt,
        pct: totalRev > 0 ? (cardRev / totalRev) * 100 : 0
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
  const isCashActive = selectedPayment === 'cash';

  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden group h-full flex flex-col justify-between space-y-4">
      {/* Background Ambient Glow Accents */}
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <CreditCard className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Metode de Plată
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Distribuție Live
              </span>
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

        {(isCardActive || isCashActive) && (
          <button
            onClick={() => onSelectPayment('all')}
            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Resetează
          </button>
        )}
      </div>

      {/* ─── Apple iOS Style Distribution Bar ─── */}
      <div className="space-y-2 relative z-10 select-none">
        {/* Metric Header */}
        <div className="flex items-center justify-between text-xs font-semibold px-0.5">
          <div 
            onClick={() => onSelectPayment(isCardActive ? 'all' : 'card')}
            className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${isCashActive ? 'opacity-40 hover:opacity-80' : 'opacity-100'}`}
            title="Filtrează după Card POS"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
            <span className="text-slate-700 dark:text-slate-200 font-bold">Card POS</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              {stats.card.pct.toFixed(1)}%
            </span>
          </div>

          <div 
            onClick={() => onSelectPayment(isCashActive ? 'all' : 'cash')}
            className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${isCardActive ? 'opacity-40 hover:opacity-80' : 'opacity-100'}`}
            title="Filtrează după Cash"
          >
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              {stats.cash.pct.toFixed(1)}%
            </span>
            <span className="text-slate-700 dark:text-slate-200 font-bold">Cash</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-xs shadow-amber-500/50" />
          </div>
        </div>

        {/* 3D Apple-Style Liquid Glass Capsule */}
        <div 
          className="relative w-full h-7 sm:h-8 rounded-full p-1 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-slate-300/90 dark:border-white/20 flex items-center overflow-hidden cursor-pointer select-none"
          style={{
            boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.3), inset 0 1px 2px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.08), 0 1px 2px rgba(255,255,255,0.8)'
          }}
          onClick={() => onSelectPayment(isCardActive ? 'cash' : (isCashActive ? 'all' : 'card'))}
          title="Click pentru a filtra după metoda de plată"
        >
          {/* Background Layer: 3D Cash Amber Cylinder */}
          <div 
            className="absolute inset-1 rounded-full overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #fef9c3 0%, #fde047 18%, #f59e0b 50%, #d97706 82%, #92400e 100%)',
              boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.9), inset 0 -3px 4px rgba(0,0,0,0.45)'
            }}
          >
            {/* Cash Top Specular Reflection */}
            <div className="absolute inset-x-1 top-0 h-[42%] rounded-t-full bg-gradient-to-b from-white/80 via-white/25 to-transparent pointer-events-none" />
            {/* Cash Bottom Bounce Light */}
            <div className="absolute inset-x-2 bottom-0 h-[28%] rounded-b-full bg-gradient-to-t from-amber-200/40 to-transparent pointer-events-none" />
          </div>

          {/* Foreground Layer: 3D Card POS Emerald Cylinder */}
          <div
            style={{ 
              width: `${stats.card.pct}%`,
              background: 'linear-gradient(180deg, #d1fae5 0%, #6ee7b7 18%, #10b981 50%, #059669 82%, #064e3b 100%)',
              boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.95), inset 0 -3px 4px rgba(0,0,0,0.45), 3px 0 10px rgba(0,0,0,0.35)'
            }}
            className="relative h-full rounded-l-full flex items-center justify-end overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10"
          >
            {/* Top Specular Glass Reflection */}
            <div className="absolute inset-x-1 top-0 h-[42%] rounded-t-full bg-gradient-to-b from-white/85 via-white/30 to-transparent pointer-events-none" />
            {/* Bottom Bounce Light */}
            <div className="absolute inset-x-2 bottom-0 h-[28%] rounded-b-full bg-gradient-to-t from-emerald-200/40 to-transparent pointer-events-none" />
            {/* 3D Physical Seam Divider Bead */}
            <div 
              className="w-1.5 h-full bg-gradient-to-b from-white via-slate-100 to-white/80 shrink-0 z-20"
              style={{
                boxShadow: '0 0 6px rgba(255,255,255,0.9), -1.5px 0 3px rgba(0,0,0,0.35)'
              }}
            />
          </div>

          {/* Diagonal Glass Sheen across entire capsule */}
          <div 
            className="absolute inset-0 pointer-events-none rounded-full z-30"
            style={{
              background: 'linear-gradient(120deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 30%, transparent 60%)'
            }}
          />
        </div>
      </div>

      {/* ─── Carduri Metode de Plată (Exact stil StatCard Dashboard) ─── */}
      <div className="space-y-3 relative z-10">
        {/* Card POS */}
        <div
          onClick={() => onSelectPayment(isCardActive ? 'all' : 'card')}
          className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border p-4 flex items-center justify-between relative overflow-hidden transition-all duration-200 group cursor-pointer select-none ${
            isCardActive
              ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md scale-[1.02]'
              : isCashActive
                ? 'opacity-40 border-slate-200 dark:border-slate-800 hover:opacity-75'
                : 'border-slate-200 dark:border-slate-800 hover:shadow-md hover:scale-[1.01]'
          }`}
          style={{ borderLeft: '4px solid #10b981' }}
        >
          <div className="flex flex-col justify-center min-w-0 pr-2 z-10 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Card POS
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                {stats.card.pct.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatThousands(stats.card.revenue)}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                lei
              </span>
            </div>

            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span>{stats.card.count} {stats.card.count === 1 ? 'comandă' : 'comenzi'}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-400">Terminal Bancar</span>
            </div>
          </div>

          <div className="relative shrink-0 ml-2">
            {/* 3D Atmosphere Glow */}
            <div 
              className="absolute -inset-1.5 rounded-full blur-md opacity-35 group-hover:opacity-75 transition-opacity pointer-events-none"
              style={{ backgroundColor: '#10b981' }}
            />
            {/* 3D Raised Bezel Container */}
            <div 
              className="relative w-12 h-12 rounded-full p-0.5 flex items-center justify-center bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 border border-white/80 dark:border-slate-600/60 shadow-md transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
              style={{ 
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25), 0 1px 2px rgba(0,0,0,0.1), inset 0 2px 3px rgba(255,255,255,0.9)' 
              }}
            >
              <CreditCard size={22} strokeWidth={2.2} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Cash la Casă */}
        <div
          onClick={() => onSelectPayment(isCashActive ? 'all' : 'cash')}
          className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border p-4 flex items-center justify-between relative overflow-hidden transition-all duration-200 group cursor-pointer select-none ${
            isCashActive
              ? 'ring-2 ring-amber-500 border-amber-500 shadow-md scale-[1.02]'
              : isCardActive
                ? 'opacity-40 border-slate-200 dark:border-slate-800 hover:opacity-75'
                : 'border-slate-200 dark:border-slate-800 hover:shadow-md hover:scale-[1.01]'
          }`}
          style={{ borderLeft: '4px solid #f59e0b' }}
        >
          <div className="flex flex-col justify-center min-w-0 pr-2 z-10 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cash la Casă
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                {stats.cash.pct.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatThousands(stats.cash.revenue)}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                lei
              </span>
            </div>

            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span>{stats.cash.count} {stats.cash.count === 1 ? 'comandă' : 'comenzi'}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-400">Casa Syrve</span>
            </div>
          </div>

          <div className="relative shrink-0 ml-2">
            {/* 3D Atmosphere Glow */}
            <div 
              className="absolute -inset-1.5 rounded-full blur-md opacity-35 group-hover:opacity-75 transition-opacity pointer-events-none"
              style={{ backgroundColor: '#f59e0b' }}
            />
            {/* 3D Raised Bezel Container */}
            <div 
              className="relative w-12 h-12 rounded-full p-0.5 flex items-center justify-center bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 border border-white/80 dark:border-slate-600/60 shadow-md transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
              style={{ 
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25), 0 1px 2px rgba(0,0,0,0.1), inset 0 2px 3px rgba(255,255,255,0.9)' 
              }}
            >
              <Banknote size={22} strokeWidth={2.2} className="text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer Insight Strip (Dashboard Standard) ─── */}
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 relative z-10">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {stats.card.pct >= 50 ? 'Plățile cu cardul domină vânzările' : 'Plata în numerar predomină'}
          </span>
        </div>
        <span className="font-bold text-slate-900 dark:text-white tracking-tight text-xs">
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
      return 'bg-slate-100/70 dark:bg-slate-800/30 text-slate-400 dark:text-slate-600 border border-slate-200/50 dark:border-slate-800/60';
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
    <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden group h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <Calendar className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Calendar Zile & Ore
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                Heatmap Activitate
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Vârf: <strong className="text-emerald-700 dark:text-emerald-400">{peakDayName} la {peakInfo.hour}:00</strong> ({peakInfo.count} comenzi)
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setMetricMode('count')}
            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all ${
              metricMode === 'count' 
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Nr. Comenzi
          </button>
          <button
            onClick={() => setMetricMode('revenue')}
            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all ${
              metricMode === 'revenue' 
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
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
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
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
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
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
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
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
          <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800/40 border border-slate-200/50" title="0 comenzi" />
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

  const { topProducts, totalUnits, totalRevenue, maxMetricVal } = React.useMemo(() => {
    const map = {};
    let totalU = 0;
    let totalR = 0;

    orders.forEach(order => {
      if (order.status === 'cancelled') return;
      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach(item => {
        const rawName = (item.name || '').trim();
        if (!rawName) return;
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
  }, [orders, metricMode]);

  const displayedProducts = topProducts.slice(0, limit);
  const podiumTop3 = topProducts.slice(0, 3);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all duration-300">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
            <Trophy className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Top Vânzări Produse
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                Clasament Produse
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {topProducts.length} produse diferite vândute • {formatThousands(totalUnits)} bucăți ({formatThousands(totalRevenue)} lei)
              {selectedHour !== null ? ` • la ora ${selectedHour}:00 - ${selectedHour + 1}:00` : ''}
              {selectedDay ? ` • ${selectedDay.label}` : ''}
            </p>
          </div>
        </div>

        {/* Controls: Metric Mode + Limit Switcher */}
        <div className="flex items-center gap-2">

          {/* Limit Switcher (apare când lista este extinsă) */}
          {isExpanded && (
            <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full flex items-center border border-slate-200/50 dark:border-slate-700/50">
              <button
                onClick={() => setLimit(5)}
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all ${
                  limit === 5
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Top 5
              </button>
              <button
                onClick={() => setLimit(10)}
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all ${
                  limit === 10
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Top 10
              </button>
            </div>
          )}

          {/* Metric Mode Switcher */}
          <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full flex items-center border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setMetricMode('quantity')}
              className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all ${
                metricMode === 'quantity'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Cantitate (Buc)
            </button>
            <button
              onClick={() => setMetricMode('revenue')}
              className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all ${
                metricMode === 'revenue'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
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

                      {/* Brand pill cu avatar */}
                      <div 
                        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border bg-white/90 dark:bg-slate-800/90 shadow-2xs"
                        style={{ borderColor: `${brandColor}40` }}
                      >
                        <BrandLogo brandId={prod.brand} size={15} />
                        <span 
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: brandColor }}
                        >
                          {prod.brand}
                        </span>
                      </div>
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
                            <div 
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full border shrink-0 bg-white/70 dark:bg-slate-800/70 shadow-2xs"
                              style={{ borderColor: `${brandColor}40` }}
                            >
                              <BrandLogo brandId={prod.brand} size={13} />
                              <span 
                                className="text-[9.5px] font-bold uppercase tracking-wider"
                                style={{ color: brandColor }}
                              >
                                {prod.brand}
                              </span>
                            </div>
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
  period = 'today',
  selectedBrands = [],
  onSelectBrand = () => {},
  selectedHour = null,
  onSelectHour = () => {},
  selectedDay = null,
  onSelectDay = () => {},
  selectedPayment = 'all',
  onSelectPayment = () => {},
  selectedProduct = '',
  onSelectProduct = () => {}
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
    <div className="space-y-5">
      {/* Rând 1: Evoluție Vânzări 3D (2/3) + Vânzări pe Branduri 3D (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2 h-full">
          <SalesTrendChart3D 
            orders={salesTrendOrders} 
            period={period} 
            selectedHour={selectedHour}
            onSelectHour={onSelectHour}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
          />
        </div>
        <div className="lg:col-span-1 h-full">
          <BrandDonutChart3D 
            orders={brandDonutOrders} 
            selectedBrands={selectedBrands}
            onSelectBrand={onSelectBrand}
            selectedHour={selectedHour}
            selectedDay={selectedDay}
          />
        </div>
      </div>

      {/* Rând 2: Calendar Zile & Ore (2/3) + Metode de Plată 3D (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2 h-full">
          <CalendarHeatmapChart 
            orders={calendarOrders} 
            period={period} 
            selectedHour={selectedHour}
            onSelectHour={onSelectHour}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
          />
        </div>
        <div className="lg:col-span-1 h-full">
          <PaymentMethodsChart3D 
            orders={paymentOrders} 
            selectedPayment={selectedPayment}
            onSelectPayment={onSelectPayment}
            selectedHour={selectedHour}
            selectedDay={selectedDay}
          />
        </div>
      </div>

      {/* Rând 3: Top Vânzări Produse 3D (Full-width Clasament Bestsellers) */}
      <TopProductsChart3D 
        orders={topProductsOrders}
        selectedProduct={selectedProduct}
        onSelectProduct={onSelectProduct}
        selectedHour={selectedHour}
        selectedDay={selectedDay}
      />
    </div>
  );
}
