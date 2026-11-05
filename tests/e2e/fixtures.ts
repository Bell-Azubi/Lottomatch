import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

/**
 * Every test fails on a console error or warning, an uncaught page error or a CSP violation
 * (§8: zero console errors or warnings in production).
 */
export const test = base.extend<{ guard: undefined }>({
  guard: [
    async ({ context }, use) => {
      const problems: string[] = [];
      const watch = (page: Page) => {
        page.on('console', (message) => {
          if (message.type() === 'error' || message.type() === 'warning') {
            problems.push(`${page.url()} console ${message.type()}: ${message.text()}`);
          }
        });
        page.on('pageerror', (error) => problems.push(`${page.url()} pageerror: ${error.message}`));
      };
      context.on('page', watch);
      // In WebKit, Playwright's screenshot step briefly inserts `<style>body {}</style>` to sync
      // animations, which the CSP blocks. Screenshots are taken only for tests that already
      // failed, so a "style-src-elem inline" violation next to another error comes from that.
      await context.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          const source =
            event.sourceFile === '' ? '' : ` at ${event.sourceFile}:${event.lineNumber}`;
          throw new Error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}${source}`);
        });
      });
      await use(undefined);
      expect(problems, problems.join('\n')).toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * Waits until no finite animation is running. axe measures colour contrast at the current
 * opacity, so an overlay that is still fading in would be reported as low contrast.
 */
async function settleAnimations(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          document
            .getAnimations()
            .some(
              (animation) =>
                animation.playState === 'running' &&
                animation.effect?.getComputedTiming().endTime !== Infinity,
            ),
        ),
      { message: 'entrance animations have finished', timeout: 5_000 },
    )
    .toBe(false);
}

/** WCAG 2.2 AA check of the settled page; serious and critical violations fail the test (§8). */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  await settleAnimations(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const severe = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  const summary = severe.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
  expect(summary, `${label}\n${summary.join('\n')}`).toEqual([]);
}
