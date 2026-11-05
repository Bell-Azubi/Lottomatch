import { expect, test } from './fixtures';
import { open, openDisplay, openHost, setAnimation, startRound, typeNumber } from './helpers';

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
] as const;

const THEMES = [
  ['Dunkler Saal', 'dark'],
  ['Heller Saal', 'light'],
] as const;

/**
 * Display snapshots at three sizes in both themes (ADR-0018). Text in the system font is masked,
 * so baselines compare layout, colour, rings and the self-hosted numerals across machines.
 */
for (const [themeLabel, theme] of THEMES) {
  test(`display layout in ${theme} theme`, async ({ context, page }) => {
    await setAnimation(page, 'Aus');
    await open(page, 'settings');
    await page.getByLabel('Thema der Anzeige').selectOption({ label: themeLabel });
    await openHost(page);
    await startRound(page, 1);
    for (const number of [7, 42, 88]) await typeNumber(page, number);
    const display = await openDisplay(context);
    await expect(display.getByText('Zuletzt gezogen: 88, Ziehung 3')).toBeAttached();
    await display.evaluate(async () => {
      await document.fonts.ready;
    });
    for (const viewport of VIEWPORTS) {
      await display.setViewportSize(viewport);
      const badge = display.locator('[data-reveal="badge"]');
      const height = await badge.evaluate((element) => element.getBoundingClientRect().height);
      expect(height / viewport.height).toBeGreaterThanOrEqual(0.35);
      const numeral = await display
        .locator('[data-number="1"] span')
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
      expect(numeral / viewport.height).toBeGreaterThanOrEqual(0.045);
      await expect(display).toHaveScreenshot(
        `display-${theme}-${viewport.width}x${viewport.height}.png`,
        {
          fullPage: false,
          mask: [display.locator('p, strong')],
        },
      );
    }
  });
}
