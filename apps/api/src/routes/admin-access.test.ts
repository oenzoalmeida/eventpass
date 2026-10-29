import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestApp } from '../test-utils.js';

let app: FastifyInstance;

beforeEach(async () => {
  const ctx = await setupTestApp();
  app = ctx.app;
});
afterEach(async () => app.close());

describe('admin access boundary', () => {
  const routes = [
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/admin/events'],
    ['GET', '/api/admin/events/1'],
    ['POST', '/api/admin/events'],
    ['PUT', '/api/admin/events/1'],
    ['POST', '/api/admin/events/1/status'],
    ['DELETE', '/api/admin/events/1'],
    ['GET', '/api/admin/events/1/registrations'],
    ['POST', '/api/admin/events/1/registrations/1/cancel'],
    ['POST', '/api/admin/events/1/checkins'],
    ['GET', '/api/admin/events/1/report'],
    ['GET', '/api/admin/events/1/registrations.csv'],
  ] as const;

  for (const [method, url] of routes) {
    it(`${method} ${url} rejects anonymous requests`, async () => {
      const response = await app.inject({ method, url });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('unauthorized');
    });
  }

  it('rejects a fabricated session cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: { cookie: 'ep_session=invalid-session-token' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('unauthorized');
  });
});
