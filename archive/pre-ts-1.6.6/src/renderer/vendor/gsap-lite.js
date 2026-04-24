(function () {
  const timers = new WeakMap();

  function resolveTargets(target) {
    if (!target) return [];
    if (typeof target === 'string') return Array.from(document.querySelectorAll(target));
    if (target instanceof Element || target === window || target === document) return [target];
    if (Array.isArray(target) || target instanceof NodeList) return Array.from(target);
    return [target];
  }

  function clearTargetTimer(target) {
    const timer = timers.get(target);
    if (timer) {
      if (timer.type === 'raf') cancelAnimationFrame(timer.id);
      else clearTimeout(timer.id);
      timers.delete(target);
    }
  }

  function applyProps(target, vars) {
    const style = target && target.style;
    Object.entries(vars).forEach(([key, value]) => {
      if (['duration', 'ease', 'onUpdate', 'onComplete'].includes(key)) return;
      if (style) {
        if (key === 'x') {
          style.transform = `translateX(${value}px)`;
        } else if (key === 'y') {
          style.transform = `translateY(${value}px)`;
        } else if (key === 'scale') {
          style.transform = `scale(${value})`;
        } else if (['opacity', 'height', 'padding', 'margin'].includes(key)) {
          style[key] = typeof value === 'number' && key !== 'opacity' ? `${value}px` : String(value);
        } else {
          style[key] = typeof value === 'number' ? `${value}px` : String(value);
        }
      } else if (typeof value === 'number') {
        target[key] = value;
      }
    });
  }

  function to(target, vars) {
    const targets = resolveTargets(target);
    const duration = Math.max(0, Number(vars.duration) || 0) * 1000;
    targets.forEach((item) => {
      clearTargetTimer(item);

      if (item && !item.style && typeof item.val === 'number' && typeof vars.val === 'number') {
        const start = item.val;
        const end = vars.val;
        const startTime = performance.now();
        const tick = (now) => {
          const pct = duration ? Math.min(1, (now - startTime) / duration) : 1;
          item.val = start + (end - start) * pct;
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

  function fromTo(target, fromVars, toVars) {
    const targets = resolveTargets(target);
    targets.forEach((item) => applyProps(item, fromVars));
    requestAnimationFrame(() => to(target, toVars));
  }

  window.gsap = {
    to,
    fromTo,
    killTweensOf(target) {
      resolveTargets(target).forEach(clearTargetTimer);
    }
  };
})();
