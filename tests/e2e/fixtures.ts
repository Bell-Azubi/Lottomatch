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
      await context.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          throw new Error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      await use(undefined);
      expect(problems, problems.join('\n')).toEqual([]);
    },
    { auto: true },
  ],
});

/** WCAG 2.2 AA check; serious and critical violations fail the test (§8). */
export async function expectAccessible(page: Page, label: string): Promise<void> {
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
