import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DbClient } from '../../db/client.js';
import { migrate, openDatabase } from '../../db/database.js';
import { SqliteClient } from '../../db/sqlite-client.js';
import { encryptEmailPayload } from './crypto.js';
import { claimEmail, enqueueEmail, markEmailFailed, markEmailSent, processOneEmail } from './outbox.js';
import { MemoryEmailProvider } from './provider.js';

let db: DbClient;
const key = randomBytes(32);
const base = {
  idempotencyKey: 'registration:42:confirmation:v1',
  kind: 'registration_confirmation' as const,
  recipientEmail: 'participante@exemplo.test',
};
const sample = () => ({
  ...base,
  payloadCiphertext: encryptEmailPayload('{"token":"test-secret"}', key, base.idempotencyKey),
});
beforeEach(() => {
  const sqlite = openDatabase(':memory:');
  migrate(sqlite);
  db = new SqliteClient(sqlite);
});

describe('email outbox (disabled foundation)', () => {
  it('enqueues idempotently and refuses unencrypted payloads', async () => {
    await enqueueEmail(db, sample(), '2026-11-22T12:00:00.000Z');
    await enqueueEmail(db, sample(), '2026-11-22T12:00:00.000Z');
    expect(await db.all('SELECT id FROM email_outbox')).toHaveLength(1);
    await expect(enqueueEmail(db, { ...sample(), payloadCiphertext: 'plaintext' })).rejects.toThrow();
    expect(await claimEmail(db, '2026-11-22T11:59:59.000Z')).toBeNull();
  });

  it('claims a job and delivers only through an injected mock', async () => {
    await enqueueEmail(db, sample(), '2026-11-22T12:00:00.000Z');
    const provider = new MemoryEmailProvider();
    expect(await processOneEmail(db, provider, async (job) => ({
      to: job.recipientEmail, subject: 'Teste', html: '<p>Teste</p>', text: 'Teste',
    }), '2026-11-22T12:00:00.000Z')).toBe(true);
    expect(provider.deliveries).toHaveLength(1);
    const row = await db.get<{ status: string; attempts: number }>('SELECT status, attempts FROM email_outbox');
    expect(row?.status).toBe('sent');
    expect(row?.attempts).toBe(1);
  });

  it('retries failed jobs and marks the fifth attempt terminal', async () => {
    await enqueueEmail(db, sample(), '2026-11-22T12:00:00.000Z');
    for (let n = 1; n <= 5; n++) {
      const at = new Date(Date.UTC(2026, 10, 22, 12, n * 70)).toISOString();
      const job = await claimEmail(db, at);
      expect(job?.attempts).toBe(n);
      await markEmailFailed(db, job!, at);
    }
    const row = await db.get<{ status: string }>('SELECT status FROM email_outbox');
    expect(row?.status).toBe('failed');
  });

  it('does not send to a recipient different from the queued address', async () => {
    await enqueueEmail(db, sample(), '2026-11-22T12:00:00.000Z');
    const provider = new MemoryEmailProvider();
    await processOneEmail(db, provider, async () => ({
      to: 'wrong@exemplo.test', subject: 'Teste', html: 'Teste', text: 'Teste',
    }), '2026-11-22T12:00:00.000Z');
    expect(provider.deliveries).toHaveLength(0);
    expect((await db.get<{ status: string }>('SELECT status FROM email_outbox'))?.status).toBe('pending');
  });

  it('rejects stale worker acknowledgement after lease takeover', async () => {
    await enqueueEmail(db, sample(), '2026-11-22T12:00:00.000Z');
    const first = await claimEmail(db, '2026-11-22T12:00:00.000Z', 1000);
    const second = await claimEmail(db, '2026-11-22T12:00:02.000Z', 1000);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!.leaseToken).not.toBe(first!.leaseToken);
    expect(await markEmailSent(db, first!)).toBe(false);
    expect(await markEmailSent(db, second!)).toBe(true);
  });
  it('serializes concurrent SQLite workers without nested transaction errors', async () => {
    await enqueueEmail(db, sample(), '2026-11-22T12:00:00.000Z');
    const claims = await Promise.all([claimEmail(db, '2026-11-22T12:00:00.000Z'), claimEmail(db, '2026-11-22T12:00:00.000Z')]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('releases the SQLite transaction queue after rollback', async () => {
    await expect(db.transaction(async () => { throw new Error('fixture failure'); })).rejects.toThrow('fixture failure');
    await enqueueEmail(db, sample(), '2026-11-22T12:00:00.000Z');
    expect(await claimEmail(db, '2026-11-22T12:00:00.000Z')).not.toBeNull();
  });

});
