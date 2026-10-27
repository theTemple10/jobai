import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 30000,
  testIgnore: '**/assets.spec.js',
  outputDir: '/tmp/jobai-playwright-results',
  use: {baseURL:'http://127.0.0.1:5173', channel:process.env.CI ? undefined : 'chrome', reducedMotion:'reduce', trace:'retain-on-failure'},
  webServer: {env:{VITE_SUPABASE_URL:'https://roleaide-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_browser_test_only'},command:'npm run dev -- --host 127.0.0.1', url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000},
});
