import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from '../router/router';
import { EventPage } from './EventPage';

const event = {
  slug: 'workshop-abc123',
  title: 'Workshop de React',
  description: 'Descrição',
  location: 'Auditório',
  startsAt: '2026-11-12T13:00:00.000Z',
  endsAt: '2026-11-12T15:00:00.000Z',
  capacity: 10,
  spotsLeft: 3,
  checkinPoints: 10,
  isOpen: true,
};

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => handler(url, init)));
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('EventPage', () => {
  it('valida o formulário antes de enviar', async () => {
    mockFetch(() => json({ event }));
    render(<RouterProvider><EventPage slug={event.slug} /></RouterProvider>);
    await screen.findByRole('heading', { name: 'Workshop de React' });
    expect(screen.getByText('3 de 10 vagas disponíveis')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar inscrição' }));
    expect(await screen.findByText('Informe seu nome.')).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('mostra a mensagem da API para inscrição duplicada', async () => {
    mockFetch((url, init) =>
      init?.method === 'POST'
        ? json({ error: 'already_registered', message: 'Este e-mail já está inscrito neste evento.' }, 409)
        : json({ event }),
    );
    render(<RouterProvider><EventPage slug={event.slug} /></RouterProvider>);
    await screen.findByRole('heading', { name: 'Workshop de React' });
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Ana Souza' } });
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'ana@exemplo.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar inscrição' }));
    await waitFor(() => expect(screen.getByText('Este e-mail já está inscrito neste evento.')).toBeInTheDocument());
  });
});
