import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/visual',
  testMatch: /snapshot-spec\.ts/,
  timeout: 120_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/baseline/{arg}{ext}',
  use: {
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    launchOptions: {
      args: ['--allow-file-access-from-files']
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
});
