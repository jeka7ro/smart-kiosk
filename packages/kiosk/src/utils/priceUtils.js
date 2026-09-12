/**
 * Price utility functions for Kiosk
 */

export function getEffectivePrice(product) {
  if (!product) return 0;
  const promo = Number(product.promoPrice);
  if (!promo || promo <= 0) return Number(product.price || 0);

  const now = new Date();
  if (product.promoStart && new Date(product.promoStart) > now) return Number(product.price || 0);
  if (product.promoEnd && new Date(product.promoEnd) < now) return Number(product.price || 0);

  return promo;
}

export function hasActivePromo(product) {
  if (!product) return false;
  const promo = Number(product.promoPrice);
  if (!promo || promo <= 0) return false;

  const now = new Date();
  if (product.promoStart && new Date(product.promoStart) > now) return false;
  if (product.promoEnd && new Date(product.promoEnd) < now) return false;

  return promo < Number(product.price || 0);
}
