import { fireEvent, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import exampleEvent from '../../../../public/events/beispiel-lottomatch.json?raw';
import manifestText from '../../../../public/events/index.json?raw';
import { prizes as m } from '../../../i18n/de-CH/prizes';
import { createTestHost, renderWithServices } from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import { importErrorText, PreparedEvents } from './PreparedEvents';

function serve(files: Readonly<Record<string, string>>) {
  return vi.fn((path: string) => {
    const text = files[path];
    return text === undefined ? Promise.reject(new Error('404')) : Promise.resolve(text);
  });
}

beforeEach(() => {
  toasts.value = [];
});

describe('PreparedEvents', () => {
  it('lists, previews and loads a prepared event as a new active event', async () => {
    const host = await createTestHost({
      fetchText: serve({
        'events/index.json': manifestText,
        'events/beispiel-lottomatch.json': exampleEvent,
      }),
    });
    const before = host.app.session.value?.matchId;
    renderWithServices(<PreparedEvents readOnly={false} />, host);
    fireEvent.click(screen.getByRole('button', { name: m.prepared.open }));
    fireEvent.click(await screen.findByRole('button', { name: m.prepared.preview }));
    expect(await screen.findByText(m.prepared.facts(24, 96))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.click(await screen.findByRole('button', { name: m.prepared.preview }));
    fireEvent.click(await screen.findByRole('button', { name: m.prepared.confirm }));
    await vi.waitFor(() => {
      expect(host.app.session.value?.matchId).not.toBe(before);
    });
    expect(toasts.value.at(-1)?.message).toBe(m.prepared.loaded('Lottomatch 2026 (Beispiel)'));
  });

  it('explains an unavailable or empty list and broken files', async () => {
    const host = await createTestHost({ fetchText: serve({}) });
    renderWithServices(<PreparedEvents readOnly={false} />, host);
    fireEvent.click(screen.getByRole('button', { name: m.prepared.open }));
    expect(await screen.findByRole('alert')).toHaveTextContent(m.prepared.unavailable);

    const empty = await createTestHost({ fetchText: serve({ 'events/index.json': '[]' }) });
    renderWithServices(<PreparedEvents readOnly={false} />, empty);
    fireEvent.click(screen.getAllByRole('button', { name: m.prepared.open })[1] ?? document.body);
    expect(await screen.findByText(m.prepared.none)).toBeInTheDocument();
  });

  it('shows import errors of a prepared file', async () => {
    const host = await createTestHost({
      fetchText: serve({
        'events/index.json': '[{"file":"kaputt.json","name":"Kaputt"}]',
        'events/kaputt.json': '{ nicht json',
      }),
    });
    renderWithServices(<PreparedEvents readOnly={false} />, host);
    fireEvent.click(screen.getByRole('button', { name: m.prepared.open }));
    fireEvent.click(await screen.findByRole('button', { name: m.prepared.preview }));
    expect(await screen.findByRole('alert')).toHaveTextContent(m.prepared.importErrors.NOT_JSON);
  });

  it('maps every import error to a message', () => {
    expect(importErrorText({ code: 'INVALID', path: 'prizes.3' }, m)).toBe(
      m.prepared.importErrors.INVALID('prizes.3'),
    );
    expect(importErrorText({ code: 'INVALID_PRIZES', count: 2 }, m)).toBe(
      m.prepared.importErrors.INVALID_PRIZES(2),
    );
    expect(importErrorText({ code: 'LOG_CORRUPT', seq: 7 }, m)).toBe(
      m.prepared.importErrors.LOG_CORRUPT(7),
    );
    expect(importErrorText({ code: 'TOO_NEW', version: 9 }, m)).toBe(
      m.prepared.importErrors.TOO_NEW,
    );
    expect(importErrorText({ code: 'CHECKSUM_MISMATCH' }, m)).toBe(
      m.prepared.importErrors.CHECKSUM_MISMATCH,
    );
  });
});
