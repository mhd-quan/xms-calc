import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
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
      billingCycle: 'y',
      globalBoxCount: 1,
      hasAccountFee: true,
      hasQTG: true,
      hasQLQ: true,
      globalDiscounts: { account: 0, box: 0, qtg: 0, qlq: 0 },
      discountEnabled: { account: false, box: false, qtg: false, qlq: false }
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
