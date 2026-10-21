import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createPublishedEvent,
  loginCookie,
  register,
  seedAdmin,
  setupTestApp,
} from '../test-utils.js';
let app: FastifyInstance;
let cookie: string;
beforeEach(async () => {
  const ctx = await setupTestApp();
  app = ctx.app;
  await seedAdmin(ctx.db);
  cookie = await loginCookie(app);
});
afterEach(async () => app.close());
const checkin = (eventId: number, token: string) =>
  app.inject({
    method: 'POST',
    url: `/api/admin/events/${eventId}/checkins`,
    headers: { cookie },
    payload: { token },
  });
describe('check-in e pontuação', () => {
  it('confirma presença e lança pontos uma única vez', async () => {
    const ev = await createPublishedEvent(app, cookie, { checkinPoints: 15 });
    const { ticketToken } = (await register(app, ev.slug, 'Ana Souza', 'ana@exemplo.test')).json();
    const first = await checkin(ev.id, ticketToken);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      alreadyCheckedIn: false,
      pointsAwarded: 15,
      totalPoints: 15,
    });
    const again = await checkin(ev.id, ticketToken);
    expect(again.json()).toMatchObject({
      alreadyCheckedIn: true,
      pointsAwarded: 0,
      totalPoints: 15,
    });
    const board = await app.inject({ method: 'GET', url: '/api/public/leaderboard' });
    expect(board.json().leaderboard).toEqual([{ rank: 1, displayName: 'Ana S.', points: 15 }]);
  });
  it('aceita a URL completa do ingresso', async () => {
    const ev = await createPublishedEvent(app, cookie);
    const { ticketToken } = (await register(app, ev.slug, 'Ana', 'ana@exemplo.test')).json();
    const res = await checkin(ev.id, `https://eventpass.exemplo/ingresso/${ticketToken}`);
    expect(res.json().alreadyCheckedIn).toBe(false);
  });
  it('acumula pontos entre eventos', async () => {
    const a = await createPublishedEvent(app, cookie, { checkinPoints: 10 });
    const b = await createPublishedEvent(app, cookie, { checkinPoints: 25 });
    const ta = (await register(app, a.slug, 'Ana', 'ana@exemplo.test')).json().ticketToken;
    const tb = (await register(app, b.slug, 'Ana', 'ana@exemplo.test')).json().ticketToken;
    await checkin(a.id, ta);
    expect((await checkin(b.id, tb)).json().totalPoints).toBe(35);
  });
  it('recusa ingresso de outro evento', async () => {
    const a = await createPublishedEvent(app, cookie);
    const b = await createPublishedEvent(app, cookie);
    const { ticketToken } = (await register(app, a.slug, 'Ana', 'ana@exemplo.test')).json();
    const res = await checkin(b.id, ticketToken);
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('ticket_not_found');
  });
  it('recusa inscrição cancelada e impede cancelar após check-in', async () => {
    const ev = await createPublishedEvent(app, cookie);
    const t1 = (await register(app, ev.slug, 'Ana', 'ana@exemplo.test')).json().ticketToken;
    const t2 = (await register(app, ev.slug, 'Bia', 'bia@exemplo.test')).json().ticketToken;
    const regs = (
      await app.inject({
        method: 'GET',
        url: `/api/admin/events/${ev.id}/registrations`,
        headers: { cookie },
      })
    ).json().registrations as Array<{
      id: number;
      participantName: string;
    }>;
    const ana = regs.find((r) => r.participantName === 'Ana')!;
    const bia = regs.find((r) => r.participantName === 'Bia')!;
    const cancel = (id: number) =>
      app.inject({
        method: 'POST',
        url: `/api/admin/events/${ev.id}/registrations/${id}/cancel`,
        headers: { cookie },
      });
    expect((await cancel(ana.id)).statusCode).toBe(204);
    expect((await checkin(ev.id, t1)).json().error).toBe('registration_cancelled');
    await checkin(ev.id, t2);
    expect((await cancel(bia.id)).statusCode).toBe(409);
  });
  it('libera a vaga quando a inscrição é cancelada', async () => {
    const ev = await createPublishedEvent(app, cookie, { capacity: 1 });
    await register(app, ev.slug, 'Ana', 'ana@exemplo.test');
    expect((await register(app, ev.slug, 'Bia', 'bia@exemplo.test')).json().error).toBe('sold_out');
    const regs = (
      await app.inject({
        method: 'GET',
        url: `/api/admin/events/${ev.id}/registrations`,
        headers: { cookie },
      })
    ).json().registrations;
    await app.inject({
      method: 'POST',
      url: `/api/admin/events/${ev.id}/registrations/${regs[0].id}/cancel`,
      headers: { cookie },
    });
    expect((await register(app, ev.slug, 'Bia', 'bia@exemplo.test')).statusCode).toBe(201);
  });
});
describe('relatórios', () => {
  it('calcula presença e ocupação', async () => {
    const ev = await createPublishedEvent(app, cookie, { capacity: 4, checkinPoints: 10 });
    const t = (await register(app, ev.slug, 'Ana', 'ana@exemplo.test')).json().ticketToken;
    await register(app, ev.slug, 'Bia', 'bia@exemplo.test');
    await checkin(ev.id, t);
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/events/${ev.id}/report`,
      headers: { cookie },
    });
    expect(res.json().report).toMatchObject({
      confirmed: 2,
      checkins: 1,
      attendanceRate: 50,
      occupancyRate: 50,
      pointsAwarded: 10,
    });
    expect(res.json().report.checkinsByHour).toHaveLength(1);
  });
  it('exporta CSV com BOM, separador ; e proteção contra fórmulas', async () => {
    const ev = await createPublishedEvent(app, cookie);
    await register(app, ev.slug, '=HYPERLINK("x")', 'ana@exemplo.test');
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/events/${ev.id}/registrations.csv`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain(`inscricoes-${ev.slug}.csv`);
    expect(res.body.startsWith('﻿Nome;E-mail;Situação')).toBe(true);
    expect(res.body).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('exige login para exportar', async () => {
    const ev = await createPublishedEvent(app, cookie);
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/events/${ev.id}/registrations.csv`,
    });
    expect(res.statusCode).toBe(401);
  });
});

it('permite cancelar inscrição quando o evento voltou a rascunho', async () => {
  const event = await createPublishedEvent(app, cookie);
  const registration = await register(app, event.slug, 'Pessoa Rascunho', 'draft@exemplo.test');
  expect(registration.statusCode).toBe(201);
  await app.inject({
    method: 'POST',
    url: '/api/admin/events/' + event.id + '/status',
    headers: { cookie },
    payload: { status: 'draft' },
  });
  const list = await app.inject({
    url: '/api/admin/events/' + event.id + '/registrations',
    headers: { cookie },
  });
  const id = list.json().registrations[0].id;
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/admin/events/' + event.id + '/registrations/' + id + '/cancel',
        headers: { cookie },
      })
    ).statusCode,
  ).toBe(204);
});
