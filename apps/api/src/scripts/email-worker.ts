import type { Env } from '../env.js';
import { openDb } from '../db/index.js';
import { ResendEmailProvider } from '../lib/email/resend-provider.js';
import { processOneEmail } from '../lib/email/outbox.js';
import { decryptAndRenderNotification } from '../lib/email/payload.js';
import { decryptEmailPayload, decodeEmailKey } from '../lib/email/crypto.js';
import { hashTicketToken } from '../lib/tickets.js';
import { reserveSendBudget, EmailBudgetUnavailable } from '../lib/email/budget.js';
import { pruneEmailData } from '../lib/email/maintenance.js';

/**
 * One-shot batch processor also used by the opt-in Netlify scheduled handler.
 * Run only in a separately approved environment with verified DNS and credentials.
 */
export async function processEmailBatch(env: Env, maxJobs = 20, scheduled = false): Promise<number> {
  if (!env.EMAIL_ENABLED) {
    return 0;
  }
  if (!env.EMAIL_ENCRYPTION_KEY || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error('Email worker configuration incomplete');
  }
  if (!env.EMAIL_BUDGET_CONFIRMED || !env.EMAIL_DAILY_BUDGET || !env.EMAIL_MONTHLY_BUDGET) return 0;
  if (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > 20) throw new Error('Invalid batch size');
  const deadline = scheduled ? Date.now() + 15_000 : Infinity;
  const transport = new ResendEmailProvider({
    enabled: true,
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    timeoutMs: scheduled ? 5_000 : 10_000,
  });
  const { db } = await openDb(env, scheduled ? { connectTimeoutSeconds: 3, statementTimeoutMs: 1000, lockTimeoutMs: 1000, maxConnections: 1 } : {});
  try {
    const provider = { send: async (...args: Parameters<ResendEmailProvider['send']>) => {
      if (!await reserveSendBudget(db, env.EMAIL_DAILY_BUDGET, env.EMAIL_MONTHLY_BUDGET)) {
        throw new EmailBudgetUnavailable('Email sending budget unavailable');
      }
      await transport.send(...args);
    } };
    let count = 0;
    for (; count < maxJobs && Date.now() < deadline; count++) {
      const processed = await processOneEmail(db, provider, async (job) => {
        if (Date.now() >= deadline) throw new Error('Scheduled delivery budget exhausted');
        const raw = decryptEmailPayload(
          job.payloadCiphertext, decodeEmailKey(env.EMAIL_ENCRYPTION_KEY!), job.idempotencyKey,
        );
        const payload: unknown = JSON.parse(raw);
        if (!payload || typeof payload !== 'object' || !('link' in payload) || typeof payload.link !== 'string') {
          throw new Error('Invalid message content');
        }
        const url = new URL(payload.link);
        const token = url.pathname.split('/').filter(Boolean).pop();
        if (!token) throw new Error('Invalid ticket reference');
        const hash = hashTicketToken(token);
        if (job.kind === 'ticket_recovery') {
          const valid = await db.get<{ id: number }>(
            `SELECT q.id FROM ticket_recovery_requests q
             JOIN registrations r ON r.id = q.registration_id
             JOIN participants p ON p.id = r.participant_id
             WHERE q.token_hash = ? AND q.used_at IS NULL AND q.expires_at > ?
               AND r.status = 'confirmed' AND p.email = ?`,
            [hash, new Date().toISOString(), job.recipientEmail],
          );
          if (!valid) throw new Error('Recovery request expired or not eligible');
        } else {
          const valid = await db.get<{ id: number }>(
            `SELECT r.id FROM registrations r JOIN participants p ON p.id = r.participant_id
             WHERE r.qr_token_hash = ? AND r.status = 'confirmed' AND p.email = ?`,
            [hash, job.recipientEmail],
          );
          if (!valid) throw new Error('Ticket no longer eligible');
        }
        if (Date.now() >= deadline) throw new Error('Scheduled delivery budget exhausted');
        return decryptAndRenderNotification(
          job.kind, job.recipientEmail, job.payloadCiphertext, env.EMAIL_ENCRYPTION_KEY!, job.idempotencyKey,
        );
      });
      if (!processed) break;
    }
    // Scheduled invocations reserve their short execution window for delivery.
    // Retention runs through the separate bounded CLI maintenance path.
    if (!scheduled) await pruneEmailData(db);
    return count;
  } finally {
    await db.close();
  }
}
