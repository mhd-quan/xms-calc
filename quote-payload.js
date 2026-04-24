(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./calculator'), require('./quote-identity-service'));
  } else {
    root.BDQuotePayload = factory(root.BDCalculator, root.BDQuoteIdentityService);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (calculator, quoteIdentityService) {
  const { BUSINESS_TYPES, calculateTotals } = calculator;
  const {
    EMBEDDED_PAYLOAD_SCHEMA_VERSION,
    buildQuoteIdentity
  } = quoteIdentityService || {
    EMBEDDED_PAYLOAD_SCHEMA_VERSION: '1.6',
    buildQuoteIdentity: (quoteCode, revisionNumber) => ({
      quoteCode,
      revisionNumber,
      revisionLabel: revisionNumber > 0 ? `R${revisionNumber}` : '',
      displayQuoteNumber: revisionNumber > 0 ? `${quoteCode}-R${revisionNumber}` : quoteCode
    })
  };

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

  function normalizeStores(stores) {
    return (Array.isArray(stores) ? stores : []).map((store, index) => ({
      id: Number(store?.id) || Date.now() + index + Math.random(),
      name: String(store?.name || `Chi nhánh ${index + 1}`).trim() || `Chi nhánh ${index + 1}`,
      type: String(store?.type || '').trim(),
      area: String(store?.area || '').trim(),
      startDate: String(store?.startDate || '').trim(),
      endDate: String(store?.endDate || '').trim()
    }));
  }

  function normalizeCalcOptions(calcOptions) {
    const discounts = calcOptions?.globalDiscounts || {};
    return {
      boxMode: calcOptions?.boxMode || 'none',
      globalBoxCount: Math.max(1, Number(calcOptions?.globalBoxCount) || 1),
      hasAccountFee: calcOptions?.hasAccountFee !== false,
      hasQTG: calcOptions?.hasQTG !== false,
      hasQLQ: calcOptions?.hasQLQ !== false,
      globalDiscounts: {
        account: Number(discounts.account) || 0,
        box: Number(discounts.box) || 0,
        qtg: Number(discounts.qtg) || 0,
        qlq: Number(discounts.qlq) || 0
      },
      baseSalary: Number(calcOptions?.baseSalary) || 2340000,
      vatRate: Number(calcOptions?.vatRate) || 0
    };
  }

  function buildGlobals(calcOptions) {
    return {
      ...normalizeCalcOptions(calcOptions)
    };
  }

  function buildQuotePayload(state, customerInput, settingsInput, options = {}) {
    const quoteDate = options.quoteDateInput instanceof Date
      ? options.quoteDateInput
      : new Date(options.quoteDateInput || new Date());
    const stores = normalizeStores(state?.stores);
    const calcOptions = normalizeCalcOptions(state?.calcOptions || {});
    const quote = calculateTotals(stores, calcOptions);
    const customer = normalizeProfile(customerInput);
    const preparedBy = normalizePreparedBy(settingsInput);
    const quoteIdentity = options.quoteIdentity
      ? {
          ...buildQuoteIdentity(
            options.quoteIdentity.quoteCode,
            options.quoteIdentity.revisionNumber
          ),
          ...(options.quoteIdentity || {})
        }
      : buildQuoteIdentity('', 0);

    return {
      schemaVersion: EMBEDDED_PAYLOAD_SCHEMA_VERSION,
      quoteIdentity,
      meta: {
        quoteDate: quoteDate.toISOString(),
        quoteNumber: quoteIdentity.displayQuoteNumber,
        displayQuoteNumber: quoteIdentity.displayQuoteNumber,
        quoteCode: quoteIdentity.quoteCode,
        revisionNumber: quoteIdentity.revisionNumber,
        revisionLabel: quoteIdentity.revisionLabel,
        customerName: customer.companyName,
        customer,
        preparedBy
      },
      customer,
      preparedBy,
      calcOptions,
      stores,
      computedStores: quote.stores.map((store, index) => ({
        ...stores[index],
        ...store,
        branchNo: index + 1,
        typeLabel: store.type && BUSINESS_TYPES[store.type] ? BUSINESS_TYPES[store.type].label : '',
        shortType: store.type && BUSINESS_TYPES[store.type] ? BUSINESS_TYPES[store.type].short : ''
      })),
      globals: buildGlobals(calcOptions),
      totals: quote.totals
    };
  }

  function buildEmbeddedManifest(payload, options = {}) {
    return {
      schemaVersion: EMBEDDED_PAYLOAD_SCHEMA_VERSION,
      appVersion: String(options.appVersion || ''),
      quoteIdentity: {
        quoteCode: payload.quoteIdentity.quoteCode,
        revisionNumber: payload.quoteIdentity.revisionNumber,
        displayQuoteNumber: payload.quoteIdentity.displayQuoteNumber
      },
      quoteDate: payload.meta.quoteDate,
      customer: normalizeProfile(payload.customer || payload.meta?.customer),
      preparedBy: normalizePreparedBy(payload.preparedBy || payload.meta?.preparedBy),
      calcOptions: normalizeCalcOptions(payload.calcOptions),
      stores: normalizeStores(payload.stores),
      totals: { ...(payload.totals || {}) },
      exportedAt: options.exportedAt || new Date().toISOString(),
      pdfFingerprintSource: 'sha256:file'
    };
  }

  function buildDraftSnapshotFromManifest(manifest) {
    return {
      customer: normalizeProfile(manifest?.customer),
      preparedBy: normalizePreparedBy(manifest?.preparedBy),
      calcOptions: normalizeCalcOptions(manifest?.calcOptions),
      stores: normalizeStores(manifest?.stores),
      totals: { ...(manifest?.totals || {}) }
    };
  }

  return {
    EMBEDDED_PAYLOAD_SCHEMA_VERSION,
    buildDraftSnapshotFromManifest,
    buildEmbeddedManifest,
    buildQuotePayload,
    normalizeCalcOptions,
    normalizePreparedBy,
    normalizeProfile,
    normalizeStores
  };
});
