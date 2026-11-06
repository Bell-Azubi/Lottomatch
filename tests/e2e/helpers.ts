import type { BrowserContext, Page } from '@playwright/test';
import { expect } from './fixtures';

/** How many prizes a round of the built-in prize list has. */
export function prizesInRound(round: number): number {
  return [4, 9, 14, 19, 24].includes(round) ? 5 : 4;
}

/** Opens a route and waits until the app has booted. */
export async function open(page: Page, route = ''): Promise<void> {
  await page.goto(`./#/${route}`);
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
}

/** Sets a device preference on the Einstellungen page (Darstellung). */
export async function setAnimation(
  page: Page,
  label: 'Aus' | 'Kurz (0.8 s)' | 'Normal (1.8 s)',
): Promise<void> {
  await open(page, 'settings');
  await page.getByLabel('Dauer der Ziehung').selectOption({ label });
}

/** Opens the host console. */
export async function openHost(page: Page): Promise<void> {
  await open(page, 'host');
  await expect(page.getByRole('grid', { name: 'Lottoraster' })).toBeVisible();
}

/** Starts the next round from the host console, confirming the gap warning if shown. */
export async function startRound(page: Page, round: number): Promise<void> {
  await page
    .getByRole('button', { name: `Gang ${round} starten` })
    .first()
    .click();
  const confirm = page.getByRole('button', { name: 'Trotzdem starten' });
  const running = page.getByRole('button', { name: 'Drehen' });
  await expect(confirm.or(running).first()).toBeVisible();
  if (await confirm.isVisible()) await confirm.click();
  await expect(running).toBeVisible();
}

/** Types a drum number on the console keyboard and commits it with Enter (FR-3). */
export async function typeNumber(page: Page, number: number): Promise<void> {
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await page.keyboard.type(String(number));
  await page.keyboard.press('Enter');
}

/** Board cell of a number. */
export function cell(page: Page, number: number) {
  return page.locator(`[data-number="${number}"]`).first();
}

/** Confirms the active prize with a card number. */
export async function confirmWin(page: Page, cardNo: string): Promise<void> {
  await page.keyboard.press('g');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Kartennummer (optional)').fill(cardNo);
  await dialog.getByRole('button', { name: 'Gewinn bestätigen' }).click();
  await expect(dialog).toBeHidden();
}

/** Opens the audience display as a second window of the same context. */
export async function openDisplay(context: BrowserContext): Promise<Page> {
  const display = await context.newPage();
  await display.goto('./#/display');
  await expect(display.getByRole('main')).toBeVisible();
  return display;
}
