/**
 * Smart Kiosk — i18n translations
 * Languages: RO (default), EN, FR, HU, RU
 */

export const LANGUAGES = ['ro', 'en', 'fr', 'hu', 'ru'];
export const LANGUAGE_NAMES = { ro: 'RO', en: 'EN', fr: 'FR', hu: 'HU', ru: 'RU' };
export const LANGUAGE_FLAGS = { ro: '🇷🇴', en: '🇬🇧', fr: '🇫🇷', hu: '🇭🇺', ru: '🇷🇺' };

/** @type {Record<string, Record<string, string>>} */
export const T = {
  // ── Welcome Screen ─────────────────────────────────────────
  tap_to_order: {
    ro: 'Atinge pentru a comanda',
    en: 'Tap to start your order',
    fr: 'Touchez pour commander',
    hu: 'Érintse meg a rendeléshez',
    ru: 'Нажмите для заказа',
  },
  // ── Order Type Screen ──────────────────────────────────────
  how_to_order: {
    ro: 'Cum doriți să comandați?',
    en: 'How would you like to order?',
    fr: 'Comment souhaitez-vous commander ?',
    hu: 'Hogyan szeretne rendelni?',
    ru: 'Как вы хотите заказать?',
  },
  dine_in: {
    ro: 'La masă',
    en: 'Dine-in',
    fr: 'Sur place',
    hu: 'Helyben fogyasztás',
    ru: 'За столом',
  },
  dine_in_desc: {
    ro: 'Comanda ajunge direct la masa dvs.',
    en: 'Order delivered directly to your table',
    fr: 'Commande livrée directement à votre table',
    hu: 'A rendelést közvetlenül az asztalához szállítjuk',
    ru: 'Заказ доставят прямо к вашему столу',
  },
  takeaway: {
    ro: 'La pachet',
    en: 'Take away',
    fr: 'À emporter',
    hu: 'Elvitelre',
    ru: 'С собой',
  },
  takeaway_desc: {
    ro: 'Ridicați comanda de la ghișeu',
    en: 'Pick up your order at the counter',
    fr: 'Récupérez votre commande au comptoir',
    hu: 'Vegye át rendelését a pultnál',
    ru: 'Заберите заказ у стойки',
  },
  enter_table: {
    ro: 'Introduceți numărul mesei',
    en: 'Enter your table number',
    fr: 'Entrez le numéro de votre table',
    hu: 'Adja meg az asztal számát',
    ru: 'Введите номер столика',
  },
  table: {
    ro: 'Masa',
    en: 'Table',
    fr: 'Table',
    hu: 'Asztal',
    ru: 'Стол',
  },
  confirm: {
    ro: 'Confirmă',
    en: 'Confirm',
    fr: 'Confirmer',
    hu: 'Megerősítés',
    ru: 'Подтвердить',
  },
  back: {
    ro: 'Înapoi',
    en: 'Back',
    fr: 'Retour',
    hu: 'Vissza',
    ru: 'Назад',
  },
  // ── Menu Screen ────────────────────────────────────────────
  menu: {
    ro: 'Meniu',
    en: 'Menu',
    fr: 'Menu',
    hu: 'Menü',
    ru: 'Меню',
  },
  cart_empty: {
    ro: 'Coș gol',
    en: 'Empty cart',
    fr: 'Panier vide',
    hu: 'Üres kosár',
    ru: 'Корзина пуста',
  },
  add_to_cart: {
    ro: '+ Adaugă',
    en: '+ Add',
    fr: '+ Ajouter',
    hu: '+ Hozzáadás',
    ru: '+ Добавить',
  },
  item_one: {
    ro: 'produs',
    en: 'item',
    fr: 'article',
    hu: 'termék',
    ru: 'товар',
  },
  items_many: {
    ro: 'produse',
    en: 'items',
    fr: 'articles',
    hu: 'termék',
    ru: 'товаров',
  },
  search: {
    ro: 'Caută',
    en: 'Search',
    fr: 'Rechercher',
    hu: 'Keresés',
    ru: 'Поиск',
  },
  all_categories: {
    ro: 'Toate',
    en: 'All',
    fr: 'Tout',
    hu: 'Összes',
    ru: 'Все',
  },
  // ── Cart Screen ────────────────────────────────────────────
  my_cart: {
    ro: 'Coșul meu',
    en: 'My cart',
    fr: 'Mon panier',
    hu: 'Kosaram',
    ru: 'Моя корзина',
  },
  subtotal: {
    ro: 'Subtotal',
    en: 'Subtotal',
    fr: 'Sous-total',
    hu: 'Részösszeg',
    ru: 'Сумма',
  },
  tva: {
    ro: 'TVA 9%',
    en: 'VAT 9%',
    fr: 'TVA 9%',
    hu: 'ÁFA 9%',
    ru: 'НДС 9%',
  },
  tva_included: {
    ro: 'inclus',
    en: 'included',
    fr: 'incluse',
    hu: 'tartalmazza',
    ru: 'включен',
  },
  total: {
    ro: 'Total',
    en: 'Total',
    fr: 'Total',
    hu: 'Összesen',
    ru: 'Итого',
  },
  pay: {
    ro: 'Plătește',
    en: 'Pay',
    fr: 'Payer',
    hu: 'Fizetés',
    ru: 'Оплатить',
  },
  add_more: {
    ro: '+ Adaugă mai multe',
    en: '+ Add more items',
    fr: '+ Ajouter plus',
    hu: '+ Több hozzáadása',
    ru: '+ Добавить ещё',
  },
  // ── Payment Screen ─────────────────────────────────────────
  present_card: {
    ro: 'Prezentați cardul la terminal',
    en: 'Present your card at the terminal',
    fr: 'Présentez votre carte au terminal',
    hu: 'Helyezze a kártyáját a terminálra',
    ru: 'Поднесите карту к терминалу',
  },
  payment_processing: {
    ro: 'Se procesează plata...',
    en: 'Processing payment...',
    fr: 'Traitement du paiement...',
    hu: 'Fizetés feldolgozása...',
    ru: 'Обработка платежа...',
  },
  // ── Confirmation ───────────────────────────────────────────
  order_placed: {
    ro: 'Comandă plasată!',
    en: 'Order placed!',
    fr: 'Commande validée !',
    hu: 'Rendelés leadva!',
    ru: 'Заказ принят!',
  },
  order_number: {
    ro: 'Numărul comenzii',
    en: 'Order number',
    fr: 'Numéro de commande',
    hu: 'Rendelésszám',
    ru: 'Номер заказа',
  },
  thank_you: {
    ro: 'Mulțumim! Comanda dvs. este pregătită.',
    en: 'Thank you! Your order is being prepared.',
    fr: 'Merci ! Votre commande est en préparation.',
    hu: 'Köszönjük! Rendelését készítjük.',
    ru: 'Спасибо! Ваш заказ готовится.',
  },
  // ── Product Screen ─────────────────────────────────────────
  required: {
    ro: 'Obligatoriu',
    en: 'Required',
    fr: 'Obligatoire',
    hu: 'Kötelező',
    ru: 'Обязательно',
  },
  allergens: {
    ro: 'Alergeni',
    en: 'Allergens',
    fr: 'Allergènes',
    hu: 'Allergének',
    ru: 'Аллергены',
  },
  lei: {
    ro: 'lei',
    en: 'RON',
    fr: 'RON',
    hu: 'RON',
    ru: 'лей',
  },
  // ── Poster / Screensaver ────────────────────────────────────
  start_order: {
    ro: 'Începe comanda',
    en: 'Start order',
    fr: 'Commencer',
    hu: 'Rendelés indítása',
    ru: 'Начать заказ',
  },
  touch_anywhere: {
    ro: 'Atinge oriunde pe ecran',
    en: 'Touch anywhere on screen',
    fr: 'Touchez l\'écran',
    hu: 'Érintse meg a képernyőt',
    ru: 'Коснитесь экрана',
  },
  // ── General ─────────────────────────────────────────────────
  cancel: {
    ro: 'Anulează',
    en: 'Cancel',
    fr: 'Annuler',
    hu: 'Mégsem',
    ru: 'Отмена',
  },
  close: {
    ro: 'Închide',
    en: 'Close',
    fr: 'Fermer',
    hu: 'Bezárás',
    ru: 'Закрыть',
  },
  loading: {
    ro: 'Se încarcă...',
    en: 'Loading...',
    fr: 'Chargement...',
    hu: 'Betöltés...',
    ru: 'Загрузка...',
  },
  error_loading: {
    ro: 'Eroare la încărcare',
    en: 'Loading error',
    fr: 'Erreur de chargement',
    hu: 'Betöltési hiba',
    ru: 'Ошибка загрузки',
  },
  retry: {
    ro: 'Reîncearcă',
    en: 'Retry',
    fr: 'Réessayer',
    hu: 'Újra',
    ru: 'Повторить',
  },
  added_to_cart: {
    ro: 'Adăugat în coș',
    en: 'Added to cart',
    fr: 'Ajouté au panier',
    hu: 'Kosárba helyezve',
    ru: 'Добавлено',
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
