import type { RenderSnapshot } from '../app';
import type { RevisionStatus } from '../../shared/types';

type StatusView = {
  label: string;
  dot: string;
};

const CYCLE_LABELS: Record<string, string> = {
  m: 'MONTHLY',
  q: 'QUARTERLY',
  y: 'YEARLY'
};

export function renderStatusbar(snapshot: RenderSnapshot): void {
  const status = statusView(snapshot.activeRevisionStatus);
  setText('statusRevisionState', status.label);
  setText('statusQuoteNumber', `QUOTE ${snapshot.activeDisplayQuoteNumber || '—'}`);
  setText('statusBranchSummary', branchSummary(snapshot.stores.length));
  setText('statusCycle', `CYCLE · ${currentCycleLabel()}`);
  setText('statusVersion', 'XMS v1.8 · DARK ABLETON');

  const dot = getElement('statusDot');
  if (dot) dot.style.background = status.dot;
}

function statusView(status: RevisionStatus): StatusView {
  if (status === 'exported') return { label: 'SAVED', dot: 'var(--vu-low)' };
  if (status === 'imported') return { label: 'SENT', dot: 'var(--data)' };
  return { label: 'DRAFT', dot: 'var(--ink-3)' };
}

function branchSummary(count: number): string {
  const branchUnit = count === 1 ? 'BRANCH' : 'BRANCHES';
  const lineUnit = count === 1 ? 'LINE' : 'LINES';
  return `${count} ${branchUnit} · ${count} ${lineUnit}`;
}

function currentCycleLabel(): string {
  const active = document.querySelector<HTMLElement>('#cycleSeg .x-seg__btn.is-active');
  return CYCLE_LABELS[active?.dataset.cycle ?? ''] ?? 'MONTHLY';
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
