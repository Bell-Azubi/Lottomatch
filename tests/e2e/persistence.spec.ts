import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { cell, confirmWin, openHost, setAnimation, startRound, typeNumber } from './helpers';

async function playSome(page: Page): Promise<void> {
  await setAnimation(page, 'Aus');
  await openHost(page);
  await startRound(page, 1);
  await typeNumber(page, 12);
  await typeNumber(page, 34);
  await confirmWin(page, '77');
  await typeNumber(page, 56);
  await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
}

async function expectRestored(page: Page): Promise<void> {
  await openHost(page);
  await expect(page.getByText('3 von 90 gezogen')).toBeVisible();
  await expect(cell(page, 56)).toHaveAccessibleName('56, zuletzt gezogen');
  await expect(cell(page, 12)).toHaveAccessibleName('12, gezogen');
  await expect(page.getByText('Preis 2 von 4 · 1 Reihe')).toBeVisible();
  await expect(page.getByText('Gang 1 von 24').first()).toBeVisible();
}

test.describe('crash safety (§8 reliability)', () => {
  test('a reload restores the exact state', async ({ page }) => {
    await playSome(page);
    await page.reload();
    await expectRestored(page);
  });

  test('a crashed window loses nothing that was saved', async ({ context, page }) => {
    await playSome(page);
    await page.close({ runBeforeUnload: false });
    const fresh = await context.newPage();
    await expectRestored(fresh);
  });
});

test.describe('offline (C4)', () => {
  // Playwright supports service workers in Chromium only. WebKit's offline emulation also fails
  // the loads the worker answers from its cache ("WebKit encountered an internal error"), and
  // under Playwright's Firefox the worker never reports ready. Offline mode in Firefox and Safari
  // is covered by the airplane-mode check on the event laptop (docs/eventtag-checkliste.de.md).
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'service workers and offline emulation are reliable in Chromium only',
  );

  test('runs without network after the first visit', async ({ context, page }) => {
    await openHost(page);
    // The worker precaches during install; once it is active, the next navigation is controlled
    // (no clients.claim(): the page that registered it stays uncontrolled until it reloads).
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await setAnimation(page, 'Aus');
    for (const route of ['prizes', 'results', 'settings']) {
      await page.goto(`./#/${route}`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    }
    await openHost(page);
    await startRound(page, 1);
    await typeNumber(page, 9);
    await expect(cell(page, 9)).toHaveAccessibleName('9, zuletzt gezogen');
    await context.setOffline(false);
  });
});
