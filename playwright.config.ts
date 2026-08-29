import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './qa/web-agent',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: 1,
  reporter: [['line']],
  use: {
    baseURL: process.env.FIGHT_AI_WEB_URL || 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
