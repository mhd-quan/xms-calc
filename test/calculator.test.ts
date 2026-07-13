import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_BASE_SALARY,
  calculateCoef,
  calculateCoefComponents,
  calculateDurationMonths,
  calculateResidualMonthFraction,
  calculateStoreBreakdown,
  calculateTotals
} from '../src/shared/calculator';
import { getCopyrightPresentation } from '../src/shared/copyright';
import {
  buildDraftSnapshotFromManifest,
  buildEmbeddedManifest,
  buildQuotePayload
} from '../src/services/quote-payload';
import {
  buildQuoteIdentity,
  computeNextRevisionNumber
} from '../src/services/quote-identity-service';

import type { CalcOptions, Store } from '../src/shared/types';

const moneyEqual = (actual: number, expected: number) => {
  assert.equal(Math.round(actual), Math.round(expected));
};

const baseOptions: CalcOptions = {
  baseSalary: DEFAULT_BASE_SALARY,
  vatRate: 0.1,
  boxMode: 'none',
  accountFeeMode: 'standard',
  platformFeeMode: 'website',
  billingCycle: 'y',
  copyrightMode: 'qlq',
  globalBoxCount: 1,
  globalPlatformStoreCount: 1,
  hasAccountFee: true,
  hasWebsiteFee: false,
  hasQTG: true,
  hasQLQ: true,
  globalDiscounts: { account: 0, website: 0, box: 0, qtg: 0, qlq: 0 },
  discountEnabled: { account: true, website: true, box: true, qtg: true, qlq: true }
};

const cafeStore: Store = {
  id: 1,
  name: 'Chi nhánh 1',
  type: 'cafe',
  area: '100',
  startDate: '2026-01-01',
  endDate: '2026-12-31'
};

test('calculates current cafe coefficient and 12-month duration', () => {
  assert.equal(calculateCoef('cafe', 100), 2.75);
  assert.equal(calculateDurationMonths('2026-01-01', '2026-12-31'), 12);
});

test('business coefficients respect their policy caps', () => {
  assert.equal(calculateCoef('restaurant', 1500), 8);
  assert.equal(calculateCoef('cafe', 660), 8);
  assert.equal(calculateCoef('gym', 1430), 10);

  const uncappedRestaurant = calculateCoefComponents('restaurant', 1500);
  assert.equal(uncappedRestaurant.rawCoef, 46.5);
  assert.equal(uncappedRestaurant.maxCoef, 8);
});

test('duration handles invalid ranges and fractional month rules', () => {
  assert.equal(calculateDurationMonths('2026-02-01', '2026-01-31'), 0);
  assert.equal(calculateDurationMonths('2026-01-01', '2026-01-07'), 0);
  assert.equal(calculateDurationMonths('2026-01-01', '2026-01-08'), 0.5);
  assert.equal(calculateDurationMonths('2026-01-01', '2026-01-17'), 0.5);
  assert.equal(calculateDurationMonths('2026-01-01', '2026-01-18'), 1);
});

test('residual duration rounds by the documented day buckets', () => {
  assert.equal(calculateResidualMonthFraction(1), 0);
  assert.equal(calculateResidualMonthFraction(7), 0);
  assert.equal(calculateResidualMonthFraction(8), 0.5);
  assert.equal(calculateResidualMonthFraction(17), 0.5);
  assert.equal(calculateResidualMonthFraction(18), 1);
});

test('store breakdown respects QTG and QLQ toggles', () => {
  const active = calculateStoreBreakdown(cafeStore, baseOptions);
  const noQLQ = calculateStoreBreakdown(cafeStore, { ...baseOptions, hasQLQ: false });
  const noQTG = calculateStoreBreakdown(cafeStore, { ...baseOptions, hasQTG: false });

  moneyEqual(active.qtgAmount, 6957500);
  moneyEqual(active.qlqAmount, 6957500);
  moneyEqual(noQLQ.qlqAmount, 0);
  moneyEqual(noQLQ.total, active.total - active.qlqAmount);
  moneyEqual(noQTG.qtgAmount, 0);
  moneyEqual(noQTG.total, active.total - active.qtgAmount);
});

test('box buy is charged per branch using the global count per branch', () => {
  const stores = [cafeStore, { ...cafeStore, name: 'Chi nhánh 2' }, { ...cafeStore, name: 'Chi nhánh 3' }];
  const { stores: rows, totals } = calculateTotals(stores, {
    ...baseOptions,
    boxMode: 'buy',
    globalBoxCount: 2
  });

  rows.forEach((row) => moneyEqual(row.boxAmount, 4000000));
  moneyEqual(totals.subtotalBox, 12000000);
});

test('box rent is prorated per branch duration', () => {
  const stores = [
    cafeStore,
    { ...cafeStore, name: 'Chi nhánh 2', endDate: '2026-06-30' }
  ];
  const { stores: rows, totals } = calculateTotals(stores, {
    ...baseOptions,
    boxMode: 'rent',
    globalBoxCount: 2
  });

  assert.ok(rows[0]);
  assert.ok(rows[1]);
  moneyEqual(rows[0].boxAmount, 1800000);
  moneyEqual(rows[1].boxAmount, 900000);
  moneyEqual(totals.subtotalBox, 2700000);
});

test('box rent can use the interface discount', () => {
  const { stores: rows, totals } = calculateTotals([cafeStore], {
    ...baseOptions,
    boxMode: 'rent',
    globalBoxCount: 2,
    globalDiscounts: { ...baseOptions.globalDiscounts, box: 50 }
  });

  moneyEqual(rows[0]?.boxAmount ?? 0, 900000);
  moneyEqual(rows[0]?.boxAmountOriginal ?? 0, 1800000);
  moneyEqual(totals.subtotalBox, 900000);
  moneyEqual(totals.subtotalBoxOriginal, 1800000);
});

test('platform fee is optional and charged once by selected store count', () => {
  const stores = [
    cafeStore,
    { ...cafeStore, name: 'Chi nhánh 2', endDate: '2026-06-30' }
  ];
  const { stores: rows, totals } = calculateTotals(stores, {
    ...baseOptions,
    hasWebsiteFee: true,
    globalPlatformStoreCount: 2
  });

  rows.forEach((row) => moneyEqual(row.websiteAmount, 0));
  moneyEqual(totals.subtotalWebsite, 1200000);
  moneyEqual(totals.subtotalWebsiteOriginal, 1200000);
});

test('PC App platform fee can use the interface discount', () => {
  const { stores: rows, totals } = calculateTotals([cafeStore], {
    ...baseOptions,
    hasWebsiteFee: true,
    platformFeeMode: 'pc_app',
    globalPlatformStoreCount: 3,
    globalDiscounts: { ...baseOptions.globalDiscounts, website: 25 }
  });

  moneyEqual(rows[0]?.websiteAmount ?? 0, 0);
  moneyEqual(rows[0]?.websiteAmountOriginal ?? 0, 0);
  moneyEqual(totals.subtotalWebsite, 1800000);
  moneyEqual(totals.subtotalWebsiteOriginal, 2400000);
});

test('standalone account fee only applies when both rights are disabled', () => {
  const standalone = calculateStoreBreakdown(cafeStore, {
    ...baseOptions,
    accountFeeMode: 'standalone',
    hasQTG: false,
    hasQLQ: false
  });
  const blockedByRights = calculateStoreBreakdown(cafeStore, {
    ...baseOptions,
    accountFeeMode: 'standalone',
    hasQTG: false,
    hasQLQ: true
  });

  moneyEqual(standalone.accountAmount, 1500000);
  moneyEqual(blockedByRights.accountAmount, 600000);
});

test('VAT is derived from the shared subtotal', () => {
  const { totals } = calculateTotals([cafeStore], { ...baseOptions, vatRate: 0.08 });
  moneyEqual(
    totals.subtotal,
    totals.subtotalQTG + totals.subtotalQLQ + totals.subtotalAccount + totals.subtotalWebsite + totals.subtotalBox
  );
  moneyEqual(totals.vat, totals.subtotal * 0.08);
  moneyEqual(totals.grand, totals.subtotal * 1.08);
});

test('discount toggles preserve values but control whether they apply', () => {
  const withDiscount = calculateStoreBreakdown(cafeStore, {
    ...baseOptions,
    globalDiscounts: { ...baseOptions.globalDiscounts, qtg: 50 }
  });
  const disabledDiscount = calculateStoreBreakdown(cafeStore, {
    ...baseOptions,
    globalDiscounts: { ...baseOptions.globalDiscounts, qtg: 50 },
    discountEnabled: { ...baseOptions.discountEnabled, qtg: false }
  });

  moneyEqual(withDiscount.qtgAmount, 3478750);
  moneyEqual(disabledDiscount.qtgAmount, 6957500);
});

test('missing discount toggles default to off', () => {
  const defaultDisabled = calculateStoreBreakdown(cafeStore, {
    baseSalary: DEFAULT_BASE_SALARY,
    accountFeeMode: 'standard',
    hasWebsiteFee: false,
    globalDiscounts: { qtg: 50 }
  });

  moneyEqual(defaultDisabled.qtgAmount, 6957500);
});

test('uses the 2.530.000 VND statutory base salary by default', () => {
  assert.equal(DEFAULT_BASE_SALARY, 2530000);
  const breakdown = calculateStoreBreakdown(cafeStore);
  moneyEqual(breakdown.yearly, 6957500);
});

test('copyright presentation switches QTG ownership from VCPMC to NCT in QSC mode', () => {
  const qlq = getCopyrightPresentation('qlq');
  const qsc = getCopyrightPresentation('qsc');

  assert.equal(qlq.qtgProvider, 'VCPMC');
  assert.equal(qsc.qtgProvider, 'NCT');
  assert.match(qsc.qtgExportDescription, /NCT Media/);
  assert.doesNotMatch(qsc.qtgWorkbookHeader, /VCPMC/);
});

test('buildQuotePayload creates export-safe metadata and enriched store rows', () => {
  const payload = buildQuotePayload(
    { stores: [cafeStore], calcOptions: baseOptions },
    {
      companyName: ' Công ty Test ',
      contactName: ' Nguyễn Văn A ',
      department: ' Purchasing ',
      email: ' buyer@example.com ',
      phone: ' 0900000000 '
    },
    {
      name: ' Người lập ',
      title: ' BD ',
      department: ' Sales ',
      email: ' bd@example.com ',
      phone: ' 0911111111 '
    },
    {
      quoteDateInput: new Date('2026-04-23T00:00:00.000Z'),
      quoteIdentity: buildQuoteIdentity('XMS-260423-001', 1)
    }
  );

  assert.equal(payload.meta.quoteNumber, 'XMS-260423-001-R1');
  assert.equal(payload.quoteIdentity.quoteCode, 'XMS-260423-001');
  assert.equal(payload.customer.companyName, 'Công ty Test');
  assert.equal(payload.preparedBy.name, 'Người lập');
  const computedStore = payload.computedStores[0];
  assert.ok(computedStore);
  assert.equal(computedStore.branchNo, 1);
  assert.equal(computedStore.typeLabel, 'Quán cà phê - giải khát');
  assert.equal(computedStore.shortType, 'CAFÉ');
  assert.equal(payload.globals.boxMode, 'none');
  moneyEqual(payload.totals.grand, calculateTotals([cafeStore], baseOptions).totals.grand);
});

test('embedded manifest restores full editable draft snapshot', () => {
  const payload = buildQuotePayload(
    { stores: [cafeStore], calcOptions: { ...baseOptions, vatRate: 0.08 } },
    { companyName: 'Công ty B' },
    { name: 'BD User' },
    {
      quoteDateInput: new Date('2026-04-23T00:00:00.000Z'),
      quoteIdentity: buildQuoteIdentity('XMS-260423-002', 0)
    }
  );
  const manifest = buildEmbeddedManifest(payload, {
    appVersion: '1.6.5',
    exportedAt: '2026-04-23T10:00:00.000Z'
  });
  delete (manifest.calcOptions as Partial<CalcOptions>).copyrightMode;
  const snapshot = buildDraftSnapshotFromManifest(manifest);

  assert.equal(manifest.schemaVersion, '1.6');
  assert.equal(snapshot.customer.companyName, 'Công ty B');
  assert.equal(snapshot.preparedBy.name, 'BD User');
  assert.equal(snapshot.calcOptions.vatRate, 0.08);
  assert.equal(snapshot.calcOptions.copyrightMode, 'qlq');
  assert.equal(snapshot.stores[0]?.name, 'Chi nhánh 1');
});

test('smoke workflow supports create -> export -> import -> revision', () => {
  const baseQuoteCode = 'XMS-260425-007';
  const createdIdentity = buildQuoteIdentity(baseQuoteCode, 0);
  const createdPayload = buildQuotePayload(
    { stores: [cafeStore], calcOptions: baseOptions },
    { companyName: 'Công ty Smoke' },
    { name: 'Smoke Tester' },
    {
      quoteDateInput: new Date('2026-04-25T00:00:00.000Z'),
      quoteIdentity: createdIdentity
    }
  );
  const exportedManifest = buildEmbeddedManifest(createdPayload, {
    appVersion: '1.6.6',
    exportedAt: '2026-04-25T10:00:00.000Z'
  });

  const importedSnapshot = buildDraftSnapshotFromManifest(exportedManifest);
  const nextRevision = computeNextRevisionNumber(exportedManifest.quoteIdentity.revisionNumber);
  const revisedIdentity = buildQuoteIdentity(exportedManifest.quoteIdentity.quoteCode, nextRevision);

  assert.equal(createdPayload.meta.quoteNumber, 'XMS-260425-007');
  assert.equal(importedSnapshot.customer.companyName, 'Công ty Smoke');
  assert.equal(nextRevision, 1);
  assert.equal(revisedIdentity.displayQuoteNumber, 'XMS-260425-007-R1');
});
