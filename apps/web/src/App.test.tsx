import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { App } from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthProvider } from './auth/AuthProvider';
import { RouterProvider } from './router/router';

// Regressão: o grupo de ações do header precisa permitir quebra de linha
// (flex-wrap) para não estourar a largura em telas estreitas (~390px)
// quando autenticado (Painel + nome + Sair + seletor de tema).
describe('header responsivo', () => {
  it('grupo de ações do header permite wrap e limita o gap no mobile', () => {
    const { container } = render(
      <ThemeProvider>
        <RouterProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </RouterProvider>
      </ThemeProvider>,
    );
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
    const actions = [...header!.querySelectorAll('div')].find((d) =>
      d.className.includes('justify-end'),
    );
    expect(actions?.className).toContain('flex-wrap');
    expect(actions?.className).toContain('gap-2');
  });
});
