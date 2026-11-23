import type { Env } from '../env.js';
import { openDb } from '../db/index.js';
import { ResendEmailProvider } from '../lib/email/resend-provider.js';
import { processOneEmail } from '../lib/email/outbox.js';
import { decryptAndRenderNotification } from '../lib/email/payload.js';
import { decryptEmailPayload, decodeEmailKey } from '../lib/email/crypto.js';
import { hashTicketToken } from '../lib/tickets.js';
import { pruneEmailData } from '../lib/email/maintenance.js';

/**
 * One-shot batch processor. No scheduler is installed or enabled by this change.
 * Run only in a separately approved environment with verified DNS and credentials.
 */
export async function processEmailBatch(env: Env, maxJobs = 20): Promise<number> {
  if (!env.EMAIL_ENABLED) {
    return 0;
  }
  if (!env.EMAIL_ENCRYPTION_KEY || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error('Email worker configuration incomplete');
  }
  const provider = new ResendEmailProvider({
    enabled: true,
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
  });
  const { db } = await openDb(env);
  try {
    let count = 0;
    for (; count < maxJobs; count++) {
      const processed = await processOneEmail(db, provider, async (job) => {
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
        return decryptAndRenderNotification(
          job.kind, job.recipientEmail, job.payloadCiphertext, env.EMAIL_ENCRYPTION_KEY!, job.idempotencyKey,
        );
      });
      if (!processed) break;
    }
    await pruneEmailData(db);
    return count;
  } finally {
    await db.close();
  }
}
