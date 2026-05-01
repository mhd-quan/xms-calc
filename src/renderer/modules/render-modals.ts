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

export function showModal(id: string, focusSelector?: string): void {
  const modal = getModal(id);
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModal = modal;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  requestAnimationFrame(() => {
    const target = focusSelector ? modal.querySelector<HTMLElement>(focusSelector) : firstFocusable(modal);
    (target ?? firstFocusable(modal) ?? modal).focus();
  });
}

export function hideModal(id: string): void {
  const modal = getModal(id);
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (activeModal === modal) activeModal = null;

  if (returnFocus && document.contains(returnFocus)) {
    returnFocus.focus();
  }
  returnFocus = null;
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
