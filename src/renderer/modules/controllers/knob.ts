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
      // Shift = fine (1× step), normal wheel scroll = 5%.
      const nudge = event.shiftKey ? spec.step : spec.step * 5;
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

  // Draw Ableton-style envelope on the paired canvas
  // Knob IDs follow pattern "discount{Section}Knob" → canvas IDs are "envelope{Section}Knob"
  const match = el.id.match(/^discount(\w+)Knob$/);
  if (match) {
    drawEnvelope('envelope' + match[1] + 'Knob', norm);
  }

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

/**
 * Draws an Ableton-style automation lane on the envelope canvas paired with
 * the given knob. The line starts at top-left (0% discount = full price)
 * and slopes downward as discount increases (norm=1 → line at bottom).
 * @param canvasId - ID of the <canvas> element to draw on
 * @param norm - normalised knob value 0..1 (0 = no discount, 1 = 100% discount)
 */
function drawEnvelope(canvasId: string, norm: number): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.offsetWidth || canvas.width;
  const H = canvas.offsetHeight || canvas.height;
  canvas.width = W;
  canvas.height = H;

  // Colours from CSS variables (read once from :root)
  const cs = getComputedStyle(document.documentElement);
  const amber    = (cs.getPropertyValue('--active').trim()     || '#ffb43a');
  const amberDim = (cs.getPropertyValue('--active-dim').trim() || 'rgba(255,180,58,0.14)');
  const lineCol  = (cs.getPropertyValue('--line-2').trim()     || '#3c4047');
  const inkDim   = (cs.getPropertyValue('--ink-4').trim()      || '#5d6168');

  ctx.clearRect(0, 0, W, H);

  // Subtle grid lines (every 25%)
  ctx.strokeStyle = lineCol;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.45;
  for (let i = 1; i < 4; i++) {
    const x = Math.round(W * i / 4) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  // Horizontal midline
  ctx.beginPath();
  ctx.moveTo(0, Math.round(H / 2) + 0.5);
  ctx.lineTo(W, Math.round(H / 2) + 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Envelope line coordinates
  const pad   = 3;
  const yTop  = pad;                         // 0% discount → line at top (full price)
  const yEnd  = pad + (H - pad * 2) * norm;  // end Y scales with discount

  // Gradient fill area under the line
  ctx.beginPath();
  ctx.moveTo(0, yTop);
  ctx.lineTo(W, yEnd);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = amberDim;
  ctx.fill();

  // Main envelope line
  ctx.beginPath();
  ctx.moveTo(0, yTop);
  ctx.lineTo(W, yEnd);
  ctx.strokeStyle = norm > 0 ? amber : inkDim;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = norm > 0 ? 1 : 0.35;
  ctx.stroke();

  // Dot at end of line
  if (norm > 0) {
    ctx.beginPath();
    ctx.arc(W - 2, yEnd, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = amber;
    ctx.globalAlpha = 1;
    ctx.fill();
  }
}
