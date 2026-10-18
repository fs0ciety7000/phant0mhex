import { defineConfig } from '@playwright/test';

// Config partagée des tests e2e (site, admin, API PocketBase).
// E2E_BASE_URL : site Astro · E2E_PB_URL : PocketBase (lu par les specs e2e/pb-*.spec.ts).
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4321',
    trace: 'retain-on-failure',
    // Navigateur préinstallé (ex. /opt/pw-browsers/chromium) quand sa révision diffère de celle de Playwright.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
});
