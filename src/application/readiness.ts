import { findGaps, type Catalogue } from '../domain/catalogue';
import type { MatchSettings } from '../domain/settings';
import type { DisplayStatus } from './host-link';
import type { StoragePersistence } from './ports';
import type { PwaStatus } from './pwa';

export type ReadinessKey = 'prizes' | 'display' | 'offline' | 'backup' | 'wakeLock' | 'storage';
export type ReadinessState = 'DONE' | 'OPEN' | 'UNSUPPORTED';

export interface ReadinessItem {
  readonly key: ReadinessKey;
  readonly state: ReadinessState;
  /** Missing prizes for `prizes`; nothing for the others. */
  readonly count?: number;
  readonly lastBackupAt?: string;
}

export interface ReadinessInput {
  readonly settings: MatchSettings;
  readonly catalogue: Catalogue;
  readonly display: DisplayStatus;
  readonly pwa: PwaStatus;
  readonly lastBackupAt: string | undefined;
  readonly wakeLockSupported: boolean;
  readonly persistence: StoragePersistence;
}

/** Event-readiness checklist on the start page (FR-11). */
export function readiness(input: ReadinessInput): readonly ReadinessItem[] {
  const missing = findGaps(input.catalogue, input.settings.rounds).reduce(
    (sum, gap) => sum + gap.slots.length,
    0,
  );
  return [
    { key: 'prizes', state: missing === 0 ? 'DONE' : 'OPEN', count: missing },
    { key: 'display', state: input.display.connected && input.display.synced ? 'DONE' : 'OPEN' },
    {
      key: 'offline',
      state: !input.pwa.supported ? 'UNSUPPORTED' : input.pwa.offlineReady ? 'DONE' : 'OPEN',
    },
    {
      key: 'backup',
      state: input.lastBackupAt === undefined ? 'OPEN' : 'DONE',
      ...(input.lastBackupAt === undefined ? {} : { lastBackupAt: input.lastBackupAt }),
    },
    { key: 'wakeLock', state: input.wakeLockSupported ? 'DONE' : 'UNSUPPORTED' },
    {
      key: 'storage',
      state:
        input.persistence === 'PERSISTED'
          ? 'DONE'
          : input.persistence === 'UNSUPPORTED'
            ? 'UNSUPPORTED'
            : 'OPEN',
    },
  ];
}
