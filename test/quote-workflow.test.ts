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
