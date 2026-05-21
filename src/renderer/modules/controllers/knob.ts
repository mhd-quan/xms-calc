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
type EnvelopeCache = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
};
type EnvelopeDrawState = {
  norm: number;
  enabled: boolean;
};

const knobMap = new WeakMap<HTMLElement, KnobSpec>();
const wheelRemainders = new WeakMap<HTMLElement, number>();
const envelopeCache = new WeakMap<HTMLCanvasElement, EnvelopeCache>();
const pendingEnvelopeValues = new Map<string, EnvelopeDrawState>();
const pendingEnvelopeFrames = new Map<string, number>();
const lastEnvelopeValues = new Map<string, EnvelopeDrawState>();
const observedEnvelopeCanvases = new WeakSet<HTMLCanvasElement>();
let envelopeResizeObserver: ResizeObserver | null = null;

const WHEEL_THRESHOLD = 64;
const MAX_WHEEL_STEPS_PER_EVENT = 1;

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
      const rawDelta = normalizeWheelDelta(event);
      const remainder = wheelRemainders.get(spec.el) ?? 0;
      const accumulated = sameSign(rawDelta, remainder) ? remainder + rawDelta : rawDelta;
      const steps = clamp(
        Math.trunc(accumulated / WHEEL_THRESHOLD),
        -MAX_WHEEL_STEPS_PER_EVENT,
        MAX_WHEEL_STEPS_PER_EVENT
      );
      wheelRemainders.set(spec.el, clamp(accumulated - steps * WHEEL_THRESHOLD, -WHEEL_THRESHOLD + 1, WHEEL_THRESHOLD - 1));
      if (steps === 0) return;

      const nudge = event.shiftKey ? spec.step : spec.step * 5;
      setKnob(spec.el, currentValue(spec) - steps * nudge, true);
    },
    { passive: false }
  );

  spec.el.addEventListener('keydown', (event) => {
    const pageStep = spec.step * 10;
    const isShift = event.shiftKey;
    const nudge = isShift ? pageStep : spec.step;

    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      setKnob(spec.el, currentValue(spec) + nudge, true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setKnob(spec.el, currentValue(spec) - nudge, true);
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
  const sensitivity = event.shiftKey ? 0.2 : 0.48;
  dragRawVal += (dy / 300) * range * sensitivity;

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

  // Draw the paired discount step-line canvas.
  // Knob IDs follow "discount{Section}Knob"; canvas IDs follow "envelope{Section}Knob".
  const match = el.id.match(/^discount(\w+)Knob$/);
  if (match?.[1]) {
    const section = match[1];
    scheduleEnvelopeDraw(`envelope${section}Knob`, norm, isDiscountApplied(section));
  }

  if (fire && stepped !== previous) spec.onChange(stepped);
}

function currentValue(spec: KnobSpec): number {
  const value = Number(spec.el.dataset.value ?? spec.defaultVal);
  return Number.isFinite(value) ? value : spec.defaultVal;
}

function normalizeWheelDelta(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * 120;
  return event.deltaY;
}

function sameSign(a: number, b: number): boolean {
  return b === 0 || Math.sign(a) === Math.sign(b);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function isDiscountApplied(section: string): boolean {
  return document.getElementById(`discount${section}Apply`)?.classList.contains('is-on') === true;
}

function scheduleEnvelopeDraw(canvasId: string, norm: number, enabled: boolean): void {
  lastEnvelopeValues.set(canvasId, { norm, enabled });
  pendingEnvelopeValues.set(canvasId, { norm, enabled });
  if (pendingEnvelopeFrames.has(canvasId)) return;

  const frame = requestAnimationFrame(() => {
    pendingEnvelopeFrames.delete(canvasId);
    const nextState = pendingEnvelopeValues.get(canvasId);
    if (!nextState) return;
    pendingEnvelopeValues.delete(canvasId);
    drawEnvelope(canvasId, nextState.norm, nextState.enabled);
  });

  pendingEnvelopeFrames.set(canvasId, frame);
}

function getEnvelopeCache(canvas: HTMLCanvasElement): EnvelopeCache | null {
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  if (width <= 0 || height <= 0) return null;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  let cached = envelopeCache.get(canvas);

  if (!cached) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    cached = {
      ctx,
      width,
      height,
      dpr
    };
    envelopeCache.set(canvas, cached);
  }

  if (cached.width !== width || cached.height !== height || cached.dpr !== dpr) {
    cached.width = width;
    cached.height = height;
    cached.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  } else if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  cached.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return cached;
}

function observeEnvelopeResize(canvas: HTMLCanvasElement): void {
  if (observedEnvelopeCanvases.has(canvas) || typeof ResizeObserver === 'undefined') return;
  if (!envelopeResizeObserver) {
    envelopeResizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (!(entry.target instanceof HTMLCanvasElement)) return;
        const state = lastEnvelopeValues.get(entry.target.id);
        if (state) scheduleEnvelopeDraw(entry.target.id, state.norm, state.enabled);
      });
    });
  }
  observedEnvelopeCanvases.add(canvas);
  envelopeResizeObserver.observe(canvas);
}

/**
 * Draws the discount curve as a crisp step line: full price on the high rail,
 * discounted price on the low rail. Disabled discounts stay washed out.
 * @param canvasId - ID of the <canvas> element to draw on
 * @param norm - normalised knob value 0..1 (0 = no discount, 1 = 100% discount)
 */
function drawEnvelope(canvasId: string, norm: number, enabled: boolean): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;
  observeEnvelopeResize(canvas);

  const cached = getEnvelopeCache(canvas);
  if (!cached) return;

  const { ctx, width: W, height: H } = cached;
  const clampedNorm = clamp(norm, 0, 1);
  const rootStyle = getComputedStyle(document.documentElement);
  const laneStyle = getComputedStyle(canvas.closest('.x-discount-bank') ?? canvas);
  const frameStyle = getComputedStyle(canvas.closest('.x-knob__envelope-frame') ?? canvas);
  const accent = laneStyle.getPropertyValue('--lane-accent').trim() || rootStyle.getPropertyValue('--active').trim() || '#ffb43a';
  const muted = rootStyle.getPropertyValue('--line-3').trim() || '#5b6069';
  const meterBg = frameStyle.getPropertyValue('--meter-bg').trim() || '#1c1e1b';
  const meterGrid = frameStyle.getPropertyValue('--meter-grid').trim() || 'rgba(148, 154, 144, 0.2)';

  ctx.clearRect(0, 0, W, H);
  drawEnvelopeGrid(ctx, W, H, meterBg, meterGrid);

  const padX = 5;
  const padY = 7.5;
  const yHigh = Math.round(padY + (H - padY * 2) * 0.1) + 0.5;
  const yLow = Math.round(yHigh + (H - padY - yHigh) * clampedNorm) + 0.5;
  const stepX = Math.round(W * 0.56) + 0.5;
  const endX = Math.max(padX, W - padX);

  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = enabled ? accent : muted;
  ctx.lineWidth = enabled ? 2.15 : 2;
  ctx.globalAlpha = enabled ? 0.8 + clampedNorm * 0.16 : 0.46;
  ctx.shadowBlur = enabled && clampedNorm > 0 ? 0.8 : 0;
  ctx.shadowColor = accent;
  ctx.beginPath();
  ctx.moveTo(padX, yHigh);
  ctx.lineTo(stepX, yHigh);
  ctx.lineTo(stepX, yLow);
  ctx.lineTo(endX, yLow);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawEnvelopeGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: string,
  grid: string
): void {
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.82;
  for (let index = 1; index < 4; index += 1) {
    const x = Math.round((width * index) / 4) + 0.5;
    const y = Math.round((height * index) / 4) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}
