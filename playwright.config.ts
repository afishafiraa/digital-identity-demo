import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  outputDir: '.local/playwright-results',
  reporter: 'list',
  use: { baseURL: 'http://localhost:47831', trace: 'retain-on-failure' },
});
