import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider } from '../router/router';
import { TicketPage } from './TicketPage';

const ticket = {
  event: {
    slug: 'workshop-abc123',
    title: 'Workshop de React',
    location: 'Auditório',
    startsAt: '2026-11-12T13:00:00.000Z',
    endsAt: '2026-11-12T15:00:00.000Z',
  },
  participantName: 'Ana Souza',
  status: 'confirmed',
  checkedInAt: null,
  qrSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
};

afterEach(() => vi.unstubAllGlobals());

function mockTicket(body: unknown = { ticket }, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
}

describe('TicketPage', () => {
  it('oferece impressão/PDF e orienta a guardar o link sem insinuar envio de e-mail', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    mockTicket();
    render(
      <RouterProvider>
        <TicketPage token="tok123" />
      </RouterProvider>,
    );
    await screen.findByRole('heading', { name: 'Workshop de React' });

    expect(screen.getByText(/Não enviamos o ingresso por e-mail/)).toBeInTheDocument();
    expect(screen.queryByText(/enviamos (o )?ingresso (para|por) e-mail(?!:)/i)).toBeNull();

    const botao = screen.getByRole('button', { name: 'Imprimir ou salvar em PDF' });
    botao.click();
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('não oferece impressão para ingresso cancelado', async () => {
    mockTicket({ ticket: { ...ticket, status: 'cancelled' } });
    render(
      <RouterProvider>
        <TicketPage token="tok123" />
      </RouterProvider>,
    );
    await screen.findByText(/Inscrição cancelada/);
    expect(screen.queryByRole('button', { name: 'Imprimir ou salvar em PDF' })).toBeNull();
  });
});
