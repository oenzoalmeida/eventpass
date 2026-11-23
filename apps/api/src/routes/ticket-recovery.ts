import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from '@eventpass/shared';
import type { Env } from '../env.js';
import { hashTicketToken, newTicketToken } from '../lib/tickets.js';
import { encryptNotification } from '../lib/email/payload.js';
import { enqueueEmail } from '../lib/email/outbox.js';
import { sendError } from '../lib/http.js';

const requestSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
});
const confirmSchema = z.object({ token: z.string().min(32).max(120) });
const GENERIC = { message: 'Se houver inscrição elegível, enviaremos instruções para o e-mail informado.' };

/**
 * Recovery never returns a ticket until possession of the email is demonstrated.
 * Feature-flagged: no work is performed unless both email and recovery are enabled.
 */
export function recoveryRoutes(env: Env) {
  return async (app: FastifyInstance) => {
    app.get('/api/public/features', async () => ({ ticketRecovery: Boolean(env.EMAIL_ENABLED && env.TICKET_RECOVERY_ENABLED) }));
    app.post(
      '/api/public/tickets/recovery/request',
      { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
      async (request, reply) => {
        if (!env.EMAIL_ENABLED || !env.TICKET_RECOVERY_ENABLED) return sendError(reply, 404, 'not_found', 'Recurso indisponível.');
        const parsed = requestSchema.safeParse(request.body);
        if (!parsed.success) return reply.code(400).send({ error: 'validation_error', message: 'Dados inválidos.' });
        const { slug, email } = parsed.data;
        const now = new Date().toISOString();
        await app.db.transaction(async (tx) => {
          const row = await tx.get<{ id: number; participant_name: string; event_title: string }>(
            `SELECT r.id, p.name AS participant_name, e.title AS event_title
             FROM registrations r
             JOIN participants p ON p.id = r.participant_id
             JOIN events e ON e.id = r.event_id
             WHERE e.slug = ? AND p.email = ? AND r.status = 'confirmed'`,
            [slug, email],
          );
          if (!row) return;
          await tx.lock(row.id);
          const count = await tx.get<{ count: number | string }>(
            'SELECT COUNT(*) AS count FROM ticket_recovery_requests WHERE registration_id = ? AND created_at > ?',
            [row.id, new Date(Date.now() - 60 * 60 * 1000).toISOString()],
          );
          if (Number(count?.count ?? 0) >= 3) return;
          const token = randomBytes(32).toString('base64url');
          const tokenHash = hashTicketToken(token);
          await tx.run(
            'INSERT INTO ticket_recovery_requests (registration_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)',
            [row.id, tokenHash, now, new Date(Date.parse(now) + 15 * 60 * 1000).toISOString()],
          );
          const idempotencyKey = 'ticket-recovery:' + tokenHash;
          const link = new URL('/recuperar-ingresso/' + token, env.EMAIL_PUBLIC_BASE_URL!).toString();
          const payloadCiphertext = encryptNotification({
            participantName: row.participant_name, eventTitle: row.event_title, link,
          }, env.EMAIL_ENCRYPTION_KEY!, idempotencyKey);
          await enqueueEmail(tx, { idempotencyKey, kind: 'ticket_recovery', recipientEmail: email, payloadCiphertext }, now);
        });
        return reply.header('cache-control', 'no-store').code(202).send(GENERIC);
      },
    );

    app.post(
      '/api/public/tickets/recovery/confirm',
      { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
      async (request, reply) => {
        if (!env.EMAIL_ENABLED || !env.TICKET_RECOVERY_ENABLED) return sendError(reply, 404, 'not_found', 'Recurso indisponível.');
        const parsed = confirmSchema.safeParse(request.body);
        if (!parsed.success) return sendError(reply, 400, 'invalid_token', 'Link inválido ou expirado.');
        const now = new Date().toISOString();
        const result = await app.db.transaction(async (tx) => {
          const row = await tx.get<{ id: number; registration_id: number; status: string }>(
            `SELECT q.id, q.registration_id, r.status
             FROM ticket_recovery_requests q JOIN registrations r ON r.id = q.registration_id
             WHERE q.token_hash = ? AND q.used_at IS NULL AND q.expires_at > ?`,
            [hashTicketToken(parsed.data.token), now],
          );
          if (!row || row.status !== 'confirmed') return null;
          await tx.lock(row.registration_id);
          const claimed = await tx.run(
            'UPDATE ticket_recovery_requests SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?',
            [now, row.id, now],
          );
          if (claimed.rowCount !== 1) return null;
          const next = newTicketToken();
          const rotated = await tx.run(
            "UPDATE registrations SET qr_token_hash = ? WHERE id = ? AND status = 'confirmed' RETURNING id AS id",
            [next.hash, row.registration_id],
          );
          if (rotated.rowCount !== 1) throw new Error('Ticket rotation failed');
          await tx.run('UPDATE ticket_recovery_requests SET used_at = ? WHERE registration_id = ? AND used_at IS NULL', [now, row.registration_id]);
          return next.token;
        });
        if (!result) return sendError(reply, 400, 'invalid_token', 'Link inválido ou expirado.');
        return reply.header('cache-control', 'no-store').send({ ticketToken: result });
      },
    );
  };
}
