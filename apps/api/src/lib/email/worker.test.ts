import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../../env.js';
import { openDb } from '../../db/index.js';
import { buildApp } from '../../app.js';
import { createPublishedEvent, loginCookie, register, seedAdmin } from '../../test-utils.js';
import { processEmailBatch } from '../../scripts/email-worker.js';

const folders: string[] = [];
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true }); });

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'eventpass-worker-')); folders.push(dir);
  const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: join(dir, 'test.db'), EMAIL_ENABLED: 'true', TICKET_RECOVERY_ENABLED: 'true', EMAIL_ENCRYPTION_KEY: randomBytes(32).toString('base64'), EMAIL_PUBLIC_BASE_URL: 'https://eventpass.example', RESEND_API_KEY: 'test-only-not-real', EMAIL_FROM: 'test@example.test' });
  const { db } = await openDb(env); const app = await buildApp(env, db);
  await seedAdmin(db); const cookie = await loginCookie(app); const ev = await createPublishedEvent(app, cookie);
  await register(app, ev.slug, 'Ficticia', 'ficticia@example.test');
  await app.close(); await db.close();
  return env;
}

describe('real worker with mock HTTP transport, no external delivery', () => {
  it('renders, sends once, clears ciphertext and never reprocesses sent rows', async () => {
    const env = await fixture(); const http = vi.fn(async () => new Response('{"id":"mock"}', { status: 200 })); vi.stubGlobal('fetch', http);
    expect(await processEmailBatch(env, 1)).toBe(1);
    expect(await processEmailBatch(env, 1)).toBe(0); expect(http).toHaveBeenCalledTimes(1);
    const [, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.html).toContain('Inscrição confirmada'); expect(body.text).toContain('Ficticia');
    const { db } = await openDb(env); try { expect(await db.get('SELECT status,payload_ciphertext FROM email_outbox')).toMatchObject({ status: 'sent', payload_ciphertext: '' }); } finally { await db.close(); }
  });
  it('persists a retry on provider failure without claiming immediate success', async () => {
    const env = await fixture(); vi.stubGlobal('fetch', vi.fn(async () => new Response('private-provider-message', { status: 503 })));
    expect(await processEmailBatch(env, 1)).toBe(1);
    const { db } = await openDb(env); try { expect(await db.get('SELECT status,attempts,last_error_code FROM email_outbox')).toMatchObject({ status: 'pending', attempts: 1, last_error_code: 'delivery_failed' }); } finally { await db.close(); }
  });
  it('never sends a cancelled registration', async () => {
    const env = await fixture(); const { db } = await openDb(env); await db.run("UPDATE registrations SET status='cancelled'"); await db.close();
    const http = vi.fn(); vi.stubGlobal('fetch', http); await processEmailBatch(env, 1); expect(http).not.toHaveBeenCalled();
  });
});
