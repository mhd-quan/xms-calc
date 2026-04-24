#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const range = process.argv[2] || 'HEAD~1..HEAD';

const phases = [
  {
    name: 'Phase 1 - Commit Convention',
    command: 'node',
    args: ['scripts/policy/check-commit-convention.js']
  },
  {
    name: 'Phase 2 - No UI/Business Logic Change',
    command: 'node',
    args: ['scripts/policy/check-boundaries.js', range]
  },
  {
    name: 'Phase 3 - Strict Mode + No Any',
    command: 'node',
    args: ['scripts/policy/check-strict-no-any.js']
  }
];

for (const phase of phases) {
  console.log(`\n🔎 ${phase.name}`);
  const result = spawnSync(phase.command, phase.args, { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(`\n🛑 ${phase.name} failed. Roll-forward is blocked.`);
    process.exit(result.status || 1);
  }
}

console.log('\n✅ All phase gates passed. Roll-forward unlocked.');
