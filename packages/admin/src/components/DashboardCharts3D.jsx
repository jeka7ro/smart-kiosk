import React, { useState } from 'react';
import BrandLogo from './BrandLogo';
import { TrendingUp, PieChart, CreditCard, Clock, Banknote, Calendar, Flame } from 'lucide-react';
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
  const height = 240;
  const padX = 45;
  const padTop = 30;
  const padBottom = 40;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;
  const depth = 16; // 3D isometric z-depth

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
    <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden group">
      {/* 3D Background Glow */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Evoluție Vânzări 3D
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Zoom 3D Flow
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total: <strong className="text-slate-800 dark:text-slate-200">{formatThousands(totalRev)} lei</strong> ({totalCnt} comenzi)
            </p>
          </div>
        </div>

        {/* Toggle Mode */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setMetricMode('revenue')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${metricMode === 'revenue' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Încasări (RON)
          </button>
          <button
            onClick={() => setMetricMode('count')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${metricMode === 'count' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Nr. Comenzi
          </button>
        </div>
      </div>

      {/* SVG 3D Canvas */}
      <div className="relative w-full h-[240px]">
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
                    r={12}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    className="animate-ping"
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
  onSelectBrand = () => {} 
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
    <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Vânzări pe Branduri 3D
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Donut 3D Ring
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pondere vânzări per brand în perioada selectată
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* 3D Donut SVG Canvas */}
        <div className="relative flex items-center justify-center min-h-[190px]">
          <svg viewBox="0 0 300 240" className="w-full max-w-[240px] h-[190px] overflow-visible">
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

          </svg>
        </div>

        {/* Brand Legend */}
        <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
          {brandData.list.length === 0 ? (
            <div className="p-5 text-center text-slate-400 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
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
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-md ring-2 ring-blue-500/20 scale-[1.02]'
                      : isHovered 
                      ? 'bg-slate-100 dark:bg-slate-800 border-blue-500/40 shadow-md scale-[1.02]' 
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
                      {b.count} comenzi • <strong className="text-blue-600 dark:text-blue-400">{b.pct.toFixed(0)}%</strong>
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
  onSelectPayment = () => {} 
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

  const maxVal = Math.max(stats.card.revenue, stats.cash.revenue, 100);
  const maxBarH = 120;
  const cardH = Math.max(20, (stats.card.revenue / maxVal) * maxBarH);
  const cashH = Math.max(20, (stats.cash.revenue / maxVal) * maxBarH);

  const isCardActive = selectedPayment === 'card';
  const isCashActive = selectedPayment === 'cash';

  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Metode de Plată 3D
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                3D Cylinders
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Card POS vs Cash la Casă (Click pe cilindru pentru filtrare)
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* SVG Cylinders */}
        <div className="relative h-[190px] flex items-center justify-center">
          <svg viewBox="0 0 280 200" className="w-full max-w-[240px] h-full overflow-visible">
            <defs>
              <linearGradient id="cardCylGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#047857" />
                <stop offset="35%" stopColor="#10b981" />
                <stop offset="70%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#065f46" />
              </linearGradient>

              <linearGradient id="cashCylGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#b45309" />
                <stop offset="35%" stopColor="#f59e0b" />
                <stop offset="70%" stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
            </defs>

            {/* Base Floor Ellipses */}
            <ellipse cx="80" cy="165" rx="42" ry="16" fill="#000000" opacity="0.12" />
            <ellipse cx="200" cy="165" rx="42" ry="16" fill="#000000" opacity="0.12" />

            {/* Card Cylinder */}
            <g
              className="cursor-pointer transition-all duration-200"
              onClick={() => onSelectPayment('card')}
              onMouseEnter={() => setHoveredMethod('card')}
              onMouseLeave={() => setHoveredMethod(null)}
              opacity={selectedPayment === 'cash' ? 0.35 : 1}
              style={{ transform: (hoveredMethod === 'card' || isCardActive) ? 'translateY(-6px)' : 'none' }}
            >
              <rect x="38" y={160 - cardH} width="84" height={cardH} fill="url(#cardCylGrad)" />
              <path d={`M 38,160 A 42 16 0 0 0 122,160 L 122,160 A 42 16 0 0 1 38,160 Z`} fill="#047857" />
              <ellipse 
                cx="80" 
                cy={160 - cardH} 
                rx="42" 
                ry="16" 
                fill={isCardActive ? "#6ee7b7" : "#34d399"} 
                stroke={isCardActive ? "#10b981" : "#6ee7b7"} 
                strokeWidth={isCardActive ? 3 : 1.5} 
              />
              <text x="80" y={160 - cardH + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#064e3b">
                {stats.card.pct.toFixed(0)}%
              </text>
              <text x="80" y="186" textAnchor="middle" fontSize="11" fontWeight="bold" className={`${isCardActive ? 'fill-emerald-600 font-black' : 'fill-slate-600 dark:fill-slate-300'}`}>
                Card POS {isCardActive && '●'}
              </text>
            </g>

            {/* Cash Cylinder */}
            <g
              className="cursor-pointer transition-all duration-200"
              onClick={() => onSelectPayment('cash')}
              onMouseEnter={() => setHoveredMethod('cash')}
              onMouseLeave={() => setHoveredMethod(null)}
              opacity={selectedPayment === 'card' ? 0.35 : 1}
              style={{ transform: (hoveredMethod === 'cash' || isCashActive) ? 'translateY(-6px)' : 'none' }}
            >
              <rect x="158" y={160 - cashH} width="84" height={cashH} fill="url(#cashCylGrad)" />
              <path d={`M 158,160 A 42 16 0 0 0 242,160 L 242,160 A 42 16 0 0 1 158,160 Z`} fill="#92400e" />
              <ellipse 
                cx="200" 
                cy={160 - cashH} 
                rx="42" 
                ry="16" 
                fill={isCashActive ? "#fef08a" : "#fcd34d"} 
                stroke={isCashActive ? "#f59e0b" : "#fef08a"} 
                strokeWidth={isCashActive ? 3 : 1.5} 
              />
              <text x="200" y={160 - cashH + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#78350f">
                {stats.cash.pct.toFixed(0)}%
              </text>
              <text x="200" y="186" textAnchor="middle" fontSize="11" fontWeight="bold" className={`${isCashActive ? 'fill-amber-600 font-black' : 'fill-slate-600 dark:fill-slate-300'}`}>
                Cash {isCashActive && '●'}
              </text>
            </g>
          </svg>
        </div>

        {/* Detailed Stats in 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div 
            onClick={() => onSelectPayment('card')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              isCardActive
                ? 'bg-emerald-100/70 dark:bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md scale-[1.02]'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-5 h-5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CreditCard size={12} strokeWidth={2.5} />
                </span>
                Card POS
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 dark:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200 shrink-0">
                {stats.card.pct.toFixed(1)}%
              </span>
            </div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-1">
              {formatThousands(stats.card.revenue)} lei
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium">
              {stats.card.count} {stats.card.count === 1 ? 'comandă' : 'comenzi'}
            </div>
          </div>

          <div 
            onClick={() => onSelectPayment('cash')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              isCashActive
                ? 'bg-amber-100/70 dark:bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30 shadow-md scale-[1.02]'
                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-5 h-5 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Banknote size={12} strokeWidth={2.5} />
                </span>
                Cash
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 dark:bg-amber-500/30 text-amber-900 dark:text-amber-200 shrink-0">
                {stats.cash.pct.toFixed(1)}%
              </span>
            </div>
            <div className="text-lg font-black text-amber-700 dark:text-amber-400 mt-1">
              {formatThousands(stats.cash.revenue)} lei
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-500 font-medium">
              {stats.cash.count} {stats.cash.count === 1 ? 'comandă' : 'comenzi'}
            </div>
          </div>
        </div>
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
      return 'bg-indigo-500/20 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold';
    }
    if (ratio <= 0.50) {
      return 'bg-indigo-500/45 dark:bg-indigo-500/50 text-indigo-950 dark:text-indigo-100 border border-indigo-500/60 font-bold';
    }
    if (ratio <= 0.75) {
      return 'bg-indigo-600 text-white font-bold border border-indigo-400 shadow-sm shadow-indigo-500/30';
    }
    return 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black border border-purple-400 shadow-md shadow-purple-500/40';
  };

  const peakDayName = DAYS.find(d => d.id === peakInfo.dayId)?.name || 'Luni';

  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden group">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Calendar Zile & Ore
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Heatmap Activitate
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vârf: <strong className="text-purple-600 dark:text-purple-400">{peakDayName} la {peakInfo.hour}:00</strong> ({peakInfo.count} comenzi)
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setMetricMode('count')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
              metricMode === 'count' 
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Nr. Comenzi
          </button>
          <button
            onClick={() => setMetricMode('revenue')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
              metricMode === 'revenue' 
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Încasări (lei)
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
                          ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400 scale-105'
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
                          ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400'
                          : isToday && period === 'today'
                          ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-black border border-purple-500/30'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{d.short}</span>
                      {isToday && period === 'today' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
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
                          className={`w-full h-8 rounded-lg flex items-center justify-center text-[11px] transition-all cursor-pointer ${colorClass} ${
                            isExactSelected
                              ? 'ring-2 ring-blue-500 dark:ring-blue-400 scale-110 shadow-lg z-20 font-black'
                              : isInSelectedRow || isInSelectedCol
                              ? 'ring-1 ring-purple-400/60'
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
            <span className="font-semibold text-purple-600 dark:text-purple-400">
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
          <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800/40 border border-slate-200/50" />
          <div className="w-3 h-3 rounded bg-indigo-500/25" />
          <div className="w-3 h-3 rounded bg-indigo-500/50" />
          <div className="w-3 h-3 rounded bg-indigo-600" />
          <div className="w-3 h-3 rounded bg-gradient-to-tr from-purple-600 to-indigo-600" />
          <span>Vârf</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper Component to render all 4 3D Charts neatly in a 2x2 grid with interactive cross-filtering
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
  onSelectPayment = () => {}
}) {
  // Filtrare comenzi după brandurile selectate pentru celelalte 3 grafice
  const brandFilteredOrders = React.useMemo(() => {
    if (!selectedBrands || selectedBrands.length === 0) return orders;
    return orders.filter(o => {
      const b = (o.brand || '').toLowerCase();
      return selectedBrands.includes(b);
    });
  }, [orders, selectedBrands]);

  return (
    <div className="space-y-6">
      {/* Rând 1: 3 Coloane Egale (Evoluție Vânzări 3D, Vânzări pe Branduri 3D, Metode de Plată 3D) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SalesTrendChart3D 
          orders={brandFilteredOrders} 
          period={period} 
          selectedHour={selectedHour}
          onSelectHour={onSelectHour}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
        />
        <BrandDonutChart3D 
          orders={orders} 
          selectedBrands={selectedBrands}
          onSelectBrand={onSelectBrand}
        />
        <PaymentMethodsChart3D 
          orders={brandFilteredOrders} 
          selectedPayment={selectedPayment}
          onSelectPayment={onSelectPayment}
        />
      </div>

      {/* Rând 2: Pe toată lungimea rândului (Calendar Zile & Ore Heatmap) */}
      <div className="w-full">
        <CalendarHeatmapChart 
          orders={brandFilteredOrders} 
          period={period} 
          selectedHour={selectedHour}
          onSelectHour={onSelectHour}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
        />
      </div>
    </div>
  );
}
