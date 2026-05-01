export type KnobSpec = {
  el: HTMLElement;
  min: number;
  max: number;
  step: number;
  defaultVal: number;
  onChange: (value: number) => void;
};

type PointerLockTarget = { requestPointerLock?: () => void | Promise<void> };
type PointerLockDocument = { exitPointerLock?: () => void | Promise<void> };

const knobMap = new WeakMap<HTMLElement, KnobSpec>();

let dragging: KnobSpec | null = null;
let dragStartY = 0;
let dragRawVal = 0;

export function attachKnob(spec: KnobSpec): void {
  knobMap.set(spec.el, spec);
  if (spec.el.dataset.knobBound === 'true') {
    setKnob(spec.el, currentValue(spec));
    return;
  }

  spec.el.dataset.knobBound = 'true';
  spec.el.setAttribute('role', 'slider');
  spec.el.setAttribute('aria-valuemin', String(spec.min));
  spec.el.setAttribute('aria-valuemax', String(spec.max));
  setKnob(spec.el, spec.defaultVal);

  spec.el.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    spec.el.focus();
    dragging = spec;
    dragStartY = event.clientY;
    dragRawVal = currentValue(spec);
    spec.el.classList.add('is-dragging');

    try {
      const lockRequest = (spec.el as unknown as PointerLockTarget).requestPointerLock?.();
      if (lockRequest instanceof Promise) void lockRequest.catch(() => undefined);
    } catch {
      // Pointer lock is best-effort; client-coordinate dragging is the fallback.
    }

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp, { once: true });
  });

  spec.el.addEventListener('dblclick', () => setKnob(spec.el, spec.defaultVal, true));

  spec.el.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const delta = -Math.sign(event.deltaY);
      const nudge = event.shiftKey ? spec.step : spec.step;
      setKnob(spec.el, currentValue(spec) + delta * nudge, true);
    },
    { passive: false }
  );

  spec.el.addEventListener('keydown', (event) => {
    const pageStep = spec.step * 10;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      setKnob(spec.el, currentValue(spec) + spec.step, true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setKnob(spec.el, currentValue(spec) - spec.step, true);
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      setKnob(spec.el, currentValue(spec) + pageStep, true);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      setKnob(spec.el, currentValue(spec) - pageStep, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setKnob(spec.el, spec.min, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      setKnob(spec.el, spec.max, true);
    }
  });
}

export function setKnobValue(id: string, value: number): void {
  const el = document.getElementById(id);
  if (!el) return;
  setKnob(el, value);
}

function onMove(event: PointerEvent): void {
  if (!dragging) return;
  event.preventDefault();

  const pointerLocked = document.pointerLockElement === dragging.el;
  const dy = pointerLocked ? -event.movementY : dragStartY - event.clientY;
  const range = dragging.max - dragging.min;
  const sensitivity = event.shiftKey ? 0.25 : 0.6;
  dragRawVal += (dy / 260) * range * sensitivity;

  setKnob(dragging.el, dragRawVal, true);
  if (!pointerLocked) dragStartY = event.clientY;
}

function onUp(): void {
  if (!dragging) return;
  dragging.el.classList.remove('is-dragging');
  try {
    const exitRequest = (document as unknown as PointerLockDocument).exitPointerLock?.();
    if (exitRequest instanceof Promise) void exitRequest.catch(() => undefined);
  } catch {
    // Pointer lock cleanup is best-effort; cursor state is already restored.
  }
  document.removeEventListener('pointermove', onMove);
  dragging = null;
}

function setKnob(el: HTMLElement, value: number, fire = false): void {
  const spec = knobMap.get(el);
  if (!spec) return;

  const previous = currentValue(spec);
  const clamped = Math.max(spec.min, Math.min(spec.max, value));
  const stepped = snapToStep(clamped, spec);
  const norm = (stepped - spec.min) / (spec.max - spec.min);

  el.style.setProperty('--val', String(norm));
  el.dataset.value = String(stepped);
  el.classList.toggle('is-active', stepped !== spec.defaultVal);
  el.setAttribute('aria-valuenow', String(stepped));
  el.setAttribute('aria-valuetext', formatKnobValue(stepped, spec));

  const readout = el.querySelector<HTMLElement>('.x-knob__readout');
  if (readout) readout.textContent = formatKnobValue(stepped, spec);

  if (fire && stepped !== previous) spec.onChange(stepped);
}

function currentValue(spec: KnobSpec): number {
  const value = Number(spec.el.dataset.value ?? spec.defaultVal);
  return Number.isFinite(value) ? value : spec.defaultVal;
}

function snapToStep(value: number, spec: KnobSpec): number {
  const step = spec.step > 0 ? spec.step : 1;
  const stepped = Math.round((value - spec.min) / step) * step + spec.min;
  return Number(stepped.toFixed(decimalPlaces(step)));
}

function decimalPlaces(value: number): number {
  const [, decimal = ''] = String(value).split('.');
  return decimal.length;
}

function formatKnobValue(value: number, spec: KnobSpec): string {
  const unit = spec.el.dataset.unit ?? '';
  const format = spec.el.dataset.format ?? 'int';
  const display = format === 'int' ? Math.round(value).toString() : value.toFixed(1);
  return `${display}${unit}`;
}
