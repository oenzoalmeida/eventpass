import { afterEach, describe, expect, it, vi } from 'vitest';
const batch = vi.hoisted(() => vi.fn(async () => 0));
vi.mock('../../scripts/email-worker.js', () => ({ processEmailBatch: batch }));
import handler from '../../../netlify/functions/email-queue.js';
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('scheduled execution budget wiring', () => {
  it('uses one bounded PostgreSQL job only after explicit configuration', async () => {
    for (const [key,value] of Object.entries({ EMAIL_ENABLED:'true', DATABASE_DIALECT:'postgres', EMAIL_ENCRYPTION_KEY: Buffer.alloc(32,1).toString('base64'), EMAIL_PUBLIC_BASE_URL:'https://example.test', WEB_ORIGIN:'https://example.test', EMAIL_FROM:'test@example.test', RESEND_API_KEY:'fake-test-only' })) vi.stubEnv(key,value);
    vi.spyOn(console,'info').mockImplementation(() => {});
    await handler(); expect(batch).toHaveBeenCalledWith(expect.objectContaining({ DATABASE_DIALECT:'postgres' }), 1, true);
  });
});
