(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./calculator'));
  } else {
    root.BDQuotePayload = factory(root.BDCalculator);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (calculator) {
  const { BUSINESS_TYPES, calculateTotals } = calculator;

  function normalizeProfile(profile) {
    return {
      companyName: String(profile?.companyName || '').trim(),
      contactName: String(profile?.contactName || '').trim(),
      department: String(profile?.department || '').trim(),
      email: String(profile?.email || '').trim(),
      phone: String(profile?.phone || '').trim()
    };
  }

  function normalizePreparedBy(settings) {
    return {
      name: String(settings?.name || '').trim(),
      title: String(settings?.title || '').trim(),
      department: String(settings?.department || '').trim(),
      email: String(settings?.email || '').trim(),
      phone: String(settings?.phone || '').trim()
    };
  }

  function buildQuoteNumber(date) {
    return `XMS-${date.toISOString().slice(2, 10).replace(/-/g, '')}`;
  }

  function buildGlobals(calcOptions) {
    return {
      boxMode: calcOptions.boxMode,
      globalBoxCount: calcOptions.globalBoxCount,
      hasAccountFee: calcOptions.hasAccountFee,
      hasQTG: calcOptions.hasQTG,
      hasQLQ: calcOptions.hasQLQ,
      globalDiscounts: { ...(calcOptions.globalDiscounts || {}) },
      baseSalary: calcOptions.baseSalary
    };
  }

  function buildQuotePayload(state, customerInput, settingsInput, quoteDateInput = new Date()) {
    const quoteDate = quoteDateInput instanceof Date ? quoteDateInput : new Date(quoteDateInput);
    const stores = Array.isArray(state?.stores) ? state.stores : [];
    const calcOptions = state?.calcOptions || {};
    const quote = calculateTotals(stores, calcOptions);
    const customer = normalizeProfile(customerInput);
    const preparedBy = normalizePreparedBy(settingsInput);

    return {
      meta: {
        quoteDate: quoteDate.toISOString(),
        quoteNumber: buildQuoteNumber(quoteDate),
        customerName: customer.companyName,
        customer,
        preparedBy
      },
      stores: quote.stores.map((store, index) => ({
        ...store,
        branchNo: index + 1,
        typeLabel: store.type && BUSINESS_TYPES[store.type] ? BUSINESS_TYPES[store.type].label : '',
        shortType: store.type && BUSINESS_TYPES[store.type] ? BUSINESS_TYPES[store.type].short : ''
      })),
      globals: buildGlobals(calcOptions),
      totals: quote.totals
    };
  }

  return {
    buildQuotePayload
  };
});
