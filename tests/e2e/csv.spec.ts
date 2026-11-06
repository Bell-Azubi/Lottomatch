import { expect, test } from './fixtures';
import { open } from './helpers';

const CSV = [
  'Runde;Preis;Titel;Beschreibung;Wert CHF;Sponsor;Gewinnregel',
  '1;1;Grüner Präsentkorb;Mit Käse und Würsten;50.–;Bäckerei Müller;1 Reihe',
  '1;2;Gutschein «Zum Löwen»;Für 2 Personen;1’000.50;;1 Reihe',
  '1;3;Fondue-Set;;80,50;Metzgerei Öhri;1 Reihe',
  '1;4. Preis;Velo;Citybike;650;;Volle Karte',
  '2;1;;;;;1 Reihe',
].join('\r\n');

test.describe('CSV import (FR-8, E2E 9)', () => {
  test('imports Excel de-CH CSV with BOM, semicolons and umlauts after a preview', async ({
    page,
  }) => {
    await open(page, 'prizes');
    await page.getByRole('button', { name: 'CSV importieren' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('CSV-Datei').setInputFiles({
      name: 'preise.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`\uFEFF${CSV}\r\n`, 'utf8'),
    });
    await expect(dialog.getByText('Zeilen mit Fehlern (werden nicht importiert)')).toBeVisible();
    await expect(dialog.getByText('Grüner Präsentkorb')).toBeVisible();
    await dialog.getByRole('button', { name: '4 Preise importieren' }).click();
    await expect(page.getByText('4 Preise importiert')).toBeVisible();
    await expect(page.getByText('Gutschein «Zum Löwen»').first()).toBeVisible();
    await expect(page.getByText('Velo').first()).toBeVisible();
  });
});
