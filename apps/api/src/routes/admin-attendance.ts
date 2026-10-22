import type { FastifyInstance } from 'fastify';
import {
  checkinRequestSchema,
  type AdminRegistration,
  type CheckinResult,
  type EventReport,
} from '@eventpass/shared';
import { requireAdmin } from '../auth/plugin.js';
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
  points: number | string | null;
}

// LOWER() em vez de COLLATE NOCASE para ser válido nos dois dialetos.
const SELECT_REGISTRATIONS = `
  SELECT r.id, p.name, p.email, r.status, r.created_at, c.created_at AS checked_in_at, pe.points
  FROM registrations r
  JOIN participants p ON p.id = r.participant_id
  LEFT JOIN checkins c ON c.registration_id = r.id
  LEFT JOIN point_entries pe ON pe.checkin_id = c.id
  WHERE r.event_id = ?
  ORDER BY LOWER(p.name)`;

const toRegistration = (r: RegistrationRow): AdminRegistration => ({
  id: Number(r.id),
  participantName: r.name,
  participantEmail: r.email,
  status: r.status,
  createdAt: r.created_at,
  checkedInAt: r.checked_in_at,
  points: r.points == null ? 0 : Number(r.points),
});

const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 1000) / 10 : 0;

export async function adminAttendanceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);
  const db = app.db;

  const eventFrom = async (params: unknown) => {
    const id = parseId((params as { id: string }).id);
    return id ? await getEventById(db, id) : null;
  };

  app.get('/api/admin/events/:id/registrations', async (request, reply) => {
    const event = await eventFrom(request.params);
    if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
    const rows = await db.all<RegistrationRow>(SELECT_REGISTRATIONS, [event.id]);
    return { registrations: rows.map(toRegistration) };
  });

  app.post('/api/admin/events/:id/registrations/:registrationId/cancel', async (request, reply) => {
    const event = await eventFrom(request.params);
    const regId = parseId((request.params as { registrationId: string }).registrationId);
    if (!event || !regId) return sendError(reply, 404, 'not_found', 'Inscrição não encontrada.');
    return db.transaction(async (tx) => {
      await tx.lock(regId);
      const reg = await tx.get<{ id: number; checkin_id: number | null }>(
        `SELECT r.id, c.id AS checkin_id FROM registrations r
         LEFT JOIN checkins c ON c.registration_id = r.id
         WHERE r.id = ? AND r.event_id = ?`,
        [regId, event.id],
      );
      if (!reg) return sendError(reply, 404, 'not_found', 'Inscrição não encontrada.');
      if (reg.checkin_id) {
        return sendError(
          reply,
          409,
          'already_checked_in',
          'Não é possível cancelar: o participante já fez check-in.',
        );
      }
      await tx.run(`UPDATE registrations SET status = 'cancelled' WHERE id = ?`, [reg.id]);
      return reply.code(204).send();
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

      return db.transaction(async (tx): Promise<CheckinResult | ReturnType<typeof sendError>> => {
        const reg = await tx.get<{
          id: number;
          status: string;
          participant_id: number;
          name: string;
          email: string;
        }>(
          `SELECT r.id, r.status, r.participant_id, p.name, p.email
           FROM registrations r JOIN participants p ON p.id = r.participant_id
           WHERE r.qr_token_hash = ? AND r.event_id = ?`,
          [hashTicketToken(parsed.data.token), event.id],
        );
        if (!reg)
          return sendError(reply, 404, 'ticket_not_found', 'Ingresso inválido para este evento.');
        if (reg.status !== 'confirmed') {
          return sendError(reply, 409, 'registration_cancelled', 'Esta inscrição foi cancelada.');
        }
        // Trava a inscrição: dois leitores do mesmo QR não geram dois check-ins.
        await tx.lock(reg.id);

        const total = async () =>
          Number(
            (
              await tx.get<{ n: number | string | null }>(
                'SELECT SUM(points) AS n FROM point_entries WHERE participant_id = ?',
                [reg.participant_id],
              )
            )?.n ?? 0,
          );

        const previous = await tx.get<{ created_at: string }>(
          'SELECT created_at FROM checkins WHERE registration_id = ?',
          [reg.id],
        );
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
        const checkin = await tx.run(
          'INSERT INTO checkins (registration_id, checked_in_by, created_at) VALUES (?, ?, ?) RETURNING id AS id',
          [reg.id, request.admin!.id, at],
        );
        // Pontos só nascem atrelados a um check-in válido.
        await tx.run(
          'INSERT INTO point_entries (participant_id, checkin_id, points, created_at) VALUES (?, ?, ?, ?)',
          [reg.participant_id, checkin.insertId!, event.checkinPoints, at],
        );
        return {
          alreadyCheckedIn: false,
          participantName: reg.name,
          participantEmail: reg.email,
          pointsAwarded: event.checkinPoints,
          totalPoints: await total(),
          checkedInAt: at,
        };
      });
    },
  );

  app.get(
    '/api/admin/events/:id/report',
    async (request, reply): Promise<EventReport | unknown> => {
      const event = await eventFrom(request.params);
      if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
      const counts = await db.get<{
        confirmed: number | string | null;
        cancelled: number | string | null;
        checkins: number | string;
        points: number | string;
      }>(
        `SELECT SUM(CASE WHEN r.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
         SUM(CASE WHEN r.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
         COUNT(c.id) AS checkins, COALESCE(SUM(pe.points), 0) AS points
       FROM registrations r
       LEFT JOIN checkins c ON c.registration_id = r.id
       LEFT JOIN point_entries pe ON pe.checkin_id = c.id
       WHERE r.event_id = ?`,
        [event.id],
      );
      const byHour = await db.all<{ hour: string; count: number | string }>(
        `SELECT substr(c.created_at, 1, 13) || ':00:00Z' AS hour, COUNT(*) AS count
       FROM checkins c JOIN registrations r ON r.id = c.registration_id
       WHERE r.event_id = ? GROUP BY hour ORDER BY hour`,
        [event.id],
      );
      const confirmed = Number(counts?.confirmed ?? 0);
      const checkins = Number(counts?.checkins ?? 0);
      const report: EventReport = {
        event,
        confirmed,
        cancelled: Number(counts?.cancelled ?? 0),
        checkins,
        attendanceRate: pct(checkins, confirmed),
        occupancyRate: pct(confirmed, event.capacity),
        pointsAwarded: Number(counts?.points ?? 0),
        checkinsByHour: byHour.map((h) => ({ hour: h.hour, count: Number(h.count) })),
      };
      return { report };
    },
  );

  app.get('/api/admin/events/:id/registrations.csv', async (request, reply) => {
    const event = await eventFrom(request.params);
    if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
    const rows = (await db.all<RegistrationRow>(SELECT_REGISTRATIONS, [event.id])).map(
      toRegistration,
    );
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
