import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDatabase, migrate } from '../db/database.js';
import { SqliteClient } from '../db/sqlite-client.js';
import type { DbClient } from '../db/client.js';
import { loadEnv } from '../env.js';
import { decodeEmailKey, decryptEmailPayload } from '../lib/email/crypto.js';
import { createPublishedEvent, loginCookie, register, seedAdmin } from '../test-utils.js';

const encryptionKey = randomBytes(32).toString('base64');
const env = loadEnv({
  NODE_ENV: 'test', DATABASE_URL: ':memory:', EMAIL_ENABLED: 'true',
  TICKET_RECOVERY_ENABLED: 'true',
  EMAIL_ENCRYPTION_KEY: encryptionKey, EMAIL_PUBLIC_BASE_URL: 'https://eventpass.example',
});

let app: FastifyInstance;
let db: DbClient;
let cookie: string;
beforeEach(async () => {
  const sqlite = openDatabase(':memory:');
  migrate(sqlite);
  db = new SqliteClient(sqlite);
  app = await buildApp(env, db);
  await seedAdmin(db);
  cookie = await loginCookie(app);
});
afterEach(async () => { await app.close(); await db.close(); });

describe('ticket recovery (all email delivery mocked)', () => {
  it('queues confirmation encrypted, but never sends without a worker', async () => {
    const ev = await createPublishedEvent(app, cookie);
    const res = await register(app, ev.slug, 'Ana Souza', 'ana@exemplo.test');
    expect(res.statusCode).toBe(201);
    const job = await db.get<{ payload_ciphertext: string; idempotency_key: string }>(
      "SELECT payload_ciphertext, idempotency_key FROM email_outbox WHERE kind = 'registration_confirmation'",
    );
    expect(job).not.toBeNull();
    expect(job!.payload_ciphertext).not.toContain(res.json().ticketToken);
    const raw = decryptEmailPayload(job!.payload_ciphertext, decodeEmailKey(encryptionKey), job!.idempotency_key);
    expect(JSON.parse(raw).link).toContain(res.json().ticketToken);
    expect((await app.inject({ method: 'GET', url: '/api/public/features' })).json().ticketRecovery).toBe(true);
  });

  it('recovers a confirmed ticket once and invalidates the previous one', async () => {
    const ev = await createPublishedEvent(app, cookie);
    const registered = await register(app, ev.slug, 'Ana Souza', 'ana@exemplo.test');
    const original = registered.json().ticketToken;
    const request = await app.inject({
      method: 'POST', url: '/api/public/tickets/recovery/request',
      payload: { slug: ev.slug, email: 'ana@exemplo.test' },
    });
    expect(request.statusCode).toBe(202);
    const job = await db.get<{ payload_ciphertext: string; idempotency_key: string }>(
      "SELECT payload_ciphertext, idempotency_key FROM email_outbox WHERE kind = 'ticket_recovery'",
    );
    expect(job).not.toBeNull();
    const raw = decryptEmailPayload(job!.payload_ciphertext, decodeEmailKey(encryptionKey), job!.idempotency_key);
    const recoveryToken = new URL(JSON.parse(raw).link).pathname.split('/').pop()!;
    const confirmed = await app.inject({
      method: 'POST', url: '/api/public/tickets/recovery/confirm', payload: { token: recoveryToken },
    });
    expect(confirmed.statusCode).toBe(200);
    const next = confirmed.json().ticketToken;
    expect(next).not.toBe(original);
    expect((await app.inject({ method: 'GET', url: '/api/public/tickets/' + original })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/public/tickets/' + next })).statusCode).toBe(200);
    const invalidCheckin = await app.inject({
      method: 'POST', url: '/api/admin/events/' + ev.id + '/checkins',
      headers: { cookie }, payload: { token: original },
    });
    expect(invalidCheckin.statusCode).toBe(404);
    const validCheckin = await app.inject({
      method: 'POST', url: '/api/admin/events/' + ev.id + '/checkins',
      headers: { cookie }, payload: { token: next },
    });
    expect(validCheckin.statusCode).toBe(200);
    expect((await app.inject({
      method: 'POST', url: '/api/public/tickets/recovery/confirm', payload: { token: recoveryToken },
    })).statusCode).toBe(400);
  });

  it('does not reveal whether a participant exists', async () => {
    const ev = await createPublishedEvent(app, cookie);
    const real = await register(app, ev.slug, 'Ana', 'ana@exemplo.test');
    expect(real.statusCode).toBe(201);
    const realRequest = await app.inject({
      method: 'POST', url: '/api/public/tickets/recovery/request',
      payload: { slug: ev.slug, email: 'ana@exemplo.test' },
    });
    const unknown = await app.inject({
      method: 'POST', url: '/api/public/tickets/recovery/request',
      payload: { slug: ev.slug, email: 'inexistente@exemplo.test' },
    });
    expect(realRequest.statusCode).toBe(unknown.statusCode);
    expect(realRequest.body).toBe(unknown.body);
  });
});

describe('recovery expiry, concurrency and throttling', () => {
  async function requestToken() {
    const ev = await createPublishedEvent(app, cookie);
    await register(app, ev.slug, 'Ficticia', 'ficticia@example.test');
    await app.inject({ method: 'POST', url: '/api/public/tickets/recovery/request', payload: { slug: ev.slug, email: 'ficticia@example.test' } });
    const job = await db.get<{ payload_ciphertext: string; idempotency_key: string }>("SELECT payload_ciphertext,idempotency_key FROM email_outbox WHERE kind='ticket_recovery'");
    const raw = decryptEmailPayload(job!.payload_ciphertext, decodeEmailKey(encryptionKey), job!.idempotency_key);
    return { ev, token: new URL(JSON.parse(raw).link).pathname.split('/').pop()! };
  }
  it('refuses an expired token without rotating the ticket', async () => {
    const { token } = await requestToken();
    await db.run("UPDATE ticket_recovery_requests SET expires_at='2000-01-01T00:00:00.000Z'");
    const before = await db.get('SELECT qr_token_hash FROM registrations');
    expect((await app.inject({ method: 'POST', url: '/api/public/tickets/recovery/confirm', payload: { token } })).statusCode).toBe(400);
    expect(await db.get('SELECT qr_token_hash FROM registrations')).toEqual(before);
  });
  it('permits only one concurrent redemption', async () => {
    const { token } = await requestToken();
    const results = await Promise.all(Array.from({ length: 2 }, () => app.inject({ method: 'POST', url: '/api/public/tickets/recovery/confirm', payload: { token } })));
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 400]);
  });
  it('limits requests both per registration and per IP', async () => {
    const { ev } = await requestToken();
    for (let i = 0; i < 4; i++) expect((await app.inject({ method: 'POST', url: '/api/public/tickets/recovery/request', payload: { slug: ev.slug, email: 'ficticia@example.test' } })).statusCode).toBe(202);
    expect((await db.all('SELECT id FROM ticket_recovery_requests')).length).toBe(3);
    expect((await app.inject({ method: 'POST', url: '/api/public/tickets/recovery/request', payload: { slug: ev.slug, email: 'ficticia@example.test' } })).statusCode).toBe(429);
  });
});
