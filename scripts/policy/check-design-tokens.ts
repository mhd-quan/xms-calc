#!/usr/bin/env node
import { glob, readFile } from 'node:fs/promises';

const ALLOWED_TOKENS = new Set([
  'shell-0',
  'shell-1',
  'shell-2',
  'shell-3',
  'shell-4',
  'shell-5',
  'inset-0',
  'inset-1',
  'line-1',
  'line-2',
  'line-3',
  'ink-1',
  'ink-2',
  'ink-3',
  'ink-4',
  'ink-5',
  'active',
  'active-hover',
  'active-press',
  'active-dim',
  'active-glow',
  'active-ink',
  'data',
  'data-dim',
  'data-glow',
  'alert',
  'alert-dim',
  'vu-low',
  'vu-mid',
  'vu-high',
  'font-ui',
  'font-label',
  'font-num',
  't-tiny',
  't-label',
  't-body',
  't-control',
  't-section',
  't-readout',
  't-display',
  'lh-tight',
  'lh-control',
  'lh-body',
  'track-tight',
  'track-default',
  'track-label',
  'track-eyebrow',
  's-0',
  's-1',
  's-2',
  's-3',
  's-4',
  's-5',
  's-6',
  's-7',
  's-8',
  's-9',
  's-10',
  'row-tight',
  'row-default',
  'row-input',
  'row-button',
  'r-0',
  'r-1',
  'r-2',
  'r-3',
  'r-pill',
  't-instant',
  't-quick',
  't-struct',
  't-meter',
  'ease-out',
  'ease-meter',
  'focus-ring',
  'focus-glow',
  'size',
  'val',
  'vu',
  'vu-peak'
]);

const ALLOWED_PALETTE_PREFIX = /^p-(stone|rust|amber|moss|teal|indigo|mauve)-(10|[1-9])$/;
const FORBIDDEN_LEGACY = /--(bg-|text-|daw-|border-|pear|picton)/g;
const FORBIDDEN_RADIUS = /border-radius:\s*([4-9]|[1-9]\d+)px/g;
const FORBIDDEN_SHADOW_LARGE = /box-shadow:[^;]*\b(\d{2,}px)\s+(\d{2,}px)/g;
const TRANSITION_DURATION = /transition[^;]*\b(\d+)ms\b/g;
const ALLOWED_TRANSITION_MS = new Set([0, 90, 140, 400]);

function isAllowedTransitionException(line: string): boolean {
  return line.includes('transition: left 200ms') && line.includes('ease-out');
}

async function main(): Promise<void> {
  const errors: string[] = [];

  for await (const file of glob('src/renderer/styles/*.css')) {
    const content = await readFile(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

      const legacy = line.match(FORBIDDEN_LEGACY);
      if (legacy) {
        errors.push(`${file}:${lineNumber} legacy token: ${legacy.join(', ')}`);
      }

      const usedTokens = [...line.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((match) => match[1]);
      for (const token of usedTokens) {
        if (token && !ALLOWED_TOKENS.has(token) && !ALLOWED_PALETTE_PREFIX.test(token)) {
          errors.push(`${file}:${lineNumber} unknown token --${token}`);
        }
      }

      const radius = line.match(FORBIDDEN_RADIUS);
      if (radius) {
        errors.push(`${file}:${lineNumber} radius > 3px: ${radius[0]}`);
      }

      const largeShadow = line.match(FORBIDDEN_SHADOW_LARGE);
      if (largeShadow) {
        errors.push(`${file}:${lineNumber} forbidden drop shadow: ${largeShadow[0]}`);
      }

      const transitionDurations = [...line.matchAll(TRANSITION_DURATION)];
      for (const match of transitionDurations) {
        const duration = Number(match[1]);
        if (!ALLOWED_TRANSITION_MS.has(duration) && !isAllowedTransitionException(line)) {
          errors.push(`${file}:${lineNumber} non-canonical transition duration ${duration}ms`);
        }
      }
    });
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  console.log('design-token lint passed');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
