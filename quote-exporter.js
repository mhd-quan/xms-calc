const fs = require('fs/promises');
const path = require('path');
const { performance } = require('perf_hooks');
const { embedManifestInPdf, createPdfFingerprint } = require('./pdf-import-service');

const EXPORT_TIMEOUT_MS = 30000;
let cachedPrintWindow = null;
let cachedTemplatePath = null;
let cachedTemplateReady = false;

function safeFilePart(value, fallback) {
  const normalized = String(value || fallback)
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\p{M}._ -]+/gu, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function validateQuotePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid quote payload');
  }
  if (!payload.meta || typeof payload.meta !== 'object') {
    throw new Error('Invalid quote payload: missing meta');
  }
  if (!payload.meta.customer || typeof payload.meta.customer !== 'object') {
    throw new Error('Invalid quote payload: missing customer');
  }
  if (!Array.isArray(payload.stores)) {
    throw new Error('Invalid quote payload: missing stores');
  }
  if (!payload.totals || typeof payload.totals !== 'object') {
    throw new Error('Invalid quote payload: missing totals');
  }
  if (!payload.globals || typeof payload.globals !== 'object') {
    throw new Error('Invalid quote payload: missing globals');
  }
  if (!payload.quoteIdentity || typeof payload.quoteIdentity !== 'object') {
    throw new Error('Invalid quote payload: missing quote identity');
  }
}

function getDefaultPath(app, payload) {
  const customerFileName = safeFilePart(
    payload.customer?.companyName || payload.meta.customer.companyName || payload.meta.customerName,
    'KhachHang'
  );
  const quoteNumber = safeFilePart(
    payload.quoteIdentity.displayQuoteNumber || payload.meta.displayQuoteNumber,
    'BaoGia'
  );
  return path.join(app.getPath('documents'), `${quoteNumber}_${customerFileName}.pdf`);
}

async function getMemorySnapshot() {
  const snapshot = {
    node: process.memoryUsage()
  };
  if (typeof process.getProcessMemoryInfo === 'function') {
    try {
      snapshot.electron = await process.getProcessMemoryInfo();
    } catch (err) {
      snapshot.electronError = err.message;
    }
  }
  return snapshot;
}

function logExportPerf(app, timings, details) {
  if (app.isPackaged && process.env.NODE_ENV !== 'development') return;
  console.info('[quote-export]', {
    timingsMs: Object.fromEntries(
      Object.entries(timings).map(([key, value]) => [key, Math.round(value)])
    ),
    pdfBytes: details.pdfBytes,
    memoryBefore: details.memoryBefore,
    memoryAfter: details.memoryAfter
  });
}

function raceTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Quote export timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  promise.catch(() => {});
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function loadFileWithFailureHandling(browserWindow, filePath) {
  let onFail;
  const failedLoad = new Promise((_, reject) => {
    onFail = (_event, errorCode, errorDescription, validatedURL) => {
      reject(new Error(`Failed to load quote template (${errorCode}): ${errorDescription || validatedURL}`));
    };
    browserWindow.webContents.once('did-fail-load', onFail);
  });

  try {
    await Promise.race([browserWindow.loadFile(filePath), failedLoad]);
  } finally {
    browserWindow.webContents.removeListener('did-fail-load', onFail);
  }
}

function createPrintWindow(BrowserWindow) {
  const browserWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  browserWindow.on('closed', () => {
    cachedPrintWindow = null;
    cachedTemplatePath = null;
    cachedTemplateReady = false;
  });
  return browserWindow;
}

async function getPrintWindow(BrowserWindow, templatePath) {
  if (!cachedPrintWindow || cachedPrintWindow.isDestroyed()) {
    cachedPrintWindow = createPrintWindow(BrowserWindow);
    cachedTemplateReady = false;
    cachedTemplatePath = null;
  }

  if (!cachedTemplateReady || cachedTemplatePath !== templatePath) {
    await loadFileWithFailureHandling(cachedPrintWindow, templatePath);
    cachedTemplateReady = true;
    cachedTemplatePath = templatePath;
  }

  return cachedPrintWindow;
}

async function exportQuote({
  BrowserWindow,
  app,
  dialog,
  payload,
  manifest,
  parentWindow = null,
  templatePath = path.join(__dirname, 'quote-template', 'template.html')
}) {
  validateQuotePayload(payload);
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid export manifest');
  }

  let printWin;
  const timings = {};
  const memoryBefore = await getMemorySnapshot();
  const exportStart = performance.now();

  const dialogOptions = {
    title: 'Lưu báo giá PDF',
    defaultPath: getDefaultPath(app, payload),
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  };
  const { filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (!filePath) {
    return null;
  }

  const renderAndPrint = (async () => {
    const createStart = performance.now();
    printWin = await getPrintWindow(BrowserWindow, templatePath);
    timings.createWindow = performance.now() - createStart;

    const renderStart = performance.now();
    await printWin.webContents.executeJavaScript(`window.renderQuote(${JSON.stringify(payload)})`, true);
    timings.renderTemplate = performance.now() - renderStart;

    const pdfStart = performance.now();
    const pdfData = await printWin.webContents.printToPDF({
      pageSize: 'A4',
      landscape: false,
      printBackground: true
    });
    timings.printToPDF = performance.now() - pdfStart;
    return pdfData;
  })();

  try {
    const pdfData = await raceTimeout(renderAndPrint, EXPORT_TIMEOUT_MS);
    const embedStart = performance.now();
    const finalPdfData = await embedManifestInPdf(pdfData, manifest);
    timings.embedManifest = performance.now() - embedStart;

    const writeStart = performance.now();
    await fs.writeFile(filePath, finalPdfData);
    timings.writeFile = performance.now() - writeStart;
    timings.total = performance.now() - exportStart;
    logExportPerf(app, timings, {
      pdfBytes: finalPdfData.length,
      memoryBefore,
      memoryAfter: await getMemorySnapshot()
    });
    return {
      filePath,
      fingerprint: createPdfFingerprint(finalPdfData)
    };
  } finally {
    if (printWin && printWin.isDestroyed()) {
      cachedPrintWindow = null;
      cachedTemplateReady = false;
      cachedTemplatePath = null;
    }
  }
}

module.exports = {
  EXPORT_TIMEOUT_MS,
  exportQuote,
  safeFilePart,
  validateQuotePayload
};
