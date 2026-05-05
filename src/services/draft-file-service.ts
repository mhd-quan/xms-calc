import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateManifestSchema } from './pdf-import-service';
import { safeFilePart } from './quote-exporter';

import type { EmbeddedManifest } from '../shared/types';
import type { DialogLike } from './quote-exporter';

export const DRAFT_FILE_EXTENSION = 'xmsdraft';
export const DRAFT_FILE_FORMAT = 'xms-calc-draft';

type AppLike = {
  getPath(name: 'documents'): string;
};

type DraftEnvelope = {
  format: typeof DRAFT_FILE_FORMAT;
  schemaVersion: string;
  savedAt: string;
  manifest: EmbeddedManifest;
};

function createDraftFingerprint(fileBytes: Uint8Array): string {
  return crypto.createHash('sha256').update(fileBytes).digest('hex');
}

function getDefaultDraftPath(app: AppLike, manifest: EmbeddedManifest): string {
  const customerFileName = safeFilePart(manifest.customer?.companyName, 'KhachHang');
  const quoteNumber = safeFilePart(manifest.quoteIdentity.displayQuoteNumber, 'BaoGia');
  return path.join(app.getPath('documents'), `${quoteNumber}_${customerFileName}.${DRAFT_FILE_EXTENSION}`);
}

function isDraftEnvelope(value: unknown): value is DraftEnvelope {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Partial<DraftEnvelope>).format === DRAFT_FILE_FORMAT &&
      (value as Partial<DraftEnvelope>).manifest
  );
}

export async function saveDraftFile({
  app,
  dialog,
  manifest,
  parentWindow = null
}: {
  app: AppLike;
  dialog: DialogLike;
  manifest: EmbeddedManifest;
  parentWindow?: unknown;
}): Promise<{ filePath: string; fingerprint: string } | null> {
  validateManifestSchema(manifest);

  const dialogOptions = {
    title: 'Lưu draft báo giá',
    defaultPath: getDefaultDraftPath(app, manifest),
    filters: [{ name: 'XMS Draft Files', extensions: [DRAFT_FILE_EXTENSION] }]
  };
  const { filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (!filePath) return null;

  const envelope: DraftEnvelope = {
    format: DRAFT_FILE_FORMAT,
    schemaVersion: manifest.schemaVersion,
    savedAt: new Date().toISOString(),
    manifest
  };
  const fileBytes = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  await fs.writeFile(filePath, fileBytes);
  return {
    filePath,
    fingerprint: createDraftFingerprint(fileBytes)
  };
}

export async function extractManifestFromDraftFile(filePath: string): Promise<{
  filePath: string;
  fileName: string;
  fingerprint: string;
  manifest: EmbeddedManifest;
}> {
  const fileBytes = await fs.readFile(filePath);
  const fingerprint = createDraftFingerprint(fileBytes);

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(fileBytes).toString('utf8'));
  } catch {
    throw new Error('File draft không phải JSON hợp lệ.');
  }

  const manifest = isDraftEnvelope(parsed) ? parsed.manifest : parsed;
  validateManifestSchema(manifest);

  return {
    filePath,
    fileName: path.basename(filePath),
    fingerprint,
    manifest
  };
}
