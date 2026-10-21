import type { FastifyInstance } from 'fastify';
import { registrationInputSchema, type Leaderboard, type Ticket } from '@eventpass/shared';
import { transaction } from '../db/database.js';
import { getEventBySlug, listEvents, toPublicEvent } from '../lib/events-repo.js';
import { nowIso, sendError, sendValidationError } from '../lib/http.js';
import { hashTicketToken, newTicketToken, ticketQrSvg } from '../lib/tickets.js';
/** Mostra só o primeiro nome e a inicial do sobrenome, para não expor participantes. */
export function displayName(full: string): string {
  const parts = full.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
}
export async function publicRoutes(app: FastifyInstance) {
  const db = app.db;
  app.get('/api/public/events', async () => {
    const now = nowIso();
    const events = await listEvents(
      db,
      `WHERE e.status = 'published' AND e.ends_at > ? ORDER BY e.starts_at`,
      [now],
    );
    return { events: events.map((e) => toPublicEvent(e, now)) };
  });
  app.get('/api/public/events/:slug', async (request, reply) => {
    const event = await getEventBySlug(
      db,
      (
        request.params as {
          slug: string;
        }
      ).slug,
    );
    // Rascunhos não existem para o público.
    if (!event || event.status === 'draft')
      return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
    return { event: toPublicEvent(event) };
  });
  app.post(
    '/api/public/events/:slug/registrations',
    { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const parsed = registrationInputSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error, 'Revise seus dados.');
      const { name, email } = parsed.data;
      const slug = (
        request.params as {
          slug: string;
        }
      ).slug;
      const { token, hash } = newTicketToken();
      // O bloqueio da linha do evento serializa contagem e inscrição entre instâncias.
      return await transaction(db, async () => {
        const event = await getEventBySlug(db, slug, true);
        if (!event || event.status === 'draft')
          return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
        const pub = toPublicEvent(event);
        if (event.status !== 'published' || event.endsAt <= nowIso()) {
          return sendError(
            reply,
            409,
            'registrations_closed',
            'As inscrições para este evento estão encerradas.',
          );
        }
        const existing = (await db
          .prepare(
            'SELECT r.id, r.status FROM registrations r JOIN participants p ON p.id=r.participant_id WHERE r.event_id=? AND lower(p.email)=lower(?)',
          )
          .get(event.id, email)) as { id: number; status: string } | undefined;
        if (existing?.status === 'confirmed')
          return sendError(
            reply,
            409,
            'already_registered',
            'Este e-mail já está inscrito neste evento.',
          );
        if (pub.spotsLeft <= 0)
          return sendError(reply, 409, 'sold_out', 'As vagas deste evento estão esgotadas.');
        await db
          .prepare(
            'INSERT INTO participants(email,name) VALUES(?,?) ON CONFLICT (lower(email)) DO NOTHING',
          )
          .run(email, name);
        const participant = (await db
          .prepare('SELECT id FROM participants WHERE lower(email)=lower(?)')
          .get(email)) as { id: number };
        if (existing) {
          // Reativa inscrição cancelada com um ingresso novo.
          await db
            .prepare(
              `UPDATE registrations SET status = 'confirmed', qr_token_hash = ?, created_at = ? WHERE id = ?`,
            )
            .run(hash, nowIso(), existing.id);
        } else {
          await db
            .prepare(
              'INSERT INTO registrations (event_id, participant_id, qr_token_hash) VALUES (?, ?, ?)',
            )
            .run(event.id, participant.id, hash);
        }
        reply.code(201);
        return { ticketToken: token };
      });
    },
  );
  app.get(
    '/api/public/tickets/:token',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const token = (
        request.params as {
          token: string;
        }
      ).token;
      const row = (await db
        .prepare(
          `SELECT e.slug, e.title, e.location, e.starts_at, e.ends_at, p.name, r.status, c.created_at AS checked_in_at
           FROM registrations r
           JOIN events e ON e.id = r.event_id
           JOIN participants p ON p.id = r.participant_id
           LEFT JOIN checkins c ON c.registration_id = r.id
           WHERE r.qr_token_hash = ?`,
        )
        .get(hashTicketToken(token))) as
        | {
            slug: string;
            title: string;
            location: string;
            starts_at: string;
            ends_at: string;
            name: string;
            status: Ticket['status'];
            checked_in_at: string | null;
          }
        | undefined;
      if (!row) return sendError(reply, 404, 'not_found', 'Ingresso não encontrado.');
      const ticket: Ticket = {
        event: {
          slug: row.slug,
          title: row.title,
          location: row.location,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
        },
        participantName: row.name,
        status: row.status,
        checkedInAt: row.checked_in_at,
        qrSvg: await ticketQrSvg(token),
      };
      reply.header('cache-control', 'no-store');
      return { ticket };
    },
  );
  app.get(
    '/api/public/leaderboard',
    async (): Promise<{
      leaderboard: Leaderboard;
    }> => {
      const rows = (await db
        .prepare(
          `SELECT p.name, SUM(pe.points) AS points, MIN(pe.created_at) AS first_at
         FROM point_entries pe JOIN participants p ON p.id = pe.participant_id
         GROUP BY p.id HAVING SUM(pe.points) > 0
         ORDER BY points DESC, first_at ASC LIMIT 10`,
        )
        .all()) as Array<{
        name: string;
        points: number;
      }>;
      return {
        leaderboard: rows.map((r, i) => ({
          rank: i + 1,
          displayName: displayName(r.name),
          points: r.points,
        })),
      };
    },
  );
}
