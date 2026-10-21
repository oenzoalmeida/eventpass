import { afterEach, expect, it } from 'vitest';
import { setupTestApp, seedAdmin, TEST_ADMIN, loginCookie } from './test-utils.js';
import { loadEnv } from './env.js';
import type { FastifyInstance } from 'fastify';
let app: FastifyInstance;
afterEach(async () => app?.close());
it('rejects cross-site mutation and protects sensitive responses from caching', async () => {
  const ctx = await setupTestApp();
  app = ctx.app;
  await seedAdmin(ctx.db);
  const blocked = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: 'https://attacker.invalid' },
    payload: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
  });
  expect(blocked.statusCode).toBe(403);
  const cookie = await loginCookie(app);
  const me = await app.inject({ url: '/api/auth/me', headers: { cookie } });
  expect(me.headers['cache-control']).toBe('no-store');
  expect(me.headers['referrer-policy']).toBe('no-referrer');
});
it('refuses insecure cookies in production without disclosing env values', () => {
  expect(() =>
    loadEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:secret@localhost/db',
      COOKIE_SECURE: 'false',
    }),
  ).toThrow('Secure cookies required');
  try {
    loadEnv({ DATABASE_URL: 'sensitive-bad-value' });
  } catch (e) {
    expect(String(e)).not.toContain('sensitive-bad-value');
  }
});
