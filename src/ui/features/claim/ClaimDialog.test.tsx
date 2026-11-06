import { fireEvent, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import type { TiePolicy } from '../../../domain/settings';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import { ClaimDialog } from './ClaimDialog';

let t: TestHost;
let closed = 0;

async function setup(tie: TiePolicy = 'TIEBREAK') {
  t = await createTestHost();
  const session = t.app.session.value;
  if (session === undefined) throw new Error('no session');
  session.updateSettings({ ...session.match.value.settings, tiePolicy: tie }, []);
  t.host.startRound();
  t.host.drawManual(5);
  closed = 0;
  renderWithServices(<ClaimDialog open onClose={() => (closed += 1)} />, t);
}

function dialog() {
  return screen.getByRole('dialog');
}

function button(name: string) {
  return within(dialog()).getByRole('button', { name });
}

function typeInto(field: HTMLElement, value: string) {
  fireEvent.input(field, { target: { value } });
}

function cardFields() {
  return within(dialog()).getAllByLabelText('Kartennummer (optional)');
}

function round() {
  return t.app.session.value?.game.value.rounds.get(1);
}

afterEach(() => {
  t.hostLink.dispose();
});

describe('ClaimDialog (FR-6, ADR-0025)', () => {
  it('opens directly on Gewinn bestätigen, without a number check', async () => {
    await setup();
    expect(dialog()).toHaveTextContent('Gewinn bestätigen: Preis 1 · 1 Reihe');
    expect(within(dialog()).queryByLabelText('Zahl auf der Karte')).not.toBeInTheDocument();
    expect(cardFields()).toHaveLength(1);
    expect(round()?.prizes[1].status).toBe('OPEN');
  });

  it('awards only when the win is confirmed, with card number, name and note', async () => {
    await setup();
    typeInto(within(dialog()).getByLabelText('Kartennummer (optional)'), '117');
    typeInto(within(dialog()).getByLabelText('Name (optional)'), 'Anna');
    typeInto(within(dialog()).getByLabelText('Notiz (optional)'), 'Tisch 4');
    expect(round()?.prizes[1].status).toBe('OPEN');
    fireEvent.click(button('Gewinn bestätigen'));
    expect(round()?.prizes[1].award?.winners).toEqual([
      { cardNo: '117', name: 'Anna', note: 'Tisch 4' },
    ]);
    expect(closed).toBe(1);
  });

  it('confirms a win without any details', async () => {
    await setup();
    fireEvent.click(button('Gewinn bestätigen'));
    expect(round()?.prizes[1].award?.winners).toEqual([{}]);
  });

  it('hints when the card already won earlier in the round', async () => {
    await setup();
    expect(t.host.award({ winners: [{ cardNo: '117' }] }).ok).toBe(true);
    typeInto(within(dialog()).getByLabelText('Kartennummer (optional)'), '117');
    expect(
      within(dialog()).getByText('Karte 117 hat in diesem Gang bereits gewonnen.'),
    ).toBeInTheDocument();
  });

  it('runs a Stechen between two cards before the win can be confirmed (FR-7)', async () => {
    await setup();
    fireEvent.click(button('Weitere Karte'));
    const [first, second] = cardFields();
    if (first === undefined || second === undefined) throw new Error('two cards expected');
    typeInto(first, 'A');
    typeInto(second, 'B');
    expect(button('Gewinn bestätigen')).toBeDisabled();
    fireEvent.click(button('Stechen ziehen'));
    expect(within(dialog()).queryByRole('button', { name: 'Weitere Karte' })).toBeNull();
    expect(within(dialog()).queryByRole('button', { name: 'Karte entfernen' })).toBeNull();
    for (let pass = 0; pass < 20; pass += 1) {
      const again = within(dialog()).queryByRole('button', {
        name: 'Gleichstand – nochmals ziehen',
      });
      if (again === null) break;
      fireEvent.click(again);
    }
    expect(within(dialog()).getByText(/\((A|B)\) gewinnt das Stechen/)).toBeInTheDocument();
    typeInto(within(dialog()).getByLabelText('Name (optional)'), 'Anna');
    fireEvent.click(button('Gewinn bestätigen'));
    const award = round()?.prizes[1].award;
    expect(award?.claimants?.map((claimant) => claimant.cardNo)).toEqual(['A', 'B']);
    expect(award?.winners).toHaveLength(1);
    expect(award?.winners[0]?.name).toBe('Anna');
    expect(award?.tiebreak?.length).toBeGreaterThanOrEqual(2);
  });

  it('removes a card added by mistake, so no Stechen is needed', async () => {
    await setup();
    fireEvent.click(button('Weitere Karte'));
    expect(button('Gewinn bestätigen')).toBeDisabled();
    const [removeFirst] = within(dialog()).getAllByRole('button', { name: 'Karte entfernen' });
    if (removeFirst === undefined) throw new Error('remove button expected');
    fireEvent.click(removeFirst);
    expect(cardFields()).toHaveLength(1);
    expect(within(dialog()).queryByRole('button', { name: 'Stechen ziehen' })).toBeNull();
    fireEvent.click(button('Gewinn bestätigen'));
    expect(round()?.prizes[1].status).toBe('AWARDED');
  });

  it('shares the prize between cards when the event says Teilen', async () => {
    await setup('SHARE');
    fireEvent.click(button('Weitere Karte'));
    expect(
      within(dialog()).getByText('Einstellung «Teilen»: Alle gültigen Karten gewinnen gemeinsam.'),
    ).toBeInTheDocument();
    const [first, second] = cardFields();
    if (first === undefined || second === undefined) throw new Error('two cards expected');
    typeInto(first, 'A');
    typeInto(second, 'B');
    fireEvent.click(button('Gewinn bestätigen'));
    expect(round()?.prizes[1].award?.winners).toEqual([{ cardNo: 'A' }, { cardNo: 'B' }]);
  });

  it('cancels without changes', async () => {
    await setup();
    fireEvent.click(button('Abbrechen'));
    expect(closed).toBe(1);
    expect(round()?.prizes[1].status).toBe('OPEN');
  });
});
