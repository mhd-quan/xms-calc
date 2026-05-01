import type { QuotePayload } from '../../shared/types';

type TemplateStore = QuotePayload['computedStores'][number];

type PricingRowInput = {
  index: number | string;
  group?: boolean;
  title: string;
  detail: string;
  scope: string;
  unit: string;
  amount: number;
};

declare global {
  interface Window {
    renderQuote: (payload: QuotePayload) => true;
  }
}

const formatVND = (n: number | string): string =>
  `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0))} VND`;

const formatNumber = (n: number | string): string =>
  new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const escapeHTML = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);

const show = (value: unknown, fallback = '-'): string => escapeHTML(value || fallback);

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing quote template element #${id}`);
  return element;
}

function durationScope(stores: TemplateStore[]): string {
  const values = stores
    .map((store) => Number(store.duration) || 0)
    .filter((duration) => duration > 0);
  if (!values.length) return '-';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const format = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  return min === max ? `${format(min)} tháng` : `${format(min)}-${format(max)} tháng`;
}

function addRow(rows: string[], { index, group, title, detail, scope, unit, amount }: PricingRowInput): void {
  rows.push(`
    <tr class="${group ? 'group-row' : 'child-row'}">
      <td class="center">${index}</td>
      <td class="item-name">${show(title)}</td>
      <td>${show(detail)}</td>
      <td>${show(scope)}</td>
      <td>${show(unit)}</td>
      <td class="money">${formatVND(amount)}</td>
    </tr>
  `);
}

function buildPricingRows(payload: QuotePayload): string {
  const rows: string[] = [];
  const stores = payload.computedStores || [];
  const branchCount = stores.length;
  const totalArea = stores.reduce((sum, store) => sum + (Number(store.area) || 0), 0);
  const scope = `${branchCount} chi nhánh · ${formatNumber(totalArea)} m²`;
  const duration = durationScope(stores);
  let index = 1;

  if (payload.totals.subtotalQLQ > 0 || payload.totals.subtotalQTG > 0) {
    addRow(rows, {
      index: index++,
      group: true,
      title: 'Chi phí bản quyền',
      detail: 'Tổng phí bản quyền sử dụng âm nhạc tại địa điểm kinh doanh',
      scope,
      unit: duration,
      amount: payload.totals.subtotalQLQ + payload.totals.subtotalQTG
    });
    if (payload.totals.subtotalQLQ > 0) {
      addRow(rows, {
        index: '',
        title: 'Quyền liên quan',
        detail: 'Quyền liên quan bản ghi, bản thu âm do NCT Media cung cấp',
        scope,
        unit: duration,
        amount: payload.totals.subtotalQLQ
      });
    }
    if (payload.totals.subtotalQTG > 0) {
      addRow(rows, {
        index: '',
        title: 'Quyền tác giả',
        detail: 'Phí quyền tác giả âm nhạc, áp dụng khi khách hàng yêu cầu tính kèm trong báo giá',
        scope,
        unit: duration,
        amount: payload.totals.subtotalQTG
      });
    }
  }

  if (payload.totals.subtotalAccount > 0) {
    addRow(rows, {
      index: index++,
      group: true,
      title: 'Phí sử dụng tài khoản',
      detail: 'Tài khoản quản trị, phân phối và vận hành danh sách phát XMusic Station',
      scope: `${branchCount} tài khoản / ${branchCount} chi nhánh`,
      unit: duration,
      amount: payload.totals.subtotalAccount
    });
  }

  if (payload.totals.subtotalBox > 0 && payload.globals.boxMode !== 'none') {
    const totalBoxes = branchCount * (Number(payload.globals.globalBoxCount) || 1);
    const isBuy = payload.globals.boxMode === 'buy';
    addRow(rows, {
      index: index++,
      group: true,
      title: 'Box phát nhạc',
      detail: isBuy
        ? 'Thiết bị phát nhạc cấu hình sẵn cho từng địa điểm'
        : 'Thuê thiết bị phát nhạc cấu hình sẵn cho từng địa điểm',
      scope: `${totalBoxes} box · ${branchCount} chi nhánh`,
      unit: isBuy ? 'Một lần' : duration,
      amount: payload.totals.subtotalBox
    });
  }

  if (!rows.length) {
    addRow(rows, {
      index: '-',
      title: 'Chưa có chi phí',
      detail: 'Chưa có hạng mục đủ điều kiện tính phí từ dữ liệu đầu vào',
      scope: '-',
      unit: '-',
      amount: 0
    });
  }

  return rows.join('');
}

function buildNotes(payload: QuotePayload): string {
  const notes = [
    'Bảng báo giá này được lập trên cơ sở thông tin do khách hàng cung cấp và dữ liệu được ghi nhận tại thời điểm phát hành, bao gồm mô hình kinh doanh, diện tích, thời hạn sử dụng và các hạng mục dịch vụ lựa chọn.',
    'Giá trị nêu trên chưa bao gồm các khoản phí hoặc chi phí phát sinh ngoài phạm vi dịch vụ thể hiện tại bảng báo giá này, trừ khi các bên có thỏa thuận khác bằng văn bản.',
    'Thuế giá trị gia tăng (VAT) được áp dụng theo mức thuế suất theo quy định pháp luật hiện hành tại thời điểm xuất hóa đơn.',
    'Đối với khoản quyền tác giả, việc thanh toán và đối soát với đơn vị quản lý quyền, nếu phát sinh, được thực hiện theo quy định và/hoặc thỏa thuận riêng giữa các bên liên quan.'
  ];
  const discounts = payload.globals.globalDiscounts || {};
  const discountEnabled = payload.globals.discountEnabled || {};
  const activeDiscounts = Object.entries(discounts)
    .filter(([key, value]) => discountEnabled[key as keyof typeof discountEnabled] !== false && Number(value) > 0)
    .map(([key, value]) => `${key.toUpperCase()} ${value}%`);
  if (activeDiscounts.length) {
    notes.push(`Bảng báo giá này đã ghi nhận mức chiết khấu: ${activeDiscounts.join(', ')}.`);
  }
  if (payload.globals.boxMode === 'buy') {
    notes.push(
      'Chi phí Box theo phương án mua là chi phí thiết bị phát sinh một lần và không được cộng vào giá trị tạm tính cho chu kỳ tiếp theo.'
    );
  }
  return notes.map((note) => `<li>${escapeHTML(note)}</li>`).join('');
}

window.renderQuote = function renderQuote(payload: QuotePayload): true {
  const customer = payload.customer || payload.meta.customer || {};
  const prepared = payload.preparedBy || payload.meta.preparedBy || {};
  const stores = payload.computedStores || [];
  const date = new Date(payload.meta.quoteDate);
  const branchCount = stores.length;
  const totalArea = stores.reduce((sum, store) => sum + (Number(store.area) || 0), 0);
  const nextCycle =
    payload.totals.subtotalQTG +
    payload.totals.subtotalQLQ +
    payload.totals.subtotalAccount +
    (payload.globals.boxMode === 'rent' ? payload.totals.subtotalBox : 0);
  const revisionBadge = byId('revisionBadge');

  byId('quoteNumber').textContent = payload.quoteIdentity.displayQuoteNumber || payload.meta.quoteNumber || '';
  byId('quoteDate').textContent = date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  revisionBadge.textContent = payload.quoteIdentity.revisionLabel || '';
  revisionBadge.style.display = payload.quoteIdentity.revisionNumber > 0 ? 'inline-flex' : 'none';

  byId('customerCompany').innerHTML = show(customer.companyName || payload.meta.customerName);
  byId('customerContact').innerHTML = show(customer.contactName);
  byId('customerDepartment').innerHTML = show(customer.department);
  byId('customerEmail').innerHTML = show(customer.email);
  byId('customerPhone').innerHTML = show(customer.phone);

  byId('preparedName').innerHTML = show(prepared.name, 'Doãn Hoàng Minh Quân');
  byId('preparedTitle').innerHTML = show(prepared.title);
  byId('preparedDepartment').innerHTML = show(prepared.department);
  byId('preparedEmail').innerHTML = show(prepared.email);
  byId('preparedPhone').innerHTML = show(prepared.phone);
  byId('signatureTitle').innerHTML = show(prepared.title || prepared.department, 'NCT Media Corporation');

  byId('branchCount').textContent = `${branchCount} chi nhánh`;
  byId('totalArea').textContent = `${formatNumber(totalArea)} m²`;
  byId('durationScope').textContent = durationScope(stores);
  byId('vatRateBadge').textContent = `${payload.totals.vatRate * 100}%`;

  byId('pricingRows').innerHTML = buildPricingRows(payload);
  byId('subtotal').textContent = formatVND(payload.totals.subtotal);
  byId('vatRate').textContent = `${payload.totals.vatRate * 100}%`;
  byId('vat').textContent = formatVND(payload.totals.vat);
  byId('grand').textContent = formatVND(payload.totals.grand);
  byId('nextYearTotal').textContent = formatVND(nextCycle);
  byId('notes').innerHTML = buildNotes(payload);
  return true;
};

export {};
