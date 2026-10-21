import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tabs } from './Tabs';

function Harness() {
  const [v, setV] = useState('a');
  return (
    <Tabs
      label="Seções"
      value={v}
      onChange={setV}
      items={[
        { id: 'a', label: 'Primeira', content: <p>Conteúdo A</p> },
        { id: 'b', label: 'Segunda', content: <p>Conteúdo B</p> },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('troca de aba com as setas do teclado', () => {
    render(<Harness />);
    const first = screen.getByRole('tab', { name: 'Primeira' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Conteúdo A')).toBeVisible();

    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const second = screen.getByRole('tab', { name: 'Segunda' });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Conteúdo B');
  });
});
