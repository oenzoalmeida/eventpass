import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('falha proposital de renderização');
}

describe('ErrorBoundary', () => {
  it('renderiza os filhos quando nada falha', () => {
    render(
      <ErrorBoundary>
        <p>conteúdo normal</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('conteúdo normal')).toBeInTheDocument();
  });

  it('mostra uma saída amigável em vez de tela em branco quando um filho quebra', () => {
    // O console.error do React é esperado aqui; silencia só neste teste.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado');
    expect(screen.getByRole('button', { name: 'Recarregar página' })).toBeInTheDocument();
    spy.mockRestore();
  });
});
