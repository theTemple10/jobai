import {defineConfig} from '@playwright/test';
import process from 'node:process';

export default defineConfig({
  testDir: './tests/browser', testMatch: '**/assets.spec.js',
  workers: 1, timeout: 30000,
  outputDir: '/tmp/jobai-production-playwright-results',
  use: {baseURL:'http://127.0.0.1:5174', channel:process.env.CI ? undefined : 'chrome', reducedMotion:'reduce', trace:'retain-on-failure'},
  webServer: {command:'npm run preview -- --host 127.0.0.1 --port 5174 --strictPort', url:'http://127.0.0.1:5174', reuseExistingServer:false, timeout:30000},
});
