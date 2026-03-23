const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * Proxy Syrve CDN images through our backend to avoid CORS.
 * Returns the proxy URL for Syrve images, or the original URL for everything else.
 */
export function proxySyrveImage(url) {
  if (!url) return null;
  if (url.includes('storage.cdneu.syrve.com')) {
    return `${BACKEND}/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}
