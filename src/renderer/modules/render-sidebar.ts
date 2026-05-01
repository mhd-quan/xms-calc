import { BUSINESS_TYPES } from '../../shared/calculator';
import { formatVND } from './format';
import { paletteToken } from './palette';

import type { RenderSnapshot } from '../app';
import type { Store } from '../../shared/types';

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function renderSidebar(snapshot: RenderSnapshot): void {
  const stores = snapshot.stores;
  const activeId = snapshot.activeTabId;

  setText('sidebarCustomerName', snapshot.customer.companyName || 'Khách hàng chưa đặt');
  setText('sidebarCustomerId', snapshot.customer.contactName || '—');
  setText('sidebarQuoteCode', snapshot.activeQuoteCode || snapshot.activeDisplayQuoteNumber || '—');
  setText('branchCount', String(stores.length));
  setText('branchLineCount', `${countLines(stores)} lines`);

  const list = getElement('storeList');
  if (!list) return;

  const search = getInputValue('searchInput').trim().toLowerCase();
  const filtered = search
    ? stores.filter((store) => store.name.toLowerCase().includes(search))
    : stores;

  const html = filtered.length
    ? filtered.map((store) => trackTemplate(store, stores.indexOf(store), store.id === activeId, snapshot)).join('')
    : '<div class="eyebrow" style="padding: 24px 6px; color: var(--ink-4);">Không tìm thấy</div>';

  if (list.innerHTML !== html) list.innerHTML = html;

  list.querySelectorAll<HTMLElement>('.x-vu').forEach((vu) => {
    vu.style.setProperty('--vu', vu.dataset.vu ?? '0');
  });
}

function trackTemplate(store: Store, index: number, isActive: boolean, snapshot: RenderSnapshot): string {
  const { hue, step } = paletteToken(index);
  const color = `var(--p-${hue}-${step})`;
  const total = snapshot.breakdownsById.get(store.id)?.total || 0;
  const vu = Math.max(0, Math.min(1, snapshot.maxStoreTotal ? total / snapshot.maxStoreTotal : 0));
  const typeMeta = store.type ? BUSINESS_TYPES[store.type] : undefined;
  const typeLabel = typeMeta?.short || 'CHƯA CHỌN';
  const areaRaw = store.area ? `${store.area}m²` : '--m²';
  const badge = String(index + 1).padStart(2, '0');
  const detail = `${typeLabel} · ${areaRaw} · ${formatVND(total)} ₫`;

  return `<div class="x-track${isActive ? ' is-active' : ''}" data-id="${store.id}" data-info="${escapeAttr(store.name)}|${escapeAttr(detail)}|—">
    <div class="x-track__color" style="background: ${color}"></div>
    <div class="x-track__body">
      <div class="x-track__head">
        <span class="x-track__badge" style="background: ${color}">${badge}</span>
        <span class="x-track__name">${escapeHTML(store.name)}</span>
        <button class="x-track__remove" type="button" data-remove="${store.id}" aria-label="Xóa ${escapeAttr(store.name)}">×</button>
      </div>
      <div class="x-track__meta">
        <span>${escapeHTML(typeLabel)}</span>
        <span class="dot">·</span>
        <span class="tnum">${escapeHTML(areaRaw)}</span>
        <span class="x-track__total" style="margin-left:auto;">${formatVND(total)}</span>
      </div>
      <div class="x-track__vu">
        <div class="x-vu" data-vu="${vu.toFixed(4)}" style="height:4px;">
          <div class="x-vu__fill"></div>
          <div class="x-vu__ladder"></div>
        </div>
      </div>
    </div>
  </div>`;
}

function countLines(stores: Store[]): number {
  return stores.length;
}

function setText(id: string, value: string): void {
  const element = getElement(id);
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function getInputValue(id: string): string {
  const element = getElement(id);
  return element instanceof HTMLInputElement ? element.value : '';
}

function getElement(id: string): HTMLElement | null {
  return document.getElementById(id) as HTMLElement | null;
}

function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

function escapeAttr(value: unknown): string {
  return escapeHTML(value).replace(/\n/g, ' ');
}
