import { expect, test } from './fixtures';
import { cell, openDisplay, openHost, setAnimation, startRound, typeNumber } from './helpers';

/** Event Timing reports nothing faster than 16 ms, which is inside the budget anyway. */
const EVENT_TIMING_THRESHOLD_MS = 16;
/** §8: input → painted result with animation off. */
const INPUT_BUDGET_MS = 50;
/** §8: host → display at the 95th percentile. */
const SYNC_P95_BUDGET_MS = 100;
/** §8: a repeat visit served by the service worker is interactive within this time. */
const REPEAT_VISIT_BUDGET_MS = 300;

declare global {
  interface Window {
    /** Bound by these specs through `exposeFunction`; the app never defines it. */
    reportTiming?: (name: string, value: number, group?: number) => Promise<void>;
    /** Set by an init script of these specs when the console's board was first painted. */
    consolePaintedAt?: number;
  }
}

function percentile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1));
  const value = sorted[index];
  if (value === undefined) throw new Error('No samples to take a percentile of');
  return value;
}

/**
 * Runs in its own Chromium project with one worker (playwright.config.ts): timings measured next
 * to other browsers competing for the CPU would describe the machine, not the app.
 */
test.describe('performance (§8)', () => {
  test('input → painted result stays within 50 ms with animation off', async ({ page }) => {
    // Longest Event Timing entry per interaction (the INP grouping); hover events carry no
    // interaction ID and are not inputs.
    const interactions = new Map<number, { name: string; duration: number }>();
    await page.exposeFunction('reportTiming', (name: string, duration: number, id: number) => {
      const known = interactions.get(id);
      if (known === undefined || duration > known.duration)
        interactions.set(id, { name, duration });
    });
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    await page.evaluate((threshold) => {
      const since = performance.now();
      const init: PerformanceObserverInit & { durationThreshold: number } = {
        type: 'event',
        durationThreshold: threshold,
      };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEventTiming[]) {
          if (entry.interactionId > 0 && entry.startTime >= since) {
            void window.reportTiming?.(entry.name, entry.duration, entry.interactionId);
          }
        }
      }).observe(init);
    }, EVENT_TIMING_THRESHOLD_MS);
    for (let number = 1; number <= 15; number += 1) {
      await typeNumber(page, number);
      await expect(cell(page, number)).toHaveAccessibleName(`${number}, zuletzt gezogen`);
    }
    for (let draw = 16; draw <= 20; draw += 1) {
      // A caller presses at human pace; presses within 400 ms count as one (double press).
      await page.waitForTimeout(450);
      await page.getByRole('button', { name: 'Drehen' }).click();
      await expect(page.getByText(`${draw} von 90 gezogen`)).toBeVisible();
    }
    await page.keyboard.press('Control+z');
    await expect(page.getByText('19 von 90 gezogen')).toBeVisible();
    // Entries are delivered after the frame they waited for has been presented.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 100);
          });
        }),
    );
    // The API is live in this page: the first interaction is always recorded.
    expect(await page.evaluate(() => performance.getEntriesByType('first-input').length)).toBe(1);
    const measured = [...interactions.values()];
    const slow = measured.filter((entry) => entry.duration > INPUT_BUDGET_MS);
    const longest = Math.max(0, ...measured.map((entry) => entry.duration));
    test.info().annotations.push({
      type: 'Event Timing',
      description: `${measured.length} interactions at or above ${EVENT_TIMING_THRESHOLD_MS} ms, longest ${longest} ms`,
    });
    expect(slow, slow.map((entry) => `${entry.name}: ${entry.duration} ms`).join('\n')).toEqual([]);
  });

  test('the display follows the host within 100 ms at the 95th percentile', async ({
    context,
    page,
  }) => {
    const sent: number[] = [];
    const shown = new Map<number, number>();
    await setAnimation(page, 'Aus');
    await openHost(page);
    await startRound(page, 1);
    const display = await openDisplay(context);
    await page.bringToFront();
    await page.exposeFunction('reportTiming', (_name: string, at: number) => {
      sent.push(at);
    });
    await display.exposeFunction('reportTiming', (seq: string, at: number) => {
      const key = Number(seq);
      if (!shown.has(key)) shown.set(key, at);
    });
    await page.evaluate(() => {
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Enter') {
            void window.reportTiming?.('enter', performance.timeOrigin + event.timeStamp);
          }
        },
        { capture: true },
      );
    });
    await display.evaluate(() => {
      const pattern = /^Zuletzt gezogen: \d+, Ziehung (\d+)$/;
      let last: string | undefined;
      new MutationObserver(() => {
        const seq = [...document.querySelectorAll('p')]
          .map((p) => pattern.exec(p.textContent.trim())?.[1])
          .find((match) => match !== undefined);
        if (seq === undefined || seq === last) return;
        last = seq;
        // The next frame is when the browser paints the change.
        requestAnimationFrame(() => {
          void window.reportTiming?.(seq, performance.timeOrigin + performance.now());
        });
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    const draws = 20;
    for (let seq = 1; seq <= draws; seq += 1) {
      const number = seq * 4;
      await typeNumber(page, number);
      await expect(display.getByText(`Zuletzt gezogen: ${number}, Ziehung ${seq}`)).toBeAttached();
    }
    await expect.poll(() => shown.size).toBe(draws);
    expect(sent).toHaveLength(draws);
    const latencies = sent.map((at, index) => {
      const painted = shown.get(index + 1);
      if (painted === undefined) throw new Error(`Draw ${index + 1} never reached the display`);
      return painted - at;
    });
    const p95 = percentile(latencies, 0.95);
    test.info().annotations.push({
      type: 'host → display',
      description: `p95 ${p95.toFixed(1)} ms, max ${Math.max(...latencies).toFixed(1)} ms`,
    });
    expect(p95).toBeLessThanOrEqual(SYNC_P95_BUDGET_MS);
  });

  test('a repeat visit from the service worker is interactive within 300 ms', async ({ page }) => {
    await page.addInitScript(() => {
      // Navigation start → the console's board is in the DOM and painted (the next frame).
      const observer = new MutationObserver(() => {
        if (document.querySelector('[role="grid"]') === null) return;
        observer.disconnect();
        requestAnimationFrame(() => {
          window.consolePaintedAt = performance.now();
        });
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    await openHost(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    const samples: number[] = [];
    for (let visit = 1; visit <= 3; visit += 1) {
      const response = await page.reload();
      expect(response?.fromServiceWorker()).toBe(true);
      await expect.poll(() => page.evaluate(() => window.consolePaintedAt)).toBeGreaterThan(0);
      samples.push(await page.evaluate(() => window.consolePaintedAt ?? Number.POSITIVE_INFINITY));
    }
    const median = percentile(samples, 0.5);
    test.info().annotations.push({
      type: 'repeat visit',
      description: `console painted after ${samples.map((ms) => ms.toFixed(0)).join(', ')} ms`,
    });
    expect(median).toBeLessThanOrEqual(REPEAT_VISIT_BUDGET_MS);
  });
});
