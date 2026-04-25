import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  AFRelationship,
  decodePDFRawStream
} from 'pdf-lib';
import { EMBEDDED_PAYLOAD_SCHEMA_VERSION, buildQuoteIdentity } from './quote-identity-service';
import { buildDraftSnapshotFromManifest } from './quote-payload';
import type { QuoteRepository } from './quote-repository';
import type { EmbeddedManifest, ImportAction, ImportPreview } from '../shared/types';

export const EMBEDDED_MANIFEST_FILENAME = 'xms-quote-manifest.json';

export function createPdfFingerprint(pdfBytes: Uint8Array): string {
  return crypto.createHash('sha256').update(pdfBytes).digest('hex');
}

function decodePdfText(object: unknown): string {
  if (object instanceof PDFHexString || object instanceof PDFString) {
    return object.decodeText();
  }
  return '';
}

function readEmbeddedManifestBytes(pdfDoc: PDFDocument): Uint8Array {
  const namesDict = pdfDoc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  const embeddedFilesDict = namesDict?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  const namesArray = embeddedFilesDict?.lookupMaybe(PDFName.of('Names'), PDFArray);

  if (!namesArray || namesArray.size() === 0) {
    throw new Error('PDF không có embedded manifest hợp lệ.');
  }

  for (let index = 0; index < namesArray.size(); index += 2) {
    const fileName = decodePdfText(namesArray.get(index));
    const fileSpec = namesArray.lookup(index + 1, PDFDict);
    if (!fileSpec || fileName !== EMBEDDED_MANIFEST_FILENAME) continue;

    const embeddedFileDict = fileSpec.lookupMaybe(PDFName.of('EF'), PDFDict);
    const embeddedStream = embeddedFileDict?.lookup(PDFName.of('F')) as PDFRawStream | undefined;
    if (!embeddedStream) {
      throw new Error('Embedded manifest không thể đọc được.');
    }

    return decodePDFRawStream(embeddedStream).decode();
  }

  throw new Error('PDF không chứa manifest của XMS Quote Workflow.');
}

export function validateManifestSchema(manifest: unknown): asserts manifest is EmbeddedManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest báo giá không hợp lệ.');
  }
  const typed = manifest as Partial<EmbeddedManifest>;
  if (typed.schemaVersion !== EMBEDDED_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(
      `PDF schema ${typed.schemaVersion || 'unknown'} chưa được hỗ trợ. Chỉ import PDF từ v${EMBEDDED_PAYLOAD_SCHEMA_VERSION}+ của app.`
    );
  }
  if (!typed.quoteIdentity || !typed.quoteIdentity.quoteCode) {
    throw new Error('Manifest báo giá thiếu thông tin định danh quote.');
  }
}

export async function embedManifestInPdf(pdfBytes: Uint8Array, manifest: EmbeddedManifest): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const manifestBytes = Buffer.from(JSON.stringify(manifest), 'utf8');
  const timestamp = manifest.exportedAt ? new Date(manifest.exportedAt) : new Date();
  await pdfDoc.attach(manifestBytes, EMBEDDED_MANIFEST_FILENAME, {
    mimeType: 'application/json',
    description: 'XMS Quote Workflow embedded manifest',
    creationDate: timestamp,
    modificationDate: timestamp,
    afRelationship: AFRelationship.Data
  });
  pdfDoc.setSubject(`XMS Quote Workflow Manifest ${manifest.schemaVersion}`);
  pdfDoc.setKeywords(['xms-quote', `schema-${manifest.schemaVersion}`, manifest.quoteIdentity.displayQuoteNumber || '']);
  return pdfDoc.save();
}

export async function extractManifestFromPdfBytes(pdfBytes: Uint8Array): Promise<EmbeddedManifest> {
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  } catch (_error) {
    throw new Error('File đã chọn không phải PDF hợp lệ.');
  }

  const manifestBytes = readEmbeddedManifestBytes(pdfDoc);
  let manifest: unknown;
  try {
    manifest = JSON.parse(Buffer.from(manifestBytes).toString('utf8'));
  } catch (_error) {
    throw new Error('Manifest trong PDF bị hỏng hoặc không đọc được.');
  }
  validateManifestSchema(manifest);
  return manifest;
}

export async function extractManifestFromPdfFile(filePath: string): Promise<{
  filePath: string;
  fileName: string;
  fingerprint: string;
  manifest: EmbeddedManifest;
}> {
  const pdfBytes = await fs.readFile(filePath);
  const manifest = await extractManifestFromPdfBytes(pdfBytes);
  return {
    filePath,
    fileName: path.basename(filePath),
    fingerprint: createPdfFingerprint(pdfBytes),
    manifest
  };
}

export function buildImportPreview({
  filePath,
  fileName,
  fingerprint,
  manifest,
  repository
}: {
  filePath: string;
  fileName: string;
  fingerprint: string;
  manifest: EmbeddedManifest;
  repository: QuoteRepository;
}): ImportPreview {
  const quoteIdentity = buildQuoteIdentity(manifest.quoteIdentity.quoteCode, manifest.quoteIdentity.revisionNumber);
  const existingQuote = repository.getQuoteByCode(quoteIdentity.quoteCode);
  const existingRevision = repository.getRevisionByIdentity(quoteIdentity.quoteCode, quoteIdentity.revisionNumber);

  let conflictType: 'new_quote' | 'attach_existing_chain' | 'same_file' | 'revision_conflict' = 'new_quote';
  let recommendedAction: ImportAction['key'] = 'import_new_quote';
  let actions: ImportAction[] = [{ key: 'import_new_quote', label: 'Import revision' }];
  let existingRevisionId: number | null = null;
  let summary = 'Quote code chưa tồn tại trong local DB. Import sẽ tạo quote chain mới.';

  if (existingQuote && !existingRevision) {
    conflictType = 'attach_existing_chain';
    recommendedAction = 'attach_to_existing_chain';
    actions = [{ key: 'attach_to_existing_chain', label: 'Attach vào quote chain' }];
    summary =
      quoteIdentity.revisionNumber > existingQuote.currentRevisionNumber
        ? 'Revision mới hơn bản đang có. Import sẽ attach vào chain hiện tại.'
        : 'Revision này sẽ được attach vào quote chain hiện có như một revision lịch sử.';
  }

  if (existingRevision) {
    existingRevisionId = existingRevision.id;
    if (existingRevision.pdfFingerprint && existingRevision.pdfFingerprint === fingerprint) {
      conflictType = 'same_file';
      recommendedAction = 'open_existing';
      actions = [{ key: 'open_existing', label: 'Open existing' }];
      summary = 'File này đã được import/export trước đó. Có thể mở revision hiện có.';
    } else {
      conflictType = 'revision_conflict';
      recommendedAction = 'replace_existing_revision';
      actions = [
        { key: 'replace_existing_revision', label: 'Replace existing revision' },
        { key: 'import_duplicate_quote_copy', label: 'Import as duplicate quote code copy' }
      ];
      summary = 'Cùng quote code và revision number nhưng fingerprint khác. Cần chọn cách xử lý conflict.';
    }
  }

  return {
    filePath,
    fileName,
    fingerprint,
    manifest,
    quoteIdentity,
    existingRevisionId,
    conflictType,
    recommendedAction,
    actions,
    summary,
    preview: {
      displayQuoteNumber: quoteIdentity.displayQuoteNumber,
      quoteCode: quoteIdentity.quoteCode,
      revisionNumber: quoteIdentity.revisionNumber,
      revisionLabel: quoteIdentity.revisionLabel,
      customerName: manifest.customer?.companyName || '-',
      branchCount: Array.isArray(manifest.stores) ? manifest.stores.length : 0,
      grandTotal: manifest.totals?.grand || 0,
      manifestCompatibility: `Schema ${manifest.schemaVersion}`,
      exportedAt: manifest.exportedAt || '',
      hasExistingQuote: Boolean(existingQuote)
    }
  };
}

export function buildImportedSnapshot(preview: { manifest: EmbeddedManifest }): ReturnType<typeof buildDraftSnapshotFromManifest> {
  return buildDraftSnapshotFromManifest(preview.manifest);
}
