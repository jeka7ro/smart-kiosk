/**
 * Shared utility functions for formatting numbers, currency and amounts.
 * Standardized across the entire Smart Kiosk Admin dashboard.
 */

/**
 * Formats a numeric value with space thousands separator and fixed decimals.
 * Example: 1814.22 -> "1 814.22"
 *          28517.9 -> "28 517.90"
 *          717.17  -> "717.17"
 */
export function formatThousands(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(Number(val))) return '0.00';
  const parts = Number(val).toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join('.');
}

/**
 * Normalizes and extracts clean location and kiosk information from any order/item object.
 * Returns { locationName, kioskLabel, fullDisplay }
 */
export function formatLocationAndKiosk(item) {
  const p = item?.payload || {};
  const rawLoc = p.locationName || item?.locationName || item?.location_id || item?.locationId || p.locationId || '';
  const locIdStr = String(item?.location_id || item?.locationId || p.locationId || '').toLowerCase();
  const orderNum = String(item?.orderNumber || p.orderNumber || '').toUpperCase();
  const rawLocLower = String(rawLoc).toLowerCase();
  const normStr = `${rawLocLower} ${locIdStr} ${orderNum}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Curățare Nume Oraș / Locație (strict orașul, fără niciun brand repetat sau 'main')
  let clean = '';
  if (normStr.includes('brasov') || normStr.includes('bv') || orderNum.startsWith('BV')) {
    clean = 'Brașov';
  } else if (normStr.includes('cluj') || normStr.includes('cj') || orderNum.startsWith('CJ') || locIdStr.includes('main') || normStr.includes('smashme-main')) {
    clean = 'Cluj';
  } else if (normStr.includes('constanta') || normStr.includes('ct') || orderNum.startsWith('CT')) {
    clean = 'Constanța';
  } else if (normStr.includes('oradea') || normStr.includes('ikura') || orderNum.startsWith('OR')) {
    clean = 'Oradea';
  } else if (normStr.includes('balotesti') || orderNum.startsWith('BAL')) {
    clean = 'Balotești';
  } else if (normStr.includes('bacau') || orderNum.startsWith('BC')) {
    clean = 'Bacău';
  } else if (normStr.includes('mures') || normStr.includes('targu') || orderNum.startsWith('MS')) {
    clean = 'Târgu Mureș';
  } else {
    clean = rawLoc
      .replace(/roll\s*master/gi, '')
      .replace(/smash\s*me/gi, '')
      .replace(/love\s*sushi/gi, '')
      .replace(/sushi\s*master/gi, '')
      .replace(/we\s*love\s*sushi/gi, '')
      .replace(/poki\s*woki/gi, '')
      .replace(/crunch/gi, '')
      .replace(/ikura/gi, '')
      .replace(/\bsm\b/gi, '')
      .replace(/[-_]/g, ' ')
      .trim();
    if (clean.toLowerCase() === 'main' || !clean) clean = 'Cluj';
  }

  // 2. Detecție Kiosk (Kiosk 1, Kiosk 2, etc.)
  // Prioritate absolută: prefixul comenzii (CJ2- = Kiosk 2, CJ1- = Kiosk 1) sau ID-ul de locație
  let kNum = '';
  if (orderNum.startsWith('CJ2-') || orderNum.startsWith('CT2-') || orderNum.startsWith('BV2-') || ['cluj2', 'cj2', 'constanta2', 'ct2', 'kiosk2', 'kiosk-2'].some(k => normStr.includes(k))) {
    kNum = '2';
  } else if (orderNum.startsWith('CJ1-') || orderNum.startsWith('CT1-') || orderNum.startsWith('BV1-') || ['cluj1', 'cj1', 'smashme-main', 'constanta1', 'ct1', 'kiosk1', 'kiosk-1'].some(k => normStr.includes(k))) {
    kNum = '1';
  } else if (['cluj3', 'cj3', 'kiosk3', 'kiosk-3'].some(k => normStr.includes(k))) {
    kNum = '3';
  } else {
    const rawK = String(p.kioskId || item?.kioskId || p.kiosk_id || item?.kiosk_id || '')
      .toLowerCase()
      .replace('kiosk', '')
      .replace(/[-_]/g, '')
      .trim();
    kNum = rawK || '1';
  }

  const kioskLabel = `Kiosk ${kNum}`;

  return {
    locationName: clean,
    kioskLabel,
    fullDisplay: `${clean} • ${kioskLabel}`
  };
}

