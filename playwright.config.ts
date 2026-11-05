import { defineConfig, devices } from '@playwright/test';

/** E2E runs against the production build under the GitHub Pages subpath (C2). */
const BASE_PATH = process.env.E2E_BASE_PATH ?? '/Lottomatch/';
const PORT = 4173;
const CI = process.env.CI !== undefined;
/** Specs that run in their own project only. */
const SEPARATE = /(visual|performance|soak)\.spec\.ts/;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  workers: CI ? 2 : 3,
  timeout: 90_000,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !CI,
    env: { BASE_PATH },
    timeout: 60_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: SEPARATE },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: SEPARATE },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: SEPARATE },
    // Baselines are rendered by Chromium on Linux (ADR-0018).
    { name: 'visual', use: { ...devices['Desktop Chrome'] }, testMatch: /visual\.spec\.ts/ },
    // Timings (§8) run one at a time, never beside other browsers competing for the CPU, and
    // without tracing: its screencast frames would load the compositor that is being measured.
    {
      name: 'performance',
      use: { ...devices['Desktop Chrome'], trace: 'off' },
      testMatch: /performance\.spec\.ts/,
      workers: 1,
    },
    // Accelerated endurance run with CDP heap metrics (§8); minutes long, so its own project.
    {
      name: 'soak',
      use: { ...devices['Desktop Chrome'], trace: 'off' },
      testMatch: /soak\.spec\.ts/,
      workers: 1,
    },
  ],
});
