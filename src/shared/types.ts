export type BusinessType =
  | 'cafe'
  | 'restaurant'
  | 'store'
  | 'gym'
  | 'entertainment'
  | 'mall'
  | 'supermarket';

export type BoxMode = 'none' | 'buy' | 'rent';

export type RevisionStatus = 'draft' | 'imported' | 'exported';

export type ImportConflictType =
  | 'new_quote'
  | 'attach_existing_chain'
  | 'same_file'
  | 'revision_conflict';

export type ImportActionKey =
  | 'import_new_quote'
  | 'attach_to_existing_chain'
  | 'open_existing'
  | 'replace_existing_revision'
  | 'import_duplicate_quote_copy';

export interface GlobalDiscounts {
  account: number;
  box: number;
  qtg: number;
  qlq: number;
}

export interface CalcOptions {
  baseSalary: number;
  vatRate: number;
  boxMode: BoxMode;
  globalBoxCount: number;
  hasAccountFee: boolean;
  hasQTG: boolean;
  hasQLQ: boolean;
  globalDiscounts: GlobalDiscounts;
}

export interface Store {
  id: number;
  name: string;
  type: BusinessType | string;
  area: string;
  startDate: string;
  endDate: string;
}

export interface Totals {
  subtotalQTG: number;
  subtotalQLQ: number;
  subtotalAccount: number;
  subtotalBox: number;
  subtotal: number;
  vatRate: number;
  vat: number;
  grand: number;
}

export interface CustomerProfile {
  companyName: string;
  contactName: string;
  department: string;
  email: string;
  phone: string;
}

export interface PreparedByProfile {
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
}

export interface QuoteIdentity {
  quoteCode: string;
  revisionNumber: number;
  revisionLabel: string;
  displayQuoteNumber: string;
}

export interface QuoteSnapshot {
  customer: CustomerProfile;
  preparedBy: PreparedByProfile;
  calcOptions: CalcOptions;
  stores: Store[];
  totals: Partial<Totals>;
}

export interface QuoteMeta {
  quoteDate: string;
  quoteNumber: string;
  displayQuoteNumber: string;
  quoteCode: string;
  revisionNumber: number;
  revisionLabel: string;
  customerName: string;
  customer: CustomerProfile;
  preparedBy: PreparedByProfile;
}

export interface EmbeddedManifest {
  schemaVersion: string;
  appVersion: string;
  quoteIdentity: Pick<QuoteIdentity, 'quoteCode' | 'revisionNumber' | 'displayQuoteNumber'>;
  quoteDate: string;
  customer: CustomerProfile;
  preparedBy: PreparedByProfile;
  calcOptions: CalcOptions;
  stores: Store[];
  totals: Partial<Totals>;
  exportedAt: string;
  pdfFingerprintSource: 'sha256:file';
}

export interface QuoteRevision extends QuoteSnapshot {
  id: number;
  quoteId: number;
  quoteCode: string;
  revisionNumber: number;
  displayQuoteNumber: string;
  source: string;
  embeddedPayloadVersion: string | null;
  pdfFilePath: string | null;
  pdfFingerprint: string | null;
  exportedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: RevisionStatus;
  quoteIdentity: QuoteIdentity;
}

export interface QuoteRecord {
  id: number;
  quoteCode: string;
  currentRevisionNumber: number;
  status: RevisionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RevisionBundle {
  quote: QuoteRecord | null;
  activeRevision: QuoteRevision | null;
  revisions: QuoteRevision[];
}

export interface ImportAction {
  key: ImportActionKey;
  label: string;
}

export interface ImportPreviewSummary {
  displayQuoteNumber: string;
  quoteCode: string;
  revisionNumber: number;
  revisionLabel: string;
  customerName: string;
  branchCount: number;
  grandTotal: number;
  manifestCompatibility: string;
  exportedAt: string;
  hasExistingQuote: boolean;
}

export interface ImportPreview {
  filePath: string;
  fileName: string;
  fingerprint: string;
  manifest: EmbeddedManifest;
  quoteIdentity: QuoteIdentity;
  existingRevisionId: number | null;
  conflictType: ImportConflictType;
  recommendedAction: ImportActionKey;
  actions: ImportAction[];
  summary: string;
  preview: ImportPreviewSummary;
}

export interface QuotePayload extends QuoteSnapshot {
  schemaVersion: string;
  quoteIdentity: QuoteIdentity;
  meta: QuoteMeta;
  computedStores: Array<
    Store & {
      area: number;
      duration: number;
      coef: number;
      yearly: number;
      periodBase: number;
      qtgAmount: number;
      qlqAmount: number;
      accountAmount: number;
      boxAmount: number;
      total: number;
      branchNo: number;
      typeLabel: string;
      shortType: string;
    }
  >;
  globals: CalcOptions;
  totals: Totals;
}
