import type { Page } from '@playwright/test';
import { expect, expectAccessible, test } from './fixtures';
import {
  confirmWin,
  open,
  openDisplay,
  openHost,
  setAnimation,
  startRound,
  typeNumber,
} from './helpers';

/**
 * Checks the display as the audience sees it: brought to the front first, because a browser may
 * pause the animations of a window in the background, then hands the front back to the host.
 */
async function expectDisplayAccessible(display: Page, host: Page, label: string): Promise<void> {
  await display.bringToFront();
  await expectAccessible(display, label);
  await host.bringToFront();
}

test.describe('accessibility (WCAG 2.2 AA, axe)', () => {
  test('every page of the console passes in both themes', async ({ page }) => {
    for (const theme of ['Dunkler Saal', 'Heller Saal']) {
      await open(page, 'settings');
      await page.getByLabel('Thema der Konsole').selectOption({ label: theme });
      for (const route of ['', 'prizes', 'results', 'settings', 'host']) {
        await open(page, route);
        await expectAccessible(page, `${theme} #/${route}`);
      }
    }
  });

  test('host dialogs and a running round pass', async ({ page }) => {
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    await typeNumber(page, 17);
    await expectAccessible(page, 'running round');
    await page.keyboard.press('g');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectAccessible(page, 'claim dialog');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Spielleitung' }).click();
    await expectAccessible(page, 'overrides dialog');
    await page.keyboard.press('Escape');
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.keyboard.press('?');
    await expectAccessible(page, 'shortcuts dialog');
    await page.keyboard.press('Escape');
    await confirmWin(page, '5');
    await open(page, 'results');
    await expectAccessible(page, 'results with a winner');
  });

  test('the display passes with every overlay', async ({ context, page }) => {
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    const display = await openDisplay(context);
    await page.bringToFront();
    await typeNumber(page, 33);
    await expect(display.getByText('Zuletzt gezogen: 33, Ziehung 1')).toBeAttached();
    await expectDisplayAccessible(display, page, 'display');
    await confirmWin(page, '12');
    await expect(display.getByRole('region', { name: 'Gewinn!' })).toBeVisible();
    await expectDisplayAccessible(display, page, 'win overlay');
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.keyboard.press('p');
    await expect(
      display.getByRole('region', { name: 'Pause – gleich geht’s weiter' }),
    ).toBeVisible();
    await expectDisplayAccessible(display, page, 'pause overlay');
    await page.keyboard.press('p');
    for (let slot = 2; slot <= 4; slot += 1) {
      await typeNumber(page, 40 + slot);
      await confirmWin(page, String(slot));
    }
    await page.getByRole('button', { name: 'Rundenende anzeigen' }).click();
    await expect(display.getByRole('region', { name: 'Runde 1 ist fertig' })).toBeVisible();
    await expectDisplayAccessible(display, page, 'round end overlay');
    await page.getByRole('button', { name: 'Spielleitung' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Anlass abschliessen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Bestätigen' }).click();
    await expect(display.getByRole('region', { name: 'Danke fürs Mitspielen!' })).toBeVisible();
    await expectDisplayAccessible(display, page, 'game end overlay');
  });
});

test.describe('reduced motion (E2E 8)', () => {
  test('draws reveal with a short crossfade and no errors', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await setAnimation(page, 'Normal (1.8 s)');
    await openHost(page);
    await startRound(page, 1);
    const display = await openDisplay(context);
    await page.bringToFront();
    await typeNumber(page, 64);
    await expect(display.getByText('Zuletzt gezogen: 64, Ziehung 1')).toBeAttached({
      timeout: 1_000,
    });
    await expect(display.locator('[data-number="64"]')).toHaveAccessibleName('64, zuletzt gezogen');
    await context.close();
  });
});
