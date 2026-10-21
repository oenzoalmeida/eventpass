import type { FastifyInstance } from 'fastify';
import { eventInputSchema, eventStatusInputSchema, type DashboardSummary } from '@eventpass/shared';
import { requireAdmin } from '../auth/plugin.js';
import { getEventById, listEvents } from '../lib/events-repo.js';
import { HttpError, nowIso, parseId, sendError, sendValidationError } from '../lib/http.js';
import { slugify } from '../lib/slug.js';
import { transaction } from '../db/database.js';
export async function adminEventRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);
  const db = app.db;
  app.get('/api/admin/dashboard', async (): Promise<DashboardSummary> => {
    const counts = (await db
      .prepare(
        `SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
           SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed
         FROM events`,
      )
      .get()) as Record<'total' | 'draft' | 'published' | 'closed', number | null>;
    const scalar = async (sql: string) =>
      Number(
        (
          (await db.prepare(sql).get()) as {
            n: number | null;
          }
        ).n ?? 0,
      );
    return {
      events: {
        total: counts.total ?? 0,
        draft: counts.draft ?? 0,
        published: counts.published ?? 0,
        closed: counts.closed ?? 0,
      },
      registrations: await scalar(
        `SELECT COUNT(*) AS n FROM registrations WHERE status = 'confirmed'`,
      ),
      checkins: await scalar('SELECT COUNT(*) AS n FROM checkins'),
      points: await scalar('SELECT SUM(points) AS n FROM point_entries'),
      participants: await scalar('SELECT COUNT(*) AS n FROM participants'),
      upcoming: await listEvents(
        db,
        `WHERE e.status != 'closed' AND e.ends_at > ? ORDER BY e.starts_at LIMIT 5`,
        [nowIso()],
      ),
    };
  });
  app.get('/api/admin/events', async () => ({
    events: await listEvents(db, 'ORDER BY e.starts_at DESC'),
  }));
  app.get('/api/admin/events/:id', async (request, reply) => {
    const id = parseId(
      (
        request.params as {
          id: string;
        }
      ).id,
    );
    const event = id ? await getEventById(db, id, true) : null;
    if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
    return { event };
  });
  app.post('/api/admin/events', async (request, reply) => {
    const parsed = eventInputSchema.safeParse(request.body);
    if (!parsed.success)
      return sendValidationError(reply, parsed.error, 'Revise os dados do evento.');
    const e = parsed.data;
    const result = await db
      .prepare(
        `INSERT INTO events (slug, title, description, location, starts_at, ends_at, capacity, checkin_points, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slugify(e.title),
        e.title,
        e.description,
        e.location,
        e.startsAt,
        e.endsAt,
        e.capacity,
        e.checkinPoints,
        request.admin!.id,
      );
    return reply.code(201).send({ event: await getEventById(db, Number(result.lastInsertRowid)) });
  });
  app.put('/api/admin/events/:id', async (request, reply) => {
    const id = parseId(
      (
        request.params as {
          id: string;
        }
      ).id,
    );
    const parsed = eventInputSchema.safeParse(request.body);
    if (!parsed.success)
      return sendValidationError(reply, parsed.error, 'Revise os dados do evento.');
    const e = parsed.data;
    return await transaction(db, async () => {
      const current = id ? await getEventById(db, id, true) : null;
      if (!current) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
      if (e.capacity < current.registrations) {
        throw new HttpError(400, {
          error: 'validation_error',
          message: 'Revise os dados do evento.',
          issues: {
            capacity: [
              `Já existem ${current.registrations} inscrições confirmadas; não é possível reduzir abaixo disso.`,
            ],
          },
        });
      }
      await db
        .prepare(
          `UPDATE events SET title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?,
           capacity = ?, checkin_points = ?, updated_at = ? WHERE id = ?`,
        )
        .run(
          e.title,
          e.description,
          e.location,
          e.startsAt,
          e.endsAt,
          e.capacity,
          e.checkinPoints,
          nowIso(),
          current.id,
        );
      return { event: await getEventById(db, current.id) };
    });
  });
  app.post('/api/admin/events/:id/status', async (request, reply) => {
    const id = parseId(
      (
        request.params as {
          id: string;
        }
      ).id,
    );
    const parsed = eventStatusInputSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);
    const event = id ? await getEventById(db, id, true) : null;
    if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
    await db
      .prepare('UPDATE events SET status = ?, updated_at = ? WHERE id = ?')
      .run(parsed.data.status, nowIso(), event.id);
    return { event: await getEventById(db, event.id) };
  });
  app.delete('/api/admin/events/:id', async (request, reply) => {
    const id = parseId(
      (
        request.params as {
          id: string;
        }
      ).id,
    );
    return await transaction(db, async () => {
      const event = id ? await getEventById(db, id, true) : null;
      if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
      const any = await db
        .prepare('SELECT 1 FROM registrations WHERE event_id = ? LIMIT 1')
        .get(event.id);
      if (event.status !== 'draft' || any) {
        return sendError(
          reply,
          409,
          'event_in_use',
          'Só é possível excluir rascunhos sem inscrições. Encerre o evento em vez de excluir.',
        );
      }
      await db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
      reply.code(204);
      return null;
    });
  });
}
