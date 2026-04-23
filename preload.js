const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  exportQuote: (payload) => ipcRenderer.invoke('export-quote', payload)
});
