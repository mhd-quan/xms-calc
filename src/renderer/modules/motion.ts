const PRESS_SELECTOR = [
  'button',
  '.x-btn',
  '.x-seg__btn',
  '.x-dropdown__item',
  '.x-track',
  '.x-datepicker__cell',
  '.x-datepicker__nav',
  '[role="button"]'
].join(',');

const DEFAULT_CLEANUP_MS = 360;
const TRACK_ENTRY_MS = 240;
const PANEL_SWITCH_MS = 170;

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function bindPressFeedback(root: HTMLElement): void {
  if (root.dataset.motionPressBound === 'true') return;
  root.dataset.motionPressBound = 'true';

  root.addEventListener(
    'pointerdown',
    (event) => {
      const target = motionTarget(event.target);
      if (target) restartMotionClass(target, 'motion-press');
    },
    { passive: true }
  );

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = motionTarget(event.target);
    if (target) restartMotionClass(target, 'motion-press');
  });
}

export function restartMotionClass(element: HTMLElement, className: string, cleanupMs = DEFAULT_CLEANUP_MS): void {
  if (prefersReducedMotion()) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), cleanupMs);
}

export function animateTrackEntry(storeId: number, delayMs = 0): void {
  const track = document.querySelector<HTMLElement>(`[data-id="${storeId}"]`);
  if (!track) return;

  restartMotionClass(track, 'motion-accent-pop', TRACK_ENTRY_MS + delayMs + 180);
  if (prefersReducedMotion() || typeof track.animate !== 'function') return;

  track.animate(
    [
      { opacity: 0, transform: 'translateX(-14px) scale(0.985)' },
      { opacity: 1, transform: 'translateX(0) scale(1)' }
    ],
    {
      duration: TRACK_ENTRY_MS,
      delay: delayMs,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
    }
  );
}

export function animatePanelSwitch(selector: string): void {
  const panel = document.querySelector<HTMLElement>(selector);
  if (!panel || prefersReducedMotion() || typeof panel.animate !== 'function') return;

  panel.animate(
    [
      { opacity: 0.68, transform: 'translateY(5px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    {
      duration: PANEL_SWITCH_MS,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
    }
  );
}

function motionTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>(PRESS_SELECTOR);
  if (!element || element.matches('[disabled], [aria-disabled="true"], .is-disabled')) return null;
  return element;
}
