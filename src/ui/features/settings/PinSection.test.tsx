import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestHost, renderWithServices } from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import { PinSection } from './PinSection';

function type(label: string, value: string): void {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

function messages(): string[] {
  return toasts.value.map((toast) => toast.message);
}

beforeEach(() => {
  toasts.value = [];
});

describe('PIN', () => {
  it('states that the PIN is no security boundary', async () => {
    const test = await createTestHost();
    renderWithServices(<PinSection canEdit />, test);
    expect(screen.getByText(/Sie ist keine Sicherheitsgrenze/)).toBeInTheDocument();
    expect(screen.getByText('Keine PIN gesetzt.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Aktuelle PIN')).toBeNull();
  });

  it('validates and sets a new PIN', async () => {
    const test = await createTestHost();
    renderWithServices(<PinSection canEdit />, test);
    type('Neue PIN (4 bis 8 Ziffern)', '12a');
    type('Neue PIN wiederholen', '12b');
    fireEvent.click(screen.getByRole('button', { name: 'PIN setzen' }));
    expect(screen.getByText('Die PIN muss aus 4 bis 8 Ziffern bestehen.')).toBeInTheDocument();
    expect(screen.getByText('Die beiden Eingaben stimmen nicht überein.')).toBeInTheDocument();
    type('Neue PIN (4 bis 8 Ziffern)', '4711');
    type('Neue PIN wiederholen', '4711');
    fireEvent.click(screen.getByRole('button', { name: 'PIN setzen' }));
    expect(await screen.findByText('Eine PIN ist gesetzt.')).toBeInTheDocument();
    expect(messages()).toContain('PIN gespeichert');
    expect(test.pin.configured.value).toBe(true);
    expect(screen.getByLabelText('Neue PIN (4 bis 8 Ziffern)')).toHaveValue('');
  });

  it('changes the PIN only with the current PIN', async () => {
    const test = await createTestHost();
    await test.pin.set('1234');
    renderWithServices(<PinSection canEdit />, test);
    type('Aktuelle PIN', '0000');
    type('Neue PIN (4 bis 8 Ziffern)', '5678');
    type('Neue PIN wiederholen', '5678');
    fireEvent.click(screen.getByRole('button', { name: 'PIN ändern' }));
    expect(await screen.findByText('Die aktuelle PIN ist falsch.')).toBeInTheDocument();
    type('Aktuelle PIN', '1234');
    fireEvent.click(screen.getByRole('button', { name: 'PIN ändern' }));
    await waitFor(() => {
      expect(messages()).toContain('PIN gespeichert');
    });
    expect(await test.pin.verify('5678')).toBe(true);
  });

  it('removes the PIN with the current PIN', async () => {
    const test = await createTestHost();
    await test.pin.set('2468');
    renderWithServices(<PinSection canEdit />, test);
    type('Aktuelle PIN', '1111');
    fireEvent.click(screen.getByRole('button', { name: 'PIN entfernen' }));
    expect(await screen.findByText('Die aktuelle PIN ist falsch.')).toBeInTheDocument();
    type('Aktuelle PIN', '2468');
    fireEvent.click(screen.getByRole('button', { name: 'PIN entfernen' }));
    expect(await screen.findByText('Keine PIN gesetzt.')).toBeInTheDocument();
    expect(messages()).toContain('PIN entfernt');
  });

  it('is disabled without control of the game', async () => {
    const test = await createTestHost();
    renderWithServices(<PinSection canEdit={false} />, test);
    expect(screen.getByLabelText('Neue PIN (4 bis 8 Ziffern)')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'PIN setzen' })).toBeDisabled();
  });
});
