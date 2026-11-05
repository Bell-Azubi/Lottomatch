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
 * Brings every finite animation to its end state, as Playwright's screenshots do with
 * `animations: 'disabled'`, and repeats until none is left (a finished step may start the next
 * one). axe measures colour contrast at the current opacity, so an overlay that is still fading
 * in would be reported as low contrast. Waiting for running animations is not enough: an engine
 * may hold the animations of a window that is not in front without reporting them as running.
 */
async function settleAnimations(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          let finished = 0;
          for (const animation of document.getAnimations()) {
            const done = animation.playState === 'finished' || animation.playState === 'idle';
            if (done || animation.effect?.getTiming().iterations === Infinity) continue;
            animation.finish();
            finished += 1;
          }
          return finished;
        }),
      { message: 'every finite animation has reached its end state', timeout: 5_000 },
    )
    .toBe(0);
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
  // axe's own explanation per element, e.g. the measured colours and ratio of a contrast finding.
  const details = severe.flatMap((violation) =>
    violation.nodes.map((node) => `${node.target.join(' ')}: ${node.failureSummary ?? ''}`),
  );
  expect(summary, `${label}\n${details.join('\n')}`).toEqual([]);
}
