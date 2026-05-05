import { contextBridge, ipcRenderer } from 'electron';

import type {
  ConfirmImportQuotePdfPayload,
  CreateNewRevisionPayload,
  ElectronAPI,
  ExportQuotePayload,
  SaveQuoteDraftPayload
} from '../shared/preload-contract';
import type { QuoteSnapshot } from '../shared/types';

const electronAPI: ElectronAPI = {
  createNewQuote(snapshot: QuoteSnapshot) {
    return ipcRenderer.invoke('create-new-quote', snapshot);
  },
  createNewRevision(payload: CreateNewRevisionPayload) {
    return ipcRenderer.invoke('create-new-revision', payload);
  },
  exportQuote(payload: ExportQuotePayload) {
    return ipcRenderer.invoke('export-quote', payload);
  },
  exportQuoteExcel(payload: ExportQuotePayload) {
    return ipcRenderer.invoke('export-quote-excel', payload);
  },
  getStartupRevision() {
    return ipcRenderer.invoke('get-startup-revision');
  },
  importQuotePdfPreview() {
    return ipcRenderer.invoke('import-quote-pdf-preview');
  },
  confirmImportQuotePdf(payload: ConfirmImportQuotePdfPayload) {
    return ipcRenderer.invoke('confirm-import-quote-pdf', payload);
  },
  loadQuoteRevision(revisionId: number) {
    return ipcRenderer.invoke('load-quote-revision', revisionId);
  },
  saveQuoteDraft(payload: SaveQuoteDraftPayload) {
    return ipcRenderer.invoke('save-quote-draft', payload);
  },
  saveQuoteDraftFile(payload: ExportQuotePayload) {
    return ipcRenderer.invoke('save-quote-draft-file', payload);
  },
  historyPush(snapshot: QuoteSnapshot) {
    return ipcRenderer.invoke('history:push', snapshot);
  },
  historyUndo() {
    return ipcRenderer.invoke('history:undo');
  },
  historyRedo() {
    return ipcRenderer.invoke('history:redo');
  },
  historyClear() {
    return ipcRenderer.invoke('history:clear');
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
