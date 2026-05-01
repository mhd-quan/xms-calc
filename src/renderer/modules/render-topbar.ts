import type { RenderSnapshot } from '../app';
import { paletteVar } from './palette';
import { renderRevisionDropdown } from './render-revisions';

export function renderTopbar(snapshot: RenderSnapshot): void {
  const activeStore = snapshot.activeStore;
  setText('bcCustomer', snapshot.customer.companyName || 'Khách hàng chưa đặt');
  setText('bcBranchName', activeStore?.name || '—');
  renderRevisionDropdown(snapshot);

  const colorEl = getElement('bcBranchColor');
  if (colorEl) {
    colorEl.style.background = paletteVar(snapshot.activeStoreIndex);
  }
}

function setText(id: string, value: string): void {
  const element = getElement(id);
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function getElement(id: string): HTMLElement | null {
  return document.getElementById(id) as HTMLElement | null;
}
