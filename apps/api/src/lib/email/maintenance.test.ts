import { describe, expect, it } from 'vitest';
import { SqliteClient } from '../../db/sqlite-client.js';
import { migrate, openDatabase } from '../../db/database.js';
import { pruneEmailData } from './maintenance.js';

describe('email data retention', () => {
  it('deletes only terminal jobs older than seven days', async () => {
    const sqlite = openDatabase(':memory:');
    migrate(sqlite);
    const db = new SqliteClient(sqlite);
    const insert = (status: string, id: string, updated: string) =>
      db.run(`INSERT INTO email_outbox (idempotency_key, kind, recipient_email, payload_ciphertext,
        status, attempts, next_attempt_at, created_at, updated_at)
        VALUES (?, 'registration_confirmation', 'test@exemplo.test', '', ?, 0, ?, ?, ?)`,
        [id, status, updated, updated, updated]);
    await insert('sent', 'old', '2026-11-01T00:00:00.000Z');
    await insert('pending', 'pending', '2026-11-01T00:00:00.000Z');
    await insert('sent', 'recent', '2026-11-21T00:00:00.000Z');
    const result = await pruneEmailData(db, new Date('2026-11-22T00:00:00.000Z'));
    expect(result.outboxRows).toBe(1);
    const jobs = await db.all<{ idempotency_key: string }>('SELECT idempotency_key FROM email_outbox');
    expect(jobs.map((j) => j.idempotency_key).sort()).toEqual(['pending', 'recent']);
    await db.close();
  });
});
