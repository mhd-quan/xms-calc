export const BUSINESS_TYPES: Record<string, { label: string; short: string }> = {
  cafe: { label: 'Quán cà phê - giải khát', short: 'CAFÉ' },
  restaurant: { label: 'Nhà hàng, phòng hội thảo, hội nghị', short: 'F&B' },
  store: { label: 'Cửa hàng, showroom', short: 'RETAIL' },
  gym: { label: 'CLB thể dục, chăm sóc sức khỏe - thẩm mỹ', short: 'FITNESS' },
  entertainment: { label: 'Khu vui chơi, giải trí', short: 'ENTERTAIN' },
  mall: { label: 'Trung tâm thương mại, cao ốc văn phòng', short: 'MALL' },
  supermarket: { label: 'Siêu thị', short: 'SUPERMARKET' }
} as const;

export const DEFAULT_BASE_SALARY = 2340000;
export const ACCOUNT_FEE_YEARLY = 600000;
export const BOX_BUY_PRICE = 2000000;
export const BOX_RENT_YEARLY = 1000000;

export type BusinessType = keyof typeof BUSINESS_TYPES;

type DiscountInput = {
  account?: number;
  box?: number;
  qtg?: number;
  qlq?: number;
};

type DiscountToggleInput = {
  account?: boolean;
  box?: boolean;
  qtg?: boolean;
  qlq?: boolean;
};

export type CalculatorOptionsInput = {
  baseSalary?: number;
  vatRate?: number;
  boxMode?: 'none' | 'buy' | 'rent';
  billingCycle?: 'm' | 'q' | 'y';
  globalBoxCount?: number;
  hasAccountFee?: boolean;
  hasQTG?: boolean;
  hasQLQ?: boolean;
  globalDiscounts?: DiscountInput;
  discountEnabled?: DiscountToggleInput;
};

type NormalizedOptions = {
  baseSalary: number;
  vatRate: number;
  boxMode: 'none' | 'buy' | 'rent';
  billingCycle: 'm' | 'q' | 'y';
  globalBoxCount: number;
  hasAccountFee: boolean;
  hasQTG: boolean;
  hasQLQ: boolean;
  globalDiscounts: {
    account: number;
    box: number;
    qtg: number;
    qlq: number;
  };
  discountEnabled: {
    account: boolean;
    box: boolean;
    qtg: boolean;
    qlq: boolean;
  };
};

export type StoreInput = {
  name: string;
  type: BusinessType | string;
  area: number | string;
  startDate: string;
  endDate: string;
};

export function clampDiscount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function calculateCoef(type: BusinessType | string, area: number): number {
  const a = Number(area) || 0;
  let coef = 0;
  let maxCoef = Infinity;
  if (type === 'cafe') {
    maxCoef = 8;
    if (a <= 15) coef = 0.35;
    else if (a <= 50) coef = 0.35 + (a - 15) * 0.04;
    else coef = 0.35 + 35 * 0.04 + (a - 50) * 0.02;
  } else if (type === 'restaurant') {
    maxCoef = 8;
    if (a <= 50) coef = 2.0;
    else if (a <= 100) coef = 2.0 + (a - 50) * 0.05;
    else coef = 2.0 + 50 * 0.05 + (a - 100) * 0.03;
  } else if (type === 'store') {
    maxCoef = 5;
    if (a <= 50) coef = 0.35;
    else if (a <= 100) coef = 0.35 + (a - 50) * 0.008;
    else coef = 0.35 + 50 * 0.008 + (a - 100) * 0.006;
  } else if (type === 'gym') {
    maxCoef = 10;
    if (a <= 50) coef = 0.5;
    else if (a <= 100) coef = 0.5 + (a - 50) * 0.011;
    else coef = 0.5 + 50 * 0.011 + (a - 100) * 0.009;
  } else if (type === 'entertainment') {
    maxCoef = 12;
    if (a <= 200) coef = 0.7;
    else if (a <= 500) coef = 0.7 + (a - 200) * 0.003;
    else coef = 0.7 + 300 * 0.003 + (a - 500) * 0.001;
  } else if (type === 'mall') {
    maxCoef = 50;
    if (a <= 200) coef = 1.5;
    else if (a <= 500) coef = 1.5 + (a - 200) * 0.003;
    else coef = 1.5 + 300 * 0.003 + (a - 500) * 0.002;
  } else if (type === 'supermarket') {
    maxCoef = 10;
    if (a <= 500) coef = 1.25;
    else if (a <= 1000) coef = 1.25 + (a - 500) * 0.003;
    else coef = 1.25 + 500 * 0.003 + (a - 1000) * 0.002;
  }
  return Math.min(coef, maxCoef);
}

function parseLocalDate(ymd: string): Date | null {
  if (!ymd) return null;
  const parts = String(ymd).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [year, month, day] = parts as [number, number, number];
  return new Date(year, month - 1, day);
}

export function calculateDurationMonths(start: string, end: string): number {
  const d1 = parseLocalDate(start);
  const d2 = parseLocalDate(end);
  if (!d1 || !d2 || d2 < d1) return 0;
  const totalMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  let tempDate = new Date(d1);
  tempDate.setMonth(tempDate.getMonth() + totalMonths);
  let fullMonths = totalMonths;
  if (tempDate > d2) {
    fullMonths -= 1;
    tempDate = new Date(d1);
    tempDate.setMonth(tempDate.getMonth() + fullMonths);
  }
  const diffTime = d2.getTime() - tempDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  let fraction = 0;
  if (diffDays <= 7) fraction = 0;
  else if (diffDays >= 8 && diffDays <= 17) fraction = 0.5;
  else if (diffDays >= 18) fraction = 1.0;
  return fullMonths + fraction;
}

function normalizeOptions(options: CalculatorOptionsInput = {}): NormalizedOptions {
  const discounts = options.globalDiscounts || {};
  const discountEnabled = options.discountEnabled || {};
  const billingCycle = options.billingCycle === 'm' || options.billingCycle === 'q' ? options.billingCycle : 'y';
  return {
    baseSalary: Number(options.baseSalary) || DEFAULT_BASE_SALARY,
    vatRate: Number(options.vatRate) || 0,
    boxMode: options.boxMode || 'none',
    billingCycle,
    globalBoxCount: Math.max(1, Number(options.globalBoxCount) || 1),
    hasAccountFee: options.hasAccountFee !== false,
    hasQTG: options.hasQTG !== false,
    hasQLQ: options.hasQLQ !== false,
    globalDiscounts: {
      account: clampDiscount(discounts.account),
      box: clampDiscount(discounts.box),
      qtg: clampDiscount(discounts.qtg),
      qlq: clampDiscount(discounts.qlq)
    },
    discountEnabled: {
      account: discountEnabled.account === true,
      box: discountEnabled.box === true,
      qtg: discountEnabled.qtg === true,
      qlq: discountEnabled.qlq === true
    }
  };
}

function effectiveDiscount(opts: NormalizedOptions, key: keyof NormalizedOptions['globalDiscounts']): number {
  return opts.discountEnabled[key] ? opts.globalDiscounts[key] : 0;
}

export function calculateStoreBreakdown(store: StoreInput, options: CalculatorOptionsInput = {}) {
  const opts = normalizeOptions(options);
  const area = Number(store.area) || 0;
  const duration = calculateDurationMonths(store.startDate, store.endDate);
  const coef = calculateCoef(store.type, area);
  const yearly = coef * opts.baseSalary;
  const periodBase = (yearly / 12) * duration;

  const qtgAmountOriginal = opts.hasQTG ? periodBase : 0;
  const qlqAmountOriginal = opts.hasQLQ ? periodBase : 0;
  const accountAmountOriginal = opts.hasAccountFee ? (ACCOUNT_FEE_YEARLY / 12) * duration : 0;

  const qtgAmount = qtgAmountOriginal * (1 - effectiveDiscount(opts, 'qtg') / 100);
  const qlqAmount = qlqAmountOriginal * (1 - effectiveDiscount(opts, 'qlq') / 100);
  const accountAmount = accountAmountOriginal * (1 - effectiveDiscount(opts, 'account') / 100);

  let boxAmount = 0;
  let boxAmountOriginal = 0;
  if (opts.boxMode === 'buy') {
    boxAmountOriginal = BOX_BUY_PRICE * opts.globalBoxCount;
    boxAmount = boxAmountOriginal * (1 - effectiveDiscount(opts, 'box') / 100);
  } else if (opts.boxMode === 'rent') {
    boxAmountOriginal = (BOX_RENT_YEARLY / 12) * duration * opts.globalBoxCount;
    boxAmount = boxAmountOriginal;
  }

  const total = qtgAmount + qlqAmount + accountAmount + boxAmount;
  const totalOriginal = qtgAmountOriginal + qlqAmountOriginal + accountAmountOriginal + boxAmountOriginal;
  return {
    name: store.name,
    type: store.type,
    area,
    duration,
    coef,
    yearly,
    periodBase,
    qtgAmount,
    qtgAmountOriginal,
    qlqAmount,
    qlqAmountOriginal,
    accountAmount,
    accountAmountOriginal,
    boxAmount,
    boxAmountOriginal,
    total,
    totalOriginal
  };
}

export function calculateTotals(stores: StoreInput[], options: CalculatorOptionsInput = {}) {
  const opts = normalizeOptions(options);
  const storeBreakdowns = stores.map((store) => calculateStoreBreakdown(store, opts));
  type Totals = {
    subtotalQTG: number;
    subtotalQTGOriginal: number;
    subtotalQLQ: number;
    subtotalQLQOriginal: number;
    subtotalAccount: number;
    subtotalAccountOriginal: number;
    subtotalBox: number;
    subtotalBoxOriginal: number;
    subtotal: number;
    subtotalOriginal: number;
    vatRate: number;
    vat: number;
    vatOriginal: number;
    grand: number;
    grandOriginal: number;
  };
  const totals = storeBreakdowns.reduce(
    (acc: Totals, s) => {
      acc.subtotalQTG += s.qtgAmount;
      acc.subtotalQTGOriginal += s.qtgAmountOriginal;
      acc.subtotalQLQ += s.qlqAmount;
      acc.subtotalQLQOriginal += s.qlqAmountOriginal;
      acc.subtotalAccount += s.accountAmount;
      acc.subtotalAccountOriginal += s.accountAmountOriginal;
      acc.subtotalBox += s.boxAmount;
      acc.subtotalBoxOriginal += s.boxAmountOriginal;
      return acc;
    },
    {
      subtotalQTG: 0,
      subtotalQTGOriginal: 0,
      subtotalQLQ: 0,
      subtotalQLQOriginal: 0,
      subtotalAccount: 0,
      subtotalAccountOriginal: 0,
      subtotalBox: 0,
      subtotalBoxOriginal: 0,
      subtotal: 0,
      subtotalOriginal: 0,
      vatRate: 0,
      vat: 0,
      vatOriginal: 0,
      grand: 0,
      grandOriginal: 0
    }
  );
  totals.subtotal = totals.subtotalQTG + totals.subtotalQLQ + totals.subtotalAccount + totals.subtotalBox;
  totals.subtotalOriginal =
    totals.subtotalQTGOriginal + totals.subtotalQLQOriginal + totals.subtotalAccountOriginal + totals.subtotalBoxOriginal;
  totals.vatRate = opts.vatRate;
  totals.vat = totals.subtotal * opts.vatRate;
  totals.vatOriginal = totals.subtotalOriginal * opts.vatRate;
  totals.grand = totals.subtotal + totals.vat;
  totals.grandOriginal = totals.subtotalOriginal + totals.vatOriginal;
  return { stores: storeBreakdowns, totals };
}
