/* XMusic Station — Quote Workflow v1.6 */

import {
  BUSINESS_TYPES,
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
import { attachInfoView } from './modules/controllers/infoview';
import { formatVND } from './modules/format';
import { paletteVar } from './modules/palette';
import { renderBottombar } from './modules/render-bottombar';
import { renderSidebar } from './modules/render-sidebar';
import { renderStatusbar } from './modules/render-statusbar';
import { renderTopbar } from './modules/render-topbar';
import { renderWorkbench } from './modules/render-workbench';

import type {
  CalcOptions,
  CustomerProfile,
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

function closestFromEvent<T extends Element>(event: Event, selector: string): T | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest(selector) as T | null;
}

function optionalElement(id: string): HTMLElement | null {
  return document.getElementById(id) as HTMLElement | null;
}

function clearSidebarSearch(): void {
  const searchInput = optionalElement('searchInput');
  if (searchInput instanceof HTMLInputElement) searchInput.value = '';
}

function valueFromEvent(event: Event): string {
  return event.target instanceof HTMLElement ? String(event.target.value) : '';
}

function asErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
let baseSalary: number = DEFAULT_BASE_SALARY;
let vatRate: number = 0;
let stores: Store[] = [];
let activeTabId: number | null = null;

let boxMode: CalcOptions['boxMode'] = 'none';
let globalBoxCount: number = 1;
let hasAccountFee: boolean = true;
let hasQTG: boolean = true;
let hasQLQ: boolean = true;

let globalDiscounts: GlobalDiscounts = {
  account: 0,
  box: 0,
  qtg: 0,
  qlq: 0
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

function statusLabel(status: RevisionStatus): string {
  if (status === 'exported') return 'Exported';
  if (status === 'imported') return 'Imported';
  return 'Draft';
}

function revisionLabel(revisionNumber: number): string {
  return Number(revisionNumber) > 0 ? `R${revisionNumber}` : 'Base';
}

function getCalcOptions(): CalcOptions {
  return {
    baseSalary,
    vatRate,
    boxMode,
    globalBoxCount,
    hasAccountFee,
    hasQTG,
    hasQLQ,
    globalDiscounts: { ...globalDiscounts }
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
      boxMode: 'none',
      globalBoxCount: 1,
      hasAccountFee: true,
      hasQTG: true,
      hasQLQ: true,
      globalDiscounts: { account: 0, box: 0, qtg: 0, qlq: 0 }
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

function hydrateEditorFromRevision(revision: QuoteRevision): void {
  isHydratingRevision = true;

  const snapshot = {
    customer: normalizeProfile(revision.customer),
    preparedBy: normalizePreparedBy(revision.preparedBy),
    calcOptions: normalizeCalcOptions(revision.calcOptions),
    stores: normalizeStores(revision.stores)
  };

  customerProfile = snapshot.customer;
  preparedByProfile = snapshot.preparedBy;
  setCustomerFields(customerProfile);
  setSettingsFields(preparedByProfile);

  baseSalary = snapshot.calcOptions.baseSalary;
  vatRate = snapshot.calcOptions.vatRate;
  boxMode = snapshot.calcOptions.boxMode;
  globalBoxCount = snapshot.calcOptions.globalBoxCount;
  hasAccountFee = snapshot.calcOptions.hasAccountFee;
  hasQTG = snapshot.calcOptions.hasQTG;
  hasQLQ = snapshot.calcOptions.hasQLQ;
  globalDiscounts = { ...snapshot.calcOptions.globalDiscounts };

  stores = snapshot.stores.length ? snapshot.stores : [createStore(1)];
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

function applyRevisionBundle(bundle: RevisionBundle | null): void {
  if (!bundle || !bundle.activeRevision) return;
  syncBundleMetadata(bundle);
  hydrateEditorFromRevision(bundle.activeRevision);
}

function setCustomerFields(customer: CustomerProfile): void {
  document.getElementById('customerCompany').value = customer.companyName || '';
  document.getElementById('customerContactName').value = customer.contactName || '';
  document.getElementById('customerDepartment').value = customer.department || '';
  document.getElementById('customerEmail').value = customer.email || '';
  document.getElementById('customerPhone').value = customer.phone || '';
}

function setSettingsFields(settings: PreparedByProfile): void {
  document.getElementById('settingName').value = settings.name || '';
  document.getElementById('settingTitle').value = settings.title || '';
  document.getElementById('settingDepartment').value = settings.department || '';
  document.getElementById('settingEmail').value = settings.email || '';
  document.getElementById('settingPhone').value = settings.phone || '';
}

function readCustomerFields(): CustomerProfile {
  return normalizeProfile({
    companyName: document.getElementById('customerCompany').value.trim(),
    contactName: document.getElementById('customerContactName').value.trim(),
    department: document.getElementById('customerDepartment').value.trim(),
    email: document.getElementById('customerEmail').value.trim(),
    phone: document.getElementById('customerPhone').value.trim()
  });
}

function readPreparedByFields(): PreparedByProfile {
  return normalizePreparedBy({
    name: document.getElementById('settingName').value.trim(),
    title: document.getElementById('settingTitle').value.trim(),
    department: document.getElementById('settingDepartment').value.trim(),
    email: document.getElementById('settingEmail').value.trim(),
    phone: document.getElementById('settingPhone').value.trim()
  });
}

function renderQuoteChrome() {
  const sidebarStatusText = optionalElement('quoteStatusText');
  if (sidebarStatusText) sidebarStatusText.textContent = statusLabel(activeRevisionStatus);
  const sidebarStatusChip = optionalElement('quoteStatusChip');
  if (sidebarStatusChip) {
    sidebarStatusChip.classList.toggle('x-chip--status-draft', activeRevisionStatus === 'draft');
    sidebarStatusChip.classList.toggle('x-chip--status-sent', activeRevisionStatus === 'imported');
    sidebarStatusChip.classList.toggle('x-chip--status-accepted', activeRevisionStatus === 'exported');
  }

  const revisionList = document.getElementById('revisionList');
  if (revisionList) {
    revisionList.innerHTML = revisionsForQuote.map((revision) => `
      <button class="revision-item${revision.id === activeRevisionId ? ' active' : ''}" data-revision-id="${revision.id}">
        <div class="revision-item-main">
          <strong>${escapeHTML(revision.displayQuoteNumber)}</strong>
          <span>${escapeHTML(revisionLabel(revision.revisionNumber))}</span>
        </div>
        <span class="status-chip">${escapeHTML(statusLabel(revision.status))}</span>
      </button>
    `).join('');
  }
}

function openCustomerModal() {
  setCustomerFields(customerProfile);
  document.getElementById('customerModal').classList.remove('hidden');
  requestAnimationFrame(() => document.getElementById('customerCompany').focus());
}

function closeCustomerModal() {
  document.getElementById('customerModal').classList.add('hidden');
}

function openSettingsModal() {
  setSettingsFields(preparedByProfile);
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function closeImportPreviewModal() {
  activeImportPreview = null;
  selectedImportAction = null;
  document.getElementById('importPreviewModal').classList.add('hidden');
}

function renderImportActionOptions(preview: ImportPreview): void {
  const container = document.getElementById('importActionOptions');
  container.innerHTML = preview.actions.map((action) => `
    <button class="import-action-option${action.key === selectedImportAction ? ' active' : ''}" data-action="${action.key}">
      <strong>${escapeHTML(action.label)}</strong>
    </button>
  `).join('');
}

function openImportPreviewModal(preview: ImportPreview): void {
  activeImportPreview = preview;
  selectedImportAction = preview.recommendedAction;

  document.getElementById('importPreviewFileName').textContent = preview.fileName || '-';
  document.getElementById('importPreviewQuoteNumber').textContent = preview.preview.displayQuoteNumber;
  document.getElementById('importPreviewCustomer').textContent = preview.preview.customerName || '-';
  document.getElementById('importPreviewBranchCount').textContent = `${preview.preview.branchCount} branches`;
  document.getElementById('importPreviewGrandTotal').textContent = `${formatVND(preview.preview.grandTotal)} ₫`;
  document.getElementById('importPreviewCompatibility').textContent = preview.preview.manifestCompatibility;
  document.getElementById('importPreviewSummary').textContent = preview.summary;
  renderImportActionOptions(preview);
  document.getElementById('importPreviewModal').classList.remove('hidden');
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
  applyRevisionBundle(bundle);
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
    closeImportPreviewModal();
    applyRevisionBundle(bundle);
  } catch (error) {
    console.error(error);
    alert(asErrorMessage(error, 'Không thể hoàn tất import.'));
  }
}

async function exportActiveQuote() {
  if (!window.electronAPI) {
    alert('Không thể kết nối tới Electron API. Vui lòng khởi động lại ứng dụng.');
    return;
  }
  if (!activeRevisionId) {
    alert('Không tìm thấy revision đang mở để export.');
    return;
  }
  customerProfile = readCustomerFields();
  invalidateDraftSnapshot();
  if (!customerProfile.companyName) {
    document.getElementById('customerCompany').focus();
    return;
  }

  closeCustomerModal();
  scheduleDraftPersist();
  await flushDraftPersist();

  const exportBtn = optionalElement('btnSave');
  if (exportBtn) {
    exportBtn.style.opacity = '0.5';
    exportBtn.style.pointerEvents = 'none';
  }

  try {
    const result = await window.electronAPI.exportQuote({
      revisionId: activeRevisionId,
      snapshot: buildDraftSnapshot()
    });
    if (result?.bundle) {
      syncBundleMetadata(result.bundle);
      render();
    }
  } catch (error) {
    console.error(error);
    alert(asErrorMessage(error, 'Error exporting PDF'));
  } finally {
    if (exportBtn) {
      exportBtn.style.opacity = '1';
      exportBtn.style.pointerEvents = 'auto';
    }
  }
}

function performExport() {
  if (!preparedByProfile.name) {
    openSettingsModal();
    return;
  }
  openCustomerModal();
}

async function saveCurrentDraft(): Promise<void> {
  const saveBtn = optionalElement('btnSave');
  if (saveBtn) {
    saveBtn.style.opacity = '0.65';
    saveBtn.style.pointerEvents = 'none';
  }

  try {
    invalidateDraftSnapshot();
    scheduleDraftPersist();
    await flushDraftPersist();
  } finally {
    if (saveBtn) {
      saveBtn.style.opacity = '1';
      saveBtn.style.pointerEvents = 'auto';
    }
  }
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
    id: Date.now() + Math.random(),
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
  gsap.fromTo(`[data-id="${store.id}"]`, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25 });
}

function removeStore(id: number): void {
  if (stores.length <= 1) return;
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) gsap.killTweensOf(el);
  gsap.to(el, {
    x: -20,
    opacity: 0,
    height: 0,
    padding: 0,
    margin: 0,
    duration: 0.2,
    onComplete: () => {
      stores = stores.filter((store) => store.id !== id);
      if (activeTabId === id) activeTabId = stores[0]?.id ?? null;
      commitQuoteMutation();
    }
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
  dd.querySelectorAll('.dropdown-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.value === bulkType);
  });
}

function renderBulkRows(focusIndex: number | null = null): void {
  const rowsEl = document.getElementById('bulkRows');
  if (!rowsEl) return;
  if (bulkAreas.length === 0) bulkAreas = [''];
  const startIndex = stores.length + 1;
  rowsEl.innerHTML = bulkAreas.map((value, index) => {
    const color = paletteVar(startIndex + index - 1);
    return `
      <div class="bulk-row" data-index="${index}" style="--bulk-row-color: ${color}">
        <div class="bulk-index">${String(startIndex + index).padStart(2, '0')}</div>
        <div class="bulk-area-wrap">
          <input class="bulk-area-input tnum" type="text" inputmode="decimal" value="${escapeHTML(value)}" data-index="${index}" placeholder="Nhập diện tích">
        </div>
      </div>`;
  }).join('');
  document.getElementById('bulkRowCount').textContent = `${getFilledBulkRows().length} rows`;
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
  document.getElementById('bulkAddModal').classList.remove('hidden');
}

function closeBulkAddModal() {
  document.getElementById('bulkAddModal').classList.add('hidden');
  document.getElementById('bulkBusinessType').classList.remove('open');
}

function addBulkRows() {
  const areas = getFilledBulkRows();
  if (areas.length === 0) {
    renderBulkRows(0);
    return;
  }

  let firstCreatedId: number | null = null;
  areas.forEach((areaValue) => {
    const store = createStore(stores.length + 1);
    store.type = bulkType;
    store.area = areaValue;
    stores.push(store);
    if (!firstCreatedId) firstCreatedId = store.id;
  });

  activeTabId = firstCreatedId || activeTabId;
  closeBulkAddModal();
  commitQuoteMutation();
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
    duration: 0.4,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = formatVND(tweenObj.val);
    }
  });
}

function renderMain(snapshot: RenderSnapshot): void {
  const store = snapshot.activeStore;
  if (!store) return;
  const area = Number(store.area) || 0;
  const breakdown = snapshot.activeBreakdown;
  const duration = breakdown?.duration ?? calculateDurationMonths(store.startDate, store.endDate);
  const coef = breakdown?.coef ?? calculateCoef(store.type, area);

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
  const accRight = document.getElementById('accountFeeRight');

  if (hasAccountFee) {
    accRight.classList.remove('is-disabled');
    document.getElementById('discountAccountVal').textContent = String(globalDiscounts.account);
    const accSlider = document.getElementById('discountAccount');
    if (document.activeElement !== accSlider) accSlider.value = String(globalDiscounts.account);
    accSlider.style.setProperty('--val', `${globalDiscounts.account}%`);
  } else {
    accRight.classList.add('is-disabled');
  }

  document.querySelectorAll('#boxModeSeg .x-seg__btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === boxMode);
  });
  document.getElementById('boxQuantityRow').toggleAttribute('hidden', boxMode === 'none');
  const boxInput = document.getElementById('boxCount');
  if (document.activeElement !== boxInput) boxInput.value = String(globalBoxCount);

  const boxDiscountRow = document.getElementById('boxDiscountRow');
  if (boxMode === 'buy') {
    boxDiscountRow.removeAttribute('hidden');
    document.getElementById('discountBoxVal').textContent = String(globalDiscounts.box);
    const boxSlider = document.getElementById('discountBox');
    if (document.activeElement !== boxSlider) boxSlider.value = String(globalDiscounts.box);
    boxSlider.style.setProperty('--val', `${globalDiscounts.box}%`);
  } else {
    boxDiscountRow.setAttribute('hidden', '');
  }

  const boxPriceDesc = document.getElementById('boxPriceDesc');
  if (boxMode === 'buy') boxPriceDesc.textContent = '2.000.000 ₫ / thiết bị · chi phí một lần · cấp mỗi chi nhánh';
  else if (boxMode === 'rent') boxPriceDesc.textContent = '1.000.000 ₫ / thiết bị / năm · prorated · cấp mỗi chi nhánh';
  else boxPriceDesc.textContent = 'Chọn hình thức trang bị cho mỗi chi nhánh';

  document.getElementById('qtgCoef').textContent = coef.toFixed(2);
  document.getElementById('qtgDur').textContent = `${duration.toFixed(1)}m`;

  const qtgToggle = document.getElementById('qtgToggle');
  qtgToggle.classList.toggle('is-on', hasQTG);
  qtgToggle.textContent = hasQTG ? 'BẬT' : 'TẮT';
  const qtgRow = qtgToggle.closest('.x-row') ?? qtgToggle;
  const qtgMid = qtgRow.querySelector('.x-row__rhs');
  const qtgRight = qtgRow.querySelector('.x-row__amount');

  if (hasQTG) {
    qtgMid.classList.remove('is-disabled');
    qtgRight.classList.remove('is-disabled');
    document.getElementById('discountQTGVal').textContent = String(globalDiscounts.qtg);
    const qtgSlider = document.getElementById('discountQTG');
    if (document.activeElement !== qtgSlider) qtgSlider.value = String(globalDiscounts.qtg);
    qtgSlider.style.setProperty('--val', `${globalDiscounts.qtg}%`);
    animateNumber('qtgAmount', breakdown?.qtgAmount || 0);
  } else {
    qtgMid.classList.add('is-disabled');
    qtgRight.classList.add('is-disabled');
    animateNumber('qtgAmount', 0);
  }

  document.getElementById('qlqCoef').textContent = coef.toFixed(2);
  document.getElementById('qlqDur').textContent = `${duration.toFixed(1)}m`;

  const qlqToggle = document.getElementById('qlqToggle');
  qlqToggle.classList.toggle('is-on', hasQLQ);
  qlqToggle.textContent = hasQLQ ? 'BẬT' : 'TẮT';
  const qlqRow = qlqToggle.closest('.x-row') ?? qlqToggle;
  const qlqMid = qlqRow.querySelector('.x-row__rhs');
  const qlqRight = qlqRow.querySelector('.x-row__amount');

  if (hasQLQ) {
    qlqMid.classList.remove('is-disabled');
    qlqRight.classList.remove('is-disabled');
    document.getElementById('discountQLQVal').textContent = String(globalDiscounts.qlq);
    const qlqSlider = document.getElementById('discountQLQ');
    if (document.activeElement !== qlqSlider) qlqSlider.value = String(globalDiscounts.qlq);
    qlqSlider.style.setProperty('--val', `${globalDiscounts.qlq}%`);
    animateNumber('qlqAmount', breakdown?.qlqAmount || 0);
  } else {
    qlqMid.classList.add('is-disabled');
    qlqRight.classList.add('is-disabled');
    animateNumber('qlqAmount', 0);
  }
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
    activeQuoteCode,
    activeDisplayQuoteNumber,
    activeRevisionNumber,
    activeRevisionStatus
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

function buildCalendar(dateStr: string, wrapperEl: HTMLElement): void {
  const date = new Date(dateStr);
  let curYear = date.getFullYear();
  let curMonth = date.getMonth();
  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

  const headTitle = wrapperEl.querySelector('.x-datepicker__monthyear');
  const grid = wrapperEl.querySelector('.x-datepicker__grid');

  const refreshGrid = () => {
    headTitle.textContent = `${monthNames[curMonth]}, ${curYear}`;
    grid.innerHTML = '';

    const firstDay = (new Date(curYear, curMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();

    let html = '';
    for (let i = 0; i < firstDay; i += 1) html += '<div class="x-datepicker__cell is-dim"></div>';

    const today = new Date();
    for (let i = 1; i <= daysInMonth; i += 1) {
      const isToday = today.getDate() === i && today.getMonth() === curMonth && today.getFullYear() === curYear;
      const isSelected = date.getDate() === i && date.getMonth() === curMonth && date.getFullYear() === curYear;
      const cellDateStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      html += `<div class="x-datepicker__cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-date="${cellDateStr}">${i}</div>`;
    }
    grid.innerHTML = html;
  };
  refreshGrid();

  if (!wrapperEl.dataset.bound) {
    wrapperEl.querySelectorAll('.x-datepicker__nav').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        curMonth += parseInt(btn.dataset.dir ?? '0', 10);
        if (curMonth < 0) {
          curMonth = 11;
          curYear -= 1;
        } else if (curMonth > 11) {
          curMonth = 0;
          curYear += 1;
        }
        refreshGrid();
      });
    });
    wrapperEl.dataset.bound = 'true';
  }
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
      removeStore(parseFloat(removeBtn.dataset.remove ?? '0'));
      return;
    }

    const item = closestFromEvent(event, '.x-track');
    if (!item) return;
    const newId = parseFloat(item.dataset.id ?? '0');
    if (newId !== activeTabId) {
      activeTabId = newId;
      gsap.fromTo('#mainContent', { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.2 });
      render(['main', 'sidebar']);
    }
  });

  const revisionList = optionalElement('revisionList');
  if (revisionList) {
    revisionList.addEventListener('click', async (event) => {
      const item = closestFromEvent(event, '[data-revision-id]');
      if (!item) return;
      const revisionId = Number(item.dataset.revisionId);
      if (!revisionId || revisionId === activeRevisionId) return;
      await flushDraftPersist();
      await loadRevisionById(revisionId);
    });
  }

  const cycleSeg = optionalElement('cycleSeg');
  if (cycleSeg) {
    cycleSeg.addEventListener('click', (event) => {
      const button = closestFromEvent(event, '.x-seg__btn');
      if (!button || !button.dataset.cycle) return;
      cycleSeg.querySelectorAll('.x-seg__btn').forEach((el) => {
        el.classList.toggle('is-active', el === button);
      });
      renderStatusbar(createRenderSnapshot());
    });
  }

  document.getElementById('addStoreBtn').addEventListener('click', addStore);

  const bulkAddModal = document.getElementById('bulkAddModal');
  const bulkDd = document.getElementById('bulkBusinessType');
  const bulkMenu = bulkDd.querySelector('.dropdown-menu');
  const bulkRowsEl = document.getElementById('bulkRows');

  document.getElementById('btnBulkAdd').addEventListener('click', openBulkAddModal);
  document.getElementById('closeBulkAdd').addEventListener('click', closeBulkAddModal);
  document.getElementById('cancelBulkAdd').addEventListener('click', closeBulkAddModal);
  document.getElementById('applyBulkAdd').addEventListener('click', addBulkRows);
  bulkAddModal.querySelector('.modal-overlay').addEventListener('click', closeBulkAddModal);

  bulkDd.addEventListener('click', (event) => {
    const item = closestFromEvent(event, '.dropdown-item');
    if (item) {
      bulkType = item.dataset.value ?? '';
      renderBulkType();
    }
    const isOpen = bulkDd.classList.contains('open');
    if (!isOpen) {
      bulkDd.classList.add('open');
      gsap.fromTo(bulkMenu, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.2 });
    } else {
      gsap.to(bulkMenu, { height: 0, opacity: 0, duration: 0.15, onComplete: () => bulkDd.classList.remove('open') });
    }
  });

  bulkRowsEl.addEventListener('input', (event) => {
    const input = closestFromEvent(event, '.bulk-area-input');
    if (!input) return;
    bulkAreas[Number(input.dataset.index)] = input.value;
    document.getElementById('bulkRowCount').textContent = `${getFilledBulkRows().length} rows`;
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

  const dd = document.getElementById('businessType');
  dd.addEventListener('click', (event) => {
    const item = closestFromEvent(event, '.x-dropdown__item');
    if (item) {
      updateActive('type', item.dataset.value ?? '');
      dd.classList.remove('is-open');
      return;
    }
    dd.classList.toggle('is-open');
  });

  const setupDatePicker = (pickerId: string, field: Extract<StoreField, 'startDate' | 'endDate'>): void => {
    const pk = document.getElementById(pickerId);
    pk.addEventListener('click', (event) => {
      const cell = closestFromEvent(event, '.x-datepicker__cell:not(.is-dim)');
      if (cell) {
        updateActive(field, cell.dataset.date ?? '');
        pk.classList.remove('is-open');
        return;
      }
      if (closestFromEvent(event, '.x-datepicker__nav')) return;

      const isOpen = pk.classList.contains('is-open');
      if (!isOpen) {
        const active = getActive();
        if (active) buildCalendar(active[field], pk);
        pk.classList.add('is-open');
      } else {
        pk.classList.remove('is-open');
      }
    });
  };
  setupDatePicker('startDatePicker', 'startDate');
  setupDatePicker('endDatePicker', 'endDate');

  document.addEventListener('click', (event) => {
    const clickTarget = event.target instanceof Node ? event.target : null;
    if (!dd.contains(clickTarget) && dd.classList.contains('is-open')) {
      dd.classList.remove('is-open');
    }
    if (!bulkDd.contains(clickTarget) && bulkDd.classList.contains('open')) {
      gsap.to(bulkMenu, { height: 0, opacity: 0, duration: 0.15, onComplete: () => bulkDd.classList.remove('open') });
    }
    ['startDatePicker', 'endDatePicker'].forEach((id) => {
      const pk = document.getElementById(id);
      if (!pk.contains(clickTarget) && pk.classList.contains('is-open')) {
        pk.classList.remove('is-open');
      }
    });
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
        gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' });
      } else {
        gsap.to(body, { height: 0, opacity: 0, duration: 0.3, ease: 'power2.out', onComplete: () => section.classList.add('collapsed') });
      }
    });
  });

  document.getElementById('accountToggle').addEventListener('click', () => {
    hasAccountFee = !hasAccountFee;
    commitQuoteMutation();
  });
  document.getElementById('qtgToggle').addEventListener('click', () => {
    hasQTG = !hasQTG;
    commitQuoteMutation();
  });
  document.getElementById('qlqToggle').addEventListener('click', () => {
    hasQLQ = !hasQLQ;
    commitQuoteMutation();
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

  document.getElementById('boxMinus').addEventListener('click', () => {
    globalBoxCount = Math.max(1, globalBoxCount - 1);
    commitQuoteMutation();
  });
  document.getElementById('boxPlus').addEventListener('click', () => {
    globalBoxCount += 1;
    commitQuoteMutation();
  });
  document.getElementById('boxCount').addEventListener('input', (event) => {
    globalBoxCount = Math.max(1, Number(valueFromEvent(event)) || 1);
    commitQuoteMutation();
  });

  const discountFieldById: Record<string, keyof GlobalDiscounts> = {
    discountAccount: 'account',
    discountBox: 'box',
    discountQTG: 'qtg',
    discountQLQ: 'qlq'
  };
  Object.keys(discountFieldById).forEach((id) => {
    const sl = document.getElementById(id);
    if (!sl) return;
    const valText = document.getElementById(`${id}Val`);
    sl.addEventListener('input', (event) => {
      const discountField = discountFieldById[id];
      if (!discountField) return;
      globalDiscounts[discountField] = Number(valueFromEvent(event));
      commitQuoteMutation();
      if (valText) gsap.to(valText, { scale: 1.1, duration: 0.1 });
    });
    sl.addEventListener('change', () => {
      if (valText) gsap.to(valText, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
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

  optionalElement('newQuoteBtn')?.addEventListener('click', () => {
    void createNewQuote();
  });
  optionalElement('newRevisionBtn')?.addEventListener('click', () => {
    void createNewRevision();
  });
  optionalElement('importPdfBtn')?.addEventListener('click', () => {
    void importQuoteFromPdf();
  });
  document.getElementById('btnCustomer').addEventListener('click', openCustomerModal);
  document.getElementById('btnSave').addEventListener('click', () => {
    void saveCurrentDraft();
  });

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      performExport();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveCurrentDraft();
    }
  });

  document.getElementById('btnSettings').addEventListener('click', openSettingsModal);
  document.getElementById('closeSettings').addEventListener('click', closeSettingsModal);
  document.getElementById('settingsModal').querySelector('.modal-overlay').addEventListener('click', closeSettingsModal);
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    preparedByProfile = readPreparedByFields();
    invalidateDraftSnapshot();
    setPreparedByDefaults(preparedByProfile);
    closeSettingsModal();
    scheduleDraftPersist();
  });

  document.getElementById('closeCustomerModal').addEventListener('click', closeCustomerModal);
  document.getElementById('cancelCustomerModal').addEventListener('click', closeCustomerModal);
  document.getElementById('customerModal').querySelector('.modal-overlay').addEventListener('click', closeCustomerModal);
  document.getElementById('confirmCustomerExport').addEventListener('click', exportActiveQuote);
  document.getElementById('customerModal').addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await exportActiveQuote();
    }
  });

  document.getElementById('closeImportPreviewModal').addEventListener('click', closeImportPreviewModal);
  document.getElementById('cancelImportPreview').addEventListener('click', closeImportPreviewModal);
  document.getElementById('importPreviewModal').querySelector('.modal-overlay').addEventListener('click', closeImportPreviewModal);
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
