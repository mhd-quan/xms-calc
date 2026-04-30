import type { RenderSnapshot } from '../app';
import { paletteVar } from './palette';

export function renderTopbar(snapshot: RenderSnapshot): void {
  const activeStore = snapshot.activeStore;
  setText('bcCustomer', snapshot.customer.companyName || 'Customer chưa đặt');
  setText('bcQuote', snapshot.activeDisplayQuoteNumber || '—');
  setText('bcBranchName', activeStore?.name || '—');

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
