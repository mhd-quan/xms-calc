#!/usr/bin/env node
import { glob, readFile } from 'node:fs/promises';

const ALLOWED_CLASS = /^(x-|app$|app--|topbar|sidebar|work|bottombar|csection|line|csbody-grid|eyebrow$|label$|tnum$|dot$|count$|hidden$|is-)/;
const SELECTOR_BLOCK = /([^{}]+)\{/g;
const CLASS_NAME = /\.([_a-zA-Z][_a-zA-Z0-9-]*)/g;

async function main(): Promise<void> {
  const errors: string[] = [];

  for await (const file of glob('src/renderer/styles/*.css')) {
    const content = await readFile(file, 'utf8');
    const lines = content.split('\n');

    for (const match of content.matchAll(SELECTOR_BLOCK)) {
      const selector = match[1]?.trim();
      if (!selector || selector.startsWith('@')) continue;

      const offset = match.index ?? 0;
      const lineNumber = content.slice(0, offset).split('\n').length;
      for (const classMatch of selector.matchAll(CLASS_NAME)) {
        const className = classMatch[1];
        if (className && !ALLOWED_CLASS.test(className)) {
          errors.push(`${file}:${lineNumber} non x-* component class ".${className}" in selector "${selector}"`);
        }
      }
    }

    lines.forEach((line, index) => {
      if (/class\*?=/.test(line)) {
        errors.push(`${file}:${index + 1} avoid class attribute selectors in component namespace checks`);
      }
    });
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  console.log('class namespace lint passed');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
