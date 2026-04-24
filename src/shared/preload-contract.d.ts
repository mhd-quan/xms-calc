import type {
  ImportActionKey,
  ImportPreview,
  QuoteSnapshot,
  RevisionBundle
} from './types';

export interface CreateNewRevisionPayload {
  revisionId: number;
  snapshot: QuoteSnapshot;
}

export interface SaveQuoteDraftPayload {
  revisionId: number;
  snapshot: QuoteSnapshot;
}

export interface ExportQuotePayload {
  revisionId: number;
  snapshot: QuoteSnapshot;
}

export interface ExportQuoteResult {
  filePath: string;
  bundle: RevisionBundle;
}

export interface ConfirmImportQuotePdfPayload {
  preview: ImportPreview;
  action?: ImportActionKey;
}

export interface ElectronAPI {
  createNewQuote(snapshot: QuoteSnapshot): Promise<RevisionBundle>;
  createNewRevision(payload: CreateNewRevisionPayload): Promise<RevisionBundle>;
  exportQuote(payload: ExportQuotePayload): Promise<ExportQuoteResult | null>;
  getStartupRevision(): Promise<RevisionBundle | null>;
  importQuotePdfPreview(): Promise<ImportPreview | null>;
  confirmImportQuotePdf(payload: ConfirmImportQuotePdfPayload): Promise<RevisionBundle>;
  loadQuoteRevision(revisionId: number): Promise<RevisionBundle | null>;
  saveQuoteDraft(payload: SaveQuoteDraftPayload): Promise<{ revisionId: number; updatedAt: string }>;
}
