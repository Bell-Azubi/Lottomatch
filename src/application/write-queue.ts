import { signal, type ReadonlySignal } from '@preact/signals';

export type PersistenceProblem = 'QUOTA' | 'CONFLICT' | 'UNAVAILABLE' | 'UNKNOWN';

export interface PersistenceStatus {
  readonly pending: number;
  /** Set while the oldest job keeps failing; it is retried with backoff. */
  readonly problem?: PersistenceProblem;
  /** A conflicting writer (another window) makes further writes unsafe; nothing is retried. */
  readonly fatal: boolean;
}

export type Job = () => Promise<void>;

interface QueuedJob {
  readonly run: Job;
  readonly resolve: () => void;
}

/** Classifies a storage error for the persistent warning. */
export function classifyStorageError(error: unknown): PersistenceProblem {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError') return 'QUOTA';
  if (name === 'ConstraintError') return 'CONFLICT';
  if (name === 'InvalidStateError' || name === 'UnknownError' || name === 'NotFoundError')
    return 'UNAVAILABLE';
  return 'UNKNOWN';
}

export interface WriteQueueOptions {
  readonly sleep?: (ms: number) => Promise<void>;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly onError?: (error: unknown) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Ordered persistence queue (§6 commit pipeline). Jobs run strictly one after another; a failing
 * job is retried with exponential backoff while later jobs wait, so order is never broken.
 */
export class WriteQueue {
  private readonly jobs: QueuedJob[] = [];
  private running = false;
  private readonly state = signal<PersistenceStatus>({ pending: 0, fatal: false });
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly onError: (error: unknown) => void;
  private markFatal: () => void = () => undefined;
  private readonly fatal = new Promise<void>((resolve) => {
    this.markFatal = resolve;
  });

  constructor(options: WriteQueueOptions = {}) {
    this.sleep = options.sleep ?? defaultSleep;
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.onError = options.onError ?? (() => undefined);
  }

  /** Current status for the persistence indicator. */
  get status(): ReadonlySignal<PersistenceStatus> {
    return this.state;
  }

  /** Adds a job; the promise resolves once the job has completed successfully. */
  enqueue(run: Job): Promise<void> {
    return new Promise((resolve) => {
      this.jobs.push({ run, resolve });
      this.update();
      void this.drain();
    });
  }

  /** Resolves when every job queued so far has completed, or as soon as writing became unsafe. */
  flush(): Promise<void> {
    if (this.state.value.fatal || (this.jobs.length === 0 && !this.running))
      return Promise.resolve();
    return Promise.race([this.enqueue(() => Promise.resolve()), this.fatal]);
  }

  private update(patch: Partial<PersistenceStatus> = {}): void {
    this.state.value = { ...this.state.value, ...patch, pending: this.jobs.length };
  }

  private clearProblem(): void {
    const { problem: _resolved, ...rest } = this.state.value;
    this.state.value = { ...rest, pending: this.jobs.length };
  }

  private async drain(): Promise<void> {
    if (this.running || this.state.value.fatal) return;
    this.running = true;
    try {
      let job = this.jobs[0];
      while (job !== undefined) {
        const completed = await this.runWithRetry(job);
        if (!completed) return;
        this.jobs.shift();
        job.resolve();
        this.clearProblem();
        job = this.jobs[0];
      }
    } finally {
      this.running = false;
    }
  }

  /** Runs a job until it succeeds (true) or a conflict makes writing unsafe (false). */
  private async runWithRetry(job: QueuedJob): Promise<boolean> {
    let delay = this.baseDelayMs;
    for (;;) {
      try {
        await job.run();
        return true;
      } catch (error: unknown) {
        this.onError(error);
        const problem = classifyStorageError(error);
        if (problem === 'CONFLICT') {
          this.update({ problem, fatal: true });
          this.markFatal();
          return false;
        }
        this.update({ problem });
        await this.sleep(delay);
        delay = Math.min(delay * 2, this.maxDelayMs);
      }
    }
  }
}
