type VuState = {
  value: number;
  peak: number;
  peakAt: number;
  lastFrameAt: number;
  raf: number | null;
};

const stateMap = new WeakMap<HTMLElement, VuState>();
const PEAK_DECAY_MS = 800;
const PEAK_HOLD_MS = 400;

export function setVu(el: HTMLElement, value: number): void {
  const nextValue = clamp01(value);
  const now = performance.now();
  const state = stateMap.get(el) ?? {
    value: 0,
    peak: 0,
    peakAt: 0,
    lastFrameAt: now,
    raf: null
  };

  state.value = nextValue;
  if (nextValue >= state.peak) {
    state.peak = nextValue;
    state.peakAt = now;
    state.lastFrameAt = now;
  }

  stateMap.set(el, state);
  writeVuVars(el, state);
  scheduleDecay(el);
}

function scheduleDecay(el: HTMLElement): void {
  const state = stateMap.get(el);
  if (!state || state.raf !== null) return;

  state.raf = window.requestAnimationFrame(() => {
    state.raf = null;
    const current = stateMap.get(el);
    if (!current) return;

    const now = performance.now();
    if (now - current.peakAt > PEAK_HOLD_MS && current.peak > current.value) {
      const delta = Math.max(0, now - current.lastFrameAt);
      current.peak = Math.max(current.value, current.peak - delta / PEAK_DECAY_MS);
      current.lastFrameAt = now;
      writeVuVars(el, current);
    }

    if (current.peak > current.value) scheduleDecay(el);
  });
}

function writeVuVars(el: HTMLElement, state: VuState): void {
  el.style.setProperty('--vu', state.value.toFixed(4));
  el.style.setProperty('--vu-peak', state.peak.toFixed(4));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
