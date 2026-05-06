const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

let returnFocus: HTMLElement | null = null;
let activeModal: HTMLElement | null = null;
const closeTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const MODAL_EXIT_MS = 150;

export function showModal(id: string, focusSelector?: string): void {
  const modal = getModal(id);
  const closeTimer = closeTimers.get(modal);
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimers.delete(modal);
  }

  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModal = modal;
  modal.classList.remove('hidden', 'is-closing');
  modal.setAttribute('aria-hidden', 'false');

  requestAnimationFrame(() => {
    modal.classList.add('is-visible');
    const target = focusSelector ? modal.querySelector<HTMLElement>(focusSelector) : firstFocusable(modal);
    (target ?? firstFocusable(modal) ?? modal).focus();
  });
}

export function hideModal(id: string): void {
  const modal = getModal(id);
  if (modal.classList.contains('hidden')) return;

  const closeTimer = closeTimers.get(modal);
  if (closeTimer) clearTimeout(closeTimer);

  modal.classList.remove('is-visible');
  modal.classList.add('is-closing');
  modal.setAttribute('aria-hidden', 'true');
  if (activeModal === modal) activeModal = null;

  const finish = (): void => {
    modal.classList.add('hidden');
    modal.classList.remove('is-closing');
    closeTimers.delete(modal);
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  };

  if (prefersReducedMotion()) {
    finish();
    return;
  }

  const timer = setTimeout(finish, MODAL_EXIT_MS);
  closeTimers.set(modal, timer);
}

export function bindModalFrame(id: string, onClose: () => void): void {
  const modal = getModal(id);
  modal.setAttribute('tabindex', '-1');
  modal.setAttribute('aria-hidden', modal.classList.contains('hidden') ? 'true' : 'false');

  modal.querySelector<HTMLElement>('.x-modal__overlay')?.addEventListener('click', onClose);
  modal.addEventListener('keydown', (event) => {
    if (modal.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Tab') trapFocus(modal, event);
  });
}

function getModal(id: string): HTMLElement {
  const modal = document.getElementById(id);
  if (!modal) throw new Error(`Modal not found: ${id}`);
  return modal;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function firstFocusable(modal: HTMLElement): HTMLElement | null {
  return focusableElements(modal)[0] ?? null;
}

function focusableElements(modal: HTMLElement): HTMLElement[] {
  return Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    return !element.hasAttribute('disabled') && element.offsetParent !== null;
  });
}

function trapFocus(modal: HTMLElement, event: KeyboardEvent): void {
  const focusable = focusableElements(modal);
  if (focusable.length === 0) {
    event.preventDefault();
    modal.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
