import { fireEvent, render, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrizeEditor } from '../../../application/prize-editor';
import { prizeAt } from '../../../domain/catalogue';
import { prizes as m } from '../../../i18n/de-CH/prizes';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import { BulkTools } from './BulkTools';
import { PrintList } from './PrintList';

const draft = {
  description: '',
  valueChf: undefined,
  sponsor: '',
  imageId: undefined,
  winCondition: { kind: 'FULL_CARD' as const },
};

async function setup(): Promise<TestHost & { editor: PrizeEditor }> {
  const host = await createTestHost();
  const editor = new PrizeEditor(host.app);
  editor.savePrize(1, 1, { ...draft, title: 'Zopf' });
  renderWithServices(<BulkTools editor={editor} rounds={24} selected={1} readOnly={false} />, host);
  return { ...host, editor };
}

function prizes(host: TestHost) {
  const session = host.app.session.value;
  if (session === undefined) throw new Error('no session');
  return session.catalogue.value;
}

beforeEach(() => {
  toasts.value = [];
});

describe('BulkTools', () => {
  it('copies a round after validating the target list', async () => {
    const host = await setup();
    fireEvent.click(screen.getByRole('button', { name: m.bulk.copy }));
    fireEvent.input(screen.getByLabelText(m.bulk.copyTo), { target: { value: 'zwei' } });
    fireEvent.click(screen.getByRole('button', { name: m.bulk.copyConfirm }));
    expect(screen.getByText(m.bulk.roundsInvalid)).toBeInTheDocument();
    fireEvent.input(screen.getByLabelText(m.bulk.copyTo), { target: { value: '2-3' } });
    fireEvent.click(screen.getByRole('button', { name: m.bulk.copyConfirm }));
    expect(prizeAt(prizes(host), 3, 1)?.title).toBe('Zopf');
    expect(toasts.value.at(-1)?.message).toBe(m.bulk.copied(2));
  });

  it('applies the template and reports skipped awarded prizes', async () => {
    const host = await setup();
    host.host.startRound();
    host.host.award({ winners: [{}] });
    host.editor.savePrize(2, 1, { ...draft, title: 'Wein' });
    fireEvent.click(screen.getByRole('button', { name: m.bulk.template }));
    fireEvent.click(screen.getByRole('button', { name: m.bulk.templateConfirm }));
    expect(prizeAt(prizes(host), 2, 1)?.winCondition).toEqual({ kind: 'ONE_LINE' });
    expect(prizeAt(prizes(host), 1, 1)?.winCondition).toEqual({ kind: 'FULL_CARD' });
    expect(toasts.value.at(-1)?.message).toBe(`${m.bulk.templated}. ${m.bulk.skipped(1)}`);
  });

  it('clears the chosen round', async () => {
    const host = await setup();
    fireEvent.click(screen.getByRole('button', { name: m.bulk.clear }));
    fireEvent.click(screen.getByRole('button', { name: m.bulk.clearConfirm }));
    expect(prizes(host).prizes).toEqual([]);
    expect(toasts.value.at(-1)?.message).toBe(m.bulk.cleared(1));
  });

  it('shows editor errors as toasts', async () => {
    const host = await setup();
    host.app.setWriteGuard(() => false);
    fireEvent.click(screen.getByRole('button', { name: m.bulk.clear }));
    fireEvent.click(screen.getByRole('button', { name: m.bulk.clearConfirm }));
    expect(toasts.value.at(-1)).toMatchObject({ message: m.errors.READ_ONLY, tone: 'error' });
  });
});

describe('PrintList', () => {
  it('renders every round with titles, gaps and values for print', async () => {
    const host = await createTestHost();
    const session = host.app.session.value;
    if (session === undefined) throw new Error('no session');
    const catalogue = {
      prizes: [
        {
          id: 'a',
          round: 1,
          slot: 1 as const,
          title: 'Zopf',
          valueChf: 25,
          sponsor: 'Bäckerei Muster',
          winCondition: { kind: 'ONE_LINE' as const },
        },
        {
          id: 'b',
          round: 2,
          slot: 5 as const,
          title: 'Grosser Früchtekorb',
          winCondition: { kind: 'FULL_CARD' as const },
        },
      ],
    };
    const { container } = render(
      <PrintList
        settings={session.match.value.settings}
        catalogue={catalogue}
        printedAt="2026-11-07T19:00:00.000Z"
      />,
    );
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('hidden');
    expect(container.textContent).toContain(m.print.heading('Lottomatch'));
    expect(container.textContent).toContain('Zopf');
    expect(container.textContent).toContain(m.print.sponsor('Bäckerei Muster'));
    expect(container.textContent).toContain('Preis 4');
    expect(container.querySelectorAll('h2')).toHaveLength(24);
    const rowsOf = (index: number) => container.querySelectorAll('table')[index]?.rows.length;
    expect(rowsOf(0)).toBe(4);
    expect(rowsOf(1)).toBe(5);
    expect(container.textContent).toContain('Grosser Früchtekorb');
    expect(container.querySelectorAll('table')[1]?.textContent).toContain('Superlotto');
  });
});
