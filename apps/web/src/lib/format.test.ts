import { describe, expect, it } from 'vitest';
import { fromLocalInput, toLocalInput } from './format';

describe('conversão de datas do formulário', () => {
  it('faz ida e volta entre ISO e datetime-local', () => {
    const iso = new Date(2026, 10, 12, 14, 30).toISOString();
    const local = toLocalInput(iso);
    expect(local).toBe('2026-11-12T14:30');
    expect(fromLocalInput(local)).toBe(iso);
  });
  it('devolve vazio para valor inválido', () => {
    expect(fromLocalInput('')).toBe('');
    expect(fromLocalInput('não é data')).toBe('');
  });
});
