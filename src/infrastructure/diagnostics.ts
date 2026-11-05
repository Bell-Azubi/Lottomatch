import type { DiagnosticEntry, Diagnostics } from '../application/platform';

const STORAGE_KEY = 'lottomatch-live:diagnostics';
const CAPACITY = 200;

function describe(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack === undefined ? {} : { stack: error.stack }),
    };
  }
  return {
    name: 'NonError',
    message: typeof error === 'string' ? error : String(error),
  };
}

/**
 * Local ring buffer of unexpected errors (exportable from Einstellungen → Über). It never leaves
 * the device and holds no personal data: only error names, messages and stacks.
 */
export class DiagnosticsLog implements Diagnostics {
  private readonly entries: DiagnosticEntry[];

  constructor(private readonly storage: Storage | undefined) {
    this.entries = this.restore();
  }

  private restore(): DiagnosticEntry[] {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const parsed: unknown = raw === null || raw === undefined ? [] : JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as DiagnosticEntry[]).slice(-CAPACITY) : [];
    } catch {
      return [];
    }
  }

  record(error: unknown, context: string): void {
    const entry: DiagnosticEntry = { at: new Date().toISOString(), context, ...describe(error) };
    this.entries.push(entry);
    if (this.entries.length > CAPACITY) this.entries.splice(0, this.entries.length - CAPACITY);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // Storage unavailable or full: keep the in-memory buffer only.
    }
  }

  list(): readonly DiagnosticEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries.splice(0);
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }
}
