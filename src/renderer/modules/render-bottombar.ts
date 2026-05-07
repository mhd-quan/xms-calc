import { setVu } from './controllers/vu';
import { cycleDisplayAmount, cycleLabel } from './billing-cycle';
import { formatVND } from './format';

import type { RenderSnapshot } from '../app';

const GRAND_TOTAL_CEILING = 50000000;
const STRIKE_PRICE_EPSILON = 0.5;
const SAVINGS_RING_TICKS = 64;
const SAVINGS_RING_DURATION_MS = 560;

type SavingsRingState = {
  value: number;
  target: number;
  startedAt: number;
  from: number;
  frame: number | null;
};

type SavingsRingCache = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
};

const savingsRingStates = new Map<string, SavingsRingState>();
const savingsRingCache = new WeakMap<HTMLCanvasElement, SavingsRingCache>();
const observedSavingsRings = new WeakSet<HTMLCanvasElement>();
let savingsRingResizeObserver: ResizeObserver | null = null;

export function renderBottombar(snapshot: RenderSnapshot): void {
  const { totals } = snapshot.quote;
  const displayCycle = snapshot.billingCycle;

  setMoney('totalQTG', cycleDisplayAmount(totals.subtotalQTG, displayCycle));
  setMoney('totalQLQ', cycleDisplayAmount(totals.subtotalQLQ, displayCycle));
  setMoney('totalAccount', cycleDisplayAmount(totals.subtotalAccount, displayCycle));
  setMoney('totalBox', cycleDisplayAmount(totals.subtotalBox, displayCycle));

  const grand = cycleDisplayAmount(totals.grand, displayCycle);
  const grandOriginal = cycleDisplayAmount(totals.grandOriginal, displayCycle);
  setStrikeMoney('grandTotalOriginal', grandOriginal, grand);
  setText('grandTotal', formatVND(grand));
  setText('grandTotalLabel', `Grand total · ${cycleLabel(displayCycle)}`);
  renderSavingsRing('grandSavingsRing', savingsRatio(grandOriginal, grand));

  document.querySelectorAll<HTMLElement>('#vatControl .x-seg__btn').forEach((button) => {
    const buttonRate = Number(button.dataset.vat);
    button.classList.toggle('is-active', Math.abs(buttonRate - totals.vatRate) < 0.0001);
  });

  const grandVu = getElement('grandVu');
  if (grandVu) setVu(grandVu, cycleDisplayAmount(totals.grand, displayCycle) / GRAND_TOTAL_CEILING);
}

function setMoney(id: string, value: number): void {
  setText(id, `${formatVND(value)} ₫`);
}

function setStrikeMoney(id: string, originalValue: number, currentValue: number): void {
  const element = getElement(id);
  if (!element) return;
  const shouldShow = originalValue > currentValue + STRIKE_PRICE_EPSILON;
  element.toggleAttribute('hidden', !shouldShow);
  if (shouldShow) {
    setText(id, `${formatVND(originalValue)} ₫`);
  }
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

function savingsRatio(originalValue: number, currentValue: number): number {
  if (originalValue <= currentValue + STRIKE_PRICE_EPSILON || originalValue <= 0) return 0;
  return clamp((originalValue - currentValue) / originalValue, 0, 1);
}

function renderSavingsRing(id: string, targetRatio: number): void {
  const canvas = document.getElementById(id);
  if (!(canvas instanceof HTMLCanvasElement)) return;
  observeSavingsRing(canvas);

  const target = clamp(targetRatio, 0, 1);
  const state = savingsRingStates.get(id) ?? {
    value: target,
    target,
    startedAt: performance.now(),
    from: target,
    frame: null
  };

  if (Math.abs(state.target - target) < 0.001) {
    state.target = target;
    state.value = target;
    savingsRingStates.set(id, state);
    drawSavingsRing(canvas, target);
    return;
  }

  if (state.frame !== null) cancelAnimationFrame(state.frame);
  state.from = state.value;
  state.target = target;
  state.startedAt = performance.now();
  savingsRingStates.set(id, state);

  const tick = (now: number) => {
    const elapsed = clamp((now - state.startedAt) / SAVINGS_RING_DURATION_MS, 0, 1);
    const eased = easeOutCubic(elapsed);
    state.value = state.from + (state.target - state.from) * eased;
    drawSavingsRing(canvas, state.value);

    if (elapsed < 1) {
      state.frame = requestAnimationFrame(tick);
    } else {
      state.value = state.target;
      state.frame = null;
      drawSavingsRing(canvas, state.target);
    }
  };

  state.frame = requestAnimationFrame(tick);
}

function observeSavingsRing(canvas: HTMLCanvasElement): void {
  if (observedSavingsRings.has(canvas) || typeof ResizeObserver === 'undefined') return;
  if (!savingsRingResizeObserver) {
    savingsRingResizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (!(entry.target instanceof HTMLCanvasElement)) return;
        const state = savingsRingStates.get(entry.target.id);
        drawSavingsRing(entry.target, state?.value ?? 0);
      });
    });
  }
  observedSavingsRings.add(canvas);
  savingsRingResizeObserver.observe(canvas);
}

function drawSavingsRing(canvas: HTMLCanvasElement, ratio: number): void {
  const cache = getSavingsRingCache(canvas);
  if (!cache) return;

  const { ctx, width, height } = cache;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(12, Math.min(width, height) * 0.39);
  const innerRadius = radius - Math.max(6, Math.min(width, height) * 0.08);
  const activeTicks = Math.round(SAVINGS_RING_TICKS * clamp(ratio, 0, 1));
  const rootStyle = getComputedStyle(document.documentElement);
  const active = rootStyle.getPropertyValue('--active').trim() || '#ffb43a';
  const muted = rootStyle.getPropertyValue('--line-3').trim() || '#5b6069';

  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'butt';

  for (let index = 0; index < SAVINGS_RING_TICKS; index += 1) {
    const angle = -Math.PI / 2 + (index / SAVINGS_RING_TICKS) * Math.PI * 2;
    const isActive = index < activeTicks;
    const tickInner = isActive ? innerRadius - 1.5 : innerRadius;
    const tickOuter = isActive ? radius + 2 : radius;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * tickInner, centerY + Math.sin(angle) * tickInner);
    ctx.lineTo(centerX + Math.cos(angle) * tickOuter, centerY + Math.sin(angle) * tickOuter);
    ctx.strokeStyle = isActive ? active : muted;
    ctx.globalAlpha = isActive ? 0.9 : 0.24;
    ctx.lineWidth = isActive ? 2.1 : 1.4;
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function getSavingsRingCache(canvas: HTMLCanvasElement): SavingsRingCache | null {
  const width = canvas.offsetWidth || canvas.width;
  const height = canvas.offsetHeight || canvas.height;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  let cached = savingsRingCache.get(canvas);

  if (!cached) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    cached = { ctx, width, height, dpr };
    savingsRingCache.set(canvas, cached);
  }

  if (cached.width !== width || cached.height !== height || cached.dpr !== dpr) {
    cached.width = width;
    cached.height = height;
    cached.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  cached.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return cached;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
