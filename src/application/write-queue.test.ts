import { describe, expect, it, vi } from 'vitest';
import { classifyStorageError, WriteQueue } from './write-queue';

const named = (name: string) => Object.assign(new Error(name), { name });

describe('WriteQueue', () => {
  it('runs jobs strictly in order', async () => {
    const queue = new WriteQueue();
    const order: number[] = [];
    const slow = () => new Promise<void>((resolve) => setTimeout(resolve, 10));
    void queue.enqueue(async () => {
      await slow();
      order.push(1);
    });
    void queue.enqueue(() => {
      order.push(2);
      return Promise.resolve();
    });
    await queue.flush();
    expect(order).toEqual([1, 2]);
    expect(queue.status.value).toEqual({ pending: 0, fatal: false });
  });

  it('retries a failing job with exponential backoff and keeps later jobs waiting', async () => {
    const delays: number[] = [];
    const queue = new WriteQueue({
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
      baseDelayMs: 100,
      maxDelayMs: 300,
      onError: vi.fn(),
    });
    let attempts = 0;
    const order: string[] = [];
    void queue.enqueue(() => {
      attempts += 1;
      if (attempts < 4) return Promise.reject(named('QuotaExceededError'));
      order.push('first');
      return Promise.resolve();
    });
    void queue.enqueue(() => {
      order.push('second');
      return Promise.resolve();
    });
    await queue.flush();
    expect(delays).toEqual([100, 200, 300]);
    expect(order).toEqual(['first', 'second']);
    expect(queue.status.value.problem).toBeUndefined();
  });

  it('keeps the warning while a job fails, even when new jobs arrive', async () => {
    let release: () => void = () => undefined;
    const queue = new WriteQueue({
      sleep: () => new Promise<void>((resolve) => (release = resolve)),
    });
    let fail = true;
    void queue.enqueue(() => (fail ? Promise.reject(named('UnknownError')) : Promise.resolve()));
    await vi.waitFor(() => {
      expect(queue.status.value.problem).toBe('UNAVAILABLE');
    });
    void queue.enqueue(() => Promise.resolve());
    expect(queue.status.value.problem).toBe('UNAVAILABLE');
    expect(queue.status.value.pending).toBe(2);
    fail = false;
    release();
    await queue.flush();
    expect(queue.status.value.problem).toBeUndefined();
  });

  it('stops for good on a conflicting writer and lets flush return', async () => {
    const queue = new WriteQueue();
    void queue.enqueue(() => Promise.reject(named('ConstraintError')));
    await queue.flush();
    expect(queue.status.value).toMatchObject({ fatal: true, problem: 'CONFLICT' });
    await expect(queue.flush()).resolves.toBeUndefined();
  });

  it('classifies storage errors', () => {
    expect(classifyStorageError(new DOMException('x', 'QuotaExceededError'))).toBe('QUOTA');
    expect(classifyStorageError(named('ConstraintError'))).toBe('CONFLICT');
    expect(classifyStorageError(named('InvalidStateError'))).toBe('UNAVAILABLE');
    expect(classifyStorageError('boom')).toBe('UNKNOWN');
  });
});
