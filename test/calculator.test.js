const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateCoef,
  calculateDurationMonths,
  calculateStoreBreakdown,
  calculateTotals,
} = require('../calculator');

const moneyEqual = (actual, expected) => {
  assert.equal(Math.round(actual), Math.round(expected));
};

const baseOptions = {
  baseSalary: 2340000,
  vatRate: 0.1,
  boxMode: 'none',
  globalBoxCount: 1,
  hasAccountFee: true,
  hasQTG: true,
  hasQLQ: true,
  globalDiscounts: { account: 0, box: 0, qtg: 0, qlq: 0 },
};

const cafeStore = {
  name: 'Chi nhánh 1',
  type: 'cafe',
  area: '100',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
};

test('calculates current cafe coefficient and 12-month duration', () => {
  assert.equal(calculateCoef('cafe', 100), 2.75);
  assert.equal(calculateDurationMonths('2026-01-01', '2026-12-31'), 12);
});

test('duration handles invalid ranges and fractional month rules', () => {
  assert.equal(calculateDurationMonths('2026-02-01', '2026-01-31'), 0);
  assert.equal(calculateDurationMonths('2026-01-01', '2026-01-07'), 0);
  assert.equal(calculateDurationMonths('2026-01-01', '2026-01-08'), 0.5);
  assert.equal(calculateDurationMonths('2026-01-01', '2026-01-18'), 1);
});

test('store breakdown respects QTG and QLQ toggles', () => {
  const active = calculateStoreBreakdown(cafeStore, baseOptions);
  const noQLQ = calculateStoreBreakdown(cafeStore, { ...baseOptions, hasQLQ: false });
  const noQTG = calculateStoreBreakdown(cafeStore, { ...baseOptions, hasQTG: false });

  moneyEqual(active.qtgAmount, 6435000);
  moneyEqual(active.qlqAmount, 6435000);
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
    globalBoxCount: 2,
  });

  rows.forEach((row) => moneyEqual(row.boxAmount, 4000000));
  moneyEqual(totals.subtotalBox, 12000000);
});

test('box rent is prorated per branch duration', () => {
  const stores = [
    cafeStore,
    { ...cafeStore, name: 'Chi nhánh 2', endDate: '2026-06-30' },
  ];
  const { stores: rows, totals } = calculateTotals(stores, {
    ...baseOptions,
    boxMode: 'rent',
    globalBoxCount: 2,
  });

  moneyEqual(rows[0].boxAmount, 2000000);
  moneyEqual(rows[1].boxAmount, 1000000);
  moneyEqual(totals.subtotalBox, 3000000);
});

test('VAT is derived from the shared subtotal', () => {
  const { totals } = calculateTotals([cafeStore], { ...baseOptions, vatRate: 0.08 });
  moneyEqual(totals.subtotal, totals.subtotalQTG + totals.subtotalQLQ + totals.subtotalAccount + totals.subtotalBox);
  moneyEqual(totals.vat, totals.subtotal * 0.08);
  moneyEqual(totals.grand, totals.subtotal * 1.08);
});
