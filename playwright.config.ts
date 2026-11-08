import { defineConfig } from '@playwright/test';

/**
 * This suite drives the real Electron shell (`_electron.launch()`), not a browser against a
 * dev server -- that is the whole point of this template. There is therefore no `webServer`
 * and no port: the app is launched from the repo root, Electron's main process
 * (`src/electron-main.js`) loads the parcel-built renderer out of `dist/`, and the tests talk
 * to that window. Run `npm run build-game` (or `npm run build`) first so `dist/` exists.
 *
 * On Linux Electron still needs a display -- CI runs the suite under `xvfb-run`.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/test.spec.js',
  // Everything below is generated output; without this Playwright would walk the packaged
  // Electron app in out/ (hundreds of MB) looking for spec files.
  testIgnore: ['dist/**', 'out/**', '.parcel-cache/**', 'node_modules/**'],

  // Electron launches are heavyweight and the snapshots are timing sensitive: one at a time.
  fullyParallel: false,
  workers: 1,

  // No retries on purpose. These tests freeze the engine clock and step it a fixed number of
  // simulated frames, so a failure means a real difference -- retrying would only hide it.
  retries: 0,
  forbidOnly: !!process.env.CI,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Only write baselines when they are missing; updating an existing one has to be explicit
  // (`npm run test:update-snapshot`).
  updateSnapshots: 'missing',

  outputDir: 'test-results',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']]
});
