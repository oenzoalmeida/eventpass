import { randomUUID } from 'node:crypto';
import type { DbClient } from '../../db/client.js';
import type { EmailKind, EmailMessage, EmailProvider } from './provider.js';

export interface EnqueueEmail {
  idempotencyKey: string;
  kind: EmailKind;
  recipientEmail: string;
  /** AES-256-GCM envelope produced by encryptEmailPayload; not plaintext. */
  payloadCiphertext: string;
}

export interface ClaimedEmail {
  id: number;
  leaseToken: string;
  idempotencyKey: string;
  kind: EmailKind;
  recipientEmail: string;
  payloadCiphertext: string;
  attempts: number;
}
const nowIso = () => new Date().toISOString();

export async function enqueueEmail(db: DbClient, job: EnqueueEmail, now = nowIso()): Promise<void> {
  if (!job.idempotencyKey || !job.recipientEmail || !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(job.payloadCiphertext)) {
    throw new Error('Missing or invalid outbox fields');
  }
  if (!['registration_confirmation', 'ticket_recovery'].includes(job.kind)) throw new Error('Unsupported email kind');
  await db.run(
    `INSERT INTO email_outbox
       (idempotency_key, kind, recipient_email, payload_ciphertext, status,
        attempts, next_attempt_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)
     ON CONFLICT(idempotency_key) DO NOTHING`,
    [job.idempotencyKey, job.kind, job.recipientEmail, job.payloadCiphertext, now, now, now],
  );
}

export async function claimEmail(db: DbClient, now = nowIso(), leaseMs = 60_000): Promise<ClaimedEmail | null> {
  if (!Number.isFinite(leaseMs) || leaseMs <= 0 || !Number.isFinite(Date.parse(now))) throw new Error('Invalid lease');
  return db.transaction(async (tx) => {
    await tx.lock('email-outbox-claim');
    // An expired final attempt cannot be retried: mark it as failed before selecting a job.
    await tx.run(
      `UPDATE email_outbox SET status = 'failed', lease_until = NULL, lease_token = NULL,
       last_error_code = 'delivery_unknown', payload_ciphertext = '', updated_at = ?
       WHERE status = 'processing' AND lease_until <= ? AND attempts >= 5`,
      [now, now],
    );
    const row = await tx.get<{
      id: number; idempotency_key: string; kind: EmailKind;
      recipient_email: string; payload_ciphertext: string; attempts: number;
    }>(
      `SELECT id, idempotency_key, kind, recipient_email, payload_ciphertext, attempts
       FROM email_outbox
       WHERE (status = 'pending' AND next_attempt_at <= ?)
          OR (status = 'processing' AND lease_until <= ? AND attempts < 5)
       ORDER BY id LIMIT 1`,
      [now, now],
    );
    if (!row) return null;
    const leaseUntil = new Date(Date.parse(now) + leaseMs).toISOString();
    const leaseToken = randomUUID();
    await tx.run(
      `UPDATE email_outbox
       SET status = 'processing', attempts = attempts + 1, lease_until = ?,
           lease_token = ?, updated_at = ?, last_error_code = NULL WHERE id = ?`,
      [leaseUntil, leaseToken, now, row.id],
    );
    return {
      id: Number(row.id), leaseToken, idempotencyKey: row.idempotency_key,
      kind: row.kind, recipientEmail: row.recipient_email,
      payloadCiphertext: row.payload_ciphertext, attempts: Number(row.attempts) + 1,
    };
  });
}

export async function markEmailSent(db: DbClient, job: ClaimedEmail, at = nowIso()): Promise<boolean> {
  const result = await db.run(
    `UPDATE email_outbox SET status = 'sent', sent_at = ?, payload_ciphertext = '', lease_until = NULL,
     lease_token = NULL, updated_at = ? WHERE id = ? AND status = 'processing' AND lease_token = ?`,
    [at, at, job.id, job.leaseToken],
  );
  return result.rowCount === 1;
}

export async function markEmailFailed(db: DbClient, job: ClaimedEmail, at = nowIso(), maxAttempts = 5): Promise<boolean> {
  const permanent = job.attempts >= maxAttempts;
  const retryDelayMs = Math.min(3_600_000, 30_000 * 2 ** Math.max(0, job.attempts - 1));
  const result = await db.run(
    `UPDATE email_outbox SET status = ?, next_attempt_at = ?,
     payload_ciphertext = CASE WHEN ? = 'failed' THEN '' ELSE payload_ciphertext END, lease_until = NULL,
     lease_token = NULL, last_error_code = 'delivery_failed', updated_at = ?
     WHERE id = ? AND status = 'processing' AND lease_token = ?`,
    [permanent ? 'failed' : 'pending', new Date(Date.parse(at) + retryDelayMs).toISOString(), permanent ? 'failed' : 'pending', at, job.id, job.leaseToken],
  );
  return result.rowCount === 1;
}

/**
 * No worker is registered yet. The caller must provide an authorized decrypt/render function.
 * At-least-once processing: a provider idempotency key is required to mitigate duplicate delivery.
 */
export async function processOneEmail(
  db: DbClient, provider: EmailProvider,
  render: (job: ClaimedEmail) => Promise<EmailMessage>,
  now = nowIso(),
): Promise<boolean> {
  const job = await claimEmail(db, now);
  if (!job) return false;
  try {
    const message = await render(job);
    if (message.to !== job.recipientEmail) throw new Error('Recipient mismatch');
    await provider.send(message, job.idempotencyKey);
    await markEmailSent(db, job);
  } catch {
    await markEmailFailed(db, job);
  }
  return true;
}
