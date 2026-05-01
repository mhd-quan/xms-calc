const DEFAULT_HUES = ['rust', 'amber', 'moss', 'teal', 'indigo', 'mauve', 'stone'] as const;

type DefaultHue = typeof DEFAULT_HUES[number];

export type PaletteToken = {
  hue: DefaultHue;
  step: number;
};

export function paletteToken(seed: number): PaletteToken {
  const normalizedSeed = Math.abs(Math.trunc(Number(seed) || 0));
  const hue = DEFAULT_HUES[normalizedSeed % DEFAULT_HUES.length] ?? DEFAULT_HUES[0];
  const step = 1 + (normalizedSeed % 3);
  return { hue, step };
}

export function paletteVar(seed: number): string {
  const { hue, step } = paletteToken(seed);
  return `var(--p-${hue}-${step})`;
}
