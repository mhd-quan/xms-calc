#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const tsconfigPath = path.join(ROOT, 'tsconfig.json');

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(tsconfigPath)) {
  fail('Missing tsconfig.json. Strict mode cannot be verified.');
}

const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8')) as {
  compilerOptions?: {
    strict?: boolean;
    noImplicitAny?: boolean;
  };
};
const compilerOptions = tsconfig.compilerOptions || {};

if (compilerOptions.strict !== true) {
  fail('compilerOptions.strict must be true.');
}

if (compilerOptions.noImplicitAny !== true) {
  fail('compilerOptions.noImplicitAny must be true.');
}

let tsFiles: string[] = [];
try {
  const output = execSync(
    "rg --files src test scripts -g '*.ts' -g '*.tsx' -g 'electron.vite.config.ts'",
    { encoding: 'utf8' }
  ).trim();
  tsFiles = output ? output.split('\n').filter(Boolean) : [];
} catch {
  tsFiles = [];
}

const anyPattern = /(:\s*any\b|<any>|\bas\s+any\b)/;
const violations = [];

for (const file of tsFiles) {
  if (file === 'scripts/policy/check-strict-no-any.ts') continue;
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (anyPattern.test(content)) {
    violations.push(file);
  }
}

if (violations.length > 0) {
  console.error('❌ Found explicit any usage.');
  violations.forEach((file) => console.error(`   - ${file}`));
  process.exit(1);
}

console.log('✅ Strict policy passed (strict + noImplicitAny + no explicit any).');
