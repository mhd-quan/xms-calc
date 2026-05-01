import { cycleDisplayAmount } from './billing-cycle';
import { formatVND } from './format';
import { paletteVar } from './palette';

import type { RenderSnapshot } from '../app';

export function renderWorkbench(snapshot: RenderSnapshot): void {
  const store = snapshot.activeStore;
  if (!store) return;

  const index = Math.max(0, snapshot.activeStoreIndex);
  setText('workBranchBadge', `B-${String(index + 1).padStart(2, '0')}`);
  setText('workStoreCount', String(snapshot.stores.length));
  setText('workLineCount', '3');
  setText('workDateRangeText', formatDateRange(store.startDate, store.endDate));
  setSectionTotals(snapshot);

  const color = getElement('workBranchColor');
  if (color) color.style.background = paletteVar(index);

  const title = getElement('workBranchTitle');
  if (title instanceof HTMLInputElement && document.activeElement !== title) {
    title.value = store.name;
  }
}

function setSectionTotals(snapshot: RenderSnapshot): void {
  const breakdown = snapshot.activeBreakdown;
  if (!breakdown) {
    setText('facilitySectionTotal', '0.0m');
    setText('platformSectionTotal', '0');
    setText('copyrightSectionTotal', '0');
    return;
  }

  setText('facilitySectionTotal', `${breakdown.duration.toFixed(1)}m`);
  setText('platformSectionTotal', formatVND(cycleDisplayAmount(breakdown.accountAmount + breakdown.boxAmount, snapshot.billingCycle)));
  setText('copyrightSectionTotal', formatVND(cycleDisplayAmount(breakdown.qtgAmount + breakdown.qlqAmount, snapshot.billingCycle)));
}

function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDottedDate(startDate)} → ${formatDottedDate(endDate)}`;
}

function formatDottedDate(value: string): string {
  const [year, month, day] = String(value || '').split('-');
  if (!year || !month || !day) return '—';
  return `${day}.${month}.${year}`;
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
