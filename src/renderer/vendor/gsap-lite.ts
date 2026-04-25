type TimerRef =
  | { type: 'raf'; id: number }
  | { type: 'timeout'; id: ReturnType<typeof setTimeout> };

type Target = Element | Window | Document | Record<string, unknown>;

type TargetInput = string | Target | Target[] | NodeListOf<Element> | null | undefined;

type TweenVars = {
  duration?: number;
  ease?: string;
  onUpdate?: () => void;
  onComplete?: () => void;
  val?: number;
  [key: string]: unknown;
};

const timers = new WeakMap<object, TimerRef>();

function resolveTargets(target: TargetInput): Target[] {
  if (!target) return [];
  if (typeof target === 'string') return Array.from(document.querySelectorAll(target));
  if (target instanceof Element || target === window || target === document) return [target];
  if (Array.isArray(target) || target instanceof NodeList) return Array.from(target);
  if (typeof target === 'object') return [target];
  return [];
}

function clearTargetTimer(target: object): void {
  const timer = timers.get(target);
  if (timer) {
    if (timer.type === 'raf') cancelAnimationFrame(timer.id);
    else clearTimeout(timer.id);
    timers.delete(target);
  }
}

function applyProps(target: Target, vars: TweenVars): void {
  const style = (target as { style?: CSSStyleDeclaration }).style;
  Object.entries(vars).forEach(([key, value]) => {
    if (['duration', 'ease', 'onUpdate', 'onComplete'].includes(key)) return;
    if (style) {
      const styleRecord = style as unknown as Record<string, string>;
      if (key === 'x') {
        style.transform = `translateX(${String(value)}px)`;
      } else if (key === 'y') {
        style.transform = `translateY(${String(value)}px)`;
      } else if (key === 'scale') {
        style.transform = `scale(${String(value)})`;
      } else if (['opacity', 'height', 'padding', 'margin'].includes(key)) {
        styleRecord[key] = typeof value === 'number' && key !== 'opacity' ? `${value}px` : String(value);
      } else {
        styleRecord[key] = typeof value === 'number' ? `${value}px` : String(value);
      }
    } else if (typeof value === 'number') {
      (target as Record<string, unknown>)[key] = value;
    }
  });
}

function to(target: TargetInput, vars: TweenVars): { kill: () => void } {
  const targets = resolveTargets(target);
  const duration = Math.max(0, Number(vars.duration) || 0) * 1000;
  targets.forEach((item) => {
    clearTargetTimer(item);

    const tweenObj = item as { style?: CSSStyleDeclaration; val?: number };
    if (typeof tweenObj.val === 'number' && !tweenObj.style && typeof vars.val === 'number') {
      const start = tweenObj.val;
      const end = vars.val;
      const startTime = performance.now();
      const tick = (now: number): void => {
        const pct = duration ? Math.min(1, (now - startTime) / duration) : 1;
        tweenObj.val = start + (end - start) * pct;
        if (vars.onUpdate) vars.onUpdate();
        if (pct < 1) {
          const raf = requestAnimationFrame(tick);
          timers.set(item, { type: 'raf', id: raf });
        } else if (vars.onComplete) {
          vars.onComplete();
        }
      };
      const raf = requestAnimationFrame(tick);
      timers.set(item, { type: 'raf', id: raf });
      return;
    }

    applyProps(item, vars);
    const timer = setTimeout(() => {
      timers.delete(item);
      if (vars.onUpdate) vars.onUpdate();
      if (vars.onComplete) vars.onComplete();
    }, duration);
    timers.set(item, { type: 'timeout', id: timer });
  });
  return { kill: () => targets.forEach(clearTargetTimer) };
}

function fromTo(target: TargetInput, fromVars: TweenVars, toVars: TweenVars): void {
  const targets = resolveTargets(target);
  targets.forEach((item) => applyProps(item, fromVars));
  requestAnimationFrame(() => to(target, toVars));
}

export const gsap = {
  to,
  fromTo,
  killTweensOf(target: TargetInput) {
    resolveTargets(target).forEach(clearTargetTimer);
  }
};

export default gsap;
