import type { FastifyInstance } from 'fastify';
import {
  checkinRequestSchema,
  type AdminRegistration,
  type CheckinResult,
  type EventReport,
} from '@eventpass/shared';
import { requireAdmin } from '../auth/plugin.js';
import { transaction } from '../db/database.js';
import { toCsv } from '../lib/csv.js';
import { getEventById } from '../lib/events-repo.js';
import { nowIso, parseId, sendError, sendValidationError } from '../lib/http.js';
import { hashTicketToken } from '../lib/tickets.js';
interface RegistrationRow {
  id: number;
  name: string;
  email: string;
  status: AdminRegistration['status'];
  created_at: string;
  checked_in_at: string | null;
  points: number | null;
}
const SELECT_REGISTRATIONS = `
  SELECT r.id, p.name, p.email, r.status, r.created_at, c.created_at AS checked_in_at, pe.points
  FROM registrations r
  JOIN participants p ON p.id = r.participant_id
  LEFT JOIN checkins c ON c.registration_id = r.id
  LEFT JOIN point_entries pe ON pe.checkin_id = c.id
  WHERE r.event_id = ?
  ORDER BY lower(p.name)`;
const toRegistration = (r: RegistrationRow): AdminRegistration => ({
  id: r.id,
  participantName: r.name,
  participantEmail: r.email,
  status: r.status,
  createdAt: r.created_at,
  checkedInAt: r.checked_in_at,
  points: r.points ?? 0,
});
const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
export async function adminAttendanceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);
  const db = app.db;
  const eventFrom = async (params: unknown) => {
    const id = parseId(
      (
        params as {
          id: string;
        }
      ).id,
    );
    return id ? await getEventById(db, id) : null;
  };
  app.get('/api/admin/events/:id/registrations', async (request, reply) => {
    const event = await eventFrom(request.params);
    if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
    const rows = (await db
      .prepare(SELECT_REGISTRATIONS)
      .all(event.id)) as unknown as RegistrationRow[];
    return { registrations: rows.map(toRegistration) };
  });
  app.post('/api/admin/events/:id/registrations/:registrationId/cancel', async (request, reply) => {
    const event = await eventFrom(request.params);
    const regId = parseId(
      (
        request.params as {
          registrationId: string;
        }
      ).registrationId,
    );
    if (!event || !regId) return sendError(reply, 404, 'not_found', 'Inscrição não encontrada.');
    return await transaction(db, async () => {
      await db.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [event!.id]);
      const current = await getEventById(db, event!.id);
      if (!current) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
      const reg = (await db
        .prepare(
          `SELECT r.id, c.id AS checkin_id FROM registrations r
           LEFT JOIN checkins c ON c.registration_id = r.id
           WHERE r.id = ? AND r.event_id = ?`,
        )
        .get(regId, event.id)) as
        | {
            id: number;
            checkin_id: number | null;
          }
        | undefined;
      if (!reg) return sendError(reply, 404, 'not_found', 'Inscrição não encontrada.');
      if (reg.checkin_id) {
        return sendError(
          reply,
          409,
          'already_checked_in',
          'Não é possível cancelar: o participante já fez check-in.',
        );
      }
      await db.prepare(`UPDATE registrations SET status = 'cancelled' WHERE id = ?`).run(reg.id);
      reply.code(204);
      return null;
    });
  });
  app.post(
    '/api/admin/events/:id/checkins',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const event = await eventFrom(request.params);
      if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
      const parsed = checkinRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      if (event.status === 'draft') {
        return sendError(
          reply,
          409,
          'event_not_published',
          'Publique o evento antes de registrar presenças.',
        );
      }
      return await transaction(
        db,
        async (): Promise<CheckinResult | ReturnType<typeof sendError>> => {
          await db.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [event!.id]);
          const current = await getEventById(db, event!.id);
          if (!current || current.status === 'draft')
            return sendError(
              reply,
              409,
              'event_not_published',
              'Evento indisponível para esta operação.',
            );
          const reg = (await db
            .prepare(
              `SELECT r.id, r.status, r.participant_id, p.name, p.email
             FROM registrations r JOIN participants p ON p.id = r.participant_id
             WHERE r.qr_token_hash = ? AND r.event_id = ?`,
            )
            .get(hashTicketToken(parsed.data.token), event.id)) as
            | {
                id: number;
                status: string;
                participant_id: number;
                name: string;
                email: string;
              }
            | undefined;
          if (!reg)
            return sendError(reply, 404, 'ticket_not_found', 'Ingresso inválido para este evento.');
          if (reg.status !== 'confirmed') {
            return sendError(reply, 409, 'registration_cancelled', 'Esta inscrição foi cancelada.');
          }
          const total = async () =>
            Number(
              (
                (await db
                  .prepare('SELECT SUM(points) AS n FROM point_entries WHERE participant_id = ?')
                  .get(reg.participant_id)) as {
                  n: number | null;
                }
              ).n ?? 0,
            );
          const previous = (await db
            .prepare('SELECT created_at FROM checkins WHERE registration_id = ?')
            .get(reg.id)) as
            | {
                created_at: string;
              }
            | undefined;
          if (previous) {
            // Idempotente: ler o mesmo QR de novo não gera pontos em dobro.
            return {
              alreadyCheckedIn: true,
              participantName: reg.name,
              participantEmail: reg.email,
              pointsAwarded: 0,
              totalPoints: await total(),
              checkedInAt: previous.created_at,
            };
          }
          const at = nowIso();
          const checkin = await db
            .prepare(
              'INSERT INTO checkins (registration_id, checked_in_by, created_at) VALUES (?, ?, ?)',
            )
            .run(reg.id, request.admin!.id, at);
          // Pontos só nascem atrelados a um check-in válido.
          await db
            .prepare(
              'INSERT INTO point_entries (participant_id, checkin_id, points, created_at) VALUES (?, ?, ?, ?)',
            )
            .run(reg.participant_id, Number(checkin.lastInsertRowid), current.checkinPoints, at);
          return {
            alreadyCheckedIn: false,
            participantName: reg.name,
            participantEmail: reg.email,
            pointsAwarded: current.checkinPoints,
            totalPoints: await total(),
            checkedInAt: at,
          };
        },
      );
    },
  );
  app.get(
    '/api/admin/events/:id/report',
    async (request, reply): Promise<EventReport | unknown> => {
      const event = await eventFrom(request.params);
      if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
      const counts = (await db
        .prepare(
          `SELECT SUM(CASE WHEN r.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed, SUM(CASE WHEN r.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
           COUNT(c.id) AS checkins, COALESCE(SUM(pe.points), 0) AS points
         FROM registrations r
         LEFT JOIN checkins c ON c.registration_id = r.id
         LEFT JOIN point_entries pe ON pe.checkin_id = c.id
         WHERE r.event_id = ?`,
        )
        .get(event.id)) as {
        confirmed: number | null;
        cancelled: number | null;
        checkins: number;
        points: number;
      };
      const byHour = (await db
        .prepare(
          `SELECT substr(c.created_at, 1, 13) || ':00:00Z' AS hour, COUNT(*) AS count
         FROM checkins c JOIN registrations r ON r.id = c.registration_id
         WHERE r.event_id = ? GROUP BY hour ORDER BY hour`,
        )
        .all(event.id)) as Array<{
        hour: string;
        count: number;
      }>;
      const confirmed = counts.confirmed ?? 0;
      const report: EventReport = {
        event,
        confirmed,
        cancelled: counts.cancelled ?? 0,
        checkins: counts.checkins,
        attendanceRate: pct(counts.checkins, confirmed),
        occupancyRate: pct(confirmed, event.capacity),
        pointsAwarded: counts.points,
        checkinsByHour: byHour,
      };
      return { report };
    },
  );
  app.get('/api/admin/events/:id/registrations.csv', async (request, reply) => {
    const event = await eventFrom(request.params);
    if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
    const rows = (
      (await db.prepare(SELECT_REGISTRATIONS).all(event.id)) as unknown as RegistrationRow[]
    ).map(toRegistration);
    const csv = toCsv(
      ['Nome', 'E-mail', 'Situação', 'Inscrito em', 'Check-in em', 'Pontos'],
      rows.map((r) => [
        r.participantName,
        r.participantEmail,
        r.status === 'confirmed' ? 'Confirmada' : 'Cancelada',
        r.createdAt,
        r.checkedInAt,
        r.points,
      ]),
    );
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="inscricoes-${event.slug}.csv"`)
      .header('cache-control', 'no-store')
      .send(csv);
  });
}
