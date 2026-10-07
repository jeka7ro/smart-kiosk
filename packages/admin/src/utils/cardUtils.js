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
      // Visa
      '401047', '404169', '406325', '411550', '411580', '412345', '414049', '414050',
      '416805', '424453', '425301', '425302', '425303', '425603', '427010', '438829',
      '438830', '438877', '439479', '454793', '454799', '466286', '474453', '491212',
      '491517', '492026', '492027', '492125', '492750',
      // Mastercard
      '516805', '516806', '516807', '516808', '516809', '516834', '522137', '522138',
      '522139', '525287', '525288', '525289', '535451', '535452', '535453', '535454',
      '535493', '535494', '541234', '542154', '542155', '542156', '545627', '545628',
      '546805', '557887', '557888', '557889'
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
      // Visa
      '400109', '402360', '402361', '416597', '416598', '416599', '424578', '439364', 
      '453982', '453983', '453984', '454313', '459654', '459655', '475127', '475128', '475129',
      // Mastercard
      '516793', '516794', '516886', '516999', '521873', '524276', '527347', '527348',
      '528994', '528995', '535178', '535179', '535180', '535456', '535457', '535458',
      '535558', '535559', '535560', '537249', '537426', '537427', '537428', '539123',
      '539124', '539587', '539588', '547127', '547128', '547129', '557376', '557377', '557378'
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
      // Visa
      '404093', '404094', '404095', '405367', '405368', '416550', '416551', '425602',
      '460953', '460954', '470876', '470877', '485704', '485705', '486703', '486704', '486924',
      // Mastercard
      '516812', '516813', '516814', '520042', '520043', '525211', '525212', '535034',
      '535035', '535036', '540812', '540813', '546876', '546877', '546878', '557812'
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
      // Visa
      '405230', '406560', '409400', '409401', '414210', '425880', '425881', '425882',
      '425883', '425884', '425885', '439075', '439076', '477161', '477162', '477899', '477900',
      // Mastercard
      '511472', '511473', '516700', '516701', '516708', '516709', '516710', '516711',
      '522858', '525200', '525201', '528723', '532908', '532909', '535818', '535819',
      '535820', '545619', '545620', '545621', '550251', '550252'
    ],
    keywords: ['bcr', 'erste', 'banca comerciala', 'george']
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
      // Visa
      '403600', '403601', '425310', '425311', '438955', '438956', '439486', '439487',
      '453903', '453904', '454728', '478144', '478145',
      // Mastercard
      '516800', '516801', '516802', '516803', '525220', '525221', '525222', '528701',
      '535030', '535031', '541232', '541233', '546800', '557800'
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
      // Visa
      '400086', '400087', '425340', '438960', '454730',
      // Mastercard
      '516840', '525240', '529912', '535040', '542577', '542578', '544331', '544332',
      '544396', '544584', '544585', '544691', '545387', '545593', '554593'
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
      // Visa
      '404170', '404171', '423400', '423401', '423463', '423464', '423465', '425320',
      '425321', '442845', '442846', '462217', '492040',
      // Mastercard
      '516900', '516901', '516902', '516903', '525230', '525231', '535032', '535033',
      '541240', '541615', '546900', '557900'
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
      // Visa
      '425330', '425331', '438880', '439490', '478150',
      // Mastercard
      '516750', '516751', '525250', '535050', '535051', '541250', '541251', '546750', '557750'
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
      '425370', '438970', '525270', '532619', '532620', '541818', '548509'
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
      '515548', '515549', '520092', '528751', '534973', '534974', '545648'
    ],
    keywords: ['salt', 'salt bank', 'idea bank']
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
      '460116', '460117', '460738', '465858', '465859', '467459', '491650',
      '516860', '525260', '535060', '541260'
    ],
    keywords: ['libra', 'libra bank']
  },
  alpha: {
    id: 'alpha',
    name: 'Alpha Bank',
    shortName: 'Alpha',
    color: '#002f6c',
    textColor: '#1e3a8a',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-400',
    ring: 'ring-blue-400/40',
    gradient: 'from-blue-700 to-indigo-800',
    logoText: 'ALPHA',
    bins: [
      '404180', '425350', '438980', '454740', '516850', '525255', '535055', '541255', '546850'
    ],
    keywords: ['alpha', 'alpha bank']
  },
  otp: {
    id: 'otp',
    name: 'OTP Bank',
    shortName: 'OTP',
    color: '#16a34a',
    textColor: '#15803d',
    badgeBg: 'bg-green-500/15',
    badgeText: 'text-green-800 dark:text-green-300',
    border: 'border-green-400',
    ring: 'ring-green-400/40',
    gradient: 'from-green-600 to-emerald-700',
    logoText: 'OTP',
    bins: [
      '404190', '425360', '438990', '516870', '525265', '535065', '541265'
    ],
    keywords: ['otp', 'otp bank']
  },
  first: {
    id: 'first',
    name: 'First Bank',
    shortName: 'First',
    color: '#2563eb',
    textColor: '#1d4ed8',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-400',
    ring: 'ring-blue-400/40',
    gradient: 'from-blue-600 to-cyan-600',
    logoText: 'FIRST',
    bins: [
      '404150', '425380', '516880', '525275', '535075'
    ],
    keywords: ['first bank', 'piraeus']
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
      '535521', '539126', '539127', '539128', '542168', '546452', '548888', '552631'
    ],
    keywords: ['edenred', 'sodexo', 'pluxee', 'cheque dejeuner', 'up romania', 'tichete', 'masa']
  },
  other: {
    id: 'other',
    name: 'Alte Carduri (Mastercard / Visa)',
    shortName: 'Alte Carduri',
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

  // 3. Verificare BIN curată de la începutul cardului
  const noSpaces = cardNo.replace(/\s+/g, '');
  if (noSpaces.startsWith('4')) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(noSpaces)) return 'mastercard';
  if (/^(50|5[6-8]|6)/.test(noSpaces)) return 'maestro';

  const cleanNum = cardNo.replace(/\D/g, '');
  if (cleanNum.startsWith('4')) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(cleanNum)) return 'mastercard';
  if (/^(50|5[6-8]|6)/.test(cleanNum)) return 'maestro';

  return 'visa';
}

/**
 * Detectează banca emitentă a cardului (BT, Revolut, ING, BCR, Raiffeisen, UniCredit, etc.)
 * Se bazează pe:
 * 1. Numele explicit sau cuvinte cheie transmise de POS în metadate
 * 2. BIN-ul din primele 6 cifre de la începutul cardului comparat cu catalogul extins de bănci
 * 3. Fallback pe Alte Carduri (Mastercard / Visa) dacă seria nu este mapată la o bancă din România
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
  if (combinedMeta.includes('alpha bank') || combinedMeta.includes('alpha')) return BANK_CONFIG.alpha;
  if (combinedMeta.includes('otp bank') || combinedMeta.includes('otp')) return BANK_CONFIG.otp;
  if (combinedMeta.includes('first bank') || combinedMeta.includes('piraeus')) return BANK_CONFIG.first;
  if (combinedMeta.includes('edenred') || combinedMeta.includes('sodexo') || combinedMeta.includes('pluxee') || combinedMeta.includes('up dejeuner') || combinedMeta.includes('cheque dejeuner') || combinedMeta.includes('tichete')) return BANK_CONFIG.meal_vouchers;

  // 2. Verificare BIN curată de la începutul cardului (primele 6 cifre)
  // Exemplu cardNo: "516805******1234" sau "5168 05** **** 1234"
  const noSpaces = cardNo.replace(/\s+/g, '');
  const match6 = noSpaces.match(/^(\d{6})/);
  if (match6) {
    const bin6 = match6[1];
    const bankOrder = [
      'bt', 'revolut', 'ing', 'bcr', 'raiffeisen', 'unicredit', 
      'brd', 'cec', 'salt', 'libra', 'patria', 'alpha', 'otp', 'first',
      'meal_vouchers'
    ];
    for (const key of bankOrder) {
      if (BANK_CONFIG[key]?.bins?.includes(bin6)) return BANK_CONFIG[key];
    }
  }

  // 3. Toate celelalte carduri sunt grupate curat la Alte Carduri (fără duplicate de "Card Internațional")
  return BANK_CONFIG.other;
}
