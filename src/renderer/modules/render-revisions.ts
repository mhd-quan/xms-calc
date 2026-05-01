import type { QuoteRevision, RevisionStatus } from '../../shared/types';

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

type RevisionDropdownSnapshot = {
  activeRevisionId: number | null;
  activeRevisionNumber: number;
  activeDisplayQuoteNumber: string;
  revisionsForQuote: QuoteRevision[];
};

export function renderRevisionDropdown(snapshot: RevisionDropdownSnapshot): void {
  const root = getElement('revisionDropdown');
  const menu = getElement('revisionMenu');
  if (!root || !menu) return;

  const displayNumber = snapshot.activeDisplayQuoteNumber || '—';
  const activeLabel = revisionLabel(snapshot.activeRevisionNumber);

  setText('bcQuote', displayNumber);
  setText('bcRevisionBadge', activeLabel);
  root.dataset.value = snapshot.activeRevisionId ? String(snapshot.activeRevisionId) : '';

  const html = snapshot.revisionsForQuote.length
    ? snapshot.revisionsForQuote
        .map((revision) => revisionItem(revision, revision.id === snapshot.activeRevisionId))
        .join('')
    : fallbackItem(displayNumber, activeLabel, snapshot.activeRevisionId);

  if (menu.innerHTML !== html) menu.innerHTML = html;
}

export function revisionLabel(revisionNumber: number): string {
  return Number(revisionNumber) > 0 ? `R${Number(revisionNumber)}` : 'Base';
}

export function statusLabel(status: RevisionStatus): string {
  if (status === 'exported') return 'Exported';
  if (status === 'imported') return 'Imported';
  return 'Draft';
}

function revisionItem(revision: QuoteRevision, isActive: boolean): string {
  const label = revisionLabel(revision.revisionNumber);
  const status = statusLabel(revision.status);
  const branchCount = revision.stores.length || 0;
  const detail = `${status} · ${branchCountLabel(branchCount)}`;

  return `<div class="x-dropdown__item topbar__revision-item${isActive ? ' is-selected' : ''}" role="option" data-value="${revision.id}" data-info="${escapeAttr(label)}|${escapeAttr(revision.displayQuoteNumber)} · ${escapeAttr(detail)}|—">
    <div class="x-track${isActive ? ' is-active' : ''}">
      <div class="x-track__color" style="background: var(--active)"></div>
      <div class="x-track__body">
        <div class="x-track__head">
          <span class="x-track__badge" style="background: var(--active)">${escapeHTML(label)}</span>
          <span class="x-track__name">${escapeHTML(revision.displayQuoteNumber)}</span>
        </div>
        <div class="x-track__meta">
          <span>${escapeHTML(status)}</span>
          <span class="dot">·</span>
          <span>${escapeHTML(branchCountLabel(branchCount))}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function fallbackItem(displayNumber: string, activeLabel: string, activeRevisionId: number | null): string {
  return `<div class="x-dropdown__item topbar__revision-item is-selected" role="option" data-value="${activeRevisionId ?? ''}" data-info="${escapeAttr(activeLabel)}|${escapeAttr(displayNumber)}|—">
    <div class="x-track is-active">
      <div class="x-track__color" style="background: var(--active)"></div>
      <div class="x-track__body">
        <div class="x-track__head">
          <span class="x-track__badge" style="background: var(--active)">${escapeHTML(activeLabel)}</span>
          <span class="x-track__name">${escapeHTML(displayNumber)}</span>
        </div>
        <div class="x-track__meta">
          <span>Active revision</span>
        </div>
      </div>
    </div>
  </div>`;
}

function branchCountLabel(count: number): string {
  return count === 1 ? '1 branch' : `${count} branches`;
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

function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

function escapeAttr(value: unknown): string {
  return escapeHTML(value).replace(/\n/g, ' ');
}
