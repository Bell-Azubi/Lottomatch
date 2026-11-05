import { describe, expect, it } from 'vitest';
import { createTestHost } from '../test/test-platform';

describe('AppStore boot', () => {
  it('creates a default event on first run and opens it', async () => {
    const { app } = await createTestHost();
    expect(app.phase.value.kind).toBe('READY');
    expect(app.matches.value).toHaveLength(1);
    const session = app.session.value;
    expect(session?.match.value.settings.name).toBe('Lottomatch');
    expect(session?.match.value.settings.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(app.persistence.value).toBe('PERSISTED');
  });

  it('draws, persists and replays through the commit pipeline', async () => {
    const { app, host, platform } = await createTestHost();
    expect(host.startRound().ok).toBe(true);
    expect(host.spin().ok).toBe(true);
    await app.queue.flush();
    const stored = await platform.events.load(app.session.value?.matchId ?? '');
    expect(stored).toHaveLength(2);
    await app.reloadActive();
    expect(app.session.value?.game.value.rounds.get(1)?.draws).toHaveLength(1);
  });
});
