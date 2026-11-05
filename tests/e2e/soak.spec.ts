import type { CDPSession, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  confirmWin,
  open,
  openDisplay,
  openHost,
  setAnimation,
  startRound,
  typeNumber,
} from './helpers';

/** Full events played back to back; the first one warms caches and JIT and is not compared. */
const EVENTS = Number(process.env.SOAK_EVENTS ?? '4');

/**
 * Growth tolerated from the second to the last event. Each new event legitimately adds its record
 * to the event list (a handful of objects); a retained session would add thousands per event.
 * The V8 heap keeps warming up (hidden classes, compiled code) by tens of kilobytes per event.
 * Chromium's own performance-timeline buffers live outside the V8 heap and are not counted.
 */
const TOLERANCE = {
  objectsPerEvent: 25,
  heapBytes: 2 * 1024 * 1024,
  nodes: 150,
  listeners: 25,
} as const;

interface Sample {
  /** Live JS objects in the page's main world (the app; not Playwright's isolated world). */
  readonly objects: number;
  readonly heap: number;
  readonly nodes: number;
  readonly listeners: number;
}

async function countObjects(session: CDPSession): Promise<number> {
  const { result: prototype } = await session.send('Runtime.evaluate', {
    expression: 'Object.prototype',
  });
  if (prototype.objectId === undefined) throw new Error('Object.prototype has no remote id');
  const { objects } = await session.send('Runtime.queryObjects', {
    prototypeObjectId: prototype.objectId,
  });
  if (objects.objectId === undefined) throw new Error('queryObjects returned no array');
  const { result } = await session.send('Runtime.callFunctionOn', {
    objectId: objects.objectId,
    functionDeclaration: 'function () { return this.length; }',
    returnByValue: true,
  });
  await session.send('Runtime.releaseObject', { objectId: objects.objectId });
  await session.send('Runtime.releaseObject', { objectId: prototype.objectId });
  if (typeof result.value !== 'number') throw new Error('Object count is not a number');
  return result.value;
}

async function measure(session: CDPSession): Promise<Sample> {
  await session.send('HeapProfiler.collectGarbage');
  const objects = await countObjects(session);
  const { metrics } = await session.send('Performance.getMetrics');
  const read = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? NaN;
  return {
    objects,
    heap: read('JSHeapUsedSize'),
    nodes: read('Nodes'),
    listeners: read('JSEventListeners'),
  };
}

async function createEvent(page: Page, name: string): Promise<void> {
  await open(page, 'settings');
  await page.getByRole('button', { name: 'Neuer Anlass' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name des Anlasses').fill(name);
  await dialog.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.getByText(`«${name}» erstellt`)).toBeVisible();
}

/** Plays 24 rounds of four prizes each and completes the event. */
async function playEvent(page: Page): Promise<void> {
  await openHost(page);
  for (let round = 1; round <= 24; round += 1) {
    await startRound(page, round);
    for (let slot = 1; slot <= 4; slot += 1) {
      await typeNumber(page, slot * 10 + (round % 10));
      await confirmWin(page, `${round}-${slot}`);
    }
    await expect(page.getByRole('heading', { name: `Runde ${round} ist fertig` })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Anlass abschliessen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.getByRole('heading', { name: 'Anlass abgeschlossen' })).toBeVisible();
}

function describeSeries(label: string, samples: readonly Sample[]): string {
  const objects = samples.map((sample) => sample.objects).join(' → ');
  const heap = samples.map((sample) => (sample.heap / 1024 / 1024).toFixed(2)).join(' → ');
  const nodes = samples.map((sample) => sample.nodes).join(' → ');
  const listeners = samples.map((sample) => sample.listeners).join(' → ');
  return `${label}: objects ${objects}; heap MB ${heap}; nodes ${nodes}; listeners ${listeners}`;
}

test.describe('endurance (§8)', () => {
  test('full events back to back leave no growing objects, heap, DOM or listeners', async ({
    context,
    page,
  }) => {
    test.setTimeout(EVENTS * 300_000);
    expect(EVENTS).toBeGreaterThanOrEqual(3);
    await setAnimation(page, 'Aus');
    const display = await openDisplay(context);
    await page.bringToFront();
    const windows = [
      { label: 'host', session: await context.newCDPSession(page), samples: [] as Sample[] },
      { label: 'display', session: await context.newCDPSession(display), samples: [] as Sample[] },
    ];
    for (const window of windows) await window.session.send('Performance.enable');
    for (let event = 1; event <= EVENTS; event += 1) {
      await createEvent(page, `Dauertest ${event}`);
      await playEvent(page);
      for (const window of windows) window.samples.push(await measure(window.session));
    }
    const report = windows.map((window) => describeSeries(window.label, window.samples));
    test.info().annotations.push({ type: 'soak', description: report.join(' | ') });
    const message = report.join('\n');
    for (const { samples } of windows) {
      const from = samples[1];
      const to = samples.at(-1);
      if (from === undefined || to === undefined) throw new Error('Missing soak samples');
      expect(to.objects - from.objects, message).toBeLessThanOrEqual(
        TOLERANCE.objectsPerEvent * (EVENTS - 2),
      );
      expect(to.heap - from.heap, message).toBeLessThanOrEqual(TOLERANCE.heapBytes);
      expect(to.nodes - from.nodes, message).toBeLessThanOrEqual(TOLERANCE.nodes);
      expect(to.listeners - from.listeners, message).toBeLessThanOrEqual(TOLERANCE.listeners);
    }
  });
});
