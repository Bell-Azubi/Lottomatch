import { expect, test } from './fixtures';
import { cell, open, openDisplay, openHost, setAnimation, startRound, typeNumber } from './helpers';

test.describe('host and display (FR-10)', () => {
  test('the display welcomes the audience until the first round starts', async ({
    context,
    page,
  }) => {
    await openHost(page);
    const display = await openDisplay(context);
    const welcome = display.getByRole('region', { name: 'Herzlich willkommen' });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole('img', { name: 'FC Laufenburg-Kaisten' })).toBeVisible();
    await expect(
      welcome.getByText('FC Laufenburg-Kaisten Senioren', { exact: true }),
    ).toBeVisible();
    await expect(display.getByRole('grid', { name: 'Lottoraster' })).toBeHidden();
    await page.bringToFront();
    await startRound(page, 1);
    await expect(display.getByRole('grid', { name: 'Lottoraster' })).toBeVisible();
    await expect(welcome).toBeHidden();
  });

  test('the display follows the host live, including overlays', async ({ context, page }) => {
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    const display = await openDisplay(context);
    await page.bringToFront();
    await typeNumber(page, 42);
    await expect(cell(display, 42)).toHaveAccessibleName('42, zuletzt gezogen');
    await expect(display.getByText('Zuletzt gezogen: 42, Ziehung 1')).toBeAttached();
    await expect(page.getByText('Anzeige verbunden')).toBeVisible();
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.keyboard.press('p');
    await expect(
      display.getByRole('region', { name: 'Pause – gleich geht’s weiter' }),
    ).toBeVisible();
    await page.keyboard.press('p');
    await expect(
      display.getByRole('region', { name: 'Pause – gleich geht’s weiter' }),
    ).toBeHidden();
  });

  test('a display opened before the host shows the stored state, then connects', async ({
    context,
    page,
  }) => {
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    await typeNumber(page, 5);
    // The draw and its pending write appear together; close only once it is stored.
    await expect(cell(page, 5)).toHaveAccessibleName('5, zuletzt gezogen');
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
    await page.close();
    const display = await openDisplay(context);
    await expect(cell(display, 5)).toHaveAccessibleName('5, zuletzt gezogen');
    const host = await context.newPage();
    await openHost(host);
    await typeNumber(host, 6);
    await expect(cell(display, 6)).toHaveAccessibleName('6, zuletzt gezogen');
  });

  test('an open display keeps its state when the host closes and follows a new host', async ({
    context,
    page,
  }) => {
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    const display = await openDisplay(context);
    await page.bringToFront();
    await typeNumber(page, 8);
    await expect(cell(display, 8)).toHaveAccessibleName('8, zuletzt gezogen');
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
    await page.close();
    // Longer than two display heartbeats without any host: nothing on the display changes.
    await display.waitForTimeout(4_500);
    await expect(cell(display, 8)).toHaveAccessibleName('8, zuletzt gezogen');
    await expect(display.getByText('Zuletzt gezogen: 8, Ziehung 1')).toBeAttached();
    const host = await context.newPage();
    await openHost(host);
    await typeNumber(host, 9);
    await expect(cell(display, 9)).toHaveAccessibleName('9, zuletzt gezogen');
  });

  test('a second host window is read-only until it takes over (Web Locks)', async ({
    context,
    page,
  }) => {
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    const second = await context.newPage();
    await open(second, 'host');
    await expect(
      second.getByText('Nur Ansicht: Ein anderes Fenster steuert das Spiel.'),
    ).toBeVisible();
    await expect(second.getByRole('button', { name: 'Drehen' })).toBeDisabled();
    await typeNumber(page, 21);
    await expect(cell(second, 21)).toHaveAccessibleName('21, zuletzt gezogen');
    await second.getByRole('button', { name: 'Steuerung übernehmen' }).click();
    await expect(second.getByRole('button', { name: 'Drehen' })).toBeEnabled();
    await expect(
      page.getByText('Nur Ansicht: Ein anderes Fenster steuert das Spiel.'),
    ).toBeVisible();
    await typeNumber(second, 22);
    await expect(cell(page, 22)).toHaveAccessibleName('22, zuletzt gezogen');
  });
});
