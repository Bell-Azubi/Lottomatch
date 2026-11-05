import { expect, test } from './fixtures';
import { cell, confirmWin, openHost, setAnimation, startRound, typeNumber } from './helpers';

test.describe('draws (FR-2, FR-3)', () => {
  test('mixes random and manual draws and rejects every invalid input', async ({ page }) => {
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    const field = page.getByLabel('Zahl aus der Trommel');
    const invalid: readonly [string, string][] = [
      ['0', 'Die Zahl muss zwischen 1 und 90 liegen.'],
      ['91', 'Die Zahl muss zwischen 1 und 90 liegen.'],
      ['4.2', 'Nur ganze Zahlen erlaubt.'],
      ['-1', 'Die Zahl muss zwischen 1 und 90 liegen.'],
      ['', 'Bitte eine Zahl eingeben.'],
      ['abc', 'Nur Ziffern 0–9 erlaubt.'],
    ];
    for (const [input, message] of invalid) {
      await field.fill(input);
      await field.press('Enter');
      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByText('0 von 90 gezogen')).toBeVisible();
    }
    await field.fill(' 07 ');
    await field.press('Enter');
    await expect(cell(page, 7)).toHaveAccessibleName('7, zuletzt gezogen');
    await field.fill('7');
    await field.press('Enter');
    await expect(page.getByText('7 ist in dieser Runde bereits gezogen.')).toBeVisible();
    await page.getByRole('button', { name: 'Drehen' }).click();
    await expect(page.getByText('2 von 90 gezogen')).toBeVisible();
    await cell(page, 50).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Als gezogen markieren' }).click();
    await expect(cell(page, 50)).toHaveAccessibleName('50, zuletzt gezogen');
    await expect(page.getByText('3 von 90 gezogen')).toBeVisible();
  });

  test('a second press during the spin only reveals; held keys never draw twice', async ({
    page,
  }) => {
    await setAnimation(page, 'Normal (1.8 s)');
    await openHost(page);
    await startRound(page, 1);
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.keyboard.down(' ');
    await page.keyboard.down(' ');
    await page.keyboard.up(' ');
    await page.keyboard.press(' ');
    await expect(page.getByText('1 von 90 gezogen')).toBeVisible();
  });
});

test.describe('undo and revoke (FR-4)', () => {
  test('undo reverts only the latest draw and is blocked after an award', async ({ page }) => {
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    await typeNumber(page, 11);
    await typeNumber(page, 22);
    await page.keyboard.press('Control+z');
    await expect(cell(page, 22)).toHaveAccessibleName('22, offen');
    await expect(cell(page, 11)).toHaveAccessibleName('11, zuletzt gezogen');
    await confirmWin(page, '101');
    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeDisabled();
    await expect(
      page.getByText('Nach dieser Ziehung wurde bereits ein Gewinn bestätigt'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Spielleitung' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Letzten Gewinn widerrufen' }).click();
    await dialog.getByLabel('Grund (wird protokolliert)').fill('Karte falsch gelesen');
    await dialog.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByText('Preis 1 von 4 · 1 Linie')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeEnabled();
  });
});

test.describe('keyboard (FR-12)', () => {
  test('plays a round with the keyboard only', async ({ page }) => {
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    for (let slot = 1; slot <= 4; slot += 1) {
      // A caller presses at human pace; presses within 400 ms count as one (double press).
      await page.waitForTimeout(450);
      await page.keyboard.press(' ');
      await expect(page.getByText(`${slot} von 90 gezogen`)).toBeVisible();
      await page.keyboard.press('g');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.keyboard.press(' ');
      await expect(page.getByText(`${slot} von 90 gezogen`)).toBeVisible();
      await dialog.getByRole('button', { name: 'Ohne Prüfung bestätigen' }).press('Enter');
      await dialog.getByRole('button', { name: 'Gewinn bestätigen' }).press('Enter');
      await expect(dialog).toBeHidden();
    }
    await expect(page.getByRole('heading', { name: 'Runde 1 ist fertig' })).toBeVisible();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Tastenkürzel' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
