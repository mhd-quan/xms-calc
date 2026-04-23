(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BDCalculator = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BUSINESS_TYPES = {
    cafe:          { label: 'Quán cà phê - giải khát', short: 'CAFÉ' },
    restaurant:    { label: 'Nhà hàng, phòng hội thảo, hội nghị', short: 'F&B' },
    store:         { label: 'Cửa hàng, showroom', short: 'RETAIL' },
    gym:           { label: 'CLB thể dục, chăm sóc sức khỏe - thẩm mỹ', short: 'FITNESS' },
    entertainment: { label: 'Khu vui chơi, giải trí', short: 'ENTERTAIN' },
    mall:          { label: 'Trung tâm thương mại, cao ốc văn phòng', short: 'MALL' },
    supermarket:   { label: 'Siêu thị', short: 'SUPERMARKET' },
  };

  const DEFAULT_BASE_SALARY = 2340000;
  const ACCOUNT_FEE_YEARLY = 600000;
  const BOX_BUY_PRICE = 2000000;
  const BOX_RENT_YEARLY = 1000000;

  function clampDiscount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  function calculateCoef(type, area) {
    const a = Number(area) || 0;
    let coef = 0, maxCoef = Infinity;
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

  function parseLocalDate(ymd) {
    if (!ymd) return null;
    const parts = String(ymd).split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function calculateDurationMonths(start, end) {
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

  function normalizeOptions(options) {
    const discounts = options.globalDiscounts || {};
    return {
      baseSalary: Number(options.baseSalary) || DEFAULT_BASE_SALARY,
      vatRate: Number(options.vatRate) || 0,
      boxMode: options.boxMode || 'none',
      globalBoxCount: Math.max(1, Number(options.globalBoxCount) || 1),
      hasAccountFee: options.hasAccountFee !== false,
      hasQTG: options.hasQTG !== false,
      hasQLQ: options.hasQLQ !== false,
      globalDiscounts: {
        account: clampDiscount(discounts.account),
        box: clampDiscount(discounts.box),
        qtg: clampDiscount(discounts.qtg),
        qlq: clampDiscount(discounts.qlq),
      }
    };
  }

  function calculateStoreBreakdown(store, options) {
    const opts = normalizeOptions(options);
    const area = Number(store.area) || 0;
    const duration = calculateDurationMonths(store.startDate, store.endDate);
    const coef = calculateCoef(store.type, area);
    const yearly = coef * opts.baseSalary;
    const periodBase = (yearly / 12) * duration;

    const qtgAmount = opts.hasQTG ? periodBase * (1 - opts.globalDiscounts.qtg / 100) : 0;
    const qlqAmount = opts.hasQLQ ? periodBase * (1 - opts.globalDiscounts.qlq / 100) : 0;
    const accountAmount = opts.hasAccountFee
      ? (ACCOUNT_FEE_YEARLY / 12) * duration * (1 - opts.globalDiscounts.account / 100)
      : 0;

    let boxAmount = 0;
    if (opts.boxMode === 'buy') {
      boxAmount = BOX_BUY_PRICE * opts.globalBoxCount * (1 - opts.globalDiscounts.box / 100);
    } else if (opts.boxMode === 'rent') {
      boxAmount = (BOX_RENT_YEARLY / 12) * duration * opts.globalBoxCount;
    }

    const total = qtgAmount + qlqAmount + accountAmount + boxAmount;
    return {
      name: store.name,
      type: store.type,
      area,
      duration,
      coef,
      yearly,
      periodBase,
      qtgAmount,
      qlqAmount,
      accountAmount,
      boxAmount,
      total
    };
  }

  function calculateTotals(stores, options) {
    const opts = normalizeOptions(options);
    const storeBreakdowns = stores.map((store) => calculateStoreBreakdown(store, opts));
    const totals = storeBreakdowns.reduce((acc, s) => {
      acc.subtotalQTG += s.qtgAmount;
      acc.subtotalQLQ += s.qlqAmount;
      acc.subtotalAccount += s.accountAmount;
      acc.subtotalBox += s.boxAmount;
      return acc;
    }, {
      subtotalQTG: 0,
      subtotalQLQ: 0,
      subtotalAccount: 0,
      subtotalBox: 0,
    });
    totals.subtotal = totals.subtotalQTG + totals.subtotalQLQ + totals.subtotalAccount + totals.subtotalBox;
    totals.vatRate = opts.vatRate;
    totals.vat = totals.subtotal * opts.vatRate;
    totals.grand = totals.subtotal + totals.vat;
    return { stores: storeBreakdowns, totals };
  }

  return {
    BUSINESS_TYPES,
    DEFAULT_BASE_SALARY,
    ACCOUNT_FEE_YEARLY,
    BOX_BUY_PRICE,
    BOX_RENT_YEARLY,
    calculateCoef,
    calculateDurationMonths,
    calculateStoreBreakdown,
    calculateTotals,
  };
});
