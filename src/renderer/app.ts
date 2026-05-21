/* XMusic Station — Quote Workflow v1.6 */

import {
  ACCOUNT_FEE_STANDALONE_YEARLY,
  ACCOUNT_FEE_YEARLY,
  BUSINESS_TYPES,
  BOX_BUY_PRICE,
  BOX_RENT_YEARLY,
  DEFAULT_BASE_SALARY,
  calculateCoef,
  calculateDurationMonths,
  calculateTotals
} from '../shared/calculator';
import {
  normalizeCalcOptions,
  normalizePreparedBy,
  normalizeProfile,
  normalizeStores
} from '../services/quote-payload';

import gsap from './vendor/gsap-lite';
import { attachCounter } from './modules/controllers/counter';
import { attachDatepicker } from './modules/controllers/datepicker';
import { attachDropdown } from './modules/controllers/dropdown';
import { attachInfoView } from './modules/controllers/infoview';
import { attachKnob, setKnobValue } from './modules/controllers/knob';
import { cycleDisplayAmount } from './modules/billing-cycle';
import { formatVND } from './modules/format';
import { animatePanelSwitch, animateTrackEntry, bindPressFeedback, restartMotionClass } from './modules/motion';
import { paletteVar } from './modules/palette';
import { renderBottombar } from './modules/render-bottombar';
import { bindModalFrame, hideModal, showModal } from './modules/render-modals';
import { revisionLabel, statusLabel } from './modules/render-revisions';
import { renderSidebar } from './modules/render-sidebar';
import { renderStatusbar } from './modules/render-statusbar';
import { renderTopbar } from './modules/render-topbar';
import { renderWorkbench } from './modules/render-workbench';

import type {
  CalcOptions,
  CustomerProfile,
  DiscountToggles,
  GlobalDiscounts,
  ImportActionKey,
  ImportPreview,
  PreparedByProfile,
  QuoteRevision,
  QuoteSnapshot,
  RevisionBundle,
  RevisionStatus,
  Store
} from '../shared/types';

type ComputedQuote = ReturnType<typeof calculateTotals>;
export type RenderSnapshot = ReturnType<typeof createRenderSnapshot>;

type RenderScopeKey = 'sidebar' | 'main' | 'totals';
type RenderScope = RenderScopeKey | 'all' | RenderScope[];

type StoreField = keyof Pick<Store, 'name' | 'area' | 'type' | 'startDate' | 'endDate'>;

const PLATFORM_FEE_DESCRIPTION =
  'Website hoặc PC App XMS tùy theo nhu cầu hạ tầng của khách hàng, prorated theo thời gian sử dụng thực tế của Cửa hàng, chi phí hàng năm';

function closestFromEvent<T extends Element>(event: Event, selector: string): T | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest(selector) as T | null;
}

function optionalElement(id: string): HTMLElement | null {
  return document.getElementById(id) as HTMLElement | null;
}

/** Safe accessor for input elements — returns empty string if element not found. */
function inputValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | null;
  return el?.value?.trim() ?? '';
}

/** Safe setter for input elements — no-op if element not found. */
function setInputValue(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.value = value;
}

function clearSidebarSearch(): void {
  const searchInput = optionalElement('searchInput');
  if (searchInput instanceof HTMLInputElement) searchInput.value = '';
}

function valueFromEvent(event: Event): string {
  return event.target instanceof HTMLElement ? String(event.target.value) : '';
}

function createStoreId(): number {
  return Date.now() + Math.floor(Math.random() * 1000000);
}

function resolveStoreId(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  const matched = stores.find((store) => String(store.id) === value || store.id === parsed);
  if (matched) return matched.id;
  return Number.isFinite(parsed) ? parsed : null;
}

function asErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
let baseSalary: number = DEFAULT_BASE_SALARY;
let vatRate: number = 0;
let billingCycle: CalcOptions['billingCycle'] = 'y';
let stores: Store[] = [];
let activeTabId: number | null = null;

let boxMode: CalcOptions['boxMode'] = 'none';
let accountFeeMode: CalcOptions['accountFeeMode'] = 'standard';
let globalBoxCount: number = 1;
let hasAccountFee: boolean = false;
let hasWebsiteFee: boolean = false;
let hasQTG: boolean = false;
let hasQLQ: boolean = false;

let globalDiscounts: GlobalDiscounts = {
  account: 0,
  website: 0,
  box: 0,
  qtg: 0,
  qlq: 0
};

let discountEnabled: DiscountToggles = {
  account: false,
  website: false,
  box: false,
  qtg: false,
  qlq: false
};

let bulkType: Store['type'] | '' = '';
let bulkAreas: string[] = [''];

let customerProfile: CustomerProfile = blankCustomer();
let preparedByProfile: PreparedByProfile = blankPreparedBy();

let activeQuoteCode: string = '';
let activeRevisionId: number | null = null;
let activeRevisionNumber: number = 0;
let activeDisplayQuoteNumber: string = '';
let activeRevisionStatus: RevisionStatus = 'draft';
let revisionsForQuote: QuoteRevision[] = [];

let activeImportPreview: ImportPreview | null = null;
let selectedImportAction: ImportActionKey | null = null;

let isHydratingRevision = false;
let isHydratingHistory = false;
let isExportingFile = false;
let renderScheduled = false;
const renderScope = new Set<RenderScopeKey>();
let chromeDirty = true;
let computedQuoteDirty = true;
let computedQuoteCache: ComputedQuote | null = null;
let draftSnapshotDirty = true;
let draftSnapshotCache: QuoteSnapshot | null = null;

let lastPersistedSnapshot = '';
let pendingPersistSerialized: string | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPromise: Promise<unknown> = Promise.resolve();

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
const escapeHTML = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
const MOTION_STRUCT_SECONDS = 0.14;
const MOTION_METER_SECONDS = 0.4;
const SIDEBAR_REMOVE_SECONDS = 0.18;
const STRIKE_PRICE_EPSILON = 0.5;

function afterNextRender(callback: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function queueTrackEntryMotion(storeId: number, delayMs = 0): void {
  afterNextRender(() => animateTrackEntry(storeId, delayMs));
}

function queueActiveTrackPulse(): void {
  const activeId = activeTabId;
  if (!activeId) return;
  afterNextRender(() => {
    const track = document.querySelector<HTMLElement>(`[data-id="${activeId}"]`);
    if (track) restartMotionClass(track, 'motion-accent-pop', 420);
  });
}

function queueMainPanelSwitch(): void {
  afterNextRender(() => animatePanelSwitch('#mainContent'));
}

function setLooseDropdownOpen(wrapper: HTMLElement | null, isOpen: boolean): void {
  if (!wrapper) return;
  wrapper.classList.toggle('is-open', isOpen);
  wrapper.setAttribute('aria-expanded', String(isOpen));
  wrapper.querySelector<HTMLElement>('button')?.setAttribute('aria-expanded', String(isOpen));
}

function closeLooseDropdowns(except?: HTMLElement | null): void {
  document.querySelectorAll<HTMLElement>('.topbar__actions .x-dropdown.is-open').forEach((wrapper) => {
    if (wrapper !== except) setLooseDropdownOpen(wrapper, false);
  });
}

function blankCustomer(): CustomerProfile {
  return {
    companyName: '',
    contactName: '',
    department: '',
    email: '',
    phone: ''
  };
}

function blankPreparedBy(): PreparedByProfile {
  return {
    name: '',
    title: '',
    department: '',
    email: '',
    phone: ''
  };
}

function canUseStandaloneAccountFee(): boolean {
  return !hasQTG && !hasQLQ;
}

function normalizeAccountFeeMode(): void {
  if (!canUseStandaloneAccountFee() && accountFeeMode === 'standalone') {
    accountFeeMode = 'standard';
  }
}

function feePerYearLabel(value: number): string {
  return `${formatVND(value)} ₫ / năm`;
}

function getCalcOptions(): CalcOptions {
  normalizeAccountFeeMode();
  return {
    baseSalary,
    vatRate,
    billingCycle,
    boxMode,
    accountFeeMode,
    globalBoxCount,
    hasAccountFee,
    hasWebsiteFee,
    hasQTG,
    hasQLQ,
    globalDiscounts: { ...globalDiscounts },
    discountEnabled: { ...discountEnabled }
  };
}

function getDefaultPreparedBy(): PreparedByProfile {
  try {
    return normalizePreparedBy(JSON.parse(localStorage.getItem('bdSettings') ?? '{}') || {});
  } catch {
    return blankPreparedBy();
  }
}

function buildInitialDraftSnapshot(): QuoteSnapshot {
  return {
    customer: blankCustomer(),
    preparedBy: getDefaultPreparedBy(),
    calcOptions: normalizeCalcOptions({
      baseSalary: DEFAULT_BASE_SALARY,
      vatRate: 0,
      billingCycle: 'y',
      boxMode: 'none',
      accountFeeMode: 'standard',
      globalBoxCount: 1,
      hasAccountFee: false,
      hasWebsiteFee: false,
      hasQTG: false,
      hasQLQ: false,
      globalDiscounts: { account: 0, website: 0, box: 0, qtg: 0, qlq: 0 },
      discountEnabled: { account: false, website: false, box: false, qtg: false, qlq: false }
    }),
    stores: [createStore(1)],
    totals: {}
  };
}

function setPreparedByDefaults(preparedBy: PreparedByProfile): void {
  localStorage.setItem('bdSettings', JSON.stringify(normalizePreparedBy(preparedBy)));
}

function snapshotString(snapshot: QuoteSnapshot): string {
  return JSON.stringify(snapshot);
}

function invalidateComputedQuote() {
  computedQuoteDirty = true;
  draftSnapshotDirty = true;
}

function invalidateDraftSnapshot() {
  draftSnapshotDirty = true;
}

function markChromeDirty() {
  chromeDirty = true;
}

function getCurrentComputedQuote(): ComputedQuote {
  if (!computedQuoteDirty && computedQuoteCache) {
    return computedQuoteCache;
  }
  computedQuoteCache = calculateTotals(stores, getCalcOptions());
  computedQuoteDirty = false;
  return computedQuoteCache;
}

function buildDraftSnapshot(): QuoteSnapshot {
  if (!draftSnapshotDirty && draftSnapshotCache) {
    return draftSnapshotCache;
  }
  const calcOptions = getCalcOptions();
  const normalizedStores = normalizeStores(stores);
  draftSnapshotCache = {
    customer: normalizeProfile(customerProfile),
    preparedBy: normalizePreparedBy(preparedByProfile),
    calcOptions,
    stores: normalizedStores,
    totals: getCurrentComputedQuote().totals
  };
  draftSnapshotDirty = false;
  return draftSnapshotCache;
}

async function persistDraftSerialized(serialized: string): Promise<true | null> {
  if (!serialized || !window.electronAPI || !activeRevisionId) return null;
  if (serialized === lastPersistedSnapshot) {
    pendingPersistSerialized = null;
    return null;
  }

  const snapshot = JSON.parse(serialized);
  try {
    await window.electronAPI.saveQuoteDraft({
      revisionId: activeRevisionId,
      snapshot
    });
    lastPersistedSnapshot = serialized;
    if (!isHydratingHistory) {
      window.electronAPI.historyPush(snapshot).catch(console.error);
    }
    return true;
  } catch (error) {
    console.error(error);
    return null;
  } finally {
    if (pendingPersistSerialized === serialized) {
      pendingPersistSerialized = null;
    }
  }
}

function scheduleDraftPersist() {
  if (isHydratingRevision || !activeRevisionId || !window.electronAPI) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const serialized = snapshotString(buildDraftSnapshot());
    if (serialized === lastPersistedSnapshot || serialized === pendingPersistSerialized) return;
    pendingPersistSerialized = serialized;
    persistPromise = persistDraftSerialized(serialized);
  }, 450);
}

async function flushDraftPersist() {
  if (!activeRevisionId) return;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
    persistPromise = persistDraftSerialized(
      pendingPersistSerialized || snapshotString(buildDraftSnapshot())
    );
    await persistPromise;
    return;
  }
  if (pendingPersistSerialized) {
    persistPromise = persistDraftSerialized(pendingPersistSerialized);
    await persistPromise;
    return;
  }
  await persistPromise;
}

function syncBundleMetadata(bundle: RevisionBundle | null): void {
  if (!bundle || !bundle.activeRevision) return;
  activeQuoteCode = bundle.activeRevision.quoteCode;
  activeRevisionId = bundle.activeRevision.id;
  activeRevisionNumber = bundle.activeRevision.revisionNumber;
  activeDisplayQuoteNumber = bundle.activeRevision.displayQuoteNumber;
  activeRevisionStatus = bundle.activeRevision.status;
  revisionsForQuote = Array.isArray(bundle.revisions) ? bundle.revisions : [];
  markChromeDirty();
}

function hydrateFromSnapshot(snapshot: QuoteSnapshot): void {
  isHydratingRevision = true;

  customerProfile = normalizeProfile(snapshot.customer);
  preparedByProfile = normalizePreparedBy(snapshot.preparedBy);
  setCustomerFields(customerProfile);
  setSettingsFields(preparedByProfile);

  const calcOptions = normalizeCalcOptions(snapshot.calcOptions);
  baseSalary = calcOptions.baseSalary;
  vatRate = calcOptions.vatRate;
  billingCycle = calcOptions.billingCycle;
  boxMode = calcOptions.boxMode;
  accountFeeMode = calcOptions.accountFeeMode;
  globalBoxCount = calcOptions.globalBoxCount;
  hasAccountFee = calcOptions.hasAccountFee;
  hasWebsiteFee = calcOptions.hasWebsiteFee;
  hasQTG = calcOptions.hasQTG;
  hasQLQ = calcOptions.hasQLQ;
  globalDiscounts = { ...calcOptions.globalDiscounts };
  discountEnabled = { ...calcOptions.discountEnabled };

  stores = snapshot.stores.length ? normalizeStores(snapshot.stores) : [createStore(1)];
  activeTabId = stores[0]?.id || null;
  clearSidebarSearch();

  invalidateComputedQuote();
  draftSnapshotCache = null;
  const serialized = snapshotString(buildDraftSnapshot());
  lastPersistedSnapshot = serialized;
  pendingPersistSerialized = null;

  isHydratingRevision = false;
  render();
}

function hydrateEditorFromRevision(revision: QuoteRevision): void {
  hydrateFromSnapshot(revision);
}

async function performUndo() {
  const snapshot = await window.electronAPI.historyUndo();
  if (snapshot) {
    isHydratingHistory = true;
    try {
      hydrateFromSnapshot(snapshot);
    } finally {
      isHydratingHistory = false;
    }
  }
}

async function performRedo() {
  const snapshot = await window.electronAPI.historyRedo();
  if (snapshot) {
    isHydratingHistory = true;
    try {
      hydrateFromSnapshot(snapshot);
    } finally {
      isHydratingHistory = false;
    }
  }
}

function navigateSidebar(direction: number) {
  if (!stores.length) return;
  const currentIndex = stores.findIndex(s => s.id === activeTabId);
  let nextIndex = currentIndex + direction;
  if (nextIndex < 0) nextIndex = 0;
  if (nextIndex >= stores.length) nextIndex = stores.length - 1;

  const nextStore = stores[nextIndex];
  if (nextStore && nextStore.id !== activeTabId) {
    activeTabId = nextStore.id;
    commitQuoteMutation('all');
    queueMainPanelSwitch();
    queueActiveTrackPulse();
  }
}

function applyRevisionBundle(bundle: RevisionBundle | null): void {
  if (!bundle || !bundle.activeRevision) return;
  syncBundleMetadata(bundle);
  hydrateEditorFromRevision(bundle.activeRevision);
}

function setCustomerFields(customer: CustomerProfile): void {
  setInputValue('customerCompany', customer.companyName || '');
  setInputValue('customerContactName', customer.contactName || '');
  setInputValue('customerDepartment', customer.department || '');
  setInputValue('customerEmail', customer.email || '');
  setInputValue('customerPhone', customer.phone || '');
}

function setSettingsFields(settings: PreparedByProfile): void {
  setInputValue('settingName', settings.name || '');
  setInputValue('settingTitle', settings.title || '');
  setInputValue('settingDepartment', settings.department || '');
  setInputValue('settingEmail', settings.email || '');
  setInputValue('settingPhone', settings.phone || '');
}

function readCustomerFields(): CustomerProfile {
  return normalizeProfile({
    companyName: inputValue('customerCompany'),
    contactName: inputValue('customerContactName'),
    department: inputValue('customerDepartment'),
    email: inputValue('customerEmail'),
    phone: inputValue('customerPhone')
  });
}

function readPreparedByFields(): PreparedByProfile {
  return normalizePreparedBy({
    name: inputValue('settingName'),
    title: inputValue('settingTitle'),
    department: inputValue('settingDepartment'),
    email: inputValue('settingEmail'),
    phone: inputValue('settingPhone')
  });
}

function renderQuoteChrome() {
  const sidebarStatusText = optionalElement('quoteStatusText');
  if (sidebarStatusText) sidebarStatusText.textContent = revisionLabel(activeRevisionNumber);
  const sidebarStatusChip = optionalElement('quoteStatusChip');
  if (sidebarStatusChip) {
    sidebarStatusChip.classList.toggle('x-chip--status-draft', activeRevisionStatus === 'draft');
    sidebarStatusChip.classList.toggle('x-chip--status-sent', activeRevisionStatus === 'imported');
    sidebarStatusChip.classList.toggle('x-chip--status-accepted', activeRevisionStatus === 'exported');
    sidebarStatusChip.dataset.info = `Active revision|${activeDisplayQuoteNumber || activeQuoteCode || '—'} · ${statusLabel(activeRevisionStatus)}|—`;
  }
}

function openCustomerModal() {
  setCustomerFields(customerProfile);
  showModal('customerModal', '#customerCompany');
}

function closeCustomerModal() {
  hideModal('customerModal');
}

function openSettingsModal() {
  setSettingsFields(preparedByProfile);
  showModal('settingsModal', '#settingName');
}

function closeSettingsModal() {
  hideModal('settingsModal');
}

function closeImportPreviewModal() {
  activeImportPreview = null;
  selectedImportAction = null;
  hideModal('importPreviewModal');
}

function renderImportActionOptions(preview: ImportPreview): void {
  const container = document.getElementById('importActionOptions');
  if (!container) return;
  container.innerHTML = preview.actions.map((action) => `
    <button class="x-btn import-action-option${action.key === selectedImportAction ? ' is-active' : ''}" type="button" data-action="${action.key}" style="justify-content:flex-start; width:100%;">
      <strong>${escapeHTML(action.label)}</strong>
    </button>
  `).join('');
}

function openImportPreviewModal(preview: ImportPreview): void {
  activeImportPreview = preview;
  selectedImportAction = preview.recommendedAction;

  const setText = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText('importPreviewFileName', preview.fileName || '-');
  setText('importPreviewQuoteNumber', preview.preview.displayQuoteNumber);
  setText('importPreviewCustomer', preview.preview.customerName || '-');
  setText('importPreviewBranchCount', `${preview.preview.branchCount} branches`);
  setText('importPreviewGrandTotal', `${formatVND(preview.preview.grandTotal)} ₫`);
  setText('importPreviewCompatibility', preview.preview.manifestCompatibility);
  setText('importPreviewSummary', preview.summary);
  renderImportActionOptions(preview);
  showModal('importPreviewModal', '#confirmImportPreview');
}

async function loadRevisionById(revisionId: number): Promise<void> {
  if (!window.electronAPI) return;
  const bundle = await window.electronAPI.loadQuoteRevision(revisionId);
  applyRevisionBundle(bundle);
}

async function createNewQuote() {
  if (!window.electronAPI) return;
  await flushDraftPersist();
  const bundle = await window.electronAPI.createNewQuote(buildInitialDraftSnapshot());
  if (bundle) {
    void window.electronAPI.historyClear();
    applyRevisionBundle(bundle);
  }
}

async function createNewRevision() {
  if (!window.electronAPI || !activeRevisionId) return;
  await flushDraftPersist();
  const bundle = await window.electronAPI.createNewRevision({
    revisionId: activeRevisionId,
    snapshot: buildDraftSnapshot()
  });
  applyRevisionBundle(bundle);
}

async function importQuoteFromPdf() {
  if (!window.electronAPI) return;
  try {
    const preview = await window.electronAPI.importQuotePdfPreview();
    if (!preview) return;
    openImportPreviewModal(preview);
  } catch (error) {
    console.error(error);
    alert(asErrorMessage(error, 'Không thể import PDF.'));
  }
}

async function confirmImportPreview() {
  if (!window.electronAPI || !activeImportPreview) return;
  try {
    const bundle = await window.electronAPI.confirmImportQuotePdf({
      preview: activeImportPreview,
      action: selectedImportAction ?? activeImportPreview.recommendedAction
    });
    if (bundle) {
      void window.electronAPI.historyClear();
      applyRevisionBundle(bundle);
    }
    closeImportPreviewModal();
  } catch (error) {
    console.error(error);
    alert(asErrorMessage(error, 'Không thể hoàn tất import.'));
  }
}

function setExportMenuBusy(isBusy: boolean): void {
  ['btnExportPdf', 'btnExportExcel', 'btnSaveDraftFile'].forEach((id) => {
    const button = optionalElement(id);
    if (!button) return;
    button.style.opacity = isBusy ? '0.5' : '1';
    button.style.pointerEvents = isBusy ? 'none' : 'auto';
  });
}

async function _exportActiveQuoteCore(type: 'pdf' | 'excel') {
  if (!window.electronAPI) {
    alert('Không thể kết nối tới Electron API. Vui lòng khởi động lại ứng dụng.');
    return;
  }
  if (!activeRevisionId) {
    alert('Không tìm thấy revision đang mở để export.');
    return;
  }
  if (isExportingFile) return;
  const revisionId = activeRevisionId;

  customerProfile = readCustomerFields();
  invalidateDraftSnapshot();
  if (!customerProfile.companyName) {
    document.getElementById('customerCompany').focus();
    return;
  }

  closeCustomerModal();
  scheduleDraftPersist();
  await flushDraftPersist();

  isExportingFile = true;
  setExportMenuBusy(true);

  try {
    const payload = {
      revisionId,
      snapshot: buildDraftSnapshot()
    };
    const result = type === 'pdf' 
      ? await window.electronAPI.exportQuote(payload)
      : await window.electronAPI.exportQuoteExcel(payload);

    if (result && 'bundle' in result && result.bundle) {
      syncBundleMetadata(result.bundle);
      render();
    }
  } catch (error) {
    console.error(error);
    alert(asErrorMessage(error, `Error exporting ${type.toUpperCase()}`));
  } finally {
    isExportingFile = false;
    setExportMenuBusy(false);
  }
}

async function exportActiveQuotePdf() {
  await _exportActiveQuoteCore('pdf');
}

async function exportActiveQuoteExcel() {
  await _exportActiveQuoteCore('excel');
}

function performExportPdf() {
  if (!preparedByProfile.name) {
    openSettingsModal();
    return;
  }
  if (!customerProfile.companyName) {
    openCustomerModal();
    return;
  }
  void exportActiveQuotePdf();
}

function performExportExcel() {
  if (!preparedByProfile.name) {
    openSettingsModal();
    return;
  }
  if (!customerProfile.companyName) {
    openCustomerModal();
    return;
  }
  void exportActiveQuoteExcel();
}

async function saveActiveQuoteDraftFile(): Promise<void> {
  if (!window.electronAPI) {
    alert('Không thể kết nối tới Electron API. Vui lòng khởi động lại ứng dụng.');
    return;
  }
  if (!activeRevisionId) {
    alert('Không tìm thấy revision đang mở để lưu draft.');
    return;
  }
  if (isExportingFile) return;
  const revisionId = activeRevisionId;

  customerProfile = readCustomerFields();
  invalidateDraftSnapshot();
  closeCustomerModal();
  scheduleDraftPersist();
  await flushDraftPersist();

  isExportingFile = true;
  setExportMenuBusy(true);
  try {
    await window.electronAPI.saveQuoteDraftFile({
      revisionId,
      snapshot: buildDraftSnapshot()
    });
  } catch (error) {
    console.error(error);
    alert(asErrorMessage(error, 'Không thể lưu file draft.'));
  } finally {
    isExportingFile = false;
    setExportMenuBusy(false);
  }
}

function performSaveDraftFile(): void {
  void saveActiveQuoteDraftFile();
}

function saveCustomerProfile(): void {
  customerProfile = readCustomerFields();
  invalidateDraftSnapshot();
  markChromeDirty();
  closeCustomerModal();
  render('sidebar');
  scheduleDraftPersist();
}

function toLocalYMD(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function todayStr() {
  return toLocalYMD(new Date());
}

function oneYearLater() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return toLocalYMD(d);
}

function formatDateStr(ymd: string): string {
  const [year, month, day] = ymd.split('-');
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
}

function createStore(index: number): Store {
  return {
    id: createStoreId(),
    name: `Chi nhánh ${index}`,
    type: '',
    area: '',
    startDate: todayStr(),
    endDate: oneYearLater()
  };
}

function getActive() {
  return stores.find((store) => store.id === activeTabId) || stores[0];
}

const STORE_FIELD_RENDER_SCOPES: Record<StoreField, RenderScope[]> = {
  name: ['main', 'sidebar'],
  area: ['main', 'sidebar', 'totals'],
  type: ['main', 'sidebar', 'totals'],
  startDate: ['main', 'sidebar', 'totals'],
  endDate: ['main', 'sidebar', 'totals']
};

function addStore() {
  const active = getActive();
  const store = createStore(stores.length + 1);
  if (active) {
    store.type = active.type;
  }
  stores.push(store);
  activeTabId = store.id;
  clearSidebarSearch();
  commitQuoteMutation();
  queueTrackEntryMotion(store.id);
  queueMainPanelSwitch();
}

function duplicateActiveStore(): void {
  const active = getActive();
  if (!active) return;
  const store: Store = {
    ...active,
    id: createStoreId(),
    name: `${active.name || 'Chi nhánh'} copy`
  };
  stores.push(store);
  activeTabId = store.id;
  clearSidebarSearch();
  commitQuoteMutation();
  queueTrackEntryMotion(store.id);
  queueMainPanelSwitch();
}

function animateStoreRemoval(el: Element | null, onComplete: () => void): void {
  if (!(el instanceof HTMLElement) || typeof el.animate !== 'function') {
    onComplete();
    return;
  }

  gsap.killTweensOf(el);
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const marginBottom = Number.parseFloat(style.marginBottom) || 0;
  let didComplete = false;
  const finish = (): void => {
    if (didComplete) return;
    didComplete = true;
    onComplete();
  };

  el.style.height = `${rect.height}px`;
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.willChange = 'height, opacity, transform, margin-bottom';

  const animation = el.animate(
    [
      {
        height: `${rect.height}px`,
        marginBottom: `${marginBottom}px`,
        opacity: 1,
        transform: 'translateX(0)'
      },
      {
        height: '0px',
        marginBottom: '0px',
        opacity: 0,
        transform: 'translateX(-12px)'
      }
    ],
    {
      duration: SIDEBAR_REMOVE_SECONDS * 1000,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards'
    }
  );

  animation.addEventListener('finish', finish, { once: true });
  animation.addEventListener('cancel', finish, { once: true });
}

function removeStore(id: number): void {
  if (stores.length <= 1) return;
  const removedActiveStore = activeTabId === id;
  const el = document.querySelector(`[data-id="${id}"]`);
  animateStoreRemoval(el, () => {
    stores = stores.filter((store) => store.id !== id);
    if (removedActiveStore) activeTabId = stores[0]?.id ?? null;
    commitQuoteMutation(removedActiveStore ? 'all' : ['sidebar', 'totals']);
  });
}

function updateActive(field: StoreField, value: string): void {
  const store = getActive();
  if (!store || store[field] === value) return;
  store[field] = value;
  invalidateComputedQuote();
  render(STORE_FIELD_RENDER_SCOPES[field] || 'all');
  scheduleDraftPersist();
}

function commitQuoteMutation(scope: RenderScope = 'all'): void {
  invalidateComputedQuote();
  render(scope);
  scheduleDraftPersist();
}

function sanitizeAreaValue(value: string): string {
  return String(value || '').trim().replace(',', '.');
}

function parseBulkAreaLine(line: string): string {
  const cells = String(line).split('\t').map(sanitizeAreaValue).filter(Boolean);
  return cells.length ? cells[cells.length - 1] ?? sanitizeAreaValue(line) : sanitizeAreaValue(line);
}

function getFilledBulkRows(): string[] {
  return bulkAreas
    .map(sanitizeAreaValue)
    .filter((value) => value !== '' && Number(value) > 0);
}

function renderBulkType() {
  const text = document.getElementById('bulkBusinessTypeText');
  const dd = document.getElementById('bulkBusinessType');
  if (!text || !dd) return;
  const bulkTypeMeta = bulkType ? BUSINESS_TYPES[bulkType] : undefined;
  text.textContent = bulkTypeMeta?.label ?? 'Chọn mô hình...';
  dd.dataset.value = bulkType;
  dd.querySelectorAll('.x-dropdown__item').forEach((el) => {
    el.classList.toggle('is-selected', el.dataset.value === bulkType);
  });
}

function updateBulkSummary(): void {
  const filledRows = getFilledBulkRows().length;
  document.getElementById('bulkRowCount').textContent = `${filledRows} rows`;
  const applyButton = optionalElement('applyBulkAdd');
  if (applyButton) {
    const label = filledRows === 1 ? 'store' : 'stores';
    applyButton.textContent = filledRows > 0 ? `Add ${filledRows} ${label}` : 'Add stores';
  }
}

function renderBulkRows(focusIndex: number | null = null): void {
  const rowsEl = document.getElementById('bulkRows');
  if (!rowsEl) return;
  if (bulkAreas.length === 0) bulkAreas = [''];
  const startIndex = stores.length + 1;
  rowsEl.innerHTML = bulkAreas.map((value, index) => {
    const color = paletteVar(startIndex + index - 1);
    return `
      <div class="x-field-row bulk-add-modal__field" data-index="${index}" style="--bulk-accent: ${color};">
        <label class="x-field-row__label" for="bulkArea${index}">STORE ${String(startIndex + index).padStart(2, '0')}</label>
        <div class="x-suffix-wrap">
          <input id="bulkArea${index}" class="x-field x-field--num bulk-area-input tnum" type="text" inputmode="decimal" value="${escapeHTML(value)}" data-index="${index}" placeholder="0">
          <span class="x-suffix">m²</span>
        </div>
      </div>`;
  }).join('');
  updateBulkSummary();
  if (focusIndex !== null) {
    requestAnimationFrame(() => {
      const input = rowsEl.querySelector(`.bulk-area-input[data-index="${focusIndex}"]`);
      if (input) {
        input.focus();
        input.select();
      }
    });
  }
}

function openBulkAddModal() {
  const active = getActive();
  bulkType = active && active.type ? active.type : '';
  bulkAreas = [''];
  renderBulkType();
  renderBulkRows(0);
  showModal('bulkAddModal', '#bulkBusinessType');
}

function closeBulkAddModal() {
  hideModal('bulkAddModal');
  document.getElementById('bulkBusinessType').classList.remove('is-open');
}

function addBulkRows() {
  const areas = getFilledBulkRows();
  if (areas.length === 0) {
    renderBulkRows(0);
    return;
  }

  let firstCreatedId: number | null = null;
  const createdIds: number[] = [];
  areas.forEach((areaValue) => {
    const store = createStore(stores.length + 1);
    store.type = bulkType;
    store.area = areaValue;
    stores.push(store);
    createdIds.push(store.id);
    if (!firstCreatedId) firstCreatedId = store.id;
  });

  activeTabId = firstCreatedId || activeTabId;
  closeBulkAddModal();
  commitQuoteMutation();
  createdIds.forEach((storeId, index) => queueTrackEntryMotion(storeId, Math.min(index * 28, 180)));
  queueMainPanelSwitch();
}

function animateNumber(elementId: string, newValue: number): void {
  const el = document.getElementById(elementId);
  if (!el) return;
  const cached = el._lastValue ?? (parseFloat((el.textContent ?? '').replace(/\./g, '').replace(/,/g, '')) || 0);
  if (Math.abs(cached - newValue) < 0.5) return;

  el._lastValue = newValue;
  if (el._tweenObj) gsap.killTweensOf(el._tweenObj);
  el._tweenObj = { val: cached };

  const tweenObj = el._tweenObj;
  gsap.to(tweenObj, {
    val: newValue,
    duration: MOTION_METER_SECONDS,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = formatVND(tweenObj.val);
    }
  });
}

function renderStrikePrice(elementId: string, originalValue: number, currentValue: number): void {
  const el = optionalElement(elementId);
  if (!el) return;

  const shouldShow = originalValue > currentValue + STRIKE_PRICE_EPSILON;
  el.toggleAttribute('hidden', !shouldShow);
  if (shouldShow) {
    el.textContent = `${formatVND(cycleDisplayAmount(originalValue, billingCycle))} ₫`;
  }
}

function renderMain(snapshot: RenderSnapshot): void {
  const store = snapshot.activeStore;
  if (!store) return;
  const area = Number(store.area) || 0;
  const breakdown = snapshot.activeBreakdown;
  const duration = breakdown?.duration ?? calculateDurationMonths(store.startDate, store.endDate);
  const coef = breakdown?.coef ?? calculateCoef(store.type, area);

  document.querySelectorAll('#cycleSeg .x-seg__btn').forEach((button) => {
    button.classList.toggle('is-active', button instanceof HTMLElement && button.dataset.cycle === billingCycle);
  });

  const typeText = document.getElementById('businessTypeText');
  const typeDropdown = document.getElementById('businessType');
  const storeTypeMeta = store.type ? BUSINESS_TYPES[store.type] : undefined;
  typeText.textContent = storeTypeMeta?.label ?? 'Chọn mô hình kinh doanh...';
  typeDropdown.dataset.value = store.type;
  document.querySelectorAll('#businessType .x-dropdown__item').forEach((el) => {
    el.classList.toggle('is-selected', el.dataset.value === store.type);
  });

  const areaInput = document.getElementById('areaInput');
  if (document.activeElement !== areaInput) areaInput.value = store.area;

  document.getElementById('startDateText').textContent = formatDateStr(store.startDate);
  document.getElementById('endDateText').textContent = formatDateStr(store.endDate);

  const accToggle = document.getElementById('accountToggle');
  accToggle.classList.toggle('is-on', hasAccountFee);
  accToggle.textContent = hasAccountFee ? 'BẬT' : 'TẮT';
  const accRow = accToggle.closest('.x-row') ?? accToggle;
  const accRight = document.getElementById('accountFeeRight');
  const accAmount = accRow.querySelector<HTMLElement>('.x-row__inline-amount');
  const accountModeAllowed = canUseStandaloneAccountFee();
  const activeAccountMode = accountModeAllowed ? accountFeeMode : 'standard';
  const accountPriceDesc = document.getElementById('accountPriceDesc');
  if (accountPriceDesc) {
    accountPriceDesc.textContent =
      activeAccountMode === 'standalone'
        ? `${feePerYearLabel(ACCOUNT_FEE_STANDALONE_YEARLY)} / cửa hàng · chỉ áp dụng khi tắt cả hai quyền`
        : `${feePerYearLabel(ACCOUNT_FEE_YEARLY)} · prorated theo chu kỳ`;
  }
  const accountModeSeg = document.getElementById('accountFeeModeSeg');
  accountModeSeg?.classList.toggle('is-disabled', !hasAccountFee);
  accountModeSeg?.querySelectorAll<HTMLButtonElement>('.x-seg__btn').forEach((button) => {
    const mode = button.dataset.accountMode;
    const isStandalone = mode === 'standalone';
    const disabled = !hasAccountFee || (isStandalone && !accountModeAllowed);
    button.disabled = disabled;
    button.classList.toggle('is-active', mode === activeAccountMode);
    button.setAttribute(
      'data-info',
      isStandalone
        ? 'Tài khoản độc lập|1.500.000₫/năm/cửa hàng. Chỉ bật được khi Quyền tác giả và Quyền liên quan đều tắt.|—'
        : 'Tài khoản chuẩn|600.000₫/năm, prorated theo chu kỳ.|—'
    );
  });
  renderDiscountApply('discountAccountApply', discountEnabled.account);
  setKnobValue('discountAccountKnob', globalDiscounts.account);

  if (hasAccountFee) {
    accRight.classList.remove('is-disabled');
    accAmount?.classList.remove('is-disabled');
    animateNumber('accountAmount', cycleDisplayAmount(breakdown?.accountAmount || 0, billingCycle));
    renderStrikePrice('accountOriginalAmount', breakdown?.accountAmountOriginal || 0, breakdown?.accountAmount || 0);
  } else {
    accRight.classList.add('is-disabled');
    accAmount?.classList.add('is-disabled');
    animateNumber('accountAmount', 0);
    renderStrikePrice('accountOriginalAmount', 0, 0);
  }

  const websiteToggle = document.getElementById('websiteToggle');
  websiteToggle.classList.toggle('is-on', hasWebsiteFee);
  websiteToggle.textContent = hasWebsiteFee ? 'BẬT' : 'TẮT';
  const websitePriceDesc = document.getElementById('websitePriceDesc');
  if (websitePriceDesc) websitePriceDesc.textContent = PLATFORM_FEE_DESCRIPTION;
  const websiteRight = document.getElementById('websiteFeeRight');
  renderDiscountApply('discountWebsiteApply', discountEnabled.website);
  setKnobValue('discountWebsiteKnob', globalDiscounts.website);
  const websiteAmount = websiteRight?.querySelector<HTMLElement>('.x-row__inline-amount');
  if (hasWebsiteFee) {
    websiteRight?.classList.remove('is-disabled');
    websiteAmount?.classList.remove('is-disabled');
    animateNumber('websiteAmount', cycleDisplayAmount(breakdown?.websiteAmount || 0, billingCycle));
    renderStrikePrice('websiteOriginalAmount', breakdown?.websiteAmountOriginal || 0, breakdown?.websiteAmount || 0);
  } else {
    websiteRight?.classList.add('is-disabled');
    websiteAmount?.classList.add('is-disabled');
    animateNumber('websiteAmount', 0);
    renderStrikePrice('websiteOriginalAmount', 0, 0);
  }

  document.querySelectorAll('#boxModeSeg .x-seg__btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === boxMode);
  });
  document.getElementById('boxQuantityRow').toggleAttribute('hidden', boxMode === 'none');
  const boxInput = document.getElementById('boxCount');
  if (document.activeElement !== boxInput) boxInput.value = String(globalBoxCount);

  const boxDiscountRow = document.getElementById('boxDiscountRow');
  boxDiscountRow.classList.toggle('is-summary-only', boxMode === 'none');
  renderDiscountApply('discountBoxApply', discountEnabled.box);
  setKnobValue('discountBoxKnob', globalDiscounts.box);

  const boxPriceDesc = document.getElementById('boxPriceDesc');
  if (boxMode === 'buy') {
    boxPriceDesc.textContent = `${feePerYearLabel(BOX_BUY_PRICE).replace(' / năm', '')} / thiết bị · chi phí một lần · cấp mỗi chi nhánh`;
  } else if (boxMode === 'rent') {
    boxPriceDesc.textContent = `${feePerYearLabel(BOX_RENT_YEARLY)} / thiết bị · prorated · có thể chiết khấu`;
  } else {
    boxPriceDesc.textContent = 'Chọn hình thức trang bị cho mỗi chi nhánh';
  }
  animateNumber('boxAmount', boxMode === 'none' ? 0 : cycleDisplayAmount(breakdown?.boxAmount || 0, billingCycle));
  renderStrikePrice(
    'boxOriginalAmount',
    boxMode === 'none' ? 0 : breakdown?.boxAmountOriginal || 0,
    boxMode === 'none' ? 0 : breakdown?.boxAmount || 0
  );

  document.getElementById('qtgCoef').textContent = coef.toFixed(2);
  document.getElementById('qtgDur').textContent = `${duration.toFixed(1)}m`;

  const qtgToggle = document.getElementById('qtgToggle');
  qtgToggle.classList.toggle('is-on', hasQTG);
  qtgToggle.textContent = hasQTG ? 'BẬT' : 'TẮT';
  const qtgRow = qtgToggle.closest('.x-row') ?? qtgToggle;
  const qtgMid = qtgRow.querySelector<HTMLElement>('.x-row__rhs');
  const qtgRight = qtgRow.querySelector<HTMLElement>('.x-row__inline-amount');
  renderDiscountApply('discountQTGApply', discountEnabled.qtg);
  setKnobValue('discountQTGKnob', globalDiscounts.qtg);

  if (hasQTG) {
    qtgMid?.classList.remove('is-disabled');
    qtgRight?.classList.remove('is-disabled');
    animateNumber('qtgAmount', cycleDisplayAmount(breakdown?.qtgAmount || 0, billingCycle));
    renderStrikePrice('qtgOriginalAmount', breakdown?.qtgAmountOriginal || 0, breakdown?.qtgAmount || 0);
  } else {
    qtgMid?.classList.add('is-disabled');
    qtgRight?.classList.add('is-disabled');
    animateNumber('qtgAmount', 0);
    renderStrikePrice('qtgOriginalAmount', 0, 0);
  }

  document.getElementById('qlqCoef').textContent = coef.toFixed(2);
  document.getElementById('qlqDur').textContent = `${duration.toFixed(1)}m`;

  const qlqToggle = document.getElementById('qlqToggle');
  qlqToggle.classList.toggle('is-on', hasQLQ);
  qlqToggle.textContent = hasQLQ ? 'BẬT' : 'TẮT';
  const qlqRow = qlqToggle.closest('.x-row') ?? qlqToggle;
  const qlqMid = qlqRow.querySelector<HTMLElement>('.x-row__rhs');
  const qlqRight = qlqRow.querySelector<HTMLElement>('.x-row__inline-amount');
  renderDiscountApply('discountQLQApply', discountEnabled.qlq);
  setKnobValue('discountQLQKnob', globalDiscounts.qlq);

  if (hasQLQ) {
    qlqMid?.classList.remove('is-disabled');
    qlqRight?.classList.remove('is-disabled');
    animateNumber('qlqAmount', cycleDisplayAmount(breakdown?.qlqAmount || 0, billingCycle));
    renderStrikePrice('qlqOriginalAmount', breakdown?.qlqAmountOriginal || 0, breakdown?.qlqAmount || 0);
  } else {
    qlqMid?.classList.add('is-disabled');
    qlqRight?.classList.add('is-disabled');
    animateNumber('qlqAmount', 0);
    renderStrikePrice('qlqOriginalAmount', 0, 0);
  }
}

function renderDiscountApply(id: string, isEnabled: boolean): void {
  const button = optionalElement(id);
  if (!button) return;
  button.classList.toggle('is-on', isEnabled);
  button.setAttribute('aria-pressed', String(isEnabled));
  button.textContent = isEnabled ? 'DISC' : 'OFF';
}

function createRenderSnapshot() {
  const quote = getCurrentComputedQuote();
  const breakdownsById = new Map<number, ComputedQuote['stores'][number]>();
  quote.stores.forEach((breakdown, index) => {
    if (stores[index]) breakdownsById.set(stores[index].id, breakdown);
  });
  const activeStore = getActive();
  const activeStoreIndex = activeStore ? stores.indexOf(activeStore) : -1;
  const activeBreakdown = activeStore ? breakdownsById.get(activeStore.id) : null;
  const maxStoreTotal = Math.max(1, ...quote.stores.map((row) => row.total || 0));
  return {
    quote,
    breakdownsById,
    stores,
    activeTabId,
    activeStore,
    activeStoreIndex,
    activeBreakdown,
    maxStoreTotal,
    customer: customerProfile,
    billingCycle,
    activeQuoteCode,
    activeDisplayQuoteNumber,
    activeRevisionId,
    activeRevisionNumber,
    activeRevisionStatus,
    revisionsForQuote
  };
}

function addRenderScopes(scope: RenderScope): void {
  if (Array.isArray(scope)) {
    scope.forEach(addRenderScopes);
    return;
  }
  if (scope === 'all') {
    renderScope.add('sidebar');
    renderScope.add('main');
    renderScope.add('totals');
    return;
  }
  renderScope.add(scope);
}

function render(scope: RenderScope = 'all'): void {
  addRenderScopes(scope);
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (chromeDirty) {
      renderQuoteChrome();
      chromeDirty = false;
    }
    const snapshot = createRenderSnapshot();
    renderTopbar(snapshot);
    renderStatusbar(snapshot);
    if (renderScope.has('sidebar')) renderSidebar(snapshot);
    if (renderScope.has('main')) {
      renderWorkbench(snapshot);
      renderMain(snapshot);
    }
    if (renderScope.has('totals')) renderBottombar(snapshot);
    renderScope.clear();
  });
}

function setupScrubbableInput(inputId: string, baseStep = 1, min = -Infinity, max = Infinity): void {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.style.cursor = 'ew-resize';
  let isDragging = false;
  let startX = 0;
  let startVal = 0;

  el.addEventListener('mousedown', (event) => {
    isDragging = true;
    startX = event.clientX;
    startVal = Number(el.value) || 0;
    document.body.style.cursor = 'ew-resize';
  });

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging) return;
    const dx = event.clientX - startX;
    let step = baseStep;
    if (event.shiftKey) step *= 10;
    if (event.ctrlKey || event.metaKey) step /= 10;

    let newVal = startVal + dx * step;
    newVal = Math.round(newVal / step) * step;
    newVal = Math.max(min, Math.min(max, newVal));

    if (Number(el.value) !== newVal) {
      el.value = String(newVal);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.cursor = '';
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function bindEvents() {
  attachInfoView(document.body);
  bindPressFeedback(document.body);

  const sidebarQuoteMini = optionalElement('sidebarQuoteMini');
  const sidebarQuotePopover = optionalElement('sidebarQuotePopover');
  const setSidebarQuotePopoverOpen = (isOpen: boolean) => {
    sidebarQuoteMini?.classList.toggle('is-open', isOpen);
    sidebarQuotePopover?.classList.toggle('is-open', isOpen);
    sidebarQuoteMini?.setAttribute('aria-expanded', String(isOpen));
    sidebarQuotePopover?.setAttribute('aria-hidden', String(!isOpen));
  };
  sidebarQuoteMini?.addEventListener('click', (event) => {
    event.stopPropagation();
    setSidebarQuotePopoverOpen(!sidebarQuoteMini.classList.contains('is-open'));
  });

  const searchInput = optionalElement('searchInput');
  const searchClear = optionalElement('searchClear');
  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener('input', () => render('sidebar'));
  }
  if (searchInput instanceof HTMLInputElement && searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      render('sidebar');
    });
  }

  document.getElementById('storeList').addEventListener('click', (event) => {
    const removeBtn = closestFromEvent(event, '[data-remove]');
    if (removeBtn) {
      event.stopPropagation();
      const removeId = resolveStoreId(removeBtn.dataset.remove);
      if (removeId !== null) removeStore(removeId);
      return;
    }

    const item = closestFromEvent(event, '.x-track');
    if (!item) return;
    const newId = resolveStoreId(item.dataset.id);
    if (newId !== null && newId !== activeTabId) {
      activeTabId = newId;
      render(['main', 'sidebar']);
      queueMainPanelSwitch();
      queueActiveTrackPulse();
    }
  });

  const revisionDropdown = optionalElement('revisionDropdown');
  if (revisionDropdown) {
    attachDropdown({
      el: revisionDropdown,
      onSelect: (value) => {
        const revisionId = Number(value);
        if (!revisionId || revisionId === activeRevisionId) return;
        void (async () => {
          await flushDraftPersist();
          await loadRevisionById(revisionId);
        })();
      }
    });
  }

  const cycleSeg = optionalElement('cycleSeg');
  if (cycleSeg) {
    cycleSeg.addEventListener('click', (event) => {
      const button = closestFromEvent(event, '.x-seg__btn');
      if (!button || !button.dataset.cycle) return;
      if (button.dataset.cycle === 'm' || button.dataset.cycle === 'q' || button.dataset.cycle === 'y') {
        billingCycle = button.dataset.cycle;
        invalidateDraftSnapshot();
        render(['main', 'totals']);
        scheduleDraftPersist();
      }
    });
  }

  document.getElementById('addStoreBtn').addEventListener('click', addStore);
  optionalElement('btnDuplicateBranch')?.addEventListener('click', duplicateActiveStore);

  const bulkDd = document.getElementById('bulkBusinessType');
  const bulkRowsEl = document.getElementById('bulkRows');

  document.getElementById('btnBulkAdd').addEventListener('click', openBulkAddModal);
  document.getElementById('closeBulkAdd').addEventListener('click', closeBulkAddModal);
  document.getElementById('cancelBulkAdd').addEventListener('click', closeBulkAddModal);
  document.getElementById('applyBulkAdd').addEventListener('click', addBulkRows);
  bindModalFrame('bulkAddModal', closeBulkAddModal);

  attachDropdown({
    el: bulkDd,
    onSelect: (value) => {
      bulkType = value;
      renderBulkType();
    }
  });

  bulkRowsEl.addEventListener('input', (event) => {
    const input = closestFromEvent(event, '.bulk-area-input');
    if (!input) return;
    bulkAreas[Number(input.dataset.index)] = input.value;
    updateBulkSummary();
  });

  bulkRowsEl.addEventListener('keydown', (event) => {
    const input = closestFromEvent(event, '.bulk-area-input');
    if (!input || event.key !== 'Enter') return;
    event.preventDefault();
    const index = Number(input.dataset.index);
    bulkAreas[index] = input.value;
    if (index === bulkAreas.length - 1) bulkAreas.push('');
    renderBulkRows(index + 1);
  });

  bulkRowsEl.addEventListener('paste', (event) => {
    const input = closestFromEvent(event, '.bulk-area-input');
    if (!input) return;
    const text = event.clipboardData?.getData('text') ?? '';
    const lines = text.split(/\r?\n/).map(parseBulkAreaLine).filter(Boolean);
    if (lines.length <= 1) return;
    event.preventDefault();
    const index = Number(input.dataset.index);
    lines.forEach((line, offset) => {
      bulkAreas[index + offset] = line;
    });
    const nextIndex = index + lines.length;
    bulkAreas[nextIndex] = bulkAreas[nextIndex] || '';
    renderBulkRows(nextIndex);
  });

  document.getElementById('workBranchTitle').addEventListener('input', (event) => updateActive('name', valueFromEvent(event)));
  document.getElementById('areaInput').addEventListener('input', (event) => updateActive('area', valueFromEvent(event)));

  const businessTypeDropdown = document.getElementById('businessType');
  attachDropdown({
    el: businessTypeDropdown,
    onSelect: (value) => updateActive('type', value)
  });

  attachDatepicker({
    el: document.getElementById('startDatePicker'),
    getValue: () => getActive()?.startDate ?? '',
    onSelect: (value) => updateActive('startDate', value)
  });
  attachDatepicker({
    el: document.getElementById('endDatePicker'),
    getValue: () => getActive()?.endDate ?? '',
    onSelect: (value) => updateActive('endDate', value)
  });

  document.querySelectorAll('.csection__head').forEach((header) => {
    header.addEventListener('click', () => {
      const section = header.closest('.csection');
      if (!section) return;
      const body = section.querySelector('.csection__body');
      if (!body) return;
      const isCollapsed = section.classList.contains('collapsed');

      if (isCollapsed) {
        section.classList.remove('collapsed');
        gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: MOTION_STRUCT_SECONDS, ease: 'power2.out' });
      } else {
        gsap.to(body, { height: 0, opacity: 0, duration: MOTION_STRUCT_SECONDS, ease: 'power2.out', onComplete: () => section.classList.add('collapsed') });
      }
    });
  });

  document.getElementById('accountToggle').addEventListener('click', () => {
    hasAccountFee = !hasAccountFee;
    commitQuoteMutation();
  });
  document.getElementById('websiteToggle').addEventListener('click', () => {
    hasWebsiteFee = !hasWebsiteFee;
    commitQuoteMutation();
  });
  document.getElementById('qtgToggle').addEventListener('click', () => {
    hasQTG = !hasQTG;
    normalizeAccountFeeMode();
    commitQuoteMutation();
  });
  document.getElementById('qlqToggle').addEventListener('click', () => {
    hasQLQ = !hasQLQ;
    normalizeAccountFeeMode();
    commitQuoteMutation();
  });

  document.getElementById('accountFeeModeSeg').addEventListener('click', (event) => {
    const btn = closestFromEvent<HTMLButtonElement>(event, '.x-seg__btn');
    if (!btn || btn.disabled) return;
    const nextAccountMode = btn.dataset.accountMode;
    if (nextAccountMode === 'standard' || (nextAccountMode === 'standalone' && canUseStandaloneAccountFee())) {
      accountFeeMode = nextAccountMode;
      commitQuoteMutation();
    }
  });

  document.getElementById('boxModeSeg').addEventListener('click', (event) => {
    const btn = closestFromEvent(event, '.x-seg__btn');
    if (!btn) return;
    const nextBoxMode = btn.dataset.mode;
    if (nextBoxMode === 'none' || nextBoxMode === 'buy' || nextBoxMode === 'rent') {
      boxMode = nextBoxMode;
    }
    commitQuoteMutation();
  });

  attachCounter({
    input: document.getElementById('boxCount') as HTMLInputElement,
    minus: document.getElementById('boxMinus'),
    plus: document.getElementById('boxPlus'),
    min: 1,
    max: 1000,
    onChange: (value) => {
      globalBoxCount = value;
      commitQuoteMutation();
    }
  });

  const discountFieldById: Record<string, keyof GlobalDiscounts> = {
    discountAccountKnob: 'account',
    discountWebsiteKnob: 'website',
    discountBoxKnob: 'box',
    discountQTGKnob: 'qtg',
    discountQLQKnob: 'qlq'
  };
  const discountApplyById: Record<string, keyof DiscountToggles> = {
    discountAccountApply: 'account',
    discountWebsiteApply: 'website',
    discountBoxApply: 'box',
    discountQTGApply: 'qtg',
    discountQLQApply: 'qlq'
  };
  Object.keys(discountApplyById).forEach((id) => {
    optionalElement(id)?.addEventListener('click', () => {
      const field = discountApplyById[id];
      if (!field) return;
      discountEnabled[field] = !discountEnabled[field];
      const bank = optionalElement(id)?.closest<HTMLElement>('.x-discount-bank');
      if (bank) restartMotionClass(bank, 'motion-accent-pop', 420);
      commitQuoteMutation();
    });
  });
  Object.keys(discountFieldById).forEach((id) => {
    const knob = optionalElement(id);
    const discountField = discountFieldById[id];
    if (!knob || !discountField) return;
    attachKnob({
      el: knob,
      min: 0,
      max: 100,
      step: 1,
      defaultVal: 0,
      onChange: (value) => {
        globalDiscounts[discountField] = value;
        commitQuoteMutation();
      }
    });
  });

  document.getElementById('vatControl').addEventListener('click', (event) => {
    const btn = closestFromEvent(event, '.x-seg__btn');
    if (!btn) return;
    vatRate = Number(btn.dataset.vat);
    commitQuoteMutation('totals');
  });

  setupScrubbableInput('areaInput', 1, 1, 10000);
  setupScrubbableInput('boxCount', 1, 1, 1000);

  // --- New Menu Dropdown ---
  const btnNewMenu = document.getElementById('btnNewMenu');
  const newDropdownWrapper = document.getElementById('newDropdownWrapper');
  const btnNewQuote = document.getElementById('btnNewQuote');
  const btnNewRevision = document.getElementById('btnNewRevision');
  const btnImportQuote = document.getElementById('btnImportQuote');

  if (btnNewMenu && newDropdownWrapper) {
    btnNewMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = newDropdownWrapper.classList.contains('is-open');
      closeLooseDropdowns(newDropdownWrapper);
      setLooseDropdownOpen(newDropdownWrapper, !isOpen);
    });
  }
  if (btnNewQuote) btnNewQuote.addEventListener('click', () => { void createNewQuote(); setLooseDropdownOpen(newDropdownWrapper, false); });
  if (btnNewRevision) btnNewRevision.addEventListener('click', () => { void createNewRevision(); setLooseDropdownOpen(newDropdownWrapper, false); });
  if (btnImportQuote) btnImportQuote.addEventListener('click', () => { void importQuoteFromPdf(); setLooseDropdownOpen(newDropdownWrapper, false); });

  document.getElementById('btnCustomer').addEventListener('click', openCustomerModal);
  const exportMenuWrapper = document.getElementById('exportDropdownWrapper');
  document.getElementById('btnExportMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = exportMenuWrapper.classList.contains('is-open');
    closeLooseDropdowns(exportMenuWrapper);
    setLooseDropdownOpen(exportMenuWrapper, !isOpen);
  });
  document.addEventListener('click', (e) => {
    const target = e.target instanceof Node ? e.target : null;
    if (!target) return;
    if (!newDropdownWrapper?.contains(target)) setLooseDropdownOpen(newDropdownWrapper, false);
    if (!exportMenuWrapper.contains(target)) setLooseDropdownOpen(exportMenuWrapper, false);
    if (!sidebarQuoteMini?.contains(target) && !sidebarQuotePopover?.contains(target)) {
      setSidebarQuotePopoverOpen(false);
    }
  });

  document.getElementById('btnExportPdf').addEventListener('click', () => {
    setLooseDropdownOpen(exportMenuWrapper, false);
    performExportPdf();
  });
  document.getElementById('btnExportExcel').addEventListener('click', () => {
    setLooseDropdownOpen(exportMenuWrapper, false);
    performExportExcel();
  });
  document.getElementById('btnSaveDraftFile').addEventListener('click', () => {
    setLooseDropdownOpen(exportMenuWrapper, false);
    performSaveDraftFile();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setSidebarQuotePopoverOpen(false);

    const isMod = event.metaKey || event.ctrlKey;
    const isShift = event.shiftKey;
    const key = event.key.toLowerCase();

    // Undo/Redo
    if (isMod && key === 'z') {
      event.preventDefault();
      if (isShift) {
        void performRedo();
      } else {
        void performUndo();
      }
      return;
    }

    // Export PDF: Cmd+E
    if (isMod && key === 'e' && !isShift) {
      event.preventDefault();
      performExportPdf();
      return;
    }

    // Export Excel: Shift+Cmd+E (Fixes plain 'e' bug)
    if (isMod && key === 'e' && isShift) {
      event.preventDefault();
      performExportExcel();
      return;
    }

    // Save: Cmd+S
    if (isMod && key === 's') {
      event.preventDefault();
      performSaveDraftFile();
      return;
    }

    // New Quote: Cmd+N
    if (isMod && key === 'n' && !isShift) {
      event.preventDefault();
      void createNewQuote();
      return;
    }

    // New Revision: Shift+Cmd+N
    if (isMod && key === 'n' && isShift) {
      event.preventDefault();
      void createNewRevision();
      return;
    }

    // Import: Cmd+O
    if (isMod && key === 'o') {
      event.preventDefault();
      void importQuoteFromPdf();
      return;
    }

    // Navigation and Deletion (when not in an input)
    const activeEl = document.activeElement;
    const isInput = activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.hasAttribute('contenteditable'));
    if (!isInput) {
      // Sidebar Navigation: Up/Down
      if (key === 'arrowup' || key === 'arrowdown') {
        event.preventDefault();
        navigateSidebar(key === 'arrowup' ? -1 : 1);
        return;
      }

      // Branch Deletion: Delete/Backspace
      if (key === 'backspace' || key === 'delete') {
        event.preventDefault();
        if (activeTabId) {
          removeStore(activeTabId);
        }
        return;
      }
    }
  });

  document.getElementById('btnSettings').addEventListener('click', openSettingsModal);
  document.getElementById('closeSettings').addEventListener('click', closeSettingsModal);
  document.getElementById('cancelSettings').addEventListener('click', closeSettingsModal);
  bindModalFrame('settingsModal', closeSettingsModal);
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    preparedByProfile = readPreparedByFields();
    invalidateDraftSnapshot();
    setPreparedByDefaults(preparedByProfile);
    closeSettingsModal();
    scheduleDraftPersist();
  });

  document.getElementById('closeCustomerModal').addEventListener('click', closeCustomerModal);
  document.getElementById('cancelCustomerModal').addEventListener('click', closeCustomerModal);
  bindModalFrame('customerModal', closeCustomerModal);
  document.getElementById('confirmCustomerExport').addEventListener('click', saveCustomerProfile);
  document.getElementById('customerModal').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveCustomerProfile();
    }
  });

  document.getElementById('closeImportPreviewModal').addEventListener('click', closeImportPreviewModal);
  document.getElementById('cancelImportPreview').addEventListener('click', closeImportPreviewModal);
  bindModalFrame('importPreviewModal', closeImportPreviewModal);
  document.getElementById('importActionOptions').addEventListener('click', (event) => {
    const action = closestFromEvent(event, '[data-action]');
    if (!action) return;
    const nextAction = action.dataset.action;
    if (
      nextAction === 'import_new_quote' ||
      nextAction === 'attach_to_existing_chain' ||
      nextAction === 'open_existing' ||
      nextAction === 'replace_existing_revision' ||
      nextAction === 'import_duplicate_quote_copy'
    ) {
      selectedImportAction = nextAction;
    }
    if (activeImportPreview) renderImportActionOptions(activeImportPreview);
  });
  document.getElementById('confirmImportPreview').addEventListener('click', confirmImportPreview);
}

async function init() {
  bindEvents();
  renderQuoteChrome();

  if (!window.electronAPI) {
    const now = new Date().toISOString();
    const fallbackSnapshot = buildInitialDraftSnapshot();
    applyRevisionBundle({
      quote: {
        id: 1,
        quoteCode: 'XMS-LOCAL-001',
        currentRevisionNumber: 0,
        status: 'draft',
        createdAt: now,
        updatedAt: now
      },
      activeRevision: {
        id: 1,
        quoteId: 1,
        quoteCode: 'XMS-LOCAL-001',
        revisionNumber: 0,
        displayQuoteNumber: 'XMS-LOCAL-001',
        source: 'new',
        embeddedPayloadVersion: null,
        pdfFilePath: null,
        pdfFingerprint: null,
        exportedAt: null,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        customer: blankCustomer(),
        preparedBy: getDefaultPreparedBy(),
        calcOptions: fallbackSnapshot.calcOptions,
        stores: fallbackSnapshot.stores,
        totals: {},
        quoteIdentity: {
          quoteCode: 'XMS-LOCAL-001',
          revisionNumber: 0,
          revisionLabel: 'Base',
          displayQuoteNumber: 'XMS-LOCAL-001'
        }
      },
      revisions: []
    });
    return;
  }

  try {
    const bundle = await window.electronAPI.getStartupRevision();
    if (bundle) {
      applyRevisionBundle(bundle);
      return;
    }
    const newBundle = await window.electronAPI.createNewQuote(buildInitialDraftSnapshot());
    applyRevisionBundle(newBundle);
  } catch (error) {
    console.error(error);
    alert(asErrorMessage(error, 'Không thể khởi tạo quote workflow.'));
  }
}

document.addEventListener('DOMContentLoaded', init);
