import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { TEST_ADMIN, seedAdmin, setupTestApp } from '../test-utils.js';

let app: FastifyInstance;

beforeEach(async () => {
  const ctx = await setupTestApp();
  app = ctx.app;
  await seedAdmin(ctx.db);
});
afterEach(async () => app.close());

const login = (email: string, password: string) =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });

function sessionCookie(res: Awaited<ReturnType<typeof login>>) {
  const c = res.cookies.find((c) => c.name === 'ep_session');
  return c ? `ep_session=${c.value}` : '';
}

describe('autenticação administrativa', () => {
  it('faz login, consulta /me e sai', async () => {
    const res = await login(TEST_ADMIN.email.toUpperCase(), TEST_ADMIN.password);
    expect(res.statusCode).toBe(200);
    expect(res.json().admin.email).toBe(TEST_ADMIN.email);

    const c = res.cookies.find((c) => c.name === 'ep_session');
    expect(c?.httpOnly).toBe(true);
    expect(c?.sameSite).toBe('Strict');

    const cookie = sessionCookie(res);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().admin.name).toBe(TEST_ADMIN.name);

    const out = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(out.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });

  it('recusa senha errada e e-mail inexistente com a mesma mensagem', async () => {
    const a = await login(TEST_ADMIN.email, 'senha-errada-000');
    const b = await login('ninguem@exemplo.test', 'senha-errada-000');
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
  });

  it('valida o corpo da requisição', async () => {
    const res = await login('nao-e-email', '');
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.email).toBeDefined();
  });

  it('bloqueia /me sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('recusa POST que não é JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'email=a&password=b',
    });
    expect(res.statusCode).toBe(415);
  });

  it('limita tentativas de login', async () => {
    for (let i = 0; i < 10; i++) await login(TEST_ADMIN.email, 'errada-0000000');
    const res = await login(TEST_ADMIN.email, TEST_ADMIN.password);
    expect(res.statusCode).toBe(429);
  });
});
