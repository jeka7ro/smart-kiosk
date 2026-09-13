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
