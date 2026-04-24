#!/usr/bin/env node
const { execSync } = require('node:child_process');

const DISALLOWED = [
  /^src\/renderer\//,
  /^src\/templates\//,
  /^src\/shared\/calculator\.js$/
];

function getChangedFiles() {
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
  console.error(error.message);
  process.exit(1);
}
