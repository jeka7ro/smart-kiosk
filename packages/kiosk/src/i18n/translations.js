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
  // ── Brand Select ─────────────────────────────────────────────
  choose_brand: {
    ro: 'Alege restaurantul',
    en: 'Choose restaurant',
    fr: 'Choisissez le restaurant',
    hu: 'Válasszon éttermet',
    ru: 'Выберите ресторан',
  },
  choose_brand_sub: {
    ro: 'Poți comanda de la mai multe restaurante',
    en: 'You can order from multiple restaurants',
    fr: 'Vous pouvez commander dans plusieurs restaurants',
    hu: 'Több étteremből is rendelhet',
    ru: 'Вы можете заказать из нескольких ресторанов',
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
  // ── Payment Screen (full) ──────────────────────────────────
  payment_card_title: {
    ro: 'Plată cu cardul',
    en: 'Card payment',
    fr: 'Paiement par carte',
    hu: 'Kártyás fizetés',
    ru: 'Оплата картой',
  },
  payment_card_subtitle: {
    ro: 'Apropiați sau introduceți cardul în terminal',
    en: 'Tap or insert your card at the terminal',
    fr: 'Approchez ou insérez votre carte au terminal',
    hu: 'Érintse meg vagy helyezze be kártyáját a terminálba',
    ru: 'Приложите или вставьте карту в терминал',
  },
  total_to_pay: {
    ro: 'Total de plată',
    en: 'Total to pay',
    fr: 'Total à payer',
    hu: 'Fizetendő összeg',
    ru: 'Сумма к оплате',
  },
  payment_step_1: {
    ro: 'Apropiați cardul sau telefonul (contactless)',
    en: 'Tap your card or phone (contactless)',
    fr: 'Approchez votre carte ou téléphone (sans contact)',
    hu: 'Érintse a kártyáját vagy telefonját (érintésmentes)',
    ru: 'Приложите карту или телефон (бесконтактно)',
  },
  payment_step_2: {
    ro: 'Sau introduceți cardul și introduceți PIN-ul',
    en: 'Or insert your card and enter PIN',
    fr: 'Ou insérez votre carte et entrez le PIN',
    hu: 'Vagy helyezze be a kártyát és adja meg a PIN-kódot',
    ru: 'Или вставьте карту и введите PIN',
  },
  payment_step_3: {
    ro: 'Așteptați confirmarea pe ecranul terminalului',
    en: 'Wait for confirmation on the terminal screen',
    fr: 'Attendez la confirmation sur l\'écran du terminal',
    hu: 'Várja meg a megerősítést a terminál képernyőjén',
    ru: 'Дождитесь подтверждения на экране терминала',
  },
  simulate_payment: {
    ro: '✅ Simulează plată (DEMO)',
    en: '✅ Simulate payment (DEMO)',
    fr: '✅ Simuler paiement (DÉMO)',
    hu: '✅ Fizetés szimulálása (DEMO)',
    ru: '✅ Симуляция оплаты (ДЕМО)',
  },
  back_to_cart: {
    ro: '← Înapoi la coș',
    en: '← Back to cart',
    fr: '← Retour au panier',
    hu: '← Vissza a kosárhoz',
    ru: '← Назад к корзине',
  },
  pos_init: {
    ro: 'Inițializare POS...',
    en: 'Initializing POS...',
    fr: 'Initialisation POS...',
    hu: 'POS inicializálás...',
    ru: 'Инициализация POS...',
  },
  waiting_payment: {
    ro: 'Așteptăm plata...',
    en: 'Waiting for payment...',
    fr: 'En attente de paiement...',
    hu: 'Fizetésre vár...',
    ru: 'Ожидание оплаты...',
  },
  processing_payment: {
    ro: 'Se procesează...',
    en: 'Processing...',
    fr: 'Traitement en cours...',
    hu: 'Feldolgozás...',
    ru: 'Обработка...',
  },
  // ── Confirmation Screen ─────────────────────────────────────
  payment_success: {
    ro: 'Plata a fost procesată cu succes',
    en: 'Payment successfully processed',
    fr: 'Paiement traité avec succès',
    hu: 'Fizetés sikeresen feldolgozva',
    ru: 'Оплата успешно обработана',
  },
  your_order_number: {
    ro: 'NUMĂRUL TĂU DE COMANDĂ',
    en: 'YOUR ORDER NUMBER',
    fr: 'VOTRE NUMÉRO DE COMMANDE',
    hu: 'RENDELÉSSZÁMA',
    ru: 'ВАШ НОМЕР ЗАКАЗА',
  },
  pickup_at_counter: {
    ro: '🏁 Ridicați comanda la caserie',
    en: '🏁 Pick up your order at the counter',
    fr: '🏁 Récupérez votre commande au comptoir',
    hu: '🏁 Vegye át rendelését a pultnál',
    ru: '🏁 Заберите заказ у кассы',
  },
  products_count: {
    ro: 'produs',
    en: 'product',
    fr: 'produit',
    hu: 'termék',
    ru: 'товар',
  },
  products_count_many: {
    ro: 'produse',
    en: 'products',
    fr: 'produits',
    hu: 'termék',
    ru: 'товаров',
  },
  paid_by_card: {
    ro: '💳 Plătit cu cardul',
    en: '💳 Paid by card',
    fr: '💳 Payé par carte',
    hu: '💳 Kártyával fizetve',
    ru: '💳 Оплачено картой',
  },
  confirmed: {
    ro: '✓ Confirmat',
    en: '✓ Confirmed',
    fr: '✓ Confirmé',
    hu: '✓ Megerősítve',
    ru: '✓ Подтверждено',
  },
  screen_reset_in: {
    ro: 'Ecranul se va reseta în',
    en: 'Screen will reset in',
    fr: 'L\'écran se réinitialisera dans',
    hu: 'A képernyő visszaáll',
    ru: 'Экран сбросится через',
  },
  new_order: {
    ro: 'Comandă nouă',
    en: 'New order',
    fr: 'Nouvelle commande',
    hu: 'Új rendelés',
    ru: 'Новый заказ',
  },
  // ── OrderType subtexts ──────────────────────────────────────
  order_type_subtitle: {
    ro: 'Selectați tipul comenzii — bucătăria pregătește ambalajul corespunzător',
    en: 'Select your order type — the kitchen will prepare the appropriate packaging',
    fr: 'Sélectionnez le type de commande — la cuisine prépare l\'emballage approprié',
    hu: 'Válassza ki a rendelés típusát — a konyha elkészíti a megfelelő csomagolást',
    ru: 'Выберите тип заказа — кухня подготовит соответствующую упаковку',
  },
  dine_in_sub: {
    ro: 'Serviți în restaurant · Fără ambalaj',
    en: 'Served in restaurant · No packaging',
    fr: 'Servi au restaurant · Sans emballage',
    hu: 'Étteremben felszolgálva · Csomagolás nélkül',
    ru: 'В ресторане · Без упаковки',
  },
  takeaway_sub: {
    ro: 'Ambalat pentru transport',
    en: 'Packaged for takeaway',
    fr: 'Emballé pour emporter',
    hu: 'Csomagolva elvitelre',
    ru: 'Упаковано с собой',
  },
  or: {
    ro: 'sau',
    en: 'or',
    fr: 'ou',
    hu: 'vagy',
    ru: 'или',
  },
  pickup_note: {
    ro: '🏁 Ridicați comanda la caserie după plată',
    en: '🏁 Pick up your order at the counter after payment',
    fr: '🏁 Récupérez votre commande au comptoir après le paiement',
    hu: '🏁 Vegye át rendelését a pultnál fizetés után',
    ru: '🏁 Заберите заказ у кассы после оплаты',
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
