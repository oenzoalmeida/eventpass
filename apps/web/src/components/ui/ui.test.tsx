import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';
import { ThemeToggle } from './ThemeToggle';
import { ThemeProvider } from '../../theme/ThemeProvider';

describe('Input', () => {
  it('associa rótulo e erro ao campo', () => {
    render(<Input label="E-mail" error="Obrigatório" />);
    const field = screen.getByLabelText('E-mail');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Obrigatório');
  });
});

describe('ThemeToggle', () => {
  it('aplica a classe dark ao escolher o tema escuro', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Escuro' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Escuro' })).toHaveAttribute('aria-pressed', 'true');
  });
});
