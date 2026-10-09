import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 30000,
  outputDir: '/tmp/jobai-playwright-results',
  use: {baseURL:'http://127.0.0.1:5173', channel:process.env.CI ? undefined : 'chrome', reducedMotion:'reduce', trace:'retain-on-failure'},
  webServer: {command:'npm run dev -- --host 127.0.0.1', url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000},
});
