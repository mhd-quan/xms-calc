import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

test('quote template renderer compiles as a classic browser script', () => {
  const sourcePath = path.resolve(process.cwd(), 'src/templates/quote/template-renderer.ts');
  const source = readFileSync(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
      removeComments: false
    },
    fileName: sourcePath
  }).outputText;

  assert.doesNotMatch(output, /\bexport\s*\{\s*\};?/);
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.match(output, /templateWindow\.renderQuote\s*=/);
  assert.match(output, /__quoteTemplateRendererReady\s*=\s*true/);
});
