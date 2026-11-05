import { fireEvent, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LateClaimPolicy, TiePolicy } from '../../../domain/settings';
import { present } from '../../../test/assert';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import { addClaimNumber, countReached, toWinnerInput } from './claim-model';
import { ClaimDialog } from './ClaimDialog';

let t: TestHost;
let closed = 0;

async function setup(
  numbers: readonly number[],
  policy: LateClaimPolicy = 'HOST_DECIDES',
  tie: TiePolicy = 'TIEBREAK',
) {
  t = await createTestHost();
  const session = t.app.session.value;
  if (session === undefined) throw new Error('no session');
  session.updateSettings(
    { ...session.match.value.settings, lateClaimPolicy: policy, tiePolicy: tie },
    [],
  );
  t.host.startRound();
  for (const number of numbers) t.host.drawManual(number);
  closed = 0;
  renderWithServices(<ClaimDialog open onClose={() => (closed += 1)} />, t);
}

function dialog() {
  return screen.getByRole('dialog');
}

function enter(numbers: readonly number[], cardNo?: string) {
  if (cardNo !== undefined)
    fireEvent.input(within(dialog()).getByLabelText('Kartennummer (optional)'), {
      target: { value: cardNo },
    });
  const field = within(dialog()).getByLabelText('Zahl auf der Karte');
  for (const number of numbers) {
    fireEvent.input(field, { target: { value: String(number) } });
    fireEvent.submit(present(field.closest('form'), 'form'));
  }
}

function round() {
  return t.app.session.value?.game.value.rounds.get(1);
}

afterEach(() => {
  t.hostLink.dispose();
});

describe('ClaimDialog (FR-6)', () => {
  beforeEach(() => {
    closed = 0;
  });

  it('confirms a valid card with its number and name', async () => {
    await setup([5, 12, 23, 34, 42]);
    enter([5, 12, 23, 34, 42], '117');
    expect(
      within(dialog()).getByText(/gültig seit Ziehung 5 \(Zahl 42\), aktuell Ziehung 5/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Gewinn bestätigen' }));
    fireEvent.input(within(dialog()).getByLabelText('Name (optional)'), {
      target: { value: 'Anna' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Gewinn bestätigen' }));
    expect(round()?.prizes[1].award?.winners).toEqual([
      { cardNo: '117', name: 'Anna', validSinceSeq: 5 },
    ]);
    expect(closed).toBe(1);
  });

  it('hints when the card already won earlier in the round', async () => {
    await setup([5, 12, 23, 34, 42]);
    expect(t.host.award({ winners: [{ cardNo: '117' }] }).ok).toBe(true);
    enter([5, 12, 23, 34, 42], '117');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Gewinn bestätigen' }));
    expect(
      within(dialog()).getByText('Karte 117 hat in dieser Runde bereits gewonnen.'),
    ).toBeInTheDocument();
  });

  it('rejects duplicates and out-of-range numbers as chips', async () => {
    await setup([1]);
    enter([1, 1]);
    expect(within(dialog()).getByText('1 ist schon erfasst.')).toBeInTheDocument();
    enter([95]);
    expect(within(dialog()).getByText('Nur Zahlen von 1 bis 90.')).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: '1 entfernen' }));
    expect(within(dialog()).getByText('0 von 5 Zahlen erfasst')).toBeInTheDocument();
  });

  it('records a false claim with the missing numbers and closes', async () => {
    await setup([1, 2, 3]);
    enter([1, 2, 3, 4, 5]);
    expect(within(dialog()).getByText('Fehlende Zahlen: 4, 5')).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Fehlmeldung erfassen' }));
    expect(round()?.rejectedClaims).toBe(1);
    expect(closed).toBe(1);
  });

  it('lets the host decide on a late claim', async () => {
    await setup([1, 2, 3, 4, 5, 6]);
    enter([1, 2, 3, 4, 5]);
    expect(
      within(dialog()).getByText(/gültig seit Ziehung 5 \(Zahl 5\), aktuell Ziehung 6/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Ablehnen' }));
    expect(round()?.rejectedClaims).toBe(1);
  });

  it('applies the rejecting late-claim policy', async () => {
    await setup([1, 2, 3, 4, 5, 6], 'REJECT');
    enter([1, 2, 3, 4, 5]);
    expect(
      within(dialog()).getByText('Verspätete Meldungen werden abgelehnt (Einstellung).'),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Fehlmeldung erfassen' }));
    expect(round()?.rejectedClaims).toBe(1);
  });

  it('runs a Stechen between two valid cards until one wins (FR-7)', async () => {
    await setup([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    enter([1, 2, 3, 4, 5], 'A');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Zulassen' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Weitere Karte prüfen' }));
    enter([6, 7, 8, 9, 10], 'B');
    expect(within(dialog()).getByText(/gültig seit Ziehung 10 \(Zahl 10\)/)).toBeInTheDocument();
    const confirmButtons = within(dialog()).getAllByRole('button', { name: 'Gewinn bestätigen' });
    fireEvent.click(present(confirmButtons[0]));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Stechen ziehen' }));
    for (let pass = 0; pass < 20; pass += 1) {
      const again = within(dialog()).queryByRole('button', {
        name: 'Gleichstand – nochmals ziehen',
      });
      if (again === null) break;
      fireEvent.click(again);
    }
    expect(within(dialog()).getByText(/gewinnt das Stechen/)).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Gewinn bestätigen' }));
    const award = round()?.prizes[1].award;
    expect(award?.claimants).toHaveLength(2);
    expect(award?.winners).toHaveLength(1);
    expect(award?.tiebreak?.length).toBeGreaterThanOrEqual(2);
  });

  it('shares the prize between unchecked cards when the event says Teilen', async () => {
    await setup([1], 'HOST_DECIDES', 'SHARE');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Ohne Prüfung bestätigen' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Weitere Karte prüfen' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Ohne Prüfung bestätigen' }));
    expect(
      within(dialog()).getByText('Einstellung «Teilen»: Alle gültigen Karten gewinnen gemeinsam.'),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Zurück zur Prüfung' }));
    const confirm = within(dialog()).getAllByRole('button', { name: 'Gewinn bestätigen' });
    fireEvent.click(present(confirm.at(-1)));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Gewinn bestätigen' }));
    expect(round()?.prizes[1].award?.winners).toHaveLength(2);
  });

  it('cancels without changes', async () => {
    await setup([1]);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));
    expect(closed).toBe(1);
    expect(round()?.prizes[1].status).toBe('OPEN');
  });
});

describe('claim model', () => {
  it('parses chips and builds winners', () => {
    expect(addClaimNumber([], 'x', 90)).toEqual({ ok: false, error: { code: 'NOT_A_NUMBER' } });
    expect(addClaimNumber([], '07', 90)).toEqual({ ok: true, value: [7] });
    expect(countReached([1], undefined)).toBe(true);
    expect(countReached([1], 5)).toBe(false);
    expect(toWinnerInput({ id: 1, cardNo: '9' }, undefined)).toEqual({
      cardNo: '9',
      name: undefined,
      note: undefined,
      validSinceSeq: undefined,
    });
  });
});
