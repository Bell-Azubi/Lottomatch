import { act, fireEvent, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prizes as m } from '../../../i18n/de-CH/prizes';
import { PREPARED_EVENT } from '../../../test/prepared-event-fixture';
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
        'events/index.json': '[{"file":"anlass.json","name":"Anlass"}]',
        'events/anlass.json': PREPARED_EVENT,
      }),
    });
    const before = host.app.session.value?.matchId;
    renderWithServices(<PreparedEvents readOnly={false} />, host);
    fireEvent.click(await screen.findByRole('button', { name: m.prepared.open }));
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

  it('has no button while no file is shipped', async () => {
    const fetchText = serve({ 'events/index.json': '[]' });
    const host = await createTestHost({ fetchText });
    renderWithServices(<PreparedEvents readOnly={false} />, host);
    await vi.waitFor(() => {
      expect(fetchText).toHaveBeenCalled();
    });
    await act(() => Promise.resolve());
    expect(screen.queryByRole('button', { name: m.prepared.open })).toBeNull();
  });

  it('explains an unavailable list', async () => {
    const host = await createTestHost({ fetchText: serve({}) });
    renderWithServices(<PreparedEvents readOnly={false} />, host);
    fireEvent.click(await screen.findByRole('button', { name: m.prepared.open }));
    expect(await screen.findByRole('alert')).toHaveTextContent(m.prepared.unavailable);
  });

  it('explains a list that became empty after the page opened', async () => {
    const fetchText = vi
      .fn<(path: string) => Promise<string>>()
      .mockResolvedValueOnce('[{"file":"a.json","name":"A"}]')
      .mockResolvedValue('[]');
    const host = await createTestHost({ fetchText });
    renderWithServices(<PreparedEvents readOnly={false} />, host);
    fireEvent.click(await screen.findByRole('button', { name: m.prepared.open }));
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
    fireEvent.click(await screen.findByRole('button', { name: m.prepared.open }));
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
