import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

import { buildImportPreview, buildImportedSnapshot, extractManifestFromPdfFile } from '../services/pdf-import-service';
import { EMBEDDED_PAYLOAD_SCHEMA_VERSION, buildQuoteIdentity, generateBaseQuoteCode, getQuoteSequencePrefix } from '../services/quote-identity-service';
import { buildEmbeddedManifest, buildQuotePayload, normalizeCalcOptions, normalizePreparedBy, normalizeProfile, normalizeStores } from '../services/quote-payload';
import { exportQuote } from '../services/quote-exporter';
import { exportExcel } from '../services/excel-exporter';
import { DRAFT_FILE_EXTENSION, extractManifestFromDraftFile, saveDraftFile } from '../services/draft-file-service';
import { QuoteRepository } from '../services/quote-repository';
import { HistoryService } from '../services/history-service';
import { calculateTotals } from '../shared/calculator';

import type {
  ConfirmImportQuotePdfPayload,
  CreateNewRevisionPayload,
  ExportQuotePayload,
  SaveQuoteDraftPayload
} from '../shared/preload-contract';
import type { EmbeddedManifest, ImportActionKey, ImportPreview, QuotePayload, QuoteSnapshot, RevisionBundle } from '../shared/types';
import type { DialogLike } from '../services/quote-exporter';

let quoteRepository: QuoteRepository | null = null;
let historyService: HistoryService | null = null;

function resolvePreloadPath(): string {
  const preloadCandidates = [
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, 'preload.mjs'),
    path.join(__dirname, '../preload/preload.js'),
    path.join(__dirname, '../preload/preload.mjs')
  ];
  const matchedPath = preloadCandidates.find((candidate) => fs.existsSync(candidate));
  return matchedPath || preloadCandidates[0] || path.join(__dirname, 'preload.js');
}

function ensureRepository(): QuoteRepository {
  if (!quoteRepository) {
    quoteRepository = new QuoteRepository(path.join(app.getPath('userData'), 'xms-quote-workflow.sqlite'));
  }
  return quoteRepository;
}

function normalizeSnapshot(snapshot: QuoteSnapshot, options: { recomputeTotals?: boolean } = {}): QuoteSnapshot {
  const { recomputeTotals = false } = options;
  const stores = normalizeStores(snapshot?.stores);
  const calcOptions = normalizeCalcOptions(snapshot?.calcOptions);
  return {
    customer: normalizeProfile(snapshot?.customer),
    preparedBy: normalizePreparedBy(snapshot?.preparedBy),
    calcOptions,
    stores,
    totals: recomputeTotals ? calculateTotals(stores, calcOptions).totals : { ...(snapshot?.totals || {}) }
  };
}

function createNewQuoteFromSnapshot(snapshot: QuoteSnapshot) {
  const repository = ensureRepository();
  const sequencePrefix = getQuoteSequencePrefix(new Date());
  const quoteCode = generateBaseQuoteCode(new Date(), repository.findNextSequence(sequencePrefix));
  return repository.createBaseQuoteRevision({
    quoteCode,
    snapshot: normalizeSnapshot(snapshot),
    source: 'new'
  });
}

function prepareQuoteFileContext(ipcPayload: ExportQuotePayload): {
  repository: QuoteRepository;
  revisionId: number;
  normalizedSnapshot: QuoteSnapshot;
  quotePayload: QuotePayload;
  manifest: EmbeddedManifest;
  exportedAt: string;
} {
  const { revisionId, snapshot } = ipcPayload;
  const repository = ensureRepository();
  const normalizedSnapshot = normalizeSnapshot(snapshot, { recomputeTotals: true });
  const currentRevision = repository.getRevisionById(revisionId);
  if (!currentRevision) {
    throw new Error('Không tìm thấy revision đang mở để export.');
  }

  repository.updateRevisionSnapshot({
    revisionId,
    snapshot: normalizedSnapshot
  });

  const quoteIdentity = buildQuoteIdentity(currentRevision.quoteCode, currentRevision.revisionNumber);
  const quotePayload = buildQuotePayload(normalizedSnapshot, normalizedSnapshot.customer, normalizedSnapshot.preparedBy, {
    quoteIdentity,
    quoteDateInput: new Date()
  });
  const exportedAt = new Date().toISOString();
  const manifest = buildEmbeddedManifest(quotePayload, {
    appVersion: app.getVersion(),
    exportedAt
  });

  return {
    repository,
    revisionId,
    normalizedSnapshot,
    quotePayload,
    manifest,
    exportedAt
  };
}

function resolveImport(preview: ImportPreview, action: ImportActionKey) {
  const repository = ensureRepository();
  const importedSnapshot = buildImportedSnapshot(preview);
  const exportedAt = preview.manifest.exportedAt || new Date().toISOString();

  if (action === 'open_existing') {
    if (!preview.existingRevisionId) {
      throw new Error('Không tìm thấy revision hiện có để mở.');
    }
    return repository.getRevisionById(preview.existingRevisionId);
  }

  if (action === 'replace_existing_revision') {
    if (!preview.existingRevisionId) {
      throw new Error('Không tìm thấy revision hiện có để thay thế.');
    }
    return repository.replaceRevisionFromImport({
      revisionId: preview.existingRevisionId,
      snapshot: importedSnapshot,
      embeddedPayloadVersion: preview.manifest.schemaVersion,
      pdfFilePath: preview.filePath,
      pdfFingerprint: preview.fingerprint,
      exportedAt
    });
  }

  if (action === 'import_duplicate_quote_copy') {
    const duplicateQuoteCode = repository.generateDuplicateQuoteCode(preview.quoteIdentity.quoteCode);
    const duplicateQuoteId = repository.createQuote({
      quoteCode: duplicateQuoteCode,
      revisionNumber: preview.quoteIdentity.revisionNumber,
      status: 'imported'
    });
    return repository.createRevision({
      quoteId: duplicateQuoteId,
      quoteCode: duplicateQuoteCode,
      revisionNumber: preview.quoteIdentity.revisionNumber,
      source: 'import_pdf',
      snapshot: importedSnapshot,
      embeddedPayloadVersion: preview.manifest.schemaVersion,
      pdfFilePath: preview.filePath,
      pdfFingerprint: preview.fingerprint,
      exportedAt
    });
  }

  const existingQuote = repository.getQuoteByCode(preview.quoteIdentity.quoteCode);
  if (existingQuote) {
    return repository.createRevision({
      quoteId: existingQuote.id,
      quoteCode: preview.quoteIdentity.quoteCode,
      revisionNumber: preview.quoteIdentity.revisionNumber,
      source: 'import_pdf',
      snapshot: importedSnapshot,
      embeddedPayloadVersion: preview.manifest.schemaVersion,
      pdfFilePath: preview.filePath,
      pdfFingerprint: preview.fingerprint,
      exportedAt
    });
  }

  const newQuoteId = repository.createQuote({
    quoteCode: preview.quoteIdentity.quoteCode,
    revisionNumber: preview.quoteIdentity.revisionNumber,
    status: 'imported'
  });
  return repository.createRevision({
    quoteId: newQuoteId,
    quoteCode: preview.quoteIdentity.quoteCode,
    revisionNumber: preview.quoteIdentity.revisionNumber,
    source: 'import_pdf',
    snapshot: importedSnapshot,
    embeddedPayloadVersion: preview.manifest.schemaVersion,
    pdfFilePath: preview.filePath,
    pdfFingerprint: preview.fingerprint,
    exportedAt
  });
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1080,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 22 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolvePreloadPath()
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  ensureRepository();
  historyService = new HistoryService(30);
  await historyService.initialize();
  createWindow();

  ipcMain.handle('get-startup-revision', async (): Promise<RevisionBundle | null> => {
    const latestRevision = ensureRepository().getLatestDraftRevision();
    return latestRevision ? ensureRepository().getRevisionBundle(latestRevision.id) : null;
  });

  ipcMain.handle('create-new-quote', async (_event, snapshot: QuoteSnapshot): Promise<RevisionBundle | null> => {
    const revision = createNewQuoteFromSnapshot(snapshot);
    return revision ? ensureRepository().getRevisionBundle(revision.id) : null;
  });

  ipcMain.handle('load-quote-revision', async (_event, revisionId: number): Promise<RevisionBundle | null> => {
    return ensureRepository().getRevisionBundle(revisionId);
  });

  ipcMain.handle('save-quote-draft', async (_event, payload: SaveQuoteDraftPayload) => {
    const { revisionId, snapshot } = payload;
    const repository = ensureRepository();
    return repository.updateRevisionSnapshot({
      revisionId,
      snapshot: normalizeSnapshot(snapshot)
    });
  });

  ipcMain.handle('create-new-revision', async (_event, payload: CreateNewRevisionPayload): Promise<RevisionBundle | null> => {
    const { revisionId, snapshot } = payload;
    const repository = ensureRepository();
    const newRevision = repository.createNextRevisionFromCurrent({
      revisionId,
      snapshot: normalizeSnapshot(snapshot),
      source: 'clone'
    });
    return newRevision ? repository.getRevisionBundle(newRevision.id) : null;
  });

  ipcMain.handle('export-quote', async (event, ipcPayload: ExportQuotePayload) => {
    const { repository, revisionId, normalizedSnapshot, quotePayload, manifest, exportedAt } = prepareQuoteFileContext(ipcPayload);

    const exportResult = await exportQuote({
      BrowserWindow,
      app,
      dialog: dialog as unknown as DialogLike,
      payload: quotePayload,
      manifest,
      parentWindow: BrowserWindow.fromWebContents(event.sender)
    });

    if (!exportResult) return null;

    const exportedRevision = repository.markRevisionExported({
      revisionId,
      snapshot: normalizedSnapshot,
      embeddedPayloadVersion: EMBEDDED_PAYLOAD_SCHEMA_VERSION,
      pdfFilePath: exportResult.filePath,
      pdfFingerprint: exportResult.fingerprint,
      exportedAt
    });

    if (!exportedRevision) {
      throw new Error('Không thể đánh dấu trạng thái export cho revision.');
    }

    return {
      filePath: exportResult.filePath,
      bundle: repository.getRevisionBundle(exportedRevision.id)
    };
  });

  ipcMain.handle('export-quote-excel', async (event, ipcPayload: ExportQuotePayload) => {
    const { repository, revisionId, normalizedSnapshot, quotePayload, manifest, exportedAt } = prepareQuoteFileContext(ipcPayload);

    const exportResult = await exportExcel({
      app,
      dialog: dialog as unknown as DialogLike,
      payload: quotePayload,
      manifest,
      parentWindow: BrowserWindow.fromWebContents(event.sender)
    });

    if (!exportResult) return null;

    const exportedRevision = repository.markRevisionExported({
      revisionId,
      snapshot: normalizedSnapshot,
      embeddedPayloadVersion: EMBEDDED_PAYLOAD_SCHEMA_VERSION,
      pdfFilePath: exportResult.filePath,
      pdfFingerprint: exportResult.fingerprint,
      exportedAt
    });

    if (!exportedRevision) {
      throw new Error('Không thể đánh dấu trạng thái export cho revision.');
    }

    return {
      filePath: exportResult.filePath,
      bundle: repository.getRevisionBundle(exportedRevision.id)
    };
  });

  ipcMain.handle('save-quote-draft-file', async (event, ipcPayload: ExportQuotePayload) => {
    const { manifest } = prepareQuoteFileContext(ipcPayload);
    const result = await saveDraftFile({
      app,
      dialog: dialog as unknown as DialogLike,
      manifest,
      parentWindow: BrowserWindow.fromWebContents(event.sender)
    });

    return result ? { filePath: result.filePath } : null;
  });

  ipcMain.handle('import-quote-pdf-preview', async (event): Promise<ImportPreview | null> => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = parentWindow
      ? await dialog.showOpenDialog(parentWindow, {
          title: 'Chọn báo giá để import',
          properties: ['openFile'],
          filters: [{ name: 'Supported Files', extensions: ['pdf', 'xlsx', DRAFT_FILE_EXTENSION] }]
        })
      : await dialog.showOpenDialog({
          title: 'Chọn báo giá để import',
          properties: ['openFile'],
          filters: [{ name: 'Supported Files', extensions: ['pdf', 'xlsx', DRAFT_FILE_EXTENSION] }]
        });

    if (canceled || !filePaths.length) return null;
    const selectedFilePath = filePaths[0];
    if (!selectedFilePath) return null;

    let extracted;
    const extension = path.extname(selectedFilePath).toLowerCase();
    if (extension === '.xlsx') {
      const { extractManifestFromExcelFile } = await import('../services/excel-import-service');
      extracted = await extractManifestFromExcelFile(selectedFilePath);
    } else if (extension === `.${DRAFT_FILE_EXTENSION}`) {
      extracted = await extractManifestFromDraftFile(selectedFilePath);
    } else {
      extracted = await extractManifestFromPdfFile(selectedFilePath);
    }
    
    return buildImportPreview({
      ...extracted,
      repository: ensureRepository()
    });
  });

  ipcMain.handle('confirm-import-quote-pdf', async (_event, payload: ConfirmImportQuotePdfPayload): Promise<RevisionBundle | null> => {
    const { preview, action } = payload;
    if (!preview || !preview.filePath) {
      throw new Error('Thiếu dữ liệu import preview.');
    }

    let extracted;
    const extension = path.extname(preview.filePath).toLowerCase();
    if (extension === '.xlsx') {
      const { extractManifestFromExcelFile } = await import('../services/excel-import-service');
      extracted = await extractManifestFromExcelFile(preview.filePath);
    } else if (extension === `.${DRAFT_FILE_EXTENSION}`) {
      extracted = await extractManifestFromDraftFile(preview.filePath);
    } else {
      extracted = await extractManifestFromPdfFile(preview.filePath);
    }

    const reloadedPreview = buildImportPreview({
      ...extracted,
      repository: ensureRepository()
    });
    const selectedAction = action || reloadedPreview.recommendedAction;
    const resolvedRevision = resolveImport(reloadedPreview, selectedAction);
    if (!resolvedRevision) {
      throw new Error('Không thể hoàn tất import từ dữ liệu PDF.');
    }
    return ensureRepository().getRevisionBundle(resolvedRevision.id);
  });

  ipcMain.handle('history:push', async (_event, snapshot: QuoteSnapshot) => {
    if (historyService) {
      await historyService.push(snapshot);
    }
  });

  ipcMain.handle('history:undo', async () => {
    if (historyService) {
      return await historyService.undo();
    }
    return null;
  });

  ipcMain.handle('history:redo', async () => {
    if (historyService) {
      return await historyService.redo();
    }
    return null;
  });

  ipcMain.handle('history:clear', async () => {
    if (historyService) {
      await historyService.clear();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (quoteRepository) {
    quoteRepository.close();
    quoteRepository = null;
  }
});
