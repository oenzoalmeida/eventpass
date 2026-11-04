import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AdminEvent } from '@eventpass/shared';
import { RegistrationsPanel } from './RegistrationsPanel';

const mocks = vi.hoisted(() => ({
  cancelRegistration: vi.fn(),
  reload: vi.fn(),
}));
vi.mock('../lib/api', () => ({
  api: {
    registrations: vi.fn(),
    registrationsCsvUrl: (id: number) => `/api/admin/events/${id}/registrations.csv`,
    cancelRegistration: mocks.cancelRegistration,
  },
  ApiRequestError: class extends Error {},
}));
vi.mock('../lib/useAsync', () => ({
  useAsync: () => ({
    status: 'success',
    data: [{
      id: 7,
      participantName: 'Maria Silva',
      participantEmail: 'maria@example.test',
      createdAt: '2026-11-03T12:00:00Z',
      checkedInAt: null,
      points: 0,
      status: 'confirmed',
    }],
    reload: mocks.reload,
    error: null,
  }),
}));

const event = { id: 12, title: 'Evento de teste', checkins: 0 } as unknown as AdminEvent;

afterEach(() => {
  vi.restoreAllMocks();
  mocks.cancelRegistration.mockReset();
  mocks.reload.mockReset();
});

describe('RegistrationsPanel', () => {
  it('exposes the registration export and filters participants', () => {
    render(<RegistrationsPanel event={event} onChange={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Exportar CSV' }))
      .toHaveAttribute('href', '/api/admin/events/12/registrations.csv');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar participante' }), {
      target: { value: 'inexistente' },
    });
    expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
  });

  it('only cancels after confirmation, then refreshes data', async () => {
    const onChange = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mocks.cancelRegistration.mockResolvedValue(undefined);
    render(<RegistrationsPanel event={event} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar inscrição de Maria Silva' }));
    expect(mocks.cancelRegistration).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar inscrição de Maria Silva' }));
    await waitFor(() => expect(mocks.cancelRegistration).toHaveBeenCalledWith(12, 7));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
