import { describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS, type MigrationRegistry, type MigrationStep } from './migrations';

const registry: MigrationRegistry = {
  current: 3,
  steps: new Map<number, MigrationStep>([
    [1, (input) => ({ ...input, schemaVersion: 2, renamed: input['old'] })],
    [2, (input) => ({ ...input, schemaVersion: 3, added: true })],
  ]),
};

describe('migrate', () => {
  it('passes current documents through unchanged', () => {
    const input = { schemaVersion: MIGRATIONS.current, value: 1 };
    expect(migrate(input)).toEqual({ ok: true, value: input });
  });

  it('rejects unversioned or foreign input', () => {
    expect(migrate(null)).toEqual({ ok: false, error: { code: 'NOT_VERSIONED' } });
    expect(migrate([1, 2])).toEqual({ ok: false, error: { code: 'NOT_VERSIONED' } });
    expect(migrate({})).toEqual({ ok: false, error: { code: 'NOT_VERSIONED' } });
    expect(migrate({ schemaVersion: 1.5 })).toEqual({
      ok: false,
      error: { code: 'NOT_VERSIONED' },
    });
  });

  it('refuses newer and pre-release versions', () => {
    expect(migrate({ schemaVersion: 2 })).toEqual({
      ok: false,
      error: { code: 'TOO_NEW', version: 2 },
    });
    expect(migrate({ schemaVersion: 0 })).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED', version: 0 },
    });
  });

  it('runs forward migration steps in order', () => {
    expect(migrate({ schemaVersion: 1, old: 'x' }, registry)).toEqual({
      ok: true,
      value: { schemaVersion: 3, old: 'x', renamed: 'x', added: true },
    });
    expect(migrate({ schemaVersion: 2, old: 'y' }, registry)).toEqual({
      ok: true,
      value: { schemaVersion: 3, old: 'y', added: true },
    });
  });

  it('fails on a missing step or a step that does not advance the version', () => {
    const gap: MigrationRegistry = {
      current: 3,
      steps: new Map([[1, (input) => ({ ...input, schemaVersion: 2 })]]),
    };
    expect(migrate({ schemaVersion: 1 }, gap)).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED', version: 2 },
    });
    const stuck: MigrationRegistry = {
      current: 2,
      steps: new Map([[1, (input) => ({ ...input })]]),
    };
    expect(migrate({ schemaVersion: 1 }, stuck)).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED', version: 1 },
    });
  });
});
