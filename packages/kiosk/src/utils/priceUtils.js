/**
 * Price utility functions for Kiosk
 */

export function getEffectivePrice(product) {
  if (!product) return 0;
  const basePrice = Number(product.price || 0);
  const promo = Number(product.promoPrice);
  if (!promo || promo <= 0) return basePrice;

  // Safety: A promo discount can ONLY lower the price, never inflate it above base price
  if (basePrice > 0 && promo >= basePrice) return basePrice;

  const now = new Date();
  if (product.promoStart && new Date(product.promoStart) > now) return basePrice;
  if (product.promoEnd && new Date(product.promoEnd) < now) return basePrice;

  return promo;
}

export function hasActivePromo(product) {
  if (!product) return false;
  const basePrice = Number(product.price || 0);
  const promo = Number(product.promoPrice);
  if (!promo || promo <= 0) return false;
  if (basePrice > 0 && promo >= basePrice) return false;

  const now = new Date();
  if (product.promoStart && new Date(product.promoStart) > now) return false;
  if (product.promoEnd && new Date(product.promoEnd) < now) return false;

  return true;
}
