import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import { confirmWin, open, openHost, setAnimation, startRound, typeNumber } from './helpers';

test.describe('full event (§11 E2E 1)', () => {
  test('prepares prizes, plays all 24 rounds and exports the results', async ({ page }) => {
    test.setTimeout(420_000);
    await setAnimation(page, 'Aus');
    await open(page, 'prizes');
    await page.getByRole('button', { name: 'Vorbereiteten Anlass laden' }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('listitem')
      .filter({ hasText: 'Lottomatch 2026' })
      .getByRole('button', { name: 'Vorschau' })
      .click();
    await dialog.getByRole('button', { name: 'Als neuen Anlass laden' }).click();
    await expect(page.getByText(/geladen und aktiviert/)).toBeVisible();
    await openHost(page);
    for (let round = 1; round <= 24; round += 1) {
      await startRound(page, round);
      for (let slot = 1; slot <= 4; slot += 1) {
        await typeNumber(page, slot * 10 + (round % 10));
        await confirmWin(page, `${round}-${slot}`);
      }
      await expect(page.getByRole('heading', { name: `Runde ${round} ist fertig` })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Alle Runden sind gespielt' })).toBeVisible();
    await page.getByRole('button', { name: 'Anlass abschliessen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('heading', { name: 'Anlass abgeschlossen' })).toBeVisible();
    await open(page, 'results');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gewinner als CSV' }).click();
    const file = await download;
    const path = await file.path();
    const csv = await readFile(path, 'utf8');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\r\n').filter((line) => line.includes('24-4'))).toHaveLength(1);
    expect(csv.split('\r\n').length).toBeGreaterThan(96);
  });
});
