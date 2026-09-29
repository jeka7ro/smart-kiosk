/**
 * Utilitare de detectare și mapare Card Bancar & Bancă Emitentă
 * Folosit atât în Dashboard (grafice statistice 3D) cât și în Jurnal POS (PosLogs).
 */

export const BANK_CONFIG = {
  bt: {
    id: 'bt',
    name: 'Banca Transilvania',
    shortName: 'BT',
    color: '#eab308', // Warm Amber / BT Gold
    textColor: '#854d0e',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-400',
    ring: 'ring-amber-400/40',
    gradient: 'from-amber-500 to-yellow-600',
    logoText: 'BT',
    bins: [
      '401047', '404169', '411550', '411580', '412345', '414049', '424453', '425301', 
      '425302', '425303', '425603', '438829', '438877', '439479', '454793', '454799', 
      '466286', '491212', '491517', '492026', '492027', '492125', '492750', '516805', 
      '525287', '535451', '541234', '542154', '546805', '557887'
    ],
    keywords: ['banca transilvania', 'transilvania', 'bt24', 'btrl', 'bt']
  },
  revolut: {
    id: 'revolut',
    name: 'Revolut',
    shortName: 'Revolut',
    color: '#0075eb', // Electric Revolut Blue
    textColor: '#1d4ed8',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-400',
    ring: 'ring-blue-400/40',
    gradient: 'from-blue-600 to-cyan-600',
    logoText: 'R',
    bins: [
      '402360', '416598', '424578', '453982', '459654', '475127', '516793', '516794', 
      '516886', '516999', '524276', '527347', '535178', '535179', '535456', '535558', 
      '537249', '537426', '539123', '539587', '547127', '557376'
    ],
    keywords: ['revolut', 'revo']
  },
  ing: {
    id: 'ing',
    name: 'ING Bank',
    shortName: 'ING',
    color: '#ff6200', // Iconic ING Orange
    textColor: '#c2410c',
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-400',
    ring: 'ring-orange-400/40',
    gradient: 'from-orange-500 to-amber-600',
    logoText: 'ING',
    bins: [
      '404093', '404094', '405367', '416550', '425602', '460953', '470876', '485704', 
      '486703', '486924', '516812', '525211', '535034', '540812', '546876'
    ],
    keywords: ['ing', 'ing bank']
  },
  bcr: {
    id: 'bcr',
    name: 'BCR (Erste)',
    shortName: 'BCR',
    color: '#0284c7', // Sky / Erste Blue
    textColor: '#0369a1',
    badgeBg: 'bg-sky-500/15',
    badgeText: 'text-sky-800 dark:text-sky-300',
    border: 'border-sky-400',
    ring: 'ring-sky-400/40',
    gradient: 'from-sky-500 to-blue-600',
    logoText: 'BCR',
    bins: [
      '409400', '425883', '439075', '477161', '477899', '511472', '516708', '516709', 
      '525200', '532908', '535819', '545620', '550251'
    ],
    keywords: ['bcr', 'erste', 'banca comerciala']
  },
  raiffeisen: {
    id: 'raiffeisen',
    name: 'Raiffeisen Bank',
    shortName: 'Raiffeisen',
    color: '#ca8a04', // Raiffeisen Yellow/Black
    textColor: '#854d0e',
    badgeBg: 'bg-yellow-500/15',
    badgeText: 'text-yellow-800 dark:text-yellow-300',
    border: 'border-yellow-400',
    ring: 'ring-yellow-400/40',
    gradient: 'from-yellow-500 to-amber-600',
    logoText: 'RB',
    bins: [
      '403600', '425310', '438955', '439486', '516800', '525220', '535030', '541232'
    ],
    keywords: ['raiffeisen', 'rzb', 'raif']
  },
  unicredit: {
    id: 'unicredit',
    name: 'UniCredit Bank',
    shortName: 'UniCredit',
    color: '#e2001a', // UniCredit Red
    textColor: '#991b1b',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-800 dark:text-red-300',
    border: 'border-red-400',
    ring: 'ring-red-400/40',
    gradient: 'from-red-600 to-rose-700',
    logoText: 'UCB',
    bins: [
      '400086', '529912', '542577', '544331', '544396', '544584', '544691', '545387', 
      '545593', '554593'
    ],
    keywords: ['unicredit', 'ucb', 'tiriac', 'hvb']
  },
  brd: {
    id: 'brd',
    name: 'BRD (SocGen)',
    shortName: 'BRD',
    color: '#dc2626', // BRD Red/Black
    textColor: '#991b1b',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-800 dark:text-red-300',
    border: 'border-red-400',
    ring: 'ring-red-400/40',
    gradient: 'from-red-600 to-rose-700',
    logoText: 'BRD',
    bins: [
      '404170', '423400', '423463', '423464', '425320', '442845', '516900', '535032'
    ],
    keywords: ['brd', 'societe generale']
  },
  cec: {
    id: 'cec',
    name: 'CEC Bank',
    shortName: 'CEC',
    color: '#004710', // Forest Green
    textColor: '#065f46',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-400',
    ring: 'ring-emerald-400/40',
    gradient: 'from-emerald-600 to-teal-700',
    logoText: 'CEC',
    bins: [
      '425330', '516750', '535050', '541250'
    ],
    keywords: ['cec', 'cec bank']
  },
  patria: {
    id: 'patria',
    name: 'Patria Bank',
    shortName: 'Patria',
    color: '#002e6d', // Deep Navy
    textColor: '#1e3a8a',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
    border: 'border-indigo-400',
    ring: 'ring-indigo-400/40',
    gradient: 'from-indigo-600 to-blue-700',
    logoText: 'PAT',
    bins: [
      '548508', '532619', '541818', '541615'
    ],
    keywords: ['patria', 'patria bank', 'carpatica']
  },
  salt: {
    id: 'salt',
    name: 'Salt Bank',
    shortName: 'Salt Bank',
    color: '#059669', // Bright Emerald/Mint
    textColor: '#065f46',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-400',
    ring: 'ring-emerald-400/40',
    gradient: 'from-emerald-500 to-teal-600',
    logoText: 'SALT',
    bins: [
      '515548', '534973'
    ],
    keywords: ['salt', 'salt bank']
  },
  libra: {
    id: 'libra',
    name: 'Libra Bank',
    shortName: 'Libra',
    color: '#0369a1', // Steel Blue
    textColor: '#075985',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-800 dark:text-cyan-300',
    border: 'border-cyan-400',
    ring: 'ring-cyan-400/40',
    gradient: 'from-cyan-600 to-blue-700',
    logoText: 'LIB',
    bins: [
      '460116', '460738', '465858', '467459', '491650'
    ],
    keywords: ['libra', 'libra bank']
  },
  meal_vouchers: {
    id: 'meal_vouchers',
    name: 'Card Masă (Tichete)',
    shortName: 'Tichete Masă',
    color: '#ea580c', // Bright Orange
    textColor: '#9a3412',
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-400',
    ring: 'ring-orange-400/40',
    gradient: 'from-orange-500 to-amber-600',
    logoText: '🍽️',
    bins: [
      '516738', '530865', '535490', '535491', '535492', '535515', '535516', '535520', 
      '535521', '539126', '542168', '546452', '548888', '552631'
    ],
    keywords: ['edenred', 'sodexo', 'pluxee', 'cheque dejeuner', 'up romania', 'tichete', 'masa']
  },
  international: {
    id: 'international',
    name: 'Card Internațional',
    shortName: 'Internațional',
    color: '#2563eb', // Royal Blue
    textColor: '#1e40af',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-400',
    ring: 'ring-blue-400/40',
    gradient: 'from-blue-600 to-indigo-600',
    logoText: '🌐',
    bins: [
      '401355', '404801', '412757', '413054', '427692', '430455', '432607', '432921', 
      '435720', '435779', '435784', '447964', '453835', '461018', '472815'
    ],
    keywords: ['international', 'foreign', 'us bank', 'chase', 'wise', 'n26', 'abroad']
  },
  other: {
    id: 'other',
    name: 'Card Mascat / Neidentificat',
    shortName: 'Neidentificat',
    color: '#64748b', // Slate
    textColor: '#475569',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-800 dark:text-slate-300',
    border: 'border-slate-400',
    ring: 'ring-slate-400/40',
    gradient: 'from-slate-500 to-slate-700',
    logoText: '💳',
    bins: [],
    keywords: []
  }
};

/**
 * Detectează emisorul cardului bancar (Visa vs Mastercard vs Maestro)
 */
export function detectCardBrand(item) {
  if (!item) return 'visa';
  const pRef = item.paymentRef;
  const cardNo = String(pRef?.cardNo || pRef?.pan || item.cardNo || item.card_no || item.pan || '').trim();
  const extra = pRef?.extraFields || item.raw?.extraFields || [];
  const extraStr = (Array.isArray(extra) ? extra.join(' ') : String(extra)).toLowerCase();
  const rawStr = (typeof pRef?.raw === 'object' ? JSON.stringify(pRef.raw) : String(pRef?.raw || item.raw || '')).toLowerCase();

  // 1. Câmpuri explicite salvate de POS
  const explicit = (pRef?.brand || pRef?.cardBrand || item.cardBrand || item.brand || '').toLowerCase();
  if (explicit.includes('master') || explicit.includes('mc')) return 'mastercard';
  if (explicit.includes('visa')) return 'visa';
  if (explicit.includes('maestro')) return 'maestro';

  // 2. Extra fields sau payload brut emis de Verifone / Viva POS
  if (extraStr.includes('mastercard') || extraStr.includes('cl mc') || extraStr.includes(' mc ')) return 'mastercard';
  if (extraStr.includes('visa') || extraStr.includes('cl visa')) return 'visa';
  if (extraStr.includes('maestro')) return 'maestro';
  if (rawStr.includes('mastercard') || rawStr.includes('cl mc')) return 'mastercard';
  if (rawStr.includes('visa') || rawStr.includes('cl visa')) return 'visa';
  if (rawStr.includes('maestro')) return 'maestro';

  // 3. Verificare BIN (4 = Visa; 51-55 sau 22-27 = Mastercard; 50/56-58/6 = Maestro)
  const cleanNum = cardNo.replace(/\D/g, '');
  if (cleanNum.startsWith('4')) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(cleanNum)) return 'mastercard';
  if (/^(50|5[6-8]|6)/.test(cleanNum)) return 'maestro';
  if (cardNo.startsWith('4')) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(cardNo)) return 'mastercard';
  if (/^(50|5[6-8]|6)/.test(cardNo)) return 'maestro';

  return 'visa';
}

/**
 * Detectează banca emitentă a cardului (BT, Revolut, ING, BCR, Raiffeisen, UniCredit, etc.)
 * Se bazează pe:
 * 1. Numele explicit transmis de POS în metadate
 * 2. BIN-ul din primele 6 cifre comparat cu catalogul extins de bănci
 * 3. Fallback inteligent pentru carduri internaționale (Visa / Mastercard internațional)
 */
export function detectCardBank(item) {
  if (!item) return BANK_CONFIG.other;
  const pRef = item.paymentRef;
  const cardNo = String(pRef?.cardNo || pRef?.pan || item.cardNo || item.card_no || item.pan || '').trim();
  const extra = pRef?.extraFields || item.raw?.extraFields || [];
  const extraStr = (Array.isArray(extra) ? extra.join(' ') : String(extra)).toLowerCase();
  const rawStr = (typeof pRef?.raw === 'object' ? JSON.stringify(pRef.raw) : String(pRef?.raw || item.raw || '')).toLowerCase();
  const combinedMeta = `${extraStr} ${rawStr} ${item.paymentDetails || ''} ${item.bank || ''}`.toLowerCase();

  // 1. Căutare explicită în metadatele transmise de POS
  if (combinedMeta.includes('revolut') || combinedMeta.includes('revo')) return BANK_CONFIG.revolut;
  if (combinedMeta.includes('transilvania') || combinedMeta.includes(' bt ') || combinedMeta.includes('btrl')) return BANK_CONFIG.bt;
  if (combinedMeta.includes('ing bank') || combinedMeta.includes(' ing ')) return BANK_CONFIG.ing;
  if (combinedMeta.includes('bcr') || combinedMeta.includes('erste') || combinedMeta.includes('banca comerciala')) return BANK_CONFIG.bcr;
  if (combinedMeta.includes('raiffeisen') || combinedMeta.includes('rzb') || combinedMeta.includes('raif')) return BANK_CONFIG.raiffeisen;
  if (combinedMeta.includes('unicredit') || combinedMeta.includes('ucb') || combinedMeta.includes('tiriac') || combinedMeta.includes('hvb')) return BANK_CONFIG.unicredit;
  if (combinedMeta.includes('brd') || combinedMeta.includes('societe generale')) return BANK_CONFIG.brd;
  if (combinedMeta.includes('cec') || combinedMeta.includes('cec bank')) return BANK_CONFIG.cec;
  if (combinedMeta.includes('patria') || combinedMeta.includes('carpatica')) return BANK_CONFIG.patria;
  if (combinedMeta.includes('salt bank') || combinedMeta.includes('salt')) return BANK_CONFIG.salt;
  if (combinedMeta.includes('libra') || combinedMeta.includes('libra bank')) return BANK_CONFIG.libra;
  if (combinedMeta.includes('edenred') || combinedMeta.includes('sodexo') || combinedMeta.includes('pluxee') || combinedMeta.includes('up dejeuner') || combinedMeta.includes('cheque dejeuner') || combinedMeta.includes('tichete')) return BANK_CONFIG.meal_vouchers;

  // 2. Verificare BIN (primele 6 cifre) împotriva catalogului oficial extins
  const cleanNum = cardNo.replace(/\D/g, '');
  if (cleanNum.length >= 6) {
    const bin6 = cleanNum.slice(0, 6);
    const bankOrder = [
      'bt', 'revolut', 'ing', 'bcr', 'raiffeisen', 'unicredit', 
      'brd', 'cec', 'patria', 'salt', 'libra', 'meal_vouchers', 'international'
    ];
    for (const key of bankOrder) {
      if (BANK_CONFIG[key]?.bins?.includes(bin6)) return BANK_CONFIG[key];
    }

    // 3. Fallback inteligent: Dacă BIN-ul are 6 cifre și este Visa sau Mastercard valid,
    // dar nu aparține băncilor din România de mai sus -> Card Internațional
    if (cleanNum.startsWith('4') || /^(5[1-5]|2[2-7])/.test(cleanNum) || /^(50|5[6-8]|6)/.test(cleanNum)) {
      return BANK_CONFIG.international;
    }
  }

  // 4. Doar dacă nu avem cifre suficiente pentru identificare
  return BANK_CONFIG.other;
}
