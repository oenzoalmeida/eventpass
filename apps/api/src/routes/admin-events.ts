import type { FastifyInstance } from 'fastify';
import { eventInputSchema, eventStatusInputSchema, type DashboardSummary } from '@eventpass/shared';
import { requireAdmin } from '../auth/plugin.js';
import { getEventById, listEvents } from '../lib/events-repo.js';
import { nowIso, parseId, sendError, sendValidationError } from '../lib/http.js';
import { slugify } from '../lib/slug.js';

export async function adminEventRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);
  const db = app.db;

  app.get('/api/admin/dashboard', async (): Promise<DashboardSummary> => {
    const counts = await db.get<{
      total: number | string | null;
      draft: number | string | null;
      published: number | string | null;
      closed: number | string | null;
    }>(
      `SELECT COUNT(*) AS total,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
         SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
         SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed
       FROM events`,
    );
    const scalar = async (sql: string) =>
      Number((await db.get<{ n: number | string | null }>(sql))?.n ?? 0);
    return {
      events: {
        total: Number(counts?.total ?? 0),
        draft: Number(counts?.draft ?? 0),
        published: Number(counts?.published ?? 0),
        closed: Number(counts?.closed ?? 0),
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
    const id = parseId((request.params as { id: string }).id);
    const event = id ? await getEventById(db, id) : null;
    if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
    return { event };
  });

  app.post('/api/admin/events', async (request, reply) => {
    const parsed = eventInputSchema.safeParse(request.body);
    if (!parsed.success)
      return sendValidationError(reply, parsed.error, 'Revise os dados do evento.');
    const e = parsed.data;
    // RETURNING id funciona nos dois dialetos e substitui o lastInsertRowid do SQLite.
    const result = await db.run(
      `INSERT INTO events (slug, title, description, location, starts_at, ends_at, capacity, checkin_points, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id AS id`,
      [
        slugify(e.title),
        e.title,
        e.description,
        e.location,
        e.startsAt,
        e.endsAt,
        e.capacity,
        e.checkinPoints,
        request.admin!.id,
      ],
    );
    return reply.code(201).send({ event: await getEventById(db, result.insertId!) });
  });

  app.put('/api/admin/events/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const parsed = eventInputSchema.safeParse(request.body);
    if (!parsed.success)
      return sendValidationError(reply, parsed.error, 'Revise os dados do evento.');
    const e = parsed.data;

    return db.transaction(async (tx) => {
      const current = id ? await getEventById(tx, id) : null;
      if (!current) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
      if (e.capacity < current.registrations) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Revise os dados do evento.',
          issues: {
            capacity: [
              `Já existem ${current.registrations} inscrições confirmadas; não é possível reduzir abaixo disso.`,
            ],
          },
        });
      }
      await tx.run(
        `UPDATE events SET title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?,
           capacity = ?, checkin_points = ?, updated_at = ? WHERE id = ?`,
        [
          e.title,
          e.description,
          e.location,
          e.startsAt,
          e.endsAt,
          e.capacity,
          e.checkinPoints,
          nowIso(),
          current.id,
        ],
      );
      return { event: await getEventById(tx, current.id) };
    });
  });

  app.post('/api/admin/events/:id/status', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const parsed = eventStatusInputSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);
    const event = id ? await getEventById(db, id) : null;
    if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
    await db.run('UPDATE events SET status = ?, updated_at = ? WHERE id = ?', [
      parsed.data.status,
      nowIso(),
      event.id,
    ]);
    return { event: await getEventById(db, event.id) };
  });

  app.delete('/api/admin/events/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    return db.transaction(async (tx) => {
      const event = id ? await getEventById(tx, id) : null;
      if (!event) return sendError(reply, 404, 'not_found', 'Evento não encontrado.');
      const any = await tx.get('SELECT 1 AS one FROM registrations WHERE event_id = ? LIMIT 1', [
        event.id,
      ]);
      if (event.status !== 'draft' || any) {
        return sendError(
          reply,
          409,
          'event_in_use',
          'Só é possível excluir rascunhos sem inscrições. Encerre o evento em vez de excluir.',
        );
      }
      await tx.run('DELETE FROM events WHERE id = ?', [event.id]);
      return reply.code(204).send();
    });
  });
}
