const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://smart-kiosk-v7ws.onrender.com';

/**
 * Direct Syrve CDN loading (bypassing backend proxy).
 * Since <img> tags are not subject to strict CORS unless reading pixel data,
 * grabbing them straight from storage.cdneu.syrve.com is infinitely faster and 
 * completely removes the Render.com bottleneck.
 */
export function proxySyrveImage(url) {
  if (!url) return null;
  // If it's a locally synchronized file, we must prepend the backend host
  if (url.startsWith('/uploads')) {
    const base = BACKEND.endsWith('/') ? BACKEND.slice(0, -1) : BACKEND;
    return `${base}${url}`;
  }
  // Otherwise leverage Syrve's fast CDN directly
  return url;
}
