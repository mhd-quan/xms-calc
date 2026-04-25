import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createPdfFingerprint, embedManifestInPdf } from './pdf-import-service';

export const EXPORT_TIMEOUT_MS = 30000;

type MemorySnapshot = {
  node: NodeJS.MemoryUsage;
  electron?: unknown;
  electronError?: string;
};

type QuotePayload = {
  meta: {
    customer?: { companyName?: string };
    customerName?: string;
    displayQuoteNumber?: string;
  };
  customer?: { companyName?: string };
  stores: unknown[];
  totals: Record<string, unknown>;
  globals: Record<string, unknown>;
  quoteIdentity: {
    displayQuoteNumber?: string;
  };
};

type ExportManifest = {
  schemaVersion: string;
  quoteIdentity: {
    displayQuoteNumber?: string;
  };
  exportedAt?: string;
  [key: string]: unknown;
};

type AppLike = {
  getPath(name: 'documents'): string;
  isPackaged?: boolean;
};

type DialogLike = {
  showSaveDialog: ((options: unknown) => Promise<{ filePath?: string }>) &
    ((parentWindow: BrowserWindowLike, options: unknown) => Promise<{ filePath?: string }>);
};

type WebContentsLike = {
  once(channel: 'did-fail-load', listener: (...args: unknown[]) => void): void;
  removeListener(channel: 'did-fail-load', listener: (...args: unknown[]) => void): void;
  executeJavaScript(script: string, userGesture: boolean): Promise<unknown>;
  printToPDF(options: { pageSize: 'A4'; landscape: boolean; printBackground: boolean }): Promise<Uint8Array>;
};

type BrowserWindowLike = {
  loadFile(filePath: string): Promise<void>;
  isDestroyed(): boolean;
  on(channel: 'closed', listener: () => void): void;
  webContents: WebContentsLike;
};

type BrowserWindowConstructor = new (options: {
  show: boolean;
  webPreferences: { nodeIntegration: boolean; contextIsolation: boolean };
}) => BrowserWindowLike;

let cachedPrintWindow: BrowserWindowLike | null = null;
let cachedTemplatePath: string | null = null;
let cachedTemplateReady = false;

export function safeFilePart(value: unknown, fallback: string): string {
  const normalized = String(value || fallback)
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\p{M}._ -]+/gu, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

export function validateQuotePayload(payload: unknown): asserts payload is QuotePayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid quote payload');
  }
  const typedPayload = payload as Partial<QuotePayload>;
  if (!typedPayload.meta || typeof typedPayload.meta !== 'object') {
    throw new Error('Invalid quote payload: missing meta');
  }
  if (!typedPayload.meta.customer || typeof typedPayload.meta.customer !== 'object') {
    throw new Error('Invalid quote payload: missing customer');
  }
  if (!Array.isArray(typedPayload.stores)) {
    throw new Error('Invalid quote payload: missing stores');
  }
  if (!typedPayload.totals || typeof typedPayload.totals !== 'object') {
    throw new Error('Invalid quote payload: missing totals');
  }
  if (!typedPayload.globals || typeof typedPayload.globals !== 'object') {
    throw new Error('Invalid quote payload: missing globals');
  }
  if (!typedPayload.quoteIdentity || typeof typedPayload.quoteIdentity !== 'object') {
    throw new Error('Invalid quote payload: missing quote identity');
  }
}

function getDefaultPath(app: AppLike, payload: QuotePayload): string {
  const customerFileName = safeFilePart(
    payload.customer?.companyName || payload.meta.customer?.companyName || payload.meta.customerName,
    'KhachHang'
  );
  const quoteNumber = safeFilePart(payload.quoteIdentity.displayQuoteNumber || payload.meta.displayQuoteNumber, 'BaoGia');
  return path.join(app.getPath('documents'), `${quoteNumber}_${customerFileName}.pdf`);
}

async function getMemorySnapshot(): Promise<MemorySnapshot> {
  const snapshot: MemorySnapshot = {
    node: process.memoryUsage()
  };
  const processWithElectron = process as NodeJS.Process & {
    getProcessMemoryInfo?: () => Promise<unknown>;
  };
  if (typeof processWithElectron.getProcessMemoryInfo === 'function') {
    try {
      snapshot.electron = await processWithElectron.getProcessMemoryInfo();
    } catch (err) {
      snapshot.electronError = err instanceof Error ? err.message : String(err);
    }
  }
  return snapshot;
}

function logExportPerf(app: AppLike, timings: Record<string, number>, details: {
  pdfBytes: number;
  memoryBefore: MemorySnapshot;
  memoryAfter: MemorySnapshot;
}): void {
  if (app.isPackaged && process.env.NODE_ENV !== 'development') return;
  console.info('[quote-export]', {
    timingsMs: Object.fromEntries(Object.entries(timings).map(([key, value]) => [key, Math.round(value)])),
    pdfBytes: details.pdfBytes,
    memoryBefore: details.memoryBefore,
    memoryAfter: details.memoryAfter
  });
}

function raceTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Quote export timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  promise.catch(() => undefined);
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function loadFileWithFailureHandling(browserWindow: BrowserWindowLike, filePath: string): Promise<void> {
  let onFail: ((...args: unknown[]) => void) | undefined;
  const failedLoad = new Promise<never>((_, reject) => {
    onFail = (_event, errorCode, errorDescription, validatedURL) => {
      reject(new Error(`Failed to load quote template (${String(errorCode)}): ${String(errorDescription || validatedURL)}`));
    };
    browserWindow.webContents.once('did-fail-load', onFail);
  });

  try {
    await Promise.race([browserWindow.loadFile(filePath), failedLoad]);
  } finally {
    if (onFail) {
      browserWindow.webContents.removeListener('did-fail-load', onFail);
    }
  }
}

function createPrintWindow(BrowserWindow: BrowserWindowConstructor): BrowserWindowLike {
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

async function getPrintWindow(BrowserWindow: BrowserWindowConstructor, templatePath: string): Promise<BrowserWindowLike> {
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

export async function exportQuote({
  BrowserWindow,
  app,
  dialog,
  payload,
  manifest,
  parentWindow = null,
  templatePath = path.join(__dirname, '../templates/quote/template.html')
}: {
  BrowserWindow: BrowserWindowConstructor;
  app: AppLike;
  dialog: DialogLike;
  payload: QuotePayload;
  manifest: ExportManifest;
  parentWindow?: BrowserWindowLike | null;
  templatePath?: string;
}): Promise<{ filePath: string; fingerprint: string } | null> {
  validateQuotePayload(payload);
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid export manifest');
  }

  let printWin: BrowserWindowLike | undefined;
  const timings: Record<string, number> = {};
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

  const renderAndPrint = (async (): Promise<Uint8Array> => {
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
