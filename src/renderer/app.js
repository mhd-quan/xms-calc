/* XMusic Station — Quote Workflow v1.6 */

import {
  BUSINESS_TYPES,
  calculateCoef,
  calculateDurationMonths,
  calculateTotals
} from '../shared/calculator';
import {
  buildQuotePayload,
  normalizeCalcOptions,
  normalizePreparedBy,
  normalizeProfile,
  normalizeStores
} from '../services/quote-payload';

let baseSalary = 2340000;
let vatRate = 0;
let stores = [];
let activeTabId = null;

let boxMode = 'none';
let globalBoxCount = 1;
let hasAccountFee = true;
let hasQTG = true;
let hasQLQ = true;

let globalDiscounts = {
  account: 0,
  box: 0,
  qtg: 0,
  qlq: 0
};

let bulkType = '';
let bulkAreas = [''];

let customerProfile = blankCustomer();
let preparedByProfile = blankPreparedBy();

let activeQuoteId = null;
let activeQuoteCode = '';
let activeRevisionId = null;
let activeRevisionNumber = 0;
let activeDisplayQuoteNumber = '';
let activeRevisionStatus = 'draft';
let revisionsForQuote = [];

let activeImportPreview = null;
let selectedImportAction = null;

let isHydratingRevision = false;
let renderScheduled = false;
let renderScope = new Set();
let chromeDirty = true;
let computedQuoteDirty = true;
let computedQuoteCache = null;
let draftSnapshotDirty = true;
let draftSnapshotCache = null;

let lastPersistedSnapshot = '';
let pendingPersistSerialized = null;
let persistTimer = null;
let persistPromise = Promise.resolve();

const formatVND = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

function blankCustomer() {
  return {
    companyName: '',
    contactName: '',
    department: '',
    email: '',
    phone: ''
  };
}

function blankPreparedBy() {
  return {
    name: '',
    title: '',
    department: '',
    email: '',
    phone: ''
  };
}

function statusLabel(status) {
  if (status === 'exported') return 'Exported';
  if (status === 'imported') return 'Imported';
  return 'Draft';
}

function revisionLabel(revisionNumber) {
  return Number(revisionNumber) > 0 ? `R${revisionNumber}` : 'Base';
}

function getCalcOptions() {
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

function getDefaultPreparedBy() {
  try {
    return normalizePreparedBy(JSON.parse(localStorage.getItem('bdSettings')) || {});
  } catch (_error) {
    return blankPreparedBy();
  }
}

function buildInitialDraftSnapshot() {
  return {
    customer: blankCustomer(),
    preparedBy: getDefaultPreparedBy(),
    calcOptions: normalizeCalcOptions({
      baseSalary: 2340000,
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

function setPreparedByDefaults(preparedBy) {
  localStorage.setItem('bdSettings', JSON.stringify(normalizePreparedBy(preparedBy)));
}

function snapshotString(snapshot) {
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

function getCurrentComputedQuote() {
  if (!computedQuoteDirty && computedQuoteCache) {
    return computedQuoteCache;
  }
  computedQuoteCache = calculateTotals(stores, getCalcOptions());
  computedQuoteDirty = false;
  return computedQuoteCache;
}

function buildDraftSnapshot() {
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

async function persistDraftSerialized(serialized) {
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

function syncBundleMetadata(bundle) {
  if (!bundle || !bundle.activeRevision) return;
  activeQuoteId = bundle.quote?.id || bundle.activeRevision.quoteId;
  activeQuoteCode = bundle.activeRevision.quoteCode;
  activeRevisionId = bundle.activeRevision.id;
  activeRevisionNumber = bundle.activeRevision.revisionNumber;
  activeDisplayQuoteNumber = bundle.activeRevision.displayQuoteNumber;
  activeRevisionStatus = bundle.activeRevision.status;
  revisionsForQuote = Array.isArray(bundle.revisions) ? bundle.revisions : [];
  markChromeDirty();
}

function hydrateEditorFromRevision(revision) {
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
  document.getElementById('searchInput').value = '';

  invalidateComputedQuote();
  draftSnapshotCache = null;
  const serialized = snapshotString(buildDraftSnapshot());
  lastPersistedSnapshot = serialized;
  pendingPersistSerialized = null;

  isHydratingRevision = false;
  render();
}

function applyRevisionBundle(bundle) {
  if (!bundle || !bundle.activeRevision) return;
  syncBundleMetadata(bundle);
  hydrateEditorFromRevision(bundle.activeRevision);
}

function setCustomerFields(customer) {
  document.getElementById('customerCompany').value = customer.companyName || '';
  document.getElementById('customerContactName').value = customer.contactName || '';
  document.getElementById('customerDepartment').value = customer.department || '';
  document.getElementById('customerEmail').value = customer.email || '';
  document.getElementById('customerPhone').value = customer.phone || '';
}

function setSettingsFields(settings) {
  document.getElementById('settingName').value = settings.name || '';
  document.getElementById('settingTitle').value = settings.title || '';
  document.getElementById('settingDepartment').value = settings.department || '';
  document.getElementById('settingEmail').value = settings.email || '';
  document.getElementById('settingPhone').value = settings.phone || '';
}

function readCustomerFields() {
  return normalizeProfile({
    companyName: document.getElementById('customerCompany').value.trim(),
    contactName: document.getElementById('customerContactName').value.trim(),
    department: document.getElementById('customerDepartment').value.trim(),
    email: document.getElementById('customerEmail').value.trim(),
    phone: document.getElementById('customerPhone').value.trim()
  });
}

function readPreparedByFields() {
  return normalizePreparedBy({
    name: document.getElementById('settingName').value.trim(),
    title: document.getElementById('settingTitle').value.trim(),
    department: document.getElementById('settingDepartment').value.trim(),
    email: document.getElementById('settingEmail').value.trim(),
    phone: document.getElementById('settingPhone').value.trim()
  });
}

function renderQuoteChrome() {
  document.getElementById('historyQuoteCode').textContent = activeQuoteCode || '-';
  document.getElementById('historyDisplayQuoteNumber').textContent = activeDisplayQuoteNumber || '-';
  document.getElementById('historyRevisionLabel').textContent = revisionLabel(activeRevisionNumber);
  document.getElementById('historyStatusChip').textContent = statusLabel(activeRevisionStatus);

  document.getElementById('activeQuoteNumber').textContent = activeDisplayQuoteNumber || 'XMS-000000-000';
  document.getElementById('activeRevisionBadge').textContent = revisionLabel(activeRevisionNumber);
  document.getElementById('activeRevisionStatusText').textContent = statusLabel(activeRevisionStatus);

  const revisionList = document.getElementById('revisionList');
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

function closeQuoteActionsMenu() {
  document.getElementById('quoteActionsMenu')?.classList.remove('open');
}

function renderImportActionOptions(preview) {
  const container = document.getElementById('importActionOptions');
  container.innerHTML = preview.actions.map((action) => `
    <button class="import-action-option${action.key === selectedImportAction ? ' active' : ''}" data-action="${action.key}">
      <strong>${escapeHTML(action.label)}</strong>
    </button>
  `).join('');
}

function openImportPreviewModal(preview) {
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

async function loadRevisionById(revisionId) {
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
    alert(error.message || 'Không thể import PDF.');
  }
}

async function confirmImportPreview() {
  if (!window.electronAPI || !activeImportPreview) return;
  try {
    const bundle = await window.electronAPI.confirmImportQuotePdf({
      preview: activeImportPreview,
      action: selectedImportAction
    });
    closeImportPreviewModal();
    applyRevisionBundle(bundle);
  } catch (error) {
    console.error(error);
    alert(error.message || 'Không thể hoàn tất import.');
  }
}

async function exportActiveQuote() {
  if (!window.electronAPI || !activeRevisionId) return;
  customerProfile = readCustomerFields();
  invalidateDraftSnapshot();
  if (!customerProfile.companyName) {
    document.getElementById('customerCompany').focus();
    return;
  }

  closeCustomerModal();
  scheduleDraftPersist();
  await flushDraftPersist();

  const exportBtn = document.getElementById('exportBtn');
  exportBtn.style.opacity = '0.5';
  exportBtn.style.pointerEvents = 'none';

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
    alert(error.message || 'Error exporting PDF');
  } finally {
    exportBtn.style.opacity = '1';
    exportBtn.style.pointerEvents = 'auto';
  }
}

function performExport() {
  if (!preparedByProfile.name) {
    openSettingsModal();
    return;
  }
  openCustomerModal();
}

function toLocalYMD(date) {
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

function formatDateStr(ymd) {
  const [year, month, day] = ymd.split('-');
  return `${day}/${month}/${year}`;
}

function createStore(index) {
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

const STORE_FIELD_RENDER_SCOPES = {
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
  document.getElementById('searchInput').value = '';
  commitQuoteMutation();
  gsap.fromTo(`[data-id="${store.id}"]`, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25 });
}

function removeStore(id) {
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
      if (activeTabId === id) activeTabId = stores[0].id;
      commitQuoteMutation();
    }
  });
}

function updateActive(field, value) {
  const store = getActive();
  if (!store || store[field] === value) return;
  store[field] = value;
  invalidateComputedQuote();
  render(STORE_FIELD_RENDER_SCOPES[field] || 'all');
  scheduleDraftPersist();
}

function commitQuoteMutation(scope = 'all') {
  invalidateComputedQuote();
  render(scope);
  scheduleDraftPersist();
}

function sanitizeAreaValue(value) {
  return String(value || '').trim().replace(',', '.');
}

function parseBulkAreaLine(line) {
  const cells = String(line).split('\t').map(sanitizeAreaValue).filter(Boolean);
  return cells.length ? cells[cells.length - 1] : sanitizeAreaValue(line);
}

function getFilledBulkRows() {
  return bulkAreas
    .map(sanitizeAreaValue)
    .filter((value) => value !== '' && Number(value) > 0);
}

function renderBulkType() {
  const text = document.getElementById('bulkBusinessTypeText');
  const dd = document.getElementById('bulkBusinessType');
  if (!text || !dd) return;
  text.textContent = bulkType && BUSINESS_TYPES[bulkType] ? BUSINESS_TYPES[bulkType].label : 'Chọn mô hình...';
  dd.dataset.value = bulkType;
  dd.querySelectorAll('.dropdown-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.value === bulkType);
  });
}

function renderBulkRows(focusIndex = null) {
  const rowsEl = document.getElementById('bulkRows');
  if (!rowsEl) return;
  if (bulkAreas.length === 0) bulkAreas = [''];
  const startIndex = stores.length + 1;
  rowsEl.innerHTML = bulkAreas.map((value, index) => {
    const color = STORE_COLORS[(startIndex + index - 1) % STORE_COLORS.length];
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

  let firstCreatedId = null;
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

const STORE_COLORS = [
  '#CFF533', '#44CCFF', '#FF9F43', '#FF4757', '#2ED573', '#A55EEA', '#70A1FF',
  '#FF7F50', '#FFD32A', '#17C0EB', '#FFCCCC', '#C56CF0', '#32FF7E', '#FF3838',
  '#18DCFF', '#7158E2', '#3AE374', '#FFB8B8', '#1B9CFC', '#F8EFBA', '#E15F41',
  '#55E6C1', '#FD7272', '#9AECDB'
];

function animateNumber(elementId, newValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const cached = el._lastValue ?? (parseFloat(el.textContent.replace(/\./g, '').replace(/,/g, '')) || 0);
  if (Math.abs(cached - newValue) < 0.5) return;

  el._lastValue = newValue;
  if (el._tweenObj) gsap.killTweensOf(el._tweenObj);
  el._tweenObj = { val: cached };

  gsap.to(el._tweenObj, {
    val: newValue,
    duration: 0.4,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = formatVND(el._tweenObj.val);
    }
  });
}

function setNumberImmediate(elementId, newValue, options = {}) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el._lastValue = newValue;
  if (el._tweenObj) gsap.killTweensOf(el._tweenObj);
  el.textContent = `${options.prefix || ''}${formatVND(newValue)}`;
}

function renderSidebar(snapshot) {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filtered = stores.filter((store) => store.name.toLowerCase().includes(search));
  const list = document.getElementById('storeList');
  const clearBtn = document.getElementById('searchClear');
  clearBtn.classList.toggle('hidden', !search);

  let html = '';
  if (filtered.length === 0) {
    html = '<div style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:32px;letter-spacing:0.04em">Không tìm thấy chi nhánh</div>';
  } else {
    const maxTotal = snapshot.maxStoreTotal;
    html = filtered.map((store) => {
      const realIdx = stores.indexOf(store);
      const isActive = store.id === activeTabId;
      const total = snapshot.breakdownsById.get(store.id)?.total || 0;
      const color = STORE_COLORS[realIdx % STORE_COLORS.length];
      const pct = Math.min(100, maxTotal ? (total / maxTotal) * 100 : 0);

      return `<div class="store-item${isActive ? ' active' : ''}" data-id="${store.id}" data-name="${store.name}">
        <div class="store-item-color" style="background-color: ${color}"></div>
        <div class="store-item-content">
          <div class="store-item-header">
            <span class="store-item-badge" style="background-color: ${color}">${String(realIdx + 1).padStart(2, '0')}</span>
            <span class="store-item-name">${store.name}</span>
          </div>
          <div class="store-item-meta">
            <span>${store.type && BUSINESS_TYPES[store.type] ? BUSINESS_TYPES[store.type].short : 'CHƯA CHỌN'}</span>
            <span class="dot">·</span>
            <span class="tnum">${store.area ? `${store.area}m²` : '--m²'}</span>
          </div>
          <div class="store-item-total">${formatVND(total)} ₫</div>
          <div class="store-vu"><div class="store-vu-fill" style="width: ${pct}%; background-color: ${color}"></div></div>
        </div>
        ${stores.length > 1 ? `<button class="store-item-remove" data-remove="${store.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>` : ''}
      </div>`;
    }).join('');
  }

  if (list.innerHTML !== html) {
    list.innerHTML = html;
  }
}

function renderMain(snapshot) {
  const store = snapshot.activeStore;
  if (!store) return;
  const area = Number(store.area) || 0;
  const breakdown = snapshot.activeBreakdown || {};
  const duration = breakdown.duration ?? calculateDurationMonths(store.startDate, store.endDate);
  const coef = breakdown.coef ?? calculateCoef(store.type, area);
  const storeTotal = breakdown.total || 0;
  const storeIdx = snapshot.activeStoreIndex;

  document.getElementById('salaryDisplay').textContent = `${formatVND(baseSalary)} ₫`;
  document.getElementById('locationCount').textContent = `${stores.length} loc`;
  const color = STORE_COLORS[storeIdx % STORE_COLORS.length];
  document.getElementById('activeBranchColor').style.backgroundColor = color;
  document.getElementById('activeBranchName').textContent = store.name;

  document.getElementById('storeIndex').textContent = `Chi nhánh ${String(storeIdx + 1).padStart(2, '0')} / ${String(stores.length).padStart(2, '0')}`;
  const nameInput = document.getElementById('storeName');
  if (document.activeElement !== nameInput) nameInput.value = store.name;

  document.getElementById('statDuration').textContent = duration.toFixed(1);
  document.getElementById('statCoef').textContent = coef.toFixed(2);
  animateNumber('statStoreTotal', storeTotal);

  const typeText = document.getElementById('businessTypeText');
  typeText.textContent = store.type && BUSINESS_TYPES[store.type] ? BUSINESS_TYPES[store.type].label : 'Chọn mô hình kinh doanh...';
  document.querySelectorAll('#businessType .dropdown-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.value === store.type);
  });

  const areaInput = document.getElementById('areaInput');
  if (document.activeElement !== areaInput) areaInput.value = store.area;

  document.getElementById('startDateText').textContent = formatDateStr(store.startDate);
  document.getElementById('endDateText').textContent = formatDateStr(store.endDate);

  const accToggle = document.getElementById('accountToggle');
  accToggle.classList.toggle('on', hasAccountFee);
  accToggle.textContent = hasAccountFee ? 'BẬT' : 'TẮT';
  const accRight = document.getElementById('accountFeeRight');

  if (hasAccountFee) {
    accRight.classList.remove('disabled');
    document.getElementById('discountAccountVal').textContent = globalDiscounts.account;
    const accSlider = document.getElementById('discountAccount');
    if (document.activeElement !== accSlider) accSlider.value = globalDiscounts.account;
    accSlider.style.setProperty('--val', `${globalDiscounts.account}%`);
  } else {
    accRight.classList.add('disabled');
  }

  document.querySelectorAll('#boxModeControl .seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === boxMode);
  });
  document.getElementById('boxQuantityRow').classList.toggle('hidden', boxMode === 'none');
  const boxInput = document.getElementById('boxCount');
  if (document.activeElement !== boxInput) boxInput.value = globalBoxCount;

  const boxDiscountRow = document.getElementById('boxDiscountRow');
  if (boxMode === 'buy') {
    boxDiscountRow.classList.remove('hidden');
    document.getElementById('discountBoxVal').textContent = globalDiscounts.box;
    const boxSlider = document.getElementById('discountBox');
    if (document.activeElement !== boxSlider) boxSlider.value = globalDiscounts.box;
    boxSlider.style.setProperty('--val', `${globalDiscounts.box}%`);
  } else {
    boxDiscountRow.classList.add('hidden');
  }

  const boxPriceDesc = document.getElementById('boxPriceDesc');
  if (boxMode === 'buy') boxPriceDesc.textContent = '2.000.000 ₫ / thiết bị · chi phí một lần · cấp mỗi chi nhánh';
  else if (boxMode === 'rent') boxPriceDesc.textContent = '1.000.000 ₫ / thiết bị / năm · prorated · cấp mỗi chi nhánh';
  else boxPriceDesc.textContent = 'Chọn hình thức trang bị cho mỗi chi nhánh';

  document.getElementById('qtgCoef').textContent = `Hệ số ${coef.toFixed(2)}`;
  document.getElementById('qtgDur').textContent = `${duration.toFixed(1)}m`;

  const qtgToggle = document.getElementById('qtgToggle');
  qtgToggle.classList.toggle('on', hasQTG);
  qtgToggle.textContent = hasQTG ? 'BẬT' : 'TẮT';
  const qtgMid = qtgToggle.closest('.copyright-row').querySelector('.copyright-mid');
  const qtgRight = qtgToggle.closest('.copyright-row').querySelector('.copyright-right');

  if (hasQTG) {
    qtgMid.classList.remove('disabled');
    qtgRight.classList.remove('disabled');
    document.getElementById('discountQTGVal').textContent = globalDiscounts.qtg;
    const qtgSlider = document.getElementById('discountQTG');
    if (document.activeElement !== qtgSlider) qtgSlider.value = globalDiscounts.qtg;
    qtgSlider.style.setProperty('--val', `${globalDiscounts.qtg}%`);
    animateNumber('qtgAmount', breakdown.qtgAmount || 0);
  } else {
    qtgMid.classList.add('disabled');
    qtgRight.classList.add('disabled');
    animateNumber('qtgAmount', 0);
  }

  document.getElementById('qlqCoef').textContent = `Hệ số ${coef.toFixed(2)}`;
  document.getElementById('qlqDur').textContent = `${duration.toFixed(1)}m`;

  const qlqToggle = document.getElementById('qlqToggle');
  qlqToggle.classList.toggle('on', hasQLQ);
  qlqToggle.textContent = hasQLQ ? 'BẬT' : 'TẮT';
  const qlqMid = qlqToggle.closest('.copyright-row').querySelector('.copyright-mid');
  const qlqRight = qlqToggle.closest('.copyright-row').querySelector('.copyright-right');

  if (hasQLQ) {
    qlqMid.classList.remove('disabled');
    qlqRight.classList.remove('disabled');
    document.getElementById('discountQLQVal').textContent = globalDiscounts.qlq;
    const qlqSlider = document.getElementById('discountQLQ');
    if (document.activeElement !== qlqSlider) qlqSlider.value = globalDiscounts.qlq;
    qlqSlider.style.setProperty('--val', `${globalDiscounts.qlq}%`);
    animateNumber('qlqAmount', breakdown.qlqAmount || 0);
  } else {
    qlqMid.classList.add('disabled');
    qlqRight.classList.add('disabled');
    animateNumber('qlqAmount', 0);
  }
}

function renderBottomBar(snapshot) {
  const { totals } = snapshot.quote;

  animateNumber('totalQTG', totals.subtotalQTG);
  animateNumber('totalQLQ', totals.subtotalQLQ);
  animateNumber('totalAccount', totals.subtotalAccount);
  animateNumber('totalBox', totals.subtotalBox);
  animateNumber('subtotalVal', totals.subtotal);
  setNumberImmediate('vatVal', totals.vat, { prefix: '+' });
  animateNumber('grandTotal', totals.grand);

  document.querySelectorAll('#vatControl .seg-btn').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.vat) === vatRate);
  });

  const ceiling = 50000000;
  const fillPct = Math.min(100, (totals.grand / ceiling) * 100);
  document.getElementById('grandVuFill').style.width = `${fillPct}%`;
}

function createRenderSnapshot() {
  const quote = getCurrentComputedQuote();
  const breakdownsById = new Map();
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
    activeStore,
    activeStoreIndex,
    activeBreakdown,
    maxStoreTotal
  };
}

function addRenderScopes(scope) {
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

function render(scope = 'all') {
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
    if (renderScope.has('sidebar')) renderSidebar(snapshot);
    if (renderScope.has('main')) renderMain(snapshot);
    if (renderScope.has('totals')) renderBottomBar(snapshot);
    renderScope.clear();
  });
}

function buildCalendar(dateStr, wrapperEl) {
  const date = new Date(dateStr);
  let curYear = date.getFullYear();
  let curMonth = date.getMonth();
  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

  const headTitle = wrapperEl.querySelector('.datepicker-month-year');
  const grid = wrapperEl.querySelector('.datepicker-grid');

  const refreshGrid = () => {
    headTitle.textContent = `${monthNames[curMonth]}, ${curYear}`;
    grid.innerHTML = '';

    const firstDay = new Date(curYear, curMonth, 1).getDay();
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();

    let html = '';
    for (let i = 0; i < firstDay; i += 1) html += '<div class="datepicker-cell dim"></div>';

    const today = new Date();
    for (let i = 1; i <= daysInMonth; i += 1) {
      const isToday = today.getDate() === i && today.getMonth() === curMonth && today.getFullYear() === curYear;
      const isSelected = date.getDate() === i && date.getMonth() === curMonth && date.getFullYear() === curYear;
      const cellDateStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      html += `<div class="datepicker-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${cellDateStr}">${i}</div>`;
    }
    grid.innerHTML = html;
  };
  refreshGrid();

  if (!wrapperEl.dataset.bound) {
    wrapperEl.querySelectorAll('.datepicker-nav').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        curMonth += parseInt(btn.dataset.dir, 10);
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

function setupScrubbableInput(inputId, baseStep = 1, min = -Infinity, max = Infinity) {
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

  const onMouseMove = (event) => {
    if (!isDragging) return;
    const dx = event.clientX - startX;
    let step = baseStep;
    if (event.shiftKey) step *= 10;
    if (event.ctrlKey || event.metaKey) step /= 10;

    let newVal = startVal + dx * step;
    newVal = Math.round(newVal / step) * step;
    newVal = Math.max(min, Math.min(max, newVal));

    if (Number(el.value) !== newVal) {
      el.value = newVal;
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
  document.getElementById('searchInput').addEventListener('input', () => render('sidebar'));
  document.getElementById('searchClear').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    render('sidebar');
  });

  document.getElementById('storeList').addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.store-item-remove');
    if (removeBtn) {
      event.stopPropagation();
      removeStore(parseFloat(removeBtn.dataset.remove));
      return;
    }

    const item = event.target.closest('.store-item');
    if (!item) return;
    const newId = parseFloat(item.dataset.id);
    if (newId !== activeTabId) {
      activeTabId = newId;
      gsap.fromTo('#mainContent', { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.2 });
      render(['main', 'sidebar']);
    }
  });

  document.getElementById('revisionList').addEventListener('click', async (event) => {
    const item = event.target.closest('[data-revision-id]');
    if (!item) return;
    const revisionId = Number(item.dataset.revisionId);
    if (!revisionId || revisionId === activeRevisionId) return;
    await flushDraftPersist();
    await loadRevisionById(revisionId);
  });

  document.getElementById('addStoreBtn').addEventListener('click', addStore);
  const quoteActionsMenu = document.getElementById('quoteActionsMenu');
  const quoteActionsBtn = document.getElementById('quoteActionsBtn');
  quoteActionsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    quoteActionsMenu.classList.toggle('open');
  });
  quoteActionsMenu.querySelector('.quote-actions-dropdown').addEventListener('click', (event) => {
    event.stopPropagation();
  });

  const bulkAddModal = document.getElementById('bulkAddModal');
  const bulkDd = document.getElementById('bulkBusinessType');
  const bulkMenu = bulkDd.querySelector('.dropdown-menu');
  const bulkRowsEl = document.getElementById('bulkRows');

  document.getElementById('bulkAddBtn').addEventListener('click', openBulkAddModal);
  document.getElementById('closeBulkAdd').addEventListener('click', closeBulkAddModal);
  document.getElementById('cancelBulkAdd').addEventListener('click', closeBulkAddModal);
  document.getElementById('applyBulkAdd').addEventListener('click', addBulkRows);
  bulkAddModal.querySelector('.modal-overlay').addEventListener('click', closeBulkAddModal);

  bulkDd.addEventListener('click', (event) => {
    const item = event.target.closest('.dropdown-item');
    if (item) {
      bulkType = item.dataset.value;
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
    const input = event.target.closest('.bulk-area-input');
    if (!input) return;
    bulkAreas[Number(input.dataset.index)] = input.value;
    document.getElementById('bulkRowCount').textContent = `${getFilledBulkRows().length} rows`;
  });

  bulkRowsEl.addEventListener('keydown', (event) => {
    const input = event.target.closest('.bulk-area-input');
    if (!input || event.key !== 'Enter') return;
    event.preventDefault();
    const index = Number(input.dataset.index);
    bulkAreas[index] = input.value;
    if (index === bulkAreas.length - 1) bulkAreas.push('');
    renderBulkRows(index + 1);
  });

  bulkRowsEl.addEventListener('paste', (event) => {
    const input = event.target.closest('.bulk-area-input');
    if (!input) return;
    const text = event.clipboardData.getData('text');
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

  const salaryDisplay = document.getElementById('salaryDisplay');
  const salaryInput = document.getElementById('salaryInput');
  salaryDisplay.addEventListener('click', () => {
    salaryDisplay.classList.add('hidden');
    salaryInput.classList.remove('hidden');
    salaryInput.value = baseSalary;
    salaryInput.focus();
    salaryInput.select();
  });
  const closeSalary = () => {
    baseSalary = Number(salaryInput.value) || baseSalary;
    salaryDisplay.textContent = `${formatVND(baseSalary)} ₫`;
    salaryInput.classList.add('hidden');
    salaryDisplay.classList.remove('hidden');
    commitQuoteMutation();
  };
  salaryInput.addEventListener('blur', closeSalary);
  salaryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') closeSalary();
  });

  document.getElementById('storeName').addEventListener('input', (event) => updateActive('name', event.target.value));
  document.getElementById('areaInput').addEventListener('input', (event) => updateActive('area', event.target.value));

  const dd = document.getElementById('businessType');
  const menu = dd.querySelector('.dropdown-menu');
  dd.addEventListener('click', (event) => {
    const item = event.target.closest('.dropdown-item');
    if (item) {
      updateActive('type', item.dataset.value);
    }
    const isOpen = dd.classList.contains('open');
    if (!isOpen) {
      dd.classList.add('open');
      gsap.fromTo(menu, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.2 });
    } else {
      gsap.to(menu, { height: 0, opacity: 0, duration: 0.15, onComplete: () => dd.classList.remove('open') });
    }
  });

  const setupDatePicker = (pickerId, field) => {
    const pk = document.getElementById(pickerId);
    const popup = pk.querySelector('.datepicker-popup');
    pk.addEventListener('click', (event) => {
      const cell = event.target.closest('.datepicker-cell:not(.dim)');
      if (cell) {
        updateActive(field, cell.dataset.date);
        gsap.to(popup, { opacity: 0, duration: 0.15, onComplete: () => pk.classList.remove('open') });
        return;
      }
      if (event.target.closest('.datepicker-nav')) return;

      const isOpen = pk.classList.contains('open');
      if (!isOpen) {
        const active = getActive();
        buildCalendar(active[field], pk);
        pk.classList.add('open');
        gsap.fromTo(popup, { opacity: 0, y: -5 }, { opacity: 1, y: 0, duration: 0.2 });
      } else {
        gsap.to(popup, { opacity: 0, y: -5, duration: 0.15, onComplete: () => pk.classList.remove('open') });
      }
    });
  };
  setupDatePicker('startDatePicker', 'startDate');
  setupDatePicker('endDatePicker', 'endDate');

  document.addEventListener('click', (event) => {
    if (!quoteActionsMenu.contains(event.target)) {
      closeQuoteActionsMenu();
    }
    if (!dd.contains(event.target) && dd.classList.contains('open')) {
      gsap.to(menu, { height: 0, opacity: 0, duration: 0.15, onComplete: () => dd.classList.remove('open') });
    }
    if (!bulkDd.contains(event.target) && bulkDd.classList.contains('open')) {
      gsap.to(bulkMenu, { height: 0, opacity: 0, duration: 0.15, onComplete: () => bulkDd.classList.remove('open') });
    }
    ['startDatePicker', 'endDatePicker'].forEach((id) => {
      const pk = document.getElementById(id);
      if (!pk.contains(event.target) && pk.classList.contains('open')) {
        gsap.to(pk.querySelector('.datepicker-popup'), {
          opacity: 0,
          duration: 0.15,
          onComplete: () => pk.classList.remove('open')
        });
      }
    });
  });

  document.querySelectorAll('.section-header').forEach((header) => {
    header.addEventListener('click', () => {
      const section = header.closest('.section');
      const body = section.querySelector('.section-body');
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

  document.getElementById('boxModeControl').addEventListener('click', (event) => {
    const btn = event.target.closest('.seg-btn');
    if (!btn) return;
    boxMode = btn.dataset.mode;
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
    globalBoxCount = Math.max(1, Number(event.target.value) || 1);
    commitQuoteMutation();
  });

  ['discountAccount', 'discountBox', 'discountQTG', 'discountQLQ'].forEach((id) => {
    const sl = document.getElementById(id);
    if (!sl) return;
    const valText = document.getElementById(`${id}Val`);
    sl.addEventListener('input', (event) => {
      const map = { discountAccount: 'account', discountBox: 'box', discountQTG: 'qtg', discountQLQ: 'qlq' };
      globalDiscounts[map[id]] = Number(event.target.value);
      commitQuoteMutation();
      if (valText) gsap.to(valText, { scale: 1.1, duration: 0.1 });
    });
    sl.addEventListener('change', () => {
      if (valText) gsap.to(valText, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    });
  });

  document.getElementById('vatControl').addEventListener('click', (event) => {
    const btn = event.target.closest('.seg-btn');
    if (!btn) return;
    vatRate = Number(btn.dataset.vat);
    commitQuoteMutation('totals');
  });

  setupScrubbableInput('areaInput', 1, 1, 10000);
  setupScrubbableInput('boxCount', 1, 1, 1000);
  setupScrubbableInput('salaryInput', 10000, 1000000, 50000000);

  document.getElementById('newQuoteBtn').addEventListener('click', async () => {
    closeQuoteActionsMenu();
    await createNewQuote();
  });
  document.getElementById('newRevisionBtn').addEventListener('click', async () => {
    closeQuoteActionsMenu();
    await createNewRevision();
  });
  document.getElementById('importPdfBtn').addEventListener('click', async () => {
    closeQuoteActionsMenu();
    await importQuoteFromPdf();
  });
  document.getElementById('exportBtn').addEventListener('click', performExport);

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      performExport();
    }
  });

  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
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
    const action = event.target.closest('[data-action]');
    if (!action) return;
    selectedImportAction = action.dataset.action;
    renderImportActionOptions(activeImportPreview);
  });
  document.getElementById('confirmImportPreview').addEventListener('click', confirmImportPreview);
}

async function init() {
  bindEvents();
  renderQuoteChrome();

  if (!window.electronAPI) {
    applyRevisionBundle({
      quote: { id: 1 },
      activeRevision: {
        id: 1,
        quoteId: 1,
        quoteCode: 'XMS-LOCAL-001',
        revisionNumber: 0,
        displayQuoteNumber: 'XMS-LOCAL-001',
        status: 'draft',
        customer: blankCustomer(),
        preparedBy: getDefaultPreparedBy(),
        calcOptions: buildInitialDraftSnapshot().calcOptions,
        stores: buildInitialDraftSnapshot().stores
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
    alert(error.message || 'Không thể khởi tạo quote workflow.');
  }
}

document.addEventListener('DOMContentLoaded', init);
