import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

const stored = await hashPassword('senha-segura-123');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('password', () => {
  it('hasheia e verifica a senha', async () => {
    expect(await verifyPassword('senha-segura-123', stored)).toBe(true);
    expect(await verifyPassword('outra-senha', stored)).toBe(false);
  });

  it('aceita hash com outro custo, como os criados pelos testes', async () => {
    vi.stubEnv('EP_SCRYPT_N', '4096');
    vi.resetModules();
    const { hashPassword, verifyPassword } = await import('./password.js');
    const low = await hashPassword('senha-segura-123');
    expect(low.startsWith('scrypt$4096$')).toBe(true);
    expect(await verifyPassword('senha-segura-123', low)).toBe(true);
  });

  it('ignora EP_SCRYPT_N em produção', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('EP_SCRYPT_N', '4096');
    vi.resetModules();
    const { hashPassword } = await import('./password.js');
    const hash = await hashPassword('senha-segura-123');
    expect(hash.startsWith(`scrypt$${2 ** 17}$`)).toBe(true);
  });
});
