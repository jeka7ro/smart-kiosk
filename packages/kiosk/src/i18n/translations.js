/**
 * Smart Kiosk — i18n translations
 * Languages: RO (default), EN, RU
 * (From questionnaire: Română, Engleză, Rusă)
 */

export const LANGUAGES = ['ro', 'en', 'ru'];
export const LANGUAGE_NAMES = { ro: 'RO', en: 'EN', ru: 'RU' };

/** @type {Record<string, Record<string, string>>} */
export const T = {
  // ── Welcome Screen ─────────────────────────────────────────
  tap_to_order: {
    ro: 'Atinge pentru a comanda',
    en: 'Tap to start your order',
    ru: 'Нажмите для заказа',
  },
  // ── Order Type Screen ──────────────────────────────────────
  how_to_order: {
    ro: 'Cum doriți să comandați?',
    en: 'How would you like to order?',
    ru: 'Как вы хотите заказать?',
  },
  dine_in: {
    ro: 'La masă',
    en: 'Dine-in',
    ru: 'За столом',
  },
  dine_in_desc: {
    ro: 'Comanda ajunge direct la masa dvs.',
    en: 'Order delivered directly to your table',
    ru: 'Заказ доставят прямо к вашему столу',
  },
  takeaway: {
    ro: 'La pachet',
    en: 'Take away',
    ru: 'С собой',
  },
  takeaway_desc: {
    ro: 'Ridicați comanda de la ghișeu',
    en: 'Pick up your order at the counter',
    ru: 'Заберите заказ у стойки',
  },
  enter_table: {
    ro: 'Introduceți numărul mesei',
    en: 'Enter your table number',
    ru: 'Введите номер столика',
  },
  table: {
    ro: 'Masa',
    en: 'Table',
    ru: 'Стол',
  },
  confirm: {
    ro: 'Confirmă',
    en: 'Confirm',
    ru: 'Подтвердить',
  },
  back: {
    ro: 'Înapoi',
    en: 'Back',
    ru: 'Назад',
  },
  // ── Menu Screen ────────────────────────────────────────────
  menu: {
    ro: 'Meniu',
    en: 'Menu',
    ru: 'Меню',
  },
  cart_empty: {
    ro: 'Coș gol',
    en: 'Empty cart',
    ru: 'Корзина пуста',
  },
  add_to_cart: {
    ro: '+ Adaugă',
    en: '+ Add',
    ru: '+ Добавить',
  },
  // ── Cart Screen ────────────────────────────────────────────
  my_cart: {
    ro: 'Coșul meu',
    en: 'My cart',
    ru: 'Моя корзина',
  },
  subtotal: {
    ro: 'Subtotal',
    en: 'Subtotal',
    ru: 'Сумма',
  },
  tva: {
    ro: 'TVA 9%',
    en: 'VAT 9%',
    ru: 'НДС 9%',
  },
  total: {
    ro: 'Total',
    en: 'Total',
    ru: 'Итого',
  },
  pay: {
    ro: 'Plătește',
    en: 'Pay',
    ru: 'Оплатить',
  },
  add_more: {
    ro: '+ Adaugă mai multe produse',
    en: '+ Add more items',
    ru: '+ Добавить ещё',
  },
  // ── Payment Screen ─────────────────────────────────────────
  present_card: {
    ro: 'Prezentați cardul la terminal',
    en: 'Present your card at the terminal',
    ru: 'Поднесите карту к терминалу',
  },
  payment_processing: {
    ro: 'Se procesează plata...',
    en: 'Processing payment...',
    ru: 'Обработка платежа...',
  },
  // ── Confirmation ───────────────────────────────────────────
  order_placed: {
    ro: 'Comandă plasată!',
    en: 'Order placed!',
    ru: 'Заказ принят!',
  },
  order_number: {
    ro: 'Numărul comenzii',
    en: 'Order number',
    ru: 'Номер заказа',
  },
  thank_you: {
    ro: 'Mulțumim! Comanda dvs. este pregătită.',
    en: 'Thank you! Your order is being prepared.',
    ru: 'Спасибо! Ваш заказ готовится.',
  },
  // ── Product Screen ─────────────────────────────────────────
  required: {
    ro: 'Obligatoriu',
    en: 'Required',
    ru: 'Обязательно',
  },
  allergens: {
    ro: 'Alergeni',
    en: 'Allergens',
    ru: 'Аллергены',
  },
  lei: {
    ro: 'lei',
    en: 'RON',
    ru: 'лей',
  },
};

/**
 * Get translation for a key in the given language.
 * Falls back to Romanian if key not found in language.
 */
export function t(key, lang = 'ro') {
  const entry = T[key];
  if (!entry) return key;
  return entry[lang] || entry.ro || key;
}
