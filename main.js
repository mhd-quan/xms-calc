const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exportQuote } = require('./quote-exporter');
const { calculateTotals } = require('./calculator');
const {
  buildQuotePayload,
  buildEmbeddedManifest,
  normalizeCalcOptions,
  normalizePreparedBy,
  normalizeProfile,
  normalizeStores
} = require('./quote-payload');
const {
  EMBEDDED_PAYLOAD_SCHEMA_VERSION,
  buildQuoteIdentity,
  generateBaseQuoteCode,
  getQuoteSequencePrefix
} = require('./quote-identity-service');
const { QuoteRepository } = require('./quote-repository');
const {
  buildImportPreview,
  buildImportedSnapshot,
  extractManifestFromPdfFile
} = require('./pdf-import-service');

let quoteRepository;

function ensureRepository() {
  if (!quoteRepository) {
    quoteRepository = new QuoteRepository(
      path.join(app.getPath('userData'), 'xms-quote-workflow.sqlite')
    );
  }
  return quoteRepository;
}

function normalizeSnapshot(snapshot, options = {}) {
  const { recomputeTotals = false } = options;
  const stores = normalizeStores(snapshot?.stores);
  const calcOptions = normalizeCalcOptions(snapshot?.calcOptions);
  return {
    customer: normalizeProfile(snapshot?.customer),
    preparedBy: normalizePreparedBy(snapshot?.preparedBy),
    calcOptions,
    stores,
    totals: recomputeTotals
      ? calculateTotals(stores, calcOptions).totals
      : { ...(snapshot?.totals || {}) }
  };
}

function createNewQuoteFromSnapshot(snapshot) {
  const repository = ensureRepository();
  const sequencePrefix = getQuoteSequencePrefix(new Date());
  const quoteCode = generateBaseQuoteCode(
    new Date(),
    repository.findNextSequence(sequencePrefix)
  );
  return repository.createBaseQuoteRevision({
    quoteCode,
    snapshot: normalizeSnapshot(snapshot),
    source: 'new'
  });
}

function resolveImport(preview, action) {
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

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 920,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Native macOS feel (traffic lights integrated)
    trafficLightPosition: { x: 20, y: 22 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  ensureRepository();
  createWindow();

  ipcMain.handle('get-startup-revision', async () => {
    const latestRevision = ensureRepository().getLatestDraftRevision();
    return latestRevision ? ensureRepository().getRevisionBundle(latestRevision.id) : null;
  });

  ipcMain.handle('create-new-quote', async (_event, snapshot) => {
    const revision = createNewQuoteFromSnapshot(snapshot);
    return ensureRepository().getRevisionBundle(revision.id);
  });

  ipcMain.handle('load-quote-revision', async (_event, revisionId) => {
    return ensureRepository().getRevisionBundle(revisionId);
  });

  ipcMain.handle('save-quote-draft', async (_event, { revisionId, snapshot }) => {
    const repository = ensureRepository();
    return repository.updateRevisionSnapshot({
      revisionId,
      snapshot: normalizeSnapshot(snapshot)
    });
  });

  ipcMain.handle('create-new-revision', async (_event, { revisionId, snapshot }) => {
    const repository = ensureRepository();
    const newRevision = repository.createNextRevisionFromCurrent({
      revisionId,
      snapshot: normalizeSnapshot(snapshot),
      source: 'clone'
    });
    return repository.getRevisionBundle(newRevision.id);
  });

  ipcMain.handle('export-quote', async (event, { revisionId, snapshot }) => {
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

    const quoteIdentity = buildQuoteIdentity(
      currentRevision.quoteCode,
      currentRevision.revisionNumber
    );
    const payload = buildQuotePayload(
      normalizedSnapshot,
      normalizedSnapshot.customer,
      normalizedSnapshot.preparedBy,
      {
        quoteIdentity,
        quoteDateInput: new Date()
      }
    );
    const exportedAt = new Date().toISOString();
    const manifest = buildEmbeddedManifest(payload, {
      appVersion: app.getVersion(),
      exportedAt
    });

    const exportResult = await exportQuote({
      BrowserWindow,
      app,
      dialog,
      payload,
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
    return {
      filePath: exportResult.filePath,
      bundle: repository.getRevisionBundle(exportedRevision.id)
    };
  });

  ipcMain.handle('import-quote-pdf-preview', async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = parentWindow
      ? await dialog.showOpenDialog(parentWindow, {
          title: 'Chọn báo giá PDF để import',
          properties: ['openFile'],
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        })
      : await dialog.showOpenDialog({
          title: 'Chọn báo giá PDF để import',
          properties: ['openFile'],
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        });

    if (canceled || !filePaths.length) return null;
    const extracted = await extractManifestFromPdfFile(filePaths[0]);
    return buildImportPreview({
      ...extracted,
      repository: ensureRepository()
    });
  });

  ipcMain.handle('confirm-import-quote-pdf', async (_event, { preview, action }) => {
    if (!preview || !preview.filePath) {
      throw new Error('Thiếu dữ liệu import preview.');
    }

    const reloadedPreview = buildImportPreview({
      ...(await extractManifestFromPdfFile(preview.filePath)),
      repository: ensureRepository()
    });
    const selectedAction = action || reloadedPreview.recommendedAction;
    const resolvedRevision = resolveImport(reloadedPreview, selectedAction);
    return ensureRepository().getRevisionBundle(resolvedRevision.id);
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (quoteRepository) {
    quoteRepository.close();
    quoteRepository = null;
  }
});
