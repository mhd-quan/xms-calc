const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  createNewQuote: (snapshot) => ipcRenderer.invoke('create-new-quote', snapshot),
  createNewRevision: (payload) => ipcRenderer.invoke('create-new-revision', payload),
  exportQuote: (payload) => ipcRenderer.invoke('export-quote', payload),
  getStartupRevision: () => ipcRenderer.invoke('get-startup-revision'),
  importQuotePdfPreview: () => ipcRenderer.invoke('import-quote-pdf-preview'),
  confirmImportQuotePdf: (payload) => ipcRenderer.invoke('confirm-import-quote-pdf', payload),
  loadQuoteRevision: (revisionId) => ipcRenderer.invoke('load-quote-revision', revisionId),
  saveQuoteDraft: (payload) => ipcRenderer.invoke('save-quote-draft', payload)
});
