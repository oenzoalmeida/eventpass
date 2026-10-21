import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createPublishedEvent,
  eventPayload,
  loginCookie,
  register,
  seedAdmin,
  setupTestApp,
} from '../test-utils.js';
import { displayName } from './public.js';
let app: FastifyInstance;
let cookie: string;
beforeEach(async () => {
  const ctx = await setupTestApp();
  app = ctx.app;
  await seedAdmin(ctx.db);
  cookie = await loginCookie(app);
});
afterEach(async () => app.close());
describe('inscrições públicas', () => {
  it('lista só eventos publicados e esconde rascunhos', async () => {
    const pub = await createPublishedEvent(app, cookie);
    const draft = (
      await app.inject({
        method: 'POST',
        url: '/api/admin/events',
        headers: { cookie },
        payload: eventPayload(),
      })
    ).json().event;
    const list = await app.inject({ method: 'GET', url: '/api/public/events' });
    expect(list.json().events.map((e: { slug: string }) => e.slug)).toEqual([pub.slug]);
    expect(
      (await app.inject({ method: 'GET', url: `/api/public/events/${draft.slug}` })).statusCode,
    ).toBe(404);
  });
  it('inscreve, gera ingresso com QR Code e atualiza vagas', async () => {
    const ev = await createPublishedEvent(app, cookie, { capacity: 3 });
    const res = await register(app, ev.slug, 'Ana Souza', 'ana@exemplo.test');
    expect(res.statusCode).toBe(201);
    const { ticketToken } = res.json();
    expect(ticketToken.length).toBeGreaterThan(20);
    const t = await app.inject({ method: 'GET', url: `/api/public/tickets/${ticketToken}` });
    expect(t.statusCode).toBe(200);
    expect(t.json().ticket.participantName).toBe('Ana Souza');
    expect(t.json().ticket.qrSvg).toContain('<svg');
    const e = await app.inject({ method: 'GET', url: `/api/public/events/${ev.slug}` });
    expect(e.json().event.spotsLeft).toBe(2);
  });
  it('impede inscrição duplicada, mesmo com e-mail em maiúsculas', async () => {
    const ev = await createPublishedEvent(app, cookie);
    expect((await register(app, ev.slug, 'Ana', 'ana@exemplo.test')).statusCode).toBe(201);
    const dup = await register(app, ev.slug, 'Ana', 'ANA@Exemplo.test');
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error).toBe('already_registered');
  });
  it('respeita o limite de vagas com inscrições simultâneas', async () => {
    const ev = await createPublishedEvent(app, cookie, { capacity: 2 });
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        register(app, ev.slug, `Pessoa ${i}`, `p${i}@exemplo.test`),
      ),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(2);
    expect(
      results.filter((r) => r.statusCode === 409).every((r) => r.json().error === 'sold_out'),
    ).toBe(true);
  });
  it('recusa inscrição em evento encerrado', async () => {
    const ev = await createPublishedEvent(app, cookie);
    await app.inject({
      method: 'POST',
      url: `/api/admin/events/${ev.id}/status`,
      headers: { cookie },
      payload: { status: 'closed' },
    });
    const res = await register(app, ev.slug, 'Ana', 'ana@exemplo.test');
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('registrations_closed');
  });
  it('valida nome e e-mail', async () => {
    const ev = await createPublishedEvent(app, cookie);
    const res = await register(app, ev.slug, '', 'nao-e-email');
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.json().issues).sort()).toEqual(['email', 'name']);
  });
  it('não encontra ingresso com token inválido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/public/tickets/token-que-nao-existe',
    });
    expect(res.statusCode).toBe(404);
  });
});
describe('displayName', () => {
  it('mostra primeiro nome e inicial do sobrenome', () => {
    expect(displayName('Maria Clara da Silva')).toBe('Maria S.');
    expect(displayName('  Ana  ')).toBe('Ana');
  });
});
