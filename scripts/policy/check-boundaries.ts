#!/usr/bin/env node
import { execSync } from 'node:child_process';

const DISALLOWED = [
  /^src\/renderer\/index\.html$/,
  /^src\/renderer\/styles\//,
  /^src\/templates\/quote\/template\.css$/,
  /^src\/shared\/calculator\.(js|ts)$/
];

function getChangedFiles(): string[] {
  const range = process.argv[2] || 'HEAD~1..HEAD';
  const output = execSync(`git diff --name-only ${range}`, { encoding: 'utf8' }).trim();
  if (!output) return [];
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

try {
  const changedFiles = getChangedFiles();
  const violations = changedFiles.filter((file) => DISALLOWED.some((rule) => rule.test(file)));

  if (violations.length > 0) {
    console.error('❌ Policy violation: no UI change + no business logic change.');
    violations.forEach((file) => console.error(`   - ${file}`));
    process.exit(1);
  }

  console.log('✅ Boundary policy passed (no UI/business logic files changed).');
} catch (error) {
  console.error('❌ Unable to validate boundary policy.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
