#!/usr/bin/env node
import { execSync } from 'node:child_process';

const COMMIT_REGEX = /^(build|refactor|docs|test|chore)(\([^)]+\))?:\s.+/;

function getCommitMessage(): string {
  const fromArg = process.argv[2];
  if (fromArg && fromArg.trim()) return fromArg.trim();
  return execSync('git log -1 --pretty=%s', { encoding: 'utf8' }).trim();
}

try {
  const commitMessage = getCommitMessage();
  if (!COMMIT_REGEX.test(commitMessage)) {
    console.error('❌ Commit message does not follow convention.');
    console.error('   Allowed types: build/refactor/docs/test/chore');
    console.error(`   Current: "${commitMessage}"`);
    process.exit(1);
  }

  console.log(`✅ Commit convention passed: "${commitMessage}"`);
} catch (error) {
  console.error('❌ Unable to validate commit convention.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
