// @ts-check

const { contextBridge, ipcRenderer } = require('electron');

/** @typedef {import('../shared/preload-contract').ElectronAPI} ElectronAPI */
/** @typedef {import('../shared/types').QuoteSnapshot} QuoteSnapshot */
/** @typedef {import('../shared/preload-contract').CreateNewRevisionPayload} CreateNewRevisionPayload */
/** @typedef {import('../shared/preload-contract').ExportQuotePayload} ExportQuotePayload */
/** @typedef {import('../shared/preload-contract').ConfirmImportQuotePdfPayload} ConfirmImportQuotePdfPayload */
/** @typedef {import('../shared/preload-contract').SaveQuoteDraftPayload} SaveQuoteDraftPayload */

/** @type {ElectronAPI} */
const electronAPI = {
  /** @param {QuoteSnapshot} snapshot */
  createNewQuote: (snapshot) => ipcRenderer.invoke('create-new-quote', snapshot),
  /** @param {CreateNewRevisionPayload} payload */
  createNewRevision: (payload) => ipcRenderer.invoke('create-new-revision', payload),
  /** @param {ExportQuotePayload} payload */
  exportQuote: (payload) => ipcRenderer.invoke('export-quote', payload),
  getStartupRevision: () => ipcRenderer.invoke('get-startup-revision'),
  importQuotePdfPreview: () => ipcRenderer.invoke('import-quote-pdf-preview'),
  /** @param {ConfirmImportQuotePdfPayload} payload */
  confirmImportQuotePdf: (payload) => ipcRenderer.invoke('confirm-import-quote-pdf', payload),
  /** @param {number} revisionId */
  loadQuoteRevision: (revisionId) => ipcRenderer.invoke('load-quote-revision', revisionId),
  /** @param {SaveQuoteDraftPayload} payload */
  saveQuoteDraft: (payload) => ipcRenderer.invoke('save-quote-draft', payload)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
