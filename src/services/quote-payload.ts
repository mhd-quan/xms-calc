import { BUSINESS_TYPES, calculateTotals } from '../shared/calculator';
import {
  EMBEDDED_PAYLOAD_SCHEMA_VERSION,
  buildQuoteIdentity
} from './quote-identity-service';

import type {
  BoxMode,
  CalcOptions,
  CustomerProfile,
  EmbeddedManifest,
  PreparedByProfile,
  QuoteIdentity,
  QuotePayload,
  QuoteSnapshot,
  Store
} from '../shared/types';

type ProfileInput = {
  companyName?: string;
  contactName?: string;
  department?: string;
  email?: string;
  phone?: string;
};

type PreparedByInput = {
  name?: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
};

type QuotePayloadOptions = {
  quoteIdentity?: Pick<QuoteIdentity, 'quoteCode' | 'revisionNumber'>;
  quoteDateInput?: Date | string | number;
};

function isBoxMode(value: unknown): value is BoxMode {
  return value === 'none' || value === 'buy' || value === 'rent';
}

function isBillingCycle(value: unknown): value is CalcOptions['billingCycle'] {
  return value === 'm' || value === 'q' || value === 'y';
}

function normalizeProfile(profile?: ProfileInput | CustomerProfile | Record<string, unknown>): CustomerProfile {
  return {
    companyName: String(profile?.companyName || '').trim(),
    contactName: String(profile?.contactName || '').trim(),
    department: String(profile?.department || '').trim(),
    email: String(profile?.email || '').trim(),
    phone: String(profile?.phone || '').trim()
  };
}

function normalizePreparedBy(
  settings?: PreparedByInput | PreparedByProfile | Record<string, unknown>
): PreparedByProfile {
  return {
    name: String(settings?.name || '').trim(),
    title: String(settings?.title || '').trim(),
    department: String(settings?.department || '').trim(),
    email: String(settings?.email || '').trim(),
    phone: String(settings?.phone || '').trim()
  };
}

function normalizeStores(stores: Array<Partial<Store> | Record<string, unknown>> = []): Store[] {
  return (Array.isArray(stores) ? stores : []).map((store, index) => ({
    id: Number(store?.id) || Date.now() + index + Math.random(),
    name: String(store?.name || `Chi nhánh ${index + 1}`).trim() || `Chi nhánh ${index + 1}`,
    type: String(store?.type || '').trim(),
    area: String(store?.area || '').trim(),
    startDate: String(store?.startDate || '').trim(),
    endDate: String(store?.endDate || '').trim()
  }));
}

function normalizeCalcOptions(calcOptions: Partial<CalcOptions> | Record<string, unknown> = {}): CalcOptions {
  const discounts = (calcOptions?.globalDiscounts as Partial<CalcOptions['globalDiscounts']> | undefined) || {};
  const discountEnabled = (calcOptions?.discountEnabled as Partial<CalcOptions['discountEnabled']> | undefined) || {};
  return {
    boxMode: isBoxMode(calcOptions?.boxMode) ? calcOptions.boxMode : 'none',
    billingCycle: isBillingCycle(calcOptions?.billingCycle) ? calcOptions.billingCycle : 'y',
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
    discountEnabled: {
      account: discountEnabled.account === true,
      box: discountEnabled.box === true,
      qtg: discountEnabled.qtg === true,
      qlq: discountEnabled.qlq === true
    },
    baseSalary: Number(calcOptions?.baseSalary) || 2340000,
    vatRate: Number(calcOptions?.vatRate) || 0
  };
}

function buildGlobals(calcOptions: Partial<CalcOptions> | Record<string, unknown>): CalcOptions {
  return {
    ...normalizeCalcOptions(calcOptions)
  };
}

function buildQuotePayload(
  state: QuoteSnapshot | Record<string, unknown>,
  customerInput: ProfileInput | CustomerProfile,
  settingsInput: PreparedByInput | PreparedByProfile,
  options: QuotePayloadOptions = {}
): QuotePayload {
  const quoteDate = options.quoteDateInput instanceof Date
    ? options.quoteDateInput
    : new Date(options.quoteDateInput || new Date());
  const stores = normalizeStores(state?.stores as Array<Partial<Store> | Record<string, unknown>>);
  const calcOptions = normalizeCalcOptions((state?.calcOptions as Record<string, unknown>) || {});
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
    computedStores: quote.stores.map((store, index) => {
      const sourceStore = stores[index] ?? {
        id: index + 1,
        name: '',
        type: '',
        area: '',
        startDate: '',
        endDate: ''
      };
      const typeMeta = store.type ? BUSINESS_TYPES[store.type] : undefined;
      return {
        ...sourceStore,
        ...store,
        branchNo: index + 1,
        typeLabel: typeMeta?.label ?? '',
        shortType: typeMeta?.short ?? ''
      };
    }),
    globals: buildGlobals(calcOptions),
    totals: quote.totals
  };
}

function buildEmbeddedManifest(payload: QuotePayload, options: Record<string, unknown> = {}): EmbeddedManifest {
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
    exportedAt: String(options.exportedAt || new Date().toISOString()),
    pdfFingerprintSource: 'sha256:file'
  };
}

function buildDraftSnapshotFromManifest(manifest: EmbeddedManifest | Record<string, unknown>): QuoteSnapshot {
  const typedManifest = manifest as Partial<EmbeddedManifest>;
  return {
    customer: normalizeProfile(typedManifest.customer),
    preparedBy: normalizePreparedBy(typedManifest.preparedBy),
    calcOptions: normalizeCalcOptions(typedManifest.calcOptions),
    stores: normalizeStores(typedManifest.stores),
    totals: { ...(typedManifest.totals || {}) }
  };
}

export {
  EMBEDDED_PAYLOAD_SCHEMA_VERSION,
  buildDraftSnapshotFromManifest,
  buildEmbeddedManifest,
  buildQuotePayload,
  normalizeCalcOptions,
  normalizePreparedBy,
  normalizeProfile,
  normalizeStores
};
