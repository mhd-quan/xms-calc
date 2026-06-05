import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import {
  buildQuoteIdentity,
  computeNextRevisionNumber,
  formatDisplayQuoteNumber,
  generateBaseQuoteCode
} from '../src/services/quote-identity-service';
import { QuoteRepository } from '../src/services/quote-repository';
import {
  buildEmbeddedManifest,
  buildQuotePayload
} from '../src/services/quote-payload';
import { exportExcel } from '../src/services/excel-exporter';
import { extractManifestFromExcelFile } from '../src/services/excel-import-service';
import { extractManifestFromDraftFile, saveDraftFile } from '../src/services/draft-file-service';
import {
  buildImportPreview,
  embedManifestInPdf,
  extractManifestFromPdfBytes
} from '../src/services/pdf-import-service';

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    customer: { companyName: 'Công ty Test' },
    preparedBy: { name: 'BD User' },
    calcOptions: {
      baseSalary: 2340000,
      vatRate: 0.1,
      boxMode: 'none',
      accountFeeMode: 'standard',
      billingCycle: 'y',
      globalBoxCount: 1,
      hasAccountFee: true,
      hasWebsiteFee: false,
      hasQTG: true,
      hasQLQ: true,
      globalDiscounts: { account: 0, website: 0, box: 0, qtg: 0, qlq: 0 },
      discountEnabled: { account: false, website: false, box: false, qtg: false, qlq: false }
    },
    stores: [{
      id: 1,
      name: 'Chi nhánh 1',
      type: 'cafe',
      area: '100',
      startDate: '2026-01-01',
      endDate: '2026-12-31'
    }],
    totals: {},
    ...overrides
  };
}

function cellResult(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === 'object') {
    if ('result' in value) return value.result;
    if ('text' in value) return value.text;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
  }
  return value;
}

function cellText(value: ExcelJS.CellValue): string {
  return String(cellResult(value) ?? '').trim();
}

function findRowByText(worksheet: ExcelJS.Worksheet, text: string, column: string): number {
  for (let row = 1; row <= worksheet.rowCount; row++) {
    if (cellText(worksheet.getCell(`${column}${row}`).value) === text) {
      return row;
    }
  }
  throw new Error(`Could not find ${text} in column ${column}`);
}

function nearestTierHeader(worksheet: ExcelJS.Worksheet, row: number): string {
  for (let headerRow = row - 1; headerRow >= 1; headerRow--) {
    const value = cellText(worksheet.getCell(`H${headerRow}`).value);
    if (value.startsWith('Đến ')) return value;
  }
  throw new Error(`Could not find pricing header before row ${row}`);
}

test('quoteIdentityService formats base and revision numbers', () => {
  assert.equal(generateBaseQuoteCode(new Date('2026-04-23T00:00:00.000Z'), 7), 'XMS-260423-007');
  assert.equal(formatDisplayQuoteNumber('XMS-260423-007', 0), 'XMS-260423-007');
  assert.equal(formatDisplayQuoteNumber('XMS-260423-007', 2), 'XMS-260423-007-R2');
  assert.equal(computeNextRevisionNumber(1), 2);
});

test('repository creates base quote and next revision', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xms-quote-repo-'));
  const repo = new QuoteRepository(path.join(tmpDir, 'quotes.sqlite'));

  const base = repo.createBaseQuoteRevision({
    quoteCode: 'XMS-260423-001',
    snapshot: makeSnapshot()
  });
  assert.ok(base);
  assert.equal(base.revisionNumber, 0);

  const next = repo.createNextRevisionFromCurrent({
    revisionId: base.id,
    snapshot: makeSnapshot({ customer: { companyName: 'Công ty R1' } })
  });
  assert.ok(next);
  assert.equal(next.revisionNumber, 1);

  const byIdentity = repo.getRevisionByIdentity('XMS-260423-001', 1);
  assert.ok(byIdentity);
  assert.equal(byIdentity.customer.companyName, 'Công ty R1');
  assert.equal(repo.listRevisionsByQuote(base.quoteId).length, 2);

  repo.close();
});

test('pdf import service extracts embedded manifest and rejects unsupported schema', async () => {
  const payload = buildQuotePayload(
    makeSnapshot(),
    { companyName: 'Công ty PDF' },
    { name: 'BD PDF' },
    {
      quoteDateInput: new Date('2026-04-23T00:00:00.000Z'),
      quoteIdentity: buildQuoteIdentity('XMS-260423-003', 1)
    }
  );
  const manifest = buildEmbeddedManifest(payload, {
    appVersion: '1.6.5',
    exportedAt: '2026-04-23T10:00:00.000Z'
  });

  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595, 842]);
  const pdfBytes = await pdfDoc.save();
  const embeddedPdf = await embedManifestInPdf(pdfBytes, manifest);
  const extracted = await extractManifestFromPdfBytes(embeddedPdf);
  assert.equal(extracted.quoteIdentity.displayQuoteNumber, 'XMS-260423-003-R1');

  const brokenManifest = { ...manifest, schemaVersion: '1.5' };
  const brokenPdf = await embedManifestInPdf(pdfBytes, brokenManifest);
  await assert.rejects(
    () => extractManifestFromPdfBytes(brokenPdf),
    /schema 1.5 chưa được hỗ trợ/i
  );
});

test('import preview reports same revision conflict based on fingerprint', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xms-quote-preview-'));
  const repo = new QuoteRepository(path.join(tmpDir, 'quotes.sqlite'));
  const baseSnapshot = makeSnapshot();
  const base = repo.createBaseQuoteRevision({
    quoteCode: 'XMS-260423-004',
    snapshot: baseSnapshot
  });
  assert.ok(base);
  repo.markRevisionExported({
    revisionId: base.id,
    snapshot: baseSnapshot,
    embeddedPayloadVersion: '1.6',
    pdfFilePath: '/tmp/sample.pdf',
    pdfFingerprint: 'abc123',
    exportedAt: '2026-04-23T10:00:00.000Z'
  });

  const payload = buildQuotePayload(
    baseSnapshot,
    baseSnapshot.customer,
    baseSnapshot.preparedBy,
    {
      quoteDateInput: new Date('2026-04-23T00:00:00.000Z'),
      quoteIdentity: buildQuoteIdentity('XMS-260423-004', 0)
    }
  );
  const manifest = buildEmbeddedManifest(payload, {
    appVersion: '1.6.5',
    exportedAt: '2026-04-23T10:00:00.000Z'
  });

  const preview = buildImportPreview({
    filePath: '/tmp/sample-other.pdf',
    fileName: 'sample-other.pdf',
    fingerprint: 'different',
    manifest,
    repository: repo
  });

  assert.equal(preview.conflictType, 'revision_conflict');
  assert.equal(preview.recommendedAction, 'replace_existing_revision');

  repo.close();
});

test('excel export embeds a full manifest for lossless workbook import', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xms-excel-export-'));
  const filePath = path.join(tmpDir, 'quote.xlsx');
  const payload = buildQuotePayload(
    makeSnapshot({
      customer: { companyName: 'Công ty Excel', contactName: 'Excel Buyer' },
      preparedBy: { name: 'BD Excel', email: 'bd@example.com' }
    }),
    { companyName: 'Công ty Excel', contactName: 'Excel Buyer' },
    { name: 'BD Excel', email: 'bd@example.com' },
    {
      quoteDateInput: new Date('2026-05-05T00:00:00.000Z'),
      quoteIdentity: buildQuoteIdentity('XMS-260505-001', 0)
    }
  );
  const manifest = buildEmbeddedManifest(payload, {
    appVersion: '1.11.2',
    exportedAt: '2026-05-05T10:00:00.000Z'
  });

  const result = await exportExcel({
    app: { getPath: () => tmpDir },
    dialog: { showSaveDialog: async () => ({ filePath }) },
    payload,
    manifest
  });
  assert.equal(result?.filePath, filePath);

  const extracted = await extractManifestFromExcelFile(filePath);
  assert.equal(extracted.manifest.quoteIdentity.displayQuoteNumber, 'XMS-260505-001');
  assert.equal(extracted.manifest.customer.companyName, 'Công ty Excel');
  assert.equal(extracted.manifest.preparedBy.email, 'bd@example.com');
  assert.equal(extracted.manifest.stores[0]?.name, 'Chi nhánh 1');
});

test('excel export includes visible platform and equipment rows', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xms-excel-platform-'));
  const filePath = path.join(tmpDir, 'quote-platform.xlsx');
  const snapshot = makeSnapshot({
    calcOptions: {
      baseSalary: 2340000,
      vatRate: 0.08,
      boxMode: 'rent',
      accountFeeMode: 'standalone',
      billingCycle: 'y',
      globalBoxCount: 2,
      hasAccountFee: true,
      hasWebsiteFee: true,
      hasQTG: false,
      hasQLQ: false,
      globalDiscounts: { account: 10, website: 25, box: 50, qtg: 0, qlq: 0 },
      discountEnabled: { account: true, website: true, box: true, qtg: false, qlq: false }
    }
  });
  const payload = buildQuotePayload(
    snapshot,
    { companyName: 'Công ty Platform' },
    { name: 'BD Platform' },
    {
      quoteDateInput: new Date('2026-05-12T00:00:00.000Z'),
      quoteIdentity: buildQuoteIdentity('XMS-260512-001', 0)
    }
  );
  const manifest = buildEmbeddedManifest(payload, {
    appVersion: '1.13.4',
    exportedAt: '2026-05-12T10:00:00.000Z'
  });
  assert.equal(Math.round(payload.totals.subtotalWebsite), 450000);
  assert.equal(Math.round(payload.totals.subtotalWebsiteOriginal), 600000);

  await exportExcel({
    app: { getPath: () => tmpDir },
    dialog: { showSaveDialog: async () => ({ filePath }) },
    payload,
    manifest
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet('Báo Giá');
  assert.ok(worksheet);
  const visibleValues = JSON.stringify(worksheet.getSheetValues());
  assert.match(visibleValues, /HẠNG MỤC NỀN TẢNG & THIẾT BỊ/);
  assert.match(visibleValues, /Phí Nền tảng/);
  assert.match(visibleValues, /Phí Sử dụng Tài khoản XMS/);
  assert.match(
    visibleValues,
    /Website hoặc PC App XMS tùy theo nhu cầu hạ tầng của khách hàng, prorated theo thời gian sử dụng thực tế của Cửa hàng, chi phí hàng năm/
  );
  assert.match(visibleValues, /Thiết bị phát \(Boxset\) - Thuê/);
  assert.match(visibleValues, /Tổng thanh toán sau VAT/);
});

test('excel export keeps mixed business pricing capped and visible totals aligned', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xms-excel-mixed-business-'));
  const filePath = path.join(tmpDir, 'quote-mixed-business.xlsx');
  const snapshot = makeSnapshot({
    calcOptions: {
      baseSalary: 2340000,
      vatRate: 0,
      boxMode: 'buy',
      accountFeeMode: 'standard',
      billingCycle: 'y',
      globalBoxCount: 1,
      hasAccountFee: true,
      hasWebsiteFee: false,
      hasQTG: true,
      hasQLQ: true,
      globalDiscounts: { account: 0, website: 0, box: 0, qtg: 30, qlq: 50 },
      discountEnabled: { account: false, website: false, box: false, qtg: true, qlq: true }
    },
    stores: [
      { id: 1, name: 'Indochine', type: 'restaurant', area: '1500', startDate: '2026-06-05', endDate: '2027-06-05' },
      { id: 2, name: 'SG+Colo', type: 'restaurant', area: '580', startDate: '2026-06-05', endDate: '2027-06-05' },
      { id: 3, name: 'LV', type: 'mall', area: '1600', startDate: '2026-06-05', endDate: '2027-06-05' },
      { id: 4, name: 'BC', type: 'cafe', area: '660', startDate: '2026-06-05', endDate: '2027-06-05' },
      { id: 5, name: 'Beach Hut', type: 'cafe', area: '60', startDate: '2026-06-05', endDate: '2027-06-05' },
      { id: 6, name: 'Spa', type: 'gym', area: '1430', startDate: '2026-06-05', endDate: '2027-06-05' },
      { id: 7, name: 'Lobby', type: 'mall', area: '480', startDate: '2026-06-05', endDate: '2027-06-05' }
    ]
  });
  const payload = buildQuotePayload(
    snapshot,
    { companyName: 'Resort' },
    { name: 'BD Mixed' },
    {
      quoteDateInput: new Date('2026-06-05T00:00:00.000Z'),
      quoteIdentity: buildQuoteIdentity('XMS-260605-002', 0)
    }
  );
  const manifest = buildEmbeddedManifest(payload, {
    appVersion: '1.13.5',
    exportedAt: '2026-06-05T10:00:00.000Z'
  });

  assert.equal(Math.round(payload.totals.grand), 138635120);

  await exportExcel({
    app: { getPath: () => tmpDir },
    dialog: { showSaveDialog: async () => ({ filePath }) },
    payload,
    manifest
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet('Báo Giá');
  assert.ok(worksheet);

  const indochineRow = findRowByText(worksheet, 'Indochine', 'C');
  const lvRow = findRowByText(worksheet, 'LV', 'C');
  const bcRow = findRowByText(worksheet, 'BC', 'C');
  const spaRow = findRowByText(worksheet, 'Spa', 'C');
  assert.equal(nearestTierHeader(worksheet, indochineRow), 'Đến 50 m2');
  assert.equal(nearestTierHeader(worksheet, lvRow), 'Đến 200 m2');
  assert.equal(nearestTierHeader(worksheet, bcRow), 'Đến 15 m2');
  assert.equal(nearestTierHeader(worksheet, spaRow), 'Đến 50 m2');

  const indochineAnnual = worksheet.getCell(`K${indochineRow}`).value;
  assert.ok(indochineAnnual && typeof indochineAnnual === 'object' && 'formula' in indochineAnnual);
  assert.match(String(indochineAnnual.formula), /MIN\(SUM\(H\d+:J\d+\),8\*\$I\$4\)/);
  assert.equal(Math.round(Number(indochineAnnual.result)), 18720000);

  const copyrightNetRow = findRowByText(
    worksheet,
    'Tổng giá trị phải thanh toán Phí Bản Quyền (chưa bao gồm VAT):',
    'A'
  );
  assert.equal(Math.round(Number(cellResult(worksheet.getCell(`N${copyrightNetRow}`).value))), 120435120);

  const grandRow = findRowByText(worksheet, 'Tổng thanh toán sau VAT:', 'A');
  assert.equal(Math.round(Number(cellResult(worksheet.getCell(`M${grandRow}`).value))), 138635120);
});

test('draft file preserves the complete editable quote snapshot', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xms-draft-file-'));
  const filePath = path.join(tmpDir, 'quote.xmsdraft');
  const payload = buildQuotePayload(
    makeSnapshot({
      customer: { companyName: 'Công ty Draft', phone: '0900000000' },
      preparedBy: { name: 'BD Draft', title: 'Sales' }
    }),
    { companyName: 'Công ty Draft', phone: '0900000000' },
    { name: 'BD Draft', title: 'Sales' },
    {
      quoteDateInput: new Date('2026-05-05T00:00:00.000Z'),
      quoteIdentity: buildQuoteIdentity('XMS-260505-002', 1)
    }
  );
  const manifest = buildEmbeddedManifest(payload, {
    appVersion: '1.11.2',
    exportedAt: '2026-05-05T11:00:00.000Z'
  });

  const result = await saveDraftFile({
    app: { getPath: () => tmpDir },
    dialog: { showSaveDialog: async () => ({ filePath }) },
    manifest
  });
  assert.equal(result?.filePath, filePath);

  const extracted = await extractManifestFromDraftFile(filePath);
  assert.equal(extracted.manifest.quoteIdentity.displayQuoteNumber, 'XMS-260505-002-R1');
  assert.equal(extracted.manifest.customer.phone, '0900000000');
  assert.equal(extracted.manifest.preparedBy.title, 'Sales');
  assert.equal(extracted.manifest.stores[0]?.area, '100');
});
