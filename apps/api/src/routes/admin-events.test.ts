import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eventPayload, loginCookie, register, seedAdmin, setupTestApp } from '../test-utils.js';
let app: FastifyInstance;
let cookie: string;
beforeEach(async () => {
  const ctx = await setupTestApp();
  app = ctx.app;
  await seedAdmin(ctx.db);
  cookie = await loginCookie(app);
});
afterEach(async () => app.close());
const create = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/admin/events', headers: { cookie }, payload });
describe('gestão de eventos', () => {
  it('exige login', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/events' });
    expect(res.statusCode).toBe(401);
  });
  it('cria, lista, edita, publica e encerra', async () => {
    const res = await create(eventPayload({ title: 'Semana de Tecnologia' }));
    expect(res.statusCode).toBe(201);
    const { event } = res.json();
    expect(event.status).toBe('draft');
    expect(event.slug).toMatch(/^semana-de-tecnologia-[0-9a-f]{6}$/);
    const list = await app.inject({ method: 'GET', url: '/api/admin/events', headers: { cookie } });
    expect(list.json().events).toHaveLength(1);
    const upd = await app.inject({
      method: 'PUT',
      url: `/api/admin/events/${event.id}`,
      headers: { cookie },
      payload: eventPayload({ title: 'Semana de Tecnologia 2026', capacity: 50 }),
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().event.capacity).toBe(50);
    expect(upd.json().event.slug).toBe(event.slug);
    for (const status of ['published', 'closed']) {
      const r = await app.inject({
        method: 'POST',
        url: `/api/admin/events/${event.id}/status`,
        headers: { cookie },
        payload: { status },
      });
      expect(r.json().event.status).toBe(status);
    }
  });
  it('valida campos e datas', async () => {
    const res = await create(
      eventPayload({ title: 'x', capacity: 0, endsAt: '2020-01-01T00:00:00Z' }),
    );
    expect(res.statusCode).toBe(400);
    const { issues } = res.json();
    expect(issues.title).toBeDefined();
    expect(issues.capacity).toBeDefined();
  });
  it('recusa término antes do início', async () => {
    const p = eventPayload();
    const res = await create({ ...p, endsAt: p.startsAt, startsAt: p.endsAt });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.endsAt).toBeDefined();
  });
  it('não reduz vagas abaixo das inscrições confirmadas', async () => {
    const { event } = (await create(eventPayload({ capacity: 5 }))).json();
    await app.inject({
      method: 'POST',
      url: `/api/admin/events/${event.id}/status`,
      headers: { cookie },
      payload: { status: 'published' },
    });
    await register(app, event.slug, 'Ana Souza', 'ana@exemplo.test');
    await register(app, event.slug, 'Bruno Lima', 'bruno@exemplo.test');
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/events/${event.id}`,
      headers: { cookie },
      payload: eventPayload({ capacity: 1 }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.capacity[0]).toMatch(/2 inscrições/);
  });
  it('só exclui rascunho sem inscrições', async () => {
    const { event } = (await create(eventPayload())).json();
    await app.inject({
      method: 'POST',
      url: `/api/admin/events/${event.id}/status`,
      headers: { cookie },
      payload: { status: 'published' },
    });
    const blocked = await app.inject({
      method: 'DELETE',
      url: `/api/admin/events/${event.id}`,
      headers: { cookie },
    });
    expect(blocked.statusCode).toBe(409);
    const draft = (await create(eventPayload())).json().event;
    const ok = await app.inject({
      method: 'DELETE',
      url: `/api/admin/events/${draft.id}`,
      headers: { cookie },
    });
    expect(ok.statusCode).toBe(204);
  });
  it('resume números no dashboard', async () => {
    await create(eventPayload());
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().events).toEqual({ total: 1, draft: 1, published: 0, closed: 0 });
    expect(res.json().upcoming).toHaveLength(1);
  });
});
