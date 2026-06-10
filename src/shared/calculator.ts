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
export const ACCOUNT_FEE_STANDALONE_YEARLY = 1500000;
export const WEBSITE_PLATFORM_FEE_ONCE = 600000;
export const PC_APP_PLATFORM_FEE_ONCE = 800000;
export const BOX_BUY_PRICE = 2000000;
export const BOX_RENT_YEARLY = 900000;
export const DURATION_ROUNDING_POLICY = {
  zeroMonthMaxDays: 7,
  halfMonthMinDays: 8,
  halfMonthMaxDays: 17,
  fullMonthMinDays: 18
} as const;

export type BusinessType =
  | 'cafe'
  | 'restaurant'
  | 'store'
  | 'gym'
  | 'entertainment'
  | 'mall'
  | 'supermarket';

export type PricingIncrement = {
  above: number;
  upTo: number | null;
  rate: number;
};

export type BusinessPricingPolicy = {
  base: {
    upTo: number;
    coefficient: number;
  };
  increments: [PricingIncrement, PricingIncrement];
  maxCoef: number;
};

export const BUSINESS_PRICING_POLICIES: Record<BusinessType, BusinessPricingPolicy> = {
  cafe: {
    base: { upTo: 15, coefficient: 0.35 },
    increments: [
      { above: 15, upTo: 50, rate: 0.04 },
      { above: 50, upTo: null, rate: 0.02 }
    ],
    maxCoef: 8
  },
  restaurant: {
    base: { upTo: 50, coefficient: 2 },
    increments: [
      { above: 50, upTo: 100, rate: 0.05 },
      { above: 100, upTo: null, rate: 0.03 }
    ],
    maxCoef: 8
  },
  store: {
    base: { upTo: 50, coefficient: 0.35 },
    increments: [
      { above: 50, upTo: 100, rate: 0.008 },
      { above: 100, upTo: null, rate: 0.006 }
    ],
    maxCoef: 5
  },
  gym: {
    base: { upTo: 50, coefficient: 0.5 },
    increments: [
      { above: 50, upTo: 100, rate: 0.011 },
      { above: 100, upTo: null, rate: 0.009 }
    ],
    maxCoef: 10
  },
  entertainment: {
    base: { upTo: 200, coefficient: 0.7 },
    increments: [
      { above: 200, upTo: 500, rate: 0.003 },
      { above: 500, upTo: null, rate: 0.001 }
    ],
    maxCoef: 12
  },
  mall: {
    base: { upTo: 200, coefficient: 1.5 },
    increments: [
      { above: 200, upTo: 500, rate: 0.003 },
      { above: 500, upTo: null, rate: 0.002 }
    ],
    maxCoef: 50
  },
  supermarket: {
    base: { upTo: 500, coefficient: 1.25 },
    increments: [
      { above: 500, upTo: 1000, rate: 0.003 },
      { above: 1000, upTo: null, rate: 0.002 }
    ],
    maxCoef: 10
  }
};

function isBusinessType(value: string): value is BusinessType {
  return Object.prototype.hasOwnProperty.call(BUSINESS_PRICING_POLICIES, value);
}

export function getBusinessPricingPolicy(type: BusinessType | string): BusinessPricingPolicy {
  return isBusinessType(type) ? BUSINESS_PRICING_POLICIES[type] : BUSINESS_PRICING_POLICIES.cafe;
}

type DiscountInput = {
  account?: number;
  website?: number;
  box?: number;
  qtg?: number;
  qlq?: number;
};

type DiscountToggleInput = {
  account?: boolean;
  website?: boolean;
  box?: boolean;
  qtg?: boolean;
  qlq?: boolean;
};

export type CalculatorOptionsInput = {
  baseSalary?: number;
  vatRate?: number;
  boxMode?: 'none' | 'buy' | 'rent';
  accountFeeMode?: 'standard' | 'standalone';
  platformFeeMode?: 'website' | 'pc_app';
  billingCycle?: 'm' | 'q' | 'y';
  globalBoxCount?: number;
  globalPlatformStoreCount?: number;
  hasAccountFee?: boolean;
  hasWebsiteFee?: boolean;
  hasQTG?: boolean;
  hasQLQ?: boolean;
  globalDiscounts?: DiscountInput;
  discountEnabled?: DiscountToggleInput;
};

type NormalizedOptions = {
  baseSalary: number;
  vatRate: number;
  boxMode: 'none' | 'buy' | 'rent';
  accountFeeMode: 'standard' | 'standalone';
  platformFeeMode: 'website' | 'pc_app';
  billingCycle: 'm' | 'q' | 'y';
  globalBoxCount: number;
  globalPlatformStoreCount: number;
  hasAccountFee: boolean;
  hasWebsiteFee: boolean;
  hasQTG: boolean;
  hasQLQ: boolean;
  globalDiscounts: {
    account: number;
    website: number;
    box: number;
    qtg: number;
    qlq: number;
  };
  discountEnabled: {
    account: boolean;
    website: boolean;
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
  return calculateCoefComponents(type, area).coef;
}

export function calculateCoefComponents(type: BusinessType | string, area: number) {
  const a = Number(area) || 0;
  const policy = getBusinessPricingPolicy(type);
  const incrementCoefs = policy.increments.map((tier) => {
    if (a <= tier.above) return 0;
    const effectiveTop = tier.upTo === null ? a : Math.min(a, tier.upTo);
    return Math.max(0, effectiveTop - tier.above) * tier.rate;
  }) as [number, number];
  const components: [number, number, number] = [
    policy.base.coefficient,
    incrementCoefs[0],
    incrementCoefs[1]
  ];
  const rawCoef = components.reduce((sum, component) => sum + component, 0);
  return {
    components,
    rawCoef,
    coef: Math.min(rawCoef, policy.maxCoef),
    maxCoef: policy.maxCoef,
    policy
  };
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
  return fullMonths + calculateResidualMonthFraction(diffDays);
}

export function calculateResidualMonthFraction(dayCount: number): 0 | 0.5 | 1 {
  const days = Math.max(0, Math.floor(Number(dayCount) || 0));
  if (days <= DURATION_ROUNDING_POLICY.zeroMonthMaxDays) return 0;
  if (
    days >= DURATION_ROUNDING_POLICY.halfMonthMinDays &&
    days <= DURATION_ROUNDING_POLICY.halfMonthMaxDays
  ) {
    return 0.5;
  }
  return 1;
}

function normalizeOptions(options: CalculatorOptionsInput = {}): NormalizedOptions {
  const discounts = options.globalDiscounts || {};
  const discountEnabled = options.discountEnabled || {};
  const billingCycle = options.billingCycle === 'm' || options.billingCycle === 'q' ? options.billingCycle : 'y';
  return {
    baseSalary: Number(options.baseSalary) || DEFAULT_BASE_SALARY,
    vatRate: Number(options.vatRate) || 0,
    boxMode: options.boxMode || 'none',
    accountFeeMode: options.accountFeeMode === 'standalone' ? 'standalone' : 'standard',
    platformFeeMode: options.platformFeeMode === 'pc_app' ? 'pc_app' : 'website',
    billingCycle,
    globalBoxCount: Math.max(1, Number(options.globalBoxCount) || 1),
    globalPlatformStoreCount: Math.max(1, Number(options.globalPlatformStoreCount) || 1),
    hasAccountFee: options.hasAccountFee !== false,
    hasWebsiteFee: options.hasWebsiteFee === true,
    hasQTG: options.hasQTG !== false,
    hasQLQ: options.hasQLQ !== false,
    globalDiscounts: {
      account: clampDiscount(discounts.account),
      website: clampDiscount(discounts.website),
      box: clampDiscount(discounts.box),
      qtg: clampDiscount(discounts.qtg),
      qlq: clampDiscount(discounts.qlq)
    },
    discountEnabled: {
      account: discountEnabled.account === true,
      website: discountEnabled.website === true,
      box: discountEnabled.box === true,
      qtg: discountEnabled.qtg === true,
      qlq: discountEnabled.qlq === true
    }
  };
}

function effectiveDiscount(opts: NormalizedOptions, key: keyof NormalizedOptions['globalDiscounts']): number {
  return opts.discountEnabled[key] ? opts.globalDiscounts[key] : 0;
}

function accountFeeYearly(opts: NormalizedOptions): number {
  return opts.accountFeeMode === 'standalone' && !opts.hasQTG && !opts.hasQLQ
    ? ACCOUNT_FEE_STANDALONE_YEARLY
    : ACCOUNT_FEE_YEARLY;
}

function platformFeeOnce(opts: NormalizedOptions): number {
  return opts.platformFeeMode === 'pc_app' ? PC_APP_PLATFORM_FEE_ONCE : WEBSITE_PLATFORM_FEE_ONCE;
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
  const accountAmountOriginal = opts.hasAccountFee ? (accountFeeYearly(opts) / 12) * duration : 0;
  const websiteAmountOriginal = 0;

  const qtgAmount = qtgAmountOriginal * (1 - effectiveDiscount(opts, 'qtg') / 100);
  const qlqAmount = qlqAmountOriginal * (1 - effectiveDiscount(opts, 'qlq') / 100);
  const accountAmount = accountAmountOriginal * (1 - effectiveDiscount(opts, 'account') / 100);
  const websiteAmount = 0;

  let boxAmount = 0;
  let boxAmountOriginal = 0;
  if (opts.boxMode === 'buy') {
    boxAmountOriginal = BOX_BUY_PRICE * opts.globalBoxCount;
    boxAmount = boxAmountOriginal * (1 - effectiveDiscount(opts, 'box') / 100);
  } else if (opts.boxMode === 'rent') {
    boxAmountOriginal = (BOX_RENT_YEARLY / 12) * duration * opts.globalBoxCount;
    boxAmount = boxAmountOriginal * (1 - effectiveDiscount(opts, 'box') / 100);
  }

  const total = qtgAmount + qlqAmount + accountAmount + websiteAmount + boxAmount;
  const totalOriginal = qtgAmountOriginal + qlqAmountOriginal + accountAmountOriginal + websiteAmountOriginal + boxAmountOriginal;
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
    websiteAmount,
    websiteAmountOriginal,
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
    subtotalWebsite: number;
    subtotalWebsiteOriginal: number;
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
      acc.subtotalWebsite += s.websiteAmount;
      acc.subtotalWebsiteOriginal += s.websiteAmountOriginal;
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
      subtotalWebsite: 0,
      subtotalWebsiteOriginal: 0,
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
  totals.subtotalWebsiteOriginal = opts.hasWebsiteFee
    ? platformFeeOnce(opts) * opts.globalPlatformStoreCount
    : 0;
  totals.subtotalWebsite = totals.subtotalWebsiteOriginal * (1 - effectiveDiscount(opts, 'website') / 100);
  totals.subtotal =
    totals.subtotalQTG + totals.subtotalQLQ + totals.subtotalAccount + totals.subtotalWebsite + totals.subtotalBox;
  totals.subtotalOriginal =
    totals.subtotalQTGOriginal +
    totals.subtotalQLQOriginal +
    totals.subtotalAccountOriginal +
    totals.subtotalWebsiteOriginal +
    totals.subtotalBoxOriginal;
  totals.vatRate = opts.vatRate;
  totals.vat = totals.subtotal * opts.vatRate;
  totals.vatOriginal = totals.subtotalOriginal * opts.vatRate;
  totals.grand = totals.subtotal + totals.vat;
  totals.grandOriginal = totals.subtotalOriginal + totals.vatOriginal;
  return { stores: storeBreakdowns, totals };
}
