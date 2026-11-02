import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider } from '../router/router';
import { DemoPage } from './DemoPage';

afterEach(() => vi.unstubAllGlobals());

describe('DemoPage', () => {
  it('mostra a jornada completa marcada como fictícia, sem chamar a API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(
      <RouterProvider>
        <DemoPage />
      </RouterProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Como funciona' })).toBeInTheDocument();
    expect(screen.getByText('Demonstração com dados fictícios')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Encontre um evento aberto' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Inscreva-se com nome e e-mail' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Guarde o ingresso com QR Code' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Faça check-in e pontue no ranking' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Fictício')).toHaveLength(4);
    expect(screen.getByRole('img', { name: /QR Code de exemplo/ })).toBeInTheDocument();
    // Não promete envio de e-mail e deixa claro que o link é a entrada.
    expect(screen.getByText(/Não é enviado e-mail/)).toBeInTheDocument();
    // Página 100% estática: nenhuma chamada de rede.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
