import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AdminEvent } from '@eventpass/shared';
import { CheckinPanel } from './CheckinPanel';

const mocks = vi.hoisted(() => ({ checkin: vi.fn() }));
vi.mock('../lib/api', () => ({
  api: { checkin: mocks.checkin },
  ApiRequestError: class extends Error {},
}));
vi.mock('./QrScanner', () => ({
  QrScanner: ({ onScan }: { onScan: (token: string) => void }) => (
    <button onClick={() => { onScan('qr-one'); onScan('qr-two'); }}>Simular leitura dupla</button>
  ),
}));

const event = { id: 4, status: 'published', checkins: 0, registrations: 2 } as unknown as AdminEvent;
afterEach(() => { mocks.checkin.mockReset(); });

describe('CheckinPanel concurrent submissions', () => {
  it('submits only once when two QR readings arrive in the same render', async () => {
    let resolve!: (v: unknown) => void;
    mocks.checkin.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const onCheckin = vi.fn();
    render(<CheckinPanel event={event} onCheckin={onCheckin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Simular leitura dupla' }));
    expect(mocks.checkin).toHaveBeenCalledTimes(1);
    expect(mocks.checkin).toHaveBeenCalledWith(4, 'qr-one');
    await act(async () => {
      resolve({
        alreadyCheckedIn: false,
        participantName: 'Maria',
        participantEmail: 'maria@example.test',
        checkedInAt: '2026-11-04T10:00:00Z',
        pointsAwarded: 10,
        totalPoints: 10,
      });
    });
    await waitFor(() => expect(onCheckin).toHaveBeenCalledTimes(1));
  });
  it('retains the manual token after an API failure so the operator can retry', async () => {
    mocks.checkin.mockRejectedValueOnce(new Error('network unavailable'));
    render(<CheckinPanel event={event} onCheckin={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Código ou link do ingresso' });
    fireEvent.change(input, { target: { value: 'qr-to-retry' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.checkin).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(input).toHaveValue('qr-to-retry'));
    expect(screen.getByText('Falha ao registrar presença.')).toBeInTheDocument();
  });

});
