import type { RenderSnapshot } from '../app';

const BRANCH_PALETTE = [
  ['rust', 5],
  ['amber', 5],
  ['moss', 5],
  ['teal', 5],
  ['stone', 5]
] as const;

export function renderTopbar(snapshot: RenderSnapshot): void {
  const activeStore = snapshot.activeStore;
  setText('bcCustomer', snapshot.customer.companyName || 'Customer chưa đặt');
  setText('bcQuote', snapshot.activeDisplayQuoteNumber || '—');
  setText('bcBranchName', activeStore?.name || '—');

  const colorEl = getElement('bcBranchColor');
  if (colorEl) {
    colorEl.style.background = branchColor(snapshot.activeStoreIndex);
  }
}

function branchColor(index: number): string {
  const [hue, step] = BRANCH_PALETTE[Math.max(0, index) % BRANCH_PALETTE.length] ?? BRANCH_PALETTE[0];
  return `var(--p-${hue}-${step})`;
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
