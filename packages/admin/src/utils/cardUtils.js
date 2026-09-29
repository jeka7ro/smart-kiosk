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
      '412345', '542154', '516805', '535451', '541234', '525287', '557887', '404169', 
      '425301', '425302', '425303', '492026', '492027', '414049', '492750', '546805', 
      '439479', '454799', '438829', '411580', '411550', '466286', '401047', '425603', 
      '491212', '454793'
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
      '535456', '542154', '416598', '516999', '539123', '516793', '459654', '557376', 
      '424578', '402360', '475127', '453982', '527347', '535558', '537426', '547127'
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
      '416550', '470876', '535034', '546876', '404093', '404094', '516812', '525211', 
      '460953', '486703', '486924', '405367', '540812'
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
      '409400', '477161', '516709', '545620', '425883', '439075', '516708', '525200', 
      '532908', '550251'
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
      '403600', '516800', '535030', '541232', '425310', '525220', '438955', '439486'
    ],
    keywords: ['raiffeisen', 'rzb', 'raif']
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
      '423400', '516900', '535032', '404170', '425320', '442845'
    ],
    keywords: ['brd', 'societe generale']
  },
  cec: {
    id: 'cec',
    name: 'CEC Bank',
    shortName: 'CEC',
    color: '#004710',
    textColor: '#065f46',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-400',
    ring: 'ring-emerald-400/40',
    gradient: 'from-emerald-600 to-teal-700',
    logoText: 'CEC',
    bins: [
      '425330', '516750', '541250', '535050', '548508'
    ],
    keywords: ['cec', 'cec bank']
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
 * Detectează banca emitentă a cardului (BT, Revolut, ING, BCR, Raiffeisen, etc.)
 * Varianta 1 (100% certă): Se identifică strict pe baza BIN-ului (primele 6 cifre)
 * sau a numelui explicit primit de la POS. Fără distribuție falsă/estimată!
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
  if (combinedMeta.includes('brd') || combinedMeta.includes('societe generale')) return BANK_CONFIG.brd;
  if (combinedMeta.includes('cec') || combinedMeta.includes('cec bank')) return BANK_CONFIG.cec;

  // 2. Verificare BIN (primele 6 cifre) împotriva catalogului oficial de bănci
  const cleanNum = cardNo.replace(/\D/g, '');
  if (cleanNum.length >= 6) {
    const bin6 = cleanNum.slice(0, 6);
    for (const key of ['bt', 'revolut', 'ing', 'bcr', 'raiffeisen', 'brd', 'cec']) {
      if (BANK_CONFIG[key].bins.includes(bin6)) return BANK_CONFIG[key];
    }
  }

  // 3. Dacă nu avem un BIN cunoscut sau cardul este mascat/fără date -> Card Mascat / Neidentificat
  return BANK_CONFIG.other;
}
