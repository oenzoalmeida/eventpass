import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { loadEnv } from '../../env.js';
import { openDb } from '../../db/index.js';
describe('unexpected errors', () => {
  it('never logs database exception details or leaks them in the response', async () => {
    const env = loadEnv({ NODE_ENV:'test', DATABASE_URL:':memory:' });
    const { db } = await openDb(env); const app = await buildApp(env,db);
    app.get('/privacy-fixture', async () => { throw new Error('fixture-bearer-private@example.test'); });
    const log = vi.spyOn(app.log,'error');
    try {
      const result = await app.inject('/privacy-fixture');
      expect(result.statusCode).toBe(500); expect(result.body).not.toContain('fixture-bearer');
      expect(JSON.stringify(log.mock.calls)).not.toContain('private@example.test');
      expect(log).toHaveBeenCalledWith({ code:'internal_error' },'erro não tratado');
    } finally { await app.close();await db.close(); }
  });
});
