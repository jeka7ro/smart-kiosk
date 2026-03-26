/**
 * Smart Kiosk — i18n translations
 * Languages: RO (default), EN, FR, HU, RU
 */

export const LANGUAGES = ['ro', 'en', 'fr', 'hu', 'ru', 'uk', 'bg', 'de'];
export const LANGUAGE_NAMES = { ro: 'RO', en: 'EN', fr: 'FR', hu: 'HU', ru: 'RU', uk: 'UA', bg: 'BG', de: 'DE' };
export const LANGUAGE_FLAGS = { ro: '🇷🇴', en: '🇬🇧', fr: '🇫🇷', hu: '🇭🇺', ru: '🇷🇺', uk: '🇺🇦', bg: '🇧🇬', de: '🇩🇪' };

/** @type {Record<string, Record<string, string>>} */
export const T = {
  // ── Welcome Screen ─────────────────────────────────────────
  tap_to_order: {
    ro: 'Atinge pentru a comanda',
    en: 'Tap to start your order',
    fr: 'Touchez pour commander',
    hu: 'Érintse meg a rendeléshez',
    ru: 'Нажмите для заказа',
    uk: 'Натисніть, щоб замовити',
    bg: "Докоснете за поръчка",
    de: "Tippen zum Bestellen"
  },
  // ── Order Type Screen ──────────────────────────────────────
  how_to_order: {
    ro: 'Cum doriți să comandați?',
    en: 'How would you like to order?',
    fr: 'Comment souhaitez-vous commander ?',
    hu: 'Hogyan szeretne rendelni?',
    ru: 'Как вы хотите заказать?',
    uk: 'Як ви бажаєте замовити?',
    bg: "Как искате да поръчате?",
    de: "Wie möchten Sie bestellen?"
  },
  dine_in: {
    ro: 'La masă',
    en: 'Dine-in',
    fr: 'Sur place',
    hu: 'Helyben fogyasztás',
    ru: 'За столом',
    uk: 'У закладі',
    bg: "В залата",
    de: "Hier essen"
  },
  dine_in_desc: {
    ro: 'Comanda ajunge direct la masa dvs.',
    en: 'Order delivered directly to your table',
    fr: 'Commande livrée directement à votre table',
    hu: 'A rendelést közvetlenül az asztalához szállítjuk',
    ru: 'Заказ доставят прямо к вашему столу',
    uk: 'Замовлення доставлять прямо до вашого столу',
    bg: "Поръчката се доставя на масата",
    de: "Wird an den Tisch gebracht"
  },
  takeaway: {
    ro: 'La pachet',
    en: 'Take away',
    fr: 'À emporter',
    hu: 'Elvitelre',
    ru: 'С собой',
    uk: 'З собою',
    bg: "За вкъщи",
    de: "Zum Mitnehmen"
  },
  takeaway_desc: {
    ro: 'Ridicați comanda de la ghișeu',
    en: 'Pick up your order at the counter',
    fr: 'Récupérez votre commande au comptoir',
    hu: 'Vegye át rendelését a pultnál',
    ru: 'Заберите заказ у стойки',
    uk: 'Заберіть замовлення на касі',
    bg: "Вземете от касата",
    de: "Abholung an der Kasse"
  },
  enter_table: {
    ro: 'Introduceți numărul mesei',
    en: 'Enter your table number',
    fr: 'Entrez le numéro de votre table',
    hu: 'Adja meg az asztal számát',
    ru: 'Введите номер столика',
    uk: 'Введіть номер столика',
    bg: "Въведете номер на маса",
    de: "Tischnummer eingeben"
    bg: "Маса",
    de: "Tisch"
  },
  table: {
    ro: 'Masa',
    en: 'Table',
    fr: 'Table',
    hu: 'Asztal',
    ru: 'Стол',
    uk: 'Стіл',
    bg: "Маса",
    de: "Tisch"
  },
  confirm: {
    ro: 'Confirmă',
    en: 'Confirm',
    fr: 'Confirmer',
    hu: 'Megerősítés',
    ru: 'Подтвердить',
    uk: 'Підтвердити',
    bg: "Потвърди",
    de: "Bestätigen"
  },
  back: {
    ro: 'Înapoi',
    en: 'Back',
    fr: 'Retour',
    hu: 'Vissza',
    ru: 'Назад',
    uk: 'Назад',
    bg: "Назад",
    de: "Zurück"
  },
  // ── Menu Screen ────────────────────────────────────────────
  menu: {
    ro: 'Meniu',
    en: 'Menu',
    fr: 'Menu',
    hu: 'Menü',
    ru: 'Меню',
    uk: 'Меню',
    bg: "Меню",
    de: "Menü"
  },
  cart_empty: {
    ro: 'Coș gol',
    en: 'Empty cart',
    fr: 'Panier vide',
    hu: 'Üres kosár',
    ru: 'Корзина пуста',
    uk: 'Кошик порожній',
    bg: "Празна количка",
    de: "Leerer Warenkorb"
  },
  add_to_cart: {
    ro: '+ Adaugă',
    en: '+ Add',
    fr: '+ Ajouter',
    hu: '+ Hozzáadás',
    ru: '+ Добавить',
    uk: '+ Додати',
    bg: "+ Добави",
    de: "+ Hinzufügen"
  },
  item_one: {
    ro: 'produs',
    en: 'item',
    fr: 'article',
    hu: 'termék',
    ru: 'товар',
    uk: 'товар',
    bg: "продукт",
    de: "Artikel"
  },
  items_many: {
    ro: 'produse',
    en: 'items',
    fr: 'articles',
    hu: 'termék',
    ru: 'товаров',
    uk: 'товарів',
    bg: "продукти",
    de: "Artikel"
  },
  search: {
    ro: 'Caută',
    en: 'Search',
    fr: 'Rechercher',
    hu: 'Keresés',
    ru: 'Поиск',
    uk: 'Пошук',
    bg: "Търсене",
    de: "Suche"
  },
  all_categories: {
    ro: 'Toate',
    en: 'All',
    fr: 'Tout',
    hu: 'Összes',
    ru: 'Все',
    uk: 'Всі',
    bg: "Всички",
    de: "Alle"
  },
  // ── Cart Screen ────────────────────────────────────────────
  my_cart: {
    ro: 'Coșul meu',
    en: 'My cart',
    fr: 'Mon panier',
    hu: 'Kosaram',
    ru: 'Моя корзина',
    uk: 'Мій кошик',
    bg: "Моята количка",
    de: "Mein Warenkorb"
  },
  subtotal: {
    ro: 'Subtotal',
    en: 'Subtotal',
    fr: 'Sous-total',
    hu: 'Részösszeg',
    ru: 'Сумма',
    uk: 'Сума',
    bg: "Междинна сума",
    de: "Zwischensumme"
    bg: "Общо",
    de: "Gesamt"
  },
  tva: {
    ro: 'TVA 9%',
    en: 'VAT 9%',
    fr: 'TVA 9%',
    hu: 'ÁFA 9%',
    ru: 'НДС 9%',
    uk: 'ПДВ 9%',
    bg: "ДДС",
    de: "MwSt"
  },
  tva_included: {
    ro: 'inclus',
    en: 'included',
    fr: 'incluse',
    hu: 'tartalmazza',
    ru: 'включен',
    uk: 'включено',
    bg: "включено",
    de: "inkl"
  },
  total: {
    ro: 'Total',
    en: 'Total',
    fr: 'Total',
    hu: 'Összesen',
    ru: 'Итого',
    uk: 'Разом',
    bg: "Общо",
    de: "Gesamt"
  },
  pay: {
    ro: 'Plătește',
    en: 'Pay',
    fr: 'Payer',
    hu: 'Fizetés',
    ru: 'Оплатить',
    uk: 'Оплатити',
    bg: "Плати",
    de: "Bezahlen"
  },
  add_more: {
    ro: '+ Adaugă mai multe',
    en: '+ Add more items',
    fr: '+ Ajouter plus',
    hu: '+ Több hozzáadása',
    ru: '+ Добавить ещё',
    uk: '+ Додати ще',
    bg: "+ Добави още",
    de: "+ Mehr"
  },
  // ── Payment Screen ─────────────────────────────────────────
  present_card: {
    ro: 'Prezentați cardul la terminal',
    en: 'Present your card at the terminal',
    fr: 'Présentez votre carte au terminal',
    hu: 'Helyezze a kártyáját a terminálra',
    ru: 'Поднесите карту к терминалу',
    uk: 'Піднесіть картку до терміналу',
    bg: "Поставете картата",
    de: "Karte vorhalten"
  },
  payment_processing: {
    ro: 'Se procesează plata...',
    en: 'Processing payment...',
    fr: 'Traitement du paiement...',
    hu: 'Fizetés feldolgozása...',
    ru: 'Обработка платежа...',
    uk: 'Обробка платежу...',
    bg: "Обработка...",
    de: "Verarbeitung..."
  },
  // ── Confirmation ───────────────────────────────────────────
  order_placed: {
    ro: 'Comandă plasată!',
    en: 'Order placed!',
    fr: 'Commande validée !',
    hu: 'Rendelés leadva!',
    ru: 'Заказ принят!',
    uk: 'Замовлення прийнято!',
    bg: "Поръчката е приета!",
    de: "Bestellung aufgegeben!"
  },
  order_number: {
    ro: 'Numărul comenzii',
    en: 'Order number',
    fr: 'Numéro de commande',
    hu: 'Rendelésszám',
    ru: 'Номер заказа',
    uk: 'Номер замовлення',
    bg: "Номер",
    de: "Bestellnummer"
  },
  thank_you: {
    ro: 'Mulțumim! Comanda dvs. este pregătită.',
    en: 'Thank you! Your order is being prepared.',
    fr: 'Merci ! Votre commande est en préparation.',
    hu: 'Köszönjük! Rendelését készítjük.',
    ru: 'Спасибо! Ваш заказ готовится.',
    uk: 'Дякуємо! Ваше замовлення готується.',
    bg: "Благодарим!",
    de: "Danke!"
  },
  // ── Product Screen ─────────────────────────────────────────
  required: {
    ro: 'Obligatoriu',
    en: 'Required',
    fr: 'Obligatoire',
    hu: 'Kötelező',
    ru: 'Обязательно',
    uk: 'Обов\'язково',
    bg: "Задължително",
    de: "Erforderlich"
  },
  allergens: {
    ro: 'Alergeni',
    en: 'Allergens',
    fr: 'Allergènes',
    hu: 'Allergének',
    ru: 'Аллергены',
    uk: 'Алергени',
    bg: "Алергени",
    de: "Allergene"
  },
  lei: {
    ro: 'lei',
    en: 'RON',
    fr: 'RON',
    hu: 'RON',
    ru: 'лей',
    uk: 'лей',
    bg: "леи",
    de: "LEI"
  },
  // ── Poster / Screensaver ────────────────────────────────────
  start_order: {
    ro: 'Începe comanda',
    en: 'Start order',
    fr: 'Commencer',
    hu: 'Rendelés indítása',
    ru: 'Начать заказ',
    uk: 'Почати замовлення',
    bg: "Старт",
    de: "Starten"
  },
  touch_anywhere: {
    ro: 'Atinge oriunde pe ecran',
    en: 'Touch anywhere on screen',
    fr: 'Touchez l\'écran',
    hu: 'Érintse meg a képernyőt',
    ru: 'Коснитесь экрана',
    uk: 'Торкніться екрана',
    bg: "Докоснете екрана",
    de: "Bildschirm tippen"
  },
  // ── Brand Select ─────────────────────────────────────────────
  choose_brand: {
    ro: 'Alege restaurantul',
    en: 'Choose restaurant',
    fr: 'Choisissez le restaurant',
    hu: 'Válasszon éttermet',
    ru: 'Выберите ресторан',
    uk: 'Оберіть ресторан',
    bg: "Изберете ресторант",
    de: "Restaurant wählen"
  },
  choose_brand_sub: {
    ro: 'Poți comanda de la mai multe restaurante',
    en: 'You can order from multiple restaurants',
    fr: 'Vous pouvez commander dans plusieurs restaurants',
    hu: 'Több étteremből is rendelhet',
    ru: 'Вы можете заказать из нескольких ресторанов',
    uk: 'Ви можете замовити з декількох ресторанів',
    bg: "Може да поръчате от няколко",
    de: "Aus mehreren wählen"
  },
  // ── General ─────────────────────────────────────────────────
  cancel: {
    ro: 'Anulează',
    en: 'Cancel',
    fr: 'Annuler',
    hu: 'Mégsem',
    ru: 'Отмена',
    uk: 'Скасувати',
    bg: "Отказ",
    de: "Abbrechen"
  },
  close: {
    ro: 'Închide',
    en: 'Close',
    fr: 'Fermer',
    hu: 'Bezárás',
    ru: 'Закрыть',
    uk: 'Закрити',
    bg: "Затвори",
    de: "Schließen"
  },
  loading: {
    ro: 'Se încarcă...',
    en: 'Loading...',
    fr: 'Chargement...',
    hu: 'Betöltés...',
    ru: 'Загрузка...',
    uk: 'Завантаження...',
    bg: "Зареждане...",
    de: "Laden..."
  },
  error_loading: {
    ro: 'Eroare la încărcare',
    en: 'Loading error',
    fr: 'Erreur de chargement',
    hu: 'Betöltési hiba',
    ru: 'Ошибка загрузки',
    uk: 'Помилка завантаження',
    bg: "Зареждане...",
    de: "Laden..."
    bg: "Грешка",
    de: "Fehler"
  },
  retry: {
    ro: 'Reîncearcă',
    en: 'Retry',
    fr: 'Réessayer',
    hu: 'Újra',
    ru: 'Повторить',
    uk: 'Повторити',
    bg: "Опитай пак",
    de: "Erneut versuchen"
  },
  added_to_cart: {
    ro: 'Adăugat în coș',
    en: 'Added to cart',
    fr: 'Ajouté au panier',
    hu: 'Kosárba helyezve',
    ru: 'Добавлено',
    uk: 'Додано',
    bg: "Добавено",
    de: "Hinzugefügt"
  },
  // ── Payment Screen (full) ──────────────────────────────────
  payment_card_title: {
    ro: 'Plată cu cardul',
    en: 'Card payment',
    fr: 'Paiement par carte',
    hu: 'Kártyás fizetés',
    ru: 'Оплата картой',
    uk: 'Оплата карткою',
    bg: "Плащане с карта",
    de: "Kartenzahlung"
  },
  payment_card_subtitle: {
    ro: 'Apropiați sau introduceți cardul în terminal',
    en: 'Tap or insert your card at the terminal',
    fr: 'Approchez ou insérez votre carte au terminal',
    hu: 'Érintse meg vagy helyezze be kártyáját a terminálba',
    ru: 'Приложите или вставьте карту в терминал',
    uk: 'Піднесіть або вставте картку в термінал',
    bg: "Доближете картата",
    de: "Karte ans Terminal"
  },
  total_to_pay: {
    ro: 'Total de plată',
    en: 'Total to pay',
    fr: 'Total à payer',
    hu: 'Fizetendő összeg',
    ru: 'Сумма к оплате',
    uk: 'До сплати',
    bg: "Плати",
    de: "Bezahlen"
    bg: "Общо за плащане",
    de: "Zu zahlen"
  },
  payment_step_1: {
    ro: 'Apropiați cardul sau telefonul (contactless)',
    en: 'Tap your card or phone (contactless)',
    fr: 'Approchez votre carte ou téléphone (sans contact)',
    hu: 'Érintse a kártyáját vagy telefonját (érintésmentes)',
    ru: 'Приложите карту или телефон (бесконтактно)',
    uk: 'Піднесіть картку або телефон',
    bg: "Доближете карта/телефон",
    de: "Karte/Telefon vorhalten"
  },
  payment_step_2: {
    ro: 'Sau introduceți cardul și introduceți PIN-ul',
    en: 'Or insert your card and enter PIN',
    fr: 'Ou insérez votre carte et entrez le PIN',
    hu: 'Vagy helyezze be a kártyát és adja meg a PIN-kódot',
    ru: 'Или вставьте карту и введите PIN',
    uk: 'Або вставте картку та введіть PIN',
    bg: "Или въведете ПИН",
    de: "Oder PIN eingeben"
  },
  payment_step_3: {
    ro: 'Așteptați confirmarea pe ecranul terminalului',
    en: 'Wait for confirmation on the terminal screen',
    fr: 'Attendez la confirmation sur l\'écran du terminal',
    hu: 'Várja meg a megerősítést a terminál képernyőjén',
    ru: 'Дождитесь подтверждения на экране терминала',
    uk: 'Дочекайтеся підтвердження на екрані',
    bg: "Изчакайте потвърждение",
    de: "Warte auf Bestätigung"
  },
  simulate_payment: {
    ro: '✅ Simulează plată (DEMO)',
    en: '✅ Simulate payment (DEMO)',
    fr: '✅ Simuler paiement (DÉMO)',
    hu: '✅ Fizetés szimulálása (DEMO)',
    ru: '✅ Симуляция оплаты (ДЕМО)',
    uk: '✅ Симуляція оплати (ДЕМО)',
    bg: "✅ ДЕМО Плащане",
    de: "✅ DEMO Zahlung"
  },
  back_to_cart: {
    ro: '← Înapoi la coș',
    en: '← Back to cart',
    fr: '← Retour au panier',
    hu: '← Vissza a kosárhoz',
    ru: '← Назад к корзине',
    uk: '← Назад до кошика',
    bg: "← Към количката",
    de: "← Zum Warenkorb"
  },
  pos_init: {
    ro: 'Inițializare POS...',
    en: 'Initializing POS...',
    fr: 'Initialisation POS...',
    hu: 'POS inicializálás...',
    ru: 'Инициализация POS...',
    uk: 'Ініціалізація POS...',
    bg: "POS инициализация...",
    de: "POS initialisieren..."
  },
  waiting_payment: {
    ro: 'Așteptăm plata...',
    en: 'Waiting for payment...',
    fr: 'En attente de paiement...',
    hu: 'Fizetésre vár...',
    ru: 'Ожидание оплаты...',
    uk: 'Очікування оплати...',
    bg: "Очаква плащане...",
    de: "Warte auf Zahlung..."
  },
  processing_payment: {
    ro: 'Se procesează...',
    en: 'Processing...',
    fr: 'Traitement en cours...',
    hu: 'Feldolgozás...',
    ru: 'Обработка...',
    uk: 'Обробка...',
    bg: "Обработка...",
    de: "Verarbeitung..."
  },
  // ── Confirmation Screen ─────────────────────────────────────
  payment_success: {
    ro: 'Plata a fost procesată cu succes',
    en: 'Payment successfully processed',
    fr: 'Paiement traité avec succès',
    hu: 'Fizetés sikeresen feldolgozva',
    ru: 'Оплата успешно обработана',
    uk: 'Оплата пройшла успішно',
    bg: "Успешно плащане",
    de: "Zahlung erfolgreich"
  },
  your_order_number: {
    ro: 'NUMĂRUL TĂU DE COMANDĂ',
    en: 'YOUR ORDER NUMBER',
    fr: 'VOTRE NUMÉRO DE COMMANDE',
    hu: 'RENDELÉSSZÁMA',
    ru: 'ВАШ НОМЕР ЗАКАЗА',
    uk: 'ВАШ НОМЕР ЗАМОВЛЕННЯ',
    bg: "Номер",
    de: "Bestellnummer"
    bg: "ВАШИЯТ НОМЕР",
    de: "IHRE NUMMER"
  },
  pickup_at_counter: {
    ro: '🏁 Ridicați comanda la caserie',
    en: '🏁 Pick up your order at the counter',
    fr: '🏁 Récupérez votre commande au comptoir',
    hu: '🏁 Vegye át rendelését a pultnál',
    ru: '🏁 Заберите заказ у кассы',
    uk: '🏁 Заберіть замовлення на касі',
    bg: "🏁 Вземете от касата",
    de: "🏁 Abholen"
  },
  products_count: {
    ro: 'produs',
    en: 'product',
    fr: 'produit',
    hu: 'termék',
    ru: 'товар',
    uk: 'товар',
    bg: "продукт",
    de: "Artikel"
  },
  products_count_many: {
    ro: 'produse',
    en: 'products',
    fr: 'produits',
    hu: 'termék',
    ru: 'товаров',
    uk: 'товари',
    bg: "продукти",
    de: "Artikel"
  },
  paid_by_card: {
    ro: '💳 Plătit cu cardul',
    en: '💳 Paid by card',
    fr: '💳 Payé par carte',
    hu: '💳 Kártyával fizetve',
    ru: '💳 Оплачено картой',
    uk: '💳 Оплачено карткою',
    bg: "💳 Платено",
    de: "💳 Bezahlt"
  },
  confirmed: {
    ro: '✓ Confirmat',
    en: '✓ Confirmed',
    fr: '✓ Confirmé',
    hu: '✓ Megerősítve',
    ru: '✓ Подтверждено',
    uk: '✓ Підтверджено',
    bg: "✓ Потвърдено",
    de: "✓ Bestätigt"
  },
  screen_reset_in: {
    ro: 'Ecranul se va reseta în',
    en: 'Screen will reset in',
    fr: 'L\'écran se réinitialisera dans',
    hu: 'A képernyő visszaáll',
    ru: 'Экран сбросится через',
    uk: 'Екран оновиться через',
    bg: "Рестарт след",
    de: "Neustart in"
  },
  new_order: {
    ro: 'Comandă nouă',
    en: 'New order',
    fr: 'Nouvelle commande',
    hu: 'Új rendelés',
    ru: 'Новый заказ',
    uk: 'Нове замовлення',
    bg: "Нова поръчка",
    de: "Neue Bestellung"
  },
  // ── OrderType subtexts ──────────────────────────────────────
  order_type_subtitle: {
    ro: 'Selectați tipul comenzii — bucătăria pregătește ambalajul corespunzător',
    en: 'Select your order type — the kitchen will prepare the appropriate packaging',
    fr: 'Sélectionnez le type de commande — la cuisine prépare l\'emballage approprié',
    hu: 'Válassza ki a rendelés típusát — a konyha elkészíti a megfelelő csomagolást',
    ru: 'Выберите тип заказа — кухня подготовит соответствующую упаковку',
    uk: 'Оберіть тип замовлення — кухня підготує відповідну упаковку',
    bg: "Изберете тип поръчка",
    de: "Wählen Sie Ihre Option"
  },
  dine_in_sub: {
    ro: 'Serviți în restaurant · Fără ambalaj',
    en: 'Served in restaurant · No packaging',
    fr: 'Servi au restaurant · Sans emballage',
    hu: 'Étteremben felszolgálva · Csomagolás nélkül',
    ru: 'В ресторане · Без упаковки',
    uk: 'У ресторані · Без упаковки',
    bg: "Сервира се в ресторнта",
    de: "Im Restaurant"
  },
  takeaway_sub: {
    ro: 'Ambalat pentru transport',
    en: 'Packaged for takeaway',
    fr: 'Emballé pour emporter',
    hu: 'Csomagolva elvitelre',
    ru: 'Упаковано с собой',
    uk: 'Упаковано з собою',
    bg: "Опаковано",
    de: "Verpackt"
  },
  or: {
    ro: 'sau',
    en: 'or',
    fr: 'ou',
    hu: 'vagy',
    ru: 'или',
    uk: 'або',
    bg: "или",
    de: "oder"
  },
  pickup_note: {
    ro: '🏁 Ridicați comanda la caserie după plată',
    en: '🏁 Pick up your order at the counter after payment',
    fr: '🏁 Récupérez votre commande au comptoir après le paiement',
    hu: '🏁 Vegye át rendelését a pultnál fizetés után',
    ru: '🏁 Заберите заказ у кассы после оплаты',
    uk: '🏁 Заберіть замовлення на касі після оплати',
    bg: "�� Вземете от касата",
    de: "🏁 An der Kasse abholen"
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
