/* ═══════════════════════════════════════════════════════════════════════════
   XMusic Station — Royalty Calculator · Application Logic
   ND 17/2023 Phụ lục 2 stepped coefficients preserved from MVP.
   Ableton v3 Features: Global Box State, GSAP micro-animations, custom inputs.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── CONSTANTS ────────────────────────────────────────────────────────────
const {
  BUSINESS_TYPES,
  calculateCoef,
  calculateDurationMonths,
  calculateStoreBreakdown,
  calculateTotals,
} = window.BDCalculator;

let baseSalary = 2340000;
let vatRate = 0;
let stores = [];
let activeTabId = null;

// GLOBAL BOX STATE (Phase 5)
let boxMode = 'none'; // 'none' | 'buy' | 'rent'
let globalBoxCount = 1;

// GLOBAL ACCOUNT & DISCOUNTS
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

function getCalcOptions() {
  return {
    baseSalary,
    vatRate,
    boxMode,
    globalBoxCount,
    hasAccountFee,
    hasQTG,
    hasQLQ,
    globalDiscounts,
  };
}

function getStoreTotal(s) {
  return calculateStoreBreakdown(s, getCalcOptions()).total;
}

const formatVND = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

// GSAP animate number helper
function animateNumber(elementId, newValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const cached = el._lastValue ?? (parseFloat(el.textContent.replace(/\./g, '').replace(/,/g, '')) || 0);
  if (Math.abs(cached - newValue) < 0.5) return; // skip if no meaningful change
  
  el._lastValue = newValue;
  if (el._tweenObj) gsap.killTweensOf(el._tweenObj);
  el._tweenObj = { val: cached };
  
  gsap.to(el._tweenObj, {
    val: newValue, duration: 0.4, ease: "power2.out",
    onUpdate: () => { el.textContent = formatVND(el._tweenObj.val); }
  });
}

function setNumberImmediate(elementId, newValue, options = {}) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el._lastValue = newValue;
  if (el._tweenObj) gsap.killTweensOf(el._tweenObj);
  el.textContent = `${options.prefix || ''}${formatVND(newValue)}`;
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────
function toLocalYMD(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}
function todayStr() { return toLocalYMD(new Date()); }
function oneYearLater() { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return toLocalYMD(d); }
function formatDateStr(ymd) {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

// ─── STORE MANAGEMENT ─────────────────────────────────────────────────────
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

function getActive() { return stores.find(s => s.id === activeTabId) || stores[0]; }

function addStore() {
  const active = getActive();
  const s = createStore(stores.length + 1);
  if (active) {
    s.type = active.type;
  }
  stores.push(s);
  activeTabId = s.id;
  document.getElementById('searchInput').value = '';
  render();
  gsap.fromTo(`[data-id="${s.id}"]`, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25 });
}

function removeStore(id) {
  if (stores.length <= 1) return;
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) gsap.killTweensOf(el);
  gsap.to(el, {
    x: -20, opacity: 0, height: 0, padding: 0, margin: 0, duration: 0.2,
    onComplete: () => {
      stores = stores.filter(s => s.id !== id);
      if (activeTabId === id) activeTabId = stores[0].id;
      render();
    }
  });
}

function updateActive(field, value) {
  const s = getActive();
  if (s) { s[field] = value; render(); }
}

// ─── BULK ADD ─────────────────────────────────────────────────────────────
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
  rowsEl.innerHTML = bulkAreas.map((value, index) => `
    <div class="bulk-row" data-index="${index}">
      <div class="bulk-index">${String(startIndex + index).padStart(2, '0')}</div>
      <div class="bulk-area-wrap">
        <input class="bulk-area-input tnum" type="text" inputmode="decimal" value="${escapeHTML(value)}" data-index="${index}" placeholder="Nhập diện tích">
      </div>
    </div>
  `).join('');
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
    const s = createStore(stores.length + 1);
    s.type = bulkType;
    s.area = areaValue;
    stores.push(s);
    if (!firstCreatedId) firstCreatedId = s.id;
  });

  activeTabId = firstCreatedId || activeTabId;
  closeBulkAddModal();
  render();
}

// ─── RENDER ───────────────────────────────────────────────────────────────
const STORE_COLORS = [
  '#CFF533', '#44CCFF', '#FF9F43', '#FF4757', '#2ED573', '#A55EEA', '#70A1FF',
  '#FF7F50', '#FFD32A', '#17C0EB', '#FFCCCC', '#C56CF0', '#32FF7E', '#FF3838',
  '#18DCFF', '#7158E2', '#3AE374', '#FFB8B8', '#1B9CFC', '#F8EFBA', '#E15F41',
  '#55E6C1', '#FD7272', '#9AECDB'
];

function renderSidebar() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filtered = stores.filter(s => s.name.toLowerCase().includes(search));
  const list = document.getElementById('storeList');
  const clearBtn = document.getElementById('searchClear');
  clearBtn.classList.toggle('hidden', !search);

  // Use a stable re-render to allow GSAP
  let html = '';
  if (filtered.length === 0) {
    html = '<div style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:32px;letter-spacing:0.04em">Không tìm thấy chi nhánh</div>';
  } else {
    const maxTotal = Math.max(...stores.map(s => getStoreTotal(s)), 1);
    html = filtered.map(store => {
      const realIdx = stores.indexOf(store);
      const isActive = store.id === activeTabId;
      const total = getStoreTotal(store);
      const color = STORE_COLORS[realIdx % STORE_COLORS.length];
      const pct = Math.min(100, (total / maxTotal) * 100);

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
    // Bind clicks
    list.querySelectorAll('.store-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.store-item-remove')) return;
        const newId = parseFloat(el.dataset.id);
        if (newId !== activeTabId) {
          activeTabId = newId;
          gsap.fromTo('#mainContent', { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.2 });
          render();
        }
      });
    });
    list.querySelectorAll('.store-item-remove').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        removeStore(parseFloat(el.dataset.remove));
      });
    });
  }
}

function renderMain() {
  const s = getActive();
  if (!s) return;
  const area = Number(s.area) || 0;
  const duration = calculateDurationMonths(s.startDate, s.endDate);
  const coef = calculateCoef(s.type, area);
  const yearlyFee = coef * baseSalary;
  const periodFee = (yearlyFee / 12) * duration;
  const storeTotal = getStoreTotal(s);
  const storeIdx = stores.indexOf(s);

  // Location count and Active branch indicator
  document.getElementById('locationCount').textContent = `${stores.length} loc`;
  const color = STORE_COLORS[storeIdx % STORE_COLORS.length];
  document.getElementById('activeBranchColor').style.backgroundColor = color;
  document.getElementById('activeBranchName').textContent = s.name;

  // Headline
  document.getElementById('storeIndex').textContent = `Chi nhánh ${String(storeIdx + 1).padStart(2, '0')} / ${String(stores.length).padStart(2, '0')}`;
  const nameInput = document.getElementById('storeName');
  if (document.activeElement !== nameInput) nameInput.value = s.name;
  
  document.getElementById('statDuration').textContent = duration.toFixed(1);
  document.getElementById('statCoef').textContent = coef.toFixed(2);
  animateNumber('statStoreTotal', storeTotal);

  // Section 01
  const typeText = document.getElementById('businessTypeText');
  typeText.textContent = s.type && BUSINESS_TYPES[s.type] ? BUSINESS_TYPES[s.type].label : 'Chọn mô hình kinh doanh...';
  document.querySelectorAll('#businessType .dropdown-item').forEach(el => {
    el.classList.toggle('active', el.dataset.value === s.type);
  });
  
  const areaInput = document.getElementById('areaInput');
  if (document.activeElement !== areaInput) areaInput.value = s.area;

  document.getElementById('startDateText').textContent = formatDateStr(s.startDate);
  document.getElementById('endDateText').textContent = formatDateStr(s.endDate);

  // Section 02 - Account Fee
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

  // Global Box Mode update
  document.querySelectorAll('#boxModeControl .seg-btn').forEach(btn => {
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

  // Section 03
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
    animateNumber('qtgAmount', periodFee * (1 - globalDiscounts.qtg / 100));
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
    animateNumber('qlqAmount', periodFee * (1 - globalDiscounts.qlq / 100));
  } else {
    qlqMid.classList.add('disabled');
    qlqRight.classList.add('disabled');
    animateNumber('qlqAmount', 0);
  }
}

function renderBottomBar() {
  const { totals } = calculateTotals(stores, getCalcOptions());

  animateNumber('totalQTG', totals.subtotalQTG);
  animateNumber('totalQLQ', totals.subtotalQLQ);
  animateNumber('totalAccount', totals.subtotalAccount);
  animateNumber('totalBox', totals.subtotalBox);
  animateNumber('subtotalVal', totals.subtotal);
  setNumberImmediate('vatVal', totals.vat, { prefix: '+' });
  animateNumber('grandTotal', totals.grand);

  // VU Meter for Grand Total
  const ceiling = 50000000; // 50M assumed ceiling
  const fillPct = Math.min(100, (totals.grand / ceiling) * 100);
  document.getElementById('grandVuFill').style.width = `${fillPct}%`;
}

let renderScheduled = false;
let renderScope = new Set();

function render(scope = 'all') {
  if (scope === 'all') {
    renderScope.add('sidebar');
    renderScope.add('main');
    renderScope.add('totals');
  } else {
    renderScope.add(scope);
  }
  
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (renderScope.has('sidebar')) renderSidebar();
    if (renderScope.has('main')) renderMain();
    if (renderScope.has('totals')) renderBottomBar();
    renderScope.clear();
  });
}

// ─── CUSTOM COMPONENTS & EVENTS ──────────────────────────────────────────
function buildCalendar(dateStr, wrapperEl) {
  const d = new Date(dateStr);
  let curYear = d.getFullYear();
  let curMonth = d.getMonth(); // 0-11
  
  const monthNames = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  
  const headTitle = wrapperEl.querySelector('.datepicker-month-year');
  const grid = wrapperEl.querySelector('.datepicker-grid');
  
  const refreshGrid = () => {
    headTitle.textContent = `${monthNames[curMonth]}, ${curYear}`;
    grid.innerHTML = '';
    
    const firstDay = new Date(curYear, curMonth, 1).getDay();
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    
    let html = '';
    for(let i = 0; i < firstDay; i++) html += `<div class="datepicker-cell dim"></div>`;
    
    const today = new Date();
    for(let i = 1; i <= daysInMonth; i++) {
      const isToday = today.getDate()===i && today.getMonth()===curMonth && today.getFullYear()===curYear;
      const isSelected = d.getDate()===i && d.getMonth()===curMonth && d.getFullYear()===curYear;
      const cellDateStr = `${curYear}-${String(curMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      html += `<div class="datepicker-cell ${isToday?'today':''} ${isSelected?'selected':''}" data-date="${cellDateStr}">${i}</div>`;
    }
    grid.innerHTML = html;
  };
  refreshGrid();
  
  // Attach nav handlers only once
  if (!wrapperEl.dataset.bound) {
    wrapperEl.querySelectorAll('.datepicker-nav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        curMonth += parseInt(btn.dataset.dir);
        if(curMonth < 0) { curMonth = 11; curYear--; }
        else if (curMonth > 11) { curMonth = 0; curYear++; }
        refreshGrid();
      });
    });
    wrapperEl.dataset.bound = "true";
  }
}

function bindEvents() {
  // Search
  document.getElementById('searchInput').addEventListener('input', renderSidebar);
  document.getElementById('searchClear').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    renderSidebar();
  });

  // Add store
  document.getElementById('addStoreBtn').addEventListener('click', addStore);

  // Bulk add
  const bulkAddModal = document.getElementById('bulkAddModal');
  const bulkDd = document.getElementById('bulkBusinessType');
  const bulkMenu = bulkDd.querySelector('.dropdown-menu');
  const bulkRowsEl = document.getElementById('bulkRows');

  document.getElementById('bulkAddBtn').addEventListener('click', openBulkAddModal);
  document.getElementById('closeBulkAdd').addEventListener('click', closeBulkAddModal);
  document.getElementById('cancelBulkAdd').addEventListener('click', closeBulkAddModal);
  document.getElementById('applyBulkAdd').addEventListener('click', addBulkRows);
  bulkAddModal.querySelector('.modal-overlay').addEventListener('click', closeBulkAddModal);

  bulkDd.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
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

  bulkRowsEl.addEventListener('input', (e) => {
    const input = e.target.closest('.bulk-area-input');
    if (!input) return;
    bulkAreas[Number(input.dataset.index)] = input.value;
    document.getElementById('bulkRowCount').textContent = `${getFilledBulkRows().length} rows`;
  });

  bulkRowsEl.addEventListener('keydown', (e) => {
    const input = e.target.closest('.bulk-area-input');
    if (!input || e.key !== 'Enter') return;
    e.preventDefault();
    const index = Number(input.dataset.index);
    bulkAreas[index] = input.value;
    if (index === bulkAreas.length - 1) bulkAreas.push('');
    renderBulkRows(index + 1);
  });

  bulkRowsEl.addEventListener('paste', (e) => {
    const input = e.target.closest('.bulk-area-input');
    if (!input) return;
    const text = e.clipboardData.getData('text');
    const lines = text.split(/\r?\n/).map(parseBulkAreaLine).filter(Boolean);
    if (lines.length <= 1) return;
    e.preventDefault();
    const index = Number(input.dataset.index);
    lines.forEach((line, offset) => {
      bulkAreas[index + offset] = line;
    });
    const nextIndex = index + lines.length;
    bulkAreas[nextIndex] = bulkAreas[nextIndex] || '';
    renderBulkRows(nextIndex);
  });

  // Salary toggle
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
    render();
  };
  salaryInput.addEventListener('blur', closeSalary);
  salaryInput.addEventListener('keydown', e => { if (e.key === 'Enter') closeSalary(); });

  // Store name
  document.getElementById('storeName').addEventListener('input', e => updateActive('name', e.target.value));
  document.getElementById('areaInput').addEventListener('input', e => updateActive('area', e.target.value));

  // Custom Dropdown (Mô hình kinh doanh)
  const dd = document.getElementById('businessType');
  const menu = dd.querySelector('.dropdown-menu');
  dd.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
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

  // Custom Datepickers
  const setupDatePicker = (pickerId, field) => {
    const pk = document.getElementById(pickerId);
    const popup = pk.querySelector('.datepicker-popup');
    pk.addEventListener('click', (e) => {
      const cell = e.target.closest('.datepicker-cell:not(.dim)');
      if (cell) {
        updateActive(field, cell.dataset.date);
        gsap.to(popup, { opacity: 0, duration: 0.15, onComplete: () => pk.classList.remove('open') });
        return;
      }
      if (e.target.closest('.datepicker-nav')) return; // handled in buildCalendar
      
      const isOpen = pk.classList.contains('open');
      if (!isOpen) {
        const s = getActive();
        buildCalendar(s[field], pk);
        pk.classList.add('open');
        gsap.fromTo(popup, { opacity: 0, y: -5 }, { opacity: 1, y: 0, duration: 0.2 });
      } else {
        gsap.to(popup, { opacity: 0, y: -5, duration: 0.15, onComplete: () => pk.classList.remove('open') });
      }
    });
  };
  setupDatePicker('startDatePicker', 'startDate');
  setupDatePicker('endDatePicker', 'endDate');

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target) && dd.classList.contains('open')) {
      gsap.to(menu, { height: 0, opacity: 0, duration: 0.15, onComplete: () => dd.classList.remove('open') });
    }
    if (!bulkDd.contains(e.target) && bulkDd.classList.contains('open')) {
      gsap.to(bulkMenu, { height: 0, opacity: 0, duration: 0.15, onComplete: () => bulkDd.classList.remove('open') });
    }
    ['startDatePicker', 'endDatePicker'].forEach(id => {
      const pk = document.getElementById(id);
      if (!pk.contains(e.target) && pk.classList.contains('open')) {
        gsap.to(pk.querySelector('.datepicker-popup'), { opacity: 0, duration: 0.15, onComplete: () => pk.classList.remove('open') });
      }
    });
  });

  // Section Folds
  document.querySelectorAll('.section-header').forEach(header => {
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

  // Account toggle
  document.getElementById('accountToggle').addEventListener('click', () => {
    hasAccountFee = !hasAccountFee;
    render();
  });
  
  // QTG / QLQ toggles
  document.getElementById('qtgToggle').addEventListener('click', () => {
    hasQTG = !hasQTG;
    render();
  });
  document.getElementById('qlqToggle').addEventListener('click', () => {
    hasQLQ = !hasQLQ;
    render();
  });

  // Box segmented control
  document.getElementById('boxModeControl').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    boxMode = btn.dataset.mode;
    render();
  });

  // Global Box count
  document.getElementById('boxMinus').addEventListener('click', () => {
    globalBoxCount = Math.max(1, globalBoxCount - 1); render();
  });
  document.getElementById('boxPlus').addEventListener('click', () => {
    globalBoxCount++; render();
  });
  document.getElementById('boxCount').addEventListener('input', e => {
    globalBoxCount = Math.max(1, Number(e.target.value) || 1); render();
  });

  // Sliders with scale animation during drag
  ['discountAccount', 'discountBox', 'discountQTG', 'discountQLQ'].forEach(id => {
    const sl = document.getElementById(id);
    if (!sl) return;
    const valText = document.getElementById(`${id}Val`);
    sl.addEventListener('input', e => {
      const map = { discountAccount: 'account', discountBox: 'box', discountQTG: 'qtg', discountQLQ: 'qlq' };
      globalDiscounts[map[id]] = Number(e.target.value);
      render();
      if (valText) gsap.to(valText, { scale: 1.1, duration: 0.1 });
    });
    sl.addEventListener('change', () => {
      if (valText) gsap.to(valText, { scale: 1, duration: 0.2, ease: "back.out(2)" });
    });
  });

  // VAT Segmented Control
  document.getElementById('vatControl').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    const newVatRate = Number(btn.dataset.vat);
    if (btn.classList.contains('active') && vatRate === newVatRate) return;
    document.querySelectorAll('#vatControl .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    vatRate = newVatRate;
    renderBottomBar();
  });

  // Scrubbable Inputs
  setupScrubbableInput('areaInput', 1, 1, 10000);
  setupScrubbableInput('boxCount', 1, 1, 1000);
  setupScrubbableInput('salaryInput', 10000, 1000000, 50000000);
}

function setupScrubbableInput(inputId, baseStep = 1, min = -Infinity, max = Infinity) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.style.cursor = 'ew-resize';
  let isDragging = false;
  let startX = 0;
  let startVal = 0;

  el.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.clientX;
    startVal = Number(el.value) || 0;
    document.body.style.cursor = 'ew-resize';
  });

  const onMouseMove = e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    let step = baseStep;
    if (e.shiftKey) step *= 10;
    if (e.ctrlKey || e.metaKey) step /= 10;
    
    let newVal = startVal + dx * step;
    newVal = Math.round(newVal / step) * step;
    newVal = Math.max(min, Math.min(max, newVal));
    
    if (Number(el.value) !== newVal) {
      el.value = newVal;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
    }
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

// ─── EXPORT PDF ───────────────────────────────────────────────────────────
const performExport = async () => {
  if (!window.electronAPI) return;
  
  let settings = { name: '' };
  try { settings = JSON.parse(localStorage.getItem('bdSettings')) || { name: '' }; } catch (e) {}
  
  if (!settings.name) {
    document.getElementById('settingsModal').classList.remove('hidden');
    return;
  }

  const customerName = prompt("Nhập tên khách hàng (để lưu tên file):", "KhachHang");
  if (customerName === null) return;
  
  const quote = calculateTotals(stores, getCalcOptions());

  const payload = {
    meta: {
      quoteDate: new Date().toISOString(),
      customerName: customerName,
      preparedBy: settings
    },
    stores: quote.stores,
    globals: { boxMode, globalBoxCount, hasAccountFee, hasQTG, hasQLQ, globalDiscounts },
    totals: quote.totals
  };
  
  const exportBtn = document.getElementById('exportBtn');
  exportBtn.style.opacity = '0.5';
  exportBtn.style.pointerEvents = 'none';
  
  try {
    await window.electronAPI.exportQuote(payload);
  } catch (e) {
    console.error(e);
    alert('Error exporting PDF');
  } finally {
    exportBtn.style.opacity = '1';
    exportBtn.style.pointerEvents = 'auto';
  }
};

// ─── INIT ─────────────────────────────────────────────────────────────────
function init() {
  const first = createStore(1);
  stores.push(first);
  activeTabId = first.id;
  bindEvents();
  
  document.getElementById('exportBtn').addEventListener('click', performExport);
  window.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      performExport();
    }
  });

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => {
    try {
      const settings = JSON.parse(localStorage.getItem('bdSettings')) || { name: '' };
      document.getElementById('settingName').value = settings.name;
    } catch(e){}
    document.getElementById('settingsModal').classList.remove('hidden');
  });
  document.getElementById('closeSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('hidden');
  });
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    const name = document.getElementById('settingName').value;
    localStorage.setItem('bdSettings', JSON.stringify({ name }));
    document.getElementById('settingsModal').classList.add('hidden');
  });

  render();
}

document.addEventListener('DOMContentLoaded', init);
