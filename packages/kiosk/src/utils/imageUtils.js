const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * Direct Syrve CDN loading (bypassing backend proxy).
 * Since <img> tags are not subject to strict CORS unless reading pixel data,
 * grabbing them straight from storage.cdneu.syrve.com is infinitely faster and 
 * completely removes the Render.com bottleneck.
 */
export function proxySyrveImage(url) {
  if (!url) return null;
  // Return the original URL directly to leverage Syrve's fast CDN
  return url;
}
