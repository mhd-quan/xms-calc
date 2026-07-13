type QuotePayload = import('../../shared/types').QuotePayload;
type TemplateStore = QuotePayload['computedStores'][number];
type QuoteTemplateWindow = Window & {
  renderQuote?: (payload: QuotePayload) => true;
  __quoteTemplateRendererReady?: boolean;
};

type PricingRowInput = {
  index: number | string;
  group?: boolean;
  title: string;
  detail: string;
  scope: string;
  unit: string;
  amount: number;
  originalAmount?: number;
};

const templateWindow = window as QuoteTemplateWindow;
const WEBSITE_PLATFORM_FEE_ONCE = 600000;
const PC_APP_PLATFORM_FEE_ONCE = 800000;
const PLATFORM_FEE_DESCRIPTION =
  'Website hoặc PC App XMS tùy theo nhu cầu hạ tầng của khách hàng, chi phí một lần theo số Cửa hàng áp dụng.';
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

function addRow(rows: string[], { index, group, title, detail, scope, unit, amount, originalAmount }: PricingRowInput): void {
  const strikeHtml = originalAmount !== undefined && originalAmount > amount + 1 
    ? `<div style="text-decoration: line-through; color: #888; font-size: 0.85em; margin-bottom: 2px;">${formatVND(originalAmount)}</div>`
    : '';

  rows.push(`
    <tr class="${group ? 'group-row' : 'child-row'}">
      <td class="center">${index}</td>
      <td class="item-name">${show(title)}</td>
      <td>${show(detail)}</td>
      <td>${show(scope)}</td>
      <td>${show(unit)}</td>
      <td class="money">${strikeHtml}<div>${formatVND(amount)}</div></td>
    </tr>
  `);
}

function accountFeeDetail(payload: QuotePayload): string {
  if (payload.globals.accountFeeMode === 'standalone' && !payload.globals.hasQTG && !payload.globals.hasQLQ) {
    return 'Tài khoản XMS vận hành độc lập khi khách hàng không sử dụng Quyền tác giả và Quyền liên quan trong báo giá; đơn giá 1.500.000 VND/năm/cửa hàng.';
  }
  return 'Tài khoản XMS quản trị, phân phối và vận hành danh sách phát XMusic Station; đơn giá 600.000 VND/năm.';
}

function platformFeeLabel(payload: QuotePayload): string {
  return payload.globals.platformFeeMode === 'pc_app' ? 'PC App XMS' : 'Website';
}

function platformFeeUnitPrice(payload: QuotePayload): number {
  return payload.globals.platformFeeMode === 'pc_app' ? PC_APP_PLATFORM_FEE_ONCE : WEBSITE_PLATFORM_FEE_ONCE;
}

function platformStoreCount(payload: QuotePayload): number {
  return Math.max(1, Number(payload.globals.globalPlatformStoreCount) || 1);
}

function platformFeeDetail(payload: QuotePayload): string {
  return `${platformFeeLabel(payload)}: đơn giá ${formatVND(platformFeeUnitPrice(payload))}/cửa hàng áp dụng, chi phí một lần.`;
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
      detail: `Tổng phí bản quyền sử dụng âm nhạc tại địa điểm kinh doanh · Phương án ${payload.copyright.label}`,
      scope,
      unit: duration,
      amount: payload.totals.subtotalQLQ + payload.totals.subtotalQTG,
      originalAmount: (payload.totals.subtotalQLQOriginal || 0) + (payload.totals.subtotalQTGOriginal || 0)
    });
    if (payload.totals.subtotalQLQ > 0) {
      addRow(rows, {
        index: '',
        title: 'Quyền liên quan',
        detail: payload.copyright.qlqExportDescription,
        scope,
        unit: duration,
        amount: payload.totals.subtotalQLQ,
        originalAmount: payload.totals.subtotalQLQOriginal
      });
    }
    if (payload.totals.subtotalQTG > 0) {
      addRow(rows, {
        index: '',
        title: 'Quyền tác giả',
        detail: payload.copyright.qtgExportDescription,
        scope,
        unit: duration,
        amount: payload.totals.subtotalQTG,
        originalAmount: payload.totals.subtotalQTGOriginal
      });
    }
  }

  if (payload.totals.subtotalAccountOriginal > 0) {
    addRow(rows, {
      index: index++,
      group: true,
      title: 'Phí Sử dụng Tài khoản XMS',
      detail: accountFeeDetail(payload),
      scope: `${branchCount} tài khoản / ${branchCount} chi nhánh`,
      unit: duration,
      amount: payload.totals.subtotalAccount,
      originalAmount: payload.totals.subtotalAccountOriginal
    });
  }

  if (payload.totals.subtotalWebsiteOriginal > 0) {
    addRow(rows, {
      index: index++,
      group: true,
      title: 'Phí Nền tảng',
      detail: platformFeeDetail(payload),
      scope: `${platformStoreCount(payload)} cửa hàng áp dụng`,
      unit: 'Một lần',
      amount: payload.totals.subtotalWebsite,
      originalAmount: payload.totals.subtotalWebsiteOriginal
    });
  }

  if (payload.totals.subtotalBoxOriginal > 0 && payload.globals.boxMode !== 'none') {
    const totalBoxes = branchCount * (Number(payload.globals.globalBoxCount) || 1);
    const isBuy = payload.globals.boxMode === 'buy';
    addRow(rows, {
      index: index++,
      group: true,
      title: 'Thiết bị phát (Boxset)',
      detail: isBuy
        ? 'Thiết bị phát (Boxset) cấu hình sẵn cho từng địa điểm'
        : 'Thuê Thiết bị phát (Boxset) cấu hình sẵn cho từng địa điểm; đơn giá 900.000 VND/năm/thiết bị, prorated theo thời hạn và có thể áp dụng chiết khấu giao diện.',
      scope: `${totalBoxes} boxset · ${branchCount} chi nhánh`,
      unit: isBuy ? 'Một lần' : duration,
      amount: payload.totals.subtotalBox,
      originalAmount: payload.totals.subtotalBoxOriginal
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
    .filter(([key, value]) => discountEnabled[key as keyof typeof discountEnabled] === true && Number(value) > 0)
    .map(([key, value]) => {
      const labels: Record<string, string> = {
        account: 'Tài khoản XMS',
        website: 'Nền tảng',
        box: 'Thiết bị phát (Boxset)',
        qtg: 'Quyền tác giả',
        qlq: 'Quyền liên quan'
      };
      return `${labels[key] ?? key.toUpperCase()} ${value}%`;
    });
  if (activeDiscounts.length) {
    notes.push(`Bảng báo giá này đã ghi nhận mức chiết khấu: ${activeDiscounts.join(', ')}.`);
  }
  if (payload.globals.boxMode === 'buy') {
    notes.push(
      'Chi phí Thiết bị phát (Boxset) theo phương án mua là chi phí thiết bị phát sinh một lần và không được cộng vào giá trị tạm tính cho chu kỳ tiếp theo.'
    );
  }
  if (payload.globals.boxMode === 'rent') {
    notes.push('Chi phí thuê Thiết bị phát (Boxset) được tính theo năm, prorated theo thời hạn của từng chi nhánh và được đưa vào tạm tính chu kỳ tiếp theo.');
  }
  if (payload.globals.hasWebsiteFee) {
    notes.push(`Phí Nền tảng: ${PLATFORM_FEE_DESCRIPTION} ${platformFeeDetail(payload)}`);
  }
  return notes.map((note) => `<li>${escapeHTML(note)}</li>`).join('');
}

templateWindow.renderQuote = function renderQuote(payload: QuotePayload): true {
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
  
  const renderTotalLine = (id: string, amount: number, original?: number) => {
    byId(id).innerHTML = original !== undefined && original > amount + 1 
      ? `<div style="text-decoration: line-through; color: #888; font-size: 0.85em; margin-bottom: 2px;">${formatVND(original)}</div>
         <div>${formatVND(amount)}</div>`
      : formatVND(amount);
  };

  renderTotalLine('subtotal', payload.totals.subtotal, payload.totals.subtotalOriginal);
  byId('vatRate').textContent = `${payload.totals.vatRate * 100}%`;
  renderTotalLine('vat', payload.totals.vat, payload.totals.vatOriginal);
  renderTotalLine('grand', payload.totals.grand, payload.totals.grandOriginal);
  
  byId('nextYearTotal').textContent = formatVND(nextCycle);
  byId('notes').innerHTML = buildNotes(payload);
  return true;
};

templateWindow.__quoteTemplateRendererReady = true;
