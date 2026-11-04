import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('permite copiar o link do ingresso e orienta a mantê-lo privado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    try {
      mockTicket();
      render(
        <RouterProvider>
          <TicketPage token="tok123" />
        </RouterProvider>,
      );
      await screen.findByRole('heading', { name: 'Workshop de React' });
      fireEvent.click(screen.getByRole('button', { name: 'Copiar link do ingresso' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Link copiado');
      expect(screen.getByRole('status')).toHaveTextContent('não compartilhe');
      expect(writeText).toHaveBeenCalledWith(window.location.href);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
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
