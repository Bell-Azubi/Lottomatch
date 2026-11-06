import { expect, test } from './fixtures';
import {
  cell,
  confirmWin,
  open,
  openDisplay,
  openHost,
  setAnimation,
  startRound,
  typeNumber,
} from './helpers';

const CSV = [
  'Runde;Preis;Titel;Beschreibung;Wert CHF;Sponsor;Gewinnregel',
  '1;1. Preis;Vorderschinken;;;;',
  '1;2. Preis;1/2 Schüfeli;;;;',
  '1;3. Preis;Rippli;;;;',
  '1;4. Preis;Wein;;;;',
  '1;Superlotto;Grosser Früchtekorb;;;;',
  '2;1. Preis;Zopf;;;;',
].join('\r\n');

test.describe('Superlotto (ADR-0027)', () => {
  test('the built-in list has a Superlotto form only in its Superlotto rounds', async ({
    page,
  }) => {
    await open(page, 'prizes');
    await expect(page.getByText('Alle Preise erfasst')).toBeVisible();
    await expect(page.getByText('5 von 5 Preisen erfasst')).toHaveCount(5);
    await expect(page.getByText('4 von 4 Preisen erfasst')).toHaveCount(19);
    await page.getByRole('button', { name: 'Gang 3 bearbeiten' }).click();
    await expect(page.getByRole('heading', { name: 'Preis 4', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Superlotto', level: 3 })).toHaveCount(0);
    await page.getByRole('button', { name: 'Gang 4 bearbeiten' }).click();
    const form = page.getByRole('region', { name: 'Superlotto' });
    await expect(form.getByLabel('Titel')).toHaveValue('Grosser Früchtekorb');
    await expect(form.getByLabel('Gewinnregel')).toHaveValue('FULL_CARD');
  });

  test('can come from an imported list and is played as the fifth prize', async ({
    context,
    page,
  }) => {
    await setAnimation(page, 'Aus');
    await open(page, 'prizes');
    await page.getByRole('button', { name: 'CSV importieren' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('CSV-Datei').setInputFiles({
      name: 'preise.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`\uFEFF${CSV}\r\n`, 'utf8'),
    });
    await dialog.getByRole('button', { name: '6 Preise importieren' }).click();
    await expect(page.getByText('6 Preise importiert')).toBeVisible();
    await expect(page.getByText('5 von 5 Preisen erfasst')).toHaveCount(6);

    await page.getByRole('button', { name: 'Gang 2 bearbeiten' }).click();
    await expect(page.getByRole('heading', { name: 'Preis 4', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Superlotto', level: 3 })).toHaveCount(0);
    await page.getByRole('button', { name: 'Gang 1 bearbeiten' }).click();
    const form = page.getByRole('region', { name: 'Superlotto' });
    await expect(form.getByLabel('Titel')).toHaveValue('Grosser Früchtekorb');
    await expect(form.getByLabel('Gewinnregel')).toHaveValue('FULL_CARD');

    await openHost(page);
    const display = await openDisplay(context);
    await startRound(page, 1);
    await expect(page.getByText('Preis 1 von 5 · 1 Reihe')).toBeVisible();
    for (let slot = 1; slot <= 4; slot += 1) {
      await typeNumber(page, slot);
      await expect(page.getByText(`Preis ${slot} von 5 · 1 Reihe`)).toBeVisible();
      await confirmWin(page, String(slot));
    }
    await expect(page.getByText('Superlotto · Volle Karte')).toBeVisible();
    await expect(cell(page, 4)).not.toHaveAccessibleName('4, offen');
    await typeNumber(page, 50);
    await expect(cell(page, 1)).not.toHaveAccessibleName('1, offen');
    await expect(display.getByText('Grosser Früchtekorb')).toBeVisible();
    await expect(display.getByText('SUPERLOTTO').first()).toBeAttached();
    await confirmWin(page, '77');
    await expect(display.getByText('Superlotto!')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gang 1 ist fertig' })).toBeVisible();

    await startRound(page, 2);
    await expect(page.getByText('Preis 1 von 4 · 1 Reihe')).toBeVisible();
  });
});
