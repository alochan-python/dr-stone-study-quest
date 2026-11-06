import { defineConfig, devices } from '@playwright/test';

// BASE_URL を指定すると、そのURL（公開版）に対して実行する
const external = process.env.BASE_URL;
const baseURL = external ?? 'http://localhost:4173/dr-stone-study-quest/';

const webkit = devices['Desktop Safari'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  timeout: 45_000,
  use: { baseURL, serviceWorkers: 'allow' },
  projects: [
    { name: 'iphone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'iphone-se', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 }, hasTouch: true } },
    { name: 'small-phone', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 }, hasTouch: true } },
    { name: 'ipad', use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    // iPhone / iPad の実体に近い WebKit エンジン
    { name: 'iphone-webkit', use: { ...webkit, viewport: { width: 390, height: 844 } } },
    { name: 'ipad-webkit', use: { ...webkit, viewport: { width: 820, height: 1180 } } },
  ],
  webServer: external
    ? undefined
    : { command: 'npm run preview', url: baseURL, reuseExistingServer: true, timeout: 30_000 },
});
