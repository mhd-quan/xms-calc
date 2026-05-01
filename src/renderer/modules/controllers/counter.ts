export type CounterSpec = {
  input: HTMLInputElement;
  minus: HTMLElement;
  plus: HTMLElement;
  min: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
};

export function attachCounter(spec: CounterSpec): void {
  if (spec.input.dataset.counterBound === 'true') return;
  spec.input.dataset.counterBound = 'true';
  spec.input.setAttribute('role', 'spinbutton');
  spec.input.setAttribute('aria-valuemin', String(spec.min));
  if (spec.max !== undefined) spec.input.setAttribute('aria-valuemax', String(spec.max));

  const step = spec.step ?? 1;

  spec.minus.addEventListener('click', () => setCounter(spec, readValue(spec) - step));
  spec.plus.addEventListener('click', () => setCounter(spec, readValue(spec) + step));
  spec.input.addEventListener('input', () => setCounter(spec, readValue(spec), false));
  spec.input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCounter(spec, readValue(spec) + step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCounter(spec, readValue(spec) - step);
    }
  });

  spec.input.setAttribute('aria-valuenow', String(clamp(readValue(spec), spec)));
}

function setCounter(spec: CounterSpec, value: number, syncInput = true): void {
  const next = clamp(Number.isFinite(value) ? value : spec.min, spec);
  if (syncInput || spec.input.value === '' || Number(spec.input.value) !== next) spec.input.value = String(next);
  spec.input.setAttribute('aria-valuenow', String(next));
  spec.onChange(next);
}

function readValue(spec: CounterSpec): number {
  return Number(spec.input.value) || spec.min;
}

function clamp(value: number, spec: CounterSpec): number {
  return Math.max(spec.min, Math.min(spec.max ?? Infinity, value));
}
