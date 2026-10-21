import { afterEach, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { setupTestApp, seedAdmin, loginCookie, createPublishedEvent } from '../test-utils.js';
import type { FastifyInstance } from 'fastify';
let app: FastifyInstance;
let second: FastifyInstance;
afterEach(async () => {
  await second?.close();
  await app?.close();
});
it('serializes registrations and duplicate check-ins across app instances', async () => {
  const ctx = await setupTestApp();
  app = ctx.app;
  second = await buildApp(ctx.env, ctx.db);
  await seedAdmin(ctx.db);
  const cookie = await loginCookie(app);
  const event = await createPublishedEvent(app, cookie, { capacity: 3 });
  const responses = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      (i % 2 ? app : second).inject({
        method: 'POST',
        url: '/api/public/events/' + event.slug + '/registrations',
        remoteAddress: '192.0.2.' + (i + 1),
        payload: { name: 'Pessoa Teste ' + i, email: 'p' + i + '@concurrency.test' },
      }),
    ),
  );
  expect(responses.filter((r) => r.statusCode === 201)).toHaveLength(3);
  expect(responses.filter((r) => r.statusCode === 409)).toHaveLength(27);
  const token = responses.find((r) => r.statusCode === 201)!.json().ticketToken;
  const hits = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      (i % 2 ? app : second).inject({
        method: 'POST',
        url: '/api/admin/events/' + event.id + '/checkins',
        headers: { cookie },
        payload: { token },
      }),
    ),
  );
  expect(hits.every((r) => r.statusCode === 200)).toBe(true);
  expect(hits.filter((r) => !r.json().alreadyCheckedIn)).toHaveLength(1);
  expect(hits.reduce((sum, r) => sum + r.json().pointsAwarded, 0)).toBe(15);
  const report = await app.inject({
    url: '/api/admin/events/' + event.id + '/report',
    headers: { cookie },
  });
  expect(report.json().report.checkins).toBe(1);
  expect(report.json().report.pointsAwarded).toBe(15);
});
it('enforces login rate limiting across instances', async () => {
  const ctx = await setupTestApp();
  app = ctx.app;
  second = await buildApp(ctx.env, ctx.db);
  const route = {
    method: 'POST' as const,
    url: '/api/auth/login',
    payload: { email: 'none@concurrency.test', password: 'wrong-password-123' },
  };
  for (let i = 0; i < 10; i++)
    expect((await (i % 2 ? app : second).inject(route)).statusCode).toBe(401);
  expect((await second.inject(route)).statusCode).toBe(429);
});
